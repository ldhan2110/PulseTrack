# AI Test Case Generation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI-powered test case generation to TestCasesPage where users select user stories, configure options, and review/approve generated test cases.

**Architecture:** Clone the `ai-task-generation` pipeline as an independent `ai-testcase-generation` module. Backend: NestJS controller + BullMQ processor + service. Frontend: GenerateTestCasesModal + TestCaseGenerationWizard + useAiTestCaseGeneration hook. Reuses existing AI config, notifications, and CLI infrastructure.

**Tech Stack:** NestJS, BullMQ, Prisma, React, TanStack React Query, Socket.IO, shadcn/ui

---

### Task 1: Backend DTO — `generate-testcases.dto.ts`

**Files:**
- Create: `apps/api/src/ai-testcase-generation/dto/generate-testcases.dto.ts`

- [ ] **Step 1: Create the DTO file with request validation and output interfaces**

```typescript
// apps/api/src/ai-testcase-generation/dto/generate-testcases.dto.ts
import { IsString, IsOptional, IsBoolean, IsArray, MinLength, MaxLength, ArrayMinSize } from 'class-validator';
import { Transform } from 'class-transformer';

export class GenerateTestCasesDto {
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  prompt: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return [value]; }
    }
    return value;
  })
  taskIds: string[];

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  generateSteps?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  scanCodebase?: boolean;
}

export interface GeneratedTestCaseStep {
  position: number;
  action: string;
  expectedResult: string;
}

export interface GeneratedTestCase {
  title: string;
  preconditions: string | null;
  expectedResult: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'BLOCKER';
  estimatedMinutes: number | null;
  tags: string[];
  suggestedModule: string;
  sourceTaskTitle: string;
  steps?: GeneratedTestCaseStep[];
}

export interface TestCaseGenerationJobData {
  projectId: string;
  userId: string;
  prompt: string;
  taskIds: string[];
  generateSteps: boolean;
  scanCodebase: boolean;
  uploadedFilePaths: string[];
}

export interface TestCaseGenerationJobResult {
  testCases: GeneratedTestCase[];
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/ai-testcase-generation/dto/generate-testcases.dto.ts
git commit -m "feat(ai-testcase): add DTOs for test case generation"
```

---

### Task 2: Backend Service — `ai-testcase-generation.service.ts`

**Files:**
- Create: `apps/api/src/ai-testcase-generation/ai-testcase-generation.service.ts`

**Reference:** `apps/api/src/ai-task-generation/ai-task-generation.service.ts` for CLI builder patterns.

- [ ] **Step 1: Create the service with system prompt, prompt builder, and output parser**

```typescript
// apps/api/src/ai-testcase-generation/ai-testcase-generation.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../common/encryption.util';
import type { GeneratedTestCase, TestCaseGenerationJobResult } from './dto/generate-testcases.dto';

const CLI_COMMANDS: Record<string, string> = {
  claude: 'claude',
  gemini: 'gemini',
  codex: 'codex',
};

const SYSTEM_PROMPT = `You are a QA Engineer assistant for a project management tool.
Generate test cases as structured JSON based on the provided user stories and instructions.

## CRITICAL: Output Completeness
You MUST return a complete, valid JSON response. Do not stop mid-output.
If the request is large, generate fewer but complete test cases rather than many incomplete ones.

## Test Case Design Principles
- Generate positive, negative, and edge-case test scenarios per user story
- Use acceptance criteria as the primary source for test coverage
- Keep test cases atomic — one scenario per test case
- Follow Given/When/Then thinking for step generation
- Include boundary value testing where applicable
- Cover error states and validation scenarios

## Title Format
Generate clean, descriptive test case titles. Do NOT include IDs or prefixes.
Example good title: "Valid email and password login succeeds"
Example bad title: "TC-001: Valid email and password login succeeds"

## Priority
CRITICAL — data loss or security risk if this fails
HIGH — core feature broken if this fails
MEDIUM — important but non-blocking
LOW — nice-to-have, cosmetic, minor UX

## Output Format
Return ONLY valid JSON matching this schema:
{
  "testCases": [
    {
      "title": "string (max 200 chars, descriptive test scenario name)",
      "preconditions": "string or null (setup required before test)",
      "expectedResult": "string (overall expected outcome of the test)",
      "priority": "CRITICAL | HIGH | MEDIUM | LOW",
      "estimatedMinutes": "number or null (estimated execution time in minutes)",
      "tags": ["string (relevant tags like 'regression', 'smoke', 'security')"],
      "suggestedModule": "string (best-fitting module name from the available modules list)",
      "sourceTaskTitle": "string (the user story title this test case was derived from)",
      "steps": [
        {
          "position": 1,
          "action": "string (what the tester does)",
          "expectedResult": "string (what should happen)"
        }
      ]
    }
  ]
}`;

const STEPS_ADDENDUM = `
Include detailed test steps for each test case. Each step should have:
- A clear action describing what the tester does
- An expected result describing what should happen after the action
Order steps logically. Typically 3-8 steps per test case.`;

const NO_STEPS_ADDENDUM = `
Do NOT include "steps" in the output. Generate only the test case metadata (title, preconditions, expectedResult, priority, tags, etc.) without step-by-step instructions.`;

const BUILD_GRAPH_PROMPT = `Build or update the knowledge graph for this repository using the code-review-graph skills installed.
Do not do anything else. Just build the graph and report the result.`;

const CODE_GRAPH_SCAN_PROMPT = `You have access to the code-review-graph MCP server with a freshly built knowledge graph for this repository.

Analyze the codebase for areas related to:
"{USER_PROMPT}"

Use these tools in order:
1. semantic_search_nodes_tool — find relevant functions, classes, and types by keyword
2. query_graph_tool with patterns callers_of, callees_of, imports_of — trace relationships between found nodes
3. get_architecture_overview_tool — get high-level module structure
4. list_communities_tool — identify which modules/domains are involved

Return a structured summary with these sections:
- Relevant Files: file paths and their purpose
- Key Functions/Classes: names, signatures, what they do
- Architecture: how the affected area is structured
- Patterns: existing conventions new code should follow
- Dependencies: what the affected code depends on or what depends on it

