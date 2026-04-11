# Report Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automated project status reports with Email/Google Chat delivery, configurable scheduling, and progress tracking on tasks.

**Architecture:** New `ReportConfig` Prisma model stores per-project report settings. A `report-config` NestJS module handles CRUD + BullMQ repeatable job management. A `report-generator` module with a BullMQ processor queries tasks, builds formatted reports, and delivers via email/Google Chat webhook. Frontend gets a new `ReportSettingsCard` in the project settings page.

**Tech Stack:** NestJS, Prisma, BullMQ, nodemailer, React, TanStack Query, shadcn/ui

---

## File Structure

### New Files (Backend)
- `apps/api/src/report-config/report-config.module.ts` — Module registration
- `apps/api/src/report-config/report-config.controller.ts` — GET/PUT endpoints
- `apps/api/src/report-config/report-config.service.ts` — CRUD + BullMQ job management
- `apps/api/src/report-config/dto/upsert-report-config.dto.ts` — Validation DTO
- `apps/api/src/report-generator/report-generator.module.ts` — Module registration
- `apps/api/src/report-generator/report-generator.service.ts` — Report data gathering + formatting
- `apps/api/src/report-generator/report-generator.processor.ts` — BullMQ processor
- `apps/api/src/report-generator/google-chat.service.ts` — Google Chat webhook delivery

### New Files (Frontend)
- `apps/web/src/hooks/useReportConfig.ts` — React Query hooks
- `apps/web/src/components/settings/ReportSettingsCard.tsx` — Settings UI card

### Modified Files
- `apps/api/prisma/schema.prisma` — Add `progress` to Task/TimeLog, add `ReportConfig` model
- `apps/api/src/tasks/dto/update-task.dto.ts` — Add `progress` field
- `apps/api/src/time-logs/dto/create-time-log.dto.ts` — Add optional `progress` field
- `apps/api/src/time-logs/time-logs.service.ts` — Update task progress in transaction
- `apps/api/src/queue/queue.module.ts` — Register `report-generation` queue
- `apps/api/src/app.module.ts` — Register new modules
- `apps/web/src/lib/types.ts` — Add `ReportConfig` and payload types
- `apps/web/src/lib/api.ts` — Add report config API methods
- `apps/web/src/pages/ProjectSettingsPage.tsx` — Add `ReportSettingsCard`

---

### Task 1: Prisma Schema — Add progress fields and ReportConfig model

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add `progress` field to Task model**

In `apps/api/prisma/schema.prisma`, find the `Task` model and add `progress` after `subTaskSequence`:

```prisma
  progress          Int         @default(0)   // 0-100 percentage
```

- [ ] **Step 2: Add `progress` field to TimeLog model**

In the `TimeLog` model, add `progress` after `comment`:

```prisma
  progress    Int?      // snapshot of progress at time of logging
```

- [ ] **Step 3: Add ReportConfig model**

Add this model after the `WikiAnnotation` model (before the test case section):

```prisma
model ReportConfig {
  id                   String   @id @default(cuid())
  projectId            String   @unique

  emailEnabled         Boolean  @default(false)
  googleChatEnabled    Boolean  @default(false)
  googleChatWebhookUrl String?

  recipientMode        String   @default("all")
  recipientRoles       String[] @default([])
  recipientMembers     String[] @default([])

  frequency            String   @default("daily")
  scheduleDays         Int[]    @default([])
  scheduleTime         String   @default("09:00")
  timezone             String   @default("UTC")

  isActive             Boolean  @default(false)
  bullmqJobId          String?

  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  project              Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 4: Add relation on Project model**

In the `Project` model, add after `wikiAnnotations`:

```prisma
  reportConfig     ReportConfig?
```

- [ ] **Step 5: Run Prisma migration**

Run: `cd apps/api && npx prisma migrate dev --name add-report-config-and-progress`
Expected: Migration created and applied successfully.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat: add ReportConfig model and progress fields to Task/TimeLog"
```

---

### Task 2: Backend — Progress field support in DTOs and services

**Files:**
- Modify: `apps/api/src/tasks/dto/update-task.dto.ts`
- Modify: `apps/api/src/time-logs/dto/create-time-log.dto.ts`
- Modify: `apps/api/src/time-logs/time-logs.service.ts`

- [ ] **Step 1: Add progress to UpdateTaskDto**

In `apps/api/src/tasks/dto/update-task.dto.ts`, add after the `estimatedMinutes` field:

```typescript
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;
```

The imports `IsInt`, `Min`, `Max` are already present.

- [ ] **Step 2: Add progress to CreateTimeLogDto**

In `apps/api/src/time-logs/dto/create-time-log.dto.ts`, add after the `loggedAt` field:

```typescript
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;
```

Add `IsInt`, `Min`, `Max` to the import from `class-validator` (already has `IsInt`, `Min`, `Max`).

- [ ] **Step 3: Update TimeLogsService.create to set task progress**

In `apps/api/src/time-logs/time-logs.service.ts`, replace the `create` method body. The key change is wrapping the time log creation and task progress update in a `$transaction`:

Replace the existing `create` method (lines 14-57) with:

