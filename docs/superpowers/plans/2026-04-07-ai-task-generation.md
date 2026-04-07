# AI Task Generation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow BAs to generate structured tasks (with sub-tasks) from an AI-powered modal on the backlog page, review them in a step-by-step wizard, and approve/skip each task before creation.

**Architecture:** New `AiTaskGenerationModule` in the NestJS backend with BullMQ processor (concurrency: 4) that runs AI CLI processes. Frontend adds a `GenerateTasksModal` and `TaskGenerationWizard` to the backlog page, with Socket.IO progress events and React Query for state management.

**Tech Stack:** NestJS + BullMQ + Multer (file upload) + Socket.IO (progress) on backend. React + shadcn/ui + React Query + Socket.IO client on frontend.

---

## File Structure

### Backend — New Files
| File | Responsibility |
|------|----------------|
| `apps/api/src/ai-task-generation/ai-task-generation.module.ts` | Module registration: queue, controller, service, processor |
| `apps/api/src/ai-task-generation/ai-task-generation.controller.ts` | REST endpoints: POST generate, GET job status |
| `apps/api/src/ai-task-generation/ai-task-generation.service.ts` | Prompt construction, output validation, CLI arg building |
| `apps/api/src/ai-task-generation/ai-task-generation.processor.ts` | BullMQ worker: git pull, scan, run CLI, parse output |
| `apps/api/src/ai-task-generation/dto/generate-tasks.dto.ts` | DTO validation for generation request |

### Backend — Modified Files
| File | Change |
|------|--------|
| `apps/api/src/app.module.ts` | Import `AiTaskGenerationModule` |

### Frontend — New Files
| File | Responsibility |
|------|----------------|
| `apps/web/src/hooks/useAiTaskGeneration.ts` | Mutation, Socket.IO listener, job result query |
| `apps/web/src/components/tasks/GenerateTasksModal.tsx` | Input modal: prompt, file upload, toggles, progress |
| `apps/web/src/components/tasks/TaskGenerationWizard.tsx` | Step-by-step review wizard with approve/edit/skip |

### Frontend — Modified Files
| File | Change |
|------|--------|
| `apps/web/src/lib/types.ts` | Add `GenerateTasksPayload`, `GeneratedTask`, `AiGenerationJobResult` types |
| `apps/web/src/lib/api.ts` | Add `generateTasks()` and `getGenerationJobResult()` API methods |
| `apps/web/src/pages/BacklogPage.tsx` | Add "Generate with AI" button + wire modal/wizard |

---

## Task 1: Backend DTO and Types

**Files:**
- Create: `apps/api/src/ai-task-generation/dto/generate-tasks.dto.ts`

- [ ] **Step 1: Create the DTO file**

```typescript
// apps/api/src/ai-task-generation/dto/generate-tasks.dto.ts
import { IsString, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class GenerateTasksDto {
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  prompt: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  scanCodebase?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  breakIntoSubTasks?: boolean;
}

export interface GeneratedTask {
  title: string;
  description: string;
  acceptanceCriteria: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  storyPoints: number;
  subTasks?: GeneratedTask[];
}

export interface GenerationJobData {
  projectId: string;
  userId: string;
  prompt: string;
  scanCodebase: boolean;
  breakIntoSubTasks: boolean;
  uploadedFilePaths: string[];
}

export interface GenerationJobResult {
  tasks: GeneratedTask[];
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/ai-task-generation/dto/generate-tasks.dto.ts
git commit -m "feat(ai-gen): add DTO and types for AI task generation"
```

---

## Task 2: Backend Service — Prompt Construction & Output Validation

**Files:**
- Create: `apps/api/src/ai-task-generation/ai-task-generation.service.ts`

- [ ] **Step 1: Create the service**

```typescript
// apps/api/src/ai-task-generation/ai-task-generation.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../common/encryption.util';
import type { GeneratedTask, GenerationJobResult } from './dto/generate-tasks.dto';

const CLI_COMMANDS: Record<string, string> = {
  claude: 'claude',
  gemini: 'gemini',
  codex: 'codex',
};

const SYSTEM_PROMPT = `You are a Business Analyst assistant for a project management tool.
Generate tasks as structured JSON based on the user's request.

## Task Description Format
Write each task description as a user story:
- "As a [role], I want [capability], so that [business value]"
- Follow with implementation notes: what needs to happen technically, key considerations, edge cases
- Reference relevant code areas if codebase scan results are provided

## Acceptance Criteria Format
Every task MUST include acceptance criteria:
- Use "Given / When / Then" format where applicable
- Each criterion must be specific and verifiable
- No vague statements like "works correctly"
- Cover happy path, edge cases, and error scenarios
- For sub-tasks, scope criteria to that sub-task only

## Priority Assignment
- CRITICAL: Blocks other work or is a security/data concern
- HIGH: Core functionality required for the feature
- MEDIUM: Important but not blocking
- LOW: Nice-to-have, polish, or optimization

## Story Points (Fibonacci Scale)
1, 2, 3, 5, 8, 13 — base on complexity, not time.