Keep the summary concise and focused on what is relevant to the request.`;

@Injectable()
export class AiTestCaseGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getProjectAiConfig(projectId: string) {
    const aiConfig = await this.prisma.aiConfig.findUnique({ where: { projectId } });
    if (!aiConfig) throw new BadRequestException('AI configuration not found. Save AI settings first.');

    const repoConfig = await this.prisma.repositoryConfig.findUnique({ where: { projectId } });
    if (!repoConfig || repoConfig.cloneStatus !== 'cloned') {
      throw new BadRequestException('Repository must be cloned before generating test cases.');
    }

    const encryptionKey = this.config.getOrThrow<string>('ENCRYPTION_KEY');
    const apiKey = decrypt(aiConfig.apiKey, encryptionKey);

    return {
      provider: aiConfig.provider,
      model: aiConfig.model,
      apiKey,
      projectContext: aiConfig.projectContext,
      workspacePath: repoConfig.workspacePath!,
      cli: CLI_COMMANDS[aiConfig.provider] ?? aiConfig.provider,
    };
  }

  async fetchTaskContexts(taskIds: string[]): Promise<string> {
    const tasks = await this.prisma.task.findMany({
      where: { id: { in: taskIds } },
      select: {
        title: true,
        description: true,
        acceptanceCriteria: true,
        priority: true,
      },
    });

    if (tasks.length === 0) {
      throw new BadRequestException('No tasks found for the provided IDs.');
    }

    return tasks.map((t, i) => {
      const parts = [`### User Story ${i + 1}: ${t.title}`];
      if (t.description) parts.push(`**Description:**\n${t.description}`);
      if (t.acceptanceCriteria) {
        try {
          const criteria = JSON.parse(t.acceptanceCriteria) as { text: string }[];
          const list = criteria.map((c) => `- ${c.text}`).join('\n');
          parts.push(`**Acceptance Criteria:**\n${list}`);
        } catch {
          parts.push(`**Acceptance Criteria:**\n${t.acceptanceCriteria}`);
        }
      }
      if (t.priority) parts.push(`**Priority:** ${t.priority}`);
      return parts.join('\n');
    }).join('\n\n---\n\n');
  }

  async fetchAvailableModules(projectId: string): Promise<string> {
    const modules = await this.prisma.testModule.findMany({
      where: { projectId },
      select: { name: true },
      orderBy: { name: 'asc' },
    });
    if (modules.length === 0) return 'No modules defined yet. Use "General" as suggestedModule.';
    return `Available modules: ${modules.map((m) => m.name).join(', ')}`;
  }

  buildGraphPrompt(): string {
    return BUILD_GRAPH_PROMPT;
  }

  buildScanPrompt(userPrompt: string): string {
    return CODE_GRAPH_SCAN_PROMPT.replace('{USER_PROMPT}', userPrompt);
  }

  buildGenerationPrompt(opts: {
    userPrompt: string;
    taskContexts: string;
    moduleList: string;
    projectContext: string | null;
    scanResults: string | null;
    generateSteps: boolean;
  }): string {
    const parts: string[] = [SYSTEM_PROMPT];

    if (opts.generateSteps) {
      parts.push(STEPS_ADDENDUM);
    } else {
      parts.push(NO_STEPS_ADDENDUM);
    }

    parts.push(`\n## Available Test Modules\n${opts.moduleList}`);
    parts.push(`\n## User Stories to Generate Test Cases For\n${opts.taskContexts}`);

    if (opts.projectContext) {
      parts.push(`\n## Project Context\n${opts.projectContext}`);
    }

    if (opts.scanResults) {
      parts.push(`\n## Codebase Scan Results\n${opts.scanResults}`);
    }

    parts.push(`\n## Additional Instructions\n${opts.userPrompt}`);

    return parts.join('\n');
  }

  buildCliArgs(provider: string, model: string, prompt: string, filePaths: string[]): string[] {
    const baseArgs: string[] = [];
    switch (provider) {
      case 'claude':
        baseArgs.push('--dangerously-skip-permissions', '-p', prompt, '--output-format', 'text', '--model', model);
        break;
      case 'gemini':
        baseArgs.push('-p', prompt, '--model', model);
        break;
      case 'codex':
        baseArgs.push('-p', prompt, '--model', model);
        break;
      default:
        baseArgs.push('-p', prompt);
    }
    return baseArgs;
  }

  buildCliEnv(provider: string, apiKey: string): Record<string, string> {
    switch (provider) {
      case 'claude':
        return { CLAUDE_CODE_OAUTH_TOKEN: apiKey };
      case 'gemini':
        return { GEMINI_API_KEY: apiKey };
      case 'codex':
        return { OPENAI_API_KEY: apiKey };
      default:
        return {};
    }
  }

  parseAndValidateOutput(raw: string): TestCaseGenerationJobResult {
    let jsonStr = raw.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new Error('AI returned invalid JSON. Raw output: ' + raw.slice(0, 500));
    }

    const result = parsed as TestCaseGenerationJobResult;
    if (!result.testCases || !Array.isArray(result.testCases)) {
      throw new Error('AI output missing "testCases" array');
    }

    for (const tc of result.testCases) {
      this.validateTestCase(tc);
    }

    return result;
  }

  private validateTestCase(tc: GeneratedTestCase): void {
    if (!tc.title || typeof tc.title !== 'string') {
      throw new Error('Test case missing title');
    }
    if (tc.title.length > 200) {
      tc.title = tc.title.slice(0, 200);
    }
    if (!tc.expectedResult || typeof tc.expectedResult !== 'string') {
      tc.expectedResult = '';
    }
    const validPriorities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'BLOCKER'];
    if (!validPriorities.includes(tc.priority)) {
      tc.priority = 'MEDIUM';
    }
    if (tc.estimatedMinutes !== null && tc.estimatedMinutes !== undefined) {
      tc.estimatedMinutes = Math.max(1, Math.round(tc.estimatedMinutes));
    }
    if (!Array.isArray(tc.tags)) {
      tc.tags = [];
    }
    tc.tags = tc.tags.filter((t: unknown) => typeof t === 'string' && (t as string).trim().length > 0);
    if (!tc.suggestedModule || typeof tc.suggestedModule !== 'string') {
      tc.suggestedModule = 'General';
    }
    if (!tc.sourceTaskTitle || typeof tc.sourceTaskTitle !== 'string') {
      tc.sourceTaskTitle = 'Unknown';
    }
    if (tc.steps) {
      tc.steps = tc.steps.filter(
        (s) => s && typeof s.action === 'string' && typeof s.expectedResult === 'string',
      );
      tc.steps.forEach((s, i) => { s.position = i + 1; });
    }
  }

  async augmentPromptWithFiles(
    prompt: string,
    filePaths: string[],
    provider: string,
  ): Promise<string> {
    if (filePaths.length === 0) return prompt;

    if (provider === 'claude') {
      const fileSection = filePaths.map((p) => `- ${p}`).join('\n');
      return `${prompt}\n\n## Uploaded Reference Documents (read these files)\n${fileSection}`;
    }

    const { readFile } = await import('fs/promises');
    const contents: string[] = [];
    for (const fp of filePaths) {
      try {
        const content = await readFile(fp, 'utf-8');
        contents.push(`### File: ${fp}\n${content}`);
      } catch {
        contents.push(`### File: ${fp}\n[Binary file — cannot extract text]`);
      }
    }
    return `${prompt}\n\n## Uploaded Reference Documents\n${contents.join('\n\n')}`;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/ai-testcase-generation/ai-testcase-generation.service.ts
git commit -m "feat(ai-testcase): add service with prompt building and output parsing"
```

---

### Task 3: Backend Processor — `ai-testcase-generation.processor.ts`

**Files:**
- Create: `apps/api/src/ai-testcase-generation/ai-testcase-generation.processor.ts`

**Reference:** `apps/api/src/ai-task-generation/ai-task-generation.processor.ts` for the BullMQ worker pattern.

- [ ] **Step 1: Create the processor with 5-step pipeline**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/ai-testcase-generation/ai-testcase-generation.processor.ts
git commit -m "feat(ai-testcase): add BullMQ processor with 5-step pipeline"
```

---

### Task 4: Backend Controller — `ai-testcase-generation.controller.ts`

**Files:**
- Create: `apps/api/src/ai-testcase-generation/ai-testcase-generation.controller.ts`

- [ ] **Step 1: Create the controller with POST and GET endpoints**

```typescript
// apps/api/src/ai-testcase-generation/ai-testcase-generation.controller.ts
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { GenerateTestCasesDto } from './dto/generate-testcases.dto';
import type { TestCaseGenerationJobData } from './dto/generate-testcases.dto';

@Controller('projects/:projectId/ai/generate-testcases')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class AiTestCaseGenerationController {
  constructor(
    @InjectQueue('ai-testcase-generation') private readonly queue: Queue,
  ) {}

  @Post()
  @RequirePermission('testCases', 'create')
  @UseInterceptors(
    FilesInterceptor('documents', 5, {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const jobId = randomUUID();
          (_req as any).__generationJobId = (_req as any).__generationJobId || jobId;
          const dir = join(process.cwd(), 'uploads', 'ai-testcase-generation', (_req as any).__generationJobId);
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['.pdf', '.docx', '.txt', '.md', '.png', '.jpg', '.jpeg'];
        const ext = extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
          cb(null, true);
        } else {
          cb(new BadRequestException(`File type ${ext} not supported`), false);
        }
      },
    }),
  )
  async generate(
    @Param('projectId') projectId: string,
    @Body() dto: GenerateTestCasesDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    const uploadedFilePaths = (files ?? []).map((f) => f.path);
    const jobId = (req as any).__generationJobId || randomUUID();

    const jobData: TestCaseGenerationJobData = {
      projectId,
      userId: req.user.id,
      prompt: dto.prompt,
      taskIds: dto.taskIds,
      generateSteps: dto.generateSteps ?? true,
      scanCodebase: dto.scanCodebase ?? false,
      uploadedFilePaths,
    };

    const job = await this.queue.add('generate', jobData, {
      jobId,
      removeOnComplete: { age: 86400 },
      removeOnFail: { age: 86400 },
    });

    return { jobId: job.id };
  }

  @Get(':jobId')
  async getJobResult(
    @Param('jobId') jobId: string,
  ) {
    const job = await this.queue.getJob(jobId);
    if (!job) throw new NotFoundException('Generation job not found');

    const state = await job.getState();

    if (state === 'completed') {
      return { status: 'completed', testCases: job.returnvalue?.testCases ?? [] };
    }
    if (state === 'failed') {
      return { status: 'failed', error: job.failedReason ?? 'Unknown error' };
    }

    const progress = job.progress as { step?: string; streamText?: string } | undefined;
    return {
      status: state,
      step: progress?.step ?? 'queued',
      ...(progress?.streamText ? { streamText: progress.streamText } : {}),
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/ai-testcase-generation/ai-testcase-generation.controller.ts
git commit -m "feat(ai-testcase): add controller with POST/GET endpoints"
```

---

### Task 5: Backend Module + Register in AppModule

**Files:**
- Create: `apps/api/src/ai-testcase-generation/ai-testcase-generation.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create the module file**

```typescript
// apps/api/src/ai-testcase-generation/ai-testcase-generation.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiTestCaseGenerationController } from './ai-testcase-generation.controller';
import { AiTestCaseGenerationService } from './ai-testcase-generation.service';
import { AiTestCaseGenerationProcessor } from './ai-testcase-generation.processor';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    NotificationsModule,
    BullModule.registerQueue({ name: 'ai-testcase-generation' }),
  ],
  controllers: [AiTestCaseGenerationController],
  providers: [AiTestCaseGenerationService, AiTestCaseGenerationProcessor],
})
export class AiTestCaseGenerationModule {}
```

- [ ] **Step 2: Register in app.module.ts**

Add import at the top of `apps/api/src/app.module.ts` (after the AiTaskGenerationModule import on line 22):

```typescript
import { AiTestCaseGenerationModule } from './ai-testcase-generation/ai-testcase-generation.module';
```

Add to the `imports` array (after `AiTaskGenerationModule` on line 56):

```typescript
    AiTestCaseGenerationModule,
