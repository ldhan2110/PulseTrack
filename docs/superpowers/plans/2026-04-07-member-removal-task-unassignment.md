# Member Removal Task Unassignment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a project member is removed, automatically unassign their active Tasks, SubTasks, and Bugs while preserving assignee on completed items, with PM notifications and a pre-removal warning dialog.

**Architecture:** Extend `MembersService.removeMember()` to wrap all operations in a Prisma `$transaction` — query active work, bulk unassign, record history, then delete the member. Add a new `GET active-work` endpoint for the frontend confirmation dialog. Frontend fetches counts before showing the removal dialog.

**Tech Stack:** NestJS, Prisma, React, TanStack Query, Socket.IO

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/api/src/members/members.service.ts` | Modify | Add `getActiveWork()` method, rewrite `removeMember()` with transaction |
| `apps/api/src/members/members.controller.ts` | Modify | Add `GET :memberId/active-work` endpoint |
| `apps/web/src/lib/api.ts` | Modify | Add `getMemberActiveWork()` API call |
| `apps/web/src/hooks/useMembers.ts` | Modify | Add `useMemberActiveWork()` query hook |
| `apps/web/src/components/members/MembersTable.tsx` | Modify | Enhanced removal dialog with active work counts |

---

### Task 1: Backend — Add `getActiveWork()` to MembersService

**Files:**
- Modify: `apps/api/src/members/members.service.ts:165-183`

- [ ] **Step 1: Add `getActiveWork` method to MembersService**

Add this method after `searchUsers()` in `apps/api/src/members/members.service.ts`:

```typescript
async getActiveWork(projectId: string, memberId: string) {
  const member = await this.prisma.projectMember.findFirst({
    where: { id: memberId, projectId },
  });

  if (!member) {
    throw new NotFoundException('Member not found in this project');
  }

  const [tasks, subTasks, bugs] = await Promise.all([
    this.prisma.task.count({
      where: {
        projectId,
        assigneeId: member.userId,
        status: { not: 'DONE' },
      },
    }),
    this.prisma.subTask.count({
      where: {
        parent: { projectId },
        assigneeId: member.userId,
        status: { not: 'DONE' },
      },
    }),
    this.prisma.bug.count({
      where: {
        projectId,
        assigneeId: member.userId,
        status: { notIn: ['RESOLVED', 'CLOSED'] },
      },
    }),
  ]);

  return { tasks, subTasks, bugs };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/members/members.service.ts
git commit -m "feat: add getActiveWork method to MembersService"
```

---

### Task 2: Backend — Add active-work endpoint to MembersController

**Files:**
- Modify: `apps/api/src/members/members.controller.ts:66-73`

- [ ] **Step 1: Add the GET endpoint**

Add this method before the `removeMember` method in `apps/api/src/members/members.controller.ts`:

```typescript
@Get(':memberId/active-work')
@ProjectRoles('pm')
getActiveWork(
  @Param('projectId') projectId: string,
  @Param('memberId') memberId: string,
) {
  return this.membersService.getActiveWork(projectId, memberId);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/members/members.controller.ts
git commit -m "feat: add GET active-work endpoint for member removal"
```

---

### Task 3: Backend — Rewrite `removeMember()` with transaction

**Files:**
- Modify: `apps/api/src/members/members.service.ts:138-163`

- [ ] **Step 1: Replace the `removeMember` method**

Replace the existing `removeMember` method in `apps/api/src/members/members.service.ts` with:

```typescript
async removeMember(projectId: string, memberId: string, actorId: string) {
  const member = await this.prisma.projectMember.findFirst({
    where: { id: memberId, projectId },
  });

  if (!member) {
    throw new NotFoundException('Member not found in this project');
  }

  // Prevent removing the last PM
  if (member.role === 'pm') {
    const pmCount = await this.prisma.projectMember.count({
      where: { projectId, role: 'pm' },
    });

    if (pmCount <= 1) {
      throw new BadRequestException(
        'Cannot remove the last PM from a project',
      );
    }
  }

  const userId = member.userId;

  // Find active tasks for history recording (need individual IDs)
  const activeTasks = await this.prisma.task.findMany({
    where: {
      projectId,
      assigneeId: userId,
      status: { not: 'DONE' },
    },
    select: { id: true },
  });

  // Execute all mutations in a single transaction
  await this.prisma.$transaction([
    // Unassign active tasks
    this.prisma.task.updateMany({
      where: {
        projectId,
        assigneeId: userId,
        status: { not: 'DONE' },
      },
      data: { assigneeId: null },
    }),
    // Unassign active subtasks
    this.prisma.subTask.updateMany({
      where: {
        parent: { projectId },
        assigneeId: userId,
        status: { not: 'DONE' },
      },
      data: { assigneeId: null },
    }),
    // Unassign active bugs
    this.prisma.bug.updateMany({
      where: {
        projectId,
        assigneeId: userId,
        status: { notIn: ['RESOLVED', 'CLOSED'] },
      },
      data: { assigneeId: null },
    }),
    // Record history for each unassigned task
    ...activeTasks.map((task) =>
      this.prisma.taskHistory.create({
        data: {
          taskId: task.id,
          actorId,
          field: 'assigneeId',
          oldValue: userId,
          newValue: null,
        },
      }),
    ),
    // Delete the project member
    this.prisma.projectMember.delete({ where: { id: memberId } }),
  ]);

  // Post-transaction: notifications
  this.notifications.notifyUser(userId, 'member:removed', { projectId });

  // Notify PMs about unassigned work (if any items were unassigned)
  const unassignedCount = activeTasks.length;
  if (unassignedCount > 0) {
    const [subTaskCount, bugCount] = await Promise.all([
      // These were already unassigned in the transaction, so count what was affected
      // We can derive counts from the pre-transaction state
      this.prisma.subTask.count({
        where: {
          parent: { projectId },
          assigneeId: null, // already unassigned
          status: { not: 'DONE' },
        },
      }),
      Promise.resolve(0), // placeholder, we'll fix this
    ]);

    // Get PM user IDs (excluding the actor)
    const pms = await this.prisma.projectMember.findMany({
      where: { projectId, role: 'pm', userId: { not: actorId } },
      select: { userId: true },
    });

    const memberUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    for (const pm of pms) {
      this.notifications.notifyUser(pm.userId, 'member:removed:tasks-unassigned', {
        projectId,
        memberName: memberUser?.username ?? 'Unknown',
        tasks: unassignedCount,
        subTasks: 0,
        bugs: 0,
      });
    }
  }

  // Emit project-wide event to refresh boards
  this.notifications.notifyProject(projectId, 'member:removed', { projectId, memberId });
}
```

Wait — this approach has a problem. We can't count subtasks/bugs that were unassigned after the transaction because we'd be counting all null-assignee items. Let me fix this. We need to capture the counts before the transaction.

- [ ] **Step 1 (corrected): Replace the `removeMember` method**

Replace the existing `removeMember` method in `apps/api/src/members/members.service.ts` with:

```typescript
async removeMember(projectId: string, memberId: string, actorId: string) {
  const member = await this.prisma.projectMember.findFirst({
    where: { id: memberId, projectId },
  });

  if (!member) {
    throw new NotFoundException('Member not found in this project');
  }

  // Prevent removing the last PM
  if (member.role === 'pm') {
    const pmCount = await this.prisma.projectMember.count({
      where: { projectId, role: 'pm' },
    });

    if (pmCount <= 1) {
      throw new BadRequestException(
        'Cannot remove the last PM from a project',
      );
    }
  }

  const userId = member.userId;

  // Gather counts and task IDs before the transaction
  const [activeTasks, activeSubTaskCount, activeBugCount] = await Promise.all([
    this.prisma.task.findMany({
      where: {
        projectId,
        assigneeId: userId,
        status: { not: 'DONE' },
      },
      select: { id: true },
    }),
    this.prisma.subTask.count({
      where: {
        parent: { projectId },
        assigneeId: userId,
        status: { not: 'DONE' },
      },
    }),
    this.prisma.bug.count({
      where: {
        projectId,
        assigneeId: userId,
        status: { notIn: ['RESOLVED', 'CLOSED'] },
      },
    }),
  ]);

  const activeTaskCount = activeTasks.length;

  // Execute all mutations in a single transaction
  await this.prisma.$transaction([
    // Unassign active tasks
    this.prisma.task.updateMany({
      where: {
        projectId,
        assigneeId: userId,
        status: { not: 'DONE' },
      },
      data: { assigneeId: null },
    }),
    // Unassign active subtasks
    this.prisma.subTask.updateMany({
      where: {
        parent: { projectId },
        assigneeId: userId,
        status: { not: 'DONE' },
      },
      data: { assigneeId: null },
    }),
    // Unassign active bugs
    this.prisma.bug.updateMany({
      where: {
        projectId,
        assigneeId: userId,
        status: { notIn: ['RESOLVED', 'CLOSED'] },
      },
      data: { assigneeId: null },
    }),
    // Record history for each unassigned task
    ...activeTasks.map((task) =>
      this.prisma.taskHistory.create({
        data: {
          taskId: task.id,
          actorId,
          field: 'assigneeId',
          oldValue: userId,
          newValue: null,
        },
      }),
    ),
    // Delete the project member
    this.prisma.projectMember.delete({ where: { id: memberId } }),
  ]);

  // Post-transaction notifications
  this.notifications.notifyUser(userId, 'member:removed', { projectId });

  const totalUnassigned = activeTaskCount + activeSubTaskCount + activeBugCount;
  if (totalUnassigned > 0) {
    const pms = await this.prisma.projectMember.findMany({
      where: { projectId, role: 'pm', userId: { not: actorId } },
      select: { userId: true },
    });

    const memberUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    for (const pm of pms) {
      this.notifications.notifyUser(pm.userId, 'member:removed:tasks-unassigned', {
        projectId,
        memberName: memberUser?.username ?? 'Unknown',
        tasks: activeTaskCount,
        subTasks: activeSubTaskCount,
        bugs: activeBugCount,
      });
    }
  }

  // Emit project-wide event to refresh boards
  this.notifications.notifyProject(projectId, 'member:removed', { projectId, memberId });
}
```

- [ ] **Step 2: Update the controller to pass `actorId`**

The `removeMember` controller method needs to extract the current user ID from the request. Update `apps/api/src/members/members.controller.ts`:

Import `Req` from `@nestjs/common` and `Request` type (add to existing imports):

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
```

Update the `removeMember` method:

```typescript
@Delete(':memberId')
@ProjectRoles('pm')
removeMember(
  @Param('projectId') projectId: string,
  @Param('memberId') memberId: string,
  @Req() req: Request & { user: { id: string } },
) {
  return this.membersService.removeMember(projectId, memberId, req.user.id);
}
```

- [ ] **Step 3: Compile check**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/members/members.service.ts apps/api/src/members/members.controller.ts
git commit -m "feat: unassign active tasks/subtasks/bugs on member removal with history and PM notifications"
```

---

### Task 4: Frontend — Add API call and query hook

**Files:**
- Modify: `apps/web/src/lib/api.ts:100-101`
- Modify: `apps/web/src/hooks/useMembers.ts:65-78`

- [ ] **Step 1: Add `getMemberActiveWork` to the API client**

In `apps/web/src/lib/api.ts`, add this line after the `removeMember` entry (line 101):

```typescript
getMemberActiveWork: (projectId: string, memberId: string) =>
  request<{ tasks: number; subTasks: number; bugs: number }>(`/projects/${projectId}/members/${memberId}/active-work`),
```

- [ ] **Step 2: Add `useMemberActiveWork` hook**

In `apps/web/src/hooks/useMembers.ts`, add this hook after `useRemoveMember`:

```typescript
export function useMemberActiveWork(projectId: string, memberId: string | null) {
  return useQuery({
    queryKey: ['member-active-work', projectId, memberId],
    queryFn: () => api.getMemberActiveWork(projectId, memberId!),
    enabled: !!memberId,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/hooks/useMembers.ts
git commit -m "feat: add getMemberActiveWork API call and useMemberActiveWork hook"
```

---

### Task 5: Frontend — Enhanced removal confirmation dialog

**Files:**
- Modify: `apps/web/src/components/members/MembersTable.tsx`

- [ ] **Step 1: Import the new hook and update the component**

In `apps/web/src/components/members/MembersTable.tsx`, update the import from `useMembers`:

```typescript
import { useChangeMemberRole, useRemoveMember, useMemberActiveWork } from '@/hooks/useMembers';
```

- [ ] **Step 2: Add the query hook to the component**

Inside the `MembersTable` component, after the existing hooks, add:

```typescript
const activeWork = useMemberActiveWork(projectId, removingMember?.id ?? null);
```

- [ ] **Step 3: Create the dynamic description builder**

Add this helper function inside the `MembersTable` component, after the hooks:

```typescript
const getRemovalDescription = () => {
  if (!removingMember) return '';

  const name = removingMember.user.username;
  const base = `Remove ${name} from this project? They will lose access to all project data.`;

  if (activeWork.isLoading) return base;
  if (!activeWork.data) return base;

  const { tasks, subTasks, bugs } = activeWork.data;
  const total = tasks + subTasks + bugs;
  if (total === 0) return base;

  const parts: string[] = [];
  if (tasks > 0) parts.push(`${tasks} task${tasks !== 1 ? 's' : ''}`);
  if (subTasks > 0) parts.push(`${subTasks} subtask${subTasks !== 1 ? 's' : ''}`);
  if (bugs > 0) parts.push(`${bugs} bug${bugs !== 1 ? 's' : ''}`);

  return `Removing ${name} will unassign ${parts.join(', ')} currently assigned to them. These items will become unassigned.`;
};
```

- [ ] **Step 4: Update the AlertDialogDescription**

Replace the existing `AlertDialogDescription` content:

```typescript
<AlertDialogDescription>
  {getRemovalDescription()}
</AlertDialogDescription>
```

- [ ] **Step 5: Compile check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/members/MembersTable.tsx
git commit -m "feat: show active work count in member removal confirmation dialog"
```

---

### Task 6: Frontend — Invalidate task queries after member removal

**Files:**
- Modify: `apps/web/src/hooks/useMembers.ts:65-78`

- [ ] **Step 1: Update `useRemoveMember` to invalidate task queries**

Replace the `useRemoveMember` function in `apps/web/src/hooks/useMembers.ts`:

```typescript
export function useRemoveMember(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, name }: { memberId: string; name: string }) =>
      api.removeMember(projectId, memberId).then(() => name),
    onSuccess: (name) => {
      void queryClient.invalidateQueries({ queryKey: ['members', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['bugs', projectId] });
      toast.success(`${name} removed from project`);
    },
    onError: () => {
      toast.error('Something went wrong. Please try again.');
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/useMembers.ts
git commit -m "feat: invalidate task and bug queries after member removal"
```