## Output Format
Return ONLY valid JSON matching this schema:
{
  "tasks": [
    {
      "title": "string (max 200 chars)",
      "description": "string (user story format: As a [role], I want [capability], so that [value]. Then implementation notes.)",
      "acceptanceCriteria": "string (Given/When/Then checklist, each criterion on a new line starting with '- ')",
      "priority": "CRITICAL | HIGH | MEDIUM | LOW",
      "storyPoints": "number (1 | 2 | 3 | 5 | 8 | 13)",
      "subTasks": []
    }
  ]
}`;

const SUB_TASK_ADDENDUM = `
When generating sub-tasks, include them in the "subTasks" array of their parent task.
Sub-tasks follow the same schema but WITHOUT their own subTasks array.
Break each parent task into 2-5 focused sub-tasks that together deliver the parent's scope.`;

const NO_SUB_TASK_ADDENDUM = `
Do NOT include "subTasks" in the output. Generate only top-level tasks.`;

const CODE_GRAPH_SCAN_PROMPT = `Using the code-graph skill, scan this codebase for areas related to:
"{USER_PROMPT}"

Return a structured summary of:
- Relevant files and their purpose
- Key functions/classes involved
- Current architecture in the affected area
- Any existing patterns that new code should follow

Keep the summary concise and focused on what's relevant to the request.`;

@Injectable()
export class AiTaskGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getProjectAiConfig(projectId: string) {
    const aiConfig = await this.prisma.aiConfig.findUnique({ where: { projectId } });
    if (!aiConfig) throw new BadRequestException('AI configuration not found. Save AI settings first.');