```

- [ ] **Step 3: Verify the backend compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/ai-testcase-generation/ai-testcase-generation.module.ts apps/api/src/app.module.ts
git commit -m "feat(ai-testcase): add module and register in AppModule"
```

---

### Task 6: Frontend Types — Add AI Test Case Generation Types

**Files:**
- Modify: `apps/web/src/lib/types.ts`

- [ ] **Step 1: Add types after the existing `AiGenerationStreamEvent` interface (after line 568)**

```typescript
// ─── AI Test Case Generation ────────────────────────────────────────────────

export interface GeneratedTestCaseStep {
  position: number;
  action: string;
  expectedResult: string;
}

export interface GeneratedTestCase {
  title: string;
  preconditions: string | null;
  expectedResult: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'BLOCKER';
  estimatedMinutes: number | null;
  tags: string[];
  suggestedModule: string;
  sourceTaskTitle: string;
  steps?: GeneratedTestCaseStep[];
}

export interface AiTestCaseGenerationJobResult {
  status: AiGenerationStatus;
  step?: AiGenerationStep;
  testCases?: GeneratedTestCase[];
  error?: string;
  streamText?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/types.ts
git commit -m "feat(ai-testcase): add frontend types for test case generation"
```

---

### Task 7: Frontend API — Add Test Case Generation Endpoints

