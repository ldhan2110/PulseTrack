# WBS + Gantt Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a WBS module with interactive Gantt chart to PulseTrack, enabling PMs to create Phase → Task → Subtask hierarchies with planned/actual dates, auto-rollup, and backlog linking.

**Architecture:** Standalone NestJS module (`WbsModule`) decoupled from the existing Planner module, with new Prisma models, REST endpoints, and a React frontend using `gantt-task-react`. The sidebar "Project Planner" becomes a collapsible sub-menu with "Scope Definition" and "WBS" children.

**Tech Stack:** NestJS, Prisma/PostgreSQL, React 19, gantt-task-react, shadcn/ui, TanStack React Query, Zustand, dnd-kit, Tailwind CSS

---

## File Structure

### Backend (`apps/api/src/wbs/`)

| File | Responsibility |
|------|----------------|
| `wbs.module.ts` | Module definition |
| `wbs.controller.ts` | REST endpoints for phases, tasks, subtasks |
| `wbs.service.ts` | CRUD + rollup calculations |
| `wbs-dependency.controller.ts` | Dependency endpoints |
| `wbs-dependency.service.ts` | Dependency CRUD + validation |
| `wbs-backlog.controller.ts` | Backlog linking endpoints |
| `wbs-backlog.service.ts` | Leaf-node validation + linking |
| `dto/create-phase.dto.ts` | Phase creation validation |
| `dto/update-phase.dto.ts` | Phase update validation |
| `dto/create-task.dto.ts` | Task creation validation |
| `dto/update-task.dto.ts` | Task update validation |
| `dto/create-subtask.dto.ts` | Subtask creation validation |
| `dto/update-subtask.dto.ts` | Subtask update validation |
| `dto/create-dependency.dto.ts` | Dependency creation validation |
| `dto/link-backlog.dto.ts` | Backlog linking validation |
| `dto/reorder.dto.ts` | Reorder validation (reuse pattern) |

### Frontend

| File | Responsibility |
|------|----------------|
| `apps/web/src/pages/WbsPage.tsx` | Main WBS page |
| `apps/web/src/components/wbs/WbsToolbar.tsx` | Toolbar: Add Phase, View Options |
| `apps/web/src/components/wbs/WbsViewToggle.tsx` | Gantt / Table view switch |
| `apps/web/src/components/wbs/WbsTaskTree.tsx` | Left panel: hierarchical tree table |
| `apps/web/src/components/wbs/WbsTaskRow.tsx` | Row in tree table (phase/task/subtask) |
| `apps/web/src/components/wbs/WbsGanttChart.tsx` | Right panel: gantt-task-react wrapper |
| `apps/web/src/components/wbs/WbsTaskDialog.tsx` | Create/edit dialog |
| `apps/web/src/components/wbs/WbsBacklogLink.tsx` | Backlog linking UI |
| `apps/web/src/components/wbs/WbsStatusBar.tsx` | Bottom bar: counts + progress |
| `apps/web/src/components/wbs/WbsTableView.tsx` | Full-width table alternative |
| `apps/web/src/hooks/useWbs.ts` | React Query hooks for all WBS data |
| `apps/web/src/lib/types.ts` | WBS type definitions (append) |
| `apps/web/src/lib/api.ts` | WBS API functions (append) |

### Modified Files

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Add WBS models + enums |
| `apps/api/src/app.module.ts` | Register WbsModule |
| `apps/web/src/App.tsx` | Add WBS route |
| `apps/web/src/components/layout/AppSidebar.tsx` | Collapsible Project Planner sub-menu |

---

## Task 1: Prisma Schema — WBS Models

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (append after line 924)

- [ ] **Step 1: Add WBS enums and models to schema**

Append the following to the end of `apps/api/prisma/schema.prisma`:

```prisma
// =====================
// WBS (Work Breakdown Structure)
// =====================

enum WbsDependencyType {
  FINISH_TO_START
}

enum WbsNodeType {
  TASK
  SUBTASK
}

model WbsPhase {
  id          String    @id @default(cuid())
  projectId   String
  title       String
  description String?
  position    Int
  planStart   DateTime?
  planEnd     DateTime?
  actualStart DateTime?
  actualEnd   DateTime?
  progress    Float     @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  project Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  tasks   WbsTask[]

  @@index([projectId])
}

model WbsTask {
  id             String    @id @default(cuid())
  phaseId        String
  title          String
  description    String?
  position       Int
  planStart      DateTime?
  planEnd        DateTime?
  actualStart    DateTime?
  actualEnd      DateTime?
  progress       Float     @default(0)
  backlogItemId  String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  phase       WbsPhase      @relation(fields: [phaseId], references: [id], onDelete: Cascade)
  subtasks    WbsSubtask[]
  backlogItem Task?         @relation("WbsTaskBacklog", fields: [backlogItemId], references: [id], onDelete: SetNull)

  @@index([phaseId])
  @@index([backlogItemId])
}

model WbsSubtask {
  id             String    @id @default(cuid())
  taskId         String
  title          String
  description    String?
  position       Int
  planStart      DateTime?
  planEnd        DateTime?
  actualStart    DateTime?
  actualEnd      DateTime?
  progress       Float     @default(0)
  backlogItemId  String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  task        WbsTask  @relation(fields: [taskId], references: [id], onDelete: Cascade)
  backlogItem Task?    @relation("WbsSubtaskBacklog", fields: [backlogItemId], references: [id], onDelete: SetNull)

  @@index([taskId])
  @@index([backlogItemId])
}

model WbsDependency {
  id         String            @id @default(cuid())
  projectId  String
  sourceId   String
  sourceType WbsNodeType
  targetId   String
  targetType WbsNodeType
  type       WbsDependencyType @default(FINISH_TO_START)
  createdAt  DateTime          @default(now())

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
  @@index([sourceId])
  @@index([targetId])
}
```

- [ ] **Step 2: Add reverse relations to Project and Task models**

In the `Project` model (around line 200), add these two lines alongside the existing relations:

```prisma
  wbsPhases      WbsPhase[]
  wbsDependencies WbsDependency[]
```

In the `Task` model (around line 330, before the closing `}`), add:

```prisma
  wbsTaskLinks    WbsTask[]    @relation("WbsTaskBacklog")
  wbsSubtaskLinks WbsSubtask[] @relation("WbsSubtaskBacklog")
```

- [ ] **Step 3: Run Prisma migration**

```bash
cd apps/api && npx prisma migrate dev --name add-wbs-models
```

Expected: Migration created and applied successfully. Prisma Client regenerated.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat(wbs): add Prisma schema for WBS phases, tasks, subtasks, dependencies"
```

---

## Task 2: Backend DTOs

**Files:**
- Create: `apps/api/src/wbs/dto/create-phase.dto.ts`
- Create: `apps/api/src/wbs/dto/update-phase.dto.ts`
- Create: `apps/api/src/wbs/dto/create-task.dto.ts`
- Create: `apps/api/src/wbs/dto/update-task.dto.ts`
- Create: `apps/api/src/wbs/dto/create-subtask.dto.ts`
- Create: `apps/api/src/wbs/dto/update-subtask.dto.ts`
- Create: `apps/api/src/wbs/dto/create-dependency.dto.ts`
- Create: `apps/api/src/wbs/dto/link-backlog.dto.ts`
- Create: `apps/api/src/wbs/dto/reorder.dto.ts`

- [ ] **Step 1: Create phase DTOs**

`apps/api/src/wbs/dto/create-phase.dto.ts`:
```typescript
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreatePhaseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
```

`apps/api/src/wbs/dto/update-phase.dto.ts`:
```typescript
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class UpdatePhaseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
```

- [ ] **Step 2: Create task DTOs**

`apps/api/src/wbs/dto/create-task.dto.ts`:
```typescript
import { IsString, IsOptional, MinLength, MaxLength, IsDateString } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsDateString()
  planStart?: string;

  @IsOptional()
  @IsDateString()
  planEnd?: string;
}
```

`apps/api/src/wbs/dto/update-task.dto.ts`:
```typescript
import { IsString, IsOptional, MinLength, MaxLength, IsDateString, IsNumber, Min, Max } from 'class-validator';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsDateString()
  planStart?: string;

  @IsOptional()
  @IsDateString()
  planEnd?: string;

  @IsOptional()
  @IsDateString()
  actualStart?: string;

  @IsOptional()
  @IsDateString()
  actualEnd?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progress?: number;
}
```

- [ ] **Step 3: Create subtask DTOs**

`apps/api/src/wbs/dto/create-subtask.dto.ts`:
```typescript
import { IsString, IsOptional, MinLength, MaxLength, IsDateString } from 'class-validator';

export class CreateSubtaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsDateString()
  planStart?: string;

  @IsOptional()
  @IsDateString()
  planEnd?: string;
}
```

`apps/api/src/wbs/dto/update-subtask.dto.ts`:
```typescript
import { IsString, IsOptional, MinLength, MaxLength, IsDateString, IsNumber, Min, Max } from 'class-validator';

export class UpdateSubtaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsDateString()
  planStart?: string;

  @IsOptional()
  @IsDateString()
  planEnd?: string;

  @IsOptional()
  @IsDateString()
  actualStart?: string;

  @IsOptional()
  @IsDateString()
  actualEnd?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progress?: number;
}
```

- [ ] **Step 4: Create dependency, backlog-link, and reorder DTOs**

`apps/api/src/wbs/dto/create-dependency.dto.ts`:
```typescript
import { IsString, IsEnum } from 'class-validator';

enum WbsNodeType {
  TASK = 'TASK',
  SUBTASK = 'SUBTASK',
}

export class CreateDependencyDto {
  @IsString()
  sourceId: string;

  @IsEnum(WbsNodeType)
  sourceType: WbsNodeType;

