// apps/api/src/ai-wbs-generation/ai-wbs-generation.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { spawn } from 'child_process';
import { NotificationsService } from '../notifications/notifications.service';
import { AiWbsGenerationService } from './ai-wbs-generation.service';
import type { WbsGenerationJobData, WbsGenerationJobResult } from './dto/generate-wbs.dto';

@Processor('ai-wbs-generation', { concurrency: 2 })
export class AiWbsGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(AiWbsGenerationProcessor.name);

  constructor(
    private readonly aiService: AiWbsGenerationService,
    private readonly notifications: NotificationsService,
  ) {
    super();
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

      const stdoutChunks: string[] = [];
      let killed = false;

      const timer = setTimeout(() => {
        killed = true;
        child.kill('SIGTERM');
        reject(new Error(`CLI timed out after ${opts.timeout}ms`));
      }, opts.timeout);

      child.stdout.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stdoutChunks.push(text);
        onChunk?.(text);
        for (const line of text.split('\n').filter(Boolean)) {
          this.logger.log(`[Job ${jobId}] ${line}`);
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        onChunk?.(text);
        for (const line of text.split('\n').filter(Boolean)) {
          this.logger.warn(`[Job ${jobId}] ${line}`);
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (killed) return;
        if (code === 0 || code === null) {
          resolve(stdoutChunks.join(''));
        } else {
          reject(new Error(`CLI exited with code ${code}`));
        }
      });
    });
  }

  private emitStep(
    userId: string,
    job: Job<WbsGenerationJobData>,
    step: string,
  ): void {
    this.notifications.notifyUser(userId, 'ai-wbs-generation:progress', {
      jobId: job.id,
      step,
    });
    void job.updateProgress({ step });
    this.logger.log(`[Job ${job.id}] Step: ${step}`);
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      if (error.message.includes('TIMEOUT') || error.message.includes('timed out')) {
        return 'AI WBS generation timed out — try a simpler prompt or fewer features';
      }
      if (error.message.includes('ENOENT')) {
        return 'AI CLI not found — check server configuration';
      }
      if (error.message.includes('exited with code')) {
        return `AI CLI process failed (${error.message})`;
      }
      if (error.message.includes('invalid JSON') || error.message.includes('missing "phases"')) {
        return 'AI returned an invalid response — please retry';
      }
      if (error.message.includes('AI configuration')) {
        return error.message;
      }
      return error.message;
    }
    return 'An unexpected error occurred';
  }

  async process(job: Job<WbsGenerationJobData>): Promise<WbsGenerationJobResult> {
    const {
      projectId,
      userId,
      instructions,
      features,
      teamSize,
      teamRoles,
      projectStartDate,
      targetEndDate,
      methodology,
      sprintDuration,
      uploadedFilePaths,
    } = job.data;

    let logBuffer = '';
    let currentStep = 'queued';
    const emitStream = (chunk: string) => {
      logBuffer += chunk;
      this.notifications.notifyUser(userId, 'ai-wbs-generation:stream', {
        jobId: job.id,
        text: logBuffer,
      });
      void job.updateProgress({ step: currentStep, streamText: logBuffer });
    };

    try {
      // Step 1: Get AI config
      const config = await this.aiService.getProjectAiConfig(projectId);

      // Step 2: Read uploaded files
      currentStep = 'reading-files';
      this.emitStep(userId, job, 'reading-files');
      const fileContents = await this.aiService.readUploadedFiles(uploadedFilePaths);

      // Step 3: Build and run generation prompt
      currentStep = 'generating';
      this.emitStep(userId, job, 'generating');
      emitStream(`$ ${config.cli} (generating WBS)\n`);

      const generationPrompt = this.aiService.buildGenerationPrompt({
        instructions,
        features: features ?? [],
        teamSize,
        teamRoles,
        projectStartDate,
        targetEndDate,
        methodology,
        sprintDuration,
        projectContext: config.projectContext,
        fileContents,
      });

      const genArgs = this.aiService.buildCliArgs(config.provider, config.model, generationPrompt);
      const genEnv = this.aiService.buildCliEnv(config.provider, config.apiKey);

      const rawOutput = await this.runCliStreaming(config.cli, genArgs, {
        cwd: process.cwd(),
        timeout: 600_000,
        env: { ...process.env, ...genEnv },
      }, job.id, emitStream);

      // Step 4: Parse output
      currentStep = 'parsing';
      this.emitStep(userId, job, 'parsing');
      emitStream('\nParsing AI output...\n');

      const result = this.aiService.parseAndValidateOutput(rawOutput);

      emitStream(`Done — generated ${result.phases.length} phase(s).\n`);

      this.notifications.notifyUser(userId, 'ai-wbs-generation:completed', {
        jobId: job.id,
        phaseCount: result.phases.length,
      });

      return result;
    } catch (error) {
      const message = this.getErrorMessage(error);
      this.logger.error(`[Job ${job.id}] Failed: ${message}`, error instanceof Error ? error.stack : undefined);

      emitStream(`\nError: ${message}\n`);

      this.notifications.notifyUser(userId, 'ai-wbs-generation:failed', {
        jobId: job.id,
        error: message,
      });

      throw error;
    }
  }
}
