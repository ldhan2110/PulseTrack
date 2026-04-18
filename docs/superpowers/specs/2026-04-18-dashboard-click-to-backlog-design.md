# Dashboard Click-to-Backlog Navigation

**Date:** 2026-04-18
**Status:** Approved

## Overview

Make dashboard elements clickable to navigate to the Backlog page with pre-applied filters. Two entry points:

1. **Status Strip Cards** (top row) — filter by specific workflow status
2. **Member Performance TaskBar segments** — filter by assignee + status category (done/active/todo)

## URL Param Contract

All navigation targets: `/projects/:projectPrefix/backlog`

| Param | Type | Values | Description |
|-------|------|--------|-------------|
| `status` | string | workflow status UUID | Filter by specific `workflowStatusId` |
| `statusCategory` | enum | `closed`, `active`, `unassigned` | Filter by status group |
| `assignee` | string | user UUID | Filter by `assigneeId` |

Params combine. Example: `?assignee=abc&statusCategory=closed` = that member's completed tasks.

### Status Category Mapping

Maps to backend logic in `dashboard.service.ts`:

- `closed` — statuses where `isClosed === true`
- `active` — statuses where `isClosed === false` (has a workflowStatusId)
- `unassigned` — tasks with no `workflowStatusId` (null)

## Feature 1: Status Strip Cards

### Current State

`DashboardStatusStrip` renders `StatCard` components. Cards are static display-only.

### Changes

**`StatCard.tsx`**
- Add optional `onClick?: () => void` prop
- When `onClick` is provided: add `cursor-pointer`, hover effect (slight scale + shadow lift via Tailwind `hover:scale-[1.02] hover:shadow-md transition-all`)

**`DashboardStatusStrip.tsx`**
- Add `useNavigate()` and `useParams()` from react-router-dom
- "Total Tasks" card `onClick` → navigate to `/projects/:prefix/backlog` (no params = all tasks)
- Per-status card `onClick` → navigate to `/projects/:prefix/backlog?status=<statusId>`

## Feature 2: Member Performance TaskBar

### Current State

`TaskBar` renders three colored `<div>` segments (done/active/todo) inside `MemberPerformance`. Segments are display-only with title tooltips.

### Changes

**`MemberPerformance.tsx`**
- Accept `projectPrefix: string` prop (passed from `ProjectDashboardPage`)
- Add `useNavigate()` from react-router-dom
- Pass `userId` and an `onSegmentClick(userId, category)` handler to `TaskBar`

**`TaskBar` component (inside MemberPerformance.tsx)**
- Accept `onClick?: (category: 'closed' | 'active' | 'unassigned') => void` prop
- Each colored segment gets: `onClick`, `cursor-pointer`, `hover:brightness-110 transition-all`
- Only add click behavior when segment has count > 0

**Navigation targets:**
- Green (done) → `?assignee=<userId>&statusCategory=closed`
- Blue (in progress) → `?assignee=<userId>&statusCategory=active`
- Gray (todo) → `?assignee=<userId>&statusCategory=unassigned`

## Feature 3: BacklogPage URL Param Consumption

### Current State

`BacklogPage` resolves initial filters from: selected saved filter > user default > hardcoded default (exclude closed statuses). Uses `appliedFilters` state fed to `TasksTable.initialFilters`.

### Changes

**`BacklogPage.tsx`**
- Add `useSearchParams()` from react-router-dom
- On mount, check URL params BEFORE saved filter/default logic:
  1. If `status` param → set `initialFilters` to `[{ id: 'workflowStatusId', value: [statusParam] }]`
  2. If `statusCategory` param → resolve to status IDs using `workflowStatuses`:
     - `closed` → `workflowStatuses.filter(s => s.isClosed).map(s => s.id)`
     - `active` → `workflowStatuses.filter(s => !s.isClosed).map(s => s.id)`
     - `unassigned` → special case: need to handle "no status" filter (may need TasksTable adjustment)
  3. If `assignee` param → add `{ id: 'assigneeId', value: [assigneeParam] }` to filters
  4. URL params take priority over saved filter defaults
- Params stay in URL for shareability; user can clear filters normally via the table UI

### Edge Case: `unassigned` status category

Tasks with no `workflowStatusId` (null) need special handling. The current filter infrastructure filters by status ID values. For "unassigned":
- Add a sentinel value like `__none__` to the `workflowStatusId` filter
- TasksTable's filter function checks: if filter value includes `__none__`, include tasks where `workflowStatusId` is null/undefined

## Files Changed

| File | Change |
|------|--------|
| `apps/web/src/components/dashboard/StatCard.tsx` | Add `onClick` prop + hover styles |
| `apps/web/src/components/dashboard/DashboardStatusStrip.tsx` | Wire navigation on card clicks |
| `apps/web/src/components/dashboard/MemberPerformance.tsx` | Add navigation to TaskBar segments, accept `projectPrefix` |
| `apps/web/src/pages/ProjectDashboardPage.tsx` | Pass `projectPrefix` to MemberPerformance |
| `apps/web/src/pages/BacklogPage.tsx` | Read URL search params, resolve to initial filters |
| `apps/web/src/components/tasks/TasksTable.tsx` | Handle `__none__` sentinel in status filter (if needed) |

## No Backend Changes

All filtering uses existing client-side data and filter infrastructure.

## Testing

- Click each status card on dashboard → verify backlog shows correct filtered tasks
- Click each TaskBar segment → verify backlog shows correct member + status category
- Verify "Total Tasks" shows all tasks with no filter
- Verify URL is shareable (copy URL, open in new tab → same filtered view)
- Verify back button returns to dashboard
- Verify clearing filters in backlog works normally after URL-param navigation
