# Bug "Create Fix Task" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to create a fix task directly from a bug, auto-populating the task with the bug's details, and display aggregated time logs from linked tasks on the Bug Detail page.

**Architecture:** New `POST /bugs/:bugId/create-fix-task` endpoint in BugsService that delegates to TasksService.create() and auto-links via BugTask. Frontend adds a dialog on BugDetailPage with a "Create Fix Task" button. BUG_RELATIONS is extended to include time logs from linked tasks for read-only aggregation display.

**Tech Stack:** NestJS, Prisma, React, React Query, shadcn/ui, Tailwind CSS

**Circular dependency note:** TasksModule already imports BugsModule. BugsModule must use `forwardRef(() => TasksModule)` and BugsService must use `@Inject(forwardRef(() => TasksService))` to avoid circular dependency.

---

### Task 1: Create the DTO — `CreateFixTaskDto`

**Files:**
- Create: `apps/api/src/bugs/dto/create-fix-task.dto.ts`

- [ ] **Step 1: Create the DTO file**

```ts
// apps/api/src/bugs/dto/create-fix-task.dto.ts
import { IsOptional, IsString } from 'class-validator';

export class CreateFixTaskDto {
  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/bugs/dto/create-fix-task.dto.ts
git commit -m "feat(bugs): add CreateFixTaskDto for create-fix-task endpoint"
```

---

### Task 2: Wire up module dependencies with forwardRef

**Files:**
- Modify: `apps/api/src/bugs/bugs.module.ts`
- Modify: `apps/api/src/tasks/tasks.module.ts`

**Context:** TasksModule (line 14) already imports BugsModule. Adding TasksModule to BugsModule creates a circular dependency. Both sides need `forwardRef`.

- [ ] **Step 1: Update BugsModule to import TasksModule via forwardRef**

In `apps/api/src/bugs/bugs.module.ts`, add the import and forwardRef:

```ts
import { Module, forwardRef } from '@nestjs/common';
import { BugsController } from './bugs.controller';
import { BugsService } from './bugs.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WatchersModule } from '../watchers/watchers.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    WatchersModule,
    forwardRef(() => TasksModule),
  ],
  controllers: [BugsController],
  providers: [BugsService],
  exports: [BugsService],
})
export class BugsModule {}
```

- [ ] **Step 2: Update TasksModule to use forwardRef for BugsModule**

In `apps/api/src/tasks/tasks.module.ts`, change the BugsModule import (line 14) to use forwardRef:

```ts
import { Module, forwardRef } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { WatchersModule } from '../watchers/watchers.module';
import { BugsModule } from '../bugs/bugs.module';

@Module({
  imports: [
    NotificationsModule,
    WorkflowModule,
    WatchersModule,
    forwardRef(() => BugsModule),
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
```

- [ ] **Step 3: Verify the API compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/bugs/bugs.module.ts apps/api/src/tasks/tasks.module.ts
git commit -m "feat(bugs): add forwardRef for circular TasksModule/BugsModule dependency"
```

---

### Task 3: Add `createFixTask` method to BugsService

**Files:**
- Modify: `apps/api/src/bugs/bugs.service.ts`

**Context:** BugsService constructor is at line 25. Inject TasksService via `@Inject(forwardRef(...))`. Add the `createFixTask` method after `getLinkedTasks` (after line 543).

- [ ] **Step 1: Add TasksService injection to BugsService constructor**

At the top of `apps/api/src/bugs/bugs.service.ts`, update imports:

```ts
import { Injectable, Inject, forwardRef } from '@nestjs/common';
```

Also add:

```ts
import { TasksService } from '../tasks/tasks.service';
```

Update the constructor (line 25-29):

```ts
@Injectable()
export class BugsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private watchersService: WatchersService,
    @Inject(forwardRef(() => TasksService))
    private tasksService: TasksService,
  ) {}
