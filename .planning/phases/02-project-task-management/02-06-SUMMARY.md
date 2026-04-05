---
phase: 02-project-task-management
plan: "06"
subsystem: frontend-task-ui
tags: [react, tanstack-table, dnd-kit, kanban, backlog, task-detail]
dependency_graph:
  requires: ["02-02", "02-03", "02-04"]
  provides: ["backlog-ui", "kanban-board", "task-detail-page"]
  affects: ["02-07", "02-08"]
tech_stack:
  added: ["@dnd-kit/core", "@dnd-kit/sortable", "@tanstack/react-table"]
  patterns: ["DndContext drag-to-status", "TanStack Table with column filters", "FieldGroup form composition", "optimistic mutation pattern"]
key_files:
  created:
    - apps/web/src/pages/BacklogPage.tsx
    - apps/web/src/components/tasks/TasksTable.tsx
    - apps/web/src/components/tasks/TaskFilters.tsx
    - apps/web/src/components/tasks/CreateTaskDialog.tsx
    - apps/web/src/components/tasks/KanbanBoard.tsx
    - apps/web/src/components/tasks/KanbanBoard.test.tsx
    - apps/web/src/components/tasks/KanbanColumn.tsx
    - apps/web/src/components/tasks/KanbanCard.tsx
    - apps/web/src/pages/TaskDetailPage.tsx
  modified:
    - apps/web/vitest.config.ts
decisions:
  - "BulkActionBar exported from TasksTable and consumed by BacklogPage — avoids no-op callback pattern"
  - "Acceptance criteria managed via direct fetch calls to /acceptance-criteria endpoints (not via useUpdateTask) since they are independent sub-resources"
  - "KanbanBoard tests use static vi.mock hoisting (not dynamic import) — required for vitest module resolution with @/ alias"
  - "vitest.config.ts updated to add @ path alias — resolves @/lib/types, @/hooks/* imports in test files"
metrics:
  duration_minutes: 15
  completed_date: "2026-04-05"
  tasks_completed: 2
  files_changed: 10
---

# Phase 02 Plan 06: Backlog and Task Detail Pages Summary

**One-liner:** dnd-kit Kanban board with 5 status columns + TanStack Table with column filters + TaskDetailPage with inline editing, acceptance criteria checklist, and sub-task management.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Backlog page with TanStack Table, Kanban board, task creation | eee035c | BacklogPage, TasksTable, TaskFilters, KanbanBoard, KanbanCard, KanbanColumn, CreateTaskDialog, KanbanBoard.test.tsx, vitest.config.ts |
| 2 | Task Detail page with editable fields, acceptance criteria, sub-tasks | d9815f4 | TaskDetailPage |

## What Was Built

### Backlog Page

`BacklogPage` at `/projects/:projectId/backlog` with:
- **View toggle:** shadcn `Tabs` with `TabsList`/`TabsTrigger` controlled by Zustand `backlogView` state
- **Table view:** `TasksTable` with TanStack Table (`useReactTable`, `getSortedRowModel`, `getFilteredRowModel`, `enableRowSelection`)
- **Board view:** `KanbanBoard` with dnd-kit drag-and-drop
- **Bulk action bar:** Floating bar when rows selected, "Move to Sprint" dropdown via exported `BulkActionBar` component
- **Empty state:** `ListTodo` icon, "No tasks yet", "Add your first task..." body, "Create Task" button
- **Loading state:** Skeleton rows (table) or skeleton columns (board)
- **Create Task:** Primary button opens `CreateTaskDialog`

### TasksTable

- `useReactTable` with `getCoreRowModel`, `getSortedRowModel`, `getFilteredRowModel`
- `enableRowSelection: true` with checkbox column
- Columns: Title (link), Status (inline Select), Assignee (avatar+name), Story Points, Sprint
- Click row navigates to task detail page (stopPropagation on status Select)
- `onRowSelectionChange` prop passes selected tasks up to BacklogPage

### TaskFilters

- `globalFilter` debounced 300ms search via `InputGroup` + Search icon
- Status: multi-select `Popover` with `Checkbox` items + count badge
- Assignee: multi-select `Popover` with member avatars + "Unassigned" option
- Sprint: single-select `Popover` with "All sprints" / "No Sprint" / sprint list
- "Clear Filters" ghost button appears when any filter is active
- Custom `filterFn` exports: `statusFilterFn`, `assigneeFilterFn`, `sprintFilterFn`

