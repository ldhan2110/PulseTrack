# Task Progress Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface task progress (0-100%) across all frontend views with inline editing for leaf tasks and auto-calculation for parent tasks.

**Architecture:** Create a reusable `TaskProgressBar` component used in 4 locations: LogTimeModal (input), TaskDetailPage (editable display), TasksTable (read-only column), MyTasksTable (read-only column), and KanbanCard (compact bar). No backend changes — the `progress` field already exists in the Task model, UpdateTaskDto, and CreateTimeLogDto.

**Tech Stack:** React, TypeScript, TailwindCSS, TanStack Table, Radix UI

**Spec:** `docs/superpowers/specs/2026-04-11-task-progress-visibility-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/web/src/components/tasks/TaskProgressBar.tsx` | Create | Reusable progress bar with optional inline editing |
| `apps/web/src/components/tasks/LogTimeModal.tsx` | Modify | Add optional progress slider |
| `apps/web/src/components/tasks/TimeTrackingCard.tsx` | Modify | Pass currentProgress to LogTimeModal, update onLogTime type |
| `apps/web/src/pages/TaskDetailPage.tsx` | Modify | Add TaskProgressBar in sidebar above TimeTrackingCard |
| `apps/web/src/components/tasks/TasksTable.tsx` | Modify | Add Progress column with sort + filter |
| `apps/web/src/components/tasks/TaskFilters.tsx` | Modify | Add Progress filter popover |
| `apps/web/src/components/tasks/MyTasksTable.tsx` | Modify | Add progress to sort, filter, and display |
| `apps/web/src/components/tasks/KanbanCard.tsx` | Modify | Add thin progress bar at bottom |

---

### Task 1: Create TaskProgressBar Component

**Files:**
- Create: `apps/web/src/components/tasks/TaskProgressBar.tsx`

- [ ] **Step 1: Create the TaskProgressBar component**

```tsx
// apps/web/src/components/tasks/TaskProgressBar.tsx
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface TaskProgressBarProps {
  value: number;
  editable?: boolean;
  onSave?: (value: number) => void;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function TaskProgressBar({
  value,
  editable = false,
  onSave,
  showLabel = true,
  size = 'sm',
}: TaskProgressBarProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const barHeight = size === 'sm' ? 'h-1' : 'h-2';
  const barColor = value >= 100 ? 'bg-blue-500' : 'bg-green-500';

  const handleSave = () => {
    const clamped = Math.max(0, Math.min(100, draft));
    setEditing(false);
    if (clamped !== value && onSave) {
      onSave(clamped);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setDraft(value);
      setEditing(false);
    }
  };

  if (editing && editable) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="range"
          min={0}
          max={100}
          step={5}
          value={draft}
          onChange={(e) => setDraft(Number(e.target.value))}
          className="flex-1 h-2 accent-green-500"
        />
        <input
          type="number"
          min={0}
          max={100}
          value={draft}
          onChange={(e) => setDraft(Number(e.target.value))}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-14 rounded border border-input bg-background px-2 py-0.5 text-xs text-center"
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2',
        editable && 'cursor-pointer',
      )}
      onClick={() => editable && setEditing(true)}
      title={editable ? 'Click to edit progress' : `${value}%`}
    >
      <div className={cn('flex-1 rounded-full bg-muted overflow-hidden', barHeight)}>
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[2rem] text-right">
          {value}%
        </span>
      )}
    </div>
  );
}

/**
 * Compute averaged progress for a parent task from its children.
 * Returns 0 if no children exist.
 */
export function getParentProgress(children: { progress?: number }[]): number {
  if (children.length === 0) return 0;
  const sum = children.reduce((acc, c) => acc + (c.progress ?? 0), 0);
  return Math.round(sum / children.length);
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /Users/admin/Desktop/Projects/PM2/PulseTrack && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors related to TaskProgressBar

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tasks/TaskProgressBar.tsx
git commit -m "feat: create TaskProgressBar component with inline editing"
```

---

### Task 2: Add Progress Slider to LogTimeModal

**Files:**
- Modify: `apps/web/src/components/tasks/LogTimeModal.tsx`

- [ ] **Step 1: Update LogTimeModal to accept and send progress**

In `apps/web/src/components/tasks/LogTimeModal.tsx`:

Add `currentProgress` prop to the interface:

```tsx
interface LogTimeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { minutes: number; comment?: string; loggedAt?: string; progress?: number }) => void;
  isLoading?: boolean;
  currentProgress?: number;
}
```

Update the component destructuring to accept `currentProgress`:

```tsx
export function LogTimeModal({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  currentProgress,
}: LogTimeModalProps) {
```

Add state for progress tracking — add after the `loggedAt` state:

```tsx
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [progressTouched, setProgressTouched] = useState(false);
```

In the `useEffect` that resets the form when modal opens, add these two lines after `setLoggedAt(...)`:

```tsx
      setProgress(currentProgress ?? 0);
      setProgressTouched(false);
```

In `handleSubmit`, update the `onSubmit` call to include progress only if touched:

```tsx
    onSubmit({
      minutes: totalMinutes,
      comment: comment.trim() || undefined,
      loggedAt: loggedAt || undefined,
      ...(progressTouched && progress !== undefined ? { progress } : {}),
    });
```

Add the progress UI block after the Comment textarea `</div>` and before the closing `</div>` of `space-y-4 py-4`:

```tsx
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted-foreground">Progress</label>
              <span className="text-xs font-medium">{progress ?? 0}%</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={progress ?? 0}
                onChange={(e) => {
                  setProgress(Number(e.target.value));
                  setProgressTouched(true);
                }}
                className="flex-1 h-2 accent-green-500"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={progress ?? 0}
                onChange={(e) => {
                  setProgress(Number(e.target.value));
                  setProgressTouched(true);
                }}
                className="w-14 rounded-md border border-input bg-background px-2 py-1 text-xs text-center"
              />
            </div>
          </div>
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /Users/admin/Desktop/Projects/PM2/PulseTrack && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors related to LogTimeModal

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tasks/LogTimeModal.tsx
git commit -m "feat: add optional progress slider to LogTimeModal"
```

---

### Task 3: Wire TimeTrackingCard to Pass Progress

**Files:**
- Modify: `apps/web/src/components/tasks/TimeTrackingCard.tsx`

- [ ] **Step 1: Update TimeTrackingCard's onLogTime type and LogTimeModal usage**

In `apps/web/src/components/tasks/TimeTrackingCard.tsx`:

Update the `onLogTime` type in the interface to include `progress`:

```tsx
  onLogTime?: (data: { minutes: number; comment?: string; loggedAt?: string; progress?: number }) => void;
```

Update the `LogTimeModal` usage (at line ~119-124) to pass `currentProgress`:

```tsx
      {onLogTime && (
        <LogTimeModal
          open={logTimeModalOpen}
          onOpenChange={setLogTimeModalOpen}
          onSubmit={onLogTime}
          isLoading={isLogTimeLoading}
          currentProgress={task.progress ?? 0}
        />
      )}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /Users/admin/Desktop/Projects/PM2/PulseTrack && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tasks/TimeTrackingCard.tsx
git commit -m "feat: pass task progress to LogTimeModal from TimeTrackingCard"
```

---

### Task 4: Add TaskProgressBar to TaskDetailPage Sidebar

**Files:**
- Modify: `apps/web/src/pages/TaskDetailPage.tsx`

- [ ] **Step 1: Add import**

Add this import at the top of `apps/web/src/pages/TaskDetailPage.tsx` (after the TimeTrackingCard import at line 46):

```tsx
import { TaskProgressBar, getParentProgress } from '@/components/tasks/TaskProgressBar';
```

- [ ] **Step 2: Add the progress bar above TimeTrackingCard**

In `apps/web/src/pages/TaskDetailPage.tsx`, find the `{/* Time Tracking */}` comment (line ~931) and insert this block BEFORE it:

```tsx
              {/* Task Progress */}
              <div className="border border-border rounded-lg p-3 space-y-2">
                <h4 className="text-sm font-semibold">Progress</h4>
                <TaskProgressBar
                  value={isParent ? getParentProgress(task.children ?? []) : (task.progress ?? 0)}
                  editable={!isParent && canEdit}
                  onSave={(val) => {
                    updateTask.mutate({ taskId: task.id, data: { progress: val } });
                  }}
                  showLabel
                  size="md"
                />
                {isParent && (
                  <p className="text-xs text-muted-foreground italic">Averaged from sub-tasks</p>
                )}
              </div>

```

