# Task Progress Visibility — Design Spec

**Date:** 2026-04-11
**Status:** Approved

## Problem

The `progress` field (0-100%) exists on tasks in the database and API but is invisible in the frontend. The Log Time modal doesn't expose it, the Task Detail Page doesn't display it, and list views have no progress indicator. Users have no way to see or set task completion progress.

## Solution

Surface task progress across all frontend views with inline editing for leaf tasks and auto-calculation for parent tasks.

## Progress Rules

- **Leaf task (no children):** `progress` is manually set via Log Time modal or inline edit on Task Detail Page. Stored in the existing `task.progress` DB field (0-100 integer).
- **Parent task (has children):** `progress` = average of all children's `progress` values. Calculated on read (frontend), not stored. Read-only in the UI — no edit affordance shown. Label: "Averaged from sub-tasks".
- **Default:** Tasks start at 0%.

## No Backend Changes

The `progress` field already exists in:
- `Task` model (Prisma)
- `UpdateTaskDto.progress` (PATCH endpoint)
- `CreateTimeLogDto.progress` (time log creation)

All changes are frontend-only.

## Components

### 1. New: `ProgressBar` Component

**Location:** `apps/web/src/components/tasks/ProgressBar.tsx`

**Props:**
- `value: number` — 0-100
- `editable?: boolean` — enables click-to-edit (default false)
- `onSave?: (value: number) => void` — called when user commits a new value
- `showLabel?: boolean` — show `XX%` text beside the bar (default true)
- `size?: 'sm' | 'md'` — `sm` = 4px height (list views), `md` = 8px height (detail page)

**Behavior:**
- Color: green for 0-99%, blue at 100%
- When `editable=true`: clicking opens an inline slider (0-100, step 5) + number input. Save on blur or Enter, cancel on Escape.

### 2. Modified: `LogTimeModal.tsx`

- Add optional progress slider + number input below the Comment field
- Label: "Progress" with value shown as `XX%`
- Range: 0-100, step 5 (allow typing any integer)
- Pre-filled with the task's current progress (new prop: `currentProgress?: number`)
- Only sent in payload if the user changes it (no change = omitted from request)
- Updated `onSubmit` signature: `{ minutes: number; comment?: string; loggedAt?: string; progress?: number }`

### 3. Modified: `TimeTrackingCard.tsx`

- Pass `task.progress` to `LogTimeModal` as `currentProgress` prop

### 4. Modified: `TaskDetailPage.tsx`

- Add `ProgressBar` in the right sidebar (above or inside `TimeTrackingCard`)
- Leaf tasks: `editable=true`, `size="md"`, `onSave` calls `useUpdateTask({ progress })`
- Parent tasks: `editable=false`, `size="md"`, value = average of children's progress, muted label "Averaged from sub-tasks"

### 5. Modified: `TasksTable.tsx`

- New "Progress" column using existing `SortHeader` pattern — sortable
- Displays `ProgressBar` with `size="sm"`, `editable=false`, `showLabel=true`
- Add progress range filter to filter toolbar: multi-select dropdown with options "0%", "1-49%", "50-99%", "100%"
- Add `overflow-x-auto` to table container for horizontal scrollbar
- Add `max-h-[calc(100vh-200px)] overflow-y-auto` wrapper with `sticky top-0` table header for vertical scroll

### 6. Modified: `MyTasksTable.tsx`

- Add `'progress'` to `SortField` type
- Add progress comparison to `compareTasks` function
- Add progress filter chips to `FilterBar` (same ranges as TasksTable)
- Display `ProgressBar` with `size="sm"`, `editable=false`, `showLabel=true`
- Same scroll treatment as TasksTable

### 7. Modified: Kanban Board Cards

- Add `ProgressBar` at bottom of each card with `size="sm"`, `showLabel=false`, `editable=false`
- No sort/filter — Kanban filtering by status is inherent

## File Change Summary

| File | Change |
|------|--------|
| `components/tasks/ProgressBar.tsx` | **New** — reusable progress bar component |
| `components/tasks/LogTimeModal.tsx` | Add optional progress slider, new `currentProgress` prop |
| `components/tasks/TimeTrackingCard.tsx` | Pass `task.progress` to LogTimeModal |
| `pages/TaskDetailPage.tsx` | Add ProgressBar in sidebar, editable for leaf, read-only for parent |
| `components/tasks/TasksTable.tsx` | Add Progress column, sort, filter, horizontal + vertical scroll |
| `components/tasks/MyTasksTable.tsx` | Add progress to sort/filter/display, scroll |
| `components/tasks/KanbanCard.tsx` | Add thin ProgressBar at card bottom |