```

- [ ] **Step 2: Add the `createFixTask` method**

Add after the `getLinkedTasks` method (after line 543):

```ts
  async createFixTask(bugId: string, projectId: string, creatorId: string, dto: { parentId?: string; assigneeId?: string }) {
    const bug = await this.prisma.bug.findUniqueOrThrow({
      where: { id: bugId },
      select: {
        id: true,
        bugKey: true,
        title: true,
        description: true,
        preconditions: true,
        expectedResult: true,
        actualResult: true,
        environment: true,
        severity: true,
        assigneeId: true,
        projectId: true,
        reproSteps: { orderBy: { position: 'asc' } },
      },
    });

    if (bug.projectId !== projectId) {
      throw new Error('Bug does not belong to this project');
    }

    // Compose title
    const title = `Fix [${bug.bugKey}]: ${bug.title}`;

    // Compose description from bug fields (only non-null sections)
    const sections: string[] = [];
    if (bug.description) sections.push(`**Description:** ${bug.description}`);
    if (bug.preconditions) sections.push(`**Preconditions:** ${bug.preconditions}`);
    if (bug.expectedResult) sections.push(`**Expected Result:** ${bug.expectedResult}`);
    if (bug.actualResult) sections.push(`**Actual Result:** ${bug.actualResult}`);
    if (bug.environment) sections.push(`**Environment:** ${bug.environment}`);
    if (bug.severity) sections.push(`**Severity:** ${bug.severity}`);
    if (bug.reproSteps.length > 0) {
      const steps = bug.reproSteps.map((s, i) => `${i + 1}. ${s.content}`).join('\n');
      sections.push(`**Repro Steps:**\n${steps}`);
    }
    const description = `**Bug:** ${bug.bugKey}\n\n${sections.join('\n\n')}`;

    // Create the task via TasksService
    const task = await this.tasksService.create(projectId, creatorId, {
      title,
      description,
      parentId: dto.parentId,
      assigneeId: dto.assigneeId ?? bug.assigneeId ?? undefined,
    } as any);

    // Link the task to the bug
    await this.prisma.bugTask.create({
      data: { bugId, taskId: task.id },
    });

    return task;
  }
```

- [ ] **Step 3: Add the import for CreateFixTaskDto at top of file**

```ts
import { CreateFixTaskDto } from './dto/create-fix-task.dto';
```

- [ ] **Step 4: Verify the API compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/bugs/bugs.service.ts
git commit -m "feat(bugs): add createFixTask method to BugsService"
```

---

### Task 4: Add controller endpoint for `create-fix-task`

**Files:**
- Modify: `apps/api/src/bugs/bugs.controller.ts`

**Context:** Add the endpoint after the `linkTasks` endpoint (after line 91). Must be placed BEFORE the `@Get(':bugId')` route (line 107) to avoid route conflicts.

- [ ] **Step 1: Add import for CreateFixTaskDto**

At the top of `apps/api/src/bugs/bugs.controller.ts`, add alongside existing DTO imports (after line 12):

```ts
import { CreateFixTaskDto } from './dto/create-fix-task.dto';
```

- [ ] **Step 2: Add the endpoint**

Insert after the `linkTasks` endpoint (after line 91), before `@Delete(':bugId/tasks/:taskId')`:

```ts
  @Post(':bugId/create-fix-task')
  @RequirePermission('bugs', 'update')
  createFixTask(
    @Param('projectId') projectId: string,
    @Param('bugId') bugId: string,
    @Req() req: any,
    @Body() dto: CreateFixTaskDto,
  ) {
    return this.bugsService.createFixTask(bugId, projectId, req.user.id, dto);
  }
```

