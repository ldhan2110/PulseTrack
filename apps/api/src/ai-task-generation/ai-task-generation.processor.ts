// apps/api/src/ai-task-generation/ai-task-generation.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { execFile } from 'child_process';
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
   * Spawn a CLI process and stream stdout/stderr to the NestJS logger in real-time.
   * Returns the full stdout buffer once the process exits.
   */
  private runCliStreaming(
    command: string,
    args: string[],
    opts: { cwd: string; timeout: number; env?: Record<string, string | undefined> },
    jobId: string | undefined,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = execFile(command, args, {
        cwd: opts.cwd,
        timeout: opts.timeout,
        maxBuffer: 10 * 1024 * 1024,
        env: opts.env as NodeJS.ProcessEnv,
      });

      const stdoutChunks: string[] = [];

      child.stdout?.on('data', (chunk: Buffer | string) => {
        const text = chunk.toString();
        stdoutChunks.push(text);
        // Stream each line to NestJS console
        for (const line of text.split('\n').filter(Boolean)) {
          this.logger.log(`[Job ${jobId}] ${line}`);
        }
      });

      child.stderr?.on('data', (chunk: Buffer | string) => {
        const text = chunk.toString();
        for (const line of text.split('\n').filter(Boolean)) {
          this.logger.warn(`[Job ${jobId}] ${line}`);
        }
      });

      child.on('error', (err) => reject(err));

      child.on('close', (code) => {
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

    try {
      const config = await this.aiService.getProjectAiConfig(projectId);

      // Step 1: git pull
      this.emitStep(userId, job, 'pulling');

      await this.runCliStreaming('git', ['pull'], {
        cwd: config.workspacePath,
        timeout: 60_000,
      }, job.id);

      // Step 2: Codebase scan (if requested)
      let scanResults: string | null = null;
      if (scanCodebase) {
        this.emitStep(userId, job, 'scanning');

        const scanPrompt = this.aiService.buildScanPrompt(prompt);
        const scanArgs = this.aiService.buildCliArgs(config.provider, config.model, scanPrompt, []);
        const scanEnv = this.aiService.buildCliEnv(config.provider, config.apiKey);

        const scanOutput = await this.runCliStreaming(config.cli, scanArgs, {
          cwd: config.workspacePath,
          timeout: 120_000,
          env: { ...process.env, ...scanEnv },
        }, job.id);

        scanResults = scanOutput.trim();
      }

      // Step 3: Build and run generation prompt
      this.emitStep(userId, job, 'generating');

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

      const rawOutput = await this.runCliStreaming(config.cli, genArgs, {
        cwd: config.workspacePath,
        timeout: 180_000,
        env: { ...process.env, ...genEnv },
      }, job.id);

      // Step 4: Parse output
      this.emitStep(userId, job, 'parsing');

      const result = this.aiService.parseAndValidateOutput(rawOutput);

      // Notify completion
      this.notifications.notifyUser(userId, 'ai-generation:completed', {
        jobId: job.id,
        taskCount: result.tasks.length,
      });

      return result;
    } catch (error) {
      const message = this.getErrorMessage(error);
      this.logger.error(`[Job ${job.id}] Failed: ${message}`, error instanceof Error ? error.stack : undefined);

      this.notifications.notifyUser(userId, 'ai-generation:failed', {
        jobId: job.id,
        error: message,
      });

      throw error;
    }
  }
}
