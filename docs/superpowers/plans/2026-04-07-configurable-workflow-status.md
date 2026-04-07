# Configurable Workflow Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `TaskStatus` enum with per-project configurable workflow statuses, transitions, and assignee rules — configured via a React Flow visual editor in project settings.

**Architecture:** New Prisma models (`WorkflowStatus`, `WorkflowTransition`, `StatusAssigneeRule`) replace the `TaskStatus` enum. A new `WorkflowModule` in NestJS handles CRUD. The frontend gets a React Flow-based editor in the project settings tab, and all status-consuming components (Kanban, StatusBadge, TaskDetail, Dashboard) switch from hardcoded enum to dynamic workflow data.

**Tech Stack:** Prisma 7, NestJS 11, React 19, @xyflow/react, TanStack Query, shadcn/ui Tabs, class-validator

---

### Task 1: Install @xyflow/react

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install the package**

```bash
cd apps/web && pnpm add @xyflow/react
```

- [ ] **Step 2: Verify installation**

```bash
cd apps/web && pnpm list @xyflow/react
```

Expected: Shows `@xyflow/react` with a version like `12.x.x`

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore: install @xyflow/react for workflow editor"
```

---

### Task 2: Prisma Schema — New Workflow Models

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add WorkflowStatus model**

After the `SprintStatus` enum block (line 59), add:

```prisma
model WorkflowStatus {
  id        String   @id @default(cuid())
  projectId String
  name      String
  key       String
  color     String
  position  Int
  isDefault Boolean  @default(false)
  isClosed  Boolean  @default(false)
  createdAt DateTime @default(now())

  project         Project              @relation(fields: [projectId], references: [id], onDelete: Cascade)
  transitionsFrom WorkflowTransition[] @relation("TransitionFrom")
  transitionsTo   WorkflowTransition[] @relation("TransitionTo")
  assigneeRules   StatusAssigneeRule[]
  tasks           Task[]               @relation("TaskWorkflowStatus")
  subTasks        SubTask[]            @relation("SubTaskWorkflowStatus")

  @@unique([projectId, key])
}

model WorkflowTransition {
  id           String @id @default(cuid())
  projectId    String
  fromStatusId String
  toStatusId   String

  project    Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  fromStatus WorkflowStatus @relation("TransitionFrom", fields: [fromStatusId], references: [id], onDelete: Cascade)
  toStatus   WorkflowStatus @relation("TransitionTo", fields: [toStatusId], references: [id], onDelete: Cascade)

  @@unique([fromStatusId, toStatusId])
}

model StatusAssigneeRule {
  id       String @id @default(cuid())
  statusId String
  memberId String

  status WorkflowStatus @relation(fields: [statusId], references: [id], onDelete: Cascade)
  member ProjectMember  @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@unique([statusId, memberId])
}
```

- [ ] **Step 2: Add relations to Project model**

In the `Project` model, after the `blueprintSyncs` relation (line 127), add:

```prisma
  workflowLayout      Json?
  workflowStatuses    WorkflowStatus[]
  workflowTransitions WorkflowTransition[]
```

- [ ] **Step 3: Add workflowStatusId to Task model**

In the `Task` model, add after `assigneeId` (line 173):

```prisma
  workflowStatusId    String?
  workflowStatus      WorkflowStatus? @relation("TaskWorkflowStatus", fields: [workflowStatusId], references: [id], onDelete: SetNull)
```

- [ ] **Step 4: Add workflowStatusId to SubTask model**

In the `SubTask` model, add after `assigneeId` (line 307):

```prisma
  workflowStatusId String?
  workflowStatus   WorkflowStatus? @relation("SubTaskWorkflowStatus", fields: [workflowStatusId], references: [id], onDelete: SetNull)
```

- [ ] **Step 5: Add assigneeRules relation to ProjectMember model**

In the `ProjectMember` model, after the `user` relation (line 138), add:

```prisma
  assigneeRules StatusAssigneeRule[]
```

- [ ] **Step 6: Generate and apply migration**

```bash
cd apps/api && npx prisma migrate dev --name add-workflow-models
```

Expected: Migration created and applied successfully

- [ ] **Step 7: Verify Prisma client generation**

```bash
cd apps/api && npx prisma generate
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat: add WorkflowStatus, WorkflowTransition, StatusAssigneeRule models"
```

---

### Task 3: Data Migration — Seed Default Workflows for Existing Projects

**Files:**
- Create: `apps/api/prisma/seeds/seed-workflows.ts`

- [ ] **Step 1: Create the seed script**

Create `apps/api/prisma/seeds/seed-workflows.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_STATUSES = [
  { key: 'BACKLOG', name: 'Backlog', color: '#6b7280', position: 0, isDefault: true, isClosed: false },
  { key: 'IN_PROGRESS', name: 'In Progress', color: '#3b82f6', position: 1, isDefault: false, isClosed: false },
  { key: 'IN_REVIEW', name: 'In Review', color: '#f59e0b', position: 2, isDefault: false, isClosed: false },
  { key: 'DONE', name: 'Done', color: '#22c55e', position: 3, isDefault: false, isClosed: true },
  { key: 'BLOCKED', name: 'Blocked', color: '#ef4444', position: 4, isDefault: false, isClosed: false },
];

// Transitions: BACKLOG↔IN_PROGRESS, IN_PROGRESS↔IN_REVIEW, IN_REVIEW↔DONE, any↔BLOCKED
const DEFAULT_TRANSITIONS: [string, string][] = [
  ['BACKLOG', 'IN_PROGRESS'],
  ['IN_PROGRESS', 'BACKLOG'],
  ['IN_PROGRESS', 'IN_REVIEW'],
  ['IN_REVIEW', 'IN_PROGRESS'],
  ['IN_REVIEW', 'DONE'],
  ['DONE', 'IN_REVIEW'],
  ['BACKLOG', 'BLOCKED'],
  ['IN_PROGRESS', 'BLOCKED'],
  ['IN_REVIEW', 'BLOCKED'],
  ['DONE', 'BLOCKED'],
  ['BLOCKED', 'BACKLOG'],
  ['BLOCKED', 'IN_PROGRESS'],
  ['BLOCKED', 'IN_REVIEW'],
];

