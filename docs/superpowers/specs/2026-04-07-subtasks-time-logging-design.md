# Sub-Tasks & Time Logging Design

**Date:** 2026-04-07
**Status:** Approved
**Scope:** Task hierarchy (one-level sub-tasks), time estimation, time logging, progress visualization

---

## Problem

Tasks currently lack time tracking and meaningful sub-task support. The existing `SubTask` model is a lightweight entity (title, assignee, status only) that cannot carry estimates, time logs, or descriptions. The `TimeLog` model exists in the database but has no UI. PMs and developers have no way to estimate work, log actual hours, or see progress against estimates.

## Goals

1. Replace the lightweight `SubTask` model with a self-referencing `Task` hierarchy (one level deep)
2. Enable per-person time estimation on tasks and sub-tasks
3. Enable time logging with comments and auto-dated entries
4. Display dual progress bars (Estimate vs Actual) on the task detail right sidebar
5. Show sub-tasks as cards on the parent task detail page
6. Support expandable parent/sub-task rows in the task table
7. Derive sub-task keys from parent key (e.g., `HRM-1-1`, `HRM-1-2`)

## Non-Goals

- Multi-level nesting (sub-tasks of sub-tasks)
- Start/stop timer functionality
- Billable vs non-billable time distinction
- Time approval workflows

---

## Data Model Changes

### Task Model — New Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `parentId` | `String?` (FK → Task) | `null` | If set, this task is a sub-task of the referenced parent |
| `estimatedMinutes` | `Int?` | `null` | Time estimate in minutes, set by the assignee |
| `subTaskSequence` | `Int` | `0` | Auto-incrementing counter for generating child task keys |

**Relations:**
- `parent` — optional relation to parent Task (onDelete: Cascade)
- `children` — one-to-many relation to child Tasks

**Constraints:**
- A task with a `parentId` cannot itself be a parent (enforced in API, not DB)
- `parentId` must reference a task in the same project
- Cascade delete: deleting a parent deletes all children, their time logs, comments, and attachments

### Task Key Generation for Sub-Tasks

- Parent task key: generated from project prefix + project sequence (existing behavior, e.g., `HRM-1`)
- Sub-task key: `{parentKey}-{subTaskSequence}` (e.g., `HRM-1-1`, `HRM-1-2`)
- When creating a sub-task, atomically increment the parent's `subTaskSequence` and use the new value
- Sub-task keys are immutable once assigned

### TimeLog Model — New Field

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `comment` | `String?` | `null` | Description of work performed |

**Existing fields retained:** `id`, `minutes`, `loggedAt`, `taskId`, `userId`, `blueprintId`

**Behavior change:** `loggedAt` defaults to `now()` in the API when not provided by the client.

### SubTask Model — Removal

The existing `SubTask` model is eliminated entirely. All references to `SubTask` in controllers, services, DTOs, and frontend code are replaced with the self-referencing `Task` model.

---

## Business Rules

### Time Tracking Rules

1. **Leaf tasks** (no children): the assignee sets `estimatedMinutes` directly and logs time directly
2. **Parent tasks** (has children): `estimatedMinutes` and time logging are disabled; both values are auto-summed from children
3. Multiple users can log time on the same task
4. Each time log entry records: duration (minutes), date (auto-filled to today), comment (optional), and the logging user
5. Time logs create an entry in the task activity log: "{User} logged {duration}" with the comment if provided

### Over-Budget Detection

- When total logged minutes > total estimated minutes on a task, the task is "over-budget"
- Visual indicators: actual progress bar turns red, "Remaining" label changes to "Over by: Xh Ym"
- In the task table: the Logged column value turns red with a warning icon

### Sub-Task Hierarchy Rules

1. Maximum depth: 1 level (parent → children only)
2. A task with `parentId` set cannot have children — API rejects attempts to create sub-tasks on a sub-task
3. Sub-tasks inherit the project from their parent (cannot belong to a different project)
4. Sub-tasks can have their own: assignee, status, priority, estimate, time logs, comments, attachments, acceptance criteria, description, planned/actual dates
5. Sub-tasks appear in the task table nested under their parent
6. Sub-tasks have their own full Task Detail page with breadcrumb navigation back to parent

---

## API Changes

### Modified Endpoints

