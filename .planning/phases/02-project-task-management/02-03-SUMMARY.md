---
phase: 02-project-task-management
plan: 03
subsystem: backend-api
tags: [nestjs, sprints, bugs, dashboard, prisma, transaction, aggregation, burndown]

requires:
  - phase: 02-01
    provides: prisma-phase2-schema with Sprint/Bug models and SprintStatus/BugSeverity/BugStatus enums
  - phase: 02-02
    provides: tasks-module, ProjectRolesGuard pattern, direct-service-instantiation test pattern
provides:
  - sprints-module
  - bugs-module
  - dashboard-module
  - sprint-activate-one-active-enforcement
  - sprint-close-atomic-backfill
  - dashboard-aggregation-endpoint
affects:
  - 02-04 (frontend dashboard page)
  - 02-05 (frontend sprints page)
  - 02-06 (frontend bugs page)
  - Phase 6 (Blueprint sync references sprint/bug data)

tech-stack:
  added: []
  patterns:
    - "prisma.\$transaction for atomic sprint activate (read-count + update, prevents race conditions)"
    - "prisma.\$transaction for atomic sprint close (updateMany tasks + update sprint in one TX)"
    - "Promise.all for concurrent Prisma queries in dashboard aggregation"
    - "prisma.task.groupBy for task count aggregation by status"
    - "Linear burndown ideal line computed in-memory from sprint date range"
    - "POC burndown approximation: task.updatedAt used as completion date proxy"

key-files:
  created:
    - apps/api/src/sprints/sprints.module.ts
    - apps/api/src/sprints/sprints.controller.ts
    - apps/api/src/sprints/sprints.service.ts
    - apps/api/src/sprints/sprints.service.spec.ts
    - apps/api/src/sprints/dto/create-sprint.dto.ts
    - apps/api/src/sprints/dto/update-sprint.dto.ts
    - apps/api/src/bugs/bugs.module.ts
    - apps/api/src/bugs/bugs.controller.ts
    - apps/api/src/bugs/bugs.service.ts
    - apps/api/src/bugs/bugs.service.spec.ts
    - apps/api/src/bugs/dto/create-bug.dto.ts
    - apps/api/src/bugs/dto/update-bug.dto.ts
    - apps/api/src/dashboard/dashboard.module.ts
    - apps/api/src/dashboard/dashboard.controller.ts
    - apps/api/src/dashboard/dashboard.service.ts
    - apps/api/src/dashboard/dashboard.service.spec.ts
  modified:
    - apps/api/src/app.module.ts (registered SprintsModule, BugsModule, DashboardModule)

key-decisions:
  - "BurndownPoint interface exported from dashboard.service.ts to resolve tsc TS4053 (inferred return type references unexported interface)"
  - "Dashboard burndown uses updatedAt as completion date proxy for POC — TaskStatusHistory table would be needed for accurate production burndown"
  - "Free bug status transitions in service layer (no state machine) — UI guides correct Open->In Fix->Fixed->Verified->Closed flow per D-19"
  - "sprint.closeSprint() returns { sprint, movedToBacklog: count } for frontend toast message support"

patterns-established:
  - "Dashboard aggregation pattern: Promise.all for concurrent queries, in-memory assembly for burndown"
  - "Atomic sprint operations via \$transaction: count-then-update prevents TOCTOU race condition"

requirements-completed:
  - PROJ-02
  - SPRT-01
  - SPRT-02
  - SPRT-03

duration: 3min
completed: "2026-04-05"
---

# Phase 02 Plan 03: Sprints, Bugs, and Dashboard Backend Summary

**NestJS Sprints module with one-active-sprint enforcement and atomic backfill on close; Bugs module with QC-driven severity tracking; Dashboard module returning task counts, burndown, sprint progress, and bug counts — all 6 backend modules now registered in AppModule**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-05T19:29:27Z
- **Completed:** 2026-04-05T19:32:54Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments

- SprintsModule: create/activate/close/stats endpoints with `$transaction` for one-active-sprint enforcement (D-22) and atomic task backfill on close (D-25)
- BugsModule: CRUD with BugSeverity, reporterId auto-set from JWT, QC-driven status transitions, role-restricted routes (QC can create/update, PM can delete)
- DashboardModule: single `GET /projects/:projectId/dashboard` endpoint aggregating task counts by status, active sprint progress, burndown data, recent activity feed, and bug counts
- 46 tests passing across 9 test files (zero TypeScript errors)
- All 6 backend modules registered in AppModule: ProjectsModule, MembersModule, TasksModule, SprintsModule, BugsModule, DashboardModule

## Task Commits