- [ ] **Step 3: Verify `canEdit` exists in scope**

`canEdit` is used in the sidebar for other fields. Verify it's defined by searching the file — it should already be defined based on user permissions.

Run: `grep -n 'canEdit' apps/web/src/pages/TaskDetailPage.tsx | head -5`
Expected: Shows definition like `const canEdit = ...`

- [ ] **Step 4: Verify the file compiles**

Run: `cd /Users/admin/Desktop/Projects/PM2/PulseTrack && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/TaskDetailPage.tsx
git commit -m "feat: add progress bar to task detail page sidebar"
```

---

### Task 5: Add Progress Column to TasksTable

**Files:**
- Modify: `apps/web/src/components/tasks/TasksTable.tsx`
- Modify: `apps/web/src/components/tasks/TaskFilters.tsx`

- [ ] **Step 1: Add imports to TasksTable**

Add this import at the top of `apps/web/src/components/tasks/TasksTable.tsx` (after the existing imports):

```tsx
import { TaskProgressBar, getParentProgress } from './TaskProgressBar';
```

Also add `progressFilterFn` to the import from `TaskFilters`:

```tsx
import { TaskFilters, statusFilterFn, assigneeFilterFn, sprintFilterFn, progressFilterFn } from './TaskFilters';
```

- [ ] **Step 2: Add progress column to the columns array**

In `apps/web/src/components/tasks/TasksTable.tsx`, find the `logged` column definition (the last column, around line 333-359). Add this new column BEFORE the `logged` column (after the `estimated` column, around line 332):

```tsx
      {
        id: 'progress',
        header: ({ column }) => <SortHeader label="Progress" column={column} />,
        accessorFn: (row: Task) => {
          if ((row.children?.length ?? 0) > 0) {
            return getParentProgress(row.children ?? []);
          }
          return row.progress ?? 0;
        },
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const val = getValue() as number;
          return <TaskProgressBar value={val} size="sm" showLabel editable={false} />;
        },
        filterFn: progressFilterFn,
        enableColumnFilter: true,
        size: 120,
      },
```

- [ ] **Step 3: Add progress column to expanded child rows**

Find the expanded child rows section (around line 455-494). After the `logged` TableCell for children, add a progress cell. Find the child row's last `<TableCell>` (the logged one) and add this after it:

```tsx
                      <TableCell>
                        <TaskProgressBar value={child.progress ?? 0} size="sm" showLabel editable={false} />
                      </TableCell>
```

- [ ] **Step 4: Create progressFilterFn in TaskFilters**

In `apps/web/src/components/tasks/TaskFilters.tsx`, add this export at the bottom of the file (after `sprintFilterFn`):

```tsx
export const progressFilterFn = (row: { getValue: (id: string) => unknown }, columnId: string, filterValue: string[]) => {
  if (!filterValue || filterValue.length === 0) return true;
  const val = (row.getValue(columnId) as number) ?? 0;
  return filterValue.some((range) => {
    switch (range) {
      case '0': return val === 0;
      case '1-49': return val >= 1 && val <= 49;
      case '50-99': return val >= 50 && val <= 99;
      case '100': return val === 100;
      default: return true;
    }
  });
};
```

- [ ] **Step 5: Add Progress filter popover to TaskFilters component**

In `apps/web/src/components/tasks/TaskFilters.tsx`, add progress filter state handling.

First, add the progress column lookup after the `sprintColumn` line (around line 60):

```tsx
  const progressColumn = table.getColumn('progress');
  const selectedProgress = (progressColumn?.getFilterValue() as string[] | undefined) ?? [];
```

Update `hasAnyFilter` to include progress:

```tsx
  const hasAnyFilter =
    selectedStatuses.length > 0 ||
    selectedAssignees.length > 0 ||
    selectedSprint !== '' ||
    selectedProgress.length > 0 ||
    searchValue !== '';
```

Add progress clearing to `clearAllFilters`:

```tsx
    progressColumn?.setFilterValue(undefined);
```

Add a toggle function after `selectSprint`:

```tsx
  const toggleProgress = (range: string) => {
    const current = [...selectedProgress];
    const idx = current.indexOf(range);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(range);
    progressColumn?.setFilterValue(current.length > 0 ? current : undefined);
  };
```

