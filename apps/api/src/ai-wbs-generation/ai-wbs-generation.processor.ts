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
    const data = job.data;
    const { projectId, userId, scanCodebase } = data;

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
      // Step 1: Get AI config (require repo if scanning)
      const config = await this.aiService.getProjectAiConfig(projectId, !!scanCodebase);

      // Step 2: Read uploaded files
      currentStep = 'reading-files';
      this.emitStep(userId, job, 'reading-files');
      const fileContents = await this.aiService.readUploadedFiles(data.uploadedFilePaths);

      // Step 3: Scan codebase (if requested)
      let scanResults: string | null = null;
      if (scanCodebase) {
        // Step 3a: git pull
        currentStep = 'pulling';
        this.emitStep(userId, job, 'pulling');
        emitStream('$ git pull\n');

        const pullOutput = await this.runCliStreaming('git', ['pull'], {
          cwd: config.workspacePath,
          timeout: 60_000,
        }, job.id, emitStream);

        if (!pullOutput.trim()) emitStream('Already up to date.\n');
        emitStream('\n');

        // Step 3b: Build/update code knowledge graph
        currentStep = 'building-graph';
        this.emitStep(userId, job, 'building-graph');
        emitStream(`$ ${config.cli} (building code graph)\n`);

        const graphPrompt = this.aiService.buildGraphPrompt();
        const graphArgs = this.aiService.buildCliArgs(config.provider, config.model, graphPrompt);
        const graphEnv = this.aiService.buildCliEnv(config.provider, config.apiKey);

        await this.runCliStreaming(config.cli, graphArgs, {
          cwd: config.workspacePath,
          timeout: 300_000,
          env: { ...process.env, ...graphEnv },
        }, job.id, emitStream);

        emitStream('\n');

        // Step 3c: Scan codebase using the freshly built graph
        currentStep = 'scanning';
        this.emitStep(userId, job, 'scanning');
        emitStream(`$ ${config.cli} (scanning codebase with code-graph)\n`);

        const featureSummary = (data.features ?? []).join(', ') || data.instructions || 'project scope';
        const scanPrompt = this.aiService.buildScanPrompt(featureSummary);
        const scanArgs = this.aiService.buildCliArgs(config.provider, config.model, scanPrompt);
        const scanEnv = this.aiService.buildCliEnv(config.provider, config.apiKey);

        const scanOutput = await this.runCliStreaming(config.cli, scanArgs, {
          cwd: config.workspacePath,
          timeout: 300_000,
          env: { ...process.env, ...scanEnv },
        }, job.id, emitStream);

        scanResults = scanOutput.trim();
        emitStream('\n');
      }

      // Step 4: Build and run generation prompt
      currentStep = 'generating';
      this.emitStep(userId, job, 'generating');
      emitStream(`$ ${config.cli} (generating WBS)\n`);

      const generationPrompt = this.aiService.buildGenerationPrompt({
        instructions: data.instructions,
        features: data.features ?? [],
        teamSize: data.teamSize,
        teamRoles: data.teamRoles,
        projectStartDate: data.projectStartDate,
        targetEndDate: data.targetEndDate,
        methodology: data.methodology,
        sprintDuration: data.sprintDuration,
        projectContext: config.projectContext,
        scanResults,
        fileContents,
      });

      const genArgs = this.aiService.buildCliArgs(config.provider, config.model, generationPrompt);
      const genEnv = this.aiService.buildCliEnv(config.provider, config.apiKey);

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