  @IsString()
  targetId: string;

  @IsEnum(WbsNodeType)
  targetType: WbsNodeType;
}
```

`apps/api/src/wbs/dto/link-backlog.dto.ts`:
```typescript
import { IsString } from 'class-validator';

export class LinkBacklogDto {
  @IsString()
  backlogItemId: string;
}
```

`apps/api/src/wbs/dto/reorder.dto.ts`:
```typescript
import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class ReorderDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderedIds: string[];
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/wbs/dto/
git commit -m "feat(wbs): add DTOs for WBS phases, tasks, subtasks, dependencies, backlog linking"
```

---

## Task 3: Backend WBS Service — Core CRUD + Rollup

**Files:**
- Create: `apps/api/src/wbs/wbs.service.ts`

- [ ] **Step 1: Create the WBS service with phase/task/subtask CRUD and rollup**

`apps/api/src/wbs/wbs.service.ts`:
```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { UpdatePhaseDto } from './dto/update-phase.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { UpdateSubtaskDto } from './dto/update-subtask.dto';
import { ReorderDto } from './dto/reorder.dto';

const PHASE_INCLUDE = {
  tasks: {
    orderBy: { position: 'asc' as const },
    include: {
      subtasks: { orderBy: { position: 'asc' as const } },
    },
  },
};

