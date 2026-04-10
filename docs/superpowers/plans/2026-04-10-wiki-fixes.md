# Wiki Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three wiki issues: move wiki dir path to `.env`, limit generation to 1 concurrent job globally, and fix the progress banner that never displays.

**Architecture:** Backend changes centralize wiki path resolution in `WikiGenerationService.getWikiPath()` using the `WIKI_DIR` env var (mirroring the existing `WORKSPACE_DIR` pattern). BullMQ processor concurrency drops to 1 with a pre-enqueue active-job guard. Frontend gains an active-job recovery query on mount and a relaxed banner condition to show during all phases.

**Tech Stack:** NestJS, Prisma, BullMQ, React, TanStack Query, Socket.IO

---

### Task 1: Add `WIKI_DIR` to `.env.example` and create `getWikiPath()` helper

**Files:**
- Modify: `apps/api/.env.example:16`
- Modify: `apps/api/src/wiki-generation/wiki-generation.service.ts:207-238`

- [ ] **Step 1: Add `WIKI_DIR` to `.env.example`**

Add a new line after `WORKSPACE_DIR`:

```
# Directory for generated project wikis (absolute or relative to monorepo root)
WIKI_DIR=wikis
```

- [ ] **Step 2: Add `getWikiPath()` method and update imports in `wiki-generation.service.ts`**

Add `isAbsolute`, `resolve`, and `join` imports at the top of the file, then add the `getWikiPath` method to `WikiGenerationService`:

At the top of `apps/api/src/wiki-generation/wiki-generation.service.ts`, add the path imports:

```typescript
import { isAbsolute, resolve, join } from 'path';
```

Then add this method to the `WikiGenerationService` class (after the constructor):

```typescript
  getWikiPath(projectId: string): string {
    const configDir = this.config.get<string>('WIKI_DIR', 'wikis');
    const baseDir = isAbsolute(configDir) ? configDir : resolve(process.cwd(), '..', '..', configDir);
    return join(baseDir, projectId);
  }
```

- [ ] **Step 3: Update `getProjectConfig()` to use computed path instead of DB field**

In `WikiGenerationService.getProjectConfig()`, remove the wikiConfig lookup and use the computed path instead. Replace the method body:

```typescript
  async getProjectConfig(projectId: string) {
    const aiConfig = await this.prisma.aiConfig.findUnique({ where: { projectId } });
    if (!aiConfig) throw new BadRequestException('AI configuration not found. Save AI settings first.');

    const repoConfig = await this.prisma.repositoryConfig.findUnique({ where: { projectId } });
    if (!repoConfig || repoConfig.cloneStatus !== 'cloned') {
      throw new BadRequestException('Repository must be cloned before generating wiki.');
    }

    const wikiConfig = await this.prisma.wikiConfig.findUnique({ where: { projectId } });
    if (!wikiConfig) throw new BadRequestException('Wiki configuration not found. Save wiki settings first.');

    const encryptionKey = this.config.getOrThrow<string>('ENCRYPTION_KEY');
    const apiKey = decrypt(aiConfig.apiKey, encryptionKey);

    return {
      provider: aiConfig.provider,
      model: aiConfig.model,
      apiKey,
      projectContext: aiConfig.projectContext,
      workspacePath: repoConfig.workspacePath!,
      cli: CLI_COMMANDS[aiConfig.provider] ?? aiConfig.provider,
      wikiPath: this.getWikiPath(projectId),
      sections: wikiConfig.sections,
    };
  }
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/.env.example apps/api/src/wiki-generation/wiki-generation.service.ts
git commit -m "feat(wiki): add WIKI_DIR env var and getWikiPath() helper"
```

---

### Task 2: Remove `wikiPath` from Prisma schema and DTO

**Files:**
- Modify: `apps/api/prisma/schema.prisma:585-596`
- Modify: `apps/api/src/wiki-config/dto/upsert-wiki-config.dto.ts`
- Modify: `apps/api/src/wiki-config/wiki-config.service.ts`

- [ ] **Step 1: Remove `wikiPath` from Prisma `WikiConfig` model**

In `apps/api/prisma/schema.prisma`, remove the `wikiPath` line from the `WikiConfig` model. The model should become:

```prisma
model WikiConfig {
  id              String   @id @default(cuid())
  projectId       String   @unique
  autoUpdate      String   @default("manual")
  sections        String[] @default(["architecture", "modules", "features", "business-logic", "api-reference", "data-models", "glossary"])
  lastGeneratedAt DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Remove `wikiPath` from `UpsertWikiConfigDto`**

Replace the entire file `apps/api/src/wiki-config/dto/upsert-wiki-config.dto.ts`:

```typescript
import { IsString, IsOptional, IsIn, IsArray, ArrayNotEmpty } from 'class-validator';

