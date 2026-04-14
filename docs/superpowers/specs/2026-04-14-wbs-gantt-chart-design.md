# WBS (Work Breakdown Structure) with Gantt Chart

## Overview

Add a WBS module to PulseTrack's Project Planner section. The WBS page provides a three-level hierarchical task breakdown (Phase → Task → Subtask) with an interactive Gantt chart for visualizing schedules, tracking planned vs actual dates, and monitoring progress. It operates as a fully independent module — no dependency on the Planner or Scope Definition features.

## Architecture

**Approach:** Standalone NestJS module (`WbsModule`) with its own Prisma models, controller, service, and frontend components. Completely decoupled from the existing Planner module.

**Tech stack additions:**
- `gantt-task-react` — React Gantt chart component (~15KB gzipped, MIT license). Supports drag-to-resize, drag-to-move, dependency arrows, collapsible groups, and progress bars.

## Navigation Changes

The sidebar item "Project Planner" becomes a collapsible group with two children:

```
📋 Project Planner        ▼
   ├── Scope Definition     → /projects/:prefix/planner
   └── WBS                  → /projects/:prefix/wbs
```

All other sidebar items remain unchanged. The `PROJECT_NAV_ITEMS` array in `AppSidebar.tsx` is updated to support nested children.

## Data Model

### WbsPhase (Level 0)

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| projectId | String | FK → Project |
| title | String | Phase name |
| description | String? | Optional description |
| position | Int | Sort order within project |
| planStart | DateTime? | Auto-rolled: `MIN(tasks.planStart)` |
| planEnd | DateTime? | Auto-rolled: `MAX(tasks.planEnd)` |
| actualStart | DateTime? | Auto-rolled: `MIN(tasks.actualStart)` |
| actualEnd | DateTime? | Auto-rolled: `MAX(tasks.actualEnd)` — only when all tasks complete |
| progress | Float | Auto-rolled: `AVG(tasks.progress)` |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### WbsTask (Level 1)

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| phaseId | String | FK → WbsPhase |
| title | String | Task name |
| description | String? | Optional description |
| position | Int | Sort order within phase |
| planStart | DateTime? | Auto-rolled if has subtasks, manual if leaf |
| planEnd | DateTime? | Auto-rolled if has subtasks, manual if leaf |
| actualStart | DateTime? | Auto-rolled if has subtasks, manual if leaf |
| actualEnd | DateTime? | Auto-rolled if has subtasks, manual if leaf |
| progress | Float | Auto-rolled if has subtasks, manual if leaf (0-100) |
| backlogItemId | String? | FK → Task (backlog). ONLY allowed when task is a leaf (no subtasks) |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### WbsSubtask (Level 2)

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| taskId | String | FK → WbsTask |
| title | String | Subtask name |
| description | String? | Optional description |
| position | Int | Sort order within task |
| planStart | DateTime? | Manual entry |
| planEnd | DateTime? | Manual entry |
| actualStart | DateTime? | Manual entry |
| actualEnd | DateTime? | Manual entry |
| progress | Float | Manual entry (0-100) |
| backlogItemId | String? | FK → Task (backlog). Optional link for progress sync |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### WbsDependency

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| projectId | String | FK → Project |
| sourceId | String | ID of source task or subtask |
| sourceType | Enum (TASK, SUBTASK) | Which table sourceId references |
| targetId | String | ID of target task or subtask |
| targetType | Enum (TASK, SUBTASK) | Which table targetId references |
| type | Enum | FINISH_TO_START (only type supported) |
| createdAt | DateTime | |

## Auto-Rollup Rules

Rollup is recalculated on every mutation to a child node (create, update, delete).

### Date Rollup (Phase from Tasks, Task from Subtasks)

| Parent Field | Formula |
|-------------|---------|
| planStart | `MIN(children.planStart)` |
| planEnd | `MAX(children.planEnd)` |
| actualStart | `MIN(children.actualStart)` where actualStart is not null |
| actualEnd | `MAX(children.actualEnd)` — only set when ALL children have actualEnd |

### Progress Rollup

| Parent Field | Formula |
|-------------|---------|
| progress | `AVG(children.progress)` — equally weighted |

### Rollup Cascade

