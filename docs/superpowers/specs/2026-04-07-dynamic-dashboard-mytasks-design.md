# Dynamic Dashboard Status Cards & My Tasks Table

**Date:** 2026-04-07
**Status:** Approved

## Overview

Two changes: (1) Dashboard status cards render dynamically from the project's workflow configuration with horizontal scroll on overflow, and (2) My Tasks becomes a filterable table sorted by due date and priority so users can focus on what needs attention first. A new `isWorking` flag on `WorkflowStatus` provides a visual indicator for tasks the user is actively working on.

## 1. Schema Change: `isWorking` Flag

### Migration

Add `isWorking` column to `WorkflowStatus`:

```prisma
model WorkflowStatus {
  // ... existing fields
  isWorking     Boolean   @default(false)
}
```

### Validation Rules

Enforced in `WorkflowService.saveWorkflow()`:

- `isWorking` is mutually exclusive with `isDefault` and `isClosed`
- A status cannot be `isWorking: true` AND `isDefault: true`
- A status cannot be `isWorking: true` AND `isClosed: true`
- Multiple statuses can be `isWorking: true` (e.g., "In Progress" and "In Review")

### Default Seeding

In `seedDefaultWorkflow()`, mark these statuses as `isWorking: true`:

- `IN_PROGRESS`
- `IN_REVIEW`

### Workflow Editor

Add an "Is Working" toggle to the status node edit form in `WorkflowEditor.tsx`. The toggle is disabled when `isDefault` or `isClosed` is checked. Tooltip: "Tasks in this status count as actively being worked on."

### Type Updates

Add `isWorking: boolean` to:

- `WorkflowStatus` interface in `apps/web/src/lib/types.ts`
- `SaveWorkflowPayload` status shape
- Backend DTOs

## 2. Dashboard Status Cards — Dynamic with Horizontal Scroll

### Current Behavior

`ProjectDashboardPage` renders 4 hardcoded stat cards: Total, first 2 non-closed statuses, and "Done" (all closed aggregated). Statuses beyond the first 2 open ones are invisible.

### New Behavior

Replace the hardcoded 4-card grid with a horizontally scrollable card strip that renders one card per workflow status.

### Card Strip Layout

- Container: `flex flex-row gap-3 overflow-hidden` with relative positioning
- Left/right arrow buttons appear at container edges when content overflows
- Arrows: semi-transparent circular buttons with chevron icons, positioned absolutely
- Smooth scroll on arrow click (scroll by container width minus padding)
- Hide left arrow when scrolled to start, hide right arrow when scrolled to end

### Card Order

1. **"Total Tasks" card** — always first, shows total count, neutral color
2. **Workflow status cards** — one per status, ordered by `position` field
3. Each card shows: status name as title, task count as value, colored accent using `status.color`

### Data Source

`dashboard.taskCounts.byStatus` already returns all statuses with `{ statusId, name, key, color, isClosed, count }`. No backend API change needed.

### Component Structure

```
ProjectDashboardPage
  └── DashboardStatusStrip (new component)
        ├── ScrollArrow (left)
        ├── StatCard (Total)
        ├── StatCard (status 1)
        ├── StatCard (status 2)
        ├── ... (status N)
        └── ScrollArrow (right)
```

### StatCard Updates

- Accept optional `accentColor` prop (hex string from workflow status)
- Use `accentColor` for the left border or top bar of the card
- Keep existing `variant` prop for backwards compatibility

## 3. My Tasks — Filterable Table

### Current Behavior

`MyTasksBoard` shows a 2-column kanban: "Active" and "Done" with task cards.

### New Behavior

Replace the kanban board with a data table. The page title stays "My Tasks" with subtitle "X tasks across Y projects".

### Table Columns

| Column | Content | Sortable |
|--------|---------|----------|
| Task Key | `project.prefix`-`taskKey` (e.g., "PM-42") | Yes |
| Title | Task title, truncated with ellipsis | Yes |
| Project | Project name badge with color | Yes |
| Status | `StatusBadge` component (dynamic color + name) | Yes |
| Priority | Priority badge with colored dot (BLOCKER > CRITICAL > HIGH > MEDIUM > LOW) | Yes |
| Due Date | `plannedEndDate`, formatted. Red text + "Overdue" if past due | Yes |
| Time | Logged vs estimated (e.g., "2h / 8h") | No |

### Default Sort

1. `plannedEndDate` ascending (soonest first, null/undefined last)
2. `priority` descending (BLOCKER first, LOW last)

This surfaces the most urgent, highest-priority tasks at the top.

### Filters

Rendered as a filter bar above the table:

- **Status** — multi-select dropdown, options populated from all workflow statuses across the user's projects
- **Priority** — multi-select dropdown (BLOCKER, CRITICAL, HIGH, MEDIUM, LOW)
- **Project** — multi-select dropdown, options from projects the user has tasks in
- **Clear filters** button when any filter is active

### `isWorking` Visual Indicator

Tasks in a status where `isWorking === true` display a small pulsing dot (colored with `status.color`) next to the status badge, indicating active work. This gives a quick visual scan for "what am I currently working on."

### Row Click

Clicking a row navigates to the task detail page (`/projects/:projectId/tasks/:taskId`).

### Component Structure

```
MyTasksPage
  └── MyTasksTable (new component, replaces MyTasksBoard)
        ├── FilterBar
        │     ├── StatusFilter (multi-select)
        │     ├── PriorityFilter (multi-select)
        │     └── ProjectFilter (multi-select)
        └── DataTable
              ├── TableHeader (sortable columns)
              └── TableBody (task rows)
```

### Data Source

`useMyTasks()` hook already returns `Task[]` with `workflowStatus` and `project` included. No backend API change needed. Filtering and sorting are done client-side since the task count per user is manageable.

## 4. Files to Create/Modify

### New Files

- `apps/web/src/components/dashboard/DashboardStatusStrip.tsx` — scrollable card strip
- `apps/web/src/components/tasks/MyTasksTable.tsx` — filterable table replacing MyTasksBoard

### Modified Files

- `apps/api/prisma/schema.prisma` — add `isWorking` to `WorkflowStatus`
- `apps/api/src/workflow/workflow.service.ts` — validation for `isWorking`, update seed defaults
- `apps/api/src/workflow/dto/save-workflow.dto.ts` — add `isWorking` to DTO
- `apps/web/src/lib/types.ts` — add `isWorking` to `WorkflowStatus` type
- `apps/web/src/components/workflow/WorkflowEditor.tsx` — add "Is Working" toggle
- `apps/web/src/components/workflow/StatusNode.tsx` — show `isWorking` indicator
- `apps/web/src/components/dashboard/StatCard.tsx` — add `accentColor` prop
- `apps/web/src/pages/ProjectDashboardPage.tsx` — use `DashboardStatusStrip`
- `apps/web/src/pages/MyTasksPage.tsx` — use `MyTasksTable` instead of `MyTasksBoard`
- `apps/web/src/components/tasks/StatusBadge.tsx` — optional pulsing dot for `isWorking`

### Deleted Files

- `apps/web/src/components/tasks/MyTasksBoard.tsx` — replaced by `MyTasksTable`

## 5. Out of Scope

- Bug status migration to dynamic workflow (separate effort)
- Drag-and-drop status changes in My Tasks table
- Saved/named filter presets
- Server-side pagination (unnecessary for per-user task counts)