async function main() {
  const projects = await prisma.project.findMany({ select: { id: true } });
  console.log(`Found ${projects.length} projects to seed workflows for`);

  for (const project of projects) {
    // Check if project already has workflow statuses
    const existing = await prisma.workflowStatus.count({ where: { projectId: project.id } });
    if (existing > 0) {
      console.log(`Project ${project.id} already has workflow statuses, skipping`);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      // Create statuses
      const statusMap: Record<string, string> = {};
      for (const s of DEFAULT_STATUSES) {
        const created = await tx.workflowStatus.create({
          data: { projectId: project.id, ...s },
        });
        statusMap[s.key] = created.id;
      }

      // Create transitions
      for (const [from, to] of DEFAULT_TRANSITIONS) {
        await tx.workflowTransition.create({
          data: {
            projectId: project.id,
            fromStatusId: statusMap[from],
            toStatusId: statusMap[to],
          },
        });
      }

      // Migrate existing tasks: match status enum to new workflowStatusId
      const tasks = await tx.task.findMany({
        where: { projectId: project.id },
        select: { id: true, status: true },
      });
      for (const task of tasks) {
        const wsId = statusMap[task.status];
        if (wsId) {
          await tx.task.update({
            where: { id: task.id },
            data: { workflowStatusId: wsId },
          });
        }
      }

      // Migrate subtasks
      const subTasks = await tx.subTask.findMany({
        where: { parent: { projectId: project.id } },
        select: { id: true, status: true },
      });
      for (const st of subTasks) {
        const wsId = statusMap[st.status];
        if (wsId) {
          await tx.subTask.update({
            where: { id: st.id },
            data: { workflowStatusId: wsId },
          });
        }
      }
    });

    console.log(`Seeded workflow for project ${project.id}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run the seed script**

```bash
cd apps/api && npx tsx prisma/seeds/seed-workflows.ts
```

Expected: `Seeded workflow for project <id>` for each project

- [ ] **Step 3: Verify migration worked**

```bash
cd apps/api && npx prisma studio
```

Check `WorkflowStatus` table has rows, and `Task` table has `workflowStatusId` populated.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/seeds/seed-workflows.ts
git commit -m "feat: seed default workflows for existing projects"
```

---

### Task 4: Backend — Workflow Module (Service + Controller + DTOs)

**Files:**
- Create: `apps/api/src/workflow/workflow.module.ts`
- Create: `apps/api/src/workflow/workflow.service.ts`
- Create: `apps/api/src/workflow/workflow.controller.ts`
- Create: `apps/api/src/workflow/dto/save-workflow.dto.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create the SaveWorkflow DTO**

Create `apps/api/src/workflow/dto/save-workflow.dto.ts`:

```typescript
import {
  IsString,
  IsBoolean,
  IsInt,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
  MaxLength,
  ArrayMinSize,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class WorkflowStatusDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MaxLength(50)
  name: string;

  @IsString()
  @MaxLength(30)
  @Matches(/^[A-Z][A-Z0-9_]*$/, { message: 'key must be uppercase with underscores' })
  key: string;

  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be a hex color like #ff0000' })
  color: string;

  @IsInt()
  @Min(0)
  position: number;

  @IsBoolean()
  isDefault: boolean;

  @IsBoolean()
  isClosed: boolean;
}

export class WorkflowTransitionDto {
  @IsString()
  fromStatusKey: string;

  @IsString()
  toStatusKey: string;
}

export class StatusAssigneeRuleDto {
  @IsString()
  statusKey: string;

  @IsArray()
  @IsString({ each: true })
  memberIds: string[];
}

export class SaveWorkflowDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkflowStatusDto)
  statuses: WorkflowStatusDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowTransitionDto)
  transitions: WorkflowTransitionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StatusAssigneeRuleDto)
  assigneeRules: StatusAssigneeRuleDto[];

  @IsOptional()
  layout?: Record<string, unknown>;
}
```

- [ ] **Step 2: Create the Workflow Service**

Create `apps/api/src/workflow/workflow.service.ts`:

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaveWorkflowDto } from './dto/save-workflow.dto';

const DEFAULT_STATUSES = [
  { key: 'BACKLOG', name: 'Backlog', color: '#6b7280', position: 0, isDefault: true, isClosed: false },
  { key: 'IN_PROGRESS', name: 'In Progress', color: '#3b82f6', position: 1, isDefault: false, isClosed: false },
  { key: 'IN_REVIEW', name: 'In Review', color: '#f59e0b', position: 2, isDefault: false, isClosed: false },
  { key: 'DONE', name: 'Done', color: '#22c55e', position: 3, isDefault: false, isClosed: true },
  { key: 'BLOCKED', name: 'Blocked', color: '#ef4444', position: 4, isDefault: false, isClosed: false },
];

const DEFAULT_TRANSITIONS: [string, string][] = [
  ['BACKLOG', 'IN_PROGRESS'],
  ['IN_PROGRESS', 'BACKLOG'],
  ['IN_PROGRESS', 'IN_REVIEW'],
  ['IN_REVIEW', 'IN_PROGRESS'],
  ['IN_REVIEW', 'DONE'],
  ['DONE', 'IN_REVIEW'],
  ['BACKLOG', 'BLOCKED'],
  ['IN_PROGRESS', 'BLOCKED'],
  ['IN_REVIEW', 'BLOCKED'],
  ['DONE', 'BLOCKED'],
  ['BLOCKED', 'BACKLOG'],
  ['BLOCKED', 'IN_PROGRESS'],
  ['BLOCKED', 'IN_REVIEW'],
];

@Injectable()
export class WorkflowService {
  constructor(private prisma: PrismaService) {}

  async getWorkflow(projectId: string) {
    const [statuses, transitions, assigneeRules, project] = await Promise.all([
      this.prisma.workflowStatus.findMany({
        where: { projectId },
        orderBy: { position: 'asc' },
      }),
      this.prisma.workflowTransition.findMany({
        where: { projectId },
        include: {
          fromStatus: { select: { key: true } },
          toStatus: { select: { key: true } },
        },
      }),
      this.prisma.statusAssigneeRule.findMany({
        where: { status: { projectId } },
        include: {
          member: {
            include: {
              user: { select: { id: true, username: true, email: true } },
            },
          },
        },
      }),
      this.prisma.project.findUniqueOrThrow({
        where: { id: projectId },
        select: { workflowLayout: true },
      }),
    ]);

    // Group assignee rules by status key
    const rulesByStatusId: Record<string, { memberId: string; userId: string; username: string; email: string }[]> = {};
    for (const rule of assigneeRules) {
      if (!rulesByStatusId[rule.statusId]) rulesByStatusId[rule.statusId] = [];
      rulesByStatusId[rule.statusId].push({
        memberId: rule.memberId,
        userId: rule.member.user.id,
        username: rule.member.user.username,
        email: rule.member.user.email,
      });
    }

    return {
      statuses,
      transitions: transitions.map((t) => ({
        id: t.id,
        fromStatusKey: t.fromStatus.key,
        toStatusKey: t.toStatus.key,
        fromStatusId: t.fromStatusId,
        toStatusId: t.toStatusId,
      })),
      assigneeRules: rulesByStatusId,
      layout: project.workflowLayout,
    };
  }

  async saveWorkflow(projectId: string, dto: SaveWorkflowDto) {
    // Validation
    const defaultCount = dto.statuses.filter((s) => s.isDefault).length;
    if (defaultCount !== 1) {
      throw new BadRequestException('Exactly one status must be marked as default');
    }

    const closedCount = dto.statuses.filter((s) => s.isClosed).length;
    if (closedCount < 1) {
      throw new BadRequestException('At least one status must be marked as closed');
    }

    const keys = dto.statuses.map((s) => s.key);
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException('Duplicate status keys are not allowed');
    }

    // Validate transitions reference valid keys
    for (const t of dto.transitions) {
      if (!keys.includes(t.fromStatusKey) || !keys.includes(t.toStatusKey)) {
        throw new BadRequestException(`Transition references unknown status key: ${t.fromStatusKey} → ${t.toStatusKey}`);
      }
    }

    // Validate assignee rule keys
    for (const rule of dto.assigneeRules) {
      if (!keys.includes(rule.statusKey)) {
        throw new BadRequestException(`Assignee rule references unknown status key: ${rule.statusKey}`);
      }
    }

    // Validate memberIds are actual project members
    const allMemberIds = dto.assigneeRules.flatMap((r) => r.memberIds);
    if (allMemberIds.length > 0) {
      const validMembers = await this.prisma.projectMember.findMany({
        where: { projectId, id: { in: allMemberIds } },
        select: { id: true },
      });
      const validIds = new Set(validMembers.map((m) => m.id));
      const invalid = allMemberIds.filter((id) => !validIds.has(id));
      if (invalid.length > 0) {
        throw new BadRequestException(`Invalid member IDs: ${invalid.join(', ')}`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Find statuses being removed
      const existingStatuses = await tx.workflowStatus.findMany({
        where: { projectId },
        select: { id: true },
      });
      const existingIds = existingStatuses.map((s) => s.id);
      const keptIds = dto.statuses.filter((s) => s.id).map((s) => s.id!);
      const removedIds = existingIds.filter((id) => !keptIds.includes(id));

      // Orphan tasks with removed statuses
      if (removedIds.length > 0) {
        await tx.task.updateMany({
          where: { workflowStatusId: { in: removedIds } },
          data: { workflowStatusId: null },
        });
        await tx.subTask.updateMany({
          where: { workflowStatusId: { in: removedIds } },
          data: { workflowStatusId: null },
        });
      }

      // Delete all existing workflow data for this project
      await tx.statusAssigneeRule.deleteMany({
        where: { status: { projectId } },
      });
      await tx.workflowTransition.deleteMany({ where: { projectId } });
      await tx.workflowStatus.deleteMany({ where: { projectId } });

      // Create new statuses
      const statusMap: Record<string, string> = {};
      for (const s of dto.statuses) {
        const created = await tx.workflowStatus.create({
          data: {
            projectId,
            name: s.name,
            key: s.key,
            color: s.color,
            position: s.position,
            isDefault: s.isDefault,
            isClosed: s.isClosed,
          },
        });
        statusMap[s.key] = created.id;
      }

      // Create transitions
      for (const t of dto.transitions) {
        await tx.workflowTransition.create({
          data: {
            projectId,
            fromStatusId: statusMap[t.fromStatusKey],
            toStatusId: statusMap[t.toStatusKey],
          },
        });
      }

      // Create assignee rules
      for (const rule of dto.assigneeRules) {
        for (const memberId of rule.memberIds) {
          await tx.statusAssigneeRule.create({
            data: {
              statusId: statusMap[rule.statusKey],
              memberId,
            },
          });
        }
      }

      // Save layout
      await tx.project.update({
        where: { id: projectId },
        data: { workflowLayout: dto.layout ?? undefined },
      });

      return this.getWorkflowFromTx(tx, projectId);
    });
  }

  private async getWorkflowFromTx(tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0], projectId: string) {
    const statuses = await tx.workflowStatus.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
    });
    return { statuses };
  }

  async seedDefaultWorkflow(projectId: string) {
    const existing = await this.prisma.workflowStatus.count({ where: { projectId } });
    if (existing > 0) return;

    await this.prisma.$transaction(async (tx) => {
      const statusMap: Record<string, string> = {};
      for (const s of DEFAULT_STATUSES) {
        const created = await tx.workflowStatus.create({
          data: { projectId, ...s },
        });
        statusMap[s.key] = created.id;
      }
      for (const [from, to] of DEFAULT_TRANSITIONS) {
        await tx.workflowTransition.create({
          data: {
            projectId,
            fromStatusId: statusMap[from],
            toStatusId: statusMap[to],
          },
        });
      }
    });
  }

  async getAllowedAssignees(projectId: string, statusId: string) {
    const rules = await this.prisma.statusAssigneeRule.findMany({
      where: { statusId },
      include: {
        member: {
          include: {
            user: { select: { id: true, username: true, email: true } },
          },
        },
      },
    });

    // If no rules, return all project members
    if (rules.length === 0) {
      const members = await this.prisma.projectMember.findMany({
        where: { projectId },
        include: {
          user: { select: { id: true, username: true, email: true } },
        },
      });
      return members.map((m) => ({
        memberId: m.id,
        userId: m.user.id,
        username: m.user.username,
        email: m.user.email,
      }));
    }

    return rules.map((r) => ({
      memberId: r.memberId,
      userId: r.member.user.id,
      username: r.member.user.username,
      email: r.member.user.email,
    }));
  }

  async getValidTransitions(projectId: string, fromStatusId: string) {
    const transitions = await this.prisma.workflowTransition.findMany({
      where: { projectId, fromStatusId },
      include: {
        toStatus: true,
      },
    });
    return transitions.map((t) => t.toStatus);
  }
}
```

- [ ] **Step 3: Create the Workflow Controller**

Create `apps/api/src/workflow/workflow.controller.ts`:

```typescript
import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { ProjectRoles } from '../auth/project-roles.decorator';
import { WorkflowService } from './workflow.service';
import { SaveWorkflowDto } from './dto/save-workflow.dto';

@Controller('projects/:projectId/workflow')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class WorkflowController {
  constructor(private workflowService: WorkflowService) {}

  @Get()
  getWorkflow(@Param('projectId') projectId: string) {
    return this.workflowService.getWorkflow(projectId);
  }

  @Put()
  @ProjectRoles('pm')
  saveWorkflow(
    @Param('projectId') projectId: string,
    @Body() dto: SaveWorkflowDto,
  ) {
    return this.workflowService.saveWorkflow(projectId, dto);
  }

  @Get('statuses/:statusId/allowed-assignees')
  getAllowedAssignees(
    @Param('projectId') projectId: string,
    @Param('statusId') statusId: string,
  ) {
    return this.workflowService.getAllowedAssignees(projectId, statusId);
  }
}
```

- [ ] **Step 4: Create the Workflow Module**

Create `apps/api/src/workflow/workflow.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';

@Module({
  controllers: [WorkflowController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
```

- [ ] **Step 5: Register WorkflowModule in AppModule**

In `apps/api/src/app.module.ts`, add the import:

```typescript
import { WorkflowModule } from './workflow/workflow.module';
```

And add `WorkflowModule` to the `imports` array after `NotificationsModule`.

- [ ] **Step 6: Verify backend compiles**

```bash
cd apps/api && pnpm build
```

