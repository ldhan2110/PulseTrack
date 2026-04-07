# Configurable Workflow Status System

## Summary

Replace the hardcoded `TaskStatus` enum with a per-project configurable workflow system. Each project gets its own set of statuses, transitions between them, and per-status assignee restrictions. PMs configure the workflow visually using a React Flow-based drag-and-drop editor inside the project settings page.

## Requirements

1. **Per-project custom statuses** — each project defines its own statuses (name, color, ordering)
2. **Configurable transitions** — visual drag-and-drop editor (React Flow) where statuses are nodes and allowed transitions are arrows between them
3. **Per-status assignee restrictions** — for any status, the PM can define a set of allowed assignees; if not defined, any project member can be assigned
4. **PM-only configuration** — only users with the PM role can edit the workflow
5. **Default workflow** — new projects auto-seeded with: Backlog → In Progress → In Review → Done + Blocked (with transitions)
6. **Hard delete** — removed statuses are deleted; affected tasks get `workflowStatusId = null` and are flagged in the UI for reassignment
7. **Blocked is a regular status** — no special treatment, just another node
8. **Simple arrows** — no labels or conditions on transitions

## Architecture: Hybrid Relational + JSONB

Relational tables for statuses, transitions, and assignee rules (business logic with referential integrity). JSONB column on Project for React Flow layout data (node positions, viewport — UI-only).

## Data Model

### New Models

```prisma
model WorkflowStatus {
  id        String   @id @default(cuid())
  projectId String
  name      String   // Display name, e.g. "In Review"
  key       String   // Slug, e.g. "IN_REVIEW" — unique per project
  color     String   // Hex color for badges and kanban columns
  position  Int      // Ordering in kanban board (left to right)
  isDefault Boolean  @default(false) // Status for new tasks (exactly one per project)
  isClosed  Boolean  @default(false) // Marks "done" statuses for burndown/dashboard
  createdAt DateTime @default(now())

  project             Project              @relation(fields: [projectId], references: [id], onDelete: Cascade)
  transitionsFrom     WorkflowTransition[] @relation("TransitionFrom")
  transitionsTo       WorkflowTransition[] @relation("TransitionTo")
  assigneeRules       StatusAssigneeRule[]
  tasks               Task[]
  subTasks            SubTask[]

  @@unique([projectId, key])
}

model WorkflowTransition {
  id           String @id @default(cuid())
  projectId    String
  fromStatusId String
  toStatusId   String

  project    Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  fromStatus WorkflowStatus @relation("TransitionFrom", fields: [fromStatusId], references: [id], onDelete: Cascade)
  toStatus   WorkflowStatus @relation("TransitionTo", fields: [toStatusId], references: [id], onDelete: Cascade)

  @@unique([fromStatusId, toStatusId])
}

model StatusAssigneeRule {
  id       String @id @default(cuid())
  statusId String
  memberId String

  status WorkflowStatus @relation(fields: [statusId], references: [id], onDelete: Cascade)
  member ProjectMember  @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@unique([statusId, memberId])
}
```

### Changes to Existing Models

**Project** — add:
```prisma
workflowLayout     Json?               // React Flow node positions & viewport
workflowStatuses   WorkflowStatus[]
workflowTransitions WorkflowTransition[]
```

**Task** — change:
```prisma
// Remove: status TaskStatus @default(BACKLOG)
// Add:
workflowStatusId String?
workflowStatus   WorkflowStatus? @relation(fields: [workflowStatusId], references: [id], onDelete: SetNull)
```

**SubTask** — same change:
```prisma
// Remove: status TaskStatus @default(BACKLOG)
// Add:
workflowStatusId String?
workflowStatus   WorkflowStatus? @relation(fields: [workflowStatusId], references: [id], onDelete: SetNull)
```

**ProjectMember** — add:
```prisma
assigneeRules StatusAssigneeRule[]
```

**Remove:** `TaskStatus` enum from schema after migration.

### TaskHistory

Already stores `oldValue`/`newValue` as strings — no schema change needed. Status changes will store the status name (e.g. "In Review") for readability even after deletion.

## Migration Strategy