1. **Task 1: Backend Sprints and Bugs modules** - `73b0477` (feat)
2. **Task 2: Backend Dashboard module with aggregation and burndown** - `c47a86c` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `apps/api/src/sprints/sprints.service.ts` - Sprint CRUD, activate (one-active enforcement via $transaction), closeSprint (atomic backfill), getSprintStats
- `apps/api/src/sprints/sprints.controller.ts` - Routes: GET/POST /sprints, GET/PATCH/:id, POST/:id/activate, POST/:id/close, GET/:id/stats
- `apps/api/src/sprints/sprints.service.spec.ts` - 7 tests: create with PLANNED status, date validation, activate success/conflict, closeSprint backfill
- `apps/api/src/sprints/dto/create-sprint.dto.ts` - name, startDate, endDate with validators
- `apps/api/src/sprints/dto/update-sprint.dto.ts` - All optional fields + optional SprintStatus enum
- `apps/api/src/bugs/bugs.service.ts` - Bug CRUD, reporter auto-set, free status transitions
- `apps/api/src/bugs/bugs.controller.ts` - Routes: GET/POST /bugs, GET/PATCH/DELETE /:bugId with QC-driven RBAC
- `apps/api/src/bugs/bugs.service.spec.ts` - 5 tests: create with reporterId, multiple severities, status transitions
- `apps/api/src/bugs/dto/create-bug.dto.ts` - title, severity (BugSeverity enum), optional fields
- `apps/api/src/bugs/dto/update-bug.dto.ts` - All optional fields + optional BugStatus enum
- `apps/api/src/dashboard/dashboard.service.ts` - getProjectDashboard() aggregation with taskCounts/activeSprint/recentActivity/burndown/bugCounts
- `apps/api/src/dashboard/dashboard.controller.ts` - GET /projects/:projectId/dashboard, any project member
- `apps/api/src/dashboard/dashboard.service.spec.ts` - 5 tests: task counts, null activeSprint, sprint progress, burndown linear decrease, bug counts
- `apps/api/src/app.module.ts` - Registered SprintsModule, BugsModule, DashboardModule

## Decisions Made

- Exported `BurndownPoint` interface from `dashboard.service.ts` to resolve TypeScript TS4053 error (inferred return type of public controller method referenced unexported interface)
- Dashboard burndown uses `task.updatedAt` as completion date proxy — documented with POC approximation comment; production would require a TaskStatusHistory table
- Free bug status transitions (no state machine enforcement in service layer) — same pattern as TaskStatus per D-12; UI enforces correct Open → In Fix → Fixed → Verified → Closed workflow

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Exported BurndownPoint interface to fix TS4053 compilation error**
- **Found during:** Task 2 verification (tsc --noEmit)
- **Issue:** `interface BurndownPoint` was unexported but TypeScript inferred it in the public return type of `DashboardController.getProjectDashboard()`, causing TS4053
- **Fix:** Changed `interface BurndownPoint` to `export interface BurndownPoint` in dashboard.service.ts
- **Files modified:** `apps/api/src/dashboard/dashboard.service.ts`
- **Verification:** tsc --noEmit exits 0 after fix
- **Committed in:** c47a86c (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - TypeScript compilation bug)
**Impact on plan:** Single minimal fix required for compilation. No scope creep.

## Issues Encountered

None beyond the TypeScript export issue documented above.

## Known Stubs

None — plan establishes backend API modules only. No UI stubs or placeholder data.

## Next Phase Readiness

- All backend endpoints for Phase 2 are complete: projects, members, tasks, sprints, bugs, dashboard
- 46 tests passing, zero TypeScript errors
- Frontend Phase 2 work (plans 04-08) can now consume all API endpoints
- Dashboard burndown note: frontend should display a disclaimer about POC approximation for burndown accuracy

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| apps/api/src/sprints/sprints.service.ts | FOUND |
| apps/api/src/sprints/sprints.controller.ts | FOUND |
| apps/api/src/sprints/sprints.service.spec.ts | FOUND |
| apps/api/src/bugs/bugs.service.ts | FOUND |
| apps/api/src/bugs/bugs.controller.ts | FOUND |
| apps/api/src/dashboard/dashboard.service.ts | FOUND |
| apps/api/src/dashboard/dashboard.controller.ts | FOUND |
| Commit 73b0477 (Task 1) | FOUND |
| Commit c47a86c (Task 2) | FOUND |
| sprints.service.ts contains `async activate(` | FOUND |
| sprints.service.ts contains `async closeSprint(` | FOUND |
| sprints.service.ts contains `$transaction` | FOUND |
| dashboard.service.ts contains `async getProjectDashboard(` | FOUND |
| app.module.ts contains SprintsModule | FOUND |
| app.module.ts contains BugsModule | FOUND |
| app.module.ts contains DashboardModule | FOUND |
| 46 tests passing, tsc --noEmit exits 0 | CONFIRMED |

---
*Phase: 02-project-task-management*
*Completed: 2026-04-05*