Expected: Build succeeds with no errors

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/workflow/ apps/api/src/app.module.ts
git commit -m "feat: add WorkflowModule with service, controller, and DTOs"
```

---

### Task 5: Backend — Update Projects Service to Seed Workflow on Create

**Files:**
- Modify: `apps/api/src/projects/projects.service.ts`
- Modify: `apps/api/src/projects/projects.module.ts`

- [ ] **Step 1: Import and inject WorkflowService**

In `apps/api/src/projects/projects.service.ts`, add the import:

```typescript
import { WorkflowService } from '../workflow/workflow.service';
```

Update the constructor:

```typescript
constructor(
  private prisma: PrismaService,
  private workflowService: WorkflowService,
) {}
```

- [ ] **Step 2: Seed workflow after project creation**

In the `create` method, after the transaction returns the project (after line 31 `return project;`), add a call to seed the default workflow. Replace the entire `create` method:

```typescript
async create(userId: string, dto: CreateProjectDto) {
  const project = await this.prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: {
        name: dto.name?.trim() || 'Untitled Project',
        description: dto.description,
        prefix: dto.prefix?.trim() || 'US',
        ownerId: userId,
      },
    });

    await tx.projectMember.create({
      data: {
        projectId: p.id,
        userId,
        role: 'pm',
      },
    });

    return p;
  });

  await this.workflowService.seedDefaultWorkflow(project.id);

  return project;
}
```

- [ ] **Step 3: Import WorkflowModule in ProjectsModule**

In `apps/api/src/projects/projects.module.ts`, add:

```typescript
import { WorkflowModule } from '../workflow/workflow.module';
```

And add `WorkflowModule` to the `imports` array.

- [ ] **Step 4: Verify build**

```bash
cd apps/api && pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/projects/
git commit -m "feat: seed default workflow on project creation"
```

---

### Task 6: Backend — Update Task Service for Workflow Status

**Files:**
- Modify: `apps/api/src/tasks/tasks.service.ts`
- Modify: `apps/api/src/tasks/dto/update-task.dto.ts`
- Modify: `apps/api/src/tasks/dto/create-task.dto.ts`
- Modify: `apps/api/src/tasks/dto/create-subtask.dto.ts`
- Modify: `apps/api/src/tasks/tasks.module.ts`

- [ ] **Step 1: Update UpdateTaskDto**

In `apps/api/src/tasks/dto/update-task.dto.ts`, replace the `status` field with `workflowStatusId`:

Remove:
```typescript
@IsOptional()
@IsEnum(TaskStatus)
status?: TaskStatus;
```

Add in its place:
```typescript
@IsOptional()
@IsString()
workflowStatusId?: string;
```

Remove the `TaskStatus` import from `@prisma/client` (keep `Priority`).

- [ ] **Step 2: Update CreateTaskDto**

In `apps/api/src/tasks/dto/create-task.dto.ts`, remove the `status` field entirely (new tasks use the project's default status). Remove the `TaskStatus` import from `@prisma/client` (keep `Priority`).

Remove:
```typescript
@IsOptional()
@IsEnum(TaskStatus)
status?: TaskStatus;
```

- [ ] **Step 3: Update CreateSubTaskDto**

In `apps/api/src/tasks/dto/create-subtask.dto.ts`, replace:

```typescript
@IsOptional()
@IsEnum(TaskStatus)
status?: TaskStatus;
```

With:

```typescript
@IsOptional()
@IsString()
workflowStatusId?: string;
```

Remove the `TaskStatus` import. Remove the `IsEnum` import if no longer used.

- [ ] **Step 4: Import WorkflowModule in TasksModule**

In `apps/api/src/tasks/tasks.module.ts`, import `WorkflowModule`:

```typescript
import { WorkflowModule } from '../workflow/workflow.module';
```

Add `WorkflowModule` to the `imports` array.

- [ ] **Step 5: Update TasksService constructor**

In `apps/api/src/tasks/tasks.service.ts`, add import:

```typescript
import { WorkflowService } from '../workflow/workflow.service';
```

Update constructor:

```typescript
constructor(
  private prisma: PrismaService,
  private notifications: NotificationsService,
  private workflowService: WorkflowService,
) {}
```

- [ ] **Step 6: Update the create method**

Replace the `create` method to use the project's default workflow status:

```typescript
async create(projectId: string, creatorId: string, dto: CreateTaskDto) {
  const task = await this.prisma.$transaction(async (tx) => {
    const project = await tx.project.update({
      where: { id: projectId },
      data: { taskSeq: { increment: 1 } },
      select: { prefix: true, taskSeq: true },
    });

    const taskKey = project.prefix ? `${project.prefix}-${project.taskSeq}` : null;

    // Find default workflow status for this project
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
        plannedStartDate: dto.plannedStartDate ? new Date(dto.plannedStartDate) : undefined,
        plannedEndDate: dto.plannedEndDate ? new Date(dto.plannedEndDate) : undefined,
        actualStartDate: dto.actualStartDate ? new Date(dto.actualStartDate) : undefined,
        actualEndDate: dto.actualEndDate ? new Date(dto.actualEndDate) : undefined,
      },
      include: {
        assignee: { select: { id: true, username: true, email: true } },
        sprint: { select: { id: true, name: true } },
        workflowStatus: true,
      },
    });
  });

  this.notifications.notifyProject(projectId, 'task:created', { projectId, task });
  return task;
}
```

- [ ] **Step 7: Update all findAll/findOne/findByTaskKey/findByAssignee to include workflowStatus**

In every query method that includes task data, add `workflowStatus: true` to the `include` block. For example in `findAll`:

```typescript
async findAll(projectId: string) {
  return this.prisma.task.findMany({
    where: { projectId },
    include: {
      assignee: { select: { id: true, username: true, email: true } },
      sprint: { select: { id: true, name: true } },
      workflowStatus: true,
      _count: { select: { subTasks: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}
```

Do the same for `findOne`, `findByTaskKey`, `findByAssignee`. Also add `workflowStatus: true` to all subtask includes:

```typescript
subTasks: {
  include: {
    assignee: { select: { id: true, username: true, email: true } },
    workflowStatus: true,
  },
  orderBy: { createdAt: 'asc' },
},
```

- [ ] **Step 8: Update the update method for transition validation**

Replace the update method's status handling. In the `update` method, replace the status tracking section. The full updated `update` method:

```typescript
async update(taskId: string, dto: UpdateTaskDto, actorId: string) {
  const current = await this.prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    include: { workflowStatus: true },
  });

  // Validate workflow status transition
  if (dto.workflowStatusId !== undefined && dto.workflowStatusId !== current.workflowStatusId) {
    if (current.workflowStatusId && dto.workflowStatusId) {
      const validTransitions = await this.workflowService.getValidTransitions(
        current.projectId,
        current.workflowStatusId,
      );
      const isValid = validTransitions.some((s) => s.id === dto.workflowStatusId);
      if (!isValid) {
        const newStatus = await this.prisma.workflowStatus.findUnique({
          where: { id: dto.workflowStatusId },
        });
        throw new BadRequestException(
          `Cannot transition from "${current.workflowStatus?.name}" to "${newStatus?.name}". Valid transitions: ${validTransitions.map((s) => s.name).join(', ')}`,
        );
      }
    }
  }

  // Build history entries for tracked fields
  const trackedFields = ['assigneeId', 'sprintId', 'storyPoints', 'title', 'priority'] as const;
  const historyEntries: { taskId: string; actorId: string; field: string; oldValue: string | null; newValue: string | null }[] = trackedFields
    .filter(f => dto[f] !== undefined && String(dto[f] ?? '') !== String(current[f] ?? ''))
    .map(f => ({
      taskId,
      actorId,
      field: f as string,
      oldValue: current[f] != null ? String(current[f]) : null,
      newValue: dto[f] != null ? String(dto[f]) : null,
    }));

  // Track workflow status changes by name for readability
  if (dto.workflowStatusId !== undefined && dto.workflowStatusId !== current.workflowStatusId) {
    const newStatus = dto.workflowStatusId
      ? await this.prisma.workflowStatus.findUnique({ where: { id: dto.workflowStatusId } })
      : null;
    historyEntries.push({
      taskId,
      actorId,
      field: 'status',
      oldValue: current.workflowStatus?.name ?? null,
      newValue: newStatus?.name ?? null,
    });
  }

  // Track description changes
  if (dto.description !== undefined && dto.description !== current.description) {
    historyEntries.push({
      taskId,
      actorId,
      field: 'description',
      oldValue: current.description ? current.description.replace(/<[^>]*>/g, '').slice(0, 500) : null,
      newValue: dto.description ? dto.description.replace(/<[^>]*>/g, '').slice(0, 500) : null,
    });
  }

  // Track acceptance criteria changes
  if (dto.acceptanceCriteria !== undefined && dto.acceptanceCriteria !== current.acceptanceCriteria) {
    historyEntries.push({
      taskId,
      actorId,
      field: 'acceptanceCriteria',
      oldValue: current.acceptanceCriteria ?? null,
      newValue: dto.acceptanceCriteria ?? null,
    });
  }

  // Track date field changes
  const dateFields = ['plannedStartDate', 'plannedEndDate', 'actualStartDate', 'actualEndDate'] as const;
  for (const f of dateFields) {
    if (dto[f] !== undefined) {
      const oldRaw = current[f] ? (current[f] as Date).toISOString() : null;
      const newRaw = dto[f] ? new Date(dto[f] as string).toISOString() : null;
      if (oldRaw !== newRaw) {
        historyEntries.push({
          taskId,
          actorId,
          field: f,
          oldValue: oldRaw,
          newValue: newRaw,
        });
      }
    }
  }

  const [updatedTask] = await this.prisma.$transaction([
    this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.workflowStatusId !== undefined && { workflowStatusId: dto.workflowStatusId }),
        ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId }),
        ...(dto.storyPoints !== undefined && { storyPoints: dto.storyPoints }),
        ...(dto.sprintId !== undefined && { sprintId: dto.sprintId }),
        ...(dto.acceptanceCriteria !== undefined && { acceptanceCriteria: dto.acceptanceCriteria }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.plannedStartDate !== undefined && {
          plannedStartDate: dto.plannedStartDate ? new Date(dto.plannedStartDate) : null,
        }),
        ...(dto.plannedEndDate !== undefined && {
          plannedEndDate: dto.plannedEndDate ? new Date(dto.plannedEndDate) : null,
        }),
        ...(dto.actualStartDate !== undefined && {
          actualStartDate: dto.actualStartDate ? new Date(dto.actualStartDate) : null,
        }),
        ...(dto.actualEndDate !== undefined && {
          actualEndDate: dto.actualEndDate ? new Date(dto.actualEndDate) : null,
        }),
      },
      include: {
        assignee: { select: { id: true, username: true, email: true } },
        sprint: { select: { id: true, name: true } },
        workflowStatus: true,
      },
    }),
    ...historyEntries.map(e => this.prisma.taskHistory.create({ data: e })),
  ]);

  this.notifications.notifyProject(current.projectId, 'task:updated', {
    projectId: current.projectId,
    taskId,
    task: updatedTask,
  });

  const effectiveAssigneeId = dto.assigneeId !== undefined ? dto.assigneeId : current.assigneeId;
  if (effectiveAssigneeId) {
    this.notifications.notifyUser(effectiveAssigneeId, 'task:updated', {
      projectId: current.projectId,
      taskId,
    });
  }
  if (dto.assigneeId !== undefined && dto.assigneeId !== current.assigneeId && current.assigneeId) {
    this.notifications.notifyUser(current.assigneeId, 'task:updated', {
      projectId: current.projectId,
      taskId,
    });
  }

  return updatedTask;
}
```

Add the `BadRequestException` import at the top:

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
```