1. Create new tables (`WorkflowStatus`, `WorkflowTransition`, `StatusAssigneeRule`) and add `workflowLayout` to `Project`
2. Add `workflowStatusId` as nullable to `Task` and `SubTask`
3. Run data migration for each existing project:
   - Create 5 `WorkflowStatus` rows matching current enum values:
     - BACKLOG: color `#6b7280`, position 0, isDefault true
     - IN_PROGRESS: color `#3b82f6`, position 1
     - IN_REVIEW: color `#f59e0b`, position 2
     - DONE: color `#22c55e`, position 3, isClosed true
     - BLOCKED: color `#ef4444`, position 4
   - Create default transitions: BACKLOG↔IN_PROGRESS, IN_PROGRESS↔IN_REVIEW, IN_REVIEW↔DONE, any↔BLOCKED
   - Set `workflowStatusId` on all existing tasks/subtasks by matching `status` enum to the new rows
4. Make `workflowStatusId` the source of truth, drop the old `status` column
5. Remove `TaskStatus` enum from schema

## Backend API

### New Endpoints

All under `/projects/:projectId/workflow`, guarded by PM role:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/workflow` | Returns all statuses, transitions, assignee rules, and layout for the project |
| `PUT` | `/workflow` | Bulk save: statuses, transitions, assignee rules, layout in a single transaction |
| `GET` | `/workflow/statuses/:statusId/allowed-assignees` | Returns members allowed for a status (all members if no rules defined) |

### PUT /workflow Request Body

```typescript
{
  statuses: {
    id?: string;          // existing status ID (omit for new)
    name: string;
    key: string;
    color: string;
    position: number;
    isDefault: boolean;
    isClosed: boolean;
  }[];
  transitions: {
    fromStatusKey: string;  // reference by key within payload
    toStatusKey: string;
  }[];
  assigneeRules: {
    statusKey: string;
    memberIds: string[];
  }[];
  layout: object;           // React Flow node positions & viewport
}
```

### PUT /workflow Validation

- At least one status required
- Exactly one `isDefault: true` status
- At least one `isClosed: true` status (needed for burndown/dashboard)
- No duplicate keys within the project
- Transition `fromStatusKey`/`toStatusKey` must reference statuses in the payload
- Assignee rule `memberIds` must be valid project members

### PUT /workflow Transaction Logic

1. Identify removed statuses (existing IDs not in payload)
2. Set `workflowStatusId = null` on tasks/subtasks with removed statuses
3. Delete all existing statuses, transitions, and rules for the project
4. Create new statuses, transitions, and rules from payload
5. Save layout to `Project.workflowLayout`

### Changes to Existing Endpoints

**POST /tasks** — uses the project's default status (`isDefault: true`) instead of hardcoded `BACKLOG`

**PATCH /tasks/:taskId** — when `workflowStatusId` changes:
1. Validate the transition exists (from current → new)
2. If invalid transition, return 400 with allowed transitions
3. If new status has assignee rules and current assignee is not in the set, return 409 with `allowedAssignees` list so frontend can prompt

**GET /tasks** — include `workflowStatus` object (id, name, key, color, isClosed) in response

**Dashboard service** — use `isClosed` flag instead of `=== 'DONE'` for burndown and completed task calculations. Task counts become dynamic (iterate over project's workflow statuses instead of hardcoded switch).

## Frontend

### Project Settings Page — Tabbed Layout

`ProjectSettingsPage.tsx` gets a `Tabs` component (shadcn/ui):
- **Tab: General** — existing content (avatar, prefix, name, description)
- **Tab: Workflow** — React Flow editor (only visible for PM role)

URL stays `/projects/:prefix/settings` with optional `?tab=workflow` for deep-linking.

### Workflow Editor (New Component)

`components/workflow/WorkflowEditor.tsx`

- React Flow canvas with custom nodes and edges
- Each status is a custom node showing: name, color swatch, isDefault badge, isClosed badge
- Transitions are edges (arrows) between nodes — simple, no labels
- PM actions:
  - **Add status** — button opens form (name, color picker, isClosed toggle)
  - **Edit status** — click node to edit name/color/isClosed/isDefault
  - **Delete status** — confirm dialog if tasks exist ("X tasks will become unassigned")
  - **Draw transitions** — drag from node handle to another node
  - **Remove transitions** — click edge, press delete/backspace
  - **Drag nodes** — rearrange layout (saved in `Project.workflowLayout`)
- **Assignee rules** — clicking a node opens a side panel to select allowed members (multi-select, empty = anyone)
- **Save button** — sends full graph as PUT `/workflow`
- **Non-PM users** — see a read-only view of the workflow graph (no editing controls)

### Custom Node Component

`components/workflow/StatusNode.tsx`

- Displays status name, color bar on top
- Badges for "Default" and "Closed" flags
- Source/target handles for drawing connections
- Edit/delete buttons on hover (PM only)

### Assignee Rule Panel

`components/workflow/AssigneeRulePanel.tsx`

- Slides in from the right when a node is selected
- Multi-select list of project members with checkboxes
- "No restrictions" when empty
- Shows member name, role, and avatar

### Changes to Existing Frontend Components

| Component | Change |
|-----------|--------|
| `KanbanBoard.tsx` | Columns driven by `WorkflowStatus[]` from API (ordered by `position`), not hardcoded `TASK_STATUSES` array. Drop handler validates transition exists. |
| `KanbanColumn.tsx` | Color from status object instead of CSS variables. Invalid drop target visually greyed out. |
| `StatusBadge.tsx` | Takes `{ name, color }` object instead of enum. Renders dynamically with the configured color. |
| `TaskDetailPage.tsx` | Status dropdown shows only statuses reachable via valid transitions from current status. Assignee dropdown filtered by rules when status changes. Shows warning for orphaned tasks (null status). |
| `MyTasksBoard.tsx` | Columns grouped by `isClosed` flag instead of hardcoded status names. Two groups: "Active" (isClosed=false) and "Done" (isClosed=true). |
| `types.ts` | Remove `TaskStatus` union type. Add `WorkflowStatus` interface. Update `Task`/`SubTask` to use `workflowStatus` object. Update `TaskCounts` to be dynamic. |
| `useTasks.ts` | Update mutation payloads (`workflowStatusId` instead of `status`). Handle 409 assignee conflict response. |
| **New:** `hooks/useWorkflow.ts` | `useWorkflow(projectId)` — fetch workflow. `useSaveWorkflow(projectId)` — PUT. `useAllowedAssignees(statusId)` — fetch allowed members. |

### Dashboard Changes

`TaskCounts` becomes dynamic:
```typescript
// Before
interface TaskCounts { total: number; backlog: number; inProgress: number; inReview: number; done: number; blocked: number; }

