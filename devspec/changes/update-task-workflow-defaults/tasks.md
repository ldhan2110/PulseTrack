# Tasks: update-task-workflow-defaults

## 1. Rewrite default status + transition constants [req-1] [req-2]
- [x] 1.1 [backend] Replace `DEFAULT_STATUSES` (lines 5–11) in `apps/api/src/workflow/workflow.service.ts` with the 8 statuses: `RECEIVED`(Received,#6b7280,pos0,isDefault:true,isClosed:false), `ASSIGNED`(Assigned,#8b5cf6,pos1), `IN_PROGRESS`(In Progress,#3b82f6,pos2), `REVIEW`(Review,#f59e0b,pos3), `DONE`(Done,#22c55e,pos4,isClosed:true), `ON_HOLD`(On Hold,#eab308,pos5), `REJECTED`(Rejected,#ef4444,pos6,isClosed:true), `CANCELED`(Canceled,#64748b,pos7,isClosed:true) — all non-listed flags `false`
- [x] 1.2 [backend] Replace `DEFAULT_TRANSITIONS` (lines 13–27) with: `RECEIVED→ASSIGNED`, `ASSIGNED→IN_PROGRESS`, `IN_PROGRESS→REVIEW`, `REVIEW→DONE`, `REVIEW→IN_PROGRESS`; `ASSIGNED↔ON_HOLD`, `IN_PROGRESS↔ON_HOLD`, `REVIEW↔ON_HOLD` (both directions each); `ASSIGNED→REJECTED`, `IN_PROGRESS→REJECTED`, `REVIEW→REJECTED`; `RECEIVED→CANCELED`, `ASSIGNED→CANCELED`, `IN_PROGRESS→CANCELED`, `REVIEW→CANCELED`
Verify: `pnpm --filter @pm/api build`

## 2. Test the seed [req-1] [req-2] [req-3]
- [x] 2.1 [test] Add `apps/api/src/workflow/workflow.service.spec.ts` — mock/stub Prisma, call `seedDefaultWorkflow`, assert 8 statuses with correct keys/positions/isDefault/isClosed, assert the transition edge set, and assert the `existing > 0` guard returns early without writes
Verify: `pnpm --filter @pm/api test workflow.service`