- [ ] **Step 9: Update createSubTask and updateSubTask**

```typescript
async createSubTask(taskId: string, dto: CreateSubTaskDto) {
  return this.prisma.subTask.create({
    data: {
      parentId: taskId,
      title: dto.title,
      workflowStatusId: dto.workflowStatusId,
      assigneeId: dto.assigneeId,
    },
    include: {
      assignee: { select: { id: true, username: true, email: true } },
      workflowStatus: true,
    },
  });
}

async updateSubTask(subTaskId: string, dto: Partial<CreateSubTaskDto>) {
  return this.prisma.subTask.update({
    where: { id: subTaskId },
    data: {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.workflowStatusId !== undefined && { workflowStatusId: dto.workflowStatusId }),
      ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId }),
    },
    include: {
      assignee: { select: { id: true, username: true, email: true } },
      workflowStatus: true,
    },
  });
}
```

- [ ] **Step 10: Verify build**

```bash
cd apps/api && pnpm build
```

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/tasks/ apps/api/src/workflow/
git commit -m "feat: update task service to use workflow status with transition validation"
```

---

### Task 7: Backend — Update Dashboard Service

**Files:**
- Modify: `apps/api/src/dashboard/dashboard.service.ts`

- [ ] **Step 1: Update getProjectDashboard**

Replace the task counts logic. Instead of a hardcoded switch, group by `workflowStatusId` and join to get status metadata:

```typescript
async getProjectDashboard(projectId: string) {
  const [taskGroups, workflowStatuses, activeSprint, recentTasks, recentBugs, bugCounts] =
    await Promise.all([
      this.prisma.task.groupBy({
        by: ['workflowStatusId'],
        where: { projectId },
        _count: true,
      }),
      this.prisma.workflowStatus.findMany({
        where: { projectId },
        orderBy: { position: 'asc' },
      }),
      this.prisma.sprint.findFirst({
        where: { projectId, status: 'ACTIVE' },
        include: {
          tasks: {
            select: { storyPoints: true, workflowStatusId: true },
          },
        },
      }),
      this.prisma.task.findMany({
        where: { projectId },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          updatedAt: true,
          creator: { select: { username: true } },
        },
      }),
      this.prisma.bug.findMany({
        where: { projectId },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          updatedAt: true,
          reporter: { select: { username: true } },
        },
      }),
      Promise.all([
        this.prisma.bug.count({ where: { projectId } }),
        this.prisma.bug.count({ where: { projectId, status: 'OPEN' } }),
        this.prisma.bug.count({ where: { projectId, severity: 'CRITICAL' } }),
      ]),
    ]);

  // Build dynamic task counts by status
  const closedStatusIds = new Set(workflowStatuses.filter((s) => s.isClosed).map((s) => s.id));
  const countByStatusId: Record<string, number> = {};
  let total = 0;
  for (const group of taskGroups) {
    const sid = group.workflowStatusId ?? '__orphan__';
    countByStatusId[sid] = group._count;
    total += group._count;
  }

  const taskCounts = {
    total,
    byStatus: workflowStatuses.map((s) => ({
      statusId: s.id,
      name: s.name,
      key: s.key,
      color: s.color,
      count: countByStatusId[s.id] ?? 0,
      isClosed: s.isClosed,
    })),
    orphaned: countByStatusId['__orphan__'] ?? 0,
  };

  // Build active sprint data
  let activeSprintData: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    totalPoints: number;
    completedPoints: number;
    remainingPoints: number;
  } | null = null;

  if (activeSprint) {
    const totalPoints = activeSprint.tasks.reduce(
      (sum, t) => sum + (t.storyPoints ?? 0),
      0,
    );
    const completedPoints = activeSprint.tasks
      .filter((t) => t.workflowStatusId && closedStatusIds.has(t.workflowStatusId))
      .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);

    activeSprintData = {
      id: activeSprint.id,
      name: activeSprint.name,
      startDate: activeSprint.startDate.toISOString(),
      endDate: activeSprint.endDate.toISOString(),
      totalPoints,
      completedPoints,
      remainingPoints: totalPoints - completedPoints,
    };
  }

  // Build recent activity feed
  const taskActivity = recentTasks.map((t) => ({
    id: t.id,
    type: 'task' as const,
    title: t.title,
    actor: t.creator.username,
    timestamp: t.updatedAt.toISOString(),
  }));

  const bugActivity = recentBugs.map((b) => ({
    id: b.id,
    type: 'bug' as const,
    title: b.title,
    actor: b.reporter.username,
    timestamp: b.updatedAt.toISOString(),
  }));

  const recentActivity = [...taskActivity, ...bugActivity]
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    .slice(0, 20);

  // Build burndown data
  const burndown: BurndownPoint[] = [];

  if (activeSprint) {
    const sprintTasks = await this.prisma.task.findMany({
      where: { sprintId: activeSprint.id },
      select: { storyPoints: true, workflowStatusId: true, updatedAt: true },
    });

    const totalPoints = sprintTasks.reduce(
      (sum, t) => sum + (t.storyPoints ?? 0),
      0,
    );

    const startDate = activeSprint.startDate;
    const endDate = activeSprint.endDate;
    const totalDays = Math.max(
      1,
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );

    const doneTasks = sprintTasks.filter(
      (t) => t.workflowStatusId && closedStatusIds.has(t.workflowStatusId),
    );

    for (let dayIndex = 0; dayIndex <= totalDays; dayIndex++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + dayIndex);
      const dateStr = date.toISOString().split('T')[0];

      const ideal = Math.round(
        totalPoints * (1 - dayIndex / totalDays),
      );

      const completedByDate = doneTasks
        .filter((t) => t.updatedAt <= date)
        .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
      const actual = totalPoints - completedByDate;

      burndown.push({ date: dateStr, ideal, actual });
    }
  }

  const [totalBugs, openBugs, criticalBugs] = bugCounts;
  const bugCountData = {
    total: totalBugs,
    open: openBugs,
    critical: criticalBugs,
  };

  return {
    taskCounts,
    activeSprint: activeSprintData,
    recentActivity,
    burndown,
    bugCounts: bugCountData,
  };
}
```

- [ ] **Step 2: Verify build**

```bash
cd apps/api && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/dashboard/
git commit -m "feat: update dashboard to use dynamic workflow statuses"
```

---

### Task 8: Backend — Update Projects Service (findAllForUser)

**Files:**
- Modify: `apps/api/src/projects/projects.service.ts`

- [ ] **Step 1: Update findAllForUser to use workflow statuses**

The current `findAllForUser` hardcodes `IN_PROGRESS` and `BLOCKED` status checks. Update it to use workflow status data:

```typescript
async findAllForUser(userId: string) {
  const memberships = await this.prisma.projectMember.findMany({
    where: { userId },
    include: {
      project: {
        include: {
          _count: {
            select: { tasks: true },
          },
          workflowStatuses: {
            select: { id: true, isClosed: true, key: true },
          },
          tasks: {
            select: { workflowStatusId: true },
            where: { workflowStatusId: { not: null } },
          },
        },
      },
    },
  });

  return memberships
    .filter((m) => !m.project.archived)
    .map((m) => {
      const closedIds = new Set(
        m.project.workflowStatuses.filter((s) => s.isClosed).map((s) => s.id),
      );

      const activeCount = m.project.tasks.filter(
        (t) => t.workflowStatusId && !closedIds.has(t.workflowStatusId),
      ).length;

      return {
        id: m.project.id,
        name: m.project.name,
        description: m.project.description,
        prefix: m.project.prefix,
        avatarUrl: m.project.avatarUrl,
        archived: m.project.archived,
        createdAt: m.project.createdAt,
        userRole: m.role,
        taskSummary: {
          total: m.project._count.tasks,
          active: activeCount,
        },
      };
    });
}
```

- [ ] **Step 2: Verify build**

```bash
cd apps/api && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/projects/projects.service.ts
git commit -m "feat: update project list to use dynamic workflow statuses"
```

---

### Task 9: Frontend — Update Types

**Files:**
- Modify: `apps/web/src/lib/types.ts`

- [ ] **Step 1: Add WorkflowStatus interface and update Task/SubTask**

Replace the `TaskStatus` type and add workflow types. At the top of the file, replace:

```typescript
export type TaskStatus = 'BACKLOG' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'BLOCKED';
```

With:

```typescript
export type TaskStatus = string; // Now dynamic — workflow status key

export interface WorkflowStatus {
  id: string;
  projectId: string;
  name: string;
  key: string;
  color: string;
  position: number;
  isDefault: boolean;
  isClosed: boolean;
}

export interface WorkflowTransition {
  id: string;
  fromStatusKey: string;
  toStatusKey: string;
  fromStatusId: string;
  toStatusId: string;
}

export interface WorkflowAllowedAssignee {
  memberId: string;
  userId: string;
  username: string;
  email: string;
}

export interface WorkflowData {
  statuses: WorkflowStatus[];
  transitions: WorkflowTransition[];
  assigneeRules: Record<string, WorkflowAllowedAssignee[]>;
  layout: Record<string, unknown> | null;
}

