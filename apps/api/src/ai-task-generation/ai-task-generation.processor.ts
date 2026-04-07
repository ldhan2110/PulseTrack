// apps/api/src/ai-task-generation/ai-task-generation.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { NotificationsService } from '../notifications/notifications.service';
import { AiTaskGenerationService } from './ai-task-generation.service';
import type { GenerationJobData, GenerationJobResult } from './dto/generate-tasks.dto';

const execFileAsync = promisify(execFile);

@Processor('ai-task-generation', { concurrency: 4 })
export class AiTaskGenerationProcessor extends WorkerHost {
  constructor(
    private readonly aiService: AiTaskGenerationService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<GenerationJobData>): Promise<GenerationJobResult> {
    const { projectId, userId, prompt, scanCodebase, breakIntoSubTasks, uploadedFilePaths } =
      job.data;

    const config = await this.aiService.getProjectAiConfig(projectId);

    // Step 1: git pull
    this.notifications.notifyUser(userId, 'ai-generation:progress', {
      jobId: job.id,
      step: 'pulling',
    });

    await execFileAsync('git', ['pull'], {
      cwd: config.workspacePath,
      timeout: 60_000,
    });

    // Step 2: Codebase scan (if requested)
    let scanResults: string | null = null;
    if (scanCodebase) {
      this.notifications.notifyUser(userId, 'ai-generation:progress', {
        jobId: job.id,
        step: 'scanning',
      });

      const scanPrompt = this.aiService.buildScanPrompt(prompt);
      const scanArgs = this.aiService.buildCliArgs(config.provider, config.model, scanPrompt, []);
      const scanEnv = this.aiService.buildCliEnv(config.provider, config.apiKey);

      const { stdout: scanOutput } = await execFileAsync(config.cli, scanArgs, {
        cwd: config.workspacePath,
        timeout: 120_000,
        maxBuffer: 5 * 1024 * 1024,
        env: { ...process.env, ...scanEnv },
      });

      scanResults = scanOutput.trim();
    }

    // Step 3: Build and run generation prompt
    this.notifications.notifyUser(userId, 'ai-generation:progress', {
      jobId: job.id,
      step: 'generating',
    });

    let generationPrompt = this.aiService.buildGenerationPrompt({
      userPrompt: prompt,
      projectContext: config.projectContext,
      scanResults,
      breakIntoSubTasks,
    });

    // Augment prompt with uploaded file references/contents
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

    const { stdout: rawOutput } = await execFileAsync(config.cli, genArgs, {
      cwd: config.workspacePath,
      timeout: 180_000, // 3 minutes for generation
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, ...genEnv },
    });

    // Step 4: Parse output
    this.notifications.notifyUser(userId, 'ai-generation:progress', {
      jobId: job.id,
      step: 'parsing',
    });

    const result = this.aiService.parseAndValidateOutput(rawOutput);

    // Notify completion
    this.notifications.notifyUser(userId, 'ai-generation:completed', {
      jobId: job.id,
      taskCount: result.tasks.length,
    });

    return result;
  }
}
