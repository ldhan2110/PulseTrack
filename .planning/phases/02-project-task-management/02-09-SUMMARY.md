---
phase: 02-project-task-management
plan: 09
subsystem: ui
tags: [react, typescript, dashboard, sprints, types]

# Dependency graph
requires:
  - phase: 02-project-task-management
    provides: Backend dashboard endpoint returning taskCounts, activeSprint, burndown, recentActivity shapes
provides:
  - Corrected frontend types matching backend response shapes (TaskCounts, BurndownPoint, ActivityItem, ActiveSprintData)
  - ProjectDashboardPage reading correct field names without transformation stubs
  - All sprint components using COMPLETED instead of CLOSED for SprintStatus
affects: [03-ai-story-generation, 04-real-time-websockets]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pass backend data directly to components without transformation when shapes already match"
    - "Frontend SprintStatus enum must stay in sync with Prisma SprintStatus (PLANNED | ACTIVE | COMPLETED)"

key-files:
  created: []
  modified:
    - apps/web/src/lib/types.ts
    - apps/web/src/pages/ProjectDashboardPage.tsx
    - apps/web/src/pages/SprintsPage.tsx
    - apps/web/src/pages/SprintBoardPage.tsx
    - apps/web/src/components/sprints/SprintListItem.tsx
    - apps/web/src/components/sprints/CreateSprintDialog.tsx

key-decisions:
  - "SprintStats interface retained in types.ts — still used in api.ts for sprint stats endpoint despite being removed from DashboardData"
  - "buildBurndownChartData and mapActivity transformation functions removed — backend already returns correctly shaped data"

patterns-established:
  - "Type alignment pattern: frontend types must mirror backend response shapes exactly — no client-side field remapping"

requirements-completed: [PROJ-02, SPRT-03]

# Metrics
duration: 19min
completed: 2026-04-05
---

# Phase 2 Plan 9: Gap Closure — Frontend Type Alignment Summary

**Fixed 4 frontend type mismatches causing empty dashboard stat cards, NaN burndown chart, broken activity feed, and invisible completed sprints by aligning types.ts and 6 component files with actual backend response shapes**

## Performance

- **Duration:** 19 min
- **Started:** 2026-04-05T13:12:15Z
- **Completed:** 2026-04-05T13:31:41Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Dashboard stat cards now read `data?.taskCounts` (not `data?.taskStats`) — total/inProgress/done/blocked show real task counts
- Burndown chart receives `{date, ideal, actual}` directly from backend — NaN values eliminated, no transformation needed
- Recent activity feed receives `{id, type, title, actor, timestamp}` directly — actor names and task titles now display correctly
- Completed sprints now detected by `COMPLETED` status matching Prisma enum — display with Completed badge, muted opacity, and appear in correct sort bucket

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix types.ts — align DashboardData, BurndownPoint, ActivityItem, and SprintStatus with backend** - `b7feb10` (fix)
2. **Task 2: Fix ProjectDashboardPage — read correct field names and pass backend data directly** - `0e681ce` (fix)
3. **Task 3: Fix SprintStatus references — replace CLOSED with COMPLETED in all sprint components** - `379a108` (fix)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `apps/web/src/lib/types.ts` - SprintStatus COMPLETED, DashboardStatCard→TaskCounts, BurndownPoint ideal/actual, ActivityItem title/actor/timestamp, added ActiveSprintData+BugCounts, DashboardData uses taskCounts+activeSprint+bugCounts
- `apps/web/src/pages/ProjectDashboardPage.tsx` - Removed buildBurndownChartData and mapActivity stubs, reads data?.taskCounts, passes data straight through to components
- `apps/web/src/pages/SprintsPage.tsx` - CLOSED→COMPLETED in sort comment and filter
- `apps/web/src/pages/SprintBoardPage.tsx` - CLOSED→COMPLETED in isCompleted check and badge label
- `apps/web/src/components/sprints/SprintListItem.tsx` - CLOSED→COMPLETED in getStatusVariant case, isCompleted, badge label
- `apps/web/src/components/sprints/CreateSprintDialog.tsx` - CLOSED→COMPLETED in overlap detection

## Decisions Made
- Retained `SprintStats` interface in types.ts even though it was removed from DashboardData — it's still imported and used in `api.ts` for the `GET /projects/:id/sprints/:id/stats` endpoint. Removing it would break the API client.
- No type imports needed in ProjectDashboardPage after removal of transformation functions — data is passed straight through.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Retained SprintStats interface to prevent build breakage**
- **Found during:** Task 1 (Fix types.ts)
- **Issue:** Plan specified removing `interface SprintStats` entirely, but `apps/web/src/lib/api.ts` still imports and uses `SprintStats` for the sprint stats endpoint response type
- **Fix:** Kept `SprintStats` interface in types.ts. DashboardData no longer references it, but the API client still needs it for `getSprintStats()`.
- **Files modified:** apps/web/src/lib/types.ts (no change to SprintStats)
- **Verification:** `pnpm --filter @pm/web exec tsc --noEmit` passes with 0 errors
- **Committed in:** b7feb10 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug prevention)
**Impact on plan:** Necessary to prevent a TypeScript error. SprintStats removed from DashboardData as intended; kept in types.ts for the existing sprint stats API client.

## Issues Encountered
None — all fixes were straightforward type alignment changes.

## Known Stubs
None — all type corrections wire real backend data to components.

## Next Phase Readiness
- All dashboard and sprint UI now correctly displays backend data
- Phase 2 verification gaps 1-4 are closed
- TypeScript compiles clean, production build succeeds, all 55 tests pass
- Ready for Phase 3 (AI story generation) or final Phase 2 verification

## Self-Check: PASSED

- FOUND: apps/web/src/lib/types.ts
- FOUND: apps/web/src/pages/ProjectDashboardPage.tsx
- FOUND: .planning/phases/02-project-task-management/02-09-SUMMARY.md
- FOUND commit b7feb10 (Task 1)
- FOUND commit 0e681ce (Task 2)
- FOUND commit 379a108 (Task 3)

---
*Phase: 02-project-task-management*
*Completed: 2026-04-05*