export interface SaveWorkflowPayload {
  statuses: {
    id?: string;
    name: string;
    key: string;
    color: string;
    position: number;
    isDefault: boolean;
    isClosed: boolean;
  }[];
  transitions: {
    fromStatusKey: string;
    toStatusKey: string;
  }[];
  assigneeRules: {
    statusKey: string;
    memberIds: string[];
  }[];
  layout?: Record<string, unknown>;
}
```

- [ ] **Step 2: Update Task interface**

Add `workflowStatus` and `workflowStatusId` to the `Task` interface:

```typescript
export interface Task {
  id: string;
  taskKey: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;  // keep for backward compat during transition
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
  subTasks?: SubTask[];
  acceptanceCriteria?: string | null;
  priority?: Priority | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
}
```

- [ ] **Step 3: Update SubTask interface**

```typescript
export interface SubTask {
  id: string;
  title: string;
  status: TaskStatus;
  workflowStatusId: string | null;
  workflowStatus?: WorkflowStatus | null;
  assigneeId: string | null;
  taskId: string;
  createdAt: string;
  updatedAt: string;
  assignee?: User | null;
}
```

- [ ] **Step 4: Update UpdateTaskPayload**

Replace `status` with `workflowStatusId`:

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
}
```

- [ ] **Step 5: Update CreateTaskPayload**

Remove the `status` field:

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
}
```

- [ ] **Step 6: Update TaskCounts**

Replace the hardcoded `TaskCounts` interface:

```typescript
export interface StatusCount {
  statusId: string;
  name: string;
  key: string;
  color: string;
  count: number;
  isClosed: boolean;
}

export interface TaskCounts {
  total: number;
  byStatus: StatusCount[];
  orphaned: number;
}
```

- [ ] **Step 7: Update UpdateSubTaskPayload**

```typescript
export interface UpdateSubTaskPayload {
  title?: string;
  workflowStatusId?: string;
  assigneeId?: string | null;
}
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/types.ts
git commit -m "feat: update frontend types for dynamic workflow statuses"
```

---

### Task 10: Frontend — Add API Methods and Hooks for Workflow

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/hooks/useWorkflow.ts`

- [ ] **Step 1: Add workflow API methods**

In `apps/web/src/lib/api.ts`, add after the Dashboard section:

```typescript
// ─── Workflow ─────────────────────────────────────────────────────────────
getWorkflow: (projectId: string) =>
  request<WorkflowData>(`/projects/${projectId}/workflow`),
saveWorkflow: (projectId: string, data: SaveWorkflowPayload) =>
  request<{ statuses: WorkflowStatus[] }>(`/projects/${projectId}/workflow`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
getAllowedAssignees: (projectId: string, statusId: string) =>
  request<WorkflowAllowedAssignee[]>(`/projects/${projectId}/workflow/statuses/${statusId}/allowed-assignees`),
```

Add the imports at the top:

```typescript
import type {
  // ... existing imports ...
  WorkflowData,
  WorkflowStatus,
  SaveWorkflowPayload,
  WorkflowAllowedAssignee,
} from './types';
```

- [ ] **Step 2: Create useWorkflow hook**

Create `apps/web/src/hooks/useWorkflow.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { SaveWorkflowPayload, WorkflowData } from '../lib/types';

export function useWorkflow(projectId: string) {
  return useQuery({
    queryKey: ['workflow', projectId],
    queryFn: () => api.getWorkflow(projectId),
    enabled: !!projectId,
  });
}

export function useSaveWorkflow(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveWorkflowPayload) => api.saveWorkflow(projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workflow', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Workflow saved');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save workflow');
    },
  });
}

export function useAllowedAssignees(projectId: string, statusId: string | null) {
  return useQuery({
    queryKey: ['allowed-assignees', projectId, statusId],
    queryFn: () => api.getAllowedAssignees(projectId, statusId!),
    enabled: !!projectId && !!statusId,
  });
}

export function useValidTransitions(workflow: WorkflowData | undefined, currentStatusId: string | null) {
  if (!workflow || !currentStatusId) return [];

  const currentStatus = workflow.statuses.find((s) => s.id === currentStatusId);
  if (!currentStatus) return [];

  return workflow.transitions
    .filter((t) => t.fromStatusKey === currentStatus.key)
    .map((t) => workflow.statuses.find((s) => s.key === t.toStatusKey))
    .filter(Boolean);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/hooks/useWorkflow.ts
git commit -m "feat: add workflow API methods and hooks"
```

---

### Task 11: Frontend — Update StatusBadge Component

**Files:**
- Modify: `apps/web/src/components/tasks/StatusBadge.tsx`

- [ ] **Step 1: Update StatusBadge to accept dynamic status**

Replace the entire file:

```typescript
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { WorkflowStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: WorkflowStatus | null | undefined;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  if (!status) {
    return (
      <Badge
        variant="outline"
        className={cn(
          'font-medium text-[13px] border-dashed border-destructive text-destructive',
          className,
        )}
      >
        No Status
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium text-[13px] border-transparent',
        className,
      )}
      style={{
        backgroundColor: `color-mix(in oklch, ${status.color} 15%, transparent)`,
        color: status.color,
      }}
    >
      {status.name}
    </Badge>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/tasks/StatusBadge.tsx
git commit -m "feat: update StatusBadge for dynamic workflow statuses"
```

---

### Task 12: Frontend — Update KanbanBoard and KanbanColumn

**Files:**
- Modify: `apps/web/src/components/tasks/KanbanBoard.tsx`
- Modify: `apps/web/src/components/tasks/KanbanColumn.tsx`

- [ ] **Step 1: Update KanbanBoard**

Replace the entire file:

```typescript
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { toast } from 'sonner';
import { KanbanColumn } from './KanbanColumn';
import { useUpdateTask } from '@/hooks/useTasks';
import { useWorkflow } from '@/hooks/useWorkflow';
import type { Task, WorkflowStatus } from '@/lib/types';

interface KanbanBoardProps {
  tasks: Task[];
  projectId: string;
  projectPrefix: string;
}

export function KanbanBoard({ tasks, projectId, projectPrefix }: KanbanBoardProps) {
  const updateTask = useUpdateTask(projectId);
  const { data: workflow } = useWorkflow(projectId);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const statuses = workflow?.statuses ?? [];

  const tasksByStatus = statuses.reduce<Record<string, Task[]>>(
    (acc, status) => {
      acc[status.id] = tasks.filter((t) => t.workflowStatusId === status.id);
      return acc;
    },
    {},
  );

  // Collect orphaned tasks (null workflowStatusId)
  const orphanedTasks = tasks.filter((t) => !t.workflowStatusId);

  // Build a set of valid transitions for quick lookup
  const validTransitions = new Set(
    (workflow?.transitions ?? []).map((t) => `${t.fromStatusId}→${t.toStatusId}`),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatusId = over.id as string;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.workflowStatusId === newStatusId) return;

    // Validate transition
    if (task.workflowStatusId) {
      const transKey = `${task.workflowStatusId}→${newStatusId}`;
      if (!validTransitions.has(transKey)) {
        toast.error('This status transition is not allowed');
        return;
      }
    }

    updateTask.mutate({ taskId, data: { workflowStatusId: newStatusId } });
  };

  const getStatusName = (id: string) => statuses.find((s) => s.id === id)?.name ?? id;

  const announcements = {
    onDragStart: ({ active }: { active: { id: string | number } }) => {
      const task = tasks.find((t) => t.id === active.id);
      return task ? `Picked up task: ${task.title}` : '';
    },
    onDragOver: ({
      active,
      over,
    }: {
      active: { id: string | number };
      over: { id: string | number } | null;
    }) => {
      const task = tasks.find((t) => t.id === active.id);
      if (!task || !over) return '';
      return `Task ${task.title} is over ${getStatusName(over.id as string)} column`;
    },
    onDragEnd: ({
      active,
      over,
    }: {
      active: { id: string | number };
      over: { id: string | number } | null;
    }) => {
      const task = tasks.find((t) => t.id === active.id);
      if (!task || !over) return 'Drag cancelled';
      return `Moved ${task.title} to ${getStatusName(over.id as string)}`;
    },
    onDragCancel: () => 'Drag cancelled',
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd} accessibility={{ announcements }}>
      <div className="flex gap-3 overflow-x-clip h-full pb-4">
        {statuses.map((status) => (
          <KanbanColumn
            key={status.id}
            status={status}
            tasks={tasksByStatus[status.id] ?? []}
            projectId={projectId}
            projectPrefix={projectPrefix}
          />
        ))}
        {orphanedTasks.length > 0 && (
          <KanbanColumn
            key="__orphan__"
            status={{ id: '__orphan__', name: 'No Status', key: '__ORPHAN__', color: '#ef4444', position: 999, isDefault: false, isClosed: false, projectId }}
            tasks={orphanedTasks}
            projectId={projectId}
            projectPrefix={projectPrefix}
          />
        )}
      </div>
    </DndContext>
  );
}
```

- [ ] **Step 2: Update KanbanColumn**

Replace the entire file:

```typescript
import { useDroppable } from '@dnd-kit/core';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { KanbanCard } from './KanbanCard';
import type { Task, WorkflowStatus } from '@/lib/types';

interface KanbanColumnProps {
  status: WorkflowStatus;
  tasks: Task[];
  projectId: string;
  projectPrefix: string;
}

export function KanbanColumn({ status, tasks, projectId, projectPrefix }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="size-2 rounded-full" style={{ backgroundColor: status.color }} />
        <h3 className="text-[13px] font-semibold">{status.name}</h3>
        <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
          {tasks.length}
        </Badge>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col flex-1 rounded-lg p-2 min-h-[200px] transition-colors duration-100',
          isOver ? 'bg-muted' : 'bg-muted/30',
        )}
      >
        <ScrollArea className="flex-1 min-h-0">
          <div className="flex flex-col gap-2 pr-2">
            {tasks.map((task) => (
              <KanbanCard key={task.id} task={task} projectId={projectId} projectPrefix={projectPrefix} />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tasks/KanbanBoard.tsx apps/web/src/components/tasks/KanbanColumn.tsx
git commit -m "feat: update kanban board for dynamic workflow statuses"
```

---

### Task 13: Frontend — Update Task Hooks

**Files:**
- Modify: `apps/web/src/hooks/useTasks.ts`
- Modify: `apps/web/src/hooks/useMyTasks.ts`

- [ ] **Step 1: Update useTasks.ts**

Replace `useUpdateTaskStatus` to use `workflowStatusId`:

