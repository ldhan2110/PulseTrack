// apps/api/src/ai-testcase-generation/ai-testcase-generation.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { spawn } from 'child_process';
import { NotificationsService } from '../notifications/notifications.service';
import { AiTestCaseGenerationService } from './ai-testcase-generation.service';
import type { TestCaseGenerationJobData, TestCaseGenerationJobResult } from './dto/generate-testcases.dto';

@Processor('ai-testcase-generation', { concurrency: 4 })
export class AiTestCaseGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(AiTestCaseGenerationProcessor.name);

  constructor(
    private readonly aiService: AiTestCaseGenerationService,
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
    job: Job<TestCaseGenerationJobData>,
    step: string,
  ): void {
    this.notifications.notifyUser(userId, 'ai-testcase-generation:progress', {
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
      if (error.message.includes('invalid JSON') || error.message.includes('missing "testCases"')) {
        return 'AI returned an invalid response — please retry';
      }
      if (error.message.includes('AI configuration') || error.message.includes('Repository must')) {
        return error.message;
      }
      return error.message;
    }
    return 'An unexpected error occurred';
  }

  async process(job: Job<TestCaseGenerationJobData>): Promise<TestCaseGenerationJobResult> {
    const { projectId, userId, prompt, taskIds, generateSteps, scanCodebase, uploadedFilePaths } =
      job.data;

    let logBuffer = '';
    let currentStep = 'queued';
    const emitStream = (chunk: string) => {
      logBuffer += chunk;
      this.notifications.notifyUser(userId, 'ai-testcase-generation:stream', {
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

      // Step 2: Build code graph + scan (if requested)
      let scanResults: string | null = null;
      if (scanCodebase) {
        currentStep = 'building-graph';
        this.emitStep(userId, job, 'building-graph');
        emitStream(`$ ${config.cli} (building code graph)\n`);

        const graphPrompt = this.aiService.buildGraphPrompt();
        const graphArgs = this.aiService.buildCliArgs(config.provider, config.model, graphPrompt, []);
        const graphEnv = this.aiService.buildCliEnv(config.provider, config.apiKey);

        await this.runCliStreaming(config.cli, graphArgs, {
          cwd: config.workspacePath,
          timeout: 300_000,
          env: { ...process.env, ...graphEnv },
        }, job.id, emitStream);

        emitStream('\n');

        currentStep = 'scanning';
        this.emitStep(userId, job, 'scanning');
        emitStream(`$ ${config.cli} (scanning codebase with code-graph)\n`);

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

      // Step 3: Fetch task contexts and module list
      currentStep = 'generating';
      this.emitStep(userId, job, 'generating');
      emitStream(`Fetching ${taskIds.length} user story(ies)...\n`);

      const taskContexts = await this.aiService.fetchTaskContexts(taskIds);
      const moduleList = await this.aiService.fetchAvailableModules(projectId);

      emitStream(`$ ${config.cli} (generating test cases)\n`);

      let generationPrompt = this.aiService.buildGenerationPrompt({
        userPrompt: prompt,
        taskContexts,
        moduleList,
        projectContext: config.projectContext,
        scanResults,
        generateSteps,
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
        timeout: 600_000,
        env: { ...process.env, ...genEnv },
      }, job.id, emitStream);

      // Step 4: Parse output
      currentStep = 'parsing';
      this.emitStep(userId, job, 'parsing');
      emitStream('\nParsing AI output...\n');

      const result = this.aiService.parseAndValidateOutput(rawOutput);

      emitStream(`Done — generated ${result.testCases.length} test case(s).\n`);

      this.notifications.notifyUser(userId, 'ai-testcase-generation:completed', {
        jobId: job.id,
        testCaseCount: result.testCases.length,
      });

      return result;
    } catch (error) {
      const message = this.getErrorMessage(error);
      this.logger.error(`[Job ${job.id}] Failed: ${message}`, error instanceof Error ? error.stack : undefined);

      emitStream(`\nError: ${message}\n`);

      this.notifications.notifyUser(userId, 'ai-testcase-generation:failed', {
        jobId: job.id,
        error: message,
      });

      throw error;
    }
  }
}