```typescript
  async create(projectId: string, taskId: string, userId: string, dto: CreateTimeLogDto) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true, taskKey: true, progress: true, _count: { select: { children: true } } },
    });

    if (!task || task.projectId !== projectId) {
      throw new NotFoundException('Task not found');
    }

    if (task._count.children > 0) {
      throw new BadRequestException('Cannot log time on a task that has sub-tasks. Log time on sub-tasks instead.');
    }

    const [timeLog] = await this.prisma.$transaction([
      this.prisma.timeLog.create({
        data: {
          minutes: dto.minutes,
          comment: dto.comment,
          loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : new Date(),
          progress: dto.progress,
          taskId,
          userId,
        },
        include: {
          user: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
        },
      }),
      ...(dto.progress !== undefined
        ? [
            this.prisma.task.update({
              where: { id: taskId },
              data: { progress: dto.progress },
            }),
          ]
        : []),
    ]);

    const hours = Math.floor(dto.minutes / 60);
    const mins = dto.minutes % 60;
    const formatted = hours > 0 ? (mins > 0 ? `${hours}h ${mins}m` : `${hours}h`) : `${mins}m`;

    const historyValue = `${formatted}${dto.comment ? ` — ${dto.comment}` : ''}${dto.progress !== undefined ? ` (progress: ${dto.progress}%)` : ''}`;

    await this.prisma.taskHistory.create({
      data: {
        taskId,
        actorId: userId,
        field: 'timeLog',
        oldValue: null,
        newValue: historyValue,
      },
    });

    this.notifications.notifyProject(projectId, 'task:updated', { projectId, taskId, task: { id: taskId } });

    return timeLog;
  }
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/tasks/dto/update-task.dto.ts apps/api/src/time-logs/dto/create-time-log.dto.ts apps/api/src/time-logs/time-logs.service.ts
git commit -m "feat: add progress field to task update and time log creation"
```

---

### Task 3: Backend — Register report-generation BullMQ queue

**Files:**
- Modify: `apps/api/src/queue/queue.module.ts`

- [ ] **Step 1: Add report-generation queue**

In `apps/api/src/queue/queue.module.ts`, add a third queue registration after the `notification-email` line:

```typescript
    BullModule.registerQueue({ name: 'report-generation' }),
```

The full imports array becomes:

```typescript
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: 'ai-jobs' }),
    BullModule.registerQueue({ name: 'notification-email' }),
    BullModule.registerQueue({ name: 'report-generation' }),
  ],
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/queue/queue.module.ts
git commit -m "feat: register report-generation BullMQ queue"
```

---

### Task 4: Backend — ReportConfig DTO

**Files:**
- Create: `apps/api/src/report-config/dto/upsert-report-config.dto.ts`

- [ ] **Step 1: Create the DTO**

```typescript
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsArray,
  IsInt,
  IsIn,
  Matches,
  Min,
  Max,
  ArrayMaxSize,
} from 'class-validator';

export class UpsertReportConfigDto {
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  googleChatEnabled?: boolean;

  @IsOptional()
  @IsString()
  googleChatWebhookUrl?: string;

  @IsOptional()
  @IsIn(['all', 'roles', 'members'])
  recipientMode?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipientRoles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipientMembers?: string[];

  @IsOptional()
  @IsIn(['daily', 'weekly', 'custom'])
  frequency?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @ArrayMaxSize(7)
  scheduleDays?: number[];

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'scheduleTime must be in HH:mm format' })
  scheduleTime?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/report-config/dto/upsert-report-config.dto.ts
git commit -m "feat: add UpsertReportConfigDto with validation"
```

---

### Task 5: Backend — ReportConfig Service

**Files:**
- Create: `apps/api/src/report-config/report-config.service.ts`

- [ ] **Step 1: Create the service**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertReportConfigDto } from './dto/upsert-report-config.dto';
import { encrypt, decrypt, maskToken } from '../common/encryption.util';

@Injectable()
export class ReportConfigService {
  private readonly logger = new Logger(ReportConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue('report-generation') private readonly reportQueue: Queue,
  ) {}

  private get encryptionKey(): string {
    return this.config.getOrThrow<string>('ENCRYPTION_KEY');
  }

  async findByProjectId(projectId: string) {
    const config = await this.prisma.reportConfig.findUnique({
      where: { projectId },
    });
    if (!config) return null;
    return {
      ...config,
      googleChatWebhookUrl: config.googleChatWebhookUrl
        ? maskToken(decrypt(config.googleChatWebhookUrl, this.encryptionKey))
        : null,
    };
  }

  async upsert(projectId: string, dto: UpsertReportConfigDto) {
    const data: Record<string, unknown> = {};

    if (dto.emailEnabled !== undefined) data.emailEnabled = dto.emailEnabled;
    if (dto.googleChatEnabled !== undefined) data.googleChatEnabled = dto.googleChatEnabled;
    if (dto.recipientMode !== undefined) data.recipientMode = dto.recipientMode;
    if (dto.recipientRoles !== undefined) data.recipientRoles = dto.recipientRoles;
    if (dto.recipientMembers !== undefined) data.recipientMembers = dto.recipientMembers;
    if (dto.frequency !== undefined) data.frequency = dto.frequency;
    if (dto.scheduleDays !== undefined) data.scheduleDays = dto.scheduleDays;
    if (dto.scheduleTime !== undefined) data.scheduleTime = dto.scheduleTime;
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (dto.googleChatWebhookUrl) {
      data.googleChatWebhookUrl = encrypt(dto.googleChatWebhookUrl, this.encryptionKey);
    }

    const serverTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const config = await this.prisma.reportConfig.upsert({
      where: { projectId },
      create: {
        projectId,
        timezone: serverTimezone,
        ...data,
      },
      update: data,
    });

    await this.syncSchedule(config.id, config);

    return {
      ...config,
      googleChatWebhookUrl: config.googleChatWebhookUrl
        ? maskToken(decrypt(config.googleChatWebhookUrl, this.encryptionKey))
        : null,
    };
  }