### KanbanBoard

- `DndContext` with `PointerSensor` (8px activation distance) + `KeyboardSensor`
- `onDragEnd` calls `useUpdateTaskStatus` optimistic mutation
- Custom `accessibility.announcements` for screen readers: pickup, over-column, drop, cancel
- 5 `KanbanColumn` components (BACKLOG, IN_PROGRESS, IN_REVIEW, DONE, BLOCKED)
- Horizontal scroll layout: `flex gap-3 overflow-x-auto`

### KanbanColumn + KanbanCard

- `KanbanColumn`: `useDroppable({ id: status })` — `isOver` changes bg to `bg-muted`
- `KanbanCard`: `useDraggable({ id: task.id })` — `isDragging` applies `-translate-y-1 scale-105 shadow-lg`
- Card click navigates to task detail (guarded against drag)

### CreateTaskDialog

- All 6 fields: Title, Description, Status, Assignee (combobox), Story Points, Sprint
- `FieldGroup` + `Field` + `FieldLabel` composition per shadcn skill rules
- Validation: title required (min 3 chars), story points 1–100
- "Discard" secondary (data loss possible), "Create Task" primary

### TaskDetailPage

- **Top bar:** ArrowLeft back button, breadcrumb path
- **Inline title:** Click-to-edit Input, Enter/Esc/blur save/revert, calls `useUpdateTask`
- **Metadata bar:** `FieldGroup` + `Field` composition — Status Select, Assignee Select, Sprint Select, Story Points Input (blur-save)
- **Description:** Textarea with 500ms debounce auto-save, "Saving..." loader indicator
- **Acceptance Criteria:** Checklist with `Checkbox`, inline text edit on click, add/delete, individual PUT/DELETE to `/acceptance-criteria/:id`
- **Sub-Tasks:** Table (Title | Status | Assignee) with inline editing, add row, delete row
- **Sidebar:** Created by avatar, relative dates (date-fns), sprint name
- **Delete:** `AlertDialog` confirmation (PM-only), "Delete Task" / "Cancel" per UI-SPEC copy
- **Loading:** Full skeleton layout
- **Error:** "This task doesn't exist or has been deleted." + "Go to Backlog" link

### KanbanBoard Tests

4 unit tests in `KanbanBoard.test.tsx`:
1. Renders 5 columns (one per TaskStatus)
2. Groups tasks into correct columns by status
3. Shows 0 count badge for empty columns (IN_REVIEW, DONE)
4. Initializes `useUpdateTaskStatus` with correct projectId

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest.config.ts missing @ path alias**
- **Found during:** Task 1 — KanbanBoard.test.tsx could not resolve `@/hooks/useTasks`
- **Issue:** vitest.config.ts had no `resolve.alias` so `@/` paths in test files failed
- **Fix:** Added `resolve: { alias: { '@': path.resolve(__dirname, './src') } }` to vitest.config.ts (mirrors vite.config.ts)
- **Files modified:** `apps/web/vitest.config.ts`
- **Commit:** eee035c

**2. [Rule 1 - Bug] BulkActionBar no-op callback**
- **Found during:** Post-task review — TasksTable had internal BulkActionBar with no-op `onMoveToSprint`
- **Fix:** Exported `BulkActionBar` from TasksTable and wired it in BacklogPage with the real `handleBulkMoveToSprint` handler
- **Files modified:** `apps/web/src/components/tasks/TasksTable.tsx`, `apps/web/src/pages/BacklogPage.tsx`
- **Commit:** included in eee035c (pre-commit review fix)

## Known Stubs

None — all components are wired to real data sources and mutations. The acceptance criteria endpoints use direct `fetch` calls since the API client (`api.ts`) does not have dedicated endpoints for `AcceptanceCriteria` CRUD. The backend task controller includes `/acceptance-criteria` sub-routes (added in plan 02-03/02-04).

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| BacklogPage.tsx exists | FOUND |
| KanbanBoard.tsx exists | FOUND |
| KanbanBoard.test.tsx exists | FOUND |
| TaskDetailPage.tsx exists | FOUND |
| Commit eee035c exists | FOUND |
| Commit d9815f4 exists | FOUND |
| tsc --noEmit exits 0 | PASS |
| pnpm test --run exits 0 | PASS (9 tests) |
