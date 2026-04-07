# Sub-Tasks & Time Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the lightweight SubTask model with self-referencing Task hierarchy (one level), add time estimation/logging with dual progress bars, and enable expandable parent/child rows in the tasks table.

**Architecture:** The existing `SubTask` model is removed. Tasks gain `parentId`, `estimatedMinutes`, and `subTaskSequence` fields for hierarchy and estimation. The existing `TimeLog` model gains a `comment` field. New time-log endpoints handle CRUD. The frontend gets dual progress bars in the right sidebar, a time logs section in the left panel, sub-task cards, and expandable table rows. All computed values (totals, over-budget) are calculated at query time, not stored.

**Tech Stack:** Prisma 7, NestJS 11, React 19, TanStack Query, shadcn/ui, Tailwind CSS, Socket.IO

---

### Task 1: Prisma Schema — Add Task Hierarchy & TimeLog Comment

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add parentId, estimatedMinutes, subTaskSequence to Task model**

In `apps/api/prisma/schema.prisma`, find the Task model (line 201). Add these three fields after `updatedAt` (line 221), and add the self-referencing relations after the `history` relation (line 233):

```prisma
model Task {
  id                  String      @id @default(cuid())
  title               String
  taskKey             String?   @unique
  description         String?
  storyPoints         Int?
  acceptanceCriteria  String?
  priority            Priority?
  plannedStartDate    DateTime?
  plannedEndDate      DateTime?
  actualStartDate     DateTime?
  actualEndDate       DateTime?
  isDraft             Boolean     @default(false)
  blueprintId         String?
  projectId           String
  sprintId            String?
  assigneeId          String?
  workflowStatusId    String?
  creatorId           String
  parentId            String?
  estimatedMinutes    Int?
  subTaskSequence     Int         @default(0)
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt

  project        Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  sprint         Sprint?   @relation(fields: [sprintId], references: [id])
  assignee       User?     @relation("TaskAssignee", fields: [assigneeId], references: [id])
  creator        User      @relation("TaskCreator", fields: [creatorId], references: [id])
  workflowStatus WorkflowStatus? @relation("TaskWorkflowStatus", fields: [workflowStatusId], references: [id], onDelete: SetNull)
  parent         Task?     @relation("TaskChildren", fields: [parentId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  children       Task[]    @relation("TaskChildren")
  comments       Comment[]
  timeLogs       TimeLog[]
  blueprintSyncs BlueprintSync[]
  attachments    Attachment[]
  history        TaskHistory[]
}
```

Remove the `subTasks SubTask[]` relation from Task.

- [ ] **Step 2: Add comment field to TimeLog model**

Find the TimeLog model (line 252). Add `comment` after `blueprintId`:

```prisma
model TimeLog {
  id          String    @id @default(cuid())
  minutes     Int
  loggedAt    DateTime  @default(now())
  comment     String?
  taskId      String
  userId      String
  blueprintId String?

  task        Task      @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user        User      @relation(fields: [userId], references: [id])
}
```

- [ ] **Step 3: Remove the SubTask model entirely**

Delete the entire SubTask model block (lines 344-360):

```prisma
// DELETE THIS ENTIRE BLOCK:
// =====================
// SUB-TASKS
// =====================

model SubTask {
  id         String     @id @default(cuid())
  title      String
  parentId         String
  assigneeId       String?
  workflowStatusId String?
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt

  parent         Task           @relation(fields: [parentId], references: [id], onDelete: Cascade)
  assignee       User?          @relation("SubTaskAssignee", fields: [assigneeId], references: [id])
  workflowStatus WorkflowStatus? @relation("SubTaskWorkflowStatus", fields: [workflowStatusId], references: [id], onDelete: SetNull)
}
```

- [ ] **Step 4: Remove SubTask references from User model**

In the User model (line 124), delete the line:

```prisma
  assignedSubTasks        SubTask[]     @relation("SubTaskAssignee")
```

- [ ] **Step 5: Remove SubTask reference from WorkflowStatus model**

In the WorkflowStatus model (line 53), delete the line:

```prisma
  subTasks        SubTask[]            @relation("SubTaskWorkflowStatus")
```

- [ ] **Step 6: Generate and apply migration**

```bash
cd apps/api && npx prisma migrate dev --name add-task-hierarchy-timelog-comment
```

Expected: Migration creates successfully. The `SubTask` table is dropped, `parentId`/`estimatedMinutes`/`subTaskSequence` columns added to `Task`, `comment` column added to `TimeLog`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat: add task hierarchy fields and remove SubTask model"
```

---

### Task 2: Backend — TimeLog DTOs and Service

**Files:**
- Create: `apps/api/src/time-logs/time-logs.module.ts`
- Create: `apps/api/src/time-logs/time-logs.controller.ts`
- Create: `apps/api/src/time-logs/time-logs.service.ts`
- Create: `apps/api/src/time-logs/dto/create-time-log.dto.ts`

- [ ] **Step 1: Create the TimeLog DTO**

Create `apps/api/src/time-logs/dto/create-time-log.dto.ts`:

```typescript
import { IsInt, IsOptional, IsString, Min, Max, IsDateString } from 'class-validator';

export class CreateTimeLogDto {
  @IsInt()
  @Min(1)
  @Max(1440) // max 24 hours
  minutes: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsDateString()
  loggedAt?: string;
}
```

- [ ] **Step 2: Create the TimeLog service**

Create `apps/api/src/time-logs/time-logs.service.ts`:

```typescript
import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTimeLogDto } from './dto/create-time-log.dto';