When a subtask is updated:
1. Recalculate parent WbsTask (from all its subtasks)
2. Recalculate parent WbsPhase (from all its tasks)

This is done in a single database transaction.

## Backlog Linking Rules

- **Leaf-only linking:** Only leaf nodes (subtasks, or tasks with no subtasks) can link to a backlog item
- **Adding subtask to linked task:** When a subtask is added to a task that has a `backlogItemId`, the link is automatically removed from the task (with a warning to the user) since the task is no longer a leaf
- **Progress sync direction:** Backlog drives WBS. When a linked backlog item's `WorkflowStatus` changes, the WBS leaf node progress updates automatically. The mapping uses the status position in the project's workflow: `progress = (statusIndex / (totalStatuses - 1)) * 100`. For example, in a 4-status workflow (To Do → In Progress → Review → Done), statuses map to 0% → 33% → 67% → 100%. PM can override manually.
- **One-to-one:** Each backlog item can only be linked to one WBS node

## Gantt Chart Visualization

### Dual-Bar System

Each row displays two bars:
- **Top bar (dashed outline):** Planned schedule — always visible as baseline
- **Bottom bar (solid fill):** Actual progress — appears once work starts

### Bar Styles by Level

| Level | Bar Style |
|-------|-----------|
| Phase | Summary bar with diamond endpoints (purple). Shows rolled-up span |
| Task (with subtasks) | Summary bar with diamond endpoints. Color by schedule health |
| Task (leaf) | Regular solid bar. Draggable/resizable |
| Subtask | Regular solid bar (smallest). Draggable/resizable |

### Color Coding

Colors are computed by comparing planned vs actual dates:
- **Green:** On time or ahead of schedule
- **Amber:** Behind schedule (late start or progress below expected rate)
- **Red:** Overdue (past planned end date, not complete)
- **Gray:** Pending (not started, scheduled start in future)

### Interactivity

- Drag bars horizontally to reschedule (leaf nodes only)
- Resize bar edges to change duration (leaf nodes only)
- Click bar to open detail panel/dialog for editing
- Dependency arrows drawn between connected tasks/subtasks
- Today marker (red vertical line)
- Collapsible phases and tasks

### Table Columns (Left Panel)

| Column | Description |
|--------|-------------|
| Task Name | Hierarchical with indent + collapse toggle |
| Plan Start | Planned start date |
| Plan End | Planned end date |
| Actual Start | Actual start date |
| Actual End | Actual end date |
| Progress | Percentage (0-100%) |

Parent rows with auto-rolled values show a ⚡ indicator and are read-only for dates/progress.

### View Modes

- **Gantt Chart** (default): Split panel — tree table on left, Gantt bars on right
- **Table View**: Full-width table with all columns, inline editing

### Toolbar

- **Add Phase** — creates new phase at the bottom
- **View Options** — toggle timeline scale (days/weeks/months), show/hide columns
- **Status bar** (bottom) — phase/task/subtask counts, overall progress %

## API Endpoints

All endpoints require JWT authentication + ProjectRolesGuard.

### Phases

| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects/:projectId/wbs/phases` | List all phases with tasks and subtasks |
| POST | `/projects/:projectId/wbs/phases` | Create phase |
| PATCH | `/projects/:projectId/wbs/phases/:phaseId` | Update phase (title, description only) |
| DELETE | `/projects/:projectId/wbs/phases/:phaseId` | Delete phase and cascade |
| PATCH | `/projects/:projectId/wbs/phases/reorder` | Reorder phases |

### Tasks

| Method | Path | Description |
|--------|------|-------------|
| GET | `/wbs/phases/:phaseId/tasks` | List tasks in phase |
| POST | `/wbs/phases/:phaseId/tasks` | Create task |
| PATCH | `/wbs/phases/:phaseId/tasks/:taskId` | Update task (dates/progress only if leaf) |
| DELETE | `/wbs/phases/:phaseId/tasks/:taskId` | Delete task and cascade |
| PATCH | `/wbs/phases/:phaseId/tasks/reorder` | Reorder tasks |

### Subtasks

| Method | Path | Description |
|--------|------|-------------|
| POST | `/wbs/tasks/:taskId/subtasks` | Create subtask (triggers rollup) |
| PATCH | `/wbs/tasks/:taskId/subtasks/:subtaskId` | Update subtask (triggers rollup) |
| DELETE | `/wbs/tasks/:taskId/subtasks/:subtaskId` | Delete subtask (triggers rollup) |
| PATCH | `/wbs/tasks/:taskId/subtasks/reorder` | Reorder subtasks |

### Dependencies

| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects/:projectId/wbs/dependencies` | List all dependencies |
| POST | `/projects/:projectId/wbs/dependencies` | Create dependency (finish-to-start) |
| DELETE | `/projects/:projectId/wbs/dependencies/:depId` | Remove dependency |