**Files:**
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Add API methods after the existing `getGenerationJobResult` on line 307**

Add these two methods:

```typescript
  // ─── AI Test Case Generation ──────────────────────────────────────────────
  generateTestCases: async (projectId: string, data: FormData): Promise<{ jobId: string }> => {
    const token = keycloak.token;
    const res = await fetch(`${API_BASE}/projects/${projectId}/ai/generate-testcases`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: data,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { message?: string }).message || `Generation failed: ${res.status}`);
    }
    return res.json() as Promise<{ jobId: string }>;
  },
  getTestCaseGenerationJobResult: (projectId: string, jobId: string) =>
    request<AiTestCaseGenerationJobResult>(`/projects/${projectId}/ai/generate-testcases/${jobId}`),
```

Also add the import at the top of the file — find the line that imports `AiGenerationJobResult` from `'./types'` and add `AiTestCaseGenerationJobResult` to it.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(ai-testcase): add API client methods for test case generation"
```

---

### Task 8: Frontend Hook — `useAiTestCaseGeneration.ts`

**Files:**
- Create: `apps/web/src/hooks/useAiTestCaseGeneration.ts`

**Reference:** `apps/web/src/hooks/useAiTaskGeneration.ts`

- [ ] **Step 1: Create the hook**

```typescript
// apps/web/src/hooks/useAiTestCaseGeneration.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useSocket } from '../socket/useSocket';
import type { AiGenerationStep } from '../lib/types';

export function useAiTestCaseGeneration(projectId: string) {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [step, setStep] = useState<AiGenerationStep | 'idle' | 'queued' | 'completed' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [displayLines, setDisplayLines] = useState<string[]>([]);
  const [rawText, setRawText] = useState<string>('');
  const isActive = !!jobId && step !== 'idle' && step !== 'completed' && step !== 'failed';
  const lastFormDataRef = useRef<FormData | null>(null);

  const generate = useMutation({
    mutationFn: (formData: FormData) => {
      lastFormDataRef.current = formData;
      return api.generateTestCases(projectId, formData);
    },
    onSuccess: (data) => {
      setJobId(data.jobId);
      setStep('queued');
      setErrorMessage(null);
      toast.info('AI test case generation started');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to start generation');
    },
  });

  const jobResult = useQuery({
    queryKey: ['ai-testcase-generation', projectId, jobId],
    queryFn: () => api.getTestCaseGenerationJobResult(projectId, jobId!),
    enabled: !!jobId && step === 'completed',
  });

  const jobStatus = useQuery({
    queryKey: ['ai-testcase-generation-status', projectId, jobId],
    queryFn: () => api.getTestCaseGenerationJobResult(projectId, jobId!),
    enabled: isActive,
    refetchInterval: 5_000,
  });

  useEffect(() => {
    if (!jobStatus.data) return;
    const data = jobStatus.data;
    if (data.status === 'completed') {
      setStep('completed');
    } else if (data.status === 'failed') {
      setStep('failed');
      setErrorMessage(data.error ?? 'Unknown error');
    } else {
      if (data.step) setStep(data.step);
      if (!data.streamText) return;
      setRawText(data.streamText);
    }
  }, [jobStatus.data]);

  useEffect(() => {
    if (!socket || !jobId) return;

    const onProgress = (data: { jobId: string; step: AiGenerationStep }) => {
      if (data.jobId === jobId) {
        setStep(data.step);
      }
    };

    const onCompleted = (data: { jobId: string; testCaseCount: number }) => {
      if (data.jobId === jobId) {
        setStep('completed');
        toast.success(`Generated ${data.testCaseCount} test cases`);
      }
    };

    const onFailed = (data: { jobId: string; error: string }) => {
      if (data.jobId === jobId) {
        setStep('failed');
        setErrorMessage(data.error);
        toast.error(`Generation failed: ${data.error}`);
      }
    };

    const onStream = (data: { jobId: string; text?: string }) => {
      if (data.jobId === jobId) {
        if (data.text) setRawText(data.text);
      }
    };

    socket.on('ai-testcase-generation:progress', onProgress);
    socket.on('ai-testcase-generation:completed', onCompleted);
    socket.on('ai-testcase-generation:failed', onFailed);
    socket.on('ai-testcase-generation:stream', onStream);

    return () => {
      socket.off('ai-testcase-generation:progress', onProgress);
      socket.off('ai-testcase-generation:completed', onCompleted);
      socket.off('ai-testcase-generation:failed', onFailed);
      socket.off('ai-testcase-generation:stream', onStream);
    };
  }, [socket, jobId]);

  const reset = useCallback(() => {
    setJobId(null);
    setStep('idle');
    setErrorMessage(null);
    setDisplayLines([]);
    setRawText('');
    void queryClient.removeQueries({ queryKey: ['ai-testcase-generation', projectId] });
    void queryClient.removeQueries({ queryKey: ['ai-testcase-generation-status', projectId] });
  }, [projectId, queryClient]);

  const cancel = useCallback(() => {
    reset();
  }, [reset]);

  const retry = useCallback(() => {
    reset();
  }, [reset]);

  return {
    generate,
    jobId,
    step,
    displayLines,
    rawText,
    testCases: jobResult.data?.testCases ?? [],
    isLoading: generate.isPending || isActive,
    isCompleted: step === 'completed',
    isFailed: step === 'failed',
    error: errorMessage ?? jobResult.data?.error ?? null,
    reset,
    cancel,
    retry,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/useAiTestCaseGeneration.ts
git commit -m "feat(ai-testcase): add useAiTestCaseGeneration hook"
```

---

### Task 9: Frontend — `GenerateTestCasesModal.tsx`

**Files:**
- Create: `apps/web/src/components/test-cases/GenerateTestCasesModal.tsx`

**Reference:** `apps/web/src/components/tasks/GenerateTasksModal.tsx` for modal pattern.

- [ ] **Step 1: Create the modal component with form + progress terminal**

```tsx
// apps/web/src/components/test-cases/GenerateTestCasesModal.tsx
import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sparkles,
  Upload,
  X,
  AlertTriangle,
  RefreshCw,
  Search,
  Check,
} from 'lucide-react';
import type { Task, AiGenerationStep } from '@/lib/types';

const STEP_PROGRESS: Record<string, number> = {
  queued: 10,
  pulling: 20,
  'building-graph': 35,
  scanning: 50,
  generating: 72,
  parsing: 90,
};

const STEP_LABELS: Record<string, string> = {
  queued: 'Queued…',
  pulling: 'Pulling latest code…',
  'building-graph': 'Building code graph…',
  scanning: 'Scanning codebase…',
  generating: 'Generating test cases…',
  parsing: 'Parsing output…',
};

interface GenerateTestCasesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  isProcessing: boolean;
  step: AiGenerationStep | 'idle' | 'queued' | 'completed' | 'failed';
  error: string | null;
  rawText: string;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
  onRetry: () => void;
}