@Injectable()
export class TimeLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(projectId: string, taskId: string, userId: string, dto: CreateTimeLogDto) {
    // Verify task exists and belongs to this project
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true, taskKey: true, _count: { select: { children: true } } },
    });

    if (!task || task.projectId !== projectId) {
      throw new NotFoundException('Task not found');
    }

    // Cannot log time on a parent task
    if (task._count.children > 0) {
      throw new BadRequestException('Cannot log time on a task that has sub-tasks. Log time on sub-tasks instead.');
    }

    const timeLog = await this.prisma.timeLog.create({
      data: {
        minutes: dto.minutes,
        comment: dto.comment,
        loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : new Date(),
        taskId,
        userId,
      },
      include: {
        user: { select: { id: true, username: true, email: true } },
      },
    });

    // Create activity log entry
    const hours = Math.floor(dto.minutes / 60);
    const mins = dto.minutes % 60;
    const formatted = hours > 0 ? (mins > 0 ? `${hours}h ${mins}m` : `${hours}h`) : `${mins}m`;

    await this.prisma.taskHistory.create({
      data: {
        taskId,
        actorId: userId,
        field: 'timeLog',
        oldValue: null,
        newValue: `${formatted}${dto.comment ? ` — ${dto.comment}` : ''}`,
      },
    });

    this.notifications.notifyProject(projectId, 'task:updated', { projectId, taskId, task: { id: taskId } });

    return timeLog;
  }

  async findAll(taskId: string) {
    return this.prisma.timeLog.findMany({
      where: { taskId },
      orderBy: { loggedAt: 'desc' },
      include: {
        user: { select: { id: true, username: true, email: true } },
      },
    });
  }

  async remove(projectId: string, taskId: string, timeLogId: string, userId: string, userRole: string) {
    const timeLog = await this.prisma.timeLog.findUnique({
      where: { id: timeLogId },
      select: { id: true, userId: true, taskId: true, task: { select: { projectId: true } } },
    });

    if (!timeLog || timeLog.taskId !== taskId || timeLog.task.projectId !== projectId) {
      throw new NotFoundException('Time log not found');
    }

    // Only the author or a PM can delete
    if (timeLog.userId !== userId && userRole !== 'pm') {
      throw new ForbiddenException('Only the author or a PM can delete time logs');
    }

    await this.prisma.timeLog.delete({ where: { id: timeLogId } });

    this.notifications.notifyProject(projectId, 'task:updated', { projectId, taskId, task: { id: taskId } });
  }
}
```

- [ ] **Step 3: Create the TimeLog controller**

Create `apps/api/src/time-logs/time-logs.controller.ts`:

```typescript
import { Controller, Get, Post, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { TimeLogsService } from './time-logs.service';
import { CreateTimeLogDto } from './dto/create-time-log.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { ProjectRoles } from '../auth/project-roles.decorator';

@Controller('projects/:projectId/tasks/:taskId/time-logs')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class TimeLogsController {
  constructor(private readonly timeLogsService: TimeLogsService) {}

  @Post()
  @ProjectRoles('pm', 'ba', 'developer', 'qc')
  create(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Req() req: any,
    @Body() dto: CreateTimeLogDto,
  ) {
    return this.timeLogsService.create(projectId, taskId, req.user.id, dto);
  }

  @Get()
  findAll(@Param('taskId') taskId: string) {
    return this.timeLogsService.findAll(taskId);
  }

  @Delete(':timeLogId')
  @ProjectRoles('pm', 'ba', 'developer', 'qc')
  remove(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('timeLogId') timeLogId: string,
    @Req() req: any,
  ) {
    return this.timeLogsService.remove(projectId, taskId, timeLogId, req.user.id, req.user.projectRole);
  }
}
```

- [ ] **Step 4: Create the TimeLog module**

Create `apps/api/src/time-logs/time-logs.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TimeLogsController } from './time-logs.controller';
import { TimeLogsService } from './time-logs.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [TimeLogsController],
  providers: [TimeLogsService],
})
export class TimeLogsModule {}
```

- [ ] **Step 5: Register TimeLogsModule in AppModule**

In `apps/api/src/app.module.ts`, add the import:

```typescript
import { TimeLogsModule } from './time-logs/time-logs.module';
```

And add `TimeLogsModule` to the `imports` array.

- [ ] **Step 6: Verify the backend compiles**

```bash
cd apps/api && npx nest build
```

Expected: Build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/time-logs/ apps/api/src/app.module.ts
git commit -m "feat: add time-logs module with CRUD endpoints"
```

---

### Task 3: Backend — Update Task Service for Hierarchy

**Files:**
- Modify: `apps/api/src/tasks/tasks.service.ts`
- Modify: `apps/api/src/tasks/dto/create-task.dto.ts`
- Modify: `apps/api/src/tasks/dto/update-task.dto.ts`
- Delete: `apps/api/src/tasks/dto/create-subtask.dto.ts`

- [ ] **Step 1: Update CreateTaskDto — add parentId and estimatedMinutes**

In `apps/api/src/tasks/dto/create-task.dto.ts`, add these fields:

```typescript
  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedMinutes?: number;
```

Add `IsInt` and `Min` to the imports from `class-validator`.

- [ ] **Step 2: Update UpdateTaskDto — add estimatedMinutes**

In `apps/api/src/tasks/dto/update-task.dto.ts`, add:

```typescript
  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedMinutes?: number | null;
```

Add `IsInt` and `Min` to the imports from `class-validator`.

- [ ] **Step 3: Delete create-subtask.dto.ts**

```bash
rm apps/api/src/tasks/dto/create-subtask.dto.ts
```

- [ ] **Step 4: Update task creation in tasks.service.ts — support parentId**

Replace the `create` method in `apps/api/src/tasks/tasks.service.ts` with:

```typescript
  async create(projectId: string, creatorId: string, dto: CreateTaskDto) {
    const task = await this.prisma.$transaction(async (tx) => {
      let taskKey: string | null = null;

      if (dto.parentId) {
        // Creating a sub-task
        const parent = await tx.task.findUnique({
          where: { id: dto.parentId },
          select: { id: true, projectId: true, parentId: true, taskKey: true },
        });

        if (!parent || parent.projectId !== projectId) {
          throw new BadRequestException('Parent task not found in this project');
        }
        if (parent.parentId) {
          throw new BadRequestException('Cannot create sub-tasks on a sub-task (max 1 level)');
        }

        // Atomically increment parent's subTaskSequence
        const updatedParent = await tx.task.update({
          where: { id: dto.parentId },
          data: { subTaskSequence: { increment: 1 } },
          select: { taskKey: true, subTaskSequence: true },
        });

        taskKey = updatedParent.taskKey
          ? `${updatedParent.taskKey}-${updatedParent.subTaskSequence}`
          : null;
      } else {
        // Creating a top-level task — existing behavior
        const project = await tx.project.update({
          where: { id: projectId },
          data: { taskSeq: { increment: 1 } },
          select: { prefix: true, taskSeq: true },
        });
        taskKey = project.prefix ? `${project.prefix}-${project.taskSeq}` : null;
      }

      const defaultStatus = await tx.workflowStatus.findFirst({
        where: { projectId, isDefault: true },
      });

      return tx.task.create({
        data: {
          projectId,
          creatorId,
          title: dto.title,
          taskKey,
          description: dto.description,
          workflowStatusId: defaultStatus?.id ?? null,
          assigneeId: dto.assigneeId,
          storyPoints: dto.storyPoints,
          sprintId: dto.sprintId,
          acceptanceCriteria: dto.acceptanceCriteria,
          priority: dto.priority,
          parentId: dto.parentId,
          estimatedMinutes: dto.estimatedMinutes,
          plannedStartDate: dto.plannedStartDate ? new Date(dto.plannedStartDate) : undefined,
          plannedEndDate: dto.plannedEndDate ? new Date(dto.plannedEndDate) : undefined,
          actualStartDate: dto.actualStartDate ? new Date(dto.actualStartDate) : undefined,
          actualEndDate: dto.actualEndDate ? new Date(dto.actualEndDate) : undefined,
        },
        include: {
          assignee: { select: { id: true, username: true, email: true } },
          sprint: true,
          workflowStatus: true,
        },
      });
    });

    this.notifications.notifyProject(projectId, 'task:created', { projectId, task });
    return task;
  }
```

