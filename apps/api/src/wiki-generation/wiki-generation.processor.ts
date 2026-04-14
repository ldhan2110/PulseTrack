import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { spawn } from 'child_process';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { NotificationsService } from '../notifications/notifications.service';
import { WikiGenerationService } from './wiki-generation.service';
import type { WikiGenerationJobData, WikiGenerationJobResult } from './dto/generate-wiki.dto';

@Processor('wiki-generation', { concurrency: 1 })
export class WikiGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(WikiGenerationProcessor.name);
  private activeChildren = new Map<string, import('child_process').ChildProcess>();

  constructor(
    private readonly wikiService: WikiGenerationService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  /** Kill all child processes for a given job and mark it failed. */
  abortJob(jobId: string): boolean {
    const child = this.activeChildren.get(jobId);
    if (child) {
      this.logger.warn(`[Wiki ${jobId}] Aborting — killing child PID ${child.pid}`);
      child.kill('SIGTERM');
      // Force-kill after 3 s if still alive
      setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL');
      }, 3_000);
      this.activeChildren.delete(jobId);
      return true;
    }
    return false;
  }

  private runCliStreaming(
    command: string,
    args: string[],
    opts: { cwd: string; timeout: number; env?: Record<string, string | undefined> },
    jobId: string | undefined,
    onChunk?: (text: string) => void,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: opts.cwd,
        env: opts.env as NodeJS.ProcessEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // Track child so it can be killed on abort
      if (jobId) this.activeChildren.set(jobId, child);

      const stdoutChunks: string[] = [];
      let killed = false;

      // timeout=0 means no timeout — let the process run to completion
      const timer = opts.timeout > 0
        ? setTimeout(() => {
            killed = true;
            child.kill('SIGTERM');
            reject(new Error(`CLI timed out after ${opts.timeout}ms`));
          }, opts.timeout)
        : null;

      child.stdout.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stdoutChunks.push(text);
        onChunk?.(text);
        for (const line of text.split('\n').filter(Boolean)) {
          this.logger.log(`[Wiki ${jobId}] ${line}`);
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        onChunk?.(text);
        for (const line of text.split('\n').filter(Boolean)) {
          this.logger.warn(`[Wiki ${jobId}] ${line}`);
        }
      });

      child.on('error', (err) => {
        if (timer) clearTimeout(timer);
        reject(err);
      });

      child.on('close', (code) => {
        if (jobId) this.activeChildren.delete(jobId);
        if (timer) clearTimeout(timer);
        if (killed) return;
        if (code === 0 || code === null) {
          resolve(stdoutChunks.join(''));
        } else {
          reject(new Error(`CLI exited with code ${code}`));
        }
      });
    });
  }

  private emitStep(userId: string, job: Job<WikiGenerationJobData>, step: string): void {
    this.notifications.notifyUser(userId, 'wiki-generation:progress', {
      jobId: job.id,
      step,
    });
    void job.updateProgress({ step });
    this.logger.log(`[Wiki ${job.id}] Step: ${step}`);
  }

  async process(job: Job<any>): Promise<any> {
    if (job.name === 'wiki-qa') {
      return this.processQa(job as Job<{ projectId: string; userId: string; question: string; wikiPath: string }>);
    }
    return this.processGeneration(job as Job<WikiGenerationJobData>);
  }

  private async processGeneration(job: Job<WikiGenerationJobData>): Promise<WikiGenerationJobResult> {
    const { projectId, userId, sections } = job.data;

    let logBuffer = '';
    let currentStep = 'queued';
    const emitStream = (chunk: string) => {
      logBuffer += chunk;
      this.notifications.notifyUser(userId, 'wiki-generation:stream', {
        jobId: job.id,
        text: logBuffer,
      });
      void job.updateProgress({ step: currentStep, streamText: logBuffer });
    };

    try {
      const config = await this.wikiService.getProjectConfig(projectId);
      const result: WikiGenerationJobResult = { pagesGenerated: 0, sections: {}, errors: [] };

      // Step 1: git pull
      currentStep = 'pulling';
      this.emitStep(userId, job, 'pulling');
      emitStream('$ git pull\n');

      const pullOutput = await this.runCliStreaming('git', ['pull'], {
        cwd: config.workspacePath,
        timeout: 60_000,
      }, job.id, emitStream);

      if (!pullOutput.trim()) emitStream('Already up to date.\n');
      emitStream('\n');

      // Step 2: Run llm-wiki ingest via CLI
      currentStep = 'generating-sections';
      this.emitStep(userId, job, 'generating-sections');
      emitStream(`$ ${config.cli} (llm-wiki ingest: ${sections.join(', ')})\n`);

      // Pre-notify all sections as generating
      for (const section of sections) {
        this.notifications.notifyUser(userId, 'wiki-generation:section-start', {
          jobId: job.id,
          section,
          agent: 'llm-wiki',
        });
      }

      const ingestPrompt = this.wikiService.buildLlmWikiIngestPrompt(
        config.wikiPath,
        sections,
        config.projectContext,
      );
      const ingestArgs = this.wikiService.buildCliArgs(config.provider, config.model, ingestPrompt);
      const ingestEnv = this.wikiService.buildCliEnv(config.provider, config.apiKey);

      const rawOutput = await this.runCliStreaming(config.cli, ingestArgs, {
        cwd: config.workspacePath,
        timeout: 0,
        env: { ...process.env, ...ingestEnv },
      }, job.id, emitStream);

      // Parse any files from CLI output as fallback
      const files = this.wikiService.parseGeneratedFiles(rawOutput);
      if (files.length > 0) {
        for (const file of files) {
          const filePath = join(config.wikiPath, file.path);
          const dir = filePath.substring(0, filePath.lastIndexOf('/'));
          await mkdir(dir, { recursive: true });
          await writeFile(filePath, file.content, 'utf-8');
        }
        result.pagesGenerated = files.length;
      }

      // Notify all sections complete
      for (const section of sections) {
        const sectionFiles = files.filter((f) => f.path.startsWith(section + '/'));
        result.sections[section] = sectionFiles.length;
        this.notifications.notifyUser(userId, 'wiki-generation:section-complete', {
          jobId: job.id,
          section,
          pagesGenerated: sectionFiles.length,
        });
      }

      emitStream(`\n`);

      // Step 3: Write _meta.json
      currentStep = 'writing-meta';
      this.emitStep(userId, job, 'writing-meta');

      const meta = {
        generatedAt: new Date().toISOString(),
        sections,
        stats: {
          totalPages: result.pagesGenerated,
          pagesPerSection: result.sections,
        },
        generationLog: {
          provider: config.provider,
          model: config.model,
          errors: result.errors,
        },
      };
      await mkdir(config.wikiPath, { recursive: true });
      await writeFile(join(config.wikiPath, '_meta.json'), JSON.stringify(meta, null, 2), 'utf-8');

      await this.wikiService.updateLastGenerated(projectId);

      emitStream(`\nDone — generated ${result.pagesGenerated} page(s) across ${sections.length} section(s).\n`);

      this.notifications.notifyUser(userId, 'wiki-generation:completed', {
        jobId: job.id,
        pagesGenerated: result.pagesGenerated,
      });

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[Wiki ${job.id}] Failed: ${message}`, error instanceof Error ? error.stack : undefined);
      emitStream(`\nError: ${message}\n`);

      this.notifications.notifyUser(userId, 'wiki-generation:failed', {
        jobId: job.id,
        error: message,
      });

      throw error;
    }
  }

  private async processQa(job: Job<{ projectId: string; userId: string; question: string; wikiPath: string }>): Promise<{ answer: string }> {
    const { projectId, userId, question, wikiPath } = job.data;

    let logBuffer = '';
    const emitStream = (chunk: string) => {
      logBuffer += chunk;
      this.notifications.notifyUser(userId, 'wiki-generation:stream', {
        jobId: job.id,
        text: logBuffer,
      });
      void job.updateProgress({ step: 'answering', streamText: logBuffer });
    };

    try {
      const config = await this.wikiService.getProjectConfig(projectId);

      const qaPrompt = `Use /llm-wiki query to answer this question: "${question}"

The wiki directory is at: ${wikiPath}

After answering, save the Q&A as a markdown file:
<!-- file: qa/${Date.now()}.md -->
---
title: ${question.slice(0, 100)}
question: ${question}
section: qa
generatedAt: ${new Date().toISOString()}
---

[Your answer here]`;

      const args = this.wikiService.buildCliArgs(config.provider, config.model, qaPrompt);
      const env = this.wikiService.buildCliEnv(config.provider, config.apiKey);

      const rawOutput = await this.runCliStreaming(config.cli, args, {
        cwd: config.workspacePath,
        timeout: 300_000,
        env: { ...process.env, ...env },
      }, job.id, emitStream);

      // Write Q&A file if generated
      const files = this.wikiService.parseGeneratedFiles(rawOutput);
      for (const file of files) {
        const filePath = join(wikiPath, file.path);
        const dir = filePath.substring(0, filePath.lastIndexOf('/'));
        await mkdir(dir, { recursive: true });
        await writeFile(filePath, file.content, 'utf-8');
      }

      this.notifications.notifyUser(userId, 'wiki-generation:completed', {
        jobId: job.id,
      });

      return { answer: rawOutput };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      emitStream(`\nError: ${message}\n`);
      this.notifications.notifyUser(userId, 'wiki-generation:failed', {
        jobId: job.id,
        error: message,
      });
      throw error;
    }
  }
}