```typescript
export function useUpdateTaskStatus(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, workflowStatusId }: { taskId: string; workflowStatusId: string }) =>
      api.updateTask(projectId, taskId, { workflowStatusId }),
    onMutate: async ({ taskId, workflowStatusId }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', projectId] });
      const previousTasks = queryClient.getQueryData<Task[]>(['tasks', projectId]);
      queryClient.setQueryData<Task[]>(['tasks', projectId], (old) =>
        old?.map((t) => (t.id === taskId ? { ...t, workflowStatusId } : t)) ?? [],
      );
      const previousTask = queryClient.getQueryData(['task', projectId, taskId]);
      queryClient.setQueryData(['task', projectId, taskId], (old: Task | undefined) =>
        old ? { ...old, workflowStatusId } : old,
      );
      return { previousTasks, previousTask };
    },
    onError: (_err, { taskId }, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', projectId], context.previousTasks);
      }
      if (context?.previousTask) {
        queryClient.setQueryData(['task', projectId, taskId], context.previousTask);
      }
      toast.error('Something went wrong. Please try again.');
    },
    onSettled: (_data, _error, { taskId }) => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['task', projectId, taskId] });
      void queryClient.invalidateQueries({ queryKey: ['task-history', projectId, taskId] });
      void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
    },
    onSuccess: () => {
      toast.success('Status updated');
    },
  });
}
```

Remove the `STATUS_LABELS` const and the `TaskStatus` import from the import line (keep other type imports).

- [ ] **Step 2: Update useMyTasks.ts**

Update `useUpdateMyTaskStatus`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { Task } from '../lib/types';

export function useMyTasks() {
  return useQuery({
    queryKey: ['my-tasks'],
    queryFn: () => api.getMyTasks(),
  });
}

