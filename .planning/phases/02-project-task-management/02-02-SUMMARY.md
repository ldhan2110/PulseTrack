---
phase: 02-project-task-management
plan: 02
subsystem: backend-api
tags: [nestjs, tasks, sub-tasks, crud, rbac, unit-tests]
dependency_graph:
  requires: ["02-01"]
  provides:
    - tasks-module
    - task-crud-api
    - subtask-crud-api
    - task-status-workflow
  affects:
    - Phase 3 (comments and time logs reference Task model)
    - Phase 4 (WebSocket events will emit on task updates)
    - Phase 5 (AI task assignment reads/updates Task model)
    - Phase 6 (Blueprint sync targets Task entities)
tech_stack:
  added:
    - "TasksModule (NestJS) with RBAC guards — nested route under projects/:projectId"
  patterns:
    - "Nested controller pattern: @Controller('projects/:projectId/tasks') shares ProjectRolesGuard at class level"
    - "Direct service instantiation in spec (new TasksService(mockPrisma as any)) — consistent with Phase 2 established pattern"
    - "Partial update via spread conditionals — only defined DTO fields propagate to Prisma update data"
key_files:
  created:
    - apps/api/src/tasks/tasks.module.ts
    - apps/api/src/tasks/tasks.controller.ts
    - apps/api/src/tasks/tasks.service.ts
    - apps/api/src/tasks/tasks.service.spec.ts
    - apps/api/src/tasks/dto/create-task.dto.ts
    - apps/api/src/tasks/dto/update-task.dto.ts
    - apps/api/src/tasks/dto/create-subtask.dto.ts
  modified:
    - apps/api/src/app.module.ts (TasksModule added to imports)
decisions:
  - "Free status transitions with no state machine validation (per D-12) — any TaskStatus to any TaskStatus allowed in update()"
  - "PATCH /:taskId open to developer role for POC — fine-grained 'only assigned developer' check deferred (per D-34)"
  - "SubTask delete restricted to pm/ba only — developers cannot delete sub-tasks they don't own (per D-34)"
metrics:
  duration_minutes: 4
  completed_date: "2026-04-05"
  tasks_completed: 1
  files_created: 7
  files_modified: 1
requirements:
  - TASK-01
  - TASK-02
  - TASK-03
  - TASK-04
  - TASK-05
---

# Phase 02 Plan 02: Tasks Module Backend Summary

TasksModule with full CRUD for tasks and sub-tasks — nested under projects/:projectId, ProjectRolesGuard at class level, free status transitions, and 9 unit tests using the established direct-instantiation pattern.

## Tasks Completed

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 | TasksModule: service, controller, DTOs, unit tests, AppModule registration | d7e730d | Complete |

## What Was Built

### DTOs

- **`CreateTaskDto`** — `title` (3-200 chars required), optional: `description` (5000), `status` (TaskStatus enum), `assigneeId`, `storyPoints` (1-100 int), `sprintId`, `acceptanceCriteria` (5000)
- **`UpdateTaskDto`** — all fields optional; `assigneeId` and `sprintId` accept `string | null` to support clearing
- **`CreateSubTaskDto`** — `title` (1-200 required), optional: `status` (TaskStatus enum), `assigneeId`

### TasksService

- **`create(projectId, creatorId, dto)`** — creates task with full Prisma include (assignee select: id/username/email, sprint select: id/name)
- **`findAll(projectId)`** — project-scoped list ordered by `createdAt desc` with assignee, sprint, `_count.subTasks`
- **`findOne(taskId)`** — full detail including creator, all subTasks with their assignees
- **`update(taskId, dto)`** — partial update using spread conditionals — only defined fields written; free status transitions (D-12)
- **`delete(taskId)`** — hard delete; SubTasks cascade via Prisma schema `onDelete: Cascade`
- **`createSubTask(taskId, dto)`** — creates SubTask with parentId + assignee include
- **`updateSubTask(subTaskId, dto)`** — partial update for title/status/assigneeId
- **`deleteSubTask(subTaskId)`** — hard delete sub-task

### TasksController

- `@Controller('projects/:projectId/tasks')` — routes nested under project
- `@UseGuards(JwtAuthGuard, ProjectRolesGuard)` — class-level; ProjectRolesGuard reads `request.params.projectId`
- `GET /` — any project member
- `POST /` — `@ProjectRoles('pm', 'ba')` (D-31, D-32)
- `GET /:taskId` — any project member
- `PATCH /:taskId` — `@ProjectRoles('pm', 'ba', 'developer')` (D-34)
- `DELETE /:taskId` — `@ProjectRoles('pm')` only (D-31)
- `POST /:taskId/subtasks` — `@ProjectRoles('pm', 'ba', 'developer')`
- `PATCH /:taskId/subtasks/:subTaskId` — `@ProjectRoles('pm', 'ba', 'developer')`
- `DELETE /:taskId/subtasks/:subTaskId` — `@ProjectRoles('pm', 'ba')`

### Unit Tests (9 tests, all passing)

- `create()` — creates task with correct projectId/creatorId, returns with relations
- `update()` — status transition BACKLOG → IN_PROGRESS
- `update()` — sets assigneeId
- `update()` — clears assigneeId to null
- `update()` — sets storyPoints and acceptanceCriteria
- `delete()` — removes task by id
- `createSubTask()` — creates sub-task linked to parent
- `updateSubTask()` — updates sub-task status
- `deleteSubTask()` — removes sub-task by id

## Verification Results

- `pnpm --filter @pm/api exec tsc --noEmit`: 0 errors
- `pnpm --filter @pm/api test --run`: 29 tests across 6 files — all passed (9 new + 20 carried over)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — backend API only. No UI stubs or placeholder data.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| apps/api/src/tasks/tasks.controller.ts contains `@Controller('projects/:projectId/tasks')` | FOUND |
| apps/api/src/tasks/tasks.service.ts contains `async create(` | FOUND |
| apps/api/src/tasks/tasks.service.ts contains `async findAll(` | FOUND |
| apps/api/src/tasks/tasks.service.ts contains `async update(` | FOUND |
| apps/api/src/tasks/tasks.service.ts contains `async delete(` | FOUND |
| apps/api/src/tasks/tasks.service.ts contains `async createSubTask(` | FOUND |
| apps/api/src/tasks/dto/create-task.dto.ts contains `@IsString()` and `title: string` | FOUND |
| apps/api/src/tasks/dto/create-subtask.dto.ts contains `title: string` | FOUND |
| apps/api/src/app.module.ts contains `TasksModule` | FOUND |
| tasks.service.spec.ts contains 9 `it(` blocks | FOUND (9 tests) |
| `pnpm --filter @pm/api test --run` exits 0 | CONFIRMED (29 tests passed) |
| `tsc --noEmit` exits 0 | CONFIRMED |
| Commit d7e730d | FOUND |