export class UpsertWikiConfigDto {
  @IsOptional()
  @IsString()
  @IsIn(['manual', 'on-pull', 'scheduled'])
  autoUpdate?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  sections?: string[];
}
```

- [ ] **Step 3: Remove `wikiPath` from `WikiConfigService.upsert()`**

Replace the `upsert` method in `apps/api/src/wiki-config/wiki-config.service.ts`:

```typescript
  async upsert(projectId: string, dto: UpsertWikiConfigDto) {
    return this.prisma.wikiConfig.upsert({
      where: { projectId },
      create: {
        projectId,
        autoUpdate: dto.autoUpdate ?? 'manual',
        sections: dto.sections ?? ['architecture', 'modules', 'features', 'business-logic', 'api-reference', 'data-models', 'glossary'],
      },
      update: {
        ...(dto.autoUpdate !== undefined && { autoUpdate: dto.autoUpdate }),
        ...(dto.sections !== undefined && { sections: dto.sections }),
      },
    });
  }
```

- [ ] **Step 4: Generate and apply the Prisma migration**

```bash
cd apps/api && npx prisma migrate dev --name remove-wiki-path-from-wiki-config
```

Expected: Migration created and applied. The `wikiPath` column is dropped from the `WikiConfig` table.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/ apps/api/src/wiki-config/
git commit -m "feat(wiki): remove wikiPath from DB schema and DTO"
```

---

### Task 3: Update `WikiConfigController` to return computed `wikiPath`

**Files:**
- Modify: `apps/api/src/wiki-config/wiki-config.controller.ts`
- Modify: `apps/api/src/wiki-config/wiki-config.module.ts`

- [ ] **Step 1: Inject `WikiGenerationService` and return computed path**

Replace `apps/api/src/wiki-config/wiki-config.controller.ts`:

```typescript
import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { WikiConfigService } from './wiki-config.service';
import { WikiGenerationService } from '../wiki-generation/wiki-generation.service';
import { UpsertWikiConfigDto } from './dto/upsert-wiki-config.dto';

@Controller('projects/:projectId/wiki/config')
@UseGuards(JwtAuthGuard)
export class WikiConfigController {
  constructor(
    private readonly service: WikiConfigService,
    private readonly wikiGenService: WikiGenerationService,
  ) {}

  @Get()
  @UseGuards(ProjectRolesGuard)
  async findOne(@Param('projectId') projectId: string) {
    const config = await this.service.findByProjectId(projectId);
    if (!config) return null;
    return { ...config, wikiPath: this.wikiGenService.getWikiPath(projectId) };
  }

  @Put()
  @UseGuards(ProjectRolesGuard)
  @RequirePermission('projectSettings', 'update')
  async upsert(
    @Param('projectId') projectId: string,
    @Body() dto: UpsertWikiConfigDto,
  ) {
    const config = await this.service.upsert(projectId, dto);
    return { ...config, wikiPath: this.wikiGenService.getWikiPath(projectId) };
  }
}
```

- [ ] **Step 2: Import `WikiGenerationModule` in `WikiConfigModule`**

Replace `apps/api/src/wiki-config/wiki-config.module.ts`:

```typescript
import { Module, forwardRef } from '@nestjs/common';
import { WikiConfigController } from './wiki-config.controller';
import { WikiConfigService } from './wiki-config.service';
import { WikiGenerationModule } from '../wiki-generation/wiki-generation.module';

@Module({
  imports: [forwardRef(() => WikiGenerationModule)],
  controllers: [WikiConfigController],
  providers: [WikiConfigService],
  exports: [WikiConfigService],
})
export class WikiConfigModule {}
```