  async getServerTimezone() {
    return { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  }

  private async syncSchedule(
    configId: string,
    config: { isActive: boolean; frequency: string; scheduleDays: number[]; scheduleTime: string; timezone: string; bullmqJobId: string | null },
  ) {
    // Remove existing repeatable job
    if (config.bullmqJobId) {
      try {
        const removed = await this.reportQueue.removeRepeatableByKey(config.bullmqJobId);
        if (!removed) {
          this.logger.warn(`Could not remove repeatable job key: ${config.bullmqJobId}`);
        }
      } catch (err) {
        this.logger.warn(`Error removing repeatable job: ${err}`);
      }
    }

    if (!config.isActive) {
      await this.prisma.reportConfig.update({
        where: { id: configId },
        data: { bullmqJobId: null },
      });
      return;
    }

    const cron = this.buildCron(config.frequency, config.scheduleDays, config.scheduleTime);

    const job = await this.reportQueue.add(
      'generate-report',
      { reportConfigId: configId },
      {
        repeat: { pattern: cron, tz: config.timezone },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    const repeatJobKey = job.repeatJobKey;

    await this.prisma.reportConfig.update({
      where: { id: configId },
      data: { bullmqJobId: repeatJobKey ?? null },
    });
  }

  private buildCron(frequency: string, days: number[], time: string): string {
    const [hour, minute] = time.split(':');
    switch (frequency) {
      case 'daily':
        return `${minute} ${hour} * * *`;
      case 'weekly':
        return `${minute} ${hour} * * ${days.length > 0 ? days[0] : 1}`;
      case 'custom':
        return `${minute} ${hour} * * ${days.join(',')}`;
      default:
        return `${minute} ${hour} * * *`;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/report-config/report-config.service.ts
git commit -m "feat: add ReportConfigService with BullMQ schedule management"
```

---

### Task 6: Backend — ReportConfig Controller

**Files:**
- Create: `apps/api/src/report-config/report-config.controller.ts`

- [ ] **Step 1: Create the controller**

```typescript
import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ReportConfigService } from './report-config.service';
import { UpsertReportConfigDto } from './dto/upsert-report-config.dto';

@Controller('projects/:projectId/settings/report')
@UseGuards(JwtAuthGuard)
export class ReportConfigController {
  constructor(private readonly service: ReportConfigService) {}

  @Get()
  @UseGuards(ProjectRolesGuard)
  findOne(@Param('projectId') projectId: string) {
    return this.service.findByProjectId(projectId);
  }

  @Put()
  @UseGuards(ProjectRolesGuard)
  @RequirePermission('projectSettings', 'update')
  upsert(
    @Param('projectId') projectId: string,
    @Body() dto: UpsertReportConfigDto,
  ) {
    return this.service.upsert(projectId, dto);
  }

  @Get('server-timezone')
  @UseGuards(ProjectRolesGuard)
  getServerTimezone() {
    return this.service.getServerTimezone();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/report-config/report-config.controller.ts
git commit -m "feat: add ReportConfigController with GET/PUT endpoints"
```

---

### Task 7: Backend — ReportConfig Module

**Files:**
- Create: `apps/api/src/report-config/report-config.module.ts`

- [ ] **Step 1: Create the module**

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReportConfigController } from './report-config.controller';
import { ReportConfigService } from './report-config.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'report-generation' })],
  controllers: [ReportConfigController],
  providers: [ReportConfigService],
  exports: [ReportConfigService],
})
export class ReportConfigModule {}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/report-config/report-config.module.ts
git commit -m "feat: add ReportConfigModule"
```

---

### Task 8: Backend — Google Chat Delivery Service

**Files:**
- Create: `apps/api/src/report-generator/google-chat.service.ts`

- [ ] **Step 1: Create the service**

```typescript
import { Injectable, Logger } from '@nestjs/common';

interface ReportMemberData {
  name: string;
  avgProgress: number;
  tasks: { taskKey: string; title: string; statusName: string; progress: number }[];
}

interface ReportData {
  projectName: string;
  date: string;
  totalTasks: number;
  totalMembers: number;
  avgProgress: number;
  statusSummary: Record<string, number>;
  members: ReportMemberData[];
}

@Injectable()
export class GoogleChatService {
  private readonly logger = new Logger(GoogleChatService.name);

  async send(webhookUrl: string, report: ReportData): Promise<void> {
    const sections = [
      {
        header: `📊 ${report.projectName} — ${report.date}`,
        widgets: [
          {
            textParagraph: {
              text: `<b>📈 Overview</b>\nTasks: ${report.totalTasks} · Members: ${report.totalMembers} · Avg Progress: ${report.avgProgress}%\n${Object.entries(report.statusSummary).map(([k, v]) => `${k}: ${v}`).join(' · ')}`,
            },
          },
        ],
      },
      ...report.members.map((member) => ({
        header: `👤 ${member.name} — Avg: ${member.avgProgress}%`,
        widgets: [
          {
            textParagraph: {
              text: member.tasks
                .map((t) => `• <b>${t.taskKey}</b> ${t.title} (${t.statusName}) ${t.progress}%`)
                .join('\n'),
            },
          },
        ],
      })),
    ];

    const body = {
      cardsV2: [
        {
          cardId: 'report',
          card: { sections },
        },
      ],
    };

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Google Chat webhook failed: ${res.status} ${text}`);
      }
    } catch (err) {
      this.logger.error(`Google Chat webhook error: ${err}`);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/report-generator/google-chat.service.ts
git commit -m "feat: add GoogleChatService for webhook delivery"
```

---

### Task 9: Backend — Report Generator Service

**Files:**
- Create: `apps/api/src/report-generator/report-generator.service.ts`

- [ ] **Step 1: Create the service**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ReportTaskData {
  taskKey: string;
  title: string;
  statusName: string;
  progress: number;
}

export interface ReportMemberData {
  name: string;
  avgProgress: number;
  tasks: ReportTaskData[];
}

export interface ReportData {
  projectName: string;
  date: string;
  totalTasks: number;
  totalMembers: number;
  avgProgress: number;
  statusSummary: Record<string, number>;
  members: ReportMemberData[];
}

@Injectable()
export class ReportGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(projectId: string): Promise<ReportData> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { name: true },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Fetch tasks: in progress (progress < 100) OR completed today
    const tasks = await this.prisma.task.findMany({
      where: {
        projectId,
        isDraft: false,
        assigneeId: { not: null },
        OR: [
          { progress: { lt: 100 } },
          {
            workflowStatus: { isClosed: true },
            actualEndDate: { gte: today, lt: tomorrow },
          },
        ],
      },
      include: {
        assignee: { select: { id: true, name: true, username: true } },
        workflowStatus: { select: { name: true } },
      },
    });

    // Group by assignee
    const memberMap = new Map<string, { name: string; tasks: ReportTaskData[] }>();
    const statusCounts: Record<string, number> = {};

    for (const task of tasks) {
      if (!task.assignee) continue;

      const memberId = task.assignee.id;
      const memberName = task.assignee.name ?? task.assignee.username;

      if (!memberMap.has(memberId)) {
        memberMap.set(memberId, { name: memberName, tasks: [] });
      }

      const statusName = task.workflowStatus?.name ?? 'No Status';
      statusCounts[statusName] = (statusCounts[statusName] ?? 0) + 1;

      memberMap.get(memberId)!.tasks.push({
        taskKey: task.taskKey ?? task.id.slice(0, 8),
        title: task.title,
        statusName,
        progress: task.progress,
      });
    }

    const members: ReportMemberData[] = Array.from(memberMap.values()).map((m) => ({
      name: m.name,
      avgProgress: m.tasks.length > 0
        ? Math.round(m.tasks.reduce((sum, t) => sum + t.progress, 0) / m.tasks.length)
        : 0,
      tasks: m.tasks,
    }));

    const allProgresses = tasks.map((t) => t.progress);
    const avgProgress = allProgresses.length > 0
      ? Math.round(allProgresses.reduce((a, b) => a + b, 0) / allProgresses.length)
      : 0;

    const dateStr = today.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    return {
      projectName: project.name,
      date: dateStr,
      totalTasks: tasks.length,
      totalMembers: members.length,
      avgProgress,
      statusSummary: statusCounts,
      members,
    };
  }

  formatAsMarkdown(report: ReportData): string {
    const lines: string[] = [];
    lines.push(`📊 ${report.projectName} — ${report.date}`);
    lines.push('');
    lines.push('📈 Overview');
    lines.push(`   Tasks: ${report.totalTasks} · Members: ${report.totalMembers} · Avg Progress: ${report.avgProgress}%`);
    lines.push(`   ${Object.entries(report.statusSummary).map(([k, v]) => `${k}: ${v}`).join(' · ')}`);
    lines.push('');

    for (const member of report.members) {
      lines.push(`👤 ${member.name} — Avg: ${member.avgProgress}%`);
      for (const task of member.tasks) {
        lines.push(`   • ${task.taskKey} ${task.title} (${task.statusName}) ${task.progress}%`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  formatAsHtml(report: ReportData): string {
    const statusLine = Object.entries(report.statusSummary)
      .map(([k, v]) => `${k}: <strong>${v}</strong>`)
      .join(' &middot; ');

    const memberSections = report.members
      .map((m) => {
        const taskRows = m.tasks
          .map(
            (t) =>
              `<tr>
                <td style="padding:4px 8px;font-family:monospace;font-size:13px;color:#6366f1">${t.taskKey}</td>
                <td style="padding:4px 8px">${t.title}</td>
                <td style="padding:4px 8px;color:#f59e0b">${t.statusName}</td>
                <td style="padding:4px 8px;text-align:right">
                  <span style="color:#3b82f6;font-weight:600">${t.progress}%</span>
                </td>
              </tr>`,
          )
          .join('');

        return `
          <div style="margin-bottom:20px">
            <h3 style="margin:0 0 8px 0;font-size:15px">👤 ${m.name} — <span style="color:#888">Avg: ${m.avgProgress}%</span></h3>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              ${taskRows}
            </table>
          </div>`;
      })
      .join('');

    return `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:700px;margin:0 auto;color:#e0e0e0;background:#1a1a2e;padding:24px;border-radius:12px">
        <h2 style="margin:0 0 4px 0;font-size:18px">📊 ${report.projectName}</h2>
        <p style="margin:0 0 16px 0;color:#888;font-size:13px">${report.date}</p>
        <div style="background:#16213e;padding:12px 16px;border-radius:8px;margin-bottom:20px">
          <p style="margin:0 0 4px 0;font-weight:600">📈 Overview</p>
          <p style="margin:0;font-size:14px">Tasks: <strong>${report.totalTasks}</strong> &middot; Members: <strong>${report.totalMembers}</strong> &middot; Avg Progress: <strong>${report.avgProgress}%</strong></p>
          <p style="margin:4px 0 0 0;font-size:13px;color:#aaa">${statusLine}</p>
        </div>
        ${memberSections}
        <p style="margin:16px 0 0 0;font-size:11px;color:#666;text-align:center">Generated by PulseTrack</p>
      </div>`;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/report-generator/report-generator.service.ts
git commit -m "feat: add ReportGeneratorService with data gathering and formatting"
```

---

### Task 10: Backend — Report Generator Processor (BullMQ)

**Files:**
- Create: `apps/api/src/report-generator/report-generator.processor.ts`

- [ ] **Step 1: Create the processor**

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ReportGeneratorService } from './report-generator.service';
import { GoogleChatService } from './google-chat.service';
import { decrypt } from '../common/encryption.util';
import * as nodemailer from 'nodemailer';

@Processor('report-generation', { concurrency: 3 })
export class ReportGeneratorProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportGeneratorProcessor.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly reportGenerator: ReportGeneratorService,
    private readonly googleChat: GoogleChatService,
  ) {
    super();
    this.transporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST'),
      port: parseInt(this.config.get('SMTP_PORT', '587'), 10),
      secure: this.config.get('SMTP_SECURE') === 'true',
      auth: {
        user: this.config.get('SMTP_USER'),
        pass: this.config.get('SMTP_PASS'),
      },
    });
  }

