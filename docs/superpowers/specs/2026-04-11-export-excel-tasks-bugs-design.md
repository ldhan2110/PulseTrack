# Export Excel for Tasks & Bugs

## Overview

Server-side Excel export endpoints for Tasks and Bugs with a dedicated filter dialog on the frontend. Users can export all records or apply filters (status, assignee, date ranges, overdue, etc.) before downloading.

## Backend

### Endpoints

| Endpoint | Method | Response |
|----------|--------|----------|
| `/projects/:projectId/tasks/export` | GET | `.xlsx` binary download |
| `/projects/:projectId/bugs/export` | GET | `.xlsx` binary download |

Both endpoints require authentication (JWT guard) and return `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` with a `Content-Disposition: attachment; filename=...` header.

### Task Export Query Params

| Param | Type | Description |
|-------|------|-------------|
| `workflowStatusId` | comma-separated IDs | Filter by workflow status (multi) |
| `assigneeId` | comma-separated IDs | Filter by assignee (multi) |
| `sprintId` | comma-separated IDs | Filter by sprint (multi) |
| `priority` | comma-separated values | Filter by priority (multi) |
| `plannedStartFrom` | ISO date | Planned start date >= |
| `plannedStartTo` | ISO date | Planned start date <= |
| `plannedEndFrom` | ISO date | Planned end date >= |
| `plannedEndTo` | ISO date | Planned end date <= |
| `overdue` | `true` | Where `plannedEndDate < now` AND `actualEndDate` is null |
| `search` | string | Title contains (case-insensitive) |

### Bug Export Query Params

| Param | Type | Description |
|-------|------|-------------|
| `workflowStatusId` | comma-separated IDs | Filter by workflow status (multi) |
| `severity` | comma-separated values | Filter by severity (multi) |
| `assigneeId` | comma-separated IDs | Filter by assignee (multi) |
| `reporterId` | comma-separated IDs | Filter by reporter (multi) |
| `search` | string | Title contains (case-insensitive) |

### Excel Columns

**Tasks sheet:**

| Column | Source |
|--------|--------|
| Task Key | `taskKey` |
| Title | `title` |
| Description | `description` |
| Status | `workflowStatus.name` |
| Priority | `priority` |
| Assignee | `assignee.name \|\| assignee.username` |
| Sprint | `sprint.name` |
| Story Points | `storyPoints` |
| Estimated (min) | `estimatedMinutes` |
| Time Logged (min) | `SUM(timeLogs[].minutes)` |
| Planned Start | `plannedStartDate` |
| Planned End | `plannedEndDate` |
| Actual Start | `actualStartDate` |
| Actual End | `actualEndDate` |
| Created At | `createdAt` |

**Bugs sheet:**

| Column | Source |
|--------|--------|
| Bug Key | `bugKey` |
| Title | `title` |
| Description | `description` |
| Severity | `severity` |
| Status | `workflowStatus.name` |
| Assignee | `assignee.name \|\| assignee.username` |
| Owner | `owner.name \|\| owner.username` |
| Reporter | `reporter.name \|\| reporter.username` |
| Environment | `environment` |
| Preconditions | `preconditions` |
| Expected Result | `expectedResult` |
| Actual Result | `actualResult` |
| Repro Steps | Joined as `"1. step\n2. step\n..."` |
| Parent Task | `parentTask.taskKey` |
| Created At | `createdAt` |

### Implementation Details

- Install `exceljs` in `apps/api` for Excel generation
- Add `exportExcel()` method to `TasksService` and `BugsService`
  - Reuses existing Prisma queries with extended filter support
  - Includes all relations needed for display names
  - Tasks: include `timeLogs: { select: { minutes: true } }` for time sum
- Add export endpoints to `TasksController` and `BugsController`
  - Set response headers for file download
  - Pipe the exceljs workbook buffer to response
- Filename format: `tasks-{projectPrefix}-{YYYY-MM-DD}.xlsx`, `bugs-{projectPrefix}-{YYYY-MM-DD}.xlsx`

## Frontend

### Export Dialog Components

Two new components: `ExportTasksDialog` and `ExportBugsDialog`.

#### ExportTasksDialog

Filters available:
- **Status** — multi-select checkboxes (workflow statuses for TASK kind)
- **Assignee** — multi-select checkboxes (project members)
- **Sprint** — multi-select checkboxes (project sprints)
- **Priority** — multi-select checkboxes (LOW, MEDIUM, HIGH, CRITICAL)
- **Planned Start** — date range picker (from / to)
- **Planned End** — date range picker (from / to)
- **Overdue** — checkbox ("Only overdue tasks")
- **Search** — text input

#### ExportBugsDialog

Filters available:
- **Status** — multi-select checkboxes (workflow statuses for BUG kind)
- **Severity** — multi-select checkboxes (CRITICAL, HIGH, MEDIUM, LOW)
- **Assignee** — multi-select checkboxes (project members)
- **Reporter** — multi-select checkboxes (project members)
- **Search** — text input

#### Dialog Layout

- Title: "Export Tasks to Excel" / "Export Bugs to Excel"
- Filter controls in a grid layout (2 columns)
- Footer with two buttons:
  - "Export All" — downloads without filters
  - "Export Filtered" — downloads with current filter selection
- Shows count of active filters as a badge

### API Client

Add to `api.ts`:

```typescript
exportTasks: (projectId: string, params?: Record<string, string>) => downloadFile(`/projects/${projectId}/tasks/export`, params)
exportBugs: (projectId: string, params?: Record<string, string>) => downloadFile(`/projects/${projectId}/bugs/export`, params)
```

A new `downloadFile` helper that:
1. Builds the URL with query params
2. Fetches with auth token
3. Creates a blob from the response
4. Triggers browser download via `<a>` element click

### Page Integration

- **BacklogPage**: Add "Export Excel" button next to "Create Task"
- **BugsPage**: Add "Export Excel" button next to "Import from Excel"

## What's NOT Included

- No background job / async export — synchronous response (per-project data is bounded)
- No CSV option — Excel only
- No import for tasks (separate feature)
- No overdue filter for bugs (no due date field on Bug model)
