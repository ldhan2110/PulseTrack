# Proposal: update-task-workflow-defaults

## Why
New projects seed a default TASK workflow of `Backlog · In Progress · In Review · Done · Blocked`. We want new projects to start with the richer intended lifecycle instead: **Received · Assigned · In Progress · Review · Done · On Hold · Rejected · Canceled**.

## What it delivers
When a project is created, its default TASK workflow seeds these 8 statuses (with sensible colors, one default start, three closed/terminal states) and a transition graph that walks the linear happy path plus on-hold / reject / cancel escapes.

## Scope

**In**
- Rewrite `DEFAULT_STATUSES` and `DEFAULT_TRANSITIONS` in `apps/api/src/workflow/workflow.service.ts` (the constants `seedDefaultWorkflow` consumes).
- Unit test proving `seedDefaultWorkflow` produces the new set.

**Out**
- Bug workflow (`DEFAULT_BUG_STATUSES` / `seedDefaultBugWorkflow`) — untouched.
- Existing projects — the seed is guarded (`if existing > 0 return`), so already-created projects keep their current workflow. No backfill/migration.
- Frontend — statuses render dynamically from API data; no UI code changes.