- [ ] **Step 3: Verify the API compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/bugs/bugs.controller.ts
git commit -m "feat(bugs): add POST :bugId/create-fix-task controller endpoint"
```

---

### Task 5: Extend BUG_RELATIONS to include time log data from linked tasks

**Files:**
- Modify: `apps/api/src/bugs/bugs.service.ts`

**Context:** The `BUG_RELATIONS` constant (line 10-21) defines the shared Prisma include for all bug queries. Extend the `bugTasks` include to also fetch time logs and children time logs from linked tasks.

- [ ] **Step 1: Update BUG_RELATIONS**

Replace the `bugTasks` section in `BUG_RELATIONS` (lines 16-20) with:

```ts
  bugTasks: {
    include: {
      task: {
        select: {
          id: true,
          taskKey: true,
          title: true,
          estimatedMinutes: true,
          timeLogs: {
            include: {
              user: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
            },
            orderBy: { loggedAt: 'desc' as const },
          },
          children: {
            select: {
              id: true,
              taskKey: true,
              title: true,
              estimatedMinutes: true,
              timeLogs: {
                include: {
                  user: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
                },
                orderBy: { loggedAt: 'desc' as const },
              },
            },
          },
        },
      },
    },
  },
```

- [ ] **Step 2: Verify the API compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/bugs/bugs.service.ts
git commit -m "feat(bugs): extend BUG_RELATIONS to include linked task time logs and children"
```

---

### Task 6: Update frontend Bug type and API client

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Update Bug interface in types.ts**

In `apps/web/src/lib/types.ts`, replace the `bugTasks` line (line 332):

Old:
```ts
  bugTasks?: { task: { id: string; taskKey: string | null; title: string } }[];
```

New:
```ts
  bugTasks?: {
    task: {
      id: string;
      taskKey: string | null;
      title: string;
      estimatedMinutes: number | null;
      timeLogs?: TimeLog[];
      children?: {
        id: string;
        taskKey: string | null;
        title: string;
        estimatedMinutes: number | null;
        timeLogs?: TimeLog[];
      }[];
    };
  }[];
```

- [ ] **Step 2: Add `createFixTask` to the API client**

In `apps/web/src/lib/api.ts`, add after the `unlinkBugTask` line (after line 294):

```ts
  createFixTask: (projectId: string, bugId: string, data: { parentId?: string; assigneeId?: string }) =>
    request<Task>(`/projects/${projectId}/bugs/${bugId}/create-fix-task`, { method: 'POST', body: JSON.stringify(data) }),
```

