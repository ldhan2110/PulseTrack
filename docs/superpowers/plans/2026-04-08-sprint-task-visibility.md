# Sprint Task Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show task completion counts with progress bar and expandable task list on each sprint row in SprintsPage.

**Architecture:** Pure frontend enhancement. Derive task-per-sprint data from the existing `useTasks(projectId)` hook already called in SprintsPage. Pass filtered tasks + counts down to SprintListItem, which gains expand/collapse state and renders an inline task list.

**Tech Stack:** React, Tailwind CSS, shadcn/ui (Progress, Badge, Tooltip), lucide-react icons

---

### File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/src/pages/SprintsPage.tsx` | Modify | Compute `tasksBySprint` and per-sprint stats, pass new props |
| `apps/web/src/components/sprints/SprintListItem.tsx` | Modify | Expand/collapse state, progress bar, task list rendering |

---

### Task 1: Update SprintsPage Data Computation

**Files:**
- Modify: `apps/web/src/pages/SprintsPage.tsx`

- [ ] **Step 1: Replace `incompleteCountBySprint` with richer per-sprint data**

Replace the existing `incompleteCountBySprint` memo (lines 34-42) and add a `tasksBySprint` memo. Update the props passed to `SprintListItem`.

In `SprintsPage.tsx`, replace:

```tsx
// Count incomplete tasks per sprint (not DONE)
const incompleteCountBySprint = useMemo(() => {
  const map: Record<string, number> = {};
  tasks.forEach((t) => {
    if (t.sprintId && !t.workflowStatus?.isClosed) {
      map[t.sprintId] = (map[t.sprintId] ?? 0) + 1;
    }
  });
  return map;
}, [tasks]);
```

With:

```tsx
// Group tasks by sprint and compute counts
const tasksBySprint = useMemo(() => {
  const map: Record<string, typeof tasks> = {};
  tasks.forEach((t) => {
    if (t.sprintId) {
      if (!map[t.sprintId]) map[t.sprintId] = [];
      map[t.sprintId].push(t);
    }
  });
  return map;
}, [tasks]);

const sprintStats = useMemo(() => {
  const map: Record<string, { completed: number; total: number }> = {};
  for (const [sprintId, sprintTasks] of Object.entries(tasksBySprint)) {
    const completed = sprintTasks.filter((t) => t.workflowStatus?.isClosed === true).length;
    map[sprintId] = { completed, total: sprintTasks.length };
  }
  return map;
}, [tasksBySprint]);
```

- [ ] **Step 2: Update SprintListItem props in the render**

Replace the `<SprintListItem>` usage (lines 111-122):

```tsx
<SprintListItem
  key={sprint.id}
  sprint={sprint}
  isActive={sprint.status === 'ACTIVE'}
  canManage={canManage}
  projectId={projectId}
  incompleteTasks={incompleteCountBySprint[sprint.id] ?? 0}
  onActivate={() => handleActivate(sprint)}
  onClose={() => handleClose(sprint)}
/>
```

With:

```tsx
<SprintListItem
  key={sprint.id}
  sprint={sprint}
  isActive={sprint.status === 'ACTIVE'}
  canManage={canManage}
  projectId={projectId}
  sprintTasks={tasksBySprint[sprint.id] ?? []}
  completedCount={sprintStats[sprint.id]?.completed ?? 0}
  totalCount={sprintStats[sprint.id]?.total ?? 0}
  onActivate={() => handleActivate(sprint)}
  onClose={() => handleClose(sprint)}
/>
```

- [ ] **Step 3: Remove unused import if `incompleteTasks` was the only consumer**