  async process(job: Job<{ reportConfigId: string }>) {
    const { reportConfigId } = job.data;
    this.logger.log(`Processing report for config: ${reportConfigId}`);

    const reportConfig = await this.prisma.reportConfig.findUnique({
      where: { id: reportConfigId },
      include: { project: { select: { id: true, name: true } } },
    });

    if (!reportConfig || !reportConfig.isActive) {
      this.logger.warn(`Report config ${reportConfigId} not found or inactive`);
      return;
    }

    const report = await this.reportGenerator.generate(reportConfig.projectId);

    if (report.totalTasks === 0) {
      this.logger.log(`No tasks to report for project: ${reportConfig.project.name}`);
      return;
    }

    // Save report to history
    const reportType = reportConfig.frequency === 'weekly' ? 'weekly' : 'daily';
    await this.prisma.report.create({
      data: {
        type: reportType,
        content: this.reportGenerator.formatAsMarkdown(report),
        projectId: reportConfig.projectId,
      },
    });

    // Deliver via email
    if (reportConfig.emailEnabled) {
      await this.deliverEmail(reportConfig, report);
    }

    // Deliver via Google Chat
    if (reportConfig.googleChatEnabled && reportConfig.googleChatWebhookUrl) {
      const encryptionKey = this.config.getOrThrow<string>('ENCRYPTION_KEY');
      const webhookUrl = decrypt(reportConfig.googleChatWebhookUrl, encryptionKey);
      await this.googleChat.send(webhookUrl, report);
    }

    this.logger.log(`Report delivered for project: ${reportConfig.project.name}`);
  }