Add `BadRequestException` to the imports from `@nestjs/common`.

- [ ] **Step 5: Update findByTaskKey to include children and timeLogs**

Replace the `findByTaskKey` method:

```typescript
  async findByTaskKey(projectId: string, taskKey: string) {
    const task = await this.prisma.task.findUnique({
      where: { taskKey },
      include: {
        assignee: { select: { id: true, username: true, email: true } },
        creator: { select: { id: true, username: true, email: true } },
        workflowStatus: true,
        sprint: true,
        children: {
          orderBy: { createdAt: 'asc' },
          include: {
            assignee: { select: { id: true, username: true, email: true } },
            workflowStatus: true,
            timeLogs: { select: { minutes: true } },
          },
        },
        timeLogs: {
          orderBy: { loggedAt: 'desc' },
          include: { user: { select: { id: true, username: true, email: true } } },
        },
        parent: {
          select: { id: true, taskKey: true, title: true },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: { id: true, username: true, email: true } },
            replies: {
              orderBy: { createdAt: 'asc' },
              include: { author: { select: { id: true, username: true, email: true } } },
            },
          },
          where: { parentId: null },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
          include: { uploader: { select: { id: true, username: true, email: true } } },
        },
      },
    });

    if (!task || task.projectId !== projectId) return null;
    return task;
  }
```

- [ ] **Step 6: Update findAll to return only top-level tasks with children summary**

Replace the `findAll` method:

```typescript
  async findAll(projectId: string) {
    return this.prisma.task.findMany({
      where: { projectId, parentId: null },
      orderBy: { createdAt: 'desc' },
      include: {
        assignee: { select: { id: true, username: true, email: true } },
        sprint: true,
        workflowStatus: true,
        children: {
          orderBy: { createdAt: 'asc' },
          include: {
            assignee: { select: { id: true, username: true, email: true } },
            workflowStatus: true,
            timeLogs: { select: { minutes: true } },
          },
        },
        timeLogs: { select: { minutes: true } },
      },
    });
  }
```

- [ ] **Step 7: Update the update method — handle estimatedMinutes and reject on parent**

In the `update` method, add this validation near the top (after fetching `current`):

```typescript
    // Reject estimatedMinutes on parent tasks
    if (dto.estimatedMinutes !== undefined) {
      const childCount = await this.prisma.task.count({ where: { parentId: taskId } });
      if (childCount > 0) {
        throw new BadRequestException('Cannot set estimate on a parent task. Estimates are auto-summed from sub-tasks.');
      }
    }
```

Add `estimatedMinutes` to the update data object (alongside existing fields like `storyPoints`, `assigneeId`, etc.):

```typescript
    estimatedMinutes: dto.estimatedMinutes !== undefined ? dto.estimatedMinutes : undefined,
```

And add `estimatedMinutes` to the tracked fields for history:

```typescript
    if (dto.estimatedMinutes !== undefined && dto.estimatedMinutes !== current.estimatedMinutes) {
      const oldFormatted = current.estimatedMinutes ? this.formatMinutes(current.estimatedMinutes) : null;
      const newFormatted = dto.estimatedMinutes ? this.formatMinutes(dto.estimatedMinutes) : null;
      historyEntries.push({
        taskId,
        actorId,
        field: 'estimatedMinutes',
        oldValue: oldFormatted,
        newValue: newFormatted,
      });
    }
```

- [ ] **Step 8: Add formatMinutes helper to tasks.service.ts**

Add this private method to the TasksService class:

```typescript
  private formatMinutes(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }
```

- [ ] **Step 9: Remove old sub-task methods from tasks.service.ts**

Delete the `createSubTask`, `updateSubTask`, and `deleteSubTask` methods entirely from the service.

- [ ] **Step 10: Remove old sub-task endpoints from tasks.controller.ts**

In `apps/api/src/tasks/tasks.controller.ts`, remove these endpoints:
- `@Post(':taskId/subtasks')` — `createSubTask`
- `@Patch(':taskId/subtasks/:subTaskId')` — `updateSubTask`
- `@Delete(':taskId/subtasks/:subTaskId')` — `deleteSubTask`

Also remove the `CreateSubTaskDto` import.

- [ ] **Step 11: Verify the backend compiles**

```bash
cd apps/api && npx nest build
```

Expected: Build succeeds with no errors.

- [ ] **Step 12: Commit**

```bash
git add apps/api/src/tasks/
git commit -m "feat: update task service for hierarchy, remove old sub-task endpoints"
```

---