export function useUpdateMyTaskStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ task, workflowStatusId }: { task: Task; workflowStatusId: string }) =>
      api.updateTask(task.projectId, task.id, { workflowStatusId }),
    onMutate: async ({ task, workflowStatusId }) => {
      await queryClient.cancelQueries({ queryKey: ['my-tasks'] });
      const previousTasks = queryClient.getQueryData<Task[]>(['my-tasks']);
      queryClient.setQueryData<Task[]>(['my-tasks'], (old) =>
        old?.map((t) => (t.id === task.id ? { ...t, workflowStatusId } : t)) ?? [],
      );
      return { previousTasks };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['my-tasks'], context.previousTasks);
      }
      toast.error('Something went wrong. Please try again.');
    },
    onSettled: (_data, _error, { task }) => {
      void queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['tasks', task.projectId] });
      void queryClient.invalidateQueries({ queryKey: ['task', task.projectId, task.id] });
      void queryClient.invalidateQueries({ queryKey: ['task-by-key', task.projectId] });
      void queryClient.invalidateQueries({ queryKey: ['task-history', task.projectId, task.id] });
    },
    onSuccess: () => {
      toast.success('Status updated');
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/useTasks.ts apps/web/src/hooks/useMyTasks.ts
git commit -m "feat: update task hooks for workflow status"
```

---

### Task 14: Frontend — Update TaskDetailPage Status & Assignee Selectors

**Files:**
- Modify: `apps/web/src/pages/TaskDetailPage.tsx`

- [ ] **Step 1: Add workflow imports**

At the top of `TaskDetailPage.tsx`, add:

```typescript
import { useWorkflow, useValidTransitions, useAllowedAssignees } from '@/hooks/useWorkflow';
```

- [ ] **Step 2: Add workflow hooks in the component**

Inside the component function, after the existing hooks, add:

```typescript
const { data: workflow } = useWorkflow(projectId);
const validNextStatuses = useValidTransitions(workflow, task?.workflowStatusId ?? null);
const { data: allowedAssignees } = useAllowedAssignees(projectId, task?.workflowStatusId ?? null);
```

- [ ] **Step 3: Replace the status selector**

Find the Status `<Select>` block (around lines 600-621) and replace it with:

```typescript
{/* Status */}
<div className="flex flex-col gap-1.5">
  <SidebarLabel>Status</SidebarLabel>
  {task.workflowStatus ? (
    <Select
      value={task.workflowStatusId ?? ''}
      onValueChange={(val) =>
        optimisticMutate(
          { workflowStatusId: val },
          { taskId, data: { workflowStatusId: val } },
        )
      }
      disabled={!canEdit}
    >
      <SelectTrigger className="h-8 w-full">
        <SelectValue>
          <StatusBadge status={task.workflowStatus} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {/* Current status */}
        <SelectItem value={task.workflowStatusId!}>
          <StatusBadge status={task.workflowStatus} />
        </SelectItem>
        {/* Valid transitions */}
        {validNextStatuses.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            <StatusBadge status={s} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : (
    <StatusBadge status={null} />
  )}
</div>
```

- [ ] **Step 4: Update the assignee selector to respect rules**

Find the Assignee `<Select>` block (around lines 624-656). Replace the members list to use `allowedAssignees` when available:

```typescript
{/* Assignee */}
<div className="flex flex-col gap-1.5">
  <SidebarLabel>Assignee</SidebarLabel>
  <Select
    value={task.assigneeId ?? 'unassigned'}
    onValueChange={(val) => {
      const assigneeId = val === 'unassigned' ? null : val;
      optimisticMutate({ assigneeId }, { taskId, data: { assigneeId } });
    }}
    disabled={!canEdit}
  >
    <SelectTrigger className="h-8 w-full">
      <SelectValue placeholder="Unassigned" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="unassigned">
        <span className="text-muted-foreground">Unassigned</span>
      </SelectItem>
      {(allowedAssignees ?? members.map((m) => ({
        userId: m.userId,
        username: m.user.username,
        memberId: m.id,
        email: m.user.email,
      }))).map((a) => (
        <SelectItem key={a.userId} value={a.userId}>
          <div className="flex items-center gap-2">
            <Avatar className="size-5">
              <AvatarFallback className="text-[9px]">
                {getInitials(a.username)}
              </AvatarFallback>
            </Avatar>
            {a.username}
          </div>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/TaskDetailPage.tsx
git commit -m "feat: update task detail status/assignee selectors for workflow"
```

---

### Task 15: Frontend — Update MyTasksBoard

**Files:**
- Modify: `apps/web/src/components/tasks/MyTasksBoard.tsx`

- [ ] **Step 1: Update column grouping to use isClosed**

Replace the column definitions and grouping logic. Change the `COLUMNS` definition:

```typescript
type MyTaskColumn = 'ACTIVE' | 'DONE';

const COLUMNS: { id: MyTaskColumn; label: string; color: string }[] = [
  { id: 'ACTIVE', label: 'Active', color: '#3b82f6' },
  { id: 'DONE', label: 'Done', color: '#22c55e' },
];
```

Update the `tasksByColumn` logic:

```typescript
const tasksByColumn = {
  ACTIVE: sortTasks(tasks.filter((t) => !t.workflowStatus?.isClosed)),
  DONE: sortTasks(tasks.filter((t) => t.workflowStatus?.isClosed === true)),
};
```

Remove `COLUMN_DROP_STATUS` — drag-and-drop on MyTasksBoard is removed since we no longer know which exact status to map to without project-specific workflow context. The board becomes view-only (users go to the project kanban for drag-and-drop).

Remove the `DndContext`, `useSensors`, and `handleDragEnd` logic. Render plain columns without drag:

```typescript
export function MyTasksBoard({ tasks }: MyTasksBoardProps) {
  const tasksByColumn = {
    ACTIVE: sortTasks(tasks.filter((t) => !t.workflowStatus?.isClosed)),
    DONE: sortTasks(tasks.filter((t) => t.workflowStatus?.isClosed === true)),
  };

  return (
    <div className="flex gap-3 overflow-hidden h-full pb-4">
      {COLUMNS.map((col) => (
        <MyTaskColumn key={col.id} column={col} tasks={tasksByColumn[col.id]} />
      ))}
    </div>
  );
}
```

Update `MyTaskColumn` to remove droppable:

```typescript
function MyTaskColumn({ column, tasks }: { column: typeof COLUMNS[number]; tasks: Task[] }) {
  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="size-2 rounded-full" style={{ backgroundColor: column.color }} />
        <h3 className="text-[13px] font-semibold">{column.label}</h3>
        <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
          {tasks.length}
        </Badge>
      </div>
      <div className="flex flex-col flex-1 rounded-lg p-2 min-h-[200px] bg-muted/30">
        <ScrollArea className="flex-1 min-h-0">
          <div className="flex flex-col gap-2 pr-2">
            {tasks.map((task) => (
              <MyTaskCard key={task.id} task={task} />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
```

Update `MyTaskCard` to remove `useDraggable` — make it a simple clickable card:

```typescript
function MyTaskCard({ task }: { task: Task }) {
  const navigate = useNavigate();

  const handleClick = () => {
    const prefix = task.project?.prefix ?? task.projectId;
    navigate(`/projects/${prefix}/tasks/${task.taskKey ?? task.id}`);
  };

  const overdue = isOverdue(task.plannedEndDate, task.workflowStatus?.isClosed ? 'DONE' : '');
  const priority = task.priority ? PRIORITY_CONFIG[task.priority] : null;
  const projectColor = getProjectColor(task.projectId);
  const isDone = task.workflowStatus?.isClosed === true;

  return (
    <div onClick={handleClick} className="cursor-pointer">
      <Card className={cn('min-h-[80px] transition-all duration-150 overflow-hidden', isDone && 'opacity-50')}>
        {overdue && (
          <div className="h-[3px] w-full bg-gradient-to-r from-red-500 via-red-400 to-red-500" />
        )}
        <CardContent className="p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {task.taskKey && (
              <span className="text-xs font-mono text-muted-foreground">{task.taskKey}</span>
            )}
            {task.project?.prefix && (
              <div
                className="flex items-center justify-center rounded text-[9px] font-semibold text-white px-1 h-4"
                style={{ backgroundColor: projectColor }}
              >
                {task.project.prefix}
              </div>
            )}
            <div className="ml-auto">
              {priority && (
                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className="inline-block size-2 rounded-full shadow-sm"
                    style={{ backgroundColor: priority.color, boxShadow: `0 0 4px ${priority.color}` }}
                  />
                  <span className="text-[11px] font-medium" style={{ color: priority.color }}>
                    {priority.label}
                  </span>
                </div>
              )}
            </div>
          </div>
          <p className={cn('text-sm font-medium line-clamp-2', isDone && 'line-through')}>
            {task.title}
          </p>
          {task.plannedEndDate && (
            <div className="flex items-center justify-end border-t border-border/40 pt-2 mt-auto">
              <div className={cn('flex items-center gap-1', overdue ? 'text-destructive' : 'text-amber-500')}>
                <Calendar className="size-2.5" />
                <span className="text-[11px]">{formatDate(task.plannedEndDate)}</span>
                {overdue && (
                  <span className="text-[9px] bg-destructive/20 text-destructive px-1 rounded">OVERDUE</span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

Remove unused imports: `DndContext`, `PointerSensor`, `KeyboardSensor`, `useSensor`, `useSensors`, `DragEndEvent`, `sortableKeyboardCoordinates`, `useDroppable`, `useDraggable`, `CSS`, `useUpdateMyTaskStatus`.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/tasks/MyTasksBoard.tsx
git commit -m "feat: update MyTasksBoard for dynamic workflow statuses"
```

---

### Task 16: Frontend — Update ProjectDashboardPage

**Files:**
- Modify: `apps/web/src/pages/ProjectDashboardPage.tsx`

- [ ] **Step 1: Update stat cards to be dynamic**

Replace the hardcoded stat cards. Change the task counts section:

```typescript
const taskCounts = data?.taskCounts ?? { total: 0, byStatus: [], orphaned: 0 };
```

Replace the stat cards row:

```typescript
{/* Row 1: Stat cards */}
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <StatCard title="Total Tasks" value={taskCounts.total} icon={ListTodo} />
  {taskCounts.byStatus
    .filter((s) => !s.isClosed)
    .slice(0, 2)
    .map((s) => (
      <StatCard key={s.statusId} title={s.name} value={s.count} icon={Clock} />
    ))}
  <StatCard
    title="Done"
    value={taskCounts.byStatus.filter((s) => s.isClosed).reduce((sum, s) => sum + s.count, 0)}
    icon={CheckCircle}
  />
</div>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/ProjectDashboardPage.tsx
git commit -m "feat: update dashboard for dynamic workflow status counts"
```

---

### Task 17: Frontend — Workflow Editor (React Flow) in Project Settings

**Files:**
- Create: `apps/web/src/components/workflow/WorkflowEditor.tsx`
- Create: `apps/web/src/components/workflow/StatusNode.tsx`
- Create: `apps/web/src/components/workflow/AssigneeRulePanel.tsx`
- Modify: `apps/web/src/pages/ProjectSettingsPage.tsx`

- [ ] **Step 1: Create StatusNode component**

Create `apps/web/src/components/workflow/StatusNode.tsx`:

```typescript
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';

export interface StatusNodeData {
  name: string;
  color: string;
  key: string;
  isDefault: boolean;
  isClosed: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  canManage: boolean;
  [key: string]: unknown;
}

function StatusNodeComponent({ id, data }: NodeProps) {
  const { name, color, isDefault, isClosed, onEdit, onDelete, canManage } = data as unknown as StatusNodeData;

  return (
    <div className="relative group">
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-2 !h-2" />
      <div
        className="rounded-lg border bg-card shadow-sm min-w-[140px] overflow-hidden"
        style={{ borderTopColor: color, borderTopWidth: 3 }}
      >
        <div className="px-3 py-2 flex flex-col gap-1">
          <span className="text-sm font-semibold">{name}</span>
          <div className="flex items-center gap-1">
            {isDefault && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                Default
              </Badge>
            )}
            {isClosed && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                Closed
              </Badge>
            )}
          </div>
        </div>
        {canManage && (
          <div className="absolute -top-2 -right-2 hidden group-hover:flex gap-1">
            <Button
              variant="secondary"
              size="icon"
              className="size-6 rounded-full shadow-md"
              onClick={(e) => { e.stopPropagation(); onEdit(id); }}
            >
              <Pencil className="size-3" />
            </Button>
            <Button
              variant="destructive"
              size="icon"
              className="size-6 rounded-full shadow-md"
              onClick={(e) => { e.stopPropagation(); onDelete(id); }}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground !w-2 !h-2" />
    </div>
  );
}

export const StatusNode = memo(StatusNodeComponent);
```

- [ ] **Step 2: Create AssigneeRulePanel component**

Create `apps/web/src/components/workflow/AssigneeRulePanel.tsx`:

```typescript
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Member } from '@/lib/types';

interface AssigneeRulePanelProps {
  statusName: string;
  statusKey: string;
  members: Member[];
  selectedMemberIds: string[];
  onToggle: (memberId: string) => void;
  onClose: () => void;
}

export function AssigneeRulePanel({
  statusName,
  members,
  selectedMemberIds,
  onToggle,
  onClose,
}: AssigneeRulePanelProps) {
  const selectedSet = new Set(selectedMemberIds);

  return (
    <div className="w-64 border-l bg-card flex flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <div>
          <h3 className="text-sm font-semibold">Assignee Rules</h3>
          <p className="text-xs text-muted-foreground">{statusName}</p>
        </div>
        <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>
      <p className="px-3 pt-2 text-xs text-muted-foreground">
        {selectedMemberIds.length === 0
          ? 'No restrictions — any member can be assigned.'
          : `${selectedMemberIds.length} member(s) allowed.`}
      </p>
      <ScrollArea className="flex-1 p-3">
        <div className="flex flex-col gap-2">
          {members.map((m) => (
            <label
              key={m.id}
              className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted"
            >
              <Checkbox
                checked={selectedSet.has(m.id)}
                onCheckedChange={() => onToggle(m.id)}
              />
              <div className="flex flex-col">
                <span className="text-sm">{m.user.username}</span>
                <span className="text-xs text-muted-foreground capitalize">{m.role}</span>
              </div>
            </label>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
```

- [ ] **Step 3: Create WorkflowEditor component**

Create `apps/web/src/components/workflow/WorkflowEditor.tsx`:

```typescript
import { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  type Connection,
  type Edge,
  type Node,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useWorkflow, useSaveWorkflow } from '@/hooks/useWorkflow';
import { useMembers } from '@/hooks/useMembers';
import { StatusNode, type StatusNodeData } from './StatusNode';
import { AssigneeRulePanel } from './AssigneeRulePanel';
import type { WorkflowStatus, SaveWorkflowPayload, Member } from '@/lib/types';

const nodeTypes = { statusNode: StatusNode };

interface StatusFormData {
  name: string;
  key: string;
  color: string;
  isDefault: boolean;
  isClosed: boolean;
}

const EMPTY_FORM: StatusFormData = {
  name: '',
  key: '',
  color: '#6b7280',
  isDefault: false,
  isClosed: false,
};

function statusToNode(
  status: WorkflowStatus,
  position: { x: number; y: number },
  callbacks: { onEdit: (id: string) => void; onDelete: (id: string) => void },
  canManage: boolean,
): Node {
  return {
    id: status.id ?? status.key,
    type: 'statusNode',
    position,
    data: {
      name: status.name,
      color: status.color,
      key: status.key,
      isDefault: status.isDefault,
      isClosed: status.isClosed,
      onEdit: callbacks.onEdit,
      onDelete: callbacks.onDelete,
      canManage,
    } satisfies StatusNodeData,
  };
}

interface WorkflowEditorProps {
  projectId: string;
  canManage: boolean;
}

export function WorkflowEditor({ projectId, canManage }: WorkflowEditorProps) {
  const { data: workflow, isLoading } = useWorkflow(projectId);
  const { data: members = [] } = useMembers(projectId);
  const saveWorkflow = useSaveWorkflow(projectId);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [initialized, setInitialized] = useState(false);

  // Status editing
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [formData, setFormData] = useState<StatusFormData>(EMPTY_FORM);

  // Assignee rules
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const [assigneeRules, setAssigneeRules] = useState<Record<string, string[]>>({});

  const handleEdit = useCallback((nodeId: string) => {
    setNodes((nds) => {
      const node = nds.find((n) => n.id === nodeId);
      if (!node) return nds;
      const d = node.data as unknown as StatusNodeData;
      setFormData({
        name: d.name,
        key: d.key,
        color: d.color,
        isDefault: d.isDefault,
        isClosed: d.isClosed,
      });
      setEditingNodeId(nodeId);
      setEditDialogOpen(true);
      return nds;
    });
  }, [setNodes]);

  const handleDelete = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }, [setNodes, setEdges]);

  // Initialize nodes/edges from workflow data
  if (workflow && !initialized) {
    const layout = (workflow.layout ?? {}) as Record<string, { x: number; y: number }>;
    const callbacks = { onEdit: handleEdit, onDelete: handleDelete };

    const initialNodes = workflow.statuses.map((s, i) => {
      const pos = layout[s.key] ?? { x: i * 220, y: 100 };
      return statusToNode(s, pos, callbacks, canManage);
    });

    const statusById = Object.fromEntries(workflow.statuses.map((s) => [s.id, s]));
    const initialEdges: Edge[] = workflow.transitions.map((t) => ({
      id: `${t.fromStatusId}-${t.toStatusId}`,
      source: t.fromStatusId,
      target: t.toStatusId,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 2 },
    }));

    // Initialize assignee rules
    const rules: Record<string, string[]> = {};
    for (const [statusId, members] of Object.entries(workflow.assigneeRules)) {
      const status = statusById[statusId];
      if (status) {
        rules[status.key] = members.map((m) => m.memberId);
      }
    }

    setNodes(initialNodes);
    setEdges(initialEdges);
    setAssigneeRules(rules);
    setInitialized(true);
  }

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!canManage) return;
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { strokeWidth: 2 },
          },
          eds,
        ),
      );
    },
    [canManage, setEdges],
  );

  const handleAddStatus = () => {
    setFormData(EMPTY_FORM);
    setEditingNodeId(null);
    setEditDialogOpen(true);
  };

  const handleFormSave = () => {
    const callbacks = { onEdit: handleEdit, onDelete: handleDelete };

    if (editingNodeId) {
      // Update existing node
      setNodes((nds) =>
        nds.map((n) =>
          n.id === editingNodeId
            ? {
                ...n,
                data: {
                  ...formData,
                  onEdit: handleEdit,
                  onDelete: handleDelete,
                  canManage,
                } satisfies StatusNodeData,
              }
            : n,
        ),
      );
    } else {
      // Create new node
      const id = `new_${Date.now()}`;
      const maxX = Math.max(0, ...nodes.map((n) => n.position.x));
      const newNode = statusToNode(
        { ...formData, id, projectId, position: nodes.length } as WorkflowStatus,
        { x: maxX + 220, y: 100 },
        callbacks,
        canManage,
      );
      newNode.id = id;
      setNodes((nds) => [...nds, newNode]);
    }

    setEditDialogOpen(false);
  };

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const d = node.data as unknown as StatusNodeData;
    setSelectedNodeKey(d.key);
  }, []);

  const handleToggleAssignee = (memberId: string) => {
    if (!selectedNodeKey) return;
    setAssigneeRules((prev) => {
      const current = prev[selectedNodeKey] ?? [];
      const next = current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId];
      return { ...prev, [selectedNodeKey]: next };
    });
  };

  const handleSave = () => {
    // Build payload from current nodes and edges
    const statuses = nodes.map((n, i) => {
      const d = n.data as unknown as StatusNodeData;
      return {
        name: d.name,
        key: d.key,
        color: d.color,
        position: i,
        isDefault: d.isDefault,
        isClosed: d.isClosed,
      };
    });

    const nodeKeyById = Object.fromEntries(
      nodes.map((n) => [n.id, (n.data as unknown as StatusNodeData).key]),
    );

    const transitions = edges.map((e) => ({
      fromStatusKey: nodeKeyById[e.source],
      toStatusKey: nodeKeyById[e.target],
    }));

    const assigneeRulePayload = Object.entries(assigneeRules)
      .filter(([, ids]) => ids.length > 0)
      .map(([statusKey, memberIds]) => ({ statusKey, memberIds }));

    // Save layout positions
    const layout: Record<string, { x: number; y: number }> = {};
    for (const n of nodes) {
      const d = n.data as unknown as StatusNodeData;
      layout[d.key] = { x: n.position.x, y: n.position.y };
    }

    const payload: SaveWorkflowPayload = {
      statuses,
      transitions,
      assigneeRules: assigneeRulePayload,
      layout,
    };

    saveWorkflow.mutate(payload, {
      onSuccess: () => {
        setInitialized(false); // Re-initialize from server data
      },
    });
  };

  const selectedNode = selectedNodeKey
    ? nodes.find((n) => (n.data as unknown as StatusNodeData).key === selectedNodeKey)
    : null;
  const selectedNodeData = selectedNode?.data as unknown as StatusNodeData | undefined;

  if (isLoading) return null;

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleAddStatus}>
            <Plus className="size-4 mr-1" />
            Add Status
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saveWorkflow.isPending}>
            <Save className="size-4 mr-1" />
            Save Workflow
          </Button>
        </div>
      )}

      <div className="flex border rounded-lg overflow-hidden" style={{ height: 500 }}>
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={canManage ? onNodesChange : undefined}
            onEdgesChange={canManage ? onEdgesChange : undefined}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            fitView
            nodesDraggable={canManage}
            nodesConnectable={canManage}
            elementsSelectable={canManage}
            deleteKeyCode={canManage ? 'Backspace' : null}
          >
            <Controls />
            <Background />
          </ReactFlow>
        </div>

        {selectedNodeData && (
          <AssigneeRulePanel
            statusName={selectedNodeData.name}
            statusKey={selectedNodeData.key}
            members={members}
            selectedMemberIds={assigneeRules[selectedNodeData.key] ?? []}
            onToggle={handleToggleAssignee}
            onClose={() => setSelectedNodeKey(null)}
          />
        )}
      </div>

      {/* Status Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingNodeId ? 'Edit Status' : 'Add Status'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => {
                  const name = e.target.value;
                  const key = name.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_');
                  setFormData((f) => ({ ...f, name, key: editingNodeId ? f.key : key }));
                }}
                placeholder="e.g. In Review"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Key</Label>
              <Input
                value={formData.key}
                onChange={(e) => setFormData((f) => ({ ...f, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))}
                placeholder="e.g. IN_REVIEW"
                disabled={!!editingNodeId}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData((f) => ({ ...f, color: e.target.value }))}
                  className="size-8 rounded border cursor-pointer"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData((f) => ({ ...f, color: e.target.value }))}
                  className="w-28"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Default status for new tasks</Label>
              <Switch
                checked={formData.isDefault}
                onCheckedChange={(v) => setFormData((f) => ({ ...f, isDefault: v }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Closed (counts as "done")</Label>
              <Switch
                checked={formData.isClosed}
                onCheckedChange={(v) => setFormData((f) => ({ ...f, isClosed: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleFormSave} disabled={!formData.name || !formData.key}>
              {editingNodeId ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 4: Update ProjectSettingsPage to add Workflow tab**

In `apps/web/src/pages/ProjectSettingsPage.tsx`, add the tab structure. Add imports:

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkflowEditor } from '@/components/workflow/WorkflowEditor';
import { useSearchParams } from 'react-router-dom';
```

In the component, add `useSearchParams`:

```typescript
const [searchParams, setSearchParams] = useSearchParams();
const activeTab = searchParams.get('tab') ?? 'general';
```

Wrap the existing content in Tabs. Replace the return JSX (from the outer `<div className="space-y-6">`) with:

```typescript
return (
  <div className="space-y-6">
    <div className="flex items-center gap-2">
      <Settings className="size-5 text-muted-foreground" />
      <h1 className="text-2xl font-bold">Project Settings</h1>
    </div>

    <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v })}>
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        {canManage && <TabsTrigger value="workflow">Workflow</TabsTrigger>}
      </TabsList>

      <TabsContent value="general" className="space-y-6 mt-6">
        {/* Avatar Card */}
        <Card>
          <CardHeader>
            <CardTitle>Project Avatar</CardTitle>
            <CardDescription>Upload an image to represent this project</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <Avatar className="size-20">
              <AvatarImage
                className="object-cover w-full h-full"
                src={project.avatarUrl ?? undefined}
                alt="Project Avatar"
              />
              <AvatarFallback className="text-2xl">
                {project.prefix?.slice(0, 2) ?? project.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={!canManage || uploadAvatar.isPending}
              >
                <Upload className="size-4 mr-1" />
                Upload
              </Button>
              {project.avatarUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAvatar.mutate()}
                  disabled={!canManage || removeAvatar.isPending}
                >
                  <X className="size-4 mr-1" />
                  Remove
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Task Key Prefix Card */}
        <Card>
          <CardHeader>
            <CardTitle>Task Key Prefix</CardTitle>
            <CardDescription>
              Tasks will be numbered {prefix || 'XX'}-1, {prefix || 'XX'}-2, etc.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="prefix">Prefix</Label>
            <Input
              id="prefix"
              value={prefix}
              onChange={(e) => validatePrefix(e.target.value)}
              placeholder="e.g. PM, ACME"
              className="max-w-xs"
              disabled={!canManage}
            />
            {prefixError && <p className="text-xs text-destructive">{prefixError}</p>}
            {prefix && !prefixError && (
              <p className="text-xs text-muted-foreground">
                Preview: {prefix}-1, {prefix}-2, {prefix}-3...
              </p>
            )}
          </CardContent>
        </Card>

        {/* General Card */}
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="max-w-md"
                disabled={!canManage}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="max-w-md"
                rows={3}
                disabled={!canManage}
              />
            </div>
          </CardContent>
        </Card>

        {canManage && (
          <Button
            onClick={handleSave}
            disabled={updateSettings.isPending || !!prefixError}
          >
            Save Changes
          </Button>
        )}
      </TabsContent>

      <TabsContent value="workflow" className="mt-6">
        <WorkflowEditor projectId={projectId} canManage={canManage} />
      </TabsContent>
    </Tabs>
  </div>
);
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/workflow/ apps/web/src/pages/ProjectSettingsPage.tsx
git commit -m "feat: add React Flow workflow editor in project settings"
```

---

### Task 18: Backend — Remove Old Status Enum from Schema

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Remove the old status field from Task**

In the `Task` model, remove:
```prisma
status              TaskStatus  @default(BACKLOG)
```

- [ ] **Step 2: Remove the old status field from SubTask**

In the `SubTask` model, remove:
```prisma
status     TaskStatus @default(BACKLOG)
```

- [ ] **Step 3: Remove the TaskStatus enum**

Delete:
```prisma
enum TaskStatus {
  BACKLOG
  IN_PROGRESS
  IN_REVIEW
  DONE
  BLOCKED
}
```

- [ ] **Step 4: Generate and apply migration**

```bash
cd apps/api && npx prisma migrate dev --name remove-task-status-enum
```

- [ ] **Step 5: Verify build**

```bash
cd apps/api && pnpm build
```

If there are any remaining references to `TaskStatus` from `@prisma/client` in the codebase, fix them — they should all have been updated in prior tasks.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat: remove hardcoded TaskStatus enum from schema"
```

---

### Task 19: Fix Remaining Compilation Errors

**Files:**
- Various — any files still referencing the old `TaskStatus` enum or `status` field

- [ ] **Step 1: Search for remaining references**

```bash
cd apps/api && grep -rn "TaskStatus" src/ --include="*.ts" | grep -v node_modules
cd apps/web && grep -rn "TaskStatus\|\.status " src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v types.ts
```

- [ ] **Step 2: Fix each reference**

For each file found, update to use `workflowStatusId` / `workflowStatus` instead. Common patterns:

- `task.status === 'DONE'` → `task.workflowStatus?.isClosed === true`
- `task.status` in template → `task.workflowStatus?.name`
- `{ status: 'BACKLOG' }` → removed or use default status lookup

- [ ] **Step 3: Verify both apps compile**

```bash
cd apps/api && pnpm build
cd apps/web && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: resolve remaining TaskStatus enum references"
```

---

### Task 20: Verify End-to-End

- [ ] **Step 1: Start the dev environment**

```bash
docker compose up -d
cd apps/api && pnpm start:dev &
cd apps/web && pnpm dev &
```

- [ ] **Step 2: Verify workflow editor**

1. Navigate to a project → Settings → Workflow tab
2. Confirm 5 default status nodes appear with correct colors
3. Confirm arrows (transitions) are drawn between nodes
4. Try adding a new status, drawing a transition, saving
5. Refresh — confirm changes persist

- [ ] **Step 3: Verify kanban board**

1. Navigate to project tasks → Board view
2. Confirm columns match workflow statuses
3. Drag a task between valid columns — should succeed
4. Drag a task to an invalid transition — should show toast error

- [ ] **Step 4: Verify task detail**

1. Open a task detail page
2. Status dropdown should only show valid next statuses
3. Change status — should update successfully
4. If assignee rules are set, assignee dropdown should be restricted

- [ ] **Step 5: Verify dashboard**

1. Navigate to project dashboard
2. Stat cards should show dynamic status names
3. Burndown chart should work correctly

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: end-to-end verification fixes"
```
