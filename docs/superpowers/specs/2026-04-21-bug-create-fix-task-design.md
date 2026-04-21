# Bug "Create Fix Task" Feature Design

## Overview

Add the ability to create a fix task directly from a bug, with the bug's details auto-populated into the task description. Time logs from linked tasks/sub-tasks are aggregated and displayed on the Bug Detail page (read-only).

## Requirements

- **Trigger:** Manual "Create Fix Task" button on the Bug Detail page sidebar (Linked Tasks section)
- **Task title format:** `Fix [BUG-3]: Login button unresponsive`
- **Task description:** Auto-composed from bug fields (description, preconditions, expected/actual result, environment, repro steps)
- **Assignee:** Defaults to the bug's assignee, editable in dialog
- **Parent task:** Optional — user can select a parent task to create it as a sub-task
- **Minimal dialog:** Title (pre-filled, editable), parent task (optional combobox), assignee (pre-filled, editable)
- **Time log aggregation:** Bug Detail page shows read-only aggregated time logs from all linked tasks and their sub-tasks

## Architecture: Approach A — Bug-Side Endpoint

The action originates from a bug, so the endpoint lives in the bugs module. Single atomic transaction, one API call.

### 1. Backend API

**New endpoint:** `POST /projects/:projectId/bugs/:bugId/create-fix-task`

**DTO — `CreateFixTaskDto`:**

```ts
{
  parentId?: string;   // optional — creates sub-task if provided
  assigneeId?: string; // defaults to bug.assigneeId
}
```

**BugsService.createFixTask(bugId, projectId, creatorId, dto):**

1. Fetch the bug with relations: `assignee`, `reproSteps` (ordered by position)
2. Compose title: `Fix [${bug.bugKey}]: ${bug.title}`
3. Compose description as Markdown (Task description field supports rich text rendering):
   ```markdown
   **Bug:** {bug.bugKey}
   **Description:** {bug.description}
   **Preconditions:** {bug.preconditions}
   **Expected Result:** {bug.expectedResult}
   **Actual Result:** {bug.actualResult}
   **Environment:** {bug.environment}
   **Repro Steps:**
   1. {step.description}
   2. {step.description}
   ```
   Only include sections where the field is non-null/non-empty.
4. Call `TasksService.create(projectId, creatorId, { title, description, parentId: dto.parentId, assigneeId: dto.assigneeId ?? bug.assigneeId })`
5. Create `BugTask` link: `prisma.bugTask.create({ data: { bugId, taskId: createdTask.id } })`
6. Return the created task

**Module dependency:** `BugsModule` imports `TasksModule`, `BugsService` injects `TasksService`.

**Controller:** `BugsController` adds `@Post(':bugId/create-fix-task')` with `@RequirePermission('bugs', 'update')`.

### 2. Frontend — Create Fix Task Dialog

**Location:** Bug Detail page sidebar, in the "Linked Tasks" section. A `+ Create Fix Task` button placed below the existing "Link tasks..." popover trigger.

**Dialog component:** `CreateFixTaskDialog`

Fields:
- **Title** — text input, pre-filled with `Fix [BUG-3]: Bug title`, editable
- **Parent Task** — optional combobox (search by taskKey/title), same pattern as existing link-tasks popover. Only shows top-level tasks (tasks without a parentId)
- **Assignee** — dropdown of project members, pre-filled with bug's assignee

**After creation:**
- React-query cache invalidation refreshes the Linked Tasks list
- Toast notification: "Fix task {taskKey} created"

**New hook:** `useCreateFixTask(projectId)` in `useBugs.ts`
- Mutation calls `POST /projects/:projectId/bugs/:bugId/create-fix-task`
- On success: invalidate `['bugs', bugId]` and `['tasks', projectId]` queries

### 3. Bug Time Logs Aggregation (Display Only)

**Backend — data fetching:**

Extend `BugsService.findOne()` to include time log data in the existing bug response (additive — existing fields unchanged, new fields added):

```
Bug → bugTasks[] → task → timeLogs[] (with user relation)
Bug → bugTasks[] → task → children[] → timeLogs[] (with user relation)
Bug → bugTasks[] → task → children[] → estimatedMinutes
Bug → bugTasks[] → task → estimatedMinutes
```

Flatten into a response shape that includes:
- `aggregatedTimeLogs`: flat array of time logs with `taskKey` and `taskTitle` context
- `totalEstimatedMinutes`: sum of all linked tasks + their sub-tasks
- `totalLoggedMinutes`: sum of all time logs

**Frontend — Bug Detail page:**

1. **Time Logs tab:** Add alongside existing "Comments" tab using the same `Tabs` pattern from `TaskDetailPage`. Renders `TimeLogsList` in read-only mode (no delete buttons). Each entry shows which task it belongs to.

2. **Time Tracking summary in sidebar:** A `TimeTrackingCard`-style component showing:
   - Total estimated vs total logged (progress bars)
   - Remaining / over budget indicator
   - Label: "Auto-summed from linked tasks"
   - No action buttons (read-only — time is logged on the task side)

## Existing Infrastructure Leveraged

- `TasksService.create()` — handles taskKey generation, sub-task sequencing, default workflow status
- `BugTask` join table — already exists for bug-task linking
- `TimeLogsList` component — reused in read-only mode
- `TimeTrackingCard` pattern — adapted for bug context (read-only, no actions)
- `useBugs.ts` hooks — extended with `useCreateFixTask`
- Link/unlink popover UI — existing pattern for the parent task selector

## Files to Modify

### Backend (apps/api)
- `src/bugs/bugs.service.ts` — add `createFixTask()`, extend `findOne()` for time log aggregation
- `src/bugs/bugs.controller.ts` — add `POST :bugId/create-fix-task` endpoint
- `src/bugs/bugs.module.ts` — import `TasksModule`
- `src/bugs/dto/create-fix-task.dto.ts` — new DTO file
- `src/tasks/tasks.module.ts` — export `TasksService` if not already exported

### Frontend (apps/web)
- `src/pages/BugDetailPage.tsx` — add Create Fix Task button, Time Logs tab, Time Tracking sidebar card
- `src/hooks/useBugs.ts` — add `useCreateFixTask` mutation hook
- `src/components/bugs/CreateFixTaskDialog.tsx` — new dialog component
- `src/components/bugs/BugTimeTrackingCard.tsx` — new read-only time tracking card for bugs
