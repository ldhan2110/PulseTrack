# Bug Detail Enhancements: Rich Editor + Many-to-Many Task Linking

**Date:** 2026-04-14
**Status:** Approved

## Overview

Two enhancements to the bug detail experience:
1. Replace plain `<Textarea>` with `<RichTextEditor>` for Expected Result and Actual Result fields (enabling image attachments and rich formatting)
2. Change the bug-task relationship from single FK (`parentTaskId`) to many-to-many via a join table, with a multi-select task picker on the bug detail sidebar and a simplified linked bugs table on the task detail page

## Feature 1: Rich Editor for Expected/Actual Result

### Schema
No Prisma schema change needed. `expectedResult` and `actualResult` remain `String?` — they will now store sanitized HTML (same as `description` already does).

### API (DTOs)
- **`CreateBugDto`**: Remove `@MaxLength(5000)` from `expectedResult` and `actualResult`
- **`UpdateBugDto`**: Remove `@MaxLength(5000)` from `expectedResult` and `actualResult`

### Frontend (`BugDetailPage.tsx`)
- Replace the two `<Textarea>` components (lines ~348-382) with `<RichTextEditor>` instances
- Each editor receives: `initialContent`, `onSave` (calls `updateBug.mutate`), `editable={true}`, `projectId`, `entityType="bug"`, `entityId={bugId}`
- Remove manual debounce/timer logic: `handleExpectedChange`, `handleExpectedBlur`, `handleActualChange`, `handleActualBlur`, associated refs (`expectedTimerRef`, `actualTimerRef`), and state (`expectedSaving`, `actualSaving`, `expectedValue`, `actualValue`) — `RichTextEditor` handles save-on-blur internally
- Keep the side-by-side layout (`flex gap-4`) with each editor in its own `flex-1` column

### Files Changed
- `apps/api/src/bugs/dto/create-bug.dto.ts`
- `apps/api/src/bugs/dto/update-bug.dto.ts`
- `apps/web/src/pages/BugDetailPage.tsx`

## Feature 2: Bug-Task Many-to-Many Relationship

### Schema (`schema.prisma`)

New join table:
```prisma
model BugTask {
  id        String   @id @default(cuid())
  bugId     String
  taskId    String
  createdAt DateTime @default(now())

  bug  Bug  @relation(fields: [bugId], references: [id], onDelete: Cascade)
  task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@unique([bugId, taskId])
}
```

Changes to existing models:
- **`Bug`**: Remove `parentTaskId`, `parentTask` relation. Add `bugTasks BugTask[]`
- **`Task`**: Remove `bugs Bug[] @relation("TaskBugs")`. Add `bugTasks BugTask[]`

### Migration
- Data migration: Before dropping `parentTaskId`, insert existing `parentTaskId` values into `BugTask` join table
- Then drop `parentTaskId` column from `Bug`

### API

**New endpoints (Bugs controller):**
- `POST /projects/:projectId/bugs/:bugId/tasks` — Link tasks to a bug. Body: `{ taskIds: string[] }`
- `DELETE /projects/:projectId/bugs/:bugId/tasks/:taskId` — Unlink a task from a bug
- `GET /projects/:projectId/bugs/:bugId/tasks` — Get tasks linked to a bug

**New endpoint (Tasks controller):**
- `GET /projects/:projectId/tasks/:taskId/bugs` — Get bugs linked to a task

**Service changes:**
- `BugsService`: Add `linkTasks`, `unlinkTask`, `getLinkedTasks` methods. Update `findOne`/`findAll` to include `bugTasks` with task data.
- `TasksService` (or `BugsService`): Add `getBugsByTaskId` method

**DTO changes:**
- Remove `parentTaskId` from `CreateBugDto` and `UpdateBugDto`
- New `LinkTasksDto`: `{ taskIds: string[] }`

### Frontend — Bug Detail Sidebar (Task Picker)

**Location:** Bug detail page sidebar, new "Linked Tasks" section

**Component:** Multi-select Popover + Command (reuses existing pattern from assignee/owner pickers in `BugDetailPage.tsx`)
- Searchable list of project tasks (fetched via `useTasks` hook)
- Selected tasks shown as clickable chips/badges (click navigates to task detail)
- Can add/remove task links inline

**New hook:** `useBugTasks` — manages linking/unlinking tasks to a bug (React Query mutations + query)

### Frontend — Task Detail (Linked Bugs List)

**New component:** `LinkedBugsTable` (`apps/web/src/components/bugs/LinkedBugsTable.tsx`)
- Simplified version of `BugsTable` — no filter toolbar, no external sorting/filter state
- Columns: Bug Key, Title, Severity, Status
- Rows clickable → navigate to `/projects/:projectPrefix/bugs/:bugKey`
- Props: `bugs: Bug[]`, `projectPrefix: string`

**Integration in `TaskDetailPage.tsx`:**
- New section "Linked Bugs" rendered when the task has linked bugs
- Data fetched via the `GET /tasks/:taskId/bugs` endpoint
- New hook: `useTaskBugs(projectId, taskId)` — fetches bugs linked to a task

### Files Changed
- `apps/api/prisma/schema.prisma` — Join table + model updates
- `apps/api/prisma/migrations/` — New migration
- `apps/api/src/bugs/bugs.controller.ts` — New endpoints
- `apps/api/src/bugs/bugs.service.ts` — New methods, update includes
- `apps/api/src/bugs/dto/create-bug.dto.ts` — Remove `parentTaskId`
- `apps/api/src/bugs/dto/update-bug.dto.ts` — Remove `parentTaskId`
- `apps/api/src/bugs/dto/link-tasks.dto.ts` — New DTO
- `apps/web/src/hooks/useBugs.ts` — New `useBugTasks` hook
- `apps/web/src/pages/BugDetailPage.tsx` — Task picker in sidebar
- `apps/web/src/components/bugs/LinkedBugsTable.tsx` — New component
- `apps/web/src/pages/TaskDetailPage.tsx` — Linked bugs section