The `incompleteCountBySprint` variable is now removed. No import changes needed since `useTasks` is still used. Verify no other references to `incompleteCountBySprint` remain.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/SprintsPage.tsx
git commit -m "feat(sprints): compute per-sprint task stats and pass to SprintListItem"
```

---

### Task 2: Update SprintListItem -- Summary Counts & Progress Bar

**Files:**
- Modify: `apps/web/src/components/sprints/SprintListItem.tsx`

- [ ] **Step 1: Update imports and props interface**

Add new imports at the top of the file:

```tsx
import { ChevronDown, ChevronRight, CheckCircle2, Circle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Task } from '@/lib/types';
```

Update the props interface -- replace:

```tsx
interface SprintListItemProps {
  sprint: Sprint;
  isActive: boolean;
  canManage: boolean;
  onActivate: () => void;
  onClose: () => void;
  projectId: string;
  incompleteTasks?: number;
}
```

With:

```tsx
interface SprintListItemProps {
  sprint: Sprint;
  isActive: boolean;
  canManage: boolean;
  onActivate: () => void;
  onClose: () => void;
  projectId: string;
  sprintTasks: Task[];
  completedCount: number;
  totalCount: number;
}
```

- [ ] **Step 2: Update destructured props and add expand state**

Replace:

```tsx
export function SprintListItem({
  sprint,
  isActive,
  canManage,
  onActivate,
  onClose,
  projectId,
  incompleteTasks = 0,
}: SprintListItemProps) {
  const navigate = useNavigate();
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const isCompleted = sprint.status === 'COMPLETED';
```

With:

```tsx
export function SprintListItem({
  sprint,
  isActive,
  canManage,
  onActivate,
  onClose,
  projectId,
  sprintTasks,
  completedCount,
  totalCount,
}: SprintListItemProps) {
  const navigate = useNavigate();
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isCompleted = sprint.status === 'COMPLETED';
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
```

- [ ] **Step 3: Update row click handler**

Replace:

```tsx
const handleRowClick = () => {
  if (isActive) {
    navigate(`/projects/${projectId}/sprints/${sprint.id}`);
  }
};
```

With:

```tsx
const handleRowClick = () => {
  setExpanded((prev) => !prev);
};
```

- [ ] **Step 4: Update the row's click and cursor behavior**

Replace:

```tsx
<div
  className={cn(
    'rounded-lg border bg-card p-4 flex items-center gap-4',
    isActive && 'border-l-4 border-l-primary',
    isCompleted && 'opacity-60',
    isActive && 'cursor-pointer hover:bg-muted/30 transition-colors',
  )}
  onClick={isActive ? handleRowClick : undefined}
>
```

With:

```tsx
<div
  className={cn(
    'rounded-lg border bg-card p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/30 transition-colors',
    isActive && 'border-l-4 border-l-primary',
    isCompleted && 'opacity-60',
  )}
  onClick={handleRowClick}
>
```

- [ ] **Step 5: Replace task count section with summary counts + progress bar**

Replace:

```tsx
{/* Task count */}
<div className="text-sm text-muted-foreground shrink-0 w-20 text-right">
  {sprint._count?.tasks ?? 0} tasks
</div>
```

With:

```tsx
{/* Task progress */}
<div className="shrink-0 flex items-center gap-3 min-w-[140px]">
  <span className="text-sm text-muted-foreground whitespace-nowrap">
    {completedCount}/{totalCount} tasks
  </span>
  {totalCount > 0 && (
    <Progress value={progressPercent} className="h-1.5 w-20" />
  )}
</div>

{/* Expand chevron */}
<div className="shrink-0 text-muted-foreground">
  {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
</div>
```

- [ ] **Step 6: Add "View Board" button for ACTIVE sprints**

In the actions section, add a "View Board" button for active sprints. Replace:

```tsx
{sprint.status === 'ACTIVE' && (
  <Button
    variant="outline"
    size="sm"
    className="h-7 text-xs"
    onClick={() => setCloseDialogOpen(true)}
  >
    Close Sprint
  </Button>
)}
```

With:

```tsx
{sprint.status === 'ACTIVE' && (
  <>
    <Button
      variant="outline"
      size="sm"
      className="h-7 text-xs"
      onClick={() => navigate(`/projects/${projectId}/sprints/${sprint.id}`)}
    >
      View Board
    </Button>
    <Button
      variant="outline"
      size="sm"
      className="h-7 text-xs"
      onClick={() => setCloseDialogOpen(true)}
    >
      Close Sprint
    </Button>
  </>
)}
```

- [ ] **Step 7: Update the close dialog to use new count props**

Replace:

```tsx
<AlertDialogDescription>
  {incompleteTasks > 0
    ? `${incompleteTasks} incomplete task${incompleteTasks !== 1 ? 's' : ''} will be moved back to the backlog. This cannot be undone.`
    : 'All tasks in this sprint are complete. This cannot be undone.'}
</AlertDialogDescription>
```

With:

```tsx
<AlertDialogDescription>
  {totalCount - completedCount > 0
    ? `${totalCount - completedCount} incomplete task${totalCount - completedCount !== 1 ? 's' : ''} will be moved back to the backlog. This cannot be undone.`
    : 'All tasks in this sprint are complete. This cannot be undone.'}
</AlertDialogDescription>
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/sprints/SprintListItem.tsx
git commit -m "feat(sprints): add summary counts, progress bar, and expand toggle to SprintListItem"
```

---

### Task 3: Add Expandable Task List to SprintListItem

**Files:**
- Modify: `apps/web/src/components/sprints/SprintListItem.tsx`

- [ ] **Step 1: Sort tasks for display**

Add a `sortedTasks` memo after the existing state/computed values (after the `progressPercent` line):

```tsx
const sortedTasks = useMemo(() => {
  const open = sprintTasks.filter((t) => !t.workflowStatus?.isClosed);
  const closed = sprintTasks.filter((t) => t.workflowStatus?.isClosed === true);
  return [...open, ...closed];
}, [sprintTasks]);
```

Also add `useMemo` to the imports from React:

```tsx
import { useMemo, useState } from 'react';
```

- [ ] **Step 2: Add the expandable task list section**

After the closing `</div>` of the main row (the one with `onClick={handleRowClick}`), and before the `{/* Close Sprint Confirmation Dialog */}` comment, add:

```tsx
{/* Expandable task list */}
{expanded && (
  <div className="rounded-lg border bg-card px-4 pb-3 pt-1 -mt-1 border-t-0 rounded-t-none">
    {sortedTasks.length === 0 ? (
      <p className="text-sm text-muted-foreground py-3 text-center">
        No tasks in this sprint
      </p>
    ) : (
      <div className="flex flex-col divide-y">
        {sortedTasks.map((task) => {
          const isClosed = task.workflowStatus?.isClosed === true;
          return (
            <div
              key={task.id}
              className="flex items-center gap-3 py-2 min-h-[36px]"
            >
              {/* Status icon */}
              {isClosed ? (
                <CheckCircle2 className="size-4 shrink-0 text-green-600" />
              ) : (
                <Circle className="size-4 shrink-0 text-muted-foreground" />
              )}

              {/* Task title */}
              <span
                className={cn(
                  'text-sm truncate flex-1 min-w-0',
                  isClosed && 'line-through text-muted-foreground',
                )}
              >
                {task.title}
              </span>

              {/* Assignee avatar */}
              {task.assignee ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="size-6 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center">
                      {task.assignee.username.charAt(0).toUpperCase()}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{task.assignee.username}</TooltipContent>
                </Tooltip>
              ) : (
                <div className="size-6 shrink-0" />
              )}

              {/* Story points */}
              {task.storyPoints != null && task.storyPoints > 0 && (
                <Badge variant="outline" className="shrink-0 text-xs h-5 px-1.5">
                  {task.storyPoints}
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 3: Verify the component compiles**

Run:

```bash
cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No errors related to SprintListItem or SprintsPage.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/sprints/SprintListItem.tsx
git commit -m "feat(sprints): add expandable task list with status, assignee, and points"
```

---

### Task 4: Final Verification

- [ ] **Step 1: Run type check on the full frontend**

```bash
cd apps/web && npx tsc --noEmit --pretty 2>&1 | tail -20
```

Expected: Clean output, no type errors.

- [ ] **Step 2: Run dev server to verify rendering**

```bash
cd apps/web && npx vite build 2>&1 | tail -10
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit any remaining fixes if needed**

If any type or build issues were found, fix and commit:

```bash
git add -A && git commit -m "fix(sprints): resolve build issues in sprint task visibility"
```
