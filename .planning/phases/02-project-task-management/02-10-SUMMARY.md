---
phase: 02-project-task-management
plan: 10
subsystem: ui
tags: [react, tanstack-query, typescript, acceptance-criteria, json]

# Dependency graph
requires:
  - phase: 02-project-task-management
    provides: Task model with acceptanceCriteria String? field and PATCH /tasks/:taskId endpoint
provides:
  - Working acceptance criteria CRUD in TaskDetailPage persisted via existing task update endpoint
  - parseAcceptanceCriteria() and serializeAcceptanceCriteria() helpers for JSON string management
  - Task.acceptanceCriteria typed as string | null to match backend response
  - UpdateTaskPayload with acceptanceCriteria field for PATCH endpoint
affects: [sprint-board, backlog-page, task-detail]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-side JSON string management: parse on read, serialize on write via task PATCH"
    - "crypto.randomUUID() for client-generated IDs without uuid dependency"
    - "Legacy data migration: parse-time newline-delimited string to structured array"

key-files:
  created: []
  modified:
    - apps/web/src/lib/types.ts
    - apps/web/src/pages/TaskDetailPage.tsx

key-decisions:
  - "Path B chosen for AC storage: JSON string in task.acceptanceCriteria field via PATCH, not dedicated AC endpoints"
  - "parseAcceptanceCriteria() handles legacy plain-string values by splitting on newlines"
  - "crypto.randomUUID() used for new AC IDs — no extra dependency needed"

patterns-established:
  - "JSON-in-string field pattern: parse on read from API response, stringify before PATCH payload"

requirements-completed:
  - TASK-01
  - TASK-02
  - TASK-03
  - TASK-04
  - TASK-05
  - SPRT-01
  - SPRT-02

# Metrics
duration: 3min
completed: 2026-04-05
---

# Phase 02 Plan 10: Gap Closure — Acceptance Criteria Persistence Summary

**Acceptance criteria CRUD wired to existing PATCH /tasks/:taskId via JSON string serialization, eliminating 404s from non-existent /acceptance-criteria endpoints**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-05T13:33:57Z
- **Completed:** 2026-04-05T13:36:48Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Task.acceptanceCriteria now typed as `string | null` matching the backend Prisma schema (was incorrectly typed as `AcceptanceCriteria[]`)
- UpdateTaskPayload now includes `acceptanceCriteria?: string` so the PATCH endpoint receives the field
- All four AC operations (add, toggle, delete, edit text) now persist via `updateTask.mutate` with JSON-serialized array
- Legacy plain-string acceptanceCriteria values handled gracefully by converting to array format at parse time
- All 55 tests pass, TypeScript compiles with no errors, production build succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Add acceptanceCriteria to UpdateTaskPayload and update Task type** - `69c00ee` (feat)
2. **Task 2: Rewrite TaskDetailPage acceptance criteria to use client-side JSON + task update mutation** - `4cca807` (fix)

**Plan metadata:** (docs commit — next)

## Files Created/Modified
- `apps/web/src/lib/types.ts` - Task.acceptanceCriteria changed to `string | null`, acceptanceCriteria added to UpdateTaskPayload
- `apps/web/src/pages/TaskDetailPage.tsx` - AC functions rewritten to use updateTask.mutate; parseAcceptanceCriteria/serializeAcceptanceCriteria helpers added

## Decisions Made
- Used JSON.stringify/parse for AC storage rather than introducing a separate field or migration — matches the existing backend String? field constraint exactly
- crypto.randomUUID() for new AC item IDs to avoid adding a uuid dependency
- Legacy string values (non-JSON) handled by split('\n') fallback in parseAcceptanceCriteria()

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Acceptance criteria feature is now fully functional end-to-end
- All Phase 2 gap closure plans (02-08 through 02-10) are complete
- Phase 2 verification can proceed

---
*Phase: 02-project-task-management*
*Completed: 2026-04-05*