- [ ] **Step 3: Verify frontend compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts
git commit -m "feat(bugs): update Bug type for time log aggregation and add createFixTask API"
```

---

### Task 7: Add `useCreateFixTask` hook

**Files:**
- Modify: `apps/web/src/hooks/useBugs.ts`

- [ ] **Step 1: Add the hook**

In `apps/web/src/hooks/useBugs.ts`, add after `useUnlinkBugTask` (after line 109):

```ts
export function useCreateFixTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bugId, data }: { bugId: string; data: { parentId?: string; assigneeId?: string } }) =>
      api.createFixTask(projectId, bugId, data),
    onSuccess: (_data, { bugId }) => {
      void queryClient.invalidateQueries({ queryKey: ['bug', projectId, bugId] });
      void queryClient.invalidateQueries({ queryKey: ['bug-by-key', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['bugs', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success(`Fix task created: ${_data.taskKey}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
```

- [ ] **Step 2: Verify frontend compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/useBugs.ts
git commit -m "feat(bugs): add useCreateFixTask mutation hook"
```

---

### Task 8: Create the `CreateFixTaskDialog` component

**Files:**
- Create: `apps/web/src/components/bugs/CreateFixTaskDialog.tsx`

**Context:** Minimal dialog with title (pre-filled, editable), optional parent task combobox, and assignee dropdown. Uses shadcn/ui Dialog, Command/Popover for selectors. Same patterns as existing dialogs in the codebase.

- [ ] **Step 1: Create the dialog component**

```tsx
// apps/web/src/components/bugs/CreateFixTaskDialog.tsx
import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import type { Task, User } from '@/lib/types';

interface CreateFixTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTitle: string;
  defaultAssigneeId: string | null;
  tasks: Task[];
  members: User[];
  onSubmit: (data: { title: string; parentId?: string; assigneeId?: string }) => void;
  isLoading?: boolean;
}

export function CreateFixTaskDialog({
  open,
  onOpenChange,
  defaultTitle,
  defaultAssigneeId,
  tasks,
  members,
  onSubmit,
  isLoading,
}: CreateFixTaskDialogProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [parentId, setParentId] = useState<string | undefined>(undefined);
  const [assigneeId, setAssigneeId] = useState<string | undefined>(defaultAssigneeId ?? undefined);
  const [parentOpen, setParentOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);

  // Only show top-level tasks (no parentId) as potential parents
  const topLevelTasks = tasks.filter((t) => !t.parentId);
  const selectedParent = topLevelTasks.find((t) => t.id === parentId);
  const selectedAssignee = members.find((m) => m.id === assigneeId);

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      parentId,
      assigneeId,
    });
  };

  // Reset state when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setTitle(defaultTitle);
      setParentId(undefined);
      setAssigneeId(defaultAssigneeId ?? undefined);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create Fix Task</DialogTitle>
          <DialogDescription>
            Create a task to fix this bug. The bug details will be included in the task description.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="fix-task-title">Title</Label>
            <Input
              id="fix-task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
            />
          </div>

          {/* Parent Task (optional) */}
          <div className="space-y-2">
            <Label>Parent Task (optional)</Label>
            <Popover open={parentOpen} onOpenChange={setParentOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate text-sm">
                    {selectedParent
                      ? `${selectedParent.taskKey} — ${selectedParent.title}`
                      : 'Select parent task...'}
                  </span>
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search tasks..." />
                  <CommandList className="max-h-48 overflow-y-auto">
                    <CommandEmpty>No tasks found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__none__"
                        onSelect={() => {
                          setParentId(undefined);
                          setParentOpen(false);
                        }}
                      >
                        <Check className={cn('mr-2 size-4', !parentId ? 'opacity-100' : 'opacity-0')} />
                        <span className="text-sm text-muted-foreground">No parent (top-level task)</span>
                      </CommandItem>
                      {topLevelTasks.map((t) => (
                        <CommandItem
                          key={t.id}
                          value={t.taskKey ?? t.title}
                          onSelect={() => {
                            setParentId(t.id);
                            setParentOpen(false);
                          }}
                        >
                          <Check className={cn('mr-2 size-4', parentId === t.id ? 'opacity-100' : 'opacity-0')} />
                          <span className="truncate text-sm">
                            {t.taskKey && <span className="text-muted-foreground mr-1">{t.taskKey}</span>}
                            {t.title}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Assignee */}
          <div className="space-y-2">
            <Label>Assignee</Label>
            <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate text-sm">
                    {selectedAssignee
                      ? selectedAssignee.name ?? selectedAssignee.username
                      : 'Select assignee...'}
                  </span>
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search members..." />
                  <CommandList className="max-h-48 overflow-y-auto">
                    <CommandEmpty>No members found.</CommandEmpty>
                    <CommandGroup>
                      {members.map((m) => (
                        <CommandItem
                          key={m.id}
                          value={m.name ?? m.username ?? m.email}
                          onSelect={() => {
                            setAssigneeId(m.id);
                            setAssigneeOpen(false);
                          }}
                        >
                          <Check className={cn('mr-2 size-4', assigneeId === m.id ? 'opacity-100' : 'opacity-0')} />
                          <span className="text-sm">{m.name ?? m.username}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || isLoading}>
            {isLoading ? 'Creating...' : 'Create Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify frontend compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/bugs/CreateFixTaskDialog.tsx
git commit -m "feat(bugs): add CreateFixTaskDialog component"
```

---

### Task 9: Create the `BugTimeTrackingCard` component

**Files:**
- Create: `apps/web/src/components/bugs/BugTimeTrackingCard.tsx`

**Context:** Read-only version of the TimeTrackingCard pattern. Shows aggregated estimated vs logged from all linked tasks and their sub-tasks. No action buttons.

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/components/bugs/BugTimeTrackingCard.tsx
import { formatMinutes } from '@/lib/time-utils';
import type { Bug } from '@/lib/types';

interface BugTimeTrackingCardProps {
  bug: Bug;
}

export function BugTimeTrackingCard({ bug }: BugTimeTrackingCardProps) {
  const bugTasks = bug.bugTasks ?? [];

  let totalEstimated = 0;
  let totalLogged = 0;

  for (const bt of bugTasks) {
    const task = bt.task;
    const children = task.children ?? [];

    if (children.length > 0) {
      // Parent task — sum from children
      for (const child of children) {
        totalEstimated += child.estimatedMinutes ?? 0;
        totalLogged += (child.timeLogs ?? []).reduce((s, tl) => s + tl.minutes, 0);
      }
    } else {
      // Leaf task
      totalEstimated += task.estimatedMinutes ?? 0;
      totalLogged += (task.timeLogs ?? []).reduce((s, tl) => s + tl.minutes, 0);
    }
  }

  if (totalEstimated === 0 && totalLogged === 0) return null;

  const isOverBudget = totalEstimated > 0 && totalLogged > totalEstimated;
  const remaining = totalEstimated - totalLogged;
  const progressPercent = totalEstimated > 0 ? Math.min((totalLogged / totalEstimated) * 100, 100) : 0;

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

      <p className="text-xs text-muted-foreground italic">Auto-summed from linked tasks</p>
    </div>
  );
}
```

- [ ] **Step 2: Verify frontend compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/bugs/BugTimeTrackingCard.tsx
git commit -m "feat(bugs): add BugTimeTrackingCard component for time log aggregation"
```

---

### Task 10: Integrate "Create Fix Task" button and dialog into BugDetailPage

**Files:**
- Modify: `apps/web/src/pages/BugDetailPage.tsx`

**Context:** Add the button in the "Linked Tasks" sidebar section (after line 678), and wire the dialog to the `useCreateFixTask` hook. Also add imports for the new components and hooks.

- [ ] **Step 1: Add imports**

At the top of `apps/web/src/pages/BugDetailPage.tsx`:

Add to the import from `@/hooks/useBugs` (line 29):

```ts
import { useBugByKey, useUpdateBug, useDeleteBug, useLinkBugTasks, useUnlinkBugTask, useCreateFixTask } from '@/hooks/useBugs';
```

Add new imports:

```ts
import { CreateFixTaskDialog } from '@/components/bugs/CreateFixTaskDialog';
import { Plus } from 'lucide-react';
```

Note: Check if `Plus` is already imported from lucide-react. If not, add it to the existing lucide-react import line.

- [ ] **Step 2: Add state and hook in the BugDetailPage component**

Inside the `BugDetailPage` component, near the other hooks (around line 101-103), add:

```ts
  const createFixTask = useCreateFixTask(projectId);
  const [fixTaskDialogOpen, setFixTaskDialogOpen] = useState(false);
```

- [ ] **Step 3: Add the "Create Fix Task" button in the Linked Tasks sidebar section**

After the linked tasks list (after line 678, before the `{/* Reporter */}` comment at line 681), add:

```tsx
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 h-7 text-xs mt-1"
                  onClick={() => setFixTaskDialogOpen(true)}
                >
                  <Plus className="size-3" />
                  Create Fix Task
                </Button>
```

- [ ] **Step 4: Add the dialog at the end of the component (before the closing fragment)**

Add before the final closing `</>` or `</div>` of the component's return:

```tsx
      <CreateFixTaskDialog
        open={fixTaskDialogOpen}
        onOpenChange={setFixTaskDialogOpen}
        defaultTitle={`Fix [${bug.bugKey}]: ${bug.title}`}
        defaultAssigneeId={bug.assigneeId}
        tasks={tasks}
        members={members}
        onSubmit={(data) => {
          createFixTask.mutate(
            { bugId: bug.id, data },
            { onSuccess: () => setFixTaskDialogOpen(false) },
          );
        }}
        isLoading={createFixTask.isPending}
      />
```

- [ ] **Step 5: Verify frontend compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/BugDetailPage.tsx
git commit -m "feat(bugs): integrate Create Fix Task button and dialog into BugDetailPage"
```

---

### Task 11: Add Time Logs tab and BugTimeTrackingCard to BugDetailPage

**Files:**
- Modify: `apps/web/src/pages/BugDetailPage.tsx`

**Context:** Add a "Time Logs" tab alongside the existing "Comments" and "Activity" tabs (line 329-349). Add the BugTimeTrackingCard in the sidebar.

- [ ] **Step 1: Add imports**

Add at the top of `BugDetailPage.tsx`:

```ts
import { TimeLogsList } from '@/components/tasks/TimeLogsList';
import { BugTimeTrackingCard } from '@/components/bugs/BugTimeTrackingCard';
```

- [ ] **Step 2: Add helper to flatten time logs from bug**

Inside the `BugDetailPage` component, add a computed value after the existing hook calls:

```ts
  // Flatten time logs from all linked tasks and their sub-tasks for display
  const aggregatedTimeLogs = (bug?.bugTasks ?? []).flatMap((bt) => {
    const task = bt.task;
    const children = task.children ?? [];
    if (children.length > 0) {
      return children.flatMap((child) =>
        (child.timeLogs ?? []).map((tl) => ({ ...tl, _taskKey: child.taskKey, _taskTitle: child.title })),
      );
    }
    return (task.timeLogs ?? []).map((tl) => ({ ...tl, _taskKey: task.taskKey, _taskTitle: task.title }));
  });
```

- [ ] **Step 3: Add the "Time Logs" tab**

In the Tabs section (around line 329-349), add a new TabsTrigger after "Activity" (line 332):

```tsx
<TabsTrigger value="timelogs">Time Logs</TabsTrigger>
```

Add a new TabsContent after the Activity TabsContent (after line 348):

```tsx
              <TabsContent value="timelogs" className="max-h-[500px] overflow-y-auto">
                {aggregatedTimeLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No time logged on linked tasks yet.</p>
                ) : (
                  <TimeLogsList
                    timeLogs={aggregatedTimeLogs}
                    currentUserId=""
                    onDelete={() => {}}
                  />
                )}
              </TabsContent>
```

Note: Passing `currentUserId=""` and a no-op `onDelete` ensures no delete buttons are rendered (the delete button only shows when `tl.userId === currentUserId`, and empty string won't match any user).

- [ ] **Step 4: Add BugTimeTrackingCard in the sidebar**

In the sidebar section, add the BugTimeTrackingCard. Place it before the "Linked Tasks" section (before line 615), so time tracking is visible at the top of the sidebar:

```tsx
              {/* Time Tracking (aggregated from linked tasks) */}
              <BugTimeTrackingCard bug={bug} />
```

- [ ] **Step 5: Verify frontend compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/BugDetailPage.tsx
git commit -m "feat(bugs): add Time Logs tab and BugTimeTrackingCard to BugDetailPage"
```

---

### Task 12: Manual end-to-end verification

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev` (or however the monorepo dev server starts)

- [ ] **Step 2: Navigate to a bug detail page**

Open a bug that has linked tasks (or link one manually).

- [ ] **Step 3: Test "Create Fix Task" button**

1. Click "Create Fix Task" in the Linked Tasks sidebar
2. Verify the title is pre-filled as `Fix [BUG-KEY]: Bug Title`
3. Verify the assignee is pre-filled from the bug's assignee
4. Optionally select a parent task
5. Click "Create Task"
6. Verify the new task appears in the Linked Tasks list
7. Open the new task — verify description contains all bug details formatted as Markdown

- [ ] **Step 4: Test time log aggregation**

1. Navigate to the created fix task
2. Set an estimate and log some time on it
3. Go back to the bug detail page
4. Verify the "Time Tracking" card in the sidebar shows the aggregated estimate and logged time
5. Click the "Time Logs" tab — verify the logged time entries appear (read-only, no delete buttons)

- [ ] **Step 5: Test sub-task scenario**

1. Create another fix task from the same bug, this time selecting a parent task
2. Verify it's created as a sub-task (e.g., `PM-5-1`)
3. Set estimate and log time on the sub-task
4. Verify the bug's Time Tracking card aggregates from both the direct task and the sub-task
