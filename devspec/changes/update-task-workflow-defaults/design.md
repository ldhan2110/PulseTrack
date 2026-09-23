# Design: update-task-workflow-defaults

## Chosen approach
Edit the two module-level constants in `apps/api/src/workflow/workflow.service.ts`. `seedDefaultWorkflow(projectId)` already iterates `DEFAULT_STATUSES` to create `workflowStatus` rows and `DEFAULT_TRANSITIONS` to create `workflowTransition` rows inside one `$transaction`. Changing the constants changes what new projects seed — no code-flow change.

### Status set

| key | name | color | position | isDefault | isClosed |
|-----|------|-------|----------|-----------|----------|
| RECEIVED | Received | `#6b7280` | 0 | true | false |
| ASSIGNED | Assigned | `#8b5cf6` | 1 | false | false |
| IN_PROGRESS | In Progress | `#3b82f6` | 2 | false | false |
| REVIEW | Review | `#f59e0b` | 3 | false | false |
| DONE | Done | `#22c55e` | 4 | false | true |
| ON_HOLD | On Hold | `#eab308` | 5 | false | false |
| REJECTED | Rejected | `#ef4444` | 6 | false | true |
| CANCELED | Canceled | `#64748b` | 7 | false | true |

Exactly one `isDefault` (RECEIVED); three `isClosed` (DONE, REJECTED, CANCELED) — matches the invariant `saveWorkflow` enforces (1 default, ≥1 closed).

### Transitions
```
RECEIVED    → ASSIGNED
ASSIGNED    → IN_PROGRESS
IN_PROGRESS → REVIEW
REVIEW      → DONE
REVIEW      → IN_PROGRESS          (send back)

ASSIGNED    ⇄ ON_HOLD
IN_PROGRESS ⇄ ON_HOLD
REVIEW      ⇄ ON_HOLD

ASSIGNED    → REJECTED
IN_PROGRESS → REJECTED
REVIEW      → REJECTED

RECEIVED    → CANCELED
ASSIGNED    → CANCELED
IN_PROGRESS → CANCELED
REVIEW      → CANCELED
```

### Rejected approaches
- **Backfill existing projects** — rejected. The seed guard intentionally leaves existing workflows alone; users may have customized them. Out of scope.
- **DB migration / seed script** — unnecessary. Seeding happens in app code at project-create time, not in the schema.

## Architecture
```
POST /projects → ProjectsService.create
                   ├─ WorkflowService.seedDefaultWorkflow(id)   ← reads DEFAULT_STATUSES / DEFAULT_TRANSITIONS  (THIS CHANGE)
                   │     └─ tx: create workflowStatus[] + workflowTransition[]  (kind: TASK)
                   └─ WorkflowService.seedDefaultBugWorkflow(id) (unchanged)
```

## Impact Area

### Decision Defaults
| Gray area | Default |
|-----------|---------|
| Status keys | Uppercase snake as listed (RECEIVED, ON_HOLD, …) |
| Which is default start | RECEIVED |
| Which are closed/terminal | DONE, REJECTED, CANCELED |
| Colors | Reuse existing palette; new for ASSIGNED (violet), ON_HOLD (yellow), CANCELED (slate) |
| Transition strictness | Linear happy path + on-hold/reject/cancel escapes (not free any→any) |
| Existing projects | Not touched — no backfill |
| Bug workflow | Not touched |

### Blast Radius
- `apps/api/src/workflow/workflow.service.ts` — the two constants only.
- Consumers of the seed: `ProjectsService.create` (calls `seedDefaultWorkflow`) — behavior unchanged, only the seeded data differs.
- Frontend workflow board / task status dropdowns render from `GET /workflow` data — no code change, they show whatever is seeded.

### Risk tags
- **Reversibility**: high — revert the constant edit; new projects re-seed old set. Already-seeded projects unaffected either way.
- **Risk**: low — data-only change to a guarded seed, no schema/API/contract change.