**`POST /projects/:projectId/tasks`** — Create Task
- Accepts optional `parentId` in the body
- If `parentId` is provided:
  - Validates the parent exists in the same project
  - Validates the parent is not itself a sub-task
  - Atomically increments parent's `subTaskSequence`
  - Generates `taskKey` as `{parentKey}-{newSequence}`
- If `parentId` is not provided: existing behavior (project-level sequence)

**`PATCH /projects/:projectId/tasks/:taskId`** — Update Task
- Accepts optional `estimatedMinutes`
- Rejects `estimatedMinutes` if the task has children (auto-summed from children)

**`GET /projects/:projectId/tasks`** — List Tasks
- Returns tasks with `children` relation included (for expand/collapse in table)
- By default, returns only top-level tasks (`parentId` is null)
- Each parent includes a `children` array with summary data (id, taskKey, title, assignee, status, estimatedMinutes, totalLoggedMinutes)
- Add query param `?includeSubTasks=true` to include sub-tasks inline

**`GET /projects/:projectId/tasks/:taskId`** — Get Task Detail
- Includes `children` with full sub-task data
- Includes computed `totalEstimatedMinutes` and `totalLoggedMinutes`
- If task has children: these are sums of children values
- If task is a leaf: `totalEstimatedMinutes` = own `estimatedMinutes`, `totalLoggedMinutes` = sum of own time logs

### New Endpoints

**`POST /projects/:projectId/tasks/:taskId/time-logs`** — Create Time Log
- Body: `{ minutes: number, comment?: string, loggedAt?: string }`
- `loggedAt` defaults to current date if not provided
- Rejects if the task has children (must log on sub-tasks)
- Creates activity log entry: "{User} logged {formatted duration}"
- Emits Socket.IO event for real-time update

**`GET /projects/:projectId/tasks/:taskId/time-logs`** — List Time Logs
- Returns all time logs for the task, ordered by `loggedAt` descending
- Includes user relation (name, avatar) for display

**`DELETE /projects/:projectId/tasks/:taskId/time-logs/:timeLogId`** — Delete Time Log
- Only the user who created the log or a PM can delete
- Updates activity log and emits Socket.IO event

### Removed Endpoints

- `POST /projects/:projectId/tasks/:taskId/subtasks` — replaced by `POST /tasks` with `parentId`
- `PATCH /projects/:projectId/tasks/:taskId/subtasks/:subTaskId` — replaced by `PATCH /tasks/:taskId`
- `DELETE /projects/:projectId/tasks/:taskId/subtasks/:subTaskId` — replaced by `DELETE /tasks/:taskId`

---

## Frontend Changes

### Task Detail Page — Right Sidebar

**Time Tracking Card** (new section, placed after Priority):
- Two stacked horizontal progress bars inside a bordered card:
  - **Estimate bar** (blue, `#3b82f6`): represents total estimated minutes, always 100% width as the baseline
  - **Actual bar** (green, `#22c55e`): fills proportionally against the estimate (actual / estimate * 100%)
  - When actual > estimate: actual bar turns red (`#ef4444`), fills to 100%
- Labels above each bar: "Estimate — Xh Ym" and "Actual — Xh Ym"
- Footer: "Remaining: Xh Ym" (green) or "Over by: Xh Ym" (red)
- For parent tasks: values are auto-summed from children, displayed as read-only
- For leaf tasks: estimate is editable via an input field

**Log Time Card** (new section, below Time Tracking):
- Only shown on leaf tasks (hidden when task has children)
- Inputs: Hours (number), Minutes (number), Date (date picker, defaults to today)
- Comment textarea: "What did you work on..."
- "Log Time" submit button
- On submit: calls `POST /tasks/:taskId/time-logs`, invalidates task query

**Estimate Input** (in Time Tracking card for leaf tasks):
- Editable hours + minutes input that saves to `estimatedMinutes`
- Disabled on parent tasks (shows "Auto-summed from sub-tasks" tooltip)

### Task Detail Page — Left Panel

**Time Logs Section** (new, between Acceptance Criteria and Comments):
- Header: "Time Logs (N)" with total logged time displayed
- Table rows: User avatar + name | Date | Duration (Xh Ym) | Comment
- Sorted by date descending (most recent first)
- Each row has a delete button (visible only to the log author or PM)
- Empty state: "No time logged yet"

