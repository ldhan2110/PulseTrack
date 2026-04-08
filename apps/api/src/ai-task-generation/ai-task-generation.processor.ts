// apps/api/src/ai-task-generation/ai-task-generation.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { spawn } from 'child_process';
import { NotificationsService } from '../notifications/notifications.service';
import { AiTaskGenerationService } from './ai-task-generation.service';
import type { GenerationJobData, GenerationJobResult } from './dto/generate-tasks.dto';

@Processor('ai-task-generation', { concurrency: 4 })
export class AiTaskGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(AiTaskGenerationProcessor.name);

  constructor(
    private readonly aiService: AiTaskGenerationService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  /**
   * Spawn a CLI process with stdin closed (prevents "no stdin data" warnings)
   * and stream stdout/stderr to the NestJS logger in real-time.
   * Returns the full stdout buffer once the process exits.
   *
   * @param onChunk optional callback invoked with each stdout chunk for live streaming
   */
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
        stdio: ['ignore', 'pipe', 'pipe'], // Close stdin to prevent "no stdin data" warning
      });

      const stdoutChunks: string[] = [];
      let killed = false;

      // Manual timeout — spawn doesn't have a built-in timeout option
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
        // Also forward stderr to onChunk so the user can see warnings
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
        if (killed) return; // Already rejected by timeout
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
    job: Job<GenerationJobData>,
    step: string,
  ): void {
    this.notifications.notifyUser(userId, 'ai-generation:progress', {
      jobId: job.id,
      step,
    });
    void job.updateProgress({ step });
    this.logger.log(`[Job ${job.id}] Step: ${step}`);
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      if (error.message.includes('TIMEOUT') || error.message.includes('timed out')) {
        return 'AI generation timed out — try a simpler prompt or disable codebase scan';
      }
      if (error.message.includes('ENOENT')) {
        return 'AI CLI not found — check server configuration';
      }
      if (error.message.includes('exited with code')) {
        return `AI CLI process failed (${error.message})`;
      }
      if (error.message.includes('invalid JSON') || error.message.includes('missing "tasks"')) {
        return 'AI returned an invalid response — please retry';
      }
      if (error.message.includes('AI configuration') || error.message.includes('Repository must')) {
        return error.message;
      }
      return error.message;
    }
    return 'An unexpected error occurred';
  }

  async process(job: Job<GenerationJobData>): Promise<GenerationJobResult> {
    const { projectId, userId, prompt, scanCodebase, breakIntoSubTasks, uploadedFilePaths } =
      job.data;

    // Shared log buffer — accumulates across all steps so the frontend
    // terminal shows the entire session history.
    let logBuffer = '';
    let currentStep = 'queued';
    const emitStream = (chunk: string) => {
      logBuffer += chunk;
      this.notifications.notifyUser(userId, 'ai-generation:stream', {
        jobId: job.id,
        text: logBuffer,
      });
      void job.updateProgress({ step: currentStep, streamText: logBuffer });
    };

    try {
      const config = await this.aiService.getProjectAiConfig(projectId);

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

      // Step 2: Codebase scan (if requested)
      let scanResults: string | null = null;
      if (scanCodebase) {
        currentStep = 'scanning';
        this.emitStep(userId, job, 'scanning');
        emitStream(`$ ${config.cli} (codebase scan)\n`);

        const scanPrompt = this.aiService.buildScanPrompt(prompt);
        const scanArgs = this.aiService.buildCliArgs(config.provider, config.model, scanPrompt, []);
        const scanEnv = this.aiService.buildCliEnv(config.provider, config.apiKey);

        const scanOutput = await this.runCliStreaming(config.cli, scanArgs, {
          cwd: config.workspacePath,
          timeout: 300_000,
          env: { ...process.env, ...scanEnv },
        }, job.id, emitStream);

        scanResults = scanOutput.trim();
        emitStream('\n');
      }

      // Step 3: Build and run generation prompt
      currentStep = 'generating';
      this.emitStep(userId, job, 'generating');
      emitStream(`$ ${config.cli} (generating tasks)\n`);

      let generationPrompt = this.aiService.buildGenerationPrompt({
        userPrompt: prompt,
        projectContext: config.projectContext,
        scanResults,
        breakIntoSubTasks,
      });

      generationPrompt = await this.aiService.augmentPromptWithFiles(
        generationPrompt,
        uploadedFilePaths,
        config.provider,
      );

      const genArgs = this.aiService.buildCliArgs(
        config.provider,
        config.model,
        generationPrompt,
        uploadedFilePaths,
      );
      const genEnv = this.aiService.buildCliEnv(config.provider, config.apiKey);

      // Use a generous 10-minute timeout — AI generation varies widely in duration.
      const rawOutput = await this.runCliStreaming(config.cli, genArgs, {
        cwd: config.workspacePath,
        timeout: 600_000,
        env: { ...process.env, ...genEnv },
      }, job.id, emitStream);

      // Step 4: Parse output
      currentStep = 'parsing';
      this.emitStep(userId, job, 'parsing');
      emitStream('\nParsing AI output...\n');

      const result = this.aiService.parseAndValidateOutput(rawOutput);

      emitStream(`Done — generated ${result.tasks.length} task(s).\n`);

      // Notify completion
      this.notifications.notifyUser(userId, 'ai-generation:completed', {
        jobId: job.id,
        taskCount: result.tasks.length,
      });

      return result;
    } catch (error) {
      const message = this.getErrorMessage(error);
      this.logger.error(`[Job ${job.id}] Failed: ${message}`, error instanceof Error ? error.stack : undefined);

      emitStream(`\nError: ${message}\n`);

      this.notifications.notifyUser(userId, 'ai-generation:failed', {
        jobId: job.id,
        error: message,
      });

      throw error;
    }
  }
}
