# Task Enhancements Design — Priority, Dates & Kanban Polish

**Date:** 2026-04-06
**Status:** Approved

## Overview

Four enhancements to the Task/Backlog feature:
1. Priority field (Low → Blocker) on tasks
2. Kanban board height fix — columns fill viewport correctly
3. Kanban card visual polish — overdue state with elevated red strip
4. Date fields — Planned Start/End and Actual Start/End with history tracking

---

## 1. Priority Field

### Schema

Add a `Priority` enum and optional field to the `Task` model.

```prisma
enum Priority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
  BLOCKER
}

model Task {
  // ... existing fields ...
  priority  Priority?
}
```

### Visual Design

| Priority | Color | Hex |
|----------|-------|-----|
| Low | Gray | `#6b7280` |
| Medium | Blue | `#3b82f6` |
| High | Amber | `#f59e0b` |
| Critical | Red | `#ef4444` |
| Blocker | Purple | `#7c3aed` |

**Kanban card** — glowing dot + label text in top-right corner:
```
● Critical   (dot with box-shadow glow, label text same color)
```

**Table** — new "Priority" column with colored dot + label, sortable. Positioned after Status.

**Task detail sidebar** — dropdown selector with colored dot indicators per option. Positioned near the top of the sidebar (after Status).

**Create task dialog** — optional priority dropdown, defaults to unset.

### API Changes

- `CreateTaskDto`: add optional `priority?: Priority`
- `UpdateTaskDto`: add optional `priority?: Priority | null`
- `TasksService.update()`: track `priority` changes in `TaskHistory`
- `ActivityEntry` component: add `priority` field config with purple icon

---

## 2. Kanban Board Height Fix

### Problem

Current implementation uses `max-h-[calc(100vh-280px)]` on the `ScrollArea` inside `KanbanColumn`. The hardcoded 280px offset is inaccurate, causing columns to be cut off or have excess whitespace.

### Solution

Use CSS flexbox to let the board fill remaining height naturally:

**`BacklogPage.tsx`** — board tab panel container:
```tsx
// Before
<div className="...">
  <KanbanBoard ... />
</div>

// After — add flex-1 min-h-0 so it stretches to page bottom
<div className="flex-1 min-h-0 flex flex-col overflow-hidden">
  <KanbanBoard ... />
</div>
```

**`KanbanBoard.tsx`** — outer wrapper:
```tsx
// Add h-full to fill the parent
<div className="h-full flex gap-3 overflow-x-auto pb-4">
```

**`KanbanColumn.tsx`** — ScrollArea:
```tsx
// Before
<ScrollArea className="max-h-[calc(100vh-280px)] min-h-[200px]">

// After — fill column height naturally
<ScrollArea className="flex-1 min-h-0">
```

The page-level layout (`BacklogPage`) must also participate: the tab content area needs `flex-1 min-h-0` so the chain of flex children fills the viewport correctly from the top nav downward.

---

## 3. Kanban Card Polish

### Normal State

Clean minimal card with a thin top border separating the footer row from content:

```
┌─────────────────────────────────┐
│ PM-42              ● Critical   │
│ Fix auth token expiry causing…  │
├─────────────────────────────────│  ← 1px border-top #2a2a2a
│ [JD] 5 pts          📅 Apr 15  │
└─────────────────────────────────┘
```

### Overdue State

When `plannedEndDate` is in the past (and task is not DONE):
- A 3px red gradient strip appears at the very top of the card
- The date text turns red
- Card gets a slightly stronger box shadow

```
┌═════════════════════════════════┐  ← 3px red gradient strip
│ PM-42              ● Critical   │
│ Fix auth token expiry causing…  │
├─────────────────────────────────│
│ [JD] 5 pts          📅 Apr 15  │  ← date in red
└─────────────────────────────────┘
```

**Overdue detection:** `plannedEndDate < today && status !== 'DONE'`

### Card Footer Layout

```tsx
// Footer row
<div className="flex justify-between items-center pt-2 border-t border-border/40 mt-auto">
  {/* Left: assignee avatar + story points */}
  <div className="flex items-center gap-1.5">
    <Avatar size="xs" />
    {storyPoints && <Badge variant="secondary">{storyPoints} pts</Badge>}
  </div>
  {/* Right: planned end date */}
  {plannedEndDate && (
    <div className="flex items-center gap-1">
      <CalendarIcon className="w-2.5 h-2.5" />
      <span className={isOverdue ? 'text-destructive' : 'text-amber-500'}>
        {format(plannedEndDate, 'MMM d')}
      </span>
    </div>
  )}
</div>
```

---

## 4. Date Fields

### Schema

```prisma
model Task {
  // ... existing fields ...
  plannedStartDate  DateTime?
  plannedEndDate    DateTime?
  actualStartDate   DateTime?
  actualEndDate     DateTime?
}
```

### API Changes

**DTOs:** All four fields added as optional `Date | null` to both `CreateTaskDto` and `UpdateTaskDto`.

**History tracking** in `TasksService.update()` — the existing field-change detection loop is extended to include:
- `plannedStartDate`
- `plannedEndDate`
- `actualStartDate`
- `actualEndDate`

Values stored in `TaskHistory` as ISO date strings.

### Task Detail Sidebar

Two new collapsible groups below Story Points:

```
─── Planned ────────────────────
Start   [date picker]
End     [date picker]

─── Actual ─────────────────────
Start   [date picker]
End     [date picker]
```

Each picker uses a `<Popover>` + shadcn `<Calendar>` component, consistent with common shadcn date picker pattern. Clearing a date sets it to `null`.

### Table Column

New **"Due"** column after Sprint, showing `plannedEndDate`:
- Amber color when future date
- Red color when overdue (past date, task not DONE)
- Empty cell when not set
- Sortable

### Activity Log

Four new field configs in `ActivityEntry`:

| Field | Label | Icon | Color |
|-------|-------|------|-------|
| `plannedStartDate` | Planned start | Calendar | Cyan |
| `plannedEndDate` | Planned end | Calendar | Amber |
| `actualStartDate` | Actual start | Calendar | Green |
| `actualEndDate` | Actual end | Calendar | Emerald |

Display format: ISO string → `MMM d, yyyy` for human-readable diffs.

---

## Frontend Type Changes

```ts
interface Task {
  // existing...
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'BLOCKER' | null
  plannedStartDate?: string | null
  plannedEndDate?: string | null
  actualStartDate?: string | null
  actualEndDate?: string | null
}
```

---

## Migration

Single Prisma migration adding:
- `Priority` enum
- `priority` column on `tasks` (nullable)
- `plannedStartDate`, `plannedEndDate`, `actualStartDate`, `actualEndDate` columns on `tasks` (all nullable `TIMESTAMP`)

No data backfill required — all new fields are optional.

---

## Out of Scope

- Bulk date editing
- Calendar/timeline view of tasks by date
- Automatic `actualStartDate` population when status changes to IN_PROGRESS (can be added later)
- Blueprint sync for new fields
