# Member Performance Table — Design Spec

**Date:** 2026-04-11
**Replaces:** RecentActivity component (Row 4 of Project Dashboard)

## Overview

Replace the chronological recent activity list on the project dashboard with a member performance table. The table shows each project member's workload, hours, efficiency, and quality at a glance using embedded visualizations (stacked bars, heat blocks, trend arrows) rather than raw numbers.

## Visual Style

Style B from brainstorming: **Stacked Bars + Heat Blocks**.

- **Task Breakdown:** Horizontal stacked bar (done=green / in-progress=blue / todo=gray) with count labels below.
- **Hours Logged:** Large bold number with "h" suffix.
- **Avg Time/Task:** Number with up/down trend arrow comparing to team average.
- **Quality:** 5 heat blocks colored by bug-to-task ratio.
- **Bugs:** Raw count number.
- Member column shows avatar circle (initials fallback) + name.

## Columns

| # | Column | Data Source | Visual Treatment |
|---|--------|------------|-----------------|
| 1 | **Member** | `ProjectMember` joined with `User` (name, imageUrl) | Avatar circle + name |
| 2 | **Task Breakdown** | `Task` grouped by workflow status (closed/active/todo) per `assigneeId` | Horizontal stacked bar + count labels |
| 3 | **Hours Logged** | `TimeLog` SUM(minutes) grouped by `userId` for tasks in project | Large number + "h" suffix |
| 4 | **Avg Time/Task** | (Total hours logged) / (completed task count), compared to team-wide average | Number + green up-arrow (better) or red down-arrow (worse) |
| 5 | **Quality** | (Bug count where `assigneeId` = member) / (completed task count) | 5 heat blocks |
| 6 | **Bugs** | `Bug` count where `assigneeId` = member | Raw number |

## Sorting & Filtering

### Default Sort
- Completed task count, descending (most productive first).
- All column headers are clickable for re-sorting.

### Time Filter
Dropdown with options:
- **All time** (default) — no date constraint
- **This sprint** — tasks in the active sprint only
- **Last 7 days** — rolling window based on `Task.updatedAt`
- **Last 30 days** — rolling window based on `Task.updatedAt`

When a time filter is active, all columns (tasks, hours, bugs) are scoped to that window.

## Quality Heat Block Scale

5-block indicator based on bug-to-task ratio (bugs assigned to member / completed tasks):

| Blocks Filled | Color | Ratio |
|---------------|-------|-------|
| 5/5 | Green | 0 bugs |
| 4/5 | Green | < 0.1 |
| 3/5 | Green | < 0.25 |
| 2/5 | Amber | < 0.5 |
| 1/5 | Red | >= 0.5 |

Members with 0 completed tasks show 0/5 gray blocks (no data).

## Interaction

- **Read-only** — no click behavior on rows.
- Column headers clickable for sorting only.

## Backend Changes

### New method in `DashboardService`

`getMemberPerformance(projectId: string, timeFilter?: 'sprint' | '7d' | '30d')`

Returns `MemberPerformanceRow[]`:

```typescript
interface MemberPerformanceRow {
  userId: string;
  name: string;
  imageUrl: string | null;
  tasks: {
    completed: number;
    inProgress: number;
    todo: number;
    total: number;
  };
  hoursLogged: number;       // from TimeLog SUM(minutes) / 60
  avgHoursPerTask: number;   // hoursLogged / tasks.completed
  bugCount: number;          // bugs assigned to this member
  qualityRatio: number;      // bugCount / tasks.completed
}
```

Also returns `teamAvgHoursPerTask: number` for the trend arrow comparison.

### Queries needed

1. **Members:** `ProjectMember.findMany` with `User` join for the project.
2. **Tasks by assignee + status:** `Task.groupBy` on `[assigneeId, workflowStatusId]` with time filter. Cross-reference `WorkflowStatus.isClosed` to classify done/active/todo.
3. **Hours by user:** `TimeLog.aggregate` SUM(minutes) grouped by `userId`, filtered to tasks in the project (and time window).
4. **Bugs by assignee:** `Bug.groupBy` on `assigneeId` with count.

All queries run in `Promise.all` for performance.

### Time filter logic

- **All time:** No date constraint.
- **This sprint:** `Task.where({ sprintId: activeSprint.id })`, `TimeLog` and `Bug` filtered to tasks in that sprint.
- **Last 7/30 days:** `Task.where({ updatedAt: { gte: cutoffDate } })`, `TimeLog.where({ loggedAt: { gte: cutoffDate } })`, `Bug.where({ createdAt: { gte: cutoffDate } })`.

### Integration with existing endpoint

Extend `getProjectDashboard` to include `memberPerformance` in its return value. Remove `recentActivity` from the response.

## Frontend Changes

### New component: `MemberPerformance.tsx`

Location: `apps/web/src/components/dashboard/MemberPerformance.tsx`

- Receives `MemberPerformanceRow[]` and `teamAvgHoursPerTask` as props.
- Renders inside a `Card` with `CardHeader` ("Team Performance") and `CardContent`.
- Stacked bar uses inline divs with percentage widths and color backgrounds.
- Heat blocks are small colored div squares.
- Trend arrow: green up-triangle SVG if `avgHoursPerTask < teamAvg`, red down-triangle if above.
- Time filter dropdown in the card header (right-aligned).

### Remove: `RecentActivity.tsx`

Delete the component and remove its import/usage from `ProjectDashboardPage.tsx`.

### Update: `ProjectDashboardPage.tsx`

- Replace `<RecentActivity activities={activities} />` with `<MemberPerformance data={memberPerformance} teamAvg={teamAvgHoursPerTask} />`.
- Remove `recentActivity` from the destructured dashboard data.
- Add time filter state, pass to the API call (or refetch on change).

### Update: `useDashboard` hook

Add `memberPerformance` and `teamAvgHoursPerTask` to the expected response shape.

## Edge Cases

- **No members:** Show empty state "No team members in this project."
- **Member with 0 tasks:** Show all zeros, gray stacked bar, 0/5 gray heat blocks.
- **Member with 0 completed tasks:** `avgHoursPerTask` = 0, quality = 0/5 gray. Avoid division by zero.
- **No active sprint:** "This sprint" filter option is disabled/hidden.
- **Unassigned tasks/bugs:** Not counted toward any member (excluded from table).

## Files Changed

| File | Action |
|------|--------|
| `apps/api/src/dashboard/dashboard.service.ts` | Add `getMemberPerformance()`, update `getProjectDashboard()` |
| `apps/api/src/dashboard/dashboard.service.spec.ts` | Add tests for new method |
| `apps/web/src/components/dashboard/MemberPerformance.tsx` | New component |
| `apps/web/src/components/dashboard/RecentActivity.tsx` | Delete |
| `apps/web/src/pages/ProjectDashboardPage.tsx` | Swap components, add time filter |
| `apps/web/src/hooks/useDashboard.ts` | Update response type |