// After
interface TaskCounts { total: number; byStatus: { statusId: string; name: string; color: string; count: number; isClosed: boolean; }[]; }
```

Dashboard cards iterate over `byStatus` array instead of accessing hardcoded fields.

## Default Workflow Seed

When a new project is created, auto-seed this workflow:

```
Statuses:
  BACKLOG      — color: #6b7280, position: 0, isDefault: true
  IN_PROGRESS  — color: #3b82f6, position: 1
  IN_REVIEW    — color: #f59e0b, position: 2
  DONE         — color: #22c55e, position: 3, isClosed: true
  BLOCKED      — color: #ef4444, position: 4

Transitions:
  BACKLOG → IN_PROGRESS
  IN_PROGRESS → BACKLOG
  IN_PROGRESS → IN_REVIEW
  IN_REVIEW → IN_PROGRESS
  IN_REVIEW → DONE
  DONE → IN_REVIEW
  BACKLOG → BLOCKED
  IN_PROGRESS → BLOCKED
  IN_REVIEW → BLOCKED
  DONE → BLOCKED
  BLOCKED → BACKLOG
  BLOCKED → IN_PROGRESS
  BLOCKED → IN_REVIEW

Assignee Rules: none (all members allowed for all statuses)

Layout: auto-generated horizontal arrangement
```

## Edge Cases

| Scenario | Handling |
|----------|----------|
| PM deletes a status with tasks | Tasks set to `workflowStatusId = null`, UI shows warning badge, PM must reassign |
| Drag-drop to invalid transition on kanban | Drop rejected silently, column stays greyed out during drag |
| Status has assignee rules, current assignee not in set | Frontend prompts user to pick from allowed list before saving status change |
| New project created | Auto-seeded with default 5-status workflow + transitions |
| SubTask status | Follows same project workflow as parent task |
| TaskHistory for deleted status | Old value stored as status name string — readable after deletion |
| PM removes all assignee rules from a status | No restriction applied, all members available |
| Task with null workflowStatusId | Shown with "No Status" warning badge, filterable in task list, PM prompted to assign |
| Member removed from project who is in assignee rules | `onDelete: Cascade` on StatusAssigneeRule removes the rule automatically |
| Concurrent workflow edit | Last-write-wins (PUT replaces all). Acceptable for PM-only single-editor use case. |