  private async deliverEmail(
    reportConfig: {
      projectId: string;
      recipientMode: string;
      recipientRoles: string[];
      recipientMembers: string[];
      project: { id: string; name: string };
    },
    report: ReturnType<ReportGeneratorService['formatAsHtml']> extends string ? Parameters<typeof this.sendEmail>[2] extends infer R ? R : never : never,
  ) {
    const recipients = await this.resolveRecipients(
      reportConfig.projectId,
      reportConfig.recipientMode,
      reportConfig.recipientRoles,
      reportConfig.recipientMembers,
    );

    const html = this.reportGenerator.formatAsHtml(report as any);
    const subject = `📊 ${reportConfig.project.name} — ${(report as any).date} Report`;

    for (const recipient of recipients) {
      await this.sendEmail(recipient.email, subject, html);
    }
  }

  private async resolveRecipients(
    projectId: string,
    mode: string,
    roleIds: string[],
    memberIds: string[],
  ): Promise<{ email: string; name: string }[]> {
    let where: Record<string, unknown> = { projectId };

    if (mode === 'roles' && roleIds.length > 0) {
      where = { ...where, roleId: { in: roleIds } };
    } else if (mode === 'members' && memberIds.length > 0) {
      where = { ...where, id: { in: memberIds } };
    }
    // mode === 'all' uses just projectId filter

    const members = await this.prisma.projectMember.findMany({
      where,
      include: {
        user: { select: { email: true, name: true, username: true } },
      },
    });

    return members.map((m) => ({
      email: m.user.email,
      name: m.user.name ?? m.user.username,
    }));
  }