Add the Progress filter popover in the JSX, after the Sprint filter `</Popover>` and before the Clear filters section:

```tsx
      {/* Progress filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-8 gap-1.5',
              selectedProgress.length > 0 && 'border-primary',
            )}
          >
            Progress
            {selectedProgress.length > 0 && (
              <Badge variant="secondary" className="size-5 p-0 flex items-center justify-center text-[10px] rounded-full">
                {selectedProgress.length}
              </Badge>
            )}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-40 p-2" align="start">
          <div className="flex flex-col gap-1">
            {[
              { value: '0', label: '0%' },
              { value: '1-49', label: '1–49%' },
              { value: '50-99', label: '50–99%' },
              { value: '100', label: '100%' },
            ].map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-muted text-sm"
              >
                <Checkbox
                  checked={selectedProgress.includes(opt.value)}
                  onCheckedChange={() => toggleProgress(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>
```

- [ ] **Step 6: Verify files compile**

Run: `cd /Users/admin/Desktop/Projects/PM2/PulseTrack && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/tasks/TasksTable.tsx apps/web/src/components/tasks/TaskFilters.tsx
git commit -m "feat: add sortable/filterable Progress column to TasksTable"
```

---

### Task 6: Add Progress to MyTasksTable

**Files:**
- Modify: `apps/web/src/components/tasks/MyTasksTable.tsx`

- [ ] **Step 1: Add import**

Add at the top of `apps/web/src/components/tasks/MyTasksTable.tsx`:

```tsx
import { TaskProgressBar } from './TaskProgressBar';
```

- [ ] **Step 2: Add 'progress' to SortField type**

Change the `SortField` type (line 61):

```tsx
type SortField = 'taskKey' | 'title' | 'project' | 'status' | 'priority' | 'dueDate' | 'progress';
```

- [ ] **Step 3: Add progress case to compareTasks**

In the `compareTasks` function (line 69), add a new case before the closing `}` of the switch:

```tsx
    case 'progress': {
      const aProg = a.progress ?? 0;
      const bProg = b.progress ?? 0;
      cmp = aProg - bProg;
      break;
    }
```

- [ ] **Step 4: Add progress filter state**

In the `MyTasksTable` component, after the `projectFilter` state (line 261), add:

```tsx
  const [progressFilter, setProgressFilter] = useState<string[]>([]);
```

Update `filteredAndSorted` memo to include progress filtering. After the `projectFilter` check (line 285), add:

```tsx
    if (progressFilter.length > 0) {
      result = result.filter((t) => {
        const val = t.progress ?? 0;
        return progressFilter.some((range) => {
          switch (range) {
            case '0': return val === 0;
            case '1-49': return val >= 1 && val <= 49;
            case '50-99': return val >= 50 && val <= 99;
            case '100': return val === 100;
            default: return true;
          }
        });
      });
    }
```

Add `progressFilter` to the `useMemo` dependency array (line 296).

Update `handleClearFilters` to also clear progress:

```tsx
  const handleClearFilters = () => {
    setStatusFilter([]);
    setPriorityFilter([]);
    setProjectFilter([]);
    setProgressFilter([]);
  };
```

- [ ] **Step 5: Add progress filter to FilterBar**

Update the `FilterBarProps` interface to include progress:

```tsx
interface FilterBarProps {
  tasks: Task[];
  statusFilter: string[];
  priorityFilter: string[];
  projectFilter: string[];
  progressFilter: string[];
  onStatusChange: (v: string[]) => void;
  onPriorityChange: (v: string[]) => void;
  onProjectChange: (v: string[]) => void;
  onProgressChange: (v: string[]) => void;
  onClear: () => void;
}
```

Update `FilterBar` destructuring to accept `progressFilter` and `onProgressChange`:

```tsx
function FilterBar({
  tasks,
  statusFilter,
  priorityFilter,
  projectFilter,
  progressFilter,
  onStatusChange,
  onPriorityChange,
  onProjectChange,
  onProgressChange,
  onClear,
}: FilterBarProps) {
```

Update `hasFilters` to include progress:

```tsx
  const hasFilters = statusFilter.length > 0 || priorityFilter.length > 0 || projectFilter.length > 0 || progressFilter.length > 0;
```