@Injectable()
export class WbsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Phases ──────────────────────────────────────────────

  async listPhases(projectId: string) {
    return this.prisma.wbsPhase.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
      include: PHASE_INCLUDE,
    });
  }

  async createPhase(projectId: string, dto: CreatePhaseDto) {
    const maxPos = await this.prisma.wbsPhase.aggregate({
      where: { projectId },
      _max: { position: true },
    });
    return this.prisma.wbsPhase.create({
      data: {
        projectId,
        title: dto.title,
        description: dto.description,
        position: (maxPos._max.position ?? -1) + 1,
      },
      include: PHASE_INCLUDE,
    });
  }

  async updatePhase(phaseId: string, dto: UpdatePhaseDto) {
    await this.ensurePhaseExists(phaseId);
    return this.prisma.wbsPhase.update({
      where: { id: phaseId },
      data: dto,
      include: PHASE_INCLUDE,
    });
  }

  async deletePhase(phaseId: string) {
    await this.ensurePhaseExists(phaseId);
    return this.prisma.wbsPhase.delete({ where: { id: phaseId } });
  }

  async reorderPhases(projectId: string, dto: ReorderDto) {
    await this.prisma.$transaction(
      dto.orderedIds.map((id, index) =>
        this.prisma.wbsPhase.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );
    return this.listPhases(projectId);
  }

  // ─── Tasks ───────────────────────────────────────────────

  async createTask(phaseId: string, dto: CreateTaskDto) {
    await this.ensurePhaseExists(phaseId);
    const maxPos = await this.prisma.wbsTask.aggregate({
      where: { phaseId },
      _max: { position: true },
    });
    const task = await this.prisma.wbsTask.create({
      data: {
        phaseId,
        title: dto.title,
        description: dto.description,
        position: (maxPos._max.position ?? -1) + 1,
        planStart: dto.planStart ? new Date(dto.planStart) : undefined,
        planEnd: dto.planEnd ? new Date(dto.planEnd) : undefined,
      },
      include: { subtasks: { orderBy: { position: 'asc' } } },
    });
    await this.rollupPhase(phaseId);
    return task;
  }

  async updateTask(taskId: string, dto: UpdateTaskDto) {
    const task = await this.ensureTaskExists(taskId);
    const hasSubtasks = await this.prisma.wbsSubtask.count({ where: { taskId } });
    if (hasSubtasks > 0) {
      // Only allow title/description updates on parent tasks
      const { planStart, planEnd, actualStart, actualEnd, progress, ...allowed } = dto;
      if (planStart !== undefined || planEnd !== undefined || actualStart !== undefined || actualEnd !== undefined || progress !== undefined) {
        throw new BadRequestException('Cannot manually set dates/progress on a task with subtasks. Values are auto-calculated.');
      }
      const updated = await this.prisma.wbsTask.update({
        where: { id: taskId },
        data: allowed,
        include: { subtasks: { orderBy: { position: 'asc' } } },
      });
      return updated;
    }
    const updated = await this.prisma.wbsTask.update({
      where: { id: taskId },
      data: {
        ...dto,
        planStart: dto.planStart ? new Date(dto.planStart) : undefined,
        planEnd: dto.planEnd ? new Date(dto.planEnd) : undefined,
        actualStart: dto.actualStart ? new Date(dto.actualStart) : undefined,
        actualEnd: dto.actualEnd ? new Date(dto.actualEnd) : undefined,
      },
      include: { subtasks: { orderBy: { position: 'asc' } } },
    });
    await this.rollupPhase(task.phaseId);
    return updated;
  }

  async deleteTask(taskId: string) {
    const task = await this.ensureTaskExists(taskId);
    await this.prisma.wbsTask.delete({ where: { id: taskId } });
    await this.rollupPhase(task.phaseId);
  }

  async reorderTasks(phaseId: string, dto: ReorderDto) {
    await this.prisma.$transaction(
      dto.orderedIds.map((id, index) =>
        this.prisma.wbsTask.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );
  }

  // ─── Subtasks ────────────────────────────────────────────

  async createSubtask(taskId: string, dto: CreateSubtaskDto) {
    const task = await this.ensureTaskExists(taskId);
    // If the parent task had a backlogItemId, remove it (no longer a leaf)
    if (task.backlogItemId) {
      await this.prisma.wbsTask.update({
        where: { id: taskId },
        data: { backlogItemId: null },
      });
    }
    const maxPos = await this.prisma.wbsSubtask.aggregate({
      where: { taskId },
      _max: { position: true },
    });
    const subtask = await this.prisma.wbsSubtask.create({
      data: {
        taskId,
        title: dto.title,
        description: dto.description,
        position: (maxPos._max.position ?? -1) + 1,
        planStart: dto.planStart ? new Date(dto.planStart) : undefined,
        planEnd: dto.planEnd ? new Date(dto.planEnd) : undefined,
      },
    });
    await this.rollupTask(taskId);
    await this.rollupPhase(task.phaseId);
    return subtask;
  }

  async updateSubtask(subtaskId: string, dto: UpdateSubtaskDto) {
    const subtask = await this.ensureSubtaskExists(subtaskId);
    const updated = await this.prisma.wbsSubtask.update({
      where: { id: subtaskId },
      data: {
        ...dto,
        planStart: dto.planStart ? new Date(dto.planStart) : undefined,
        planEnd: dto.planEnd ? new Date(dto.planEnd) : undefined,
        actualStart: dto.actualStart ? new Date(dto.actualStart) : undefined,
        actualEnd: dto.actualEnd ? new Date(dto.actualEnd) : undefined,
      },
    });
    const task = await this.prisma.wbsTask.findUnique({ where: { id: subtask.taskId } });
    await this.rollupTask(subtask.taskId);
    if (task) await this.rollupPhase(task.phaseId);
    return updated;
  }

  async deleteSubtask(subtaskId: string) {
    const subtask = await this.ensureSubtaskExists(subtaskId);
    await this.prisma.wbsSubtask.delete({ where: { id: subtaskId } });
    const task = await this.prisma.wbsTask.findUnique({ where: { id: subtask.taskId } });
    await this.rollupTask(subtask.taskId);
    if (task) await this.rollupPhase(task.phaseId);
  }

  async reorderSubtasks(taskId: string, dto: ReorderDto) {
    await this.prisma.$transaction(
      dto.orderedIds.map((id, index) =>
        this.prisma.wbsSubtask.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );
  }

  // ─── Rollup ──────────────────────────────────────────────

  async rollupTask(taskId: string) {
    const subtasks = await this.prisma.wbsSubtask.findMany({ where: { taskId } });
    if (subtasks.length === 0) return;

    const planStarts = subtasks.map((s) => s.planStart).filter(Boolean) as Date[];
    const planEnds = subtasks.map((s) => s.planEnd).filter(Boolean) as Date[];
    const actualStarts = subtasks.map((s) => s.actualStart).filter(Boolean) as Date[];
    const actualEnds = subtasks.map((s) => s.actualEnd).filter(Boolean) as Date[];
    const allComplete = subtasks.every((s) => s.actualEnd !== null);
    const avgProgress = subtasks.reduce((sum, s) => sum + s.progress, 0) / subtasks.length;

    await this.prisma.wbsTask.update({
      where: { id: taskId },
      data: {
        planStart: planStarts.length ? new Date(Math.min(...planStarts.map((d) => d.getTime()))) : null,
        planEnd: planEnds.length ? new Date(Math.max(...planEnds.map((d) => d.getTime()))) : null,
        actualStart: actualStarts.length ? new Date(Math.min(...actualStarts.map((d) => d.getTime()))) : null,
        actualEnd: allComplete && actualEnds.length ? new Date(Math.max(...actualEnds.map((d) => d.getTime()))) : null,
        progress: Math.round(avgProgress * 100) / 100,
      },
    });
  }

  async rollupPhase(phaseId: string) {
    const tasks = await this.prisma.wbsTask.findMany({ where: { phaseId } });
    if (tasks.length === 0) {
      await this.prisma.wbsPhase.update({
        where: { id: phaseId },
        data: { planStart: null, planEnd: null, actualStart: null, actualEnd: null, progress: 0 },
      });
      return;
    }

    const planStarts = tasks.map((t) => t.planStart).filter(Boolean) as Date[];
    const planEnds = tasks.map((t) => t.planEnd).filter(Boolean) as Date[];
    const actualStarts = tasks.map((t) => t.actualStart).filter(Boolean) as Date[];
    const actualEnds = tasks.map((t) => t.actualEnd).filter(Boolean) as Date[];
    const allComplete = tasks.every((t) => t.actualEnd !== null);
    const avgProgress = tasks.reduce((sum, t) => sum + t.progress, 0) / tasks.length;

    await this.prisma.wbsPhase.update({
      where: { id: phaseId },
      data: {
        planStart: planStarts.length ? new Date(Math.min(...planStarts.map((d) => d.getTime()))) : null,
        planEnd: planEnds.length ? new Date(Math.max(...planEnds.map((d) => d.getTime()))) : null,
        actualStart: actualStarts.length ? new Date(Math.min(...actualStarts.map((d) => d.getTime()))) : null,
        actualEnd: allComplete && actualEnds.length ? new Date(Math.max(...actualEnds.map((d) => d.getTime()))) : null,
        progress: Math.round(avgProgress * 100) / 100,
      },
    });
  }

  // ─── Helpers ─────────────────────────────────────────────

  private async ensurePhaseExists(phaseId: string) {
    const phase = await this.prisma.wbsPhase.findUnique({ where: { id: phaseId } });
    if (!phase) throw new NotFoundException('WBS phase not found');
    return phase;
  }

  private async ensureTaskExists(taskId: string) {
    const task = await this.prisma.wbsTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('WBS task not found');
    return task;
  }

  private async ensureSubtaskExists(subtaskId: string) {
    const subtask = await this.prisma.wbsSubtask.findUnique({ where: { id: subtaskId } });
    if (!subtask) throw new NotFoundException('WBS subtask not found');
    return subtask;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/wbs/wbs.service.ts
git commit -m "feat(wbs): add WBS service with CRUD and rollup calculations"
```

---

## Task 4: Backend Dependency Service

**Files:**
- Create: `apps/api/src/wbs/wbs-dependency.service.ts`

- [ ] **Step 1: Create dependency service**

`apps/api/src/wbs/wbs-dependency.service.ts`:
```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDependencyDto } from './dto/create-dependency.dto';

@Injectable()
export class WbsDependencyService {
  constructor(private readonly prisma: PrismaService) {}

  async listDependencies(projectId: string) {
    return this.prisma.wbsDependency.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createDependency(projectId: string, dto: CreateDependencyDto) {
    // Validate source exists
    await this.validateNodeExists(dto.sourceId, dto.sourceType);
    // Validate target exists
    await this.validateNodeExists(dto.targetId, dto.targetType);
    // Prevent duplicate
    const existing = await this.prisma.wbsDependency.findFirst({
      where: {
        projectId,
        sourceId: dto.sourceId,
        sourceType: dto.sourceType,
        targetId: dto.targetId,
        targetType: dto.targetType,
      },
    });
    if (existing) throw new BadRequestException('Dependency already exists');
    // Prevent self-dependency
    if (dto.sourceId === dto.targetId && dto.sourceType === dto.targetType) {
      throw new BadRequestException('Cannot create dependency on itself');
    }

    return this.prisma.wbsDependency.create({
      data: {
        projectId,
        sourceId: dto.sourceId,
        sourceType: dto.sourceType,
        targetId: dto.targetId,
        targetType: dto.targetType,
      },
    });
  }

  async deleteDependency(depId: string) {
    const dep = await this.prisma.wbsDependency.findUnique({ where: { id: depId } });
    if (!dep) throw new NotFoundException('Dependency not found');
    return this.prisma.wbsDependency.delete({ where: { id: depId } });
  }

  private async validateNodeExists(nodeId: string, nodeType: string) {
    if (nodeType === 'TASK') {
      const task = await this.prisma.wbsTask.findUnique({ where: { id: nodeId } });
      if (!task) throw new NotFoundException(`WBS task ${nodeId} not found`);
    } else {
      const subtask = await this.prisma.wbsSubtask.findUnique({ where: { id: nodeId } });
      if (!subtask) throw new NotFoundException(`WBS subtask ${nodeId} not found`);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/wbs/wbs-dependency.service.ts
git commit -m "feat(wbs): add dependency service with validation"
```

---

## Task 5: Backend Backlog Linking Service

**Files:**
- Create: `apps/api/src/wbs/wbs-backlog.service.ts`

- [ ] **Step 1: Create backlog linking service**

`apps/api/src/wbs/wbs-backlog.service.ts`:
```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LinkBacklogDto } from './dto/link-backlog.dto';
import { WbsService } from './wbs.service';

@Injectable()
export class WbsBacklogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wbsService: WbsService,
  ) {}

  async linkTask(taskId: string, dto: LinkBacklogDto) {
    const task = await this.prisma.wbsTask.findUnique({
      where: { id: taskId },
      include: { _count: { select: { subtasks: true } } },
    });
    if (!task) throw new NotFoundException('WBS task not found');
    if (task._count.subtasks > 0) {
      throw new BadRequestException('Cannot link backlog to a task with subtasks. Only leaf nodes can be linked.');
    }
    await this.validateBacklogItem(dto.backlogItemId);
    await this.ensureNotAlreadyLinked(dto.backlogItemId);

    const updated = await this.prisma.wbsTask.update({
      where: { id: taskId },
      data: { backlogItemId: dto.backlogItemId },
      include: { subtasks: { orderBy: { position: 'asc' } } },
    });
    return updated;
  }

  async unlinkTask(taskId: string) {
    const task = await this.prisma.wbsTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('WBS task not found');
    return this.prisma.wbsTask.update({
      where: { id: taskId },
      data: { backlogItemId: null },
      include: { subtasks: { orderBy: { position: 'asc' } } },
    });
  }

  async linkSubtask(subtaskId: string, dto: LinkBacklogDto) {
    const subtask = await this.prisma.wbsSubtask.findUnique({ where: { id: subtaskId } });
    if (!subtask) throw new NotFoundException('WBS subtask not found');
    await this.validateBacklogItem(dto.backlogItemId);
    await this.ensureNotAlreadyLinked(dto.backlogItemId);

    const updated = await this.prisma.wbsSubtask.update({
      where: { id: subtaskId },
      data: { backlogItemId: dto.backlogItemId },
    });
    // Sync progress from backlog item
    const backlogItem = await this.prisma.task.findUnique({ where: { id: dto.backlogItemId } });
    if (backlogItem && backlogItem.progress !== undefined) {
      await this.prisma.wbsSubtask.update({
        where: { id: subtaskId },
        data: { progress: backlogItem.progress },
      });
      await this.wbsService.rollupTask(subtask.taskId);
      const task = await this.prisma.wbsTask.findUnique({ where: { id: subtask.taskId } });
      if (task) await this.wbsService.rollupPhase(task.phaseId);
    }
    return updated;
  }

  async unlinkSubtask(subtaskId: string) {
    const subtask = await this.prisma.wbsSubtask.findUnique({ where: { id: subtaskId } });
    if (!subtask) throw new NotFoundException('WBS subtask not found');
    return this.prisma.wbsSubtask.update({
      where: { id: subtaskId },
      data: { backlogItemId: null },
    });
  }

  private async validateBacklogItem(backlogItemId: string) {
    const item = await this.prisma.task.findUnique({ where: { id: backlogItemId } });
    if (!item) throw new NotFoundException('Backlog item not found');
  }

  private async ensureNotAlreadyLinked(backlogItemId: string) {
    const linkedTask = await this.prisma.wbsTask.findFirst({ where: { backlogItemId } });
    const linkedSubtask = await this.prisma.wbsSubtask.findFirst({ where: { backlogItemId } });
    if (linkedTask || linkedSubtask) {
      throw new BadRequestException('This backlog item is already linked to another WBS node');
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/wbs/wbs-backlog.service.ts
git commit -m "feat(wbs): add backlog linking service with leaf-node validation"
```

---

## Task 6: Backend Controllers

**Files:**
- Create: `apps/api/src/wbs/wbs.controller.ts`
- Create: `apps/api/src/wbs/wbs-dependency.controller.ts`
- Create: `apps/api/src/wbs/wbs-backlog.controller.ts`

- [ ] **Step 1: Create main WBS controller**

`apps/api/src/wbs/wbs.controller.ts`:
```typescript
import {
  Controller, Get, Post, Patch, Delete, Param, Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { WbsService } from './wbs.service';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { UpdatePhaseDto } from './dto/update-phase.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { UpdateSubtaskDto } from './dto/update-subtask.dto';
import { ReorderDto } from './dto/reorder.dto';

@Controller()
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class WbsController {
  constructor(private readonly wbsService: WbsService) {}

  // ─── Phases ──────────────────────────────────────────────

  @Get('projects/:projectId/wbs/phases')
  listPhases(@Param('projectId') projectId: string) {
    return this.wbsService.listPhases(projectId);
  }

  @Post('projects/:projectId/wbs/phases')
  createPhase(
    @Param('projectId') projectId: string,
    @Body() dto: CreatePhaseDto,
  ) {
    return this.wbsService.createPhase(projectId, dto);
  }

  @Patch('projects/:projectId/wbs/phases/:phaseId')
  updatePhase(
    @Param('phaseId') phaseId: string,
    @Body() dto: UpdatePhaseDto,
  ) {
    return this.wbsService.updatePhase(phaseId, dto);
  }

  @Delete('projects/:projectId/wbs/phases/:phaseId')
  deletePhase(@Param('phaseId') phaseId: string) {
    return this.wbsService.deletePhase(phaseId);
  }

  @Patch('projects/:projectId/wbs/phases/reorder')
  reorderPhases(
    @Param('projectId') projectId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.wbsService.reorderPhases(projectId, dto);
  }

  // ─── Tasks ───────────────────────────────────────────────

  @Post('wbs/phases/:phaseId/tasks')
  createTask(
    @Param('phaseId') phaseId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.wbsService.createTask(phaseId, dto);
  }

  @Patch('wbs/phases/:phaseId/tasks/:taskId')
  updateTask(
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.wbsService.updateTask(taskId, dto);
  }

  @Delete('wbs/phases/:phaseId/tasks/:taskId')
  deleteTask(@Param('taskId') taskId: string) {
    return this.wbsService.deleteTask(taskId);
  }

  @Patch('wbs/phases/:phaseId/tasks/reorder')
  reorderTasks(
    @Param('phaseId') phaseId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.wbsService.reorderTasks(phaseId, dto);
  }

  // ─── Subtasks ────────────────────────────────────────────

  @Post('wbs/tasks/:taskId/subtasks')
  createSubtask(
    @Param('taskId') taskId: string,
    @Body() dto: CreateSubtaskDto,
  ) {
    return this.wbsService.createSubtask(taskId, dto);
  }

  @Patch('wbs/tasks/:taskId/subtasks/:subtaskId')
  updateSubtask(
    @Param('subtaskId') subtaskId: string,
    @Body() dto: UpdateSubtaskDto,
  ) {
    return this.wbsService.updateSubtask(subtaskId, dto);
  }

  @Delete('wbs/tasks/:taskId/subtasks/:subtaskId')
  deleteSubtask(@Param('subtaskId') subtaskId: string) {
    return this.wbsService.deleteSubtask(subtaskId);
  }

  @Patch('wbs/tasks/:taskId/subtasks/reorder')
  reorderSubtasks(
    @Param('taskId') taskId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.wbsService.reorderSubtasks(taskId, dto);
  }
}
```

- [ ] **Step 2: Create dependency controller**

`apps/api/src/wbs/wbs-dependency.controller.ts`:
```typescript
import {
  Controller, Get, Post, Delete, Param, Body, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { WbsDependencyService } from './wbs-dependency.service';
import { CreateDependencyDto } from './dto/create-dependency.dto';

@Controller()
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class WbsDependencyController {
  constructor(private readonly depService: WbsDependencyService) {}

  @Get('projects/:projectId/wbs/dependencies')
  list(@Param('projectId') projectId: string) {
    return this.depService.listDependencies(projectId);
  }

  @Post('projects/:projectId/wbs/dependencies')
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateDependencyDto,
  ) {
    return this.depService.createDependency(projectId, dto);
  }

  @Delete('projects/:projectId/wbs/dependencies/:depId')
  remove(@Param('depId') depId: string) {
    return this.depService.deleteDependency(depId);
  }
}
```

- [ ] **Step 3: Create backlog controller**

`apps/api/src/wbs/wbs-backlog.controller.ts`:
```typescript
import {
  Controller, Post, Delete, Param, Body, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { WbsBacklogService } from './wbs-backlog.service';
import { LinkBacklogDto } from './dto/link-backlog.dto';

@Controller()
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class WbsBacklogController {
  constructor(private readonly backlogService: WbsBacklogService) {}

  @Post('wbs/tasks/:taskId/link-backlog')
  linkTask(
    @Param('taskId') taskId: string,
    @Body() dto: LinkBacklogDto,
  ) {
    return this.backlogService.linkTask(taskId, dto);
  }

  @Delete('wbs/tasks/:taskId/link-backlog')
  unlinkTask(@Param('taskId') taskId: string) {
    return this.backlogService.unlinkTask(taskId);
  }

  @Post('wbs/subtasks/:subtaskId/link-backlog')
  linkSubtask(
    @Param('subtaskId') subtaskId: string,
    @Body() dto: LinkBacklogDto,
  ) {
    return this.backlogService.linkSubtask(subtaskId, dto);
  }

  @Delete('wbs/subtasks/:subtaskId/link-backlog')
  unlinkSubtask(@Param('subtaskId') subtaskId: string) {
    return this.backlogService.unlinkSubtask(subtaskId);
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/wbs/wbs.controller.ts apps/api/src/wbs/wbs-dependency.controller.ts apps/api/src/wbs/wbs-backlog.controller.ts
git commit -m "feat(wbs): add controllers for phases, tasks, subtasks, dependencies, backlog linking"
```

---

## Task 7: Backend Module Registration

**Files:**
- Create: `apps/api/src/wbs/wbs.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create WBS module**

`apps/api/src/wbs/wbs.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { WbsController } from './wbs.controller';
import { WbsDependencyController } from './wbs-dependency.controller';
import { WbsBacklogController } from './wbs-backlog.controller';
import { WbsService } from './wbs.service';
import { WbsDependencyService } from './wbs-dependency.service';
import { WbsBacklogService } from './wbs-backlog.service';

@Module({
  controllers: [WbsController, WbsDependencyController, WbsBacklogController],
  providers: [WbsService, WbsDependencyService, WbsBacklogService],
  exports: [WbsService],
})
export class WbsModule {}
```

- [ ] **Step 2: Register WbsModule in AppModule**

In `apps/api/src/app.module.ts`, add the import at the top (after the PlannerAiConfigModule import on line 40):

```typescript
import { WbsModule } from './wbs/wbs.module';
```

Add `WbsModule` to the `imports` array (after `PlannerAiConfigModule` on line 80):

```typescript
    WbsModule,
```

- [ ] **Step 3: Verify the API compiles**

```bash
cd apps/api && npx nest build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/wbs/wbs.module.ts apps/api/src/app.module.ts
git commit -m "feat(wbs): register WBS module in app"
```

---

## Task 8: Frontend Types + API Functions

**Files:**
- Modify: `apps/web/src/lib/types.ts` (append WBS types)
- Modify: `apps/web/src/lib/api.ts` (append WBS API functions)

- [ ] **Step 1: Add WBS types to types.ts**

Append at the end of `apps/web/src/lib/types.ts`:

```typescript
// ─── WBS Types ─────────────────────────────────────────────

export interface WbsSubtask {
  id: string;
  taskId: string;
  title: string;
  description: string | null;
  position: number;
  planStart: string | null;
  planEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  progress: number;
  backlogItemId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WbsTask {
  id: string;
  phaseId: string;
  title: string;
  description: string | null;
  position: number;
  planStart: string | null;
  planEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  progress: number;
  backlogItemId: string | null;
  subtasks: WbsSubtask[];
  createdAt: string;
  updatedAt: string;
}

export interface WbsPhase {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  position: number;
  planStart: string | null;
  planEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  progress: number;
  tasks: WbsTask[];
  createdAt: string;
  updatedAt: string;
}

export interface WbsDependency {
  id: string;
  projectId: string;
  sourceId: string;
  sourceType: 'TASK' | 'SUBTASK';
  targetId: string;
  targetType: 'TASK' | 'SUBTASK';
  type: 'FINISH_TO_START';
  createdAt: string;
}

export interface CreateWbsPhasePayload {
  title: string;
  description?: string;
}

export interface UpdateWbsPhasePayload {
  title?: string;
  description?: string;
}

export interface CreateWbsTaskPayload {
  title: string;
  description?: string;
  planStart?: string;
  planEnd?: string;
}

export interface UpdateWbsTaskPayload {
  title?: string;
  description?: string;
  planStart?: string;
  planEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  progress?: number;
}

export interface CreateWbsSubtaskPayload {
  title: string;
  description?: string;
  planStart?: string;
  planEnd?: string;
}

export interface UpdateWbsSubtaskPayload {
  title?: string;
  description?: string;
  planStart?: string;
  planEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  progress?: number;
}

export interface CreateWbsDependencyPayload {
  sourceId: string;
  sourceType: 'TASK' | 'SUBTASK';
  targetId: string;
  targetType: 'TASK' | 'SUBTASK';
}

export interface LinkBacklogPayload {
  backlogItemId: string;
}
```

- [ ] **Step 2: Add WBS API functions to api.ts**

Append inside the `api` object at the end of `apps/web/src/lib/api.ts` (before the closing `};`):

```typescript
  // ─── WBS ───────────────────────────────────────────────────

  // Phases
  getWbsPhases: (projectId: string) =>
    request<WbsPhase[]>(`/projects/${projectId}/wbs/phases`),

  createWbsPhase: (projectId: string, data: CreateWbsPhasePayload) =>
    request<WbsPhase>(`/projects/${projectId}/wbs/phases`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  updateWbsPhase: (projectId: string, phaseId: string, data: UpdateWbsPhasePayload) =>
    request<WbsPhase>(`/projects/${projectId}/wbs/phases/${phaseId}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),

  deleteWbsPhase: (projectId: string, phaseId: string) =>
    request<void>(`/projects/${projectId}/wbs/phases/${phaseId}`, { method: 'DELETE' }),

  reorderWbsPhases: (projectId: string, orderedIds: string[]) =>
    request<WbsPhase[]>(`/projects/${projectId}/wbs/phases/reorder`, {
      method: 'PATCH', body: JSON.stringify({ orderedIds }),
    }),

  // Tasks
  createWbsTask: (phaseId: string, data: CreateWbsTaskPayload) =>
    request<WbsTask>(`/wbs/phases/${phaseId}/tasks`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  updateWbsTask: (phaseId: string, taskId: string, data: UpdateWbsTaskPayload) =>
    request<WbsTask>(`/wbs/phases/${phaseId}/tasks/${taskId}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),

  deleteWbsTask: (phaseId: string, taskId: string) =>
    request<void>(`/wbs/phases/${phaseId}/tasks/${taskId}`, { method: 'DELETE' }),

  reorderWbsTasks: (phaseId: string, orderedIds: string[]) =>
    request<void>(`/wbs/phases/${phaseId}/tasks/reorder`, {
      method: 'PATCH', body: JSON.stringify({ orderedIds }),
    }),

  // Subtasks
  createWbsSubtask: (taskId: string, data: CreateWbsSubtaskPayload) =>
    request<WbsSubtask>(`/wbs/tasks/${taskId}/subtasks`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  updateWbsSubtask: (taskId: string, subtaskId: string, data: UpdateWbsSubtaskPayload) =>
    request<WbsSubtask>(`/wbs/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),

  deleteWbsSubtask: (taskId: string, subtaskId: string) =>
    request<void>(`/wbs/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'DELETE' }),

  reorderWbsSubtasks: (taskId: string, orderedIds: string[]) =>
    request<void>(`/wbs/tasks/${taskId}/subtasks/reorder`, {
      method: 'PATCH', body: JSON.stringify({ orderedIds }),
    }),

  // Dependencies
  getWbsDependencies: (projectId: string) =>
    request<WbsDependency[]>(`/projects/${projectId}/wbs/dependencies`),

  createWbsDependency: (projectId: string, data: CreateWbsDependencyPayload) =>
    request<WbsDependency>(`/projects/${projectId}/wbs/dependencies`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  deleteWbsDependency: (projectId: string, depId: string) =>
    request<void>(`/projects/${projectId}/wbs/dependencies/${depId}`, { method: 'DELETE' }),

  // Backlog linking
  linkWbsTaskBacklog: (taskId: string, data: LinkBacklogPayload) =>
    request<WbsTask>(`/wbs/tasks/${taskId}/link-backlog`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  unlinkWbsTaskBacklog: (taskId: string) =>
    request<WbsTask>(`/wbs/tasks/${taskId}/link-backlog`, { method: 'DELETE' }),

  linkWbsSubtaskBacklog: (subtaskId: string, data: LinkBacklogPayload) =>
    request<WbsSubtask>(`/wbs/subtasks/${subtaskId}/link-backlog`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  unlinkWbsSubtaskBacklog: (subtaskId: string) =>
    request<WbsSubtask>(`/wbs/subtasks/${subtaskId}/link-backlog`, { method: 'DELETE' }),
```

Note: Add the WBS type imports at the top of `api.ts` where other types are imported.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts
git commit -m "feat(wbs): add frontend types and API functions"
```

---

## Task 9: Frontend React Query Hooks

**Files:**
- Create: `apps/web/src/hooks/useWbs.ts`

- [ ] **Step 1: Create WBS hooks file**

`apps/web/src/hooks/useWbs.ts`:
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type {
  CreateWbsPhasePayload, UpdateWbsPhasePayload,
  CreateWbsTaskPayload, UpdateWbsTaskPayload,
  CreateWbsSubtaskPayload, UpdateWbsSubtaskPayload,
  CreateWbsDependencyPayload, LinkBacklogPayload,
} from '@/lib/types';

// ─── Queries ───────────────────────────────────────────────

export function useWbsPhases(projectId: string) {
  return useQuery({
    queryKey: ['wbs-phases', projectId],
    queryFn: () => api.getWbsPhases(projectId),
    enabled: !!projectId,
  });
}

export function useWbsDependencies(projectId: string) {
  return useQuery({
    queryKey: ['wbs-dependencies', projectId],
    queryFn: () => api.getWbsDependencies(projectId),
    enabled: !!projectId,
  });
}

// ─── Phase Mutations ───────────────────────────────────────

export function useCreateWbsPhase(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWbsPhasePayload) => api.createWbsPhase(projectId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-phases', projectId] });
      toast.success('Phase created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateWbsPhase(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ phaseId, data }: { phaseId: string; data: UpdateWbsPhasePayload }) =>
      api.updateWbsPhase(projectId, phaseId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-phases', projectId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteWbsPhase(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (phaseId: string) => api.deleteWbsPhase(projectId, phaseId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-phases', projectId] });
      toast.success('Phase deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useReorderWbsPhases(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => api.reorderWbsPhases(projectId, orderedIds),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-phases', projectId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Task Mutations ────────────────────────────────────────

export function useCreateWbsTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ phaseId, data }: { phaseId: string; data: CreateWbsTaskPayload }) =>
      api.createWbsTask(phaseId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-phases', projectId] });
      toast.success('Task created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateWbsTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ phaseId, taskId, data }: { phaseId: string; taskId: string; data: UpdateWbsTaskPayload }) =>
      api.updateWbsTask(phaseId, taskId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-phases', projectId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteWbsTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ phaseId, taskId }: { phaseId: string; taskId: string }) =>
      api.deleteWbsTask(phaseId, taskId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-phases', projectId] });
      toast.success('Task deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Subtask Mutations ─────────────────────────────────────

export function useCreateWbsSubtask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: CreateWbsSubtaskPayload }) =>
      api.createWbsSubtask(taskId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-phases', projectId] });
      toast.success('Subtask created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateWbsSubtask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, subtaskId, data }: { taskId: string; subtaskId: string; data: UpdateWbsSubtaskPayload }) =>
      api.updateWbsSubtask(taskId, subtaskId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-phases', projectId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteWbsSubtask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, subtaskId }: { taskId: string; subtaskId: string }) =>
      api.deleteWbsSubtask(taskId, subtaskId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-phases', projectId] });
      toast.success('Subtask deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Dependency Mutations ──────────────────────────────────

export function useCreateWbsDependency(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWbsDependencyPayload) =>
      api.createWbsDependency(projectId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-dependencies', projectId] });
      toast.success('Dependency created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteWbsDependency(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (depId: string) => api.deleteWbsDependency(projectId, depId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-dependencies', projectId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Backlog Link Mutations ────────────────────────────────

export function useLinkWbsBacklog(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeType, nodeId, data }: { nodeType: 'task' | 'subtask'; nodeId: string; data: LinkBacklogPayload }) =>
      nodeType === 'task'
        ? api.linkWbsTaskBacklog(nodeId, data)
        : api.linkWbsSubtaskBacklog(nodeId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-phases', projectId] });
      toast.success('Backlog item linked');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUnlinkWbsBacklog(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeType, nodeId }: { nodeType: 'task' | 'subtask'; nodeId: string }) =>
      nodeType === 'task'
        ? api.unlinkWbsTaskBacklog(nodeId)
        : api.unlinkWbsSubtaskBacklog(nodeId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-phases', projectId] });
      toast.success('Backlog item unlinked');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/useWbs.ts
git commit -m "feat(wbs): add React Query hooks for WBS data"
```

---

## Task 10: Install gantt-task-react + Sidebar Navigation Update

**Files:**
- Modify: `apps/web/package.json` (install dep)
- Modify: `apps/web/src/components/layout/AppSidebar.tsx`

- [ ] **Step 1: Install gantt-task-react**

```bash
cd apps/web && pnpm add gantt-task-react
```

- [ ] **Step 2: Update AppSidebar to have collapsible Project Planner sub-menu**

In `apps/web/src/components/layout/AppSidebar.tsx`:

Add `ChevronDown` to the lucide-react import (line 2), and add `GanttChart` icon:
```typescript
import {
  LayoutDashboard,
  ListTodo,
  Zap,
  Bug,
  ClipboardList,
  Play,
  Users,
  FolderKanban,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Settings,
  LogOut,
  CheckSquare,
  BookOpen,
  Target,
  GanttChart,
} from 'lucide-react';
```

Add `useState` import:
```typescript
import { useState } from 'react';
```

Replace `PROJECT_NAV_ITEMS` (lines 39-50) with:
```typescript
interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  children?: NavItem[];
}

const PROJECT_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: 'dashboard' },
  {
    label: 'Project Planner',
    icon: Target,
    path: 'planner',
    children: [
      { label: 'Scope Definition', icon: Target, path: 'planner' },
      { label: 'WBS', icon: GanttChart, path: 'wbs' },
    ],
  },
  { label: 'Backlog', icon: ListTodo, path: 'backlog' },
  { label: 'Sprints', icon: Zap, path: 'sprints' },
  { label: 'Test Cases', icon: ClipboardList, path: 'test-cases' },
  { label: 'Test Executions', icon: Play, path: 'test-executions' },
  { label: 'Bugs', icon: Bug, path: 'bugs' },
  { label: 'Members', icon: Users, path: 'members' },
  { label: 'Wiki', icon: BookOpen, path: 'wiki' },
  { label: 'Settings', icon: Settings, path: 'settings' },
];
```

In the `AppSidebarInner` function, add state for expanded sub-menu:
```typescript
const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({ 'Project Planner': true });
```

Replace the `PROJECT_NAV_ITEMS.map` block (lines 238-261) with:
```typescript
{PROJECT_NAV_ITEMS.map((item) => {
  if (item.children) {
    const isExpanded = expandedMenus[item.label] ?? false;
    const childActive = item.children.some(
      (child) => location.pathname === `/projects/${activeProjectPrefix}/${child.path}`,
    );
    return (
      <div key={item.label}>
        <SidebarMenuItem>
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarMenuButton
                isActive={childActive}
                aria-label={item.label}
                onClick={() =>
                  setExpandedMenus((prev) => ({
                    ...prev,
                    [item.label]: !prev[item.label],
                  }))
                }
                className="cursor-pointer"
              >
                <item.icon />
                <span className="flex-1">{item.label}</span>
                {!isCollapsed && (
                  <ChevronDown
                    className={`size-3 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                  />
                )}
              </SidebarMenuButton>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right">{item.label}</TooltipContent>
            )}
          </Tooltip>
        </SidebarMenuItem>
        {isExpanded && !isCollapsed && (
          <div className="ml-4 border-l border-border/50 pl-2 space-y-0.5">
            {item.children.map((child) => {
              const href = `/projects/${activeProjectPrefix}/${child.path}`;
              const isActive = location.pathname === href;
              return (
                <SidebarMenuItem key={child.path}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton
                        isActive={isActive}
                        aria-label={child.label}
                        onClick={() => navigate(href)}
                        className="cursor-pointer h-8 text-sm"
                      >
                        <child.icon className="size-3.5" />
                        <span>{child.label}</span>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                  </Tooltip>
                </SidebarMenuItem>
              );
            })}
          </div>
        )}
      </div>
    );
  }
  const href = `/projects/${activeProjectPrefix}/${item.path}`;
  const isActive = location.pathname === href;
  return (
    <SidebarMenuItem key={item.path}>
      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarMenuButton
            isActive={isActive}
            aria-label={item.label}
            onClick={() => navigate(href)}
            className="cursor-pointer"
          >
            <item.icon />
            <span>{item.label}</span>
          </SidebarMenuButton>
        </TooltipTrigger>
        {isCollapsed && (
          <TooltipContent side="right">{item.label}</TooltipContent>
        )}
      </Tooltip>
    </SidebarMenuItem>
  );
})}
```

- [ ] **Step 3: Add WBS route to App.tsx**

In `apps/web/src/App.tsx`, add the import:
```typescript
import { WbsPage } from './pages/WbsPage';
```

Add the route after the planner route (line 40):
```typescript
<Route path="/projects/:projectPrefix/wbs" element={<WbsPage />} />
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/components/layout/AppSidebar.tsx apps/web/src/App.tsx
git commit -m "feat(wbs): install gantt-task-react, add WBS sidebar nav and route"
```

---

## Task 11: WBS Page + Core UI Components

**Files:**
- Create: `apps/web/src/pages/WbsPage.tsx`
- Create: `apps/web/src/components/wbs/WbsToolbar.tsx`
- Create: `apps/web/src/components/wbs/WbsViewToggle.tsx`
- Create: `apps/web/src/components/wbs/WbsStatusBar.tsx`
- Create: `apps/web/src/components/wbs/WbsTaskDialog.tsx`

- [ ] **Step 1: Create WbsPage**

`apps/web/src/pages/WbsPage.tsx`:
```typescript
import { useEffect, useState } from 'react';
import { useUiStore } from '@/store/uiStore';
import { useWbsPhases, useWbsDependencies } from '@/hooks/useWbs';
import { WbsToolbar } from '@/components/wbs/WbsToolbar';
import { WbsViewToggle } from '@/components/wbs/WbsViewToggle';
import { WbsTaskTree } from '@/components/wbs/WbsTaskTree';
import { WbsGanttChart } from '@/components/wbs/WbsGanttChart';
import { WbsStatusBar } from '@/components/wbs/WbsStatusBar';
import { WbsTableView } from '@/components/wbs/WbsTableView';
import { WbsTaskDialog } from '@/components/wbs/WbsTaskDialog';
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from '@/components/ui/resizable';
import type { WbsPhase } from '@/lib/types';

type ViewMode = 'gantt' | 'table';
type DialogMode = { type: 'phase' | 'task' | 'subtask'; parentId?: string; editItem?: any } | null;

export function WbsPage() {
  const projectId = useUiStore((s) => s.activeProjectId) ?? '';
  const setFullWidth = useUiStore((s) => s.setFullWidth);
  const [viewMode, setViewMode] = useState<ViewMode>('gantt');
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const { data: phases = [] } = useWbsPhases(projectId);
  const { data: dependencies = [] } = useWbsDependencies(projectId);

  useEffect(() => {
    setFullWidth(true);
    return () => setFullWidth(false);
  }, [setFullWidth]);

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const taskCount = phases.reduce((sum, p) => sum + p.tasks.length, 0);
  const subtaskCount = phases.reduce(
    (sum, p) => sum + p.tasks.reduce((s, t) => s + t.subtasks.length, 0),
    0,
  );
  const overallProgress =
    phases.length > 0
      ? Math.round(phases.reduce((sum, p) => sum + p.progress, 0) / phases.length)
      : 0;

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col">
      <WbsToolbar
        onAddPhase={() => setDialogMode({ type: 'phase' })}
      />
      <WbsViewToggle viewMode={viewMode} onChange={setViewMode} />

      <div className="flex-1 overflow-hidden">
        {viewMode === 'gantt' ? (
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={45} minSize={30}>
              <WbsTaskTree
                phases={phases}
                collapsedIds={collapsedIds}
                onToggleCollapse={toggleCollapse}
                onAddTask={(phaseId) => setDialogMode({ type: 'task', parentId: phaseId })}
                onAddSubtask={(taskId) => setDialogMode({ type: 'subtask', parentId: taskId })}
                onEditPhase={(phase) => setDialogMode({ type: 'phase', editItem: phase })}
                onEditTask={(task) => setDialogMode({ type: 'task', editItem: task })}
                onEditSubtask={(subtask) => setDialogMode({ type: 'subtask', editItem: subtask })}
                projectId={projectId}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={55} minSize={30}>
              <WbsGanttChart
                phases={phases}
                dependencies={dependencies}
                collapsedIds={collapsedIds}
                projectId={projectId}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <WbsTableView
            phases={phases}
            collapsedIds={collapsedIds}
            onToggleCollapse={toggleCollapse}
            onEditPhase={(phase) => setDialogMode({ type: 'phase', editItem: phase })}
            onEditTask={(task) => setDialogMode({ type: 'task', editItem: task })}
            onEditSubtask={(subtask) => setDialogMode({ type: 'subtask', editItem: subtask })}
            projectId={projectId}
          />
        )}
      </div>

      <WbsStatusBar
        phaseCount={phases.length}
        taskCount={taskCount}
        subtaskCount={subtaskCount}
        overallProgress={overallProgress}
      />

      {dialogMode && (
        <WbsTaskDialog
          mode={dialogMode}
          projectId={projectId}
          onClose={() => setDialogMode(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create WbsToolbar**

`apps/web/src/components/wbs/WbsToolbar.tsx`:
```typescript
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WbsToolbarProps {
  onAddPhase: () => void;
}

export function WbsToolbar({ onAddPhase }: WbsToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b px-4 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">Work Breakdown Structure</span>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onAddPhase}>
          <Plus className="size-3" /> Add Phase
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create WbsViewToggle**

`apps/web/src/components/wbs/WbsViewToggle.tsx`:
```typescript
interface WbsViewToggleProps {
  viewMode: 'gantt' | 'table';
  onChange: (mode: 'gantt' | 'table') => void;
}

export function WbsViewToggle({ viewMode, onChange }: WbsViewToggleProps) {
  return (
    <div className="flex border-b">
      <button
        className={`px-4 py-2 text-xs font-medium transition-colors ${
          viewMode === 'gantt'
            ? 'border-b-2 border-primary text-primary'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        onClick={() => onChange('gantt')}
      >
        Gantt Chart
      </button>
      <button
        className={`px-4 py-2 text-xs font-medium transition-colors ${
          viewMode === 'table'
            ? 'border-b-2 border-primary text-primary'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        onClick={() => onChange('table')}
      >
        Table View
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Create WbsStatusBar**

`apps/web/src/components/wbs/WbsStatusBar.tsx`:
```typescript
interface WbsStatusBarProps {
  phaseCount: number;
  taskCount: number;
  subtaskCount: number;
  overallProgress: number;
}

export function WbsStatusBar({ phaseCount, taskCount, subtaskCount, overallProgress }: WbsStatusBarProps) {
  return (
    <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
      <div className="flex gap-4">
        <span>{phaseCount} Phases</span>
        <span>{taskCount} Tasks</span>
        <span>{subtaskCount} Subtasks</span>
      </div>
      <div>
        Overall: <span className="text-foreground font-medium">{overallProgress}%</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create WbsTaskDialog**

`apps/web/src/components/wbs/WbsTaskDialog.tsx`:
```typescript
import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateWbsPhase, useUpdateWbsPhase,
  useCreateWbsTask, useUpdateWbsTask,
  useCreateWbsSubtask, useUpdateWbsSubtask,
} from '@/hooks/useWbs';

interface DialogMode {
  type: 'phase' | 'task' | 'subtask';
  parentId?: string;
  editItem?: any;
}

interface WbsTaskDialogProps {
  mode: DialogMode;
  projectId: string;
  onClose: () => void;
}

export function WbsTaskDialog({ mode, projectId, onClose }: WbsTaskDialogProps) {
  const isEdit = !!mode.editItem;
  const [title, setTitle] = useState(mode.editItem?.title ?? '');
  const [description, setDescription] = useState(mode.editItem?.description ?? '');
  const [planStart, setPlanStart] = useState(mode.editItem?.planStart?.slice(0, 10) ?? '');
  const [planEnd, setPlanEnd] = useState(mode.editItem?.planEnd?.slice(0, 10) ?? '');
  const [actualStart, setActualStart] = useState(mode.editItem?.actualStart?.slice(0, 10) ?? '');
  const [actualEnd, setActualEnd] = useState(mode.editItem?.actualEnd?.slice(0, 10) ?? '');
  const [progress, setProgress] = useState<string>(String(mode.editItem?.progress ?? 0));

  const createPhase = useCreateWbsPhase(projectId);
  const updatePhase = useUpdateWbsPhase(projectId);
  const createTask = useCreateWbsTask(projectId);
  const updateTask = useUpdateWbsTask(projectId);
  const createSubtask = useCreateWbsSubtask(projectId);
  const updateSubtask = useUpdateWbsSubtask(projectId);

  const handleSubmit = () => {
    if (!title.trim()) return;
    const base = { title: title.trim(), description: description.trim() || undefined };

    if (mode.type === 'phase') {
      if (isEdit) {
        updatePhase.mutate({ phaseId: mode.editItem.id, data: base }, { onSuccess: onClose });
      } else {
        createPhase.mutate(base, { onSuccess: onClose });
      }
    } else if (mode.type === 'task') {
      const dates = {
        ...base,
        ...(planStart ? { planStart } : {}),
        ...(planEnd ? { planEnd } : {}),
        ...(isEdit && actualStart ? { actualStart } : {}),
        ...(isEdit && actualEnd ? { actualEnd } : {}),
        ...(isEdit ? { progress: Number(progress) } : {}),
      };
      if (isEdit) {
        updateTask.mutate(
          { phaseId: mode.editItem.phaseId, taskId: mode.editItem.id, data: dates },
          { onSuccess: onClose },
        );
      } else {
        createTask.mutate({ phaseId: mode.parentId!, data: dates }, { onSuccess: onClose });
      }
    } else {
      const dates = {
        ...base,
        ...(planStart ? { planStart } : {}),
        ...(planEnd ? { planEnd } : {}),
        ...(isEdit && actualStart ? { actualStart } : {}),
        ...(isEdit && actualEnd ? { actualEnd } : {}),
        ...(isEdit ? { progress: Number(progress) } : {}),
      };
      if (isEdit) {
        updateSubtask.mutate(
          { taskId: mode.editItem.taskId, subtaskId: mode.editItem.id, data: dates },
          { onSuccess: onClose },
        );
      } else {
        createSubtask.mutate({ taskId: mode.parentId!, data: dates }, { onSuccess: onClose });
      }
    }
  };

  const titleLabel = mode.type === 'phase' ? 'Phase' : mode.type === 'task' ? 'Task' : 'Subtask';
  const showDates = mode.type !== 'phase';
  const showActuals = isEdit && mode.type !== 'phase';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${titleLabel}` : `New ${titleLabel}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${titleLabel} title`} autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" rows={2} />
          </div>
          {showDates && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Plan Start</label>
                <Input type="date" value={planStart} onChange={(e) => setPlanStart(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Plan End</label>
                <Input type="date" value={planEnd} onChange={(e) => setPlanEnd(e.target.value)} />
              </div>
            </div>
          )}
          {showActuals && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Actual Start</label>
                  <Input type="date" value={actualStart} onChange={(e) => setActualStart(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Actual End</label>
                  <Input type="date" value={actualEnd} onChange={(e) => setActualEnd(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Progress (%)</label>
                <Input type="number" min="0" max="100" value={progress} onChange={(e) => setProgress(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!title.trim()}>
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/WbsPage.tsx apps/web/src/components/wbs/
git commit -m "feat(wbs): add WBS page with toolbar, view toggle, status bar, and task dialog"
```

---

## Task 12: WBS Task Tree (Left Panel)

**Files:**
- Create: `apps/web/src/components/wbs/WbsTaskTree.tsx`
- Create: `apps/web/src/components/wbs/WbsTaskRow.tsx`

- [ ] **Step 1: Create WbsTaskTree**

`apps/web/src/components/wbs/WbsTaskTree.tsx`:
```typescript
import { ChevronDown, ChevronRight, Plus, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WbsTaskRow } from './WbsTaskRow';
import type { WbsPhase, WbsTask, WbsSubtask } from '@/lib/types';
import { useDeleteWbsPhase, useDeleteWbsTask, useDeleteWbsSubtask } from '@/hooks/useWbs';

interface WbsTaskTreeProps {
  phases: WbsPhase[];
  collapsedIds: Set<string>;
  onToggleCollapse: (id: string) => void;
  onAddTask: (phaseId: string) => void;
  onAddSubtask: (taskId: string) => void;
  onEditPhase: (phase: WbsPhase) => void;
  onEditTask: (task: WbsTask) => void;
  onEditSubtask: (subtask: WbsSubtask) => void;
  projectId: string;
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatProgress(p: number) {
  return `${Math.round(p)}%`;
}

export function WbsTaskTree({
  phases, collapsedIds, onToggleCollapse,
  onAddTask, onAddSubtask, onEditPhase, onEditTask, onEditSubtask, projectId,
}: WbsTaskTreeProps) {
  const deletePhase = useDeleteWbsPhase(projectId);
  const deleteTask = useDeleteWbsTask(projectId);
  const deleteSubtask = useDeleteWbsSubtask(projectId);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1fr_68px_68px_68px_68px_50px] gap-0 border-b bg-muted/30 px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <span className="pl-2">Task</span>
        <span>Plan S.</span>
        <span>Plan E.</span>
        <span>Act. S.</span>
        <span>Act. E.</span>
        <span>Prog.</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {phases.map((phase) => {
          const phaseCollapsed = collapsedIds.has(phase.id);
          const hasChildren = phase.tasks.length > 0;
          return (
            <div key={phase.id}>
              {/* Phase row */}
              <WbsTaskRow
                level={0}
                title={phase.title}
                planStart={formatDate(phase.planStart)}
                planEnd={formatDate(phase.planEnd)}
                actualStart={formatDate(phase.actualStart)}
                actualEnd={formatDate(phase.actualEnd)}
                progress={formatProgress(phase.progress)}
                isRollup={hasChildren}
                isCollapsed={phaseCollapsed}
                onToggle={() => onToggleCollapse(phase.id)}
                onEdit={() => onEditPhase(phase)}
                onDelete={() => deletePhase.mutate(phase.id)}
                onAdd={() => onAddTask(phase.id)}
              />

              {/* Tasks */}
              {!phaseCollapsed &&
                phase.tasks.map((task) => {
                  const taskCollapsed = collapsedIds.has(task.id);
                  const taskHasChildren = task.subtasks.length > 0;
                  return (
                    <div key={task.id}>
                      <WbsTaskRow
                        level={1}
                        title={task.title}
                        planStart={formatDate(task.planStart)}
                        planEnd={formatDate(task.planEnd)}
                        actualStart={formatDate(task.actualStart)}
                        actualEnd={formatDate(task.actualEnd)}
                        progress={formatProgress(task.progress)}
                        isRollup={taskHasChildren}
                        isCollapsed={taskCollapsed}
                        onToggle={taskHasChildren ? () => onToggleCollapse(task.id) : undefined}
                        onEdit={() => onEditTask(task)}
                        onDelete={() => deleteTask.mutate({ phaseId: task.phaseId, taskId: task.id })}
                        onAdd={() => onAddSubtask(task.id)}
                        backlogItemId={task.backlogItemId}
                      />

                      {/* Subtasks */}
                      {!taskCollapsed &&
                        task.subtasks.map((subtask) => (
                          <WbsTaskRow
                            key={subtask.id}
                            level={2}
                            title={subtask.title}
                            planStart={formatDate(subtask.planStart)}
                            planEnd={formatDate(subtask.planEnd)}
                            actualStart={formatDate(subtask.actualStart)}
                            actualEnd={formatDate(subtask.actualEnd)}
                            progress={formatProgress(subtask.progress)}
                            isRollup={false}
                            onEdit={() => onEditSubtask(subtask)}
                            onDelete={() =>
                              deleteSubtask.mutate({ taskId: subtask.taskId, subtaskId: subtask.id })
                            }
                            backlogItemId={subtask.backlogItemId}
                          />
                        ))}
                    </div>
                  );
                })}
            </div>
          );
        })}

        {phases.length === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            No phases yet. Click "Add Phase" to get started.
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create WbsTaskRow**

`apps/web/src/components/wbs/WbsTaskRow.tsx`:
```typescript
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Zap, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface WbsTaskRowProps {
  level: 0 | 1 | 2;
  title: string;
  planStart: string;
  planEnd: string;
  actualStart: string;
  actualEnd: string;
  progress: string;
  isRollup: boolean;
  isCollapsed?: boolean;
  onToggle?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAdd?: () => void;
  backlogItemId?: string | null;
}

const INDENT = { 0: 'pl-2', 1: 'pl-6', 2: 'pl-10' };
const BG = { 0: 'bg-muted/20', 1: '', 2: '' };

export function WbsTaskRow({
  level, title, planStart, planEnd, actualStart, actualEnd, progress,
  isRollup, isCollapsed, onToggle, onEdit, onDelete, onAdd, backlogItemId,
}: WbsTaskRowProps) {
  return (
    <div
      className={`group grid grid-cols-[1fr_68px_68px_68px_68px_50px] gap-0 border-b px-2 py-1.5 text-xs hover:bg-muted/10 ${BG[level]}`}
    >
      {/* Name cell */}
      <div className={`flex items-center gap-1 min-w-0 ${INDENT[level]}`}>
        {onToggle ? (
          <button onClick={onToggle} className="shrink-0 text-muted-foreground/60 hover:text-foreground">
            {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
        ) : level < 2 ? (
          <span className="size-3.5 shrink-0" />
        ) : null}

        {level === 0 && <span className="text-primary font-semibold truncate">{title}</span>}
        {level === 1 && <span className="text-foreground truncate">{title}</span>}
        {level === 2 && <span className="text-muted-foreground truncate">{title}</span>}

        {isRollup && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Zap className="size-3 text-amber-500 shrink-0" />
            </TooltipTrigger>
            <TooltipContent>Auto-calculated from children</TooltipContent>
          </Tooltip>
        )}

        {backlogItemId && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link className="size-3 text-blue-400 shrink-0" />
            </TooltipTrigger>
            <TooltipContent>Linked to backlog</TooltipContent>
          </Tooltip>
        )}

        {/* Hover actions */}
        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {onAdd && (
            <Button variant="ghost" size="icon" className="size-5" onClick={onAdd}>
              <Plus className="size-3" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="size-5" onClick={onEdit}>
            <Pencil className="size-3" />
          </Button>
          <Button variant="ghost" size="icon" className="size-5 text-destructive" onClick={onDelete}>
            <Trash2 className="size-3" />
          </Button>
        </div>
      </div>

      {/* Date cells */}
      <span className="text-[10px] text-muted-foreground flex items-center">{planStart}</span>
      <span className="text-[10px] text-muted-foreground flex items-center">{planEnd}</span>
      <span className="text-[10px] text-muted-foreground flex items-center">{actualStart}</span>
      <span className="text-[10px] text-muted-foreground flex items-center">{actualEnd}</span>
      <span className="text-[10px] text-muted-foreground flex items-center">{progress}</span>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/wbs/WbsTaskTree.tsx apps/web/src/components/wbs/WbsTaskRow.tsx
git commit -m "feat(wbs): add task tree panel with hierarchical rows"
```

---

## Task 13: Gantt Chart Component

**Files:**
- Create: `apps/web/src/components/wbs/WbsGanttChart.tsx`

- [ ] **Step 1: Create WbsGanttChart wrapper**

`apps/web/src/components/wbs/WbsGanttChart.tsx`:
```typescript
import { useMemo } from 'react';
import { Gantt, Task, ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import { useUpdateWbsTask, useUpdateWbsSubtask } from '@/hooks/useWbs';
import type { WbsPhase, WbsDependency } from '@/lib/types';

interface WbsGanttChartProps {
  phases: WbsPhase[];
  dependencies: WbsDependency[];
  collapsedIds: Set<string>;
  projectId: string;
}

function toDate(d: string | null, fallback: Date): Date {
  return d ? new Date(d) : fallback;
}

export function WbsGanttChart({ phases, dependencies, collapsedIds, projectId }: WbsGanttChartProps) {
  const updateTask = useUpdateWbsTask(projectId);
  const updateSubtask = useUpdateWbsSubtask(projectId);

  const tasks: Task[] = useMemo(() => {
    const result: Task[] = [];
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    for (const phase of phases) {
      // Phase bar (project type for summary)
      result.push({
        start: toDate(phase.planStart, now),
        end: toDate(phase.planEnd, weekFromNow),
        name: phase.title,
        id: phase.id,
        progress: phase.progress,
        type: 'project',
        hideChildren: collapsedIds.has(phase.id),
        styles: { backgroundColor: '#7c3aed', progressColor: '#a78bfa' },
      });

      if (collapsedIds.has(phase.id)) continue;

      for (const task of phase.tasks) {
        const hasSubtasks = task.subtasks.length > 0;
        result.push({
          start: toDate(task.planStart, now),
          end: toDate(task.planEnd, weekFromNow),
          name: task.title,
          id: task.id,
          progress: task.progress,
          type: hasSubtasks ? 'project' : 'task',
          project: phase.id,
          hideChildren: collapsedIds.has(task.id),
          dependencies: dependencies
            .filter((d) => d.targetId === task.id && d.targetType === 'TASK')
            .map((d) => d.sourceId),
          styles: hasSubtasks
            ? { backgroundColor: '#3b82f6', progressColor: '#60a5fa' }
            : { backgroundColor: '#3b82f6', progressColor: '#22c55e' },
        });

        if (collapsedIds.has(task.id)) continue;

        for (const sub of task.subtasks) {
          result.push({
            start: toDate(sub.planStart, now),
            end: toDate(sub.planEnd, weekFromNow),
            name: sub.title,
            id: sub.id,
            progress: sub.progress,
            type: 'task',
            project: task.id,
            dependencies: dependencies
              .filter((d) => d.targetId === sub.id && d.targetType === 'SUBTASK')
              .map((d) => d.sourceId),
            styles: { backgroundColor: '#6366f1', progressColor: '#22c55e' },
          });
        }
      }
    }
    return result;
  }, [phases, dependencies, collapsedIds]);

  const handleDateChange = (task: Task) => {
    // Determine if this is a task or subtask by checking phases
    for (const phase of phases) {
      const wbsTask = phase.tasks.find((t) => t.id === task.id);
      if (wbsTask && wbsTask.subtasks.length === 0) {
        updateTask.mutate({
          phaseId: wbsTask.phaseId,
          taskId: wbsTask.id,
          data: {
            planStart: task.start.toISOString(),
            planEnd: task.end.toISOString(),
          },
        });
        return;
      }
      for (const t of phase.tasks) {
        const sub = t.subtasks.find((s) => s.id === task.id);
        if (sub) {
          updateSubtask.mutate({
            taskId: sub.taskId,
            subtaskId: sub.id,
            data: {
              planStart: task.start.toISOString(),
              planEnd: task.end.toISOString(),
            },
          });
          return;
        }
      }
    }
  };

  const handleProgressChange = (task: Task) => {
    for (const phase of phases) {
      const wbsTask = phase.tasks.find((t) => t.id === task.id);
      if (wbsTask && wbsTask.subtasks.length === 0) {
        updateTask.mutate({
          phaseId: wbsTask.phaseId,
          taskId: wbsTask.id,
          data: { progress: task.progress },
        });
        return;
      }
      for (const t of phase.tasks) {
        const sub = t.subtasks.find((s) => s.id === task.id);
        if (sub) {
          updateSubtask.mutate({
            taskId: sub.taskId,
            subtaskId: sub.id,
            data: { progress: task.progress },
          });
          return;
        }
      }
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Add phases and tasks to see the Gantt chart
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto [&_.ganttTable]:hidden">
      <Gantt
        tasks={tasks}
        viewMode={ViewMode.Week}
        onDateChange={handleDateChange}
        onProgressChange={handleProgressChange}
        listCellWidth=""
        columnWidth={60}
        barCornerRadius={4}
        todayColor="rgba(239, 68, 68, 0.08)"
        projectBackgroundColor="#7c3aed"
        projectProgressColor="#a78bfa"
        barProgressColor="#22c55e"
        barBackgroundColor="#3b82f6"
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/wbs/WbsGanttChart.tsx
git commit -m "feat(wbs): add Gantt chart component with drag and progress support"
```

---

## Task 14: Table View + Backlog Link Components

**Files:**
- Create: `apps/web/src/components/wbs/WbsTableView.tsx`
- Create: `apps/web/src/components/wbs/WbsBacklogLink.tsx`

- [ ] **Step 1: Create WbsTableView**

`apps/web/src/components/wbs/WbsTableView.tsx`:
```typescript
import { WbsTaskTree } from './WbsTaskTree';
import type { WbsPhase, WbsTask, WbsSubtask } from '@/lib/types';

interface WbsTableViewProps {
  phases: WbsPhase[];
  collapsedIds: Set<string>;
  onToggleCollapse: (id: string) => void;
  onEditPhase: (phase: WbsPhase) => void;
  onEditTask: (task: WbsTask) => void;
  onEditSubtask: (subtask: WbsSubtask) => void;
  projectId: string;
}

export function WbsTableView({
  phases, collapsedIds, onToggleCollapse,
  onEditPhase, onEditTask, onEditSubtask, projectId,
}: WbsTableViewProps) {
  return (
    <div className="h-full overflow-auto">
      <WbsTaskTree
        phases={phases}
        collapsedIds={collapsedIds}
        onToggleCollapse={onToggleCollapse}
        onAddTask={() => {}}
        onAddSubtask={() => {}}
        onEditPhase={onEditPhase}
        onEditTask={onEditTask}
        onEditSubtask={onEditSubtask}
        projectId={projectId}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create WbsBacklogLink**

`apps/web/src/components/wbs/WbsBacklogLink.tsx`:
```typescript
import { useState } from 'react';
import { Link, Unlink, Search } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useLinkWbsBacklog, useUnlinkWbsBacklog } from '@/hooks/useWbs';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

interface WbsBacklogLinkProps {
  nodeType: 'task' | 'subtask';
  nodeId: string;
  backlogItemId: string | null;
  projectId: string;
}

export function WbsBacklogLink({ nodeType, nodeId, backlogItemId, projectId }: WbsBacklogLinkProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const linkMutation = useLinkWbsBacklog(projectId);
  const unlinkMutation = useUnlinkWbsBacklog(projectId);

  const { data: tasks = [] } = useQuery({
    queryKey: ['backlog-tasks', projectId],
    queryFn: () => api.getTasks(projectId),
    enabled: open && !!projectId,
  });

  const filtered = tasks.filter((t: any) =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    (t.taskKey && t.taskKey.toLowerCase().includes(search.toLowerCase())),
  );

  if (backlogItemId) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="h-6 text-xs gap-1 text-blue-400"
        onClick={() => unlinkMutation.mutate({ nodeType, nodeId })}
      >
        <Unlink className="size-3" /> Unlink
      </Button>
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 text-xs gap-1"
        onClick={() => setOpen(true)}
      >
        <Link className="size-3" /> Link Backlog
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Link Backlog Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {filtered.map((task: any) => (
                <button
                  key={task.id}
                  className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted/50 flex items-center gap-2"
                  onClick={() => {
                    linkMutation.mutate(
                      { nodeType, nodeId, data: { backlogItemId: task.id } },
                      { onSuccess: () => setOpen(false) },
                    );
                  }}
                >
                  <span className="text-xs text-muted-foreground">{task.taskKey}</span>
                  <span className="truncate">{task.title}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No tasks found</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/wbs/WbsTableView.tsx apps/web/src/components/wbs/WbsBacklogLink.tsx
git commit -m "feat(wbs): add table view and backlog linking components"
```

---

## Task 15: Final Integration + Verify Build

- [ ] **Step 1: Verify API builds**

```bash
cd apps/api && npx nest build
```

Expected: Build succeeds.

- [ ] **Step 2: Verify frontend builds**

```bash
cd apps/web && npx vite build
```

Expected: Build succeeds.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(wbs): complete WBS module with Gantt chart, backlog linking, and auto-rollup"
```