  private async sendEmail(to: string, subject: string, html: string) {
    try {
      const from = this.config.get('SMTP_FROM', 'PulseTrack <noreply@pulsetrack.com>');
      await this.transporter.sendMail({ from, to, subject, html });
    } catch (err) {
      this.logger.error(`Failed to send report email to ${to}: ${err}`);
    }
  }
}
```

- [ ] **Step 2: Fix the typing for deliverEmail**

The `deliverEmail` method has complex inferred types. Simplify it by importing `ReportData`:

Replace the `deliverEmail` method signature with:

```typescript
  private async deliverEmail(
    reportConfig: {
      projectId: string;
      recipientMode: string;
      recipientRoles: string[];
      recipientMembers: string[];
      project: { id: string; name: string };
    },
    report: import('./report-generator.service').ReportData,
  ) {
```

Actually, since the import is at the top, use the already-imported type. The full corrected `deliverEmail`:

```typescript
  private async deliverEmail(
    reportConfig: {
      projectId: string;
      recipientMode: string;
      recipientRoles: string[];
      recipientMembers: string[];
      project: { id: string; name: string };
    },
    report: ReportData,
  ) {
    const recipients = await this.resolveRecipients(
      reportConfig.projectId,
      reportConfig.recipientMode,
      reportConfig.recipientRoles,
      reportConfig.recipientMembers,
    );

    const html = this.reportGenerator.formatAsHtml(report);
    const subject = `📊 ${reportConfig.project.name} — ${report.date} Report`;

    for (const recipient of recipients) {
      await this.sendEmail(recipient.email, subject, html);
    }
  }
```

Add `ReportData` to the import from `report-generator.service`:

```typescript
import { ReportGeneratorService, ReportData } from './report-generator.service';
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/report-generator/report-generator.processor.ts
git commit -m "feat: add ReportGeneratorProcessor for scheduled report delivery"
```

---

### Task 11: Backend — Report Generator Module

**Files:**
- Create: `apps/api/src/report-generator/report-generator.module.ts`

- [ ] **Step 1: Create the module**

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReportGeneratorService } from './report-generator.service';
import { ReportGeneratorProcessor } from './report-generator.processor';
import { GoogleChatService } from './google-chat.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'report-generation' })],
  providers: [ReportGeneratorService, ReportGeneratorProcessor, GoogleChatService],
  exports: [ReportGeneratorService],
})
export class ReportGeneratorModule {}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/report-generator/report-generator.module.ts
git commit -m "feat: add ReportGeneratorModule"
```

---

### Task 12: Backend — Register new modules in AppModule

**Files:**
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Add imports**

Add these two import lines after the `WikiModule` import (line 35):

```typescript
import { ReportConfigModule } from './report-config/report-config.module';
import { ReportGeneratorModule } from './report-generator/report-generator.module';
```

- [ ] **Step 2: Register in imports array**

Add these two entries to the `@Module` imports array, after `WikiModule`:

```typescript
    ReportConfigModule,
    ReportGeneratorModule,
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/app.module.ts
git commit -m "feat: register ReportConfigModule and ReportGeneratorModule"
```

---

### Task 13: Frontend — Types and API client

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Add types to types.ts**

Add these at the end of `apps/web/src/lib/types.ts`, before the closing (after the `ActiveWikiJob` interface):

```typescript
// ─── Report Config ──────────────────────────────────────────────────────
export interface ReportConfig {
  id: string;
  projectId: string;
  emailEnabled: boolean;
  googleChatEnabled: boolean;
  googleChatWebhookUrl: string | null;
  recipientMode: string;
  recipientRoles: string[];
  recipientMembers: string[];
  frequency: string;
  scheduleDays: number[];
  scheduleTime: string;
  timezone: string;
  isActive: boolean;
}

export interface UpsertReportConfigPayload {
  emailEnabled?: boolean;
  googleChatEnabled?: boolean;
  googleChatWebhookUrl?: string;
  recipientMode?: string;
  recipientRoles?: string[];
  recipientMembers?: string[];
  frequency?: string;
  scheduleDays?: number[];
  scheduleTime?: string;
  timezone?: string;
  isActive?: boolean;
}
```

Also add `progress` to the `Task` interface. In the `Task` interface, add after `actualEndDate`:

```typescript
  progress?: number;
```

Add `progress` to `UpdateTaskPayload` after `estimatedMinutes`:

```typescript
  progress?: number;
```

Add `progress` to `CreateTimeLogPayload` after `loggedAt`:

```typescript
  progress?: number;
```

Add `progress` to `TimeLog` interface after `userId`:

```typescript
  progress?: number | null;
```

- [ ] **Step 2: Add API methods to api.ts**

In `apps/web/src/lib/api.ts`, first add imports. At the top import block, add `ReportConfig` and `UpsertReportConfigPayload` to the import from `'./types'`.

Then add these methods to the `api` object, after the AI Config section (around line 329):

```typescript
  // ─── Report Config ──────────────────────────────────────────────────────────
  getReportConfig: (projectId: string) =>
    request<ReportConfig | null>(`/projects/${projectId}/settings/report`),
  upsertReportConfig: (projectId: string, data: UpsertReportConfigPayload) =>
    request<ReportConfig>(`/projects/${projectId}/settings/report`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getServerTimezone: (projectId: string) =>
    request<{ timezone: string }>(`/projects/${projectId}/settings/report/server-timezone`),
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts
git commit -m "feat: add report config types and API client methods"
```

---

### Task 14: Frontend — useReportConfig hook

**Files:**
- Create: `apps/web/src/hooks/useReportConfig.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { UpsertReportConfigPayload } from '../lib/types';

export function useReportConfig(projectId: string) {
  return useQuery({
    queryKey: ['reportConfig', projectId],
    queryFn: () => api.getReportConfig(projectId),
    enabled: !!projectId,
  });
}

export function useUpsertReportConfig(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertReportConfigPayload) =>
      api.upsertReportConfig(projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reportConfig', projectId] });
      toast.success('Report settings saved');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save report settings');
    },
  });
}

export function useServerTimezone(projectId: string) {
  return useQuery({
    queryKey: ['serverTimezone'],
    queryFn: () => api.getServerTimezone(projectId),
    enabled: !!projectId,
    staleTime: Infinity,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/useReportConfig.ts
git commit -m "feat: add useReportConfig hooks"
```

---

### Task 15: Frontend — ReportSettingsCard component

**Files:**
- Create: `apps/web/src/components/settings/ReportSettingsCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState, useEffect } from 'react';
import { FileText, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useReportConfig, useUpsertReportConfig, useServerTimezone } from '@/hooks/useReportConfig';
import { useMembers } from '@/hooks/useMembers';
import { useRoles } from '@/hooks/useRoles';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  projectId: string;
  canManage: boolean;
}

export function ReportSettingsCard({ projectId, canManage }: Props) {
  const { data: config } = useReportConfig(projectId);
  const { data: serverTz } = useServerTimezone(projectId);
  const { data: members } = useMembers(projectId);
  const { data: roles } = useRoles(projectId);
  const upsert = useUpsertReportConfig(projectId);

  const [isActive, setIsActive] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [googleChatEnabled, setGoogleChatEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [showWebhook, setShowWebhook] = useState(false);
  const [recipientMode, setRecipientMode] = useState('all');
  const [recipientRoles, setRecipientRoles] = useState<string[]>([]);
  const [recipientMembers, setRecipientMembers] = useState<string[]>([]);
  const [frequency, setFrequency] = useState('daily');
  const [scheduleDays, setScheduleDays] = useState<number[]>([1]); // Mon
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (config && !initialized) {
      setIsActive(config.isActive);
      setEmailEnabled(config.emailEnabled);
      setGoogleChatEnabled(config.googleChatEnabled);
      setWebhookUrl('');
      setRecipientMode(config.recipientMode);
      setRecipientRoles(config.recipientRoles);
      setRecipientMembers(config.recipientMembers);
      setFrequency(config.frequency);
      setScheduleDays(config.scheduleDays);
      setScheduleTime(config.scheduleTime);
      setInitialized(true);
    }
  }, [config, initialized]);

  const toggleDay = (day: number) => {
    setScheduleDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  const toggleRole = (roleId: string) => {
    setRecipientRoles((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId],
    );
  };

  const toggleMember = (memberId: string) => {
    setRecipientMembers((prev) =>
      prev.includes(memberId) ? prev.filter((m) => m !== memberId) : [...prev, memberId],
    );
  };

  const handleSave = () => {
    upsert.mutate({
      isActive,
      emailEnabled,
      googleChatEnabled,
      ...(webhookUrl ? { googleChatWebhookUrl: webhookUrl } : {}),
      recipientMode,
      recipientRoles,
      recipientMembers,
      frequency,
      scheduleDays,
      scheduleTime,
    });
    setInitialized(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-blue-500" />
            <CardTitle>Report Settings</CardTitle>
          </div>
          {canManage && (
            <label className="flex items-center gap-2 text-sm">
              <span className={isActive ? 'text-green-500 font-medium' : 'text-muted-foreground'}>
                {isActive ? 'Active' : 'Inactive'}
              </span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={!canManage}
              />
            </label>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Channels */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Channels</Label>

          {/* Email */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
                disabled={!canManage}
              />
              Email
            </label>

            {emailEnabled && (
              <div className="ml-6 space-y-2">
                <Label className="text-xs">Recipients</Label>
                <Select
                  value={recipientMode}
                  onValueChange={setRecipientMode}
                  disabled={!canManage}
                >
                  <SelectTrigger className="max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Members</SelectItem>
                    <SelectItem value="roles">By Roles</SelectItem>
                    <SelectItem value="members">Specific Members</SelectItem>
                  </SelectContent>
                </Select>

                {recipientMode === 'roles' && roles && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {roles.map((role) => (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => toggleRole(role.id)}
                        disabled={!canManage}
                        className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                          recipientRoles.includes(role.id)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                        }`}
                      >
                        {role.name}
                      </button>
                    ))}
                  </div>
                )}

                {recipientMode === 'members' && members && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {members.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => toggleMember(member.id)}
                        disabled={!canManage}
                        className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                          recipientMembers.includes(member.id)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                        }`}
                      >
                        {member.user.name ?? member.user.username}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Google Chat */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={googleChatEnabled}
                onChange={(e) => setGoogleChatEnabled(e.target.checked)}
                disabled={!canManage}
              />
              Google Chat
            </label>

            {googleChatEnabled && (
              <div className="ml-6">
                <Label className="text-xs">Webhook URL</Label>
                <div className="relative mt-1">
                  <Input
                    type={showWebhook ? 'text' : 'password'}
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder={config?.googleChatWebhookUrl || 'https://chat.googleapis.com/v1/spaces/...'}
                    disabled={!canManage}
                    className="pr-10 max-w-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWebhook(!showWebhook)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showWebhook ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Schedule */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Schedule</Label>

          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div className="space-y-1">
              <Label className="text-xs">Frequency</Label>
              <Select
                value={frequency}
                onValueChange={setFrequency}
                disabled={!canManage}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Time</Label>
              <Input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                disabled={!canManage}
              />
            </div>
          </div>

          {(frequency === 'weekly' || frequency === 'custom') && (
            <div className="space-y-1">
              <Label className="text-xs">
                {frequency === 'weekly' ? 'Day' : 'Days'}
              </Label>
              <div className="flex gap-1">
                {DAYS.map((day, i) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      if (frequency === 'weekly') {
                        setScheduleDays([i]);
                      } else {
                        toggleDay(i);
                      }
                    }}
                    disabled={!canManage}
                    className={`w-10 h-8 text-xs rounded border transition-colors ${
                      scheduleDays.includes(i)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Timezone: {serverTz?.timezone ?? config?.timezone ?? 'Loading...'}
          </p>
        </div>

        {canManage && (
          <Button
            onClick={handleSave}
            disabled={upsert.isPending}
            size="sm"
          >
            {upsert.isPending ? 'Saving...' : 'Save Report Settings'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/settings/ReportSettingsCard.tsx
git commit -m "feat: add ReportSettingsCard component"
```

---

### Task 16: Frontend — Integrate ReportSettingsCard into ProjectSettingsPage

**Files:**
- Modify: `apps/web/src/pages/ProjectSettingsPage.tsx`

- [ ] **Step 1: Add import**

Add this import after the `AiConfigCard` import (line 16):

```typescript
import { ReportSettingsCard } from '@/components/settings/ReportSettingsCard';
```

- [ ] **Step 2: Add the card to the page**

In the `TabsContent value="general"` section, add the `ReportSettingsCard` after the `AiConfigCard` (after line 231):

```tsx
          {/* Report Settings Card */}
          <ReportSettingsCard projectId={projectId} canManage={canManage} />
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/ProjectSettingsPage.tsx
git commit -m "feat: add ReportSettingsCard to project settings page"
```

---

### Task 17: Verify hooks exist — useMembers and useRoles

**Files:**
- Verify: `apps/web/src/hooks/useMembers.ts` (or wherever members hook lives)
- Verify: `apps/web/src/hooks/useRoles.ts` (or wherever roles hook lives)

The `ReportSettingsCard` imports `useMembers` and `useRoles`. These should already exist in the codebase since members and roles are used elsewhere.

- [ ] **Step 1: Verify useMembers hook exists**

Run: `grep -r "export function useMembers" apps/web/src/hooks/`

If it doesn't exist, check `apps/web/src/hooks/useProjects.ts` or similar — the hook may be named differently (e.g., `useProjectMembers`). If the name differs, update the import in `ReportSettingsCard.tsx` to match.

- [ ] **Step 2: Verify useRoles hook exists**

Run: `grep -r "export function useRoles" apps/web/src/hooks/`

If it doesn't exist, check for `useCustomRoles` or similar. The hook needs to return the project's custom roles array. If the name differs, update the import in `ReportSettingsCard.tsx`.

- [ ] **Step 3: Fix imports if needed and commit**

If any import names were adjusted:

```bash
git add apps/web/src/components/settings/ReportSettingsCard.tsx
git commit -m "fix: correct hook imports in ReportSettingsCard"
```

---

### Task 18: Build verification

- [ ] **Step 1: Run Prisma generate**

Run: `cd apps/api && npx prisma generate`
Expected: Prisma Client generated successfully.

- [ ] **Step 2: Build backend**

Run: `cd apps/api && npx nest build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Build frontend**

Run: `cd apps/web && npx vite build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Fix any build errors and commit**

If there are errors, fix them and commit:

```bash
git add -A
git commit -m "fix: resolve build errors in report settings feature"
```

---

### Task 19: Final integration commit

- [ ] **Step 1: Verify all files are committed**

Run: `git status`
Expected: Clean working tree on `develop` branch.

- [ ] **Step 2: If any uncommitted changes remain, commit them**

```bash
git add -A
git commit -m "feat: complete report settings feature implementation"
```
