// apps/api/src/ai-task-generation/ai-task-generation.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationsService } from '../notifications/notifications.service';
import { AiTaskGenerationService } from './ai-task-generation.service';
import { AgentRunner } from '../ai/agent-runner.service';
import { AiConfigLoader } from '../ai/ai-config-loader.service';
import { createAiClient } from '../ai/ai-client.factory';
import { OutputParser } from '../ai/output-parser.service';
import { PromptAssembler } from '../ai/prompt-assembler.service';
import { SkillRegistry } from '../ai/skill-registry.service';
import type { GenerationJobData, GenerationJobResult } from './dto/generate-tasks.dto';

@Processor('ai-task-generation', { concurrency: 4 })
export class AiTaskGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(AiTaskGenerationProcessor.name);
  private readonly outputParser = new OutputParser();
  private readonly promptAssembler = new PromptAssembler();

  constructor(
    private readonly aiService: AiTaskGenerationService,
    private readonly notifications: NotificationsService,
    private readonly agentRunner: AgentRunner,
    private readonly aiConfigLoader: AiConfigLoader,
    private readonly skillRegistry: SkillRegistry,
  ) {
    super();
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
      if (error.message.includes('timed out') || error.message.includes('TIMEOUT')) {
        return 'AI generation timed out — try a simpler prompt or disable codebase scan';
      }
      if (error.message.includes('invalid JSON') || error.message.includes('missing "tasks"') || error.message.includes('No JSON')) {
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
      const config = await this.aiConfigLoader.load(projectId);
      const client = createAiClient(config.provider, config.apiKey, config.baseUrl);

      // Step 1: git pull
      currentStep = 'pulling';
      this.emitStep(userId, job, 'pulling');
      emitStream('$ git pull\n');

      const { execSync } = await import('child_process');
      try {
        const pullOutput = execSync('git pull', {
          cwd: config.workspacePath,
          encoding: 'utf-8',
          timeout: 60_000,
        });
        emitStream(pullOutput || 'Already up to date.\n');
      } catch {
        emitStream('Already up to date.\n');
      }
      emitStream('\n');

      // Step 2: Build code graph + scan (if requested)
      let scanResults: string | null = null;
      if (scanCodebase) {
        // Step 2a: Build code graph
        currentStep = 'building-graph';
        this.emitStep(userId, job, 'building-graph');
        emitStream('Building code graph...\n');

        const graphResult = await this.agentRunner.run({
          client,
          model: config.model,
          system: 'You are a code analysis assistant.',
          prompt: this.aiService.buildGraphPrompt(),
          maxTurns: 1,
          onTextChunk: emitStream,
        });
        emitStream('\n');

        // Step 2b: Scan codebase
        currentStep = 'scanning';
        this.emitStep(userId, job, 'scanning');
        emitStream('Scanning codebase...\n');

        const scanResult = await this.agentRunner.run({
          client,
          model: config.model,
          system: 'You are a code analysis assistant.',
          prompt: this.aiService.buildScanPrompt(prompt),
          maxTurns: 1,
          onTextChunk: emitStream,
        });

        scanResults = scanResult.text.trim();
        emitStream('\n');
      }

      // Step 3: Generate tasks
      currentStep = 'generating';
      this.emitStep(userId, job, 'generating');
      emitStream('Generating tasks...\n');

      // Load skill and build system prompt
      const skillContent = await this.skillRegistry.load('task-generation');
      const systemPrompt = this.promptAssembler.assemble([
        { key: 'skill', content: skillContent },
        { key: 'context', content: config.projectContext },
        ...(scanResults ? [{ key: 'scan', content: `## Codebase Scan Results\n${scanResults}` }] : []),
      ]);

      // Build user prompt with sub-task instruction and file contents
      let userPrompt = prompt;
      if (breakIntoSubTasks) {
        userPrompt += '\n\nInclude sub-tasks: break each parent task into 2-5 focused sub-tasks in the "subTasks" array.';
      } else {
        userPrompt += '\n\nDo NOT include "subTasks" in the output. Generate only top-level tasks.';
      }

      userPrompt = await this.aiService.augmentPromptWithFiles(
        userPrompt,
        uploadedFilePaths,
        config.provider,
      );

      const result = await this.agentRunner.run({
        client,
        model: config.model,
        system: systemPrompt,
        prompt: userPrompt,
        maxTurns: 1,
        onTextChunk: emitStream,
      });

      // Step 4: Parse output
      currentStep = 'parsing';
      this.emitStep(userId, job, 'parsing');
      emitStream('\nParsing AI output...\n');

      const parsed = this.outputParser.extractJSON<GenerationJobResult>(result.text);
      this.aiService.validateOutput(parsed);

      emitStream(`Done — generated ${parsed.tasks.length} task(s).\n`);

      this.notifications.notifyUser(userId, 'ai-generation:completed', {
        jobId: job.id,
        taskCount: parsed.tasks.length,
      });

      return parsed;
    } catch (error) {
      const message = this.getErrorMessage(error);
      this.logger.error(
        `[Job ${job.id}] Failed: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      emitStream(`\nError: ${message}\n`);

      this.notifications.notifyUser(userId, 'ai-generation:failed', {
        jobId: job.id,
        error: message,
      });

      throw error;
    }
  }
}
