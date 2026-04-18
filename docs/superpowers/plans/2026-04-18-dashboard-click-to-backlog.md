# Dashboard Click-to-Backlog Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make dashboard status cards and member performance task breakdown bars clickable, navigating to the Backlog page with pre-applied filters via URL search params.

**Architecture:** URL search params (`?status=`, `?statusCategory=`, `?assignee=`) drive filter state in BacklogPage. Dashboard components use `useNavigate` to build these URLs. BacklogPage reads params on mount and converts them to `ColumnFiltersState` before passing to TasksTable. The `statusFilterFn` is extended to handle a `__none__` sentinel for tasks with no workflow status.

**Tech Stack:** React, react-router-dom (useNavigate, useParams, useSearchParams), TanStack Table, Tailwind CSS

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/src/components/dashboard/StatCard.tsx` | Modify | Add `onClick` prop + hover styles |
| `apps/web/src/components/dashboard/DashboardStatusStrip.tsx` | Modify | Wire navigation on card clicks |
| `apps/web/src/components/dashboard/MemberPerformance.tsx` | Modify | Make TaskBar segments clickable with navigation |
| `apps/web/src/pages/ProjectDashboardPage.tsx` | Modify | Pass `projectPrefix` to child components |
| `apps/web/src/pages/BacklogPage.tsx` | Modify | Read URL search params, resolve to initial filters |
| `apps/web/src/components/tasks/TaskFilters.tsx` | Modify | Handle `__none__` sentinel in `statusFilterFn` and `matchesFilters` |

---

### Task 1: Update StatCard to accept onClick and show hover state

**Files:**
- Modify: `apps/web/src/components/dashboard/StatCard.tsx`

- [ ] **Step 1: Add `onClick` prop and conditional hover styles**

Replace the full `StatCard` component with:

```tsx
export function StatCard({ title, value, icon: Icon, variant = 'default', accentColor, onClick }: StatCardProps) {
  return (
    <Card
      className={cn('min-w-[160px]', onClick && 'cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md')}
      style={accentColor ? { borderTopColor: accentColor, borderTopWidth: 3 } : undefined}
      onClick={onClick}
    >
```

Also update the `StatCardProps` interface to include:

```tsx
interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant?: 'default' | 'warning' | 'danger';
  accentColor?: string;
  onClick?: () => void;
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors (onClick is optional, existing callers unaffected)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/StatCard.tsx
git commit -m "feat(dashboard): add onClick prop and hover styles to StatCard"
```

---

### Task 2: Wire navigation in DashboardStatusStrip

**Files:**
- Modify: `apps/web/src/components/dashboard/DashboardStatusStrip.tsx`

- [ ] **Step 1: Add navigation imports and props**

Add to the top of the file:

```tsx
import { useNavigate } from 'react-router-dom';
```

Update the component props interface to accept `projectPrefix`:

```tsx
interface DashboardStatusStripProps {
  total: number;
  byStatus: StatusCount[];
  projectPrefix: string;
}
```

- [ ] **Step 2: Wire onClick handlers in the component body**

Inside the `DashboardStatusStrip` function, add `useNavigate` and update the JSX:

```tsx
export function DashboardStatusStrip({ total, byStatus, projectPrefix }: DashboardStatusStripProps) {
  const navigate = useNavigate();
  // ... existing scroll logic unchanged ...
```

Replace the "Total Tasks" StatCard:

```tsx
<div className="shrink-0">
  <StatCard
    title="Total Tasks"
    value={total}
    icon={ListTodo}
    onClick={() => navigate(`/projects/${projectPrefix}/backlog`)}
  />
</div>
```

Replace the per-status StatCard mapping:

```tsx
{byStatus.map((s) => (
  <div key={s.statusId} className="shrink-0">
    <StatCard
      title={s.name}
      value={s.count}
      icon={Circle}
      accentColor={s.color}
      onClick={() => navigate(`/projects/${projectPrefix}/backlog?status=${s.statusId}`)}
    />
  </div>
))}
```

- [ ] **Step 3: Verify build passes**

Run: `cd apps/web && npx tsc --noEmit`
Expected: Error — `ProjectDashboardPage` doesn't pass `projectPrefix` yet (fixed in Task 4)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/DashboardStatusStrip.tsx
git commit -m "feat(dashboard): wire status card click navigation to backlog"
```

---

### Task 3: Make MemberPerformance TaskBar segments clickable

**Files:**
- Modify: `apps/web/src/components/dashboard/MemberPerformance.tsx`

- [ ] **Step 1: Add navigation import and update MemberPerformanceProps**

Add import:

```tsx
import { useNavigate } from 'react-router-dom';
```

Update the props interface:

```tsx
interface MemberPerformanceProps {
  members: MemberPerformanceRow[];
  teamAvgHoursPerTask: number;
  timeFilter: string;
  onTimeFilterChange: (value: string) => void;
  projectPrefix: string;
}
```

- [ ] **Step 2: Update TaskBar to accept onClick**

Update the `TaskBar` function signature and add click handlers to each segment:

```tsx
function TaskBar({
  completed,
  inProgress,
  todo,
  onSegmentClick,
}: {
  completed: number;
  inProgress: number;
  todo: number;
  onSegmentClick?: (category: 'closed' | 'active' | 'unassigned') => void;
}) {
  const total = completed + inProgress + todo;
  if (total === 0) {
    return <div className="h-5 w-full rounded bg-muted" />;
  }

  return (
    <div>
      <div className="flex h-5 overflow-hidden rounded" style={{ gap: '1px' }}>
        {completed > 0 && (
          <div
            className="cursor-pointer transition-all hover:brightness-110"
            style={{ width: `${(completed / total) * 100}%`, backgroundColor: '#22c55e' }}
            title={`Done: ${completed}`}
            onClick={(e) => { e.stopPropagation(); onSegmentClick?.('closed'); }}
          />
        )}
        {inProgress > 0 && (
          <div
            className="cursor-pointer transition-all hover:brightness-110"
            style={{ width: `${(inProgress / total) * 100}%`, backgroundColor: '#3b82f6' }}
            title={`In Progress: ${inProgress}`}
            onClick={(e) => { e.stopPropagation(); onSegmentClick?.('active'); }}
          />
        )}
        {todo > 0 && (
          <div
            className="cursor-pointer transition-all hover:brightness-110"
            style={{ width: `${(todo / total) * 100}%`, backgroundColor: 'hsl(var(--muted-foreground) / 0.3)' }}
            title={`To Do: ${todo}`}
            onClick={(e) => { e.stopPropagation(); onSegmentClick?.('unassigned'); }}
          />
        )}
      </div>
      <div className="mt-1 flex gap-2 text-[10px] text-muted-foreground">
        <span><span className="text-green-500">●</span> {completed} done</span>
        <span><span className="text-blue-500">●</span> {inProgress} active</span>
        <span><span className="text-muted-foreground">●</span> {todo} todo</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire navigation in MemberPerformance component**

Inside the `MemberPerformance` function, add navigate and update the TaskBar usage:

```tsx
export function MemberPerformance({ members, teamAvgHoursPerTask, timeFilter, onTimeFilterChange, projectPrefix }: MemberPerformanceProps) {
  const navigate = useNavigate();
  // ... existing state/logic unchanged ...
```

In the table body where `TaskBar` is rendered (inside the `filtered.map`), replace the `<TaskBar>` call:

```tsx
<td className="min-w-[180px] py-3 pr-4">
  <TaskBar
    completed={member.tasks.completed}
    inProgress={member.tasks.inProgress}
    todo={member.tasks.todo}
    onSegmentClick={(category) =>
      navigate(`/projects/${projectPrefix}/backlog?assignee=${member.userId}&statusCategory=${category}`)
    }
  />
</td>
```

- [ ] **Step 4: Verify build passes**

Run: `cd apps/web && npx tsc --noEmit`
Expected: Error — `ProjectDashboardPage` doesn't pass `projectPrefix` yet (fixed in Task 4)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/MemberPerformance.tsx
git commit -m "feat(dashboard): make TaskBar segments clickable with navigation to backlog"
```

---

### Task 4: Pass projectPrefix from ProjectDashboardPage

**Files:**
- Modify: `apps/web/src/pages/ProjectDashboardPage.tsx`

- [ ] **Step 1: Add useParams and pass projectPrefix to children**

Add import at the top:

```tsx
import { useParams } from 'react-router-dom';
```

Inside the `ProjectDashboardPage` function, add:

```tsx
const { projectPrefix = '' } = useParams<{ projectPrefix: string }>();
```

Update the `DashboardStatusStrip` JSX to pass `projectPrefix`:

```tsx
<DashboardStatusStrip total={taskCounts.total} byStatus={taskCounts.byStatus} projectPrefix={projectPrefix} />
```

Update the `MemberPerformance` JSX to pass `projectPrefix`:

```tsx
<MemberPerformance
  members={memberPerformance}
  teamAvgHoursPerTask={teamAvgHoursPerTask}
  timeFilter={timeFilter}
  onTimeFilterChange={setTimeFilter}
  projectPrefix={projectPrefix}
/>
```

- [ ] **Step 2: Verify build passes**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors — all props now wired correctly

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/ProjectDashboardPage.tsx
git commit -m "feat(dashboard): pass projectPrefix to DashboardStatusStrip and MemberPerformance"
```

---

### Task 5: Update statusFilterFn to handle `__none__` sentinel

**Files:**
- Modify: `apps/web/src/components/tasks/TaskFilters.tsx`

- [ ] **Step 1: Update statusFilterFn**

Replace the existing `statusFilterFn` at line 376:

```tsx
export const statusFilterFn = (row: { getValue: (id: string) => unknown }, columnId: string, filterValue: string[]) => {
  if (!filterValue || filterValue.length === 0) return true;
  const val = row.getValue(columnId) as string | null;
  if (filterValue.includes('__none__') && (val === null || val === undefined)) return true;
  if (val && filterValue.includes(val)) return true;
  return false;
};
```

- [ ] **Step 2: Update matchesFilters for consistency**

The `matchesFilters` function at ~line 410 already delegates to `statusFilterFn`, so it inherits the `__none__` handling automatically. No change needed — just verify by reading the existing code.

- [ ] **Step 3: Verify build passes**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/tasks/TaskFilters.tsx
git commit -m "feat(filters): support __none__ sentinel in statusFilterFn for unassigned status"
```

---

### Task 6: Read URL search params in BacklogPage

**Files:**
- Modify: `apps/web/src/pages/BacklogPage.tsx`

- [ ] **Step 1: Add useSearchParams import**

Add to the existing react-router-dom import:

```tsx
import { useParams, useSearchParams } from 'react-router-dom';
```

- [ ] **Step 2: Add URL param reading logic**

Inside the `BacklogPage` function, after the `workflowStatuses` declaration (around line 36), add:

```tsx
const [searchParams] = useSearchParams();
```

- [ ] **Step 3: Replace the default filter resolution logic**

Replace the existing `useEffect` that handles `hasAppliedDefault` (lines 52-67) with:

```tsx
useEffect(() => {
  if (hasAppliedDefault.current) return;

  // URL params take priority
  const statusParam = searchParams.get('status');
  const statusCategoryParam = searchParams.get('statusCategory');
  const assigneeParam = searchParams.get('assignee');

  if (statusParam || statusCategoryParam || assigneeParam) {
    const columnFilters: ColumnFiltersState = [];

    if (statusParam) {
      columnFilters.push({ id: 'workflowStatusId', value: [statusParam] });
    } else if (statusCategoryParam && workflowStatuses.length > 0) {
      let statusIds: string[];
      switch (statusCategoryParam) {
        case 'closed':
          statusIds = workflowStatuses.filter((s) => s.isClosed).map((s) => s.id);
          break;
        case 'active':
          statusIds = workflowStatuses.filter((s) => !s.isClosed).map((s) => s.id);
          break;
        case 'unassigned':
          statusIds = ['__none__'];
          break;
        default:
          statusIds = [];
      }
      if (statusIds.length > 0) {
        columnFilters.push({ id: 'workflowStatusId', value: statusIds });
      }
    }

    if (assigneeParam) {
      columnFilters.push({ id: 'assigneeId', value: [assigneeParam] });
    }

    setAppliedFilters({ columnFilters, globalFilter: '' });
    setActiveFilterId(null);
    hasAppliedDefault.current = true;
    return;
  }

  // Fall back to saved filter default or hardcoded default
  if (defaultSavedFilter) {
    const resolved = savedFilterDataToColumnFilters(defaultSavedFilter.filters);
    setAppliedFilters(resolved);
    setActiveFilterId(defaultSavedFilter.id);
    hasAppliedDefault.current = true;
  } else if (workflowStatuses.length > 0) {
    const openStatusIds = workflowStatuses.filter((s) => !s.isClosed).map((s) => s.id);
    if (openStatusIds.length > 0 && openStatusIds.length < workflowStatuses.length) {
      setAppliedFilters({ columnFilters: [{ id: 'workflowStatusId', value: openStatusIds }], globalFilter: '' });
    }
    hasAppliedDefault.current = true;
  }
}, [defaultSavedFilter, workflowStatuses, searchParams]);
```

- [ ] **Step 4: Verify build passes**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Manual testing checklist**

1. Go to Dashboard, click a status card → BacklogPage loads with only that status shown
2. Click "Total Tasks" → BacklogPage loads with all tasks (no filter)
3. Click a green TaskBar segment → BacklogPage shows that member's completed tasks
4. Click a blue TaskBar segment → BacklogPage shows that member's in-progress tasks
5. Click a gray TaskBar segment → BacklogPage shows that member's unassigned tasks
6. Copy a filtered URL, open in new tab → same filter applied
7. Use browser back button → returns to dashboard
8. Clear filters in BacklogPage → all tasks visible again

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/BacklogPage.tsx
git commit -m "feat(backlog): read URL search params for status, statusCategory, and assignee filters"
```