Note: `forwardRef` is needed because `WikiGenerationModule` already imports `WikiConfigModule`. This breaks the circular dependency.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/wiki-config/
git commit -m "feat(wiki): return computed wikiPath from config endpoints"
```

---

### Task 4: Update `WikiService` and `WikiController` to use computed path

**Files:**
- Modify: `apps/api/src/wiki/wiki.service.ts`
- Modify: `apps/api/src/wiki/wiki.controller.ts`
- Modify: `apps/api/src/wiki/wiki.module.ts`

- [ ] **Step 1: Update `WikiService` to use `WikiGenerationService.getWikiPath()`**

Replace the imports and constructor, and update all methods that reference `config.wikiPath`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { readdir, readFile, stat, unlink } from 'fs/promises';
import { join, relative } from 'path';
import { existsSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { WikiGenerationService } from '../wiki-generation/wiki-generation.service';

export interface WikiTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: WikiTreeNode[];
}

@Injectable()
export class WikiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wikiGenService: WikiGenerationService,
  ) {}

  async getPageTree(projectId: string): Promise<WikiTreeNode[]> {
    const wikiPath = this.wikiGenService.getWikiPath(projectId);
    if (!existsSync(wikiPath)) return [];
    return this.buildTree(wikiPath, wikiPath);
  }

  private async buildTree(rootPath: string, currentPath: string): Promise<WikiTreeNode[]> {
    const entries = await readdir(currentPath, { withFileTypes: true });
    const nodes: WikiTreeNode[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
      const fullPath = join(currentPath, entry.name);
      const relPath = relative(rootPath, fullPath);
      if (entry.isDirectory()) {
        const children = await this.buildTree(rootPath, fullPath);
        nodes.push({ name: entry.name, path: relPath, type: 'directory', children });
      } else if (entry.name.endsWith('.md')) {
        nodes.push({ name: entry.name, path: relPath, type: 'file' });
      }
    }
    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  async getPage(projectId: string, pagePath: string): Promise<{ path: string; content: string }> {
    const wikiPath = this.wikiGenService.getWikiPath(projectId);
    const fullPath = join(wikiPath, pagePath);
    if (!existsSync(fullPath)) throw new NotFoundException(`Wiki page not found: ${pagePath}`);
    const content = await readFile(fullPath, 'utf-8');
    return { path: pagePath, content };
  }

  async searchPages(projectId: string, query: string): Promise<Array<{ path: string; title: string; snippet: string }>> {
    const wikiPath = this.wikiGenService.getWikiPath(projectId);
    if (!existsSync(wikiPath)) return [];
    const results: Array<{ path: string; title: string; snippet: string }> = [];
    const lowerQuery = query.toLowerCase();
    await this.searchDir(wikiPath, wikiPath, lowerQuery, results);
    return results.slice(0, 20);
  }

  private async searchDir(
    rootPath: string, currentPath: string, query: string,
    results: Array<{ path: string; title: string; snippet: string }>,
  ) {
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
      const fullPath = join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await this.searchDir(rootPath, fullPath, query, results);
      } else if (entry.name.endsWith('.md')) {
        const content = await readFile(fullPath, 'utf-8');
        const lowerContent = content.toLowerCase();
        if (lowerContent.includes(query)) {
          const relPath = relative(rootPath, fullPath);
          const titleMatch = content.match(/^title:\s*(.+)$/m);
          const title = titleMatch ? titleMatch[1].trim() : entry.name.replace('.md', '');
          const idx = lowerContent.indexOf(query);
          const snippet = content.substring(Math.max(0, idx - 50), idx + query.length + 50).trim();
          results.push({ path: relPath, title, snippet });
        }
      }
    }
  }

  // ─── Annotations ───────────────────────────────────────────────────────

  async getAnnotations(projectId: string, pagePath: string) {
    return this.prisma.wikiAnnotation.findMany({
      where: { projectId, pagePath },
      include: {
        author: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createAnnotation(projectId: string, authorId: string, data: {
    pagePath: string; sectionRef?: string; content: string;
  }) {
    return this.prisma.wikiAnnotation.create({
      data: {
        projectId, authorId,
        pagePath: data.pagePath,
        sectionRef: data.sectionRef ?? null,
        content: data.content,
      },
      include: {
        author: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
      },
    });
  }

  async updateAnnotation(annotationId: string, authorId: string, content: string) {
    const annotation = await this.prisma.wikiAnnotation.findUnique({ where: { id: annotationId } });
    if (!annotation) throw new NotFoundException('Annotation not found');
    if (annotation.authorId !== authorId) {
      throw new NotFoundException('Only the author can edit this annotation');
    }
    return this.prisma.wikiAnnotation.update({
      where: { id: annotationId },
      data: { content },
      include: {
        author: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
      },
    });
  }

  async deleteAnnotation(annotationId: string, authorId: string) {
    const annotation = await this.prisma.wikiAnnotation.findUnique({ where: { id: annotationId } });
    if (!annotation) throw new NotFoundException('Annotation not found');
    if (annotation.authorId !== authorId) {
      throw new NotFoundException('Only the author can delete this annotation');
    }
    await this.prisma.wikiAnnotation.delete({ where: { id: annotationId } });
  }

  // ─── Q&A ───────────────────────────────────────────────────────────

  async getQaHistory(projectId: string): Promise<Array<{ id: string; question: string; answer: string; createdAt: string }>> {
    const wikiPath = this.wikiGenService.getWikiPath(projectId);
    if (!existsSync(join(wikiPath, 'qa'))) return [];

    const qaDir = join(wikiPath, 'qa');
    const entries = await readdir(qaDir);
    const results: Array<{ id: string; question: string; answer: string; createdAt: string }> = [];

    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue;
      const content = await readFile(join(qaDir, entry), 'utf-8');
      const questionMatch = content.match(/^question:\s*(.+)$/m);
      const createdAtMatch = content.match(/^generatedAt:\s*(.+)$/m) || content.match(/^createdAt:\s*(.+)$/m);
      const answerStart = content.indexOf('---', content.indexOf('---') + 3);
      const answer = answerStart >= 0 ? content.substring(answerStart + 3).trim() : content;

      results.push({
        id: entry.replace('.md', ''),
        question: questionMatch?.[1]?.trim() ?? entry.replace('.md', ''),
        answer,
        createdAt: createdAtMatch?.[1]?.trim() ?? '',
      });
    }

    return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async deleteQa(projectId: string, qaId: string): Promise<void> {
    const wikiPath = this.wikiGenService.getWikiPath(projectId);
    const filePath = join(wikiPath, 'qa', `${qaId}.md`);
    if (!existsSync(filePath)) throw new NotFoundException('Q&A entry not found');
    await unlink(filePath);
  }
}
```

- [ ] **Step 2: Update `WikiController` to use computed path for Q&A jobs**

In `apps/api/src/wiki/wiki.controller.ts`, replace the import and update the `askQuestion` method to use the computed path. Replace the entire file:

```typescript
import {
  Controller, Get, Post, Put, Delete, Param, Query, Body, Req, UseGuards,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { WikiService } from './wiki.service';
import { WikiGenerationService } from '../wiki-generation/wiki-generation.service';

@Controller('projects/:projectId/wiki')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class WikiController {
  constructor(
    private readonly service: WikiService,
    private readonly wikiGenService: WikiGenerationService,
    @InjectQueue('wiki-generation') private readonly queue: Queue,
  ) {}

  @Get('pages')
  getPageTree(@Param('projectId') projectId: string) {
    return this.service.getPageTree(projectId);
  }

  @Get('pages/*')
  getPage(@Param('projectId') projectId: string, @Param() params: Record<string, string>) {
    const pagePath = params[0] || params['0'] || '';
    return this.service.getPage(projectId, pagePath);
  }

  @Get('search')
  search(@Param('projectId') projectId: string, @Query('q') query: string) {
    return this.service.searchPages(projectId, query || '');
  }

  @Get('annotations')
  getAnnotations(
    @Param('projectId') projectId: string,
    @Query('pagePath') pagePath: string,
  ) {
    return this.service.getAnnotations(projectId, pagePath);
  }

  @Post('annotations')
  createAnnotation(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body() body: { pagePath: string; sectionRef?: string; content: string },
  ) {
    return this.service.createAnnotation(projectId, req.user.id, body);
  }

  @Put('annotations/:annotationId')
  updateAnnotation(
    @Param('annotationId') annotationId: string,
    @Req() req: any,
    @Body() body: { content: string },
  ) {
    return this.service.updateAnnotation(annotationId, req.user.id, body.content);
  }

  @Delete('annotations/:annotationId')
  deleteAnnotation(
    @Param('annotationId') annotationId: string,
    @Req() req: any,
  ) {
    return this.service.deleteAnnotation(annotationId, req.user.id);
  }

  @Post('qa')
  async askQuestion(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body() body: { question: string },
  ) {
    const wikiPath = this.wikiGenService.getWikiPath(projectId);

    const job = await this.queue.add('wiki-qa', {
      projectId,
      userId: req.user.id,
      question: body.question,
      wikiPath,
    }, {
      removeOnComplete: { age: 86400 },
      removeOnFail: { age: 86400 },
    });

    return { jobId: job.id };
  }

  @Get('qa/history')
  getQaHistory(@Param('projectId') projectId: string) {
    return this.service.getQaHistory(projectId);
  }

  @Delete('qa/:qaId')
  deleteQa(@Param('projectId') projectId: string, @Param('qaId') qaId: string) {
    return this.service.deleteQa(projectId, qaId);
  }
}
```

- [ ] **Step 3: Update `WikiModule` to import `WikiGenerationModule`**

Replace `apps/api/src/wiki/wiki.module.ts`:

```typescript
import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WikiController } from './wiki.controller';
import { WikiService } from './wiki.service';
import { WikiGenerationModule } from '../wiki-generation/wiki-generation.module';

@Module({
  imports: [
    forwardRef(() => WikiGenerationModule),
    BullModule.registerQueue({ name: 'wiki-generation' }),
  ],
  controllers: [WikiController],
  providers: [WikiService],
  exports: [WikiService],
})
export class WikiModule {}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/wiki/
git commit -m "feat(wiki): use computed wikiPath in WikiService and WikiController"
```

---

### Task 5: Set processor concurrency to 1 and add active-job guard

**Files:**
- Modify: `apps/api/src/wiki-generation/wiki-generation.processor.ts:11`
- Modify: `apps/api/src/wiki-generation/wiki-generation.controller.ts`

- [ ] **Step 1: Change concurrency from 2 to 1**

In `apps/api/src/wiki-generation/wiki-generation.processor.ts`, change line 11:

```typescript
@Processor('wiki-generation', { concurrency: 1 })
```

- [ ] **Step 2: Add active-job guard and active-job endpoint to controller**

Replace `apps/api/src/wiki-generation/wiki-generation.controller.ts`:

```typescript
import {
  Controller, Post, Get, Param, Body, Req, UseGuards, NotFoundException, BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { WikiConfigService } from '../wiki-config/wiki-config.service';
import { TriggerWikiGenerationDto, WikiGenerationJobData } from './dto/generate-wiki.dto';

@Controller('projects/:projectId/wiki/generate')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class WikiGenerationController {
  constructor(
    @InjectQueue('wiki-generation') private readonly queue: Queue,
    private readonly wikiConfigService: WikiConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /** Fail-fast: validate repo clone + AI config before enqueueing */
  private async validatePrerequisites(projectId: string) {
    const repoConfig = await this.prisma.repositoryConfig.findUnique({ where: { projectId } });
    if (!repoConfig || repoConfig.cloneStatus !== 'cloned') {
      throw new BadRequestException('Repository must be cloned before generating wiki.');
    }

    const aiConfig = await this.prisma.aiConfig.findUnique({ where: { projectId } });
    if (!aiConfig) {
      throw new BadRequestException('AI configuration not found. Save AI settings first.');
    }
  }

  /** Check if any wiki-generation job is currently active (across all projects) */
  private async getActiveGenerationJob() {
    const active = await this.queue.getJobs(['active', 'waiting']);
    return active.find((j) => j.name === 'generate-wiki') ?? null;
  }

  @Post()
  @RequirePermission('projectSettings', 'update')
  async generate(
    @Param('projectId') projectId: string,
    @Body() dto: TriggerWikiGenerationDto,
    @Req() req: any,
  ) {
    await this.validatePrerequisites(projectId);

    const existingJob = await this.getActiveGenerationJob();
    if (existingJob) {
      throw new ConflictException('Wiki generation is already in progress. Please wait for it to complete.');
    }

    const config = await this.wikiConfigService.findByProjectId(projectId);
    if (!config) throw new NotFoundException('Wiki configuration not found. Save wiki settings first.');

    const sections = dto.section ? [dto.section] : config.sections;

    const jobData: WikiGenerationJobData = {
      projectId,
      userId: req.user.id,
      sections,
    };

    const job = await this.queue.add('generate-wiki', jobData, {
      removeOnComplete: { age: 86400 },
      removeOnFail: { age: 86400 },
    });

    return { jobId: job.id };
  }

  @Post(':section')
  @RequirePermission('projectSettings', 'update')
  async generateSection(
    @Param('projectId') projectId: string,
    @Param('section') section: string,
    @Req() req: any,
  ) {
    await this.validatePrerequisites(projectId);

    const existingJob = await this.getActiveGenerationJob();
    if (existingJob) {
      throw new ConflictException('Wiki generation is already in progress. Please wait for it to complete.');
    }

    const config = await this.wikiConfigService.findByProjectId(projectId);
    if (!config) throw new NotFoundException('Wiki configuration not found.');

    const jobData: WikiGenerationJobData = {
      projectId,
      userId: req.user.id,
      sections: [section],
    };

    const job = await this.queue.add('generate-wiki', jobData, {
      removeOnComplete: { age: 86400 },
      removeOnFail: { age: 86400 },
    });

    return { jobId: job.id };
  }

  @Get('active')
  async getActiveJob(@Param('projectId') projectId: string) {
    const active = await this.queue.getJobs(['active', 'waiting']);
    const job = active.find(
      (j) => j.name === 'generate-wiki' && j.data?.projectId === projectId,
    );

    if (!job) return { active: false };

    const state = await job.getState();
    const progress = job.progress as { step?: string; streamText?: string } | undefined;

    return {
      active: true,
      jobId: job.id,
      status: state,
      step: progress?.step ?? 'queued',
      sections: job.data.sections ?? [],
    };
  }

  @Get('status/:jobId')
  async getStatus(@Param('jobId') jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job) throw new NotFoundException('Generation job not found');

    const state = await job.getState();

    if (state === 'completed') {
      return { status: 'completed', result: job.returnvalue };
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

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/wiki-generation/wiki-generation.processor.ts apps/api/src/wiki-generation/wiki-generation.controller.ts
git commit -m "feat(wiki): limit generation to 1 concurrent job and add active-job endpoint"
```

---

### Task 6: Frontend — remove `wikiPath` input from Settings, update types

**Files:**
- Modify: `apps/web/src/lib/types.ts:814-818`
- Modify: `apps/web/src/hooks/useWiki.ts:13-17`
- Modify: `apps/web/src/components/settings/WikiConfigCard.tsx`

- [ ] **Step 1: Remove `wikiPath` from `UpsertWikiConfigPayload` type**

In `apps/web/src/lib/types.ts`, change the `UpsertWikiConfigPayload` interface:

```typescript
export interface UpsertWikiConfigPayload {
  autoUpdate?: string;
  sections?: string[];
}
```

- [ ] **Step 2: Update mutation payload type in `useWiki.ts`**

In `apps/web/src/hooks/useWiki.ts`, change the `mutationFn` type on line 16:

```typescript
    mutationFn: (data: { autoUpdate?: string; sections?: string[] }) =>
```

- [ ] **Step 3: Update `WikiConfigCard.tsx` — remove wikiPath input, show computed path**