    const repoConfig = await this.prisma.repositoryConfig.findUnique({ where: { projectId } });
    if (!repoConfig || repoConfig.cloneStatus !== 'cloned') {
      throw new BadRequestException('Repository must be cloned before generating tasks.');
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

  buildScanPrompt(userPrompt: string): string {
    return CODE_GRAPH_SCAN_PROMPT.replace('{USER_PROMPT}', userPrompt);
  }

  buildGenerationPrompt(opts: {
    userPrompt: string;
    projectContext: string | null;
    scanResults: string | null;
    breakIntoSubTasks: boolean;
  }): string {
    const parts: string[] = [SYSTEM_PROMPT];

    if (opts.breakIntoSubTasks) {
      parts.push(SUB_TASK_ADDENDUM);
    } else {
      parts.push(NO_SUB_TASK_ADDENDUM);
    }

    if (opts.projectContext) {
      parts.push(`\n## Project Context\n${opts.projectContext}`);
    }

    if (opts.scanResults) {
      parts.push(`\n## Codebase Scan Results\n${opts.scanResults}`);
    }

    parts.push(`\n## User Request\n${opts.userPrompt}`);

    return parts.join('\n');
  }

  buildCliArgs(provider: string, model: string, prompt: string, filePaths: string[]): string[] {
    const baseArgs: string[] = [];

    switch (provider) {
      case 'claude':
        baseArgs.push('-p', prompt, '--output-format', 'text', '--model', model);
        // Claude Code can read files passed in the prompt by referencing paths
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

  parseAndValidateOutput(raw: string): GenerationJobResult {
    // Extract JSON from the response — AI may wrap it in markdown code blocks
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

    const result = parsed as GenerationJobResult;
    if (!result.tasks || !Array.isArray(result.tasks)) {
      throw new Error('AI output missing "tasks" array');
    }

    // Validate each task
    for (const task of result.tasks) {
      this.validateTask(task);
      if (task.subTasks) {
        for (const sub of task.subTasks) {
          this.validateTask(sub);
        }
      }
    }

    return result;
  }

  private validateTask(task: GeneratedTask): void {
    if (!task.title || typeof task.title !== 'string') {
      throw new Error('Task missing title');
    }
    if (task.title.length > 200) {
      task.title = task.title.slice(0, 200);
    }
    if (!task.description || typeof task.description !== 'string') {
      throw new Error(`Task "${task.title}" missing description`);
    }
    if (!task.acceptanceCriteria || typeof task.acceptanceCriteria !== 'string') {
      throw new Error(`Task "${task.title}" missing acceptance criteria`);
    }
    const validPriorities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    if (!validPriorities.includes(task.priority)) {
      task.priority = 'MEDIUM';
    }
    const validPoints = [1, 2, 3, 5, 8, 13];
    if (!validPoints.includes(task.storyPoints)) {
      // Find nearest valid value
      task.storyPoints = validPoints.reduce((prev, curr) =>
        Math.abs(curr - task.storyPoints) < Math.abs(prev - task.storyPoints) ? curr : prev,
      );
    }
  }

  /**
   * For non-Claude providers, read uploaded files and append their content to the prompt.
   * Claude Code can read files from the filesystem directly via path references in the prompt.
   */
  async augmentPromptWithFiles(
    prompt: string,
    filePaths: string[],
    provider: string,
  ): Promise<string> {
    if (filePaths.length === 0) return prompt;

    if (provider === 'claude') {
      // Claude can read files directly — just reference paths
      const fileSection = filePaths.map((p) => `- ${p}`).join('\n');
      return `${prompt}\n\n## Uploaded Reference Documents (read these files)\n${fileSection}`;
    }

    // For other providers, read file contents and inject into prompt
    const { readFile } = await import('fs/promises');
    const contents: string[] = [];
    for (const fp of filePaths) {
      try {
        const content = await readFile(fp, 'utf-8');
        contents.push(`### File: ${fp}\n${content}`);
      } catch {
        // Skip binary files or unreadable files
        contents.push(`### File: ${fp}\n[Binary file — cannot extract text]`);
      }
    }
    return `${prompt}\n\n## Uploaded Reference Documents\n${contents.join('\n\n')}`;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/ai-task-generation/ai-task-generation.service.ts
git commit -m "feat(ai-gen): add service with prompt construction and output validation"
```

---

## Task 3: Backend Processor — BullMQ Worker

**Files:**
- Create: `apps/api/src/ai-task-generation/ai-task-generation.processor.ts`

- [ ] **Step 1: Create the processor**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/ai-task-generation/ai-task-generation.processor.ts
git commit -m "feat(ai-gen): add BullMQ processor with concurrency:4"
```

---

## Task 4: Backend Controller — REST Endpoints

**Files:**
- Create: `apps/api/src/ai-task-generation/ai-task-generation.controller.ts`

- [ ] **Step 1: Create the controller**

```typescript
// apps/api/src/ai-task-generation/ai-task-generation.controller.ts
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
import { ProjectRoles } from '../auth/project-roles.decorator';
import { GenerateTasksDto } from './dto/generate-tasks.dto';
import type { GenerationJobData } from './dto/generate-tasks.dto';

@Controller('projects/:projectId/ai/generate-tasks')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class AiTaskGenerationController {
  constructor(
    @InjectQueue('ai-task-generation') private readonly queue: Queue,
  ) {}

  @Post()
  @ProjectRoles('pm', 'ba')
  @UseInterceptors(
    FilesInterceptor('documents', 5, {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const jobId = randomUUID();
          // Store jobId on request for later use
          (_req as any).__generationJobId = (_req as any).__generationJobId || jobId;
          const dir = join(process.cwd(), 'uploads', 'ai-generation', (_req as any).__generationJobId);
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
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
    @Body() dto: GenerateTasksDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    const uploadedFilePaths = (files ?? []).map((f) => f.path);
    const jobId = (req as any).__generationJobId || randomUUID();

    const jobData: GenerationJobData = {
      projectId,
      userId: req.user.id,
      prompt: dto.prompt,
      scanCodebase: dto.scanCodebase ?? false,
      breakIntoSubTasks: dto.breakIntoSubTasks ?? false,
      uploadedFilePaths,
    };

    const job = await this.queue.add('generate', jobData, {
      jobId,
      removeOnComplete: { age: 86400 }, // Keep for 24h
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
      return { status: 'completed', tasks: job.returnvalue?.tasks ?? [] };
    }
    if (state === 'failed') {
      return { status: 'failed', error: job.failedReason ?? 'Unknown error' };
    }

    return { status: state }; // 'waiting' | 'active' | 'delayed'
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/ai-task-generation/ai-task-generation.controller.ts
git commit -m "feat(ai-gen): add controller with generate and job status endpoints"
```

---

## Task 5: Backend Module — Wire Everything Together

**Files:**
- Create: `apps/api/src/ai-task-generation/ai-task-generation.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create the module**

```typescript
// apps/api/src/ai-task-generation/ai-task-generation.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiTaskGenerationController } from './ai-task-generation.controller';
import { AiTaskGenerationService } from './ai-task-generation.service';
import { AiTaskGenerationProcessor } from './ai-task-generation.processor';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    NotificationsModule,
    BullModule.registerQueue({ name: 'ai-task-generation' }),
  ],
  controllers: [AiTaskGenerationController],
  providers: [AiTaskGenerationService, AiTaskGenerationProcessor],
})
export class AiTaskGenerationModule {}
```

- [ ] **Step 2: Register in AppModule**

In `apps/api/src/app.module.ts`, add the import:

```typescript
import { AiTaskGenerationModule } from './ai-task-generation/ai-task-generation.module';
```

Add `AiTaskGenerationModule` to the `imports` array after `AiConfigModule`:

```typescript
imports: [
  // ... existing imports ...
  AiConfigModule,
  AiTaskGenerationModule,  // <-- add this
  TimeLogsModule,
],
```

- [ ] **Step 3: Verify the backend compiles**

Run: `cd apps/api && npx nest build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/ai-task-generation/ai-task-generation.module.ts apps/api/src/app.module.ts
git commit -m "feat(ai-gen): add module and register in AppModule"
```

---

## Task 6: Frontend Types and API Methods

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Add types to `apps/web/src/lib/types.ts`**

Add at the end of the file, before the closing content:

```typescript
// ─── AI Task Generation ─────────────────────────────────────────────────────

export interface GeneratedTask {
  title: string;
  description: string;
  acceptanceCriteria: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  storyPoints: number;
  subTasks?: GeneratedTask[];
}

export interface GenerateTasksPayload {
  prompt: string;
  scanCodebase?: boolean;
  breakIntoSubTasks?: boolean;
  documents?: File[];
}

export type AiGenerationStatus = 'waiting' | 'active' | 'completed' | 'failed';

export interface AiGenerationJobResult {
  status: AiGenerationStatus;
  tasks?: GeneratedTask[];
  error?: string;
}

export type AiGenerationStep = 'pulling' | 'scanning' | 'generating' | 'parsing';

export interface AiGenerationProgressEvent {
  jobId: string;
  step: AiGenerationStep;
}

export interface AiGenerationCompletedEvent {
  jobId: string;
  taskCount: number;
}

export interface AiGenerationFailedEvent {
  jobId: string;
  error: string;
}
```

- [ ] **Step 2: Add API methods to `apps/web/src/lib/api.ts`**

Add the import of the new types at the top of the file alongside existing imports:

```typescript
import type {
  // ... existing imports ...
  AiGenerationJobResult,
} from './types';
```

Add new methods to the `api` object, after the AI Config section:

```typescript
  // ─── AI Task Generation ────────────────────────────────────────────────────
  generateTasks: async (projectId: string, data: FormData): Promise<{ jobId: string }> => {
    const token = keycloak.token;
    const res = await fetch(`${API_BASE}/projects/${projectId}/ai/generate-tasks`, {
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
  getGenerationJobResult: (projectId: string, jobId: string) =>
    request<AiGenerationJobResult>(`/projects/${projectId}/ai/generate-tasks/${jobId}`),
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts
git commit -m "feat(ai-gen): add frontend types and API methods"
```

---

## Task 7: Frontend Hook — `useAiTaskGeneration`

**Files:**
- Create: `apps/web/src/hooks/useAiTaskGeneration.ts`

- [ ] **Step 1: Create the hook**

```typescript
// apps/web/src/hooks/useAiTaskGeneration.ts
import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useSocket } from '../socket/useSocket';
import type {
  AiGenerationStep,
  AiGenerationJobResult,
} from '../lib/types';

export function useAiTaskGeneration(projectId: string) {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [step, setStep] = useState<AiGenerationStep | 'idle' | 'queued' | 'completed' | 'failed'>('idle');

  // Submit generation request
  const generate = useMutation({
    mutationFn: (formData: FormData) => api.generateTasks(projectId, formData),
    onSuccess: (data) => {
      setJobId(data.jobId);
      setStep('queued');
      toast.info('AI task generation started');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to start generation');
    },
  });

  // Poll job result when completed
  const jobResult = useQuery({
    queryKey: ['ai-generation', projectId, jobId],
    queryFn: () => api.getGenerationJobResult(projectId, jobId!),
    enabled: !!jobId && step === 'completed',
  });

  // Socket.IO listeners
  useEffect(() => {
    if (!socket || !jobId) return;

    const onProgress = (data: { jobId: string; step: AiGenerationStep }) => {
      if (data.jobId === jobId) {
        setStep(data.step);
      }
    };

    const onCompleted = (data: { jobId: string; taskCount: number }) => {
      if (data.jobId === jobId) {
        setStep('completed');
        toast.success(`Generated ${data.taskCount} tasks`);
      }
    };

    const onFailed = (data: { jobId: string; error: string }) => {
      if (data.jobId === jobId) {
        setStep('failed');
        toast.error(`Generation failed: ${data.error}`);
      }
    };

    socket.on('ai-generation:progress', onProgress);
    socket.on('ai-generation:completed', onCompleted);
    socket.on('ai-generation:failed', onFailed);

    return () => {
      socket.off('ai-generation:progress', onProgress);
      socket.off('ai-generation:completed', onCompleted);
      socket.off('ai-generation:failed', onFailed);
    };
  }, [socket, jobId]);

  const reset = useCallback(() => {
    setJobId(null);
    setStep('idle');
    void queryClient.removeQueries({ queryKey: ['ai-generation', projectId] });
  }, [projectId, queryClient]);

  return {
    generate,
    jobId,
    step,
    tasks: jobResult.data?.tasks ?? [],
    isLoading: generate.isPending || (step !== 'idle' && step !== 'completed' && step !== 'failed'),
    isCompleted: step === 'completed',
    isFailed: step === 'failed',
    error: jobResult.data?.error,
    reset,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/useAiTaskGeneration.ts
git commit -m "feat(ai-gen): add useAiTaskGeneration hook with Socket.IO progress"
```

---

## Task 8: Frontend — GenerateTasksModal

**Files:**
- Create: `apps/web/src/components/tasks/GenerateTasksModal.tsx`

- [ ] **Step 1: Create the modal component**

```tsx
// apps/web/src/components/tasks/GenerateTasksModal.tsx
import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Sparkles, Upload, X, FileText } from 'lucide-react';
import type { AiGenerationStep } from '@/lib/types';

const STEP_LABELS: Record<string, string> = {
  queued: 'Queued — waiting for available slot...',
  pulling: 'Pulling latest code...',
  scanning: 'Scanning codebase with code-graph...',
  generating: 'Generating tasks with AI...',
  parsing: 'Parsing results...',
};

const STEP_PROGRESS: Record<string, number> = {
  queued: 10,
  pulling: 25,
  scanning: 45,
  generating: 70,
  parsing: 90,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: FormData) => void;
  isProcessing: boolean;
  step: AiGenerationStep | 'idle' | 'queued' | 'completed' | 'failed';
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = '.pdf,.docx,.txt,.md,.png,.jpg,.jpeg';

export function GenerateTasksModal({ open, onOpenChange, onSubmit, isProcessing, step }: Props) {
  const [prompt, setPrompt] = useState('');
  const [scanCodebase, setScanCodebase] = useState(false);
  const [breakIntoSubTasks, setBreakIntoSubTasks] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const valid = selected.filter((f) => f.size <= MAX_FILE_SIZE);
    setFiles((prev) => [...prev, ...valid].slice(0, MAX_FILES));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (prompt.trim().length < 10) return;
    const formData = new FormData();
    formData.append('prompt', prompt.trim());
    formData.append('scanCodebase', String(scanCodebase));
    formData.append('breakIntoSubTasks', String(breakIntoSubTasks));
    files.forEach((f) => formData.append('documents', f));
    onSubmit(formData);
  };

  const canSubmit = prompt.trim().length >= 10 && !isProcessing;

  return (
    <Dialog open={open} onOpenChange={isProcessing ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-purple-500" />
            Generate Tasks with AI
          </DialogTitle>
        </DialogHeader>

        {isProcessing ? (
          <div className="py-8 space-y-4">
            <div className="text-sm text-muted-foreground text-center">
              {STEP_LABELS[step] ?? 'Processing...'}
            </div>
            <Progress value={STEP_PROGRESS[step] ?? 0} className="h-2" />
            <p className="text-xs text-center text-muted-foreground">
              You can close this dialog — we'll notify you when it's done.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ai-prompt">
                Describe the tasks you need
              </Label>
              <Textarea
                id="ai-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Create tasks for implementing a user authentication system with login, registration, and password reset..."
                rows={4}
                maxLength={5000}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Minimum 10 characters</span>
                <span>{prompt.length} / 5000</span>
              </div>
            </div>

            {/* File upload */}
            <div className="space-y-2">
              <Label>Reference Documents (optional)</Label>
              <div
                className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-5 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-1">
                  Click to upload PDFs, docs, or images
                </p>
                <p className="text-xs text-muted-foreground">
                  Max {MAX_FILES} files, 10MB each
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_TYPES}
                onChange={handleFileSelect}
                className="hidden"
              />
              {files.length > 0 && (
                <div className="space-y-1">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm bg-muted rounded px-2 py-1">
                      <FileText className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1">{f.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {(f.size / 1024).toFixed(0)}KB
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="scan-codebase" className="text-sm font-medium">
                    Scan Codebase
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    AI scans relevant code using code-graph for better context
                  </p>
                </div>
                <Switch
                  id="scan-codebase"
                  checked={scanCodebase}
                  onCheckedChange={setScanCodebase}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="break-subtasks" className="text-sm font-medium">
                    Break into Sub-tasks
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    AI generates parent tasks with detailed sub-tasks
                  </p>
                </div>
                <Switch
                  id="break-subtasks"
                  checked={breakIntoSubTasks}
                  onCheckedChange={setBreakIntoSubTasks}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {!isProcessing && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit}>
                <Sparkles className="size-4 mr-1" />
                Generate
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/tasks/GenerateTasksModal.tsx
git commit -m "feat(ai-gen): add GenerateTasksModal with file upload and progress"
```

---

## Task 9: Frontend — TaskGenerationWizard

**Files:**
- Create: `apps/web/src/components/tasks/TaskGenerationWizard.tsx`

- [ ] **Step 1: Create the wizard component**

```tsx
// apps/web/src/components/tasks/TaskGenerationWizard.tsx
import { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Check,
  SkipForward,
  Pencil,
  ChevronLeft,
  CheckCheck,
  Sparkles,
} from 'lucide-react';
import { useCreateTask } from '@/hooks/useTasks';
import type { GeneratedTask, Priority } from '@/lib/types';

type TaskStatus = 'pending' | 'approved' | 'skipped';

interface FlatTask {
  task: GeneratedTask;
  parentIndex: number | null; // null = top-level
  status: TaskStatus;
  createdTaskId?: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  MEDIUM: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  LOW: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: GeneratedTask[];
  projectId: string;
  onComplete: () => void;
}

export function TaskGenerationWizard({ open, onOpenChange, tasks, projectId, onComplete }: Props) {
  const createTask = useCreateTask(projectId);

  // Flatten task tree into ordered list: parent → sub1 → sub2 → parent → sub1 → ...
  const initialFlat = useMemo(() => {
    const flat: FlatTask[] = [];
    tasks.forEach((task, i) => {
      flat.push({ task, parentIndex: null, status: 'pending' });
      if (task.subTasks) {
        task.subTasks.forEach((sub) => {
          flat.push({ task: sub, parentIndex: i, status: 'pending' });
        });
      }
    });
    return flat;
  }, [tasks]);

  const [flatTasks, setFlatTasks] = useState<FlatTask[]>(initialFlat);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<GeneratedTask | null>(null);

  const current = flatTasks[currentIndex];
  const isComplete = currentIndex >= flatTasks.length;

  // Find the parent's created task ID for sub-tasks
  const getParentTaskId = useCallback(
    (flat: FlatTask[], index: number): string | undefined => {
      const item = flat[index];
      if (item.parentIndex === null) return undefined;
      // Find the parent in the flat list
      let parentFlatIdx = -1;
      let topLevelCount = -1;
      for (let i = 0; i < flat.length; i++) {
        if (flat[i].parentIndex === null) topLevelCount++;
        if (topLevelCount === item.parentIndex) {
          parentFlatIdx = i;
          break;
        }
      }
      return parentFlatIdx >= 0 ? flat[parentFlatIdx].createdTaskId : undefined;
    },
    [],
  );

  const moveNext = useCallback(() => {
    let next = currentIndex + 1;
    // If we just skipped a parent, skip its sub-tasks too
    if (flatTasks[currentIndex]?.status === 'skipped' && flatTasks[currentIndex]?.parentIndex === null) {
      const parentTopIdx = flatTasks.slice(0, currentIndex + 1).filter((f) => f.parentIndex === null).length - 1;
      while (next < flatTasks.length && flatTasks[next].parentIndex === parentTopIdx) {
        setFlatTasks((prev) => {
          const updated = [...prev];
          updated[next] = { ...updated[next], status: 'skipped' };
          return updated;
        });
        next++;
      }
    }
    setCurrentIndex(next);
    setIsEditing(false);
    setEditValues(null);
  }, [currentIndex, flatTasks]);

  const handleApprove = async () => {
    const taskData = isEditing && editValues ? editValues : current.task;
    const parentId = current.parentIndex !== null ? getParentTaskId(flatTasks, currentIndex) : undefined;

    // Skip sub-task if parent was skipped (no parentId)
    if (current.parentIndex !== null && !parentId) {
      setFlatTasks((prev) => {
        const updated = [...prev];
        updated[currentIndex] = { ...updated[currentIndex], status: 'skipped' };
        return updated;
      });
      moveNext();
      return;
    }

    try {
      const created = await createTask.mutateAsync({
        title: taskData.title,
        description: taskData.description,
        acceptanceCriteria: taskData.acceptanceCriteria,
        priority: taskData.priority as Priority,
        storyPoints: taskData.storyPoints,
        parentId,
      });

      setFlatTasks((prev) => {
        const updated = [...prev];
        updated[currentIndex] = {
          ...updated[currentIndex],
          status: 'approved',
          createdTaskId: created.id,
        };
        return updated;
      });

      moveNext();
    } catch {
      // Error toast handled by useCreateTask
    }
  };

  const handleSkip = () => {
    setFlatTasks((prev) => {
      const updated = [...prev];
      updated[currentIndex] = { ...updated[currentIndex], status: 'skipped' };
      return updated;
    });
    moveNext();
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditValues({ ...current.task });
  };

  const handleApproveAll = async () => {
    for (let i = currentIndex; i < flatTasks.length; i++) {
      if (flatTasks[i].status !== 'pending') continue;
      const task = flatTasks[i].task;
      const parentId = flatTasks[i].parentIndex !== null ? getParentTaskId(flatTasks, i) : undefined;

      if (flatTasks[i].parentIndex !== null && !parentId) continue;

      try {
        const created = await createTask.mutateAsync({
          title: task.title,
          description: task.description,
          acceptanceCriteria: task.acceptanceCriteria,
          priority: task.priority as Priority,
          storyPoints: task.storyPoints,
          parentId,
        });

        setFlatTasks((prev) => {
          const updated = [...prev];
          updated[i] = { ...updated[i], status: 'approved', createdTaskId: created.id };
          return updated;
        });
      } catch {
        break;
      }
    }
    setCurrentIndex(flatTasks.length);
  };

  const goBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsEditing(false);
      setEditValues(null);
    }
  };

  // Counts
  const approved = flatTasks.filter((t) => t.status === 'approved').length;
  const skipped = flatTasks.filter((t) => t.status === 'skipped').length;
  const parentApproved = flatTasks.filter((t) => t.status === 'approved' && t.parentIndex === null).length;
  const subApproved = flatTasks.filter((t) => t.status === 'approved' && t.parentIndex !== null).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-purple-500" />
            Review Generated Tasks
            <Badge variant="outline" className="ml-2">
              {currentIndex + 1} / {flatTasks.length}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Left sidebar — task list */}
          <div className="w-56 border-r shrink-0">
            <ScrollArea className="h-full p-3">
              <div className="space-y-1">
                {flatTasks.map((ft, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (ft.status !== 'pending' || idx === currentIndex) {
                        setCurrentIndex(idx);
                        setIsEditing(false);
                        setEditValues(null);
                      }
                    }}
                    className={`w-full text-left rounded px-2 py-1.5 text-xs transition-colors ${
                      idx === currentIndex
                        ? 'bg-primary/10 text-primary font-medium'
                        : ft.status === 'approved'
                          ? 'text-green-600 dark:text-green-400'
                          : ft.status === 'skipped'
                            ? 'text-muted-foreground line-through'
                            : 'text-foreground hover:bg-muted'
                    } ${ft.parentIndex !== null ? 'ml-3' : ''}`}
                  >
                    <div className="flex items-center gap-1.5">
                      {ft.status === 'approved' && <Check className="size-3 shrink-0" />}
                      {ft.status === 'skipped' && <SkipForward className="size-3 shrink-0" />}
                      <span className="truncate">{ft.task.title}</span>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Main area */}
          <div className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 px-6 py-4">
              {isComplete ? (
                /* Completion screen */
                <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                  <CheckCheck className="size-12 text-green-500" />
                  <h2 className="text-lg font-semibold">Generation Complete</h2>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Created {parentApproved} tasks and {subApproved} sub-tasks</p>
                    {skipped > 0 && <p>{skipped} skipped</p>}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                      Close
                    </Button>
                    <Button onClick={onComplete}>
                      View Tasks
                    </Button>
                  </div>
                </div>
              ) : (
                /* Task detail */
                <div className="space-y-4">
                  {current.parentIndex !== null && (
                    <Badge variant="secondary" className="text-xs">Sub-task</Badge>
                  )}

                  {/* Title */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Title</Label>
                    {isEditing ? (
                      <Input
                        value={editValues?.title ?? ''}
                        onChange={(e) =>
                          setEditValues((prev) => prev ? { ...prev, title: e.target.value } : prev)
                        }
                        maxLength={200}
                      />
                    ) : (
                      <h3 className="text-base font-semibold">{current.task.title}</h3>
                    )}
                  </div>

                  <div className="flex gap-4">
                    {/* Priority */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Priority</Label>
                      {isEditing ? (
                        <Select
                          value={editValues?.priority ?? 'MEDIUM'}
                          onValueChange={(v) =>
                            setEditValues((prev) =>
                              prev ? { ...prev, priority: v as GeneratedTask['priority'] } : prev,
                            )
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CRITICAL">Critical</SelectItem>
                            <SelectItem value="HIGH">High</SelectItem>
                            <SelectItem value="MEDIUM">Medium</SelectItem>
                            <SelectItem value="LOW">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={PRIORITY_COLORS[current.task.priority]}>
                          {current.task.priority}
                        </Badge>
                      )}
                    </div>

                    {/* Story Points */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Story Points</Label>
                      {isEditing ? (
                        <Select
                          value={String(editValues?.storyPoints ?? 3)}
                          onValueChange={(v) =>
                            setEditValues((prev) =>
                              prev ? { ...prev, storyPoints: Number(v) } : prev,
                            )
                          }
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 5, 8, 13].map((sp) => (
                              <SelectItem key={sp} value={String(sp)}>
                                {sp}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="text-sm font-medium">{current.task.storyPoints} pts</div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Description */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    {isEditing ? (
                      <Textarea
                        value={editValues?.description ?? ''}
                        onChange={(e) =>
                          setEditValues((prev) =>
                            prev ? { ...prev, description: e.target.value } : prev,
                          )
                        }
                        rows={6}
                      />
                    ) : (
                      <div className="text-sm whitespace-pre-wrap bg-muted/50 rounded-lg p-3">
                        {current.task.description}
                      </div>
                    )}
                  </div>

                  {/* Acceptance Criteria */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Acceptance Criteria</Label>
                    {isEditing ? (
                      <Textarea
                        value={editValues?.acceptanceCriteria ?? ''}
                        onChange={(e) =>
                          setEditValues((prev) =>
                            prev ? { ...prev, acceptanceCriteria: e.target.value } : prev,
                          )
                        }
                        rows={6}
                      />
                    ) : (
                      <div className="text-sm whitespace-pre-wrap bg-muted/50 rounded-lg p-3">
                        {current.task.acceptanceCriteria}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </ScrollArea>

            {/* Bottom action bar */}
            {!isComplete && (
              <div className="border-t px-6 py-3 flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goBack}
                  disabled={currentIndex === 0}
                >
                  <ChevronLeft className="size-4 mr-1" />
                  Back
                </Button>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleSkip}>
                    <SkipForward className="size-4 mr-1" />
                    Skip
                  </Button>

                  {!isEditing && current.status === 'pending' && (
                    <Button variant="outline" size="sm" onClick={handleEdit}>
                      <Pencil className="size-4 mr-1" />
                      Edit & Approve
                    </Button>
                  )}

                  <Button
                    size="sm"
                    onClick={handleApprove}
                    disabled={createTask.isPending}
                  >
                    <Check className="size-4 mr-1" />
                    {isEditing ? 'Save & Approve' : 'Approve'}
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleApproveAll}
                    disabled={createTask.isPending}
                  >
                    <CheckCheck className="size-4 mr-1" />
                    Approve All
                  </Button>
                </div>
              </div>
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
git add apps/web/src/components/tasks/TaskGenerationWizard.tsx
git commit -m "feat(ai-gen): add TaskGenerationWizard with approve/edit/skip flow"
```

---

## Task 10: Wire Into BacklogPage

**Files:**
- Modify: `apps/web/src/pages/BacklogPage.tsx`

- [ ] **Step 1: Add imports and state**

Add these imports at the top of `BacklogPage.tsx`:

```typescript
import { Sparkles } from 'lucide-react';
import { useAiConfig } from '@/hooks/useAiConfig';
import { useRepositoryConfig } from '@/hooks/useRepositoryConfig';
import { useAiTaskGeneration } from '@/hooks/useAiTaskGeneration';
import { GenerateTasksModal } from '@/components/tasks/GenerateTasksModal';
import { TaskGenerationWizard } from '@/components/tasks/TaskGenerationWizard';
```

- [ ] **Step 2: Add state and hooks inside BacklogPage component**

After the existing `const [createOpen, setCreateOpen] = useState(false);` line, add:

```typescript
const [generateOpen, setGenerateOpen] = useState(false);
const [wizardOpen, setWizardOpen] = useState(false);
const { data: aiConfig } = useAiConfig(projectId);
const { data: repoConfig } = useRepositoryConfig(projectId);
const aiGeneration = useAiTaskGeneration(projectId);

const canGenerate = !!aiConfig && repoConfig?.cloneStatus === 'cloned';

// Open wizard when generation completes
const handleGenerateSubmit = (formData: FormData) => {
  aiGeneration.generate.mutate(formData);
};

// Open wizard when generation completes
useEffect(() => {
  if (aiGeneration.isCompleted && aiGeneration.tasks.length > 0 && !wizardOpen) {
    setGenerateOpen(false);
    setWizardOpen(true);
  }
}, [aiGeneration.isCompleted, aiGeneration.tasks.length, wizardOpen]);
```

- [ ] **Step 3: Add the "Generate with AI" button**

In the header section where the "Create Task" button is, change the button area from:

```tsx
{canEdit && (
  <Button onClick={() => setCreateOpen(true)}>Create Task</Button>
)}
```

To (in all three places where this pattern appears — empty state header, empty state body, and main header):

For the main header (line ~117) and empty state header (line ~84), wrap in a flex container:

```tsx
{canEdit && (
  <div className="flex items-center gap-2">
    <Button
      variant="outline"
      onClick={() => setGenerateOpen(true)}
      disabled={!canGenerate}
      title={!canGenerate ? 'Configure AI settings and clone repository first' : 'Generate tasks with AI'}
    >
      <Sparkles className="size-4 mr-1" />
      Generate with AI
    </Button>
    <Button onClick={() => setCreateOpen(true)}>Create Task</Button>
  </div>
)}
```

For the centered empty state button (line ~97), add the Generate button above it:

```tsx
{canEdit && (
  <div className="flex flex-col gap-2 items-center">
    <Button onClick={() => setCreateOpen(true)}>Create Task</Button>
    <Button
      variant="outline"
      onClick={() => setGenerateOpen(true)}
      disabled={!canGenerate}
    >
      <Sparkles className="size-4 mr-1" />
      Generate with AI
    </Button>
  </div>
)}
```

- [ ] **Step 4: Add modal and wizard components**

Before the closing `</div>` of the BacklogPage return, after the `<CreateTaskDialog>`, add:

```tsx
<GenerateTasksModal
  open={generateOpen}
  onOpenChange={setGenerateOpen}
  onSubmit={handleGenerateSubmit}
  isProcessing={aiGeneration.isLoading}
  step={aiGeneration.step}
/>

{wizardOpen && aiGeneration.tasks.length > 0 && (
  <TaskGenerationWizard
    open={wizardOpen}
    onOpenChange={(open) => {
      setWizardOpen(open);
      if (!open) aiGeneration.reset();
    }}
    tasks={aiGeneration.tasks}
    projectId={projectId}
    onComplete={() => {
      setWizardOpen(false);
      aiGeneration.reset();
    }}
  />
)}
```

- [ ] **Step 5: Verify frontend compiles**

Run: `cd apps/web && npx vite build`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/BacklogPage.tsx
git commit -m "feat(ai-gen): wire GenerateTasksModal and TaskGenerationWizard into BacklogPage"
```

---

## Task 11: End-to-End Verification

- [ ] **Step 1: Verify backend starts**

Run: `cd apps/api && npm run start:dev`
Expected: Application starts without errors, `ai-task-generation` queue registered

- [ ] **Step 2: Verify frontend builds**

Run: `cd apps/web && npx vite build`
Expected: Build succeeds

- [ ] **Step 3: Smoke test the flow**

1. Open the backlog page for a project with AI config and cloned repo
2. Click "Generate with AI" — modal should open
3. Enter a prompt, toggle options
4. Submit — progress should show via Socket.IO events
5. On completion — wizard should open with generated tasks
6. Approve/skip tasks — they should appear in the backlog

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(ai-gen): complete AI task generation feature"
```
