# Sprint Task Visibility Enhancement

**Date:** 2026-04-08
**Scope:** Frontend only (SprintsPage, SprintListItem)
**Goal:** Show completed/incomplete task breakdown per sprint with expandable task list

## Context

The SprintsPage currently shows sprint name, status badge, date range, and a total task count. Users need to see task completion status at a glance and drill into individual tasks without navigating away.

All required data is already fetched by `useTasks(projectId)` in SprintsPage -- no backend changes needed.

## Design

### 1. Summary Counts (Always Visible)

**Location:** Replace current `"{count} tasks"` text in SprintListItem.

**New format:** `{completed}/{total} tasks` with a thin inline `<Progress>` bar.

- Progress bar reuses the existing `<Progress>` component from shadcn/ui (same as SprintBoardPage)
- Bar width: ~80px, height: `h-1.5`
- Color follows default progress styling (primary fill)
- When total is 0, show "0 tasks" with no progress bar

### 2. Expandable Task List

**Trigger:** Chevron icon toggle on the right side of each sprint row. Clicking the chevron (or the row body) toggles expand/collapse.

**Behavior change for ACTIVE sprints:** Currently clicking an ACTIVE sprint row navigates to SprintBoardPage. With this change:
- Clicking the row body expands/collapses the task list (all statuses)
- A small "View Board" button/link remains for ACTIVE sprints to navigate to SprintBoardPage

**Expanded section:** Renders below the sprint header inside the same card, with a subtle top border separator.

**Task row layout (per task):**
| Element | Detail |
|---------|--------|
| Status icon | `CheckCircle2` (green, `text-green-600`) for closed tasks; `Circle` (muted, `text-muted-foreground`) for open |
| Task title | `text-sm`, truncated with `truncate` class |
| Assignee | Small avatar circle (24px) with first letter of username, tooltip showing full name. Dash if unassigned. |
| Story points | `<Badge variant="outline">` showing points. Hidden if null/0. |

**Sort order:** Incomplete tasks first, then completed. Within each group, preserve original order (createdAt ascending from API).

**Max visible:** Show all tasks (no pagination). Sprint task counts are typically small (5-30).

### 3. Data Flow

```
SprintsPage
  |-- useTasks(projectId)          // already exists
  |-- compute tasksBySprint map    // new: Record<string, Task[]>
  |-- compute stats per sprint     // new: {completed, total} per sprintId
  |
  +-- SprintListItem
        props += {
          sprintTasks: Task[]       // filtered tasks for this sprint
          completedCount: number    // pre-computed
          totalCount: number        // pre-computed
        }
        |-- local state: expanded (boolean, default false)
        |-- renders summary counts (always)
        |-- renders task list (when expanded)
```

### 4. Files Changed

| File | Change |
|------|--------|
| `apps/web/src/pages/SprintsPage.tsx` | Add `tasksBySprint` and `statsBySprint` memos; pass new props to SprintListItem |
| `apps/web/src/components/sprints/SprintListItem.tsx` | Add expand/collapse state, chevron icon, summary progress bar, expandable task list section; update click behavior for ACTIVE sprints |

### 5. Props Changes

**SprintListItem new props:**
- `sprintTasks: Task[]` -- tasks belonging to this sprint
- `completedCount: number` -- number of closed tasks
- `totalCount: number` -- total task count for this sprint

**SprintListItem removed props:**
- `incompleteTasks` -- replaced by the more complete `completedCount`/`totalCount` pair

### 6. Edge Cases

- **Sprint with 0 tasks:** Show "0 tasks", no progress bar, expand shows "No tasks in this sprint" message
- **All tasks completed:** Progress bar full, all tasks show green checkmark
- **Task with no assignee:** Show a dash or empty placeholder instead of avatar
- **Task with no story points:** Hide the points badge entirely
- **COMPLETED sprint:** Still expandable (shows historical tasks that were completed in the sprint). Note: after sprint close, incomplete tasks are moved to backlog, so COMPLETED sprints will only show tasks that were marked done.