Replace `apps/web/src/components/settings/WikiConfigCard.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { BookOpen, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWikiConfig, useUpsertWikiConfig } from '@/hooks/useWiki';
import { useWikiGeneration } from '@/hooks/useWikiGeneration';

const ALL_SECTIONS = [
  'architecture', 'modules', 'features', 'business-logic',
  'api-reference', 'data-models', 'glossary',
];

const AUTO_UPDATE_OPTIONS = [
  { value: 'manual', label: 'Manual Only' },
  { value: 'on-pull', label: 'On Git Pull' },
  { value: 'scheduled', label: 'Scheduled' },
];

interface Props {
  projectId: string;
  canManage: boolean;
}

export function WikiConfigCard({ projectId, canManage }: Props) {
  const { data: config } = useWikiConfig(projectId);
  const upsert = useUpsertWikiConfig(projectId);
  const { generate, step, isActive } = useWikiGeneration(projectId);

  const [autoUpdate, setAutoUpdate] = useState('manual');
  const [sections, setSections] = useState<string[]>(ALL_SECTIONS);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (config && !initialized) {
      setAutoUpdate(config.autoUpdate);
      setSections(config.sections);
      setInitialized(true);
    }
  }, [config, initialized]);

  const toggleSection = (section: string) => {
    setSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section],
    );
  };

  const handleSave = () => {
    upsert.mutate({ autoUpdate, sections });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-blue-500" />
          <CardTitle>Wiki</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {config?.wikiPath && (
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Wiki Storage Path</Label>
            <p className="text-sm font-mono bg-muted px-2 py-1 rounded">{config.wikiPath}</p>
          </div>
        )}

        <div className="space-y-2">
          <Label>Auto-Update Mode</Label>
          <div className="flex gap-2">
            {AUTO_UPDATE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => canManage && setAutoUpdate(opt.value)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  autoUpdate === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
                disabled={!canManage}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Wiki Sections</Label>
          <div className="flex flex-wrap gap-2">
            {ALL_SECTIONS.map((section) => (
              <Badge
                key={section}
                variant={sections.includes(section) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => canManage && toggleSection(section)}
              >
                {sections.includes(section) ? '✓ ' : '+ '}
                {section}
              </Badge>
            ))}
          </div>
        </div>

        {config?.lastGeneratedAt && (
          <p className="text-xs text-muted-foreground">
            Last generated: {new Date(config.lastGeneratedAt).toLocaleString()}
          </p>
        )}

        {canManage && (
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
            <Button
              variant="outline"
              onClick={() => generate.mutate()}
              disabled={isActive || generate.isPending}
            >
              <RefreshCw className={`size-4 mr-2 ${isActive ? 'animate-spin' : ''}`} />
              {isActive ? `Generating (${step})...` : 'Generate Wiki Now'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/hooks/useWiki.ts apps/web/src/components/settings/WikiConfigCard.tsx
git commit -m "feat(wiki): remove wikiPath input from settings, show computed path as read-only"
```

---

### Task 7: Frontend — add active-job API call and recovery

**Files:**
- Modify: `apps/web/src/lib/api.ts:540-541`
- Modify: `apps/web/src/lib/types.ts:850-856`

- [ ] **Step 1: Add `ActiveWikiJob` type to `types.ts`**

In `apps/web/src/lib/types.ts`, add after the `WikiGenerationStatus` interface:

```typescript
export interface ActiveWikiJob {
  active: boolean;
  jobId?: string;
  status?: string;
  step?: string;
  sections?: string[];
}
```

- [ ] **Step 2: Add `getActiveWikiJob` to `api.ts`**

In `apps/web/src/lib/api.ts`, add after the `getWikiGenerationStatus` line (around line 541):

```typescript
  getActiveWikiJob: (projectId: string) =>
    request<ActiveWikiJob>(`/projects/${projectId}/wiki/generate/active`),
```

Make sure the `ActiveWikiJob` type is imported at the top of `api.ts` alongside the other Wiki types.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts
git commit -m "feat(wiki): add active-job API type and client call"
```

---

### Task 8: Frontend — fix `useWikiGeneration` hook with recovery and pre-populated sections

**Files:**
- Modify: `apps/web/src/hooks/useWikiGeneration.ts`

- [ ] **Step 1: Replace the entire `useWikiGeneration` hook**

Replace `apps/web/src/hooks/useWikiGeneration.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useSocket } from '../socket/useSocket';

type WikiGenerationStep =
  | 'idle'
  | 'queued'
  | 'pulling'
  | 'building-graph'
  | 'generating-sections'
  | string
  | 'writing-meta'
  | 'completed'
  | 'failed';

export interface SectionProgress {
  section: string;
  status: 'pending' | 'generating' | 'done' | 'error';
  agent?: string;
  pagesGenerated?: number;
  error?: string;
}