export function GenerateTestCasesModal({
  open,
  onOpenChange,
  tasks,
  isProcessing,
  step,
  error,
  rawText,
  onSubmit,
  onCancel,
  onRetry,
}: GenerateTestCasesModalProps) {
  const [prompt, setPrompt] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [generateSteps, setGenerateSteps] = useState(true);
  const [scanCodebase, setScanCodebase] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [taskSearch, setTaskSearch] = useState('');
  const [sprintFilter, setSprintFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const [showRaw, setShowRaw] = useState(false);

  const isIdle = step === 'idle';
  const isFailed = step === 'failed';

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [rawText]);

  // Reset form when closing
  useEffect(() => {
    if (!open) {
      setPrompt('');
      setSelectedTaskIds(new Set());
      setGenerateSteps(true);
      setScanCodebase(false);
      setFiles([]);
      setTaskSearch('');
      setSprintFilter('ALL');
      setStatusFilter('ALL');
      setShowRaw(false);
    }
  }, [open]);

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const filteredTasks = tasks.filter((t) => {
    if (taskSearch && !t.title.toLowerCase().includes(taskSearch.toLowerCase()) && !t.taskKey?.toLowerCase().includes(taskSearch.toLowerCase())) return false;
    if (sprintFilter !== 'ALL' && t.sprintId !== sprintFilter) return false;
    if (statusFilter !== 'ALL' && t.status?.name !== statusFilter) return false;
    return true;
  });

  // Collect unique sprints and statuses from tasks for filters
  const sprints = [...new Map(tasks.filter((t) => t.sprintId && t.sprint).map((t) => [t.sprintId, t.sprint!.name])).entries()];
  const statuses = [...new Set(tasks.map((t) => t.status?.name).filter(Boolean))] as string[];

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...newFiles].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (selectedTaskIds.size === 0 || prompt.length < 10) return;
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('taskIds', JSON.stringify([...selectedTaskIds]));
    formData.append('generateSteps', String(generateSteps));
    formData.append('scanCodebase', String(scanCodebase));
    for (const file of files) {
      formData.append('documents', file);
    }
    onSubmit(formData);
  };

  const canSubmit = selectedTaskIds.size > 0 && prompt.length >= 10;
  const progress = STEP_PROGRESS[step] ?? 0;

  return (
    <Dialog open={open} onOpenChange={isProcessing ? undefined : onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" />
            Generate Test Cases with AI
          </DialogTitle>
          <DialogDescription>
            Select user stories and provide instructions to generate test cases.
          </DialogDescription>
        </DialogHeader>

        {isIdle || isFailed ? (
          <>
            {isFailed && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertTriangle className="size-4 shrink-0" />
                <span className="flex-1">{error}</span>
                <Button variant="ghost" size="sm" onClick={onRetry}>
                  <RefreshCw className="size-3.5 mr-1" /> Retry
                </Button>
              </div>
            )}

            {/* Task Selection */}
            <div className="space-y-2">
              <Label>Select User Stories</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    placeholder="Filter by title or key..."
                    className="h-8 pl-7 text-sm"
                  />
                </div>
                {sprints.length > 0 && (
                  <Select value={sprintFilter} onValueChange={setSprintFilter}>
                    <SelectTrigger className="h-8 w-[140px] text-xs">
                      <SelectValue placeholder="Sprint" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Sprints</SelectItem>
                      {sprints.map(([id, name]) => (
                        <SelectItem key={id} value={id!}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {statuses.length > 0 && (
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 w-[140px] text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Statuses</SelectItem>
                      {statuses.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="border rounded-md max-h-[180px] overflow-y-auto">
                {filteredTasks.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">No tasks found</div>
                ) : (
                  filteredTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`flex items-center gap-3 px-3 py-2 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 ${
                        selectedTaskIds.has(task.id) ? 'bg-primary/5' : ''
                      }`}
                      onClick={() => toggleTask(task.id)}
                    >
                      <div className={`size-4 rounded border flex items-center justify-center ${
                        selectedTaskIds.has(task.id) ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                      }`}>
                        {selectedTaskIds.has(task.id) && <Check className="size-3 text-primary-foreground" />}
                      </div>
                      {task.taskKey && (
                        <span className="text-xs font-medium text-primary shrink-0">{task.taskKey}</span>
                      )}
                      <span className="text-sm truncate flex-1">{task.title}</span>
                      {task.priority && (
                        <Badge variant="outline" className="text-[10px] shrink-0">{task.priority}</Badge>
                      )}
                    </div>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">{selectedTaskIds.size} story(ies) selected</p>
            </div>

            {/* Prompt */}
            <div className="space-y-2">
              <Label>Additional Instructions</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Focus on edge cases for invalid inputs, include API response validation, cover both UI and API layers..."
                className="min-h-[80px] resize-y"
                maxLength={5000}
              />
              <p className="text-xs text-muted-foreground">{prompt.length} / 5000</p>
            </div>

            {/* Toggles */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="generate-steps"
                  checked={generateSteps}
                  onCheckedChange={setGenerateSteps}
                />
                <Label htmlFor="generate-steps" className="text-sm cursor-pointer">
                  Generate Detailed Steps
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="scan-codebase"
                  checked={scanCodebase}
                  onCheckedChange={setScanCodebase}
                />
                <Label htmlFor="scan-codebase" className="text-sm cursor-pointer">
                  Scan Codebase
                </Label>
              </div>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <div
                className="border-2 border-dashed rounded-md p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Drop files here or click to upload (max 5 files, 10MB each)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg"
                  onChange={handleFileAdd}
                  className="hidden"
                />
              </div>
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {files.map((file, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {file.name}
                      <X className="size-3 cursor-pointer" onClick={() => removeFile(i)} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!canSubmit}>
                <Sparkles className="size-3.5 mr-1.5" />
                Generate Test Cases
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* Processing State */
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{STEP_LABELS[step] ?? 'Processing…'}</span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>

            <div
              ref={terminalRef}
              className="bg-[#0d1117] rounded-md p-3 font-mono text-xs text-[#8b949e] max-h-[250px] overflow-y-auto whitespace-pre-wrap"
            >
              {rawText || 'Waiting for output...'}
            </div>

            <div className="flex justify-between items-center">
              <Button variant="ghost" size="sm" onClick={() => setShowRaw(!showRaw)}>
                {showRaw ? 'Formatted' : 'Raw'} output
              </Button>
              <Button variant="outline" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/test-cases/GenerateTestCasesModal.tsx
git commit -m "feat(ai-testcase): add GenerateTestCasesModal component"
```

---

### Task 10: Frontend — `TestCaseGenerationWizard.tsx`

**Files:**
- Create: `apps/web/src/components/test-cases/TestCaseGenerationWizard.tsx`

**Reference:** `apps/web/src/components/tasks/TaskGenerationWizard.tsx` for wizard pattern.

- [ ] **Step 1: Create the wizard component**

```tsx
// apps/web/src/components/test-cases/TestCaseGenerationWizard.tsx
import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, X, SkipForward, ChevronLeft, ChevronRight, Zap, Plus, Trash2 } from 'lucide-react';
import { useCreateTestCase } from '@/hooks/useTestCases';
import type { GeneratedTestCase, GeneratedTestCaseStep, TestModule } from '@/lib/types';

type WizardStatus = 'pending' | 'approved' | 'skipped';

interface WizardTestCase extends GeneratedTestCase {
  wizardStatus: WizardStatus;
  createdKey?: string;
  editTitle: string;
  editPreconditions: string;
  editExpectedResult: string;
  editPriority: string;
  editEstimatedMinutes: number | null;
  editTags: string[];
  editModuleId: string;
  editSteps: GeneratedTestCaseStep[];
}

interface TestCaseGenerationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testCases: GeneratedTestCase[];
  projectId: string;
  modules: TestModule[];
}

export function TestCaseGenerationWizard({
  open,
  onOpenChange,
  testCases,
  projectId,
  modules,
}: TestCaseGenerationWizardProps) {
  const createTestCase = useCreateTestCase(projectId);

  const [items, setItems] = useState<WizardTestCase[]>(() =>
    testCases.map((tc) => {
      const matchedModule = modules.find(
        (m) => m.name.toLowerCase() === tc.suggestedModule?.toLowerCase(),
      );
      return {
        ...tc,
        wizardStatus: 'pending',
        editTitle: tc.title,
        editPreconditions: tc.preconditions ?? '',
        editExpectedResult: tc.expectedResult,
        editPriority: tc.priority,
        editEstimatedMinutes: tc.estimatedMinutes,
        editTags: [...tc.tags],
        editModuleId: matchedModule?.id ?? modules[0]?.id ?? '',
        editSteps: tc.steps ? tc.steps.map((s) => ({ ...s })) : [],
      };
    }),
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [newTag, setNewTag] = useState('');

  const current = items[currentIndex];
  const approvedCount = items.filter((i) => i.wizardStatus === 'approved').length;
  const totalCount = items.length;

  // Group items by sourceTaskTitle for sidebar
  const grouped = useMemo(() => {
    const groups: { title: string; indices: number[] }[] = [];
    let lastTitle = '';
    items.forEach((item, i) => {
      if (item.sourceTaskTitle !== lastTitle) {
        groups.push({ title: item.sourceTaskTitle, indices: [i] });
        lastTitle = item.sourceTaskTitle;
      } else {
        groups[groups.length - 1].indices.push(i);
      }
    });
    return groups;
  }, [items]);

  const updateField = <K extends keyof WizardTestCase>(field: K, value: WizardTestCase[K]) => {
    setItems((prev) =>
      prev.map((item, i) => (i === currentIndex ? { ...item, [field]: value } : item)),
    );
  };

  const addStep = () => {
    const steps = [...(current?.editSteps ?? [])];
    steps.push({ position: steps.length + 1, action: '', expectedResult: '' });
    updateField('editSteps', steps);
  };

  const updateStep = (stepIndex: number, field: 'action' | 'expectedResult', value: string) => {
    const steps = [...(current?.editSteps ?? [])];
    steps[stepIndex] = { ...steps[stepIndex], [field]: value };
    updateField('editSteps', steps);
  };

  const removeStep = (stepIndex: number) => {
    const steps = (current?.editSteps ?? []).filter((_, i) => i !== stepIndex);
    steps.forEach((s, i) => { s.position = i + 1; });
    updateField('editSteps', steps);
  };

  const addTag = () => {
    const tag = newTag.trim();
    if (tag && !current.editTags.includes(tag)) {
      updateField('editTags', [...current.editTags, tag]);
    }
    setNewTag('');
  };

  const removeTag = (tag: string) => {
    updateField('editTags', current.editTags.filter((t) => t !== tag));
  };

  const handleApprove = async () => {
    if (!current || !current.editModuleId) return;

    try {
      const result = await createTestCase.mutateAsync({
        title: current.editTitle,
        preconditions: current.editPreconditions || undefined,
        expectedResult: current.editExpectedResult || undefined,
        priority: current.editPriority as any,
        estimatedMinutes: current.editEstimatedMinutes ?? undefined,
        tags: current.editTags,
        moduleId: current.editModuleId,
        steps: current.editSteps.length > 0
          ? current.editSteps.map((s) => ({
              position: s.position,
              action: s.action,
              expectedResult: s.expectedResult,
            }))
          : undefined,
      });

      setItems((prev) =>
        prev.map((item, i) =>
          i === currentIndex
            ? { ...item, wizardStatus: 'approved', createdKey: result.testCaseKey ?? undefined }
            : item,
        ),
      );
      goToNextPending();
    } catch {
      // Error handled by useCreateTestCase toast
    }
  };

  const handleSkip = () => {
    setItems((prev) =>
      prev.map((item, i) => (i === currentIndex ? { ...item, wizardStatus: 'skipped' } : item)),
    );
    goToNextPending();
  };

  const handleApproveAll = async () => {
    for (let i = 0; i < items.length; i++) {
      if (items[i].wizardStatus !== 'pending') continue;
      const item = items[i];
      if (!item.editModuleId) continue;

      try {
        const result = await createTestCase.mutateAsync({
          title: item.editTitle,
          preconditions: item.editPreconditions || undefined,
          expectedResult: item.editExpectedResult || undefined,
          priority: item.editPriority as any,
          estimatedMinutes: item.editEstimatedMinutes ?? undefined,
          tags: item.editTags,
          moduleId: item.editModuleId,
          steps: item.editSteps.length > 0
            ? item.editSteps.map((s) => ({
                position: s.position,
                action: s.action,
                expectedResult: s.expectedResult,
              }))
            : undefined,
        });

        setItems((prev) =>
          prev.map((itm, idx) =>
            idx === i
              ? { ...itm, wizardStatus: 'approved', createdKey: result.testCaseKey ?? undefined }
              : itm,
          ),
        );
      } catch {
        // Stop on first error
        break;
      }
    }
  };

  const goToNextPending = () => {
    const nextIdx = items.findIndex((item, i) => i > currentIndex && item.wizardStatus === 'pending');
    if (nextIdx !== -1) {
      setCurrentIndex(nextIdx);
    } else {
      // Wrap around
      const wrapIdx = items.findIndex((item) => item.wizardStatus === 'pending');
      if (wrapIdx !== -1) setCurrentIndex(wrapIdx);
    }
  };

  const allDone = items.every((i) => i.wizardStatus !== 'pending');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-4 pb-2 border-b">
          <DialogTitle className="flex items-center justify-between">
            <span>Review Generated Test Cases</span>
            <Badge variant="outline">{approvedCount} / {totalCount} approved</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-[500px] max-h-[calc(85vh-120px)]">
          {/* Left sidebar */}
          <div className="w-[250px] border-r overflow-y-auto shrink-0">
            {grouped.map((group) => (
              <div key={group.title}>
                <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-b bg-muted/30 truncate">
                  From: {group.title}
                </div>
                {group.indices.map((idx) => {
                  const item = items[idx];
                  return (
                    <div
                      key={idx}
                      className={`px-3 py-2 border-b cursor-pointer text-sm ${
                        idx === currentIndex ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted/50'
                      } ${item.wizardStatus !== 'pending' ? 'opacity-60' : ''}`}
                      onClick={() => setCurrentIndex(idx)}
                    >
                      <div className="flex items-center gap-1.5">
                        {item.wizardStatus === 'approved' && (
                          <Check className="size-3.5 text-green-500 shrink-0" />
                        )}
                        {item.wizardStatus === 'skipped' && (
                          <X className="size-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className={`truncate ${item.wizardStatus === 'skipped' ? 'line-through' : ''}`}>
                          {item.editTitle}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {item.wizardStatus === 'approved' && item.createdKey
                          ? item.createdKey
                          : item.wizardStatus === 'skipped'
                            ? 'skipped'
                            : `${item.editSteps.length} steps · ${item.editPriority}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Main content */}
          {current && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-primary uppercase tracking-wider">
                  From: {current.sourceTaskTitle} · Test Case {currentIndex + 1} of {totalCount}
                </span>
                <div className="flex gap-1.5">
                  <Badge variant="outline">{current.editPriority}</Badge>
                  {current.editEstimatedMinutes && (
                    <Badge variant="secondary">~{current.editEstimatedMinutes} min</Badge>
                  )}
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Title</Label>
                <Input
                  value={current.editTitle}
                  onChange={(e) => updateField('editTitle', e.target.value)}
                  disabled={current.wizardStatus !== 'pending'}
                />
              </div>

              {/* Module + Priority row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Module</Label>
                  <Select
                    value={current.editModuleId}
                    onValueChange={(v) => updateField('editModuleId', v)}
                    disabled={current.wizardStatus !== 'pending'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select module" />
                    </SelectTrigger>
                    <SelectContent>
                      {modules.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                          {m.name.toLowerCase() === current.suggestedModule?.toLowerCase() && ' (AI suggested)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Priority</Label>
                  <Select
                    value={current.editPriority}
                    onValueChange={(v) => updateField('editPriority', v)}
                    disabled={current.wizardStatus !== 'pending'}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Estimated time */}
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Estimated Time (minutes)</Label>
                <Input
                  type="number"
                  min={1}
                  value={current.editEstimatedMinutes ?? ''}
                  onChange={(e) => updateField('editEstimatedMinutes', e.target.value ? Number(e.target.value) : null)}
                  disabled={current.wizardStatus !== 'pending'}
                  className="w-32"
                />
              </div>

              {/* Preconditions */}
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Preconditions</Label>
                <Textarea
                  value={current.editPreconditions}
                  onChange={(e) => updateField('editPreconditions', e.target.value)}
                  disabled={current.wizardStatus !== 'pending'}
                  className="min-h-[60px] resize-y"
                />
              </div>

              {/* Expected Result */}
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Expected Result</Label>
                <Textarea
                  value={current.editExpectedResult}
                  onChange={(e) => updateField('editExpectedResult', e.target.value)}
                  disabled={current.wizardStatus !== 'pending'}
                  className="min-h-[60px] resize-y"
                />
              </div>

              {/* Tags */}
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Tags</Label>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {current.editTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      {current.wizardStatus === 'pending' && (
                        <X className="size-3 cursor-pointer" onClick={() => removeTag(tag)} />
                      )}
                    </Badge>
                  ))}
                  {current.wizardStatus === 'pending' && (
                    <div className="flex items-center gap-1">
                      <Input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                        placeholder="add tag"
                        className="h-6 w-24 text-xs"
                      />
                      <Button variant="ghost" size="icon" className="size-6" onClick={addTag}>
                        <Plus className="size-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Steps */}
              {current.editSteps.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Test Steps</Label>
                  <div className="border rounded-md overflow-hidden">
                    <div className="grid grid-cols-[36px_1fr_1fr_32px] bg-muted text-[10px] uppercase tracking-wider text-muted-foreground">
                      <div className="p-2 text-center">#</div>
                      <div className="p-2">Action</div>
                      <div className="p-2">Expected Result</div>
                      <div className="p-2"></div>
                    </div>
                    {current.editSteps.map((step, si) => (
                      <div key={si} className="grid grid-cols-[36px_1fr_1fr_32px] border-t">
                        <div className="p-2 text-center text-sm font-medium text-primary">{si + 1}</div>
                        <div className="p-1 border-l">
                          <Textarea
                            value={step.action}
                            onChange={(e) => updateStep(si, 'action', e.target.value)}
                            disabled={current.wizardStatus !== 'pending'}
                            className="border-0 shadow-none min-h-[36px] resize-none text-sm p-1"
                          />
                        </div>
                        <div className="p-1 border-l">
                          <Textarea
                            value={step.expectedResult}
                            onChange={(e) => updateStep(si, 'expectedResult', e.target.value)}
                            disabled={current.wizardStatus !== 'pending'}
                            className="border-0 shadow-none min-h-[36px] resize-none text-sm p-1"
                          />
                        </div>
                        <div className="p-2 flex items-start justify-center">
                          {current.wizardStatus === 'pending' && (
                            <Button variant="ghost" size="icon" className="size-6" onClick={() => removeStep(si)}>
                              <Trash2 className="size-3 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {current.wizardStatus === 'pending' && (
                      <div className="border-t p-2 text-center">
                        <Button variant="ghost" size="sm" onClick={addStep}>
                          <Plus className="size-3 mr-1" /> Add Step
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* No steps placeholder */}
              {current.editSteps.length === 0 && current.wizardStatus === 'pending' && (
                <div className="space-y-1">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Test Steps</Label>
                  <div className="border rounded-md p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-2">No steps generated</p>
                    <Button variant="outline" size="sm" onClick={addStep}>
                      <Plus className="size-3 mr-1" /> Add Step
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((i) => i - 1)}
            >
              <ChevronLeft className="size-3.5 mr-1" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentIndex === items.length - 1}
              onClick={() => setCurrentIndex((i) => i + 1)}
            >
              Next <ChevronRight className="size-3.5 ml-1" />
            </Button>
          </div>
          <div className="flex gap-2">
            {allDone ? (
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSkip}
                  disabled={current?.wizardStatus !== 'pending'}
                >
                  <SkipForward className="size-3.5 mr-1" /> Skip
                </Button>
                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={current?.wizardStatus !== 'pending' || !current?.editModuleId || createTestCase.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="size-3.5 mr-1" /> Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleApproveAll}
                  disabled={allDone || createTestCase.isPending}
                >
                  <Zap className="size-3.5 mr-1" /> Approve All
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/test-cases/TestCaseGenerationWizard.tsx
git commit -m "feat(ai-testcase): add TestCaseGenerationWizard component"
```

---

### Task 11: Integrate into TestCasesPage

**Files:**
- Modify: `apps/web/src/pages/TestCasesPage.tsx`

- [ ] **Step 1: Add imports at the top of TestCasesPage.tsx**

First, update line 1 from `import { useState } from 'react'` to `import { useState, useEffect } from 'react'`.

Then after the existing imports (line 22), add:

```typescript
import { Sparkles } from 'lucide-react';
import { GenerateTestCasesModal } from '@/components/test-cases/GenerateTestCasesModal';
import { TestCaseGenerationWizard } from '@/components/test-cases/TestCaseGenerationWizard';
import { useAiTestCaseGeneration } from '@/hooks/useAiTestCaseGeneration';
import { useAiConfig } from '@/hooks/useAiConfig';
import { useRepositoryConfig } from '@/hooks/useRepositoryConfig';
import type { Task } from '@/lib/types';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
```

- [ ] **Step 2: Add state and hooks inside the TestCasesPage component**

After line 38 (`const [importOpen, setImportOpen] = useState(false);`), add:

```typescript
  const [generateOpen, setGenerateOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data: aiConfig } = useAiConfig(projectId);
  const { data: repoConfig } = useRepositoryConfig(projectId);
  const canGenerate = !!aiConfig && repoConfig?.cloneStatus === 'cloned';

  const aiGeneration = useAiTestCaseGeneration(projectId);

  // Fetch project tasks for the modal task selector
  const { data: projectTasks = [] } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => api.getTasks(projectId),
    enabled: !!projectId && generateOpen,
  });

  const handleGenerateSubmit = (formData: FormData) => {
    aiGeneration.generate.mutate(formData);
  };

  // Auto-open wizard when generation completes
  useEffect(() => {
    if (aiGeneration.isCompleted && !wizardOpen && generateOpen) {
      setGenerateOpen(false);
      setWizardOpen(true);
    }
  }, [aiGeneration.isCompleted, wizardOpen, generateOpen]);

  const handleWizardClose = (open: boolean) => {
    setWizardOpen(open);
    if (!open) aiGeneration.reset();
  };

  const handleGenerateClose = (open: boolean) => {
    setGenerateOpen(open);
    if (!open && !aiGeneration.isCompleted) aiGeneration.reset();
  };
```

- [ ] **Step 3: Add the "AI Generate" button in the header**

In both the empty state header (around line 74) and the main header (around line 134), add the AI button before the "+ New Test Case" button. Replace the button groups in both locations.

For the empty state (line 73-80), replace:
```tsx
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet className="size-3.5 mr-1.5" />
              Import Excel
            </Button>
            <Button onClick={() => setCreateOpen(true)}>+ New Test Case</Button>
          </div>
```

With:
```tsx
          <div className="flex items-center gap-2">
            {canGenerate && (
              <Button variant="outline" onClick={() => setGenerateOpen(true)}>
                <Sparkles className="size-3.5 mr-1.5" />
                AI Generate
              </Button>
            )}
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet className="size-3.5 mr-1.5" />
              Import Excel
            </Button>
            <Button onClick={() => setCreateOpen(true)}>+ New Test Case</Button>
          </div>
```

Do the same replacement for the main view header (lines 134-140).

- [ ] **Step 4: Add modal and wizard components before the closing `</div>` of the page**

Add before the final `</div>` of both the empty state return and the main return:

```tsx
      <GenerateTestCasesModal
        open={generateOpen}
        onOpenChange={handleGenerateClose}
        tasks={projectTasks as Task[]}
        isProcessing={aiGeneration.isLoading}
        step={aiGeneration.step}
        error={aiGeneration.error}
        rawText={aiGeneration.rawText}
        onSubmit={handleGenerateSubmit}
        onCancel={aiGeneration.cancel}
        onRetry={aiGeneration.retry}
      />
      {wizardOpen && aiGeneration.testCases.length > 0 && (
        <TestCaseGenerationWizard
          open={wizardOpen}
          onOpenChange={handleWizardClose}
          testCases={aiGeneration.testCases}
          projectId={projectId}
          modules={modules}
        />
      )}
```

- [ ] **Step 5: Verify the frontend compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/TestCasesPage.tsx
git commit -m "feat(ai-testcase): integrate AI generation into TestCasesPage"
```

---

### Task 12: Verify End-to-End Integration

- [ ] **Step 1: Verify backend compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Verify frontend compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify no import errors by checking the full file list**

Run: `ls -la apps/api/src/ai-testcase-generation/` and `ls -la apps/web/src/components/test-cases/GenerateTestCasesModal.tsx apps/web/src/components/test-cases/TestCaseGenerationWizard.tsx apps/web/src/hooks/useAiTestCaseGeneration.ts`

Expected: All files exist

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(ai-testcase): resolve compilation issues"
```