### Backlog Linking (leaf nodes only)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/wbs/tasks/:taskId/link-backlog` | Link leaf task to backlog item |
| DELETE | `/wbs/tasks/:taskId/link-backlog` | Unlink task from backlog |
| POST | `/wbs/subtasks/:subtaskId/link-backlog` | Link subtask to backlog item |
| DELETE | `/wbs/subtasks/:subtaskId/link-backlog` | Unlink subtask from backlog |

API validates leaf-node constraint before allowing backlog linking. Returns 400 if task has subtasks.

## Frontend Components

### Pages

- `WbsPage.tsx` — Main page component. Full-width layout (like PlannerPage). Contains toolbar, view toggle, and the Gantt/table panels.

### Components (`apps/web/src/components/wbs/`)

| Component | Responsibility |
|-----------|----------------|
| `WbsToolbar.tsx` | Top toolbar: Add Phase, View Options |
| `WbsViewToggle.tsx` | Tab switch: Gantt Chart / Table View |
| `WbsTaskTree.tsx` | Left panel: hierarchical tree table with collapse/expand |
| `WbsGanttChart.tsx` | Right panel: gantt-task-react wrapper with dual-bar rendering |
| `WbsTaskRow.tsx` | Single row in the tree table (renders differently per level) |
| `WbsTaskDialog.tsx` | Dialog for creating/editing phase, task, or subtask |
| `WbsDependencyArrow.tsx` | Dependency line rendering configuration |
| `WbsBacklogLink.tsx` | Backlog linking UI — search and select backlog item |
| `WbsStatusBar.tsx` | Bottom bar: counts and overall progress |
| `WbsTableView.tsx` | Full-width table view (alternative to Gantt) |

### Hooks (`apps/web/src/hooks/`)

| Hook | Responsibility |
|------|----------------|
| `useWbsPhases.ts` | React Query hook for fetching phases with tasks/subtasks |
| `useWbsMutations.ts` | Mutation hooks for CRUD operations on phases/tasks/subtasks |
| `useWbsDependencies.ts` | React Query hooks for dependency CRUD |
| `useWbsBacklogSync.ts` | Hook for backlog linking and progress sync |

### State Management

- React Query for server state (phases, tasks, subtasks, dependencies)
- Local component state for UI concerns (collapsed nodes, selected task, view mode)
- Zustand `setFullWidth(true)` for full-width layout (same pattern as PlannerPage)

## Backend Structure

### New Module: `apps/api/src/wbs/`

| File | Responsibility |
|------|----------------|
| `wbs.module.ts` | Module definition, imports PrismaModule |
| `wbs.controller.ts` | REST endpoints for phases, tasks, subtasks |
| `wbs.service.ts` | Business logic, CRUD, rollup calculations |
| `wbs-dependency.controller.ts` | Dependency endpoints |
| `wbs-dependency.service.ts` | Dependency validation and CRUD |
| `wbs-backlog.controller.ts` | Backlog linking endpoints |
| `wbs-backlog.service.ts` | Leaf-node validation, backlog sync logic |
| `dto/` | Request validation DTOs |

### Rollup Service Logic

```
onSubtaskMutation(subtaskId):
  1. Load subtask → get taskId
  2. Load all subtasks for taskId
  3. Recalculate task: planStart, planEnd, actualStart, actualEnd, progress
  4. Load all tasks for task.phaseId
  5. Recalculate phase: planStart, planEnd, actualStart, actualEnd, progress
  6. Save task + phase in single transaction

onTaskMutation(taskId):
  1. Load task → get phaseId
  2. Load all tasks for phaseId
  3. Recalculate phase
  4. Save in transaction
```