export function useWikiGeneration(projectId: string) {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [step, setStep] = useState<WikiGenerationStep>('idle');
  const [streamText, setStreamText] = useState('');
  const [sectionProgress, setSectionProgress] = useState<SectionProgress[]>([]);
  const [recovered, setRecovered] = useState(false);

  const isActive = !!jobId && step !== 'idle' && step !== 'completed' && step !== 'failed';

  const completedSections = sectionProgress.filter((s) => s.status === 'done').length;
  const totalSections = sectionProgress.length;

  // Recover active job on mount (handles page navigation + refresh)
  const { data: activeJob } = useQuery({
    queryKey: ['wiki-active-job', projectId],
    queryFn: () => api.getActiveWikiJob(projectId),
    enabled: !!projectId && !jobId && !recovered,
    staleTime: 0,
  });

  useEffect(() => {
    if (!activeJob || recovered) return;
    setRecovered(true);
    if (activeJob.active && activeJob.jobId) {
      setJobId(activeJob.jobId);
      setStep(activeJob.step ?? 'queued');
      // Pre-populate sections from the recovered job data
      if (activeJob.sections?.length) {
        setSectionProgress(
          activeJob.sections.map((s) => ({ section: s, status: 'pending' as const })),
        );
      }
    }
  }, [activeJob, recovered]);

  const generate = useMutation({
    mutationFn: (section?: string) => api.triggerWikiGeneration(projectId, section),
    onSuccess: (data) => {
      setJobId(data.jobId);
      setStep('queued');
      setStreamText('');
      // Pre-populate sections from wiki config (available via queryClient cache)
      const config = queryClient.getQueryData<{ sections: string[] }>(['wikiConfig', projectId]);
      if (config?.sections) {
        setSectionProgress(
          config.sections.map((s) => ({ section: s, status: 'pending' as const })),
        );
      } else {
        setSectionProgress([]);
      }
      toast.success('Wiki generation started');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to start wiki generation');
    },
  });

  // Polling fallback: check job status every 5s while in-progress
  const { data: statusData } = useQuery({
    queryKey: ['wiki-generation-status', projectId, jobId],
    queryFn: () => api.getWikiGenerationStatus(projectId, jobId!),
    enabled: isActive,
    refetchInterval: 5_000,
  });

  useEffect(() => {
    if (!statusData) return;
    if (statusData.step) setStep(statusData.step);
    if (statusData.streamText) setStreamText(statusData.streamText);
    if (statusData.status === 'completed') {
      setStep('completed');
      void queryClient.invalidateQueries({ queryKey: ['wikiPages', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['wikiConfig', projectId] });
    }
    if (statusData.status === 'failed') setStep('failed');
  }, [statusData, projectId, queryClient]);

  // Socket.IO listeners
  useEffect(() => {
    if (!socket || !jobId) return;

    const onProgress = (data: { jobId: string; step: string }) => {
      if (data.jobId === jobId) setStep(data.step);
    };
    const onStream = (data: { jobId: string; text: string }) => {
      if (data.jobId === jobId) setStreamText(data.text);
    };

    const onSectionStart = (data: { jobId: string; section: string; agent: string }) => {
      if (data.jobId !== jobId) return;
      setSectionProgress((prev) => {
        const exists = prev.find((s) => s.section === data.section);
        if (exists) {
          return prev.map((s) =>
            s.section === data.section ? { ...s, status: 'generating' as const, agent: data.agent } : s,
          );
        }
        return [...prev, { section: data.section, status: 'generating' as const, agent: data.agent }];
      });
    };

    const onSectionComplete = (data: {
      jobId: string;
      section: string;
      pagesGenerated: number;
      error?: string;
    }) => {
      if (data.jobId !== jobId) return;
      setSectionProgress((prev) =>
        prev.map((s) =>
          s.section === data.section
            ? {
                ...s,
                status: data.error ? ('error' as const) : ('done' as const),
                pagesGenerated: data.pagesGenerated,
                error: data.error,
              }
            : s,
        ),
      );
      // Refresh wiki tree as each section lands
      if (!data.error) {
        void queryClient.invalidateQueries({ queryKey: ['wikiPages', projectId] });
      }
    };

    const onCompleted = (data: { jobId: string }) => {
      if (data.jobId === jobId) {
        setStep('completed');
        void queryClient.invalidateQueries({ queryKey: ['wikiPages', projectId] });
        void queryClient.invalidateQueries({ queryKey: ['wikiConfig', projectId] });
        toast.success('Wiki generation completed');
      }
    };
    const onFailed = (data: { jobId: string; error: string }) => {
      if (data.jobId === jobId) {
        setStep('failed');
        toast.error(data.error || 'Wiki generation failed');
      }
    };

    socket.on('wiki-generation:progress', onProgress);
    socket.on('wiki-generation:stream', onStream);
    socket.on('wiki-generation:section-start', onSectionStart);
    socket.on('wiki-generation:section-complete', onSectionComplete);
    socket.on('wiki-generation:completed', onCompleted);
    socket.on('wiki-generation:failed', onFailed);

    return () => {
      socket.off('wiki-generation:progress', onProgress);
      socket.off('wiki-generation:stream', onStream);
      socket.off('wiki-generation:section-start', onSectionStart);
      socket.off('wiki-generation:section-complete', onSectionComplete);
      socket.off('wiki-generation:completed', onCompleted);
      socket.off('wiki-generation:failed', onFailed);
    };
  }, [socket, jobId, projectId, queryClient]);

  const reset = useCallback(() => {
    setJobId(null);
    setStep('idle');
    setStreamText('');
    setSectionProgress([]);
  }, []);

  return {
    generate,
    step,
    streamText,
    isActive,
    reset,
    sectionProgress,
    completedSections,
    totalSections,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/useWikiGeneration.ts
git commit -m "feat(wiki): add active-job recovery and pre-populate section progress"
```

---

### Task 9: Frontend — fix WikiPage banner to show during all active phases

**Files:**
- Modify: `apps/web/src/pages/WikiPage.tsx`

- [ ] **Step 1: Replace `WikiPage.tsx` with fixed banner logic**

Replace `apps/web/src/pages/WikiPage.tsx`:

```tsx
import { useState, useCallback } from 'react';
import { BookOpen, Loader2, RefreshCw, Settings } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUiStore } from '@/store/uiStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useWikiPages, useWikiConfig } from '@/hooks/useWiki';
import { useWikiGeneration } from '@/hooks/useWikiGeneration';
import { useAuth } from '@/auth/useAuth';
import { WikiTree } from '@/components/wiki/WikiTree';
import { WikiContent } from '@/components/wiki/WikiContent';
import { WikiChat } from '@/components/wiki/WikiChat';

const STEP_LABELS: Record<string, string> = {
  queued: 'Waiting in queue...',
  pulling: 'Pulling latest code...',
  'building-graph': 'Building code graph...',
  'generating-sections': 'Generating wiki sections...',
  'writing-meta': 'Finalizing...',
};

export function WikiPage() {
  const { projectPrefix = '' } = useParams<{ projectPrefix: string }>();
  const navigate = useNavigate();
  const projectId = useUiStore((s) => s.activeProjectId) ?? '';
  const { user } = useAuth();
  const { can } = usePermissions(projectId);

  const { data: tree = [], isLoading: treeLoading } = useWikiPages(projectId);
  const { data: config } = useWikiConfig(projectId);
  const { generate, step, isActive, sectionProgress, completedSections, totalSections } =
    useWikiGeneration(projectId);

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [scrollToSection, setScrollToSection] = useState<string | null>(null);

  const handleScrollToSection = useCallback((section: string) => {
    setScrollToSection(section);
  }, []);

  const handleSectionScrolled = useCallback(() => {
    setScrollToSection(null);
  }, []);

  const showSectionProgress = step === 'generating-sections' && totalSections > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-blue-500" />
          <h1 className="text-lg font-bold">Project Wiki</h1>
          {config?.lastGeneratedAt && (
            <Badge variant="outline" className="text-xs">
              {tree.reduce((acc, n) => acc + countFiles(n), 0)} pages
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {can('projectSettings', 'update') && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => generate.mutate()}
                disabled={isActive || generate.isPending}
              >
                <RefreshCw className={`size-3.5 mr-1.5 ${isActive ? 'animate-spin' : ''}`} />
                {isActive ? `${STEP_LABELS[step] ?? step}` : 'Refresh'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/projects/${projectPrefix}/settings?tab=wiki`)}
              >
                <Settings className="size-3.5 mr-1.5" />
                Settings
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Generation progress banner */}
      {isActive && (
        <div className="px-4 py-2 border-b bg-blue-50 dark:bg-blue-950/30 shrink-0">
          <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
            <Loader2 className="size-3.5 animate-spin" />
            <span className="font-medium">
              {showSectionProgress
                ? `Wiki is being generated — ${completedSections}/${totalSections} sections complete`
                : STEP_LABELS[step] ?? `Processing (${step})...`}
            </span>
          </div>
          {/* Progress bar */}
          {totalSections > 0 && (
            <div className="mt-1.5 h-1 bg-blue-100 dark:bg-blue-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${totalSections > 0 ? (completedSections / totalSections) * 100 : 0}%` }}
              />
            </div>
          )}
          {showSectionProgress && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {sectionProgress.map((sp) => (
                <Badge
                  key={sp.section}
                  variant={sp.status === 'done' ? 'default' : sp.status === 'error' ? 'destructive' : 'outline'}
                  className="text-xs"
                >
                  {sp.status === 'generating' && <Loader2 className="size-2.5 animate-spin mr-1" />}
                  {sp.section}
                  {sp.pagesGenerated ? ` (${sp.pagesGenerated})` : ''}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3-Panel Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Panel 1: Tree */}
        <div className="w-56 shrink-0">
          <WikiTree
            tree={tree}
            selectedPath={selectedPath}
            onSelectPage={setSelectedPath}
          />
        </div>

        {/* Panel 2: Content */}
        <div className="flex-1 min-w-0">
          <WikiContent
            projectId={projectId}
            pagePath={selectedPath}
            currentUserId={user?.id ?? ''}
            scrollToSection={scrollToSection}
            onSectionScrolled={handleSectionScrolled}
          />
        </div>

        {/* Panel 3: Chat */}
        <div className="w-80 shrink-0">
          <WikiChat
            projectId={projectId}
            currentPagePath={selectedPath}
            onScrollToSection={handleScrollToSection}
          />
        </div>
      </div>
    </div>
  );
}

function countFiles(node: { type: string; children?: any[] }): number {
  if (node.type === 'file') return 1;
  return node.children?.reduce((acc: number, c: any) => acc + countFiles(c), 0) ?? 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/WikiPage.tsx
git commit -m "feat(wiki): fix progress banner to show during all generation phases"
```

---

### Task 10: Verify build compiles

**Files:** None (verification only)

- [ ] **Step 1: Run backend TypeScript check**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Run frontend TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Run linter**

```bash
cd apps/api && npx eslint src/wiki src/wiki-config src/wiki-generation --ext .ts
cd apps/web && npx eslint src/pages/WikiPage.tsx src/hooks/useWikiGeneration.ts src/hooks/useWiki.ts src/components/settings/WikiConfigCard.tsx src/lib/types.ts src/lib/api.ts --ext .ts,.tsx
```

Expected: No errors or warnings.