**Sub-Tasks Section** (replaces existing sub-task sidebar section, moved to left panel):
- Header: "Sub-tasks (N)" with "+ Add Sub-task" button
- Card list layout, each card shows:
  - Task key (muted, e.g., `HRM-2-1`) and title
  - Assignee avatar + name
  - Status badge (colored by workflow status)
  - Mini progress bar: estimate vs actual with "Xh Ym / Yh Zm" label
- Click card → navigates to `/projects/:projectId/tasks/:taskKey` (sub-task's own detail page)
- "+ Add Sub-task" opens an inline form or modal with: title, assignee, status, priority, estimate

**Activity Log:**
- Time log entries appear as: clock icon + "{User} logged {Xh Ym}" with optional comment preview
- Sub-task creation appears as: "{User} created sub-task {HRM-2-1}"

### Task Detail Page — Breadcrumb Navigation

- Top-level task: `Project Name > HRM-1: Task Title`
- Sub-task: `Project Name > HRM-1: Parent Title > HRM-1-2: Sub-task Title`
- Parent link in breadcrumb navigates back to parent task detail

### Tasks Table

**Expand/Collapse:**
- Parent tasks (those with children) show a ▶/▼ toggle arrow in the first column
- Clicking ▶ expands to reveal sub-task rows indented below the parent
- Sub-task rows:
  - Key column: indented, smaller font, muted color (e.g., `HRM-2-1`)
  - Title column: prefixed with `└` connector character
  - All other columns (Assignee, Status, Priority, Est., Logged) display normally
- Collapse state persists per session (not across page reloads)

**New Columns:**
- **Est.** — total estimated time, formatted as "Xh" or "Xh Ym"
- **Logged** — total logged time, same format
- Over-budget: Logged value turns red with ⚠️ icon when exceeding estimate

**Parent Row Aggregation:**
- Est. column on parent row = sum of children's `estimatedMinutes`
- Logged column on parent row = sum of children's total logged minutes

### My Tasks Board (Kanban)

- Sub-tasks appear as their own cards (they are tasks)
- Card shows: task key, title, priority, planned end date (existing behavior)
- Add a mini progress indicator if the task has an estimate: small bar or "2h/4h" text

---

## Migration Plan

### Database Migration

1. Add `parentId`, `estimatedMinutes`, `subTaskSequence` columns to `Task` table
2. Add `comment` column to `TimeLog` table
3. Add foreign key constraint on `Task.parentId` → `Task.id` with cascade delete
4. Data migration script:
   - For each existing `SubTask` record:
     - Create a new `Task` record in the same project as the parent
     - Set `parentId` to the sub-task's current `taskId` (parent reference)
     - Copy `title`, `assigneeId`, `workflowStatusId` from the `SubTask`
     - Generate `taskKey` from parent's key + sequence
     - Increment parent's `subTaskSequence`
5. Drop `SubTask` table
6. Remove `SubTask` model from Prisma schema

### Code Migration

1. Remove `SubTask`-related DTOs, service methods, and controller endpoints
2. Update `Task` DTOs to include `parentId` and `estimatedMinutes`
3. Update `Task` service with hierarchy logic (parent validation, key generation, aggregation)
4. Add `TimeLog` controller, service, and DTOs
5. Update frontend components to remove old sub-task handling and add new features
6. Update Socket.IO events for time log changes

---

## Computed Values Reference

| Value | Leaf Task (no children) | Parent Task (has children) |
|-------|------------------------|---------------------------|
| `totalEstimatedMinutes` | Own `estimatedMinutes` | Sum of children's `estimatedMinutes` |
| `totalLoggedMinutes` | Sum of own `timeLogs.minutes` | Sum of children's `totalLoggedMinutes` |
| `remainingMinutes` | `totalEstimatedMinutes - totalLoggedMinutes` | Same |
| `isOverBudget` | `totalLoggedMinutes > totalEstimatedMinutes` | Same |
| `progressPercent` | `totalLoggedMinutes / totalEstimatedMinutes * 100` | Same |

---

## Format Helper

All durations displayed as human-readable format:
- 0 minutes → "0m"
- 45 minutes → "45m"
- 60 minutes → "1h"
- 90 minutes → "1h 30m"
- 480 minutes → "8h"