Add a progress filter Select after the project filter Select (before the Clear button):

```tsx
      <Select value="" onValueChange={(v) => toggleFilter(progressFilter, v, onProgressChange)}>
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue placeholder={progressFilter.length > 0 ? `Progress (${progressFilter.length})` : 'Progress'} />
        </SelectTrigger>
        <SelectContent>
          {[
            { value: '0', label: '0%' },
            { value: '1-49', label: '1–49%' },
            { value: '50-99', label: '50–99%' },
            { value: '100', label: '100%' },
          ].map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              <div className="flex items-center gap-2">
                {opt.label}
                {progressFilter.includes(opt.value) && <span className="ml-auto text-primary">&#10003;</span>}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
```

Update the `FilterBar` usage in `MyTasksTable` to pass progress props:

```tsx
      <FilterBar
        tasks={tasks}
        statusFilter={statusFilter}
        priorityFilter={priorityFilter}
        projectFilter={projectFilter}
        progressFilter={progressFilter}
        onStatusChange={setStatusFilter}
        onPriorityChange={setPriorityFilter}
        onProjectChange={setProjectFilter}
        onProgressChange={setProgressFilter}
        onClear={handleClearFilters}
      />
```

- [ ] **Step 6: Add progress column header and cell**

Add a `SortableHeader` for progress in the `<TableHeader>` section, after the "Due Date" header and before the "Time" header:

```tsx
              <SortableHeader label="Progress" field="progress" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
```

Add a progress cell in each `<TableRow>` inside the map, after the Due Date `<TableCell>` and before the Time `<TableCell>`:

```tsx
                    <TableCell>
                      <TaskProgressBar value={task.progress ?? 0} size="sm" showLabel editable={false} />
                    </TableCell>
```

Update the empty-state `colSpan` from 8 to 9:

```tsx
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
```

- [ ] **Step 7: Verify files compile**

Run: `cd /Users/admin/Desktop/Projects/PM2/PulseTrack && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/tasks/MyTasksTable.tsx
git commit -m "feat: add progress sort, filter, and display to MyTasksTable"
```

---

### Task 7: Add Progress Bar to KanbanCard

**Files:**
- Modify: `apps/web/src/components/tasks/KanbanCard.tsx`

- [ ] **Step 1: Add import**

Add at the top of `apps/web/src/components/tasks/KanbanCard.tsx`:

```tsx
import { TaskProgressBar, getParentProgress } from './TaskProgressBar';
```

- [ ] **Step 2: Add progress bar at the bottom of the card**

In `apps/web/src/components/tasks/KanbanCard.tsx`, find the closing `</CardContent>` tag (line 149). Add this block immediately BEFORE it (after the footer `</div>` at line 148):

```tsx
          {/* Progress bar */}
          <TaskProgressBar
            value={(task.children?.length ?? 0) > 0 ? getParentProgress(task.children ?? []) : (task.progress ?? 0)}
            size="sm"
            showLabel={false}
            editable={false}
          />
```

- [ ] **Step 3: Verify the file compiles**

Run: `cd /Users/admin/Desktop/Projects/PM2/PulseTrack && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/tasks/KanbanCard.tsx
git commit -m "feat: add progress bar to Kanban cards"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run full TypeScript check**

Run: `cd /Users/admin/Desktop/Projects/PM2/PulseTrack && npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 2: Run existing tests**

Run: `cd /Users/admin/Desktop/Projects/PM2/PulseTrack && npx vitest run --project web 2>&1 | tail -20`
Expected: All existing tests pass

- [ ] **Step 3: Run lint**

Run: `cd /Users/admin/Desktop/Projects/PM2/PulseTrack && cd apps/web && npx eslint src/components/tasks/TaskProgressBar.tsx src/components/tasks/LogTimeModal.tsx src/components/tasks/TimeTrackingCard.tsx src/components/tasks/TasksTable.tsx src/components/tasks/TaskFilters.tsx src/components/tasks/MyTasksTable.tsx src/components/tasks/KanbanCard.tsx src/pages/TaskDetailPage.tsx 2>&1 | tail -20`
Expected: No errors (warnings acceptable)

- [ ] **Step 4: Commit any lint fixes if needed**

```bash
git add -u
git commit -m "fix: lint fixes for progress visibility feature"
```