### Task 4: Frontend — Update Types, API Client, and Hooks

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/hooks/useTasks.ts`

- [ ] **Step 1: Update types.ts — replace SubTask interface, add TimeLog, update Task**

In `apps/web/src/lib/types.ts`, replace the `SubTask` interface (lines 151-161) with:

```typescript
export interface TimeLog {
  id: string;
  minutes: number;
  loggedAt: string;
  comment: string | null;
  taskId: string;
  userId: string;
  user?: Pick<User, 'id' | 'username' | 'email'>;
}
```

Update the `Task` interface (lines 163-188). Replace `subTasks?: SubTask[]` with new fields:

```typescript
export interface Task {
  id: string;
  taskKey: string | null;
  title: string;
  description: string | null;
  workflowStatusId: string | null;
  workflowStatus?: WorkflowStatus | null;
  storyPoints: number | null;
  assigneeId: string | null;
  sprintId: string | null;
  projectId: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  assignee?: User | null;
  createdBy?: User;
  sprint?: Sprint | null;
  project?: Pick<Project, 'id' | 'name' | 'prefix'>;
  children?: Task[];
  parent?: Pick<Task, 'id' | 'taskKey' | 'title'> | null;
  parentId?: string | null;
  estimatedMinutes?: number | null;
  timeLogs?: TimeLog[];
  acceptanceCriteria?: string | null;
  priority?: Priority | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
}
```

Update `CreateTaskPayload` — add `parentId` and `estimatedMinutes`:

```typescript
export interface CreateTaskPayload {
  title: string;
  description?: string;
  storyPoints?: number;
  assigneeId?: string;
  sprintId?: string;
  acceptanceCriteria?: string;
  priority?: Priority;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  parentId?: string;
  estimatedMinutes?: number;
}
```

Update `UpdateTaskPayload` — add `estimatedMinutes`:

```typescript
export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  workflowStatusId?: string;
  storyPoints?: number;
  assigneeId?: string | null;
  sprintId?: string | null;
  acceptanceCriteria?: string;
  priority?: Priority | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  estimatedMinutes?: number | null;
}
```

Remove `CreateSubTaskPayload` and `UpdateSubTaskPayload` interfaces.

Add a `CreateTimeLogPayload`:

```typescript
export interface CreateTimeLogPayload {
  minutes: number;
  comment?: string;
  loggedAt?: string;
}
```

- [ ] **Step 2: Update api.ts — replace sub-task endpoints with time-log endpoints**

In `apps/web/src/lib/api.ts`, remove the three sub-task methods (`createSubTask`, `updateSubTask`, `deleteSubTask`).

Remove `CreateSubTaskPayload` and `UpdateSubTaskPayload` from the type imports.

Add `TimeLog` and `CreateTimeLogPayload` to the type imports.

Add time-log endpoints:

```typescript
  // TIME LOGS
  getTimeLogs: (projectId: string, taskId: string) =>
    request<TimeLog[]>(`/projects/${projectId}/tasks/${taskId}/time-logs`),

  createTimeLog: (projectId: string, taskId: string, data: CreateTimeLogPayload) =>
    request<TimeLog>(`/projects/${projectId}/tasks/${taskId}/time-logs`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteTimeLog: (projectId: string, taskId: string, timeLogId: string) =>
    request<void>(`/projects/${projectId}/tasks/${taskId}/time-logs/${timeLogId}`, {
      method: 'DELETE',
    }),
```

- [ ] **Step 3: Add useTimeLogs hook**

In `apps/web/src/hooks/useTasks.ts`, add these hooks:

```typescript
export function useTimeLogs(projectId: string, taskId: string) {
  return useQuery({
    queryKey: ['time-logs', projectId, taskId],
    queryFn: () => api.getTimeLogs(projectId, taskId),
    enabled: !!projectId && !!taskId,
  });
}

export function useCreateTimeLog(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: CreateTimeLogPayload }) =>
      api.createTimeLog(projectId, taskId, data),
    onSuccess: (_data, { taskId }) => {
      void queryClient.invalidateQueries({ queryKey: ['time-logs', projectId, taskId] });
      void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['task-history', projectId, taskId] });
      toast.success('Time logged');
    },
    onError: () => toast.error('Failed to log time'),
  });
}

export function useDeleteTimeLog(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, timeLogId }: { taskId: string; timeLogId: string }) =>
      api.deleteTimeLog(projectId, taskId, timeLogId),
    onSuccess: (_data, { taskId }) => {
      void queryClient.invalidateQueries({ queryKey: ['time-logs', projectId, taskId] });
      void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Time log deleted');
    },
    onError: () => toast.error('Failed to delete time log'),
  });
}
```

Add `CreateTimeLogPayload` to the imports from `types.ts`. Ensure `toast` is imported.

- [ ] **Step 4: Verify frontend compiles**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: Compilation errors related to TaskDetailPage references to old `subTasks` — this is expected and will be fixed in Task 5.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts apps/web/src/hooks/useTasks.ts
git commit -m "feat: update frontend types, API client, and hooks for time logging"
```

---

### Task 5: Frontend — Shared formatMinutes Utility

**Files:**
- Create: `apps/web/src/lib/time-utils.ts`

- [ ] **Step 1: Create the time formatting utility**

Create `apps/web/src/lib/time-utils.ts`:

```typescript
/** Format minutes into human-readable duration: "2h 30m", "45m", "1h" */
export function formatMinutes(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/** Calculate total estimated minutes for a task (auto-sum from children if parent) */
export function getTotalEstimated(task: { estimatedMinutes?: number | null; children?: { estimatedMinutes?: number | null }[] }): number {
  if (task.children && task.children.length > 0) {
    return task.children.reduce((sum, c) => sum + (c.estimatedMinutes ?? 0), 0);
  }
  return task.estimatedMinutes ?? 0;
}

/** Calculate total logged minutes for a task (auto-sum from children if parent) */
export function getTotalLogged(task: { timeLogs?: { minutes: number }[]; children?: { timeLogs?: { minutes: number }[] }[] }): number {
  if (task.children && task.children.length > 0) {
    return task.children.reduce((sum, c) => {
      const childLogged = c.timeLogs?.reduce((s, tl) => s + tl.minutes, 0) ?? 0;
      return sum + childLogged;
    }, 0);
  }
  return task.timeLogs?.reduce((s, tl) => s + tl.minutes, 0) ?? 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/time-utils.ts
git commit -m "feat: add time formatting and computation utilities"
```

---

### Task 6: Frontend — Time Tracking Card (Right Sidebar)

**Files:**
- Create: `apps/web/src/components/tasks/TimeTrackingCard.tsx`

- [ ] **Step 1: Create the TimeTrackingCard component**

Create `apps/web/src/components/tasks/TimeTrackingCard.tsx`:

```tsx
import { formatMinutes, getTotalEstimated, getTotalLogged } from '../../lib/time-utils';
import type { Task } from '../../lib/types';

interface TimeTrackingCardProps {
  task: Task;
  onEstimateChange?: (minutes: number | null) => void;
  isParent: boolean;
}

export function TimeTrackingCard({ task, onEstimateChange, isParent }: TimeTrackingCardProps) {
  const totalEstimated = getTotalEstimated(task);
  const totalLogged = getTotalLogged(task);
  const isOverBudget = totalEstimated > 0 && totalLogged > totalEstimated;
  const remaining = totalEstimated - totalLogged;
  const progressPercent = totalEstimated > 0 ? Math.min((totalLogged / totalEstimated) * 100, 100) : 0;

  const estimateHours = task.estimatedMinutes ? Math.floor(task.estimatedMinutes / 60) : '';
  const estimateMinutesRemainder = task.estimatedMinutes ? task.estimatedMinutes % 60 : '';

  const handleEstimateBlur = (hoursStr: string, minsStr: string) => {
    const h = parseInt(hoursStr) || 0;
    const m = parseInt(minsStr) || 0;
    const total = h * 60 + m;
    onEstimateChange?.(total > 0 ? total : null);
  };

  return (
    <div className="border border-border rounded-lg p-3 space-y-3">
      <h4 className="text-sm font-semibold">Time Tracking</h4>

      {/* Estimate bar */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-blue-500">Estimate</span>
          <span className="text-muted-foreground">{formatMinutes(totalEstimated)}</span>
        </div>
        <div className="h-2 bg-muted rounded-full">
          <div className="h-2 bg-blue-500 rounded-full" style={{ width: '100%' }} />
        </div>
      </div>

      {/* Actual bar */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className={isOverBudget ? 'text-red-500' : 'text-green-500'}>Actual</span>
          <span className={isOverBudget ? 'text-red-500 font-semibold' : 'text-muted-foreground'}>
            {formatMinutes(totalLogged)}
            {isOverBudget && ' ⚠️'}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full">
          <div
            className={`h-2 rounded-full ${isOverBudget ? 'bg-red-500' : 'bg-green-500'}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Remaining / Over */}
      {totalEstimated > 0 && (
        <div className="flex justify-between text-xs border-t border-border pt-2">
          <span className={isOverBudget ? 'text-red-500' : 'text-muted-foreground'}>
            {isOverBudget ? 'Over by' : 'Remaining'}
          </span>
          <span className={isOverBudget ? 'text-red-500 font-semibold' : 'text-green-500'}>
            {formatMinutes(Math.abs(remaining))}
          </span>
        </div>
      )}

      {/* Estimate input — only for leaf tasks */}
      {!isParent && onEstimateChange && (
        <div className="border-t border-border pt-2">
          <label className="text-xs text-muted-foreground mb-1 block">Set Estimate</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="number"
                min={0}
                placeholder="h"
                defaultValue={estimateHours}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                onBlur={(e) => {
                  const minsInput = e.target.parentElement?.nextElementSibling?.querySelector('input');
                  handleEstimateBlur(e.target.value, minsInput?.value ?? '0');
                }}
              />
            </div>
            <div className="flex-1">
              <input
                type="number"
                min={0}
                max={59}
                placeholder="m"
                defaultValue={estimateMinutesRemainder}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                onBlur={(e) => {
                  const hoursInput = e.target.parentElement?.previousElementSibling?.querySelector('input');
                  handleEstimateBlur(hoursInput?.value ?? '0', e.target.value);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {isParent && (
        <p className="text-xs text-muted-foreground italic">Auto-summed from sub-tasks</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/tasks/TimeTrackingCard.tsx
git commit -m "feat: add TimeTrackingCard component with dual progress bars"
```

---

### Task 7: Frontend — Log Time Card (Right Sidebar)

**Files:**
- Create: `apps/web/src/components/tasks/LogTimeCard.tsx`

- [ ] **Step 1: Create the LogTimeCard component**

Create `apps/web/src/components/tasks/LogTimeCard.tsx`:

```tsx
import { useState } from 'react';
import { Button } from '../ui/button';

interface LogTimeCardProps {
  onSubmit: (data: { minutes: number; comment?: string; loggedAt?: string }) => void;
  isLoading?: boolean;
}

export function LogTimeCard({ onSubmit, isLoading }: LogTimeCardProps) {
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [comment, setComment] = useState('');
  const [loggedAt, setLoggedAt] = useState(() => new Date().toISOString().split('T')[0]);

  const handleSubmit = () => {
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    const totalMinutes = h * 60 + m;
    if (totalMinutes <= 0) return;

    onSubmit({
      minutes: totalMinutes,
      comment: comment.trim() || undefined,
      loggedAt: loggedAt || undefined,
    });

    setHours('');
    setMinutes('');
    setComment('');
    setLoggedAt(new Date().toISOString().split('T')[0]);
  };

  return (
    <div className="border border-border rounded-lg p-3 space-y-3">
      <h4 className="text-sm font-semibold">Log Time</h4>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground">Hours</label>
          <input
            type="number"
            min={0}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="0"
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground">Minutes</label>
          <input
            type="number"
            min={0}
            max={59}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="0"
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          />
        </div>
        <div className="flex-[1.5]">
          <label className="text-[10px] text-muted-foreground">Date</label>
          <input
            type="date"
            value={loggedAt}
            onChange={(e) => setLoggedAt(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground">Comment</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What did you work on..."
          rows={2}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs resize-none"
        />
      </div>

      <Button onClick={handleSubmit} disabled={isLoading} className="w-full" size="sm">
        {isLoading ? 'Logging...' : 'Log Time'}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/tasks/LogTimeCard.tsx
git commit -m "feat: add LogTimeCard component for time entry"
```

---

### Task 8: Frontend — Time Logs Section (Left Panel)

**Files:**
- Create: `apps/web/src/components/tasks/TimeLogsList.tsx`

- [ ] **Step 1: Create the TimeLogsList component**

Create `apps/web/src/components/tasks/TimeLogsList.tsx`:

```tsx
import { Trash2, Clock } from 'lucide-react';
import { formatMinutes } from '../../lib/time-utils';
import type { TimeLog } from '../../lib/types';

interface TimeLogsListProps {
  timeLogs: TimeLog[];
  currentUserId: string;
  userRole: string;
  onDelete: (timeLogId: string) => void;
  isDeleting?: boolean;
}

export function TimeLogsList({ timeLogs, currentUserId, userRole, onDelete, isDeleting }: TimeLogsListProps) {
  const totalMinutes = timeLogs.reduce((sum, tl) => sum + tl.minutes, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Time Logs ({timeLogs.length})
        </h3>
        {totalMinutes > 0 && (
          <span className="text-xs text-muted-foreground">
            Total: {formatMinutes(totalMinutes)}
          </span>
        )}
      </div>

      {timeLogs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No time logged yet</p>
      ) : (
        <div className="space-y-1">
          {timeLogs.map((tl) => (
            <div
              key={tl.id}
              className="flex items-start justify-between gap-2 py-2 px-2 rounded-md hover:bg-muted/50 group text-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium">{tl.user?.username ?? 'Unknown'}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">
                    {new Date(tl.loggedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-semibold">{formatMinutes(tl.minutes)}</span>
                </div>
                {tl.comment && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{tl.comment}</p>
                )}
              </div>
              {(tl.userId === currentUserId || userRole === 'pm') && (
                <button
                  onClick={() => onDelete(tl.id)}
                  disabled={isDeleting}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity p-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/tasks/TimeLogsList.tsx
git commit -m "feat: add TimeLogsList component for left panel"
```

---

### Task 9: Frontend — Sub-Task Card Component

**Files:**
- Create: `apps/web/src/components/tasks/SubTaskCard.tsx`

- [ ] **Step 1: Create the SubTaskCard component**

Create `apps/web/src/components/tasks/SubTaskCard.tsx`:

```tsx
import { useNavigate, useParams } from 'react-router-dom';
import { formatMinutes } from '../../lib/time-utils';
import type { Task } from '../../lib/types';

interface SubTaskCardProps {
  subTask: Task;
}

export function SubTaskCard({ subTask }: SubTaskCardProps) {
  const navigate = useNavigate();
  const { projectPrefix } = useParams<{ projectPrefix: string }>();

  const estimated = subTask.estimatedMinutes ?? 0;
  const logged = subTask.timeLogs?.reduce((s, tl) => s + tl.minutes, 0) ?? 0;
  const progressPercent = estimated > 0 ? Math.min((logged / estimated) * 100, 100) : 0;
  const isOverBudget = estimated > 0 && logged > estimated;

  return (
    <div
      onClick={() => navigate(`/projects/${projectPrefix}/tasks/${subTask.taskKey}`)}
      className="border border-border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">{subTask.taskKey}</span>
            <span className="text-sm font-medium truncate">{subTask.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            {subTask.assignee && <span>👤 {subTask.assignee.username}</span>}
            {subTask.workflowStatus && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{
                  backgroundColor: `${subTask.workflowStatus.color}20`,
                  color: subTask.workflowStatus.color,
                }}
              >
                {subTask.workflowStatus.name}
              </span>
            )}
          </div>
        </div>

        {estimated > 0 && (
          <div className="text-right shrink-0">
            <div className={`text-xs ${isOverBudget ? 'text-red-500' : 'text-muted-foreground'}`}>
              {formatMinutes(logged)} / {formatMinutes(estimated)}
            </div>
            <div className="w-20 h-1 bg-muted rounded-full mt-1">
              <div
                className={`h-1 rounded-full ${isOverBudget ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/tasks/SubTaskCard.tsx
git commit -m "feat: add SubTaskCard component with progress indicator"
```

---

### Task 10: Frontend — Update TaskDetailPage

**Files:**
- Modify: `apps/web/src/pages/TaskDetailPage.tsx`

This is the largest task — it integrates all the new components into the existing page.

- [ ] **Step 1: Add new imports at the top of TaskDetailPage.tsx**

Add these imports:

```typescript
import { TimeTrackingCard } from '../components/tasks/TimeTrackingCard';
import { LogTimeCard } from '../components/tasks/LogTimeCard';
import { TimeLogsList } from '../components/tasks/TimeLogsList';
import { SubTaskCard } from '../components/tasks/SubTaskCard';
import { useCreateTimeLog, useDeleteTimeLog } from '../hooks/useTasks';
import { Plus } from 'lucide-react';
```

- [ ] **Step 2: Add time log mutations inside the component**

After the existing `updateTask` mutation, add:

```typescript
  const createTimeLog = useCreateTimeLog(projectId);
  const deleteTimeLog = useDeleteTimeLog(projectId);
```

- [ ] **Step 3: Compute parent/child state**

After the mutations, add:

```typescript
  const isParent = (task?.children?.length ?? 0) > 0;
  const hasParent = !!task?.parentId;
```

- [ ] **Step 4: Update breadcrumb for sub-task navigation**

Find the breadcrumb section in the JSX. Update it to show parent link when the task is a sub-task:

```tsx
{/* Breadcrumb */}
<div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
  <button onClick={() => navigate(`/projects/${projectPrefix}/backlog`)} className="hover:text-foreground">
    {projectPrefix}
  </button>
  {task?.parent && (
    <>
      <span>/</span>
      <button
        onClick={() => navigate(`/projects/${projectPrefix}/tasks/${task.parent!.taskKey}`)}
        className="hover:text-foreground"
      >
        {task.parent.taskKey}: {task.parent.title}
      </button>
    </>
  )}
  <span>/</span>
  <span className="text-foreground">{task?.taskKey}</span>
</div>
```

- [ ] **Step 5: Add Time Logs section to the left panel**

In the left panel, after the Acceptance Criteria section and before the Comments/Activity section, add the Time Logs section:

```tsx
{/* Time Logs Section */}
{task && (
  <div className="rounded-xl border border-border bg-card p-4">
    <TimeLogsList
      timeLogs={task.timeLogs ?? []}
      currentUserId={currentUser?.id ?? ''}
      userRole={currentUserRole ?? ''}
      onDelete={(timeLogId) =>
        deleteTimeLog.mutate({ taskId: task.id, timeLogId })
      }
      isDeleting={deleteTimeLog.isPending}
    />
  </div>
)}
```

- [ ] **Step 6: Add Sub-tasks section to the left panel**

After the Time Logs section (or after Acceptance Criteria if no time logs), add the Sub-tasks cards section:

```tsx
{/* Sub-tasks Section */}
{task && !hasParent && (
  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold">Sub-tasks ({task.children?.length ?? 0})</h3>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          const title = prompt('Sub-task title:');
          if (title?.trim()) {
            createTask.mutate({ title: title.trim(), parentId: task.id });
          }
        }}
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        Add
      </Button>
    </div>
    {task.children && task.children.length > 0 ? (
      <div className="space-y-2">
        {task.children.map((child) => (
          <SubTaskCard key={child.id} subTask={child} />
        ))}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">No sub-tasks</p>
    )}
  </div>
)}
```

You'll need a `createTask` mutation. Add this with the other mutations:

```typescript
  const createTask = useCreateTask(projectId);
```

Import `useCreateTask` from `../hooks/useTasks` (should already be available).

- [ ] **Step 7: Add Time Tracking and Log Time cards to the right sidebar**

In the right sidebar, after the Priority section and before the Planned Dates section, add:

```tsx
{/* Time Tracking */}
{task && (
  <TimeTrackingCard
    task={task}
    isParent={isParent}
    onEstimateChange={!isParent ? (minutes) => {
      updateTask.mutate({
        taskId: task.id,
        data: { estimatedMinutes: minutes },
      });
    } : undefined}
  />
)}

{/* Log Time — only for leaf tasks */}
{task && !isParent && (
  <LogTimeCard
    onSubmit={(data) => createTimeLog.mutate({ taskId: task.id, data })}
    isLoading={createTimeLog.isPending}
  />
)}
```

- [ ] **Step 8: Remove old SubTask sidebar section**

Find and remove the entire old Sub-Tasks section in the right sidebar (the one that uses `SubTaskMiniRow`, `createSubTask`, `updateSubTask`, `deleteSubTask` mutations, and the inline sub-task form). Also remove the `SubTaskMiniRow` component definition at the bottom of the file.

Remove the old sub-task mutation definitions:

```typescript
// DELETE these mutation definitions:
const createSubTask = useMutation({...});
const updateSubTask = useMutation({...});
const deleteSubTask = useMutation({...});
```

- [ ] **Step 9: Verify the page compiles**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/pages/TaskDetailPage.tsx
git commit -m "feat: integrate time tracking, time logs, and sub-task cards into task detail"
```

---

### Task 11: Frontend — Update TasksTable with Expandable Rows

**Files:**
- Modify: `apps/web/src/components/tasks/TasksTable.tsx`

- [ ] **Step 1: Add expand state and new columns**

At the top of the `TasksTable` component, add expand state:

```typescript
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleExpand = (taskId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };
```

Import `useState` from React, and import `formatMinutes` from `../../lib/time-utils`, and `ChevronRight, ChevronDown` from `lucide-react`.

- [ ] **Step 2: Add expand toggle as the first column**

Add a new column at the beginning of the columns array (before the select column):

```typescript
  {
    id: 'expand',
    header: () => null,
    cell: ({ row }) => {
      const task = row.original;
      const hasChildren = (task.children?.length ?? 0) > 0;
      if (!hasChildren) return null;
      const isExpanded = expandedRows.has(task.id);
      return (
        <button
          onClick={(e) => { e.stopPropagation(); toggleExpand(task.id); }}
          className="p-1 hover:bg-muted rounded"
        >
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      );
    },
    size: 32,
  },
```

- [ ] **Step 3: Add Est. and Logged columns**

After the existing Points column, add:

```typescript
  columnHelper.accessor(
    (row) => {
      if ((row.children?.length ?? 0) > 0) {
        return row.children!.reduce((sum, c) => sum + (c.estimatedMinutes ?? 0), 0);
      }
      return row.estimatedMinutes ?? 0;
    },
    {
      id: 'estimated',
      header: 'Est.',
      cell: ({ getValue }) => {
        const val = getValue();
        return <span className="text-xs">{val > 0 ? formatMinutes(val) : '—'}</span>;
      },
      size: 70,
    },
  ),
  columnHelper.accessor(
    (row) => {
      if ((row.children?.length ?? 0) > 0) {
        return row.children!.reduce((sum, c) => {
          return sum + (c.timeLogs?.reduce((s, tl) => s + tl.minutes, 0) ?? 0);
        }, 0);
      }
      return row.timeLogs?.reduce((s, tl) => s + tl.minutes, 0) ?? 0;
    },
    {
      id: 'logged',
      header: 'Logged',
      cell: ({ getValue, row }) => {
        const logged = getValue();
        const task = row.original;
        const estimated = (task.children?.length ?? 0) > 0
          ? task.children!.reduce((sum, c) => sum + (c.estimatedMinutes ?? 0), 0)
          : (task.estimatedMinutes ?? 0);
        const isOverBudget = estimated > 0 && logged > estimated;
        return (
          <span className={`text-xs ${isOverBudget ? 'text-red-500 font-semibold' : ''}`}>
            {logged > 0 ? formatMinutes(logged) : '—'}
            {isOverBudget && ' ⚠️'}
          </span>
        );
      },
      size: 80,
    },
  ),
```

- [ ] **Step 4: Render expanded sub-task rows**

In the table body rendering, after each `<tr>` for a row, add the expanded children rows. Find the `{table.getRowModel().rows.map((row) => (` block and after the closing `</tr>` of each row, add:

```tsx
  {expandedRows.has(row.original.id) && row.original.children?.map((child) => (
    <tr
      key={child.id}
      className="bg-muted/30 cursor-pointer hover:bg-muted/50"
      onClick={() => navigate(`/projects/${projectPrefix}/tasks/${child.taskKey}`)}
    >
      <td /> {/* expand column — empty for children */}
      <td /> {/* select column — empty for children */}
      <td className="py-2 px-3">
        <div className="flex items-center gap-2 pl-4">
          <span className="text-muted-foreground">└</span>
          <span className="text-xs text-muted-foreground font-mono">{child.taskKey}</span>
          <span className="text-sm">{child.title}</span>
        </div>
      </td>
      <td className="py-2 px-3">
        {child.workflowStatus && (
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-medium"
            style={{
              backgroundColor: `${child.workflowStatus.color}20`,
              color: child.workflowStatus.color,
            }}
          >
            {child.workflowStatus.name}
          </span>
        )}
      </td>
      <td className="py-2 px-3 text-xs">
        {child.assignee?.username ?? <span className="text-muted-foreground">Unassigned</span>}
      </td>
      <td className="py-2 px-3 text-xs">{child.estimatedMinutes ? formatMinutes(child.estimatedMinutes) : '—'}</td>
      <td className="py-2 px-3 text-xs">
        {(() => {
          const logged = child.timeLogs?.reduce((s, tl) => s + tl.minutes, 0) ?? 0;
          const isOver = (child.estimatedMinutes ?? 0) > 0 && logged > (child.estimatedMinutes ?? 0);
          return logged > 0 ? (
            <span className={isOver ? 'text-red-500 font-semibold' : ''}>
              {formatMinutes(logged)}{isOver && ' ⚠️'}
            </span>
          ) : '—';
        })()}
      </td>
    </tr>
  ))}
```

Note: The exact column `<td>` structure needs to match the parent row's columns. Adjust the number of `<td>` elements to match your actual column count. Empty `<td />`s fill columns that don't apply to sub-task rows (like select, priority, sprint, due date).

- [ ] **Step 5: Update the parent row title to show bold if it has children**

In the Title column cell renderer, add bold styling for parent tasks:

```typescript
  cell: ({ row }) => {
    const task = row.original;
    const hasChildren = (task.children?.length ?? 0) > 0;
    return (
      <div className="flex items-center gap-2 max-w-[400px]">
        <span className="text-xs text-muted-foreground font-mono shrink-0">{task.taskKey}</span>
        <span className={`truncate ${hasChildren ? 'font-semibold' : ''}`}>{task.title}</span>
      </div>
    );
  },
```

- [ ] **Step 6: Verify frontend compiles**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/tasks/TasksTable.tsx
git commit -m "feat: add expandable sub-task rows and Est/Logged columns to tasks table"
```

---

### Task 12: Frontend — Update ActivityEntry for Time Log Events

**Files:**
- Modify: `apps/web/src/components/tasks/ActivityEntry.tsx`

- [ ] **Step 1: Add timeLog and estimatedMinutes to the field config**

In the `FIELD_CONFIG` object in `ActivityEntry.tsx`, add:

```typescript
  timeLog: { icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  estimatedMinutes: { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100' },
```

Import `Clock` from `lucide-react`.

- [ ] **Step 2: Add description building for time log and estimate**

In the `buildDescription` function, add cases:

```typescript
  case 'timeLog':
    return `logged ${entry.newValue}`;
  case 'estimatedMinutes':
    if (entry.oldValue && entry.newValue) return `changed estimate from ${entry.oldValue} to ${entry.newValue}`;
    if (entry.newValue) return `set estimate to ${entry.newValue}`;
    return 'removed estimate';
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tasks/ActivityEntry.tsx
git commit -m "feat: add time log and estimate entries to activity log"
```

---

### Task 13: Frontend — Update MyTasksBoard for Sub-tasks

**Files:**
- Modify: `apps/web/src/components/tasks/MyTasksBoard.tsx`

- [ ] **Step 1: Add mini progress indicator to MyTaskCard**

In the `MyTaskCard` component, after the planned end date section, add a mini time progress indicator:

```tsx
{/* Time progress — only if has estimate */}
{task.estimatedMinutes && task.estimatedMinutes > 0 && (
  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
    <Clock className="h-3 w-3" />
    <span>
      {formatMinutes(task.timeLogs?.reduce((s, tl) => s + tl.minutes, 0) ?? 0)}
      {' / '}
      {formatMinutes(task.estimatedMinutes)}
    </span>
  </div>
)}
```

Import `Clock` from `lucide-react` and `formatMinutes` from `../../lib/time-utils`.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/tasks/MyTasksBoard.tsx
git commit -m "feat: add time progress indicator to My Tasks board cards"
```

---

### Task 14: Backend — Update Task Tests

**Files:**
- Modify: `apps/api/src/tasks/tasks.service.spec.ts`

- [ ] **Step 1: Update mock to remove subTask references and add children**

In the test file, update `mockPrismaService` — remove `subTask` from the mock and ensure `task` mock includes `count` for children:

```typescript
  const mockPrismaService = {
    task: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    taskHistory: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    workflowStatus: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    project: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };
```

Remove any test cases that reference `subTask.create`, `subTask.update`, or `subTask.delete`.

- [ ] **Step 2: Add test for sub-task creation validation**

```typescript
  describe('create - sub-task', () => {
    it('should reject creating a sub-task on a sub-task', async () => {
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        return fn(mockPrismaService);
      });
      mockPrismaService.task.findUnique.mockResolvedValue({
        id: 'parent-id',
        projectId: 'project-1',
        parentId: 'grandparent-id', // already a sub-task
        taskKey: 'PM-1-1',
      });

      await expect(
        service.create('project-1', 'user-1', {
          title: 'Nested sub-task',
          parentId: 'parent-id',
        }),
      ).rejects.toThrow('Cannot create sub-tasks on a sub-task');
    });
  });
```

- [ ] **Step 3: Verify tests pass**

```bash
cd apps/api && npx vitest run --reporter=verbose
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/tasks/tasks.service.spec.ts
git commit -m "test: update task service tests for hierarchy support"
```

---

### Task 15: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Full backend build**

```bash
cd apps/api && npx nest build
```

Expected: Build succeeds.

- [ ] **Step 2: Full frontend build**

```bash
cd apps/web && npx tsc --noEmit && npx vite build
```

Expected: Both type-check and build succeed.

- [ ] **Step 3: Run all tests**

```bash
cd apps/api && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 4: Manual smoke test checklist**

Start the dev servers and verify:

1. Open a task with no sub-tasks → Time Tracking card shows in sidebar with estimate input + Log Time card
2. Set an estimate (e.g., 4h) → Blue estimate bar fills to 100%
3. Log time (e.g., 2h 30m with comment "Setup API") → Green actual bar fills proportionally, time log appears in left panel
4. Log more time exceeding estimate → Bar turns red, shows "Over by" label
5. Create a sub-task via "+ Add" button → Sub-task card appears, parent's Log Time card disappears, estimate shows "Auto-summed"
6. Navigate to sub-task → Full detail page with breadcrumb back to parent
7. Set estimate and log time on sub-task → Parent's progress bars update with summed values
8. Open tasks table → Parent task shows ▶ expand arrow, click to reveal indented sub-task rows
9. Sub-task keys display as HRM-1-1 format
10. Activity log shows time log entries with clock icon
