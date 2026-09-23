# Spec: update-task-workflow-defaults

### Requirement: default TASK statuses [req-1]
When a new project is created, `seedDefaultWorkflow` SHALL seed exactly these 8 TASK statuses, in order, with the specified colors, one default and three closed.

#### Scenario: statuses seeded
- **WHEN** `seedDefaultWorkflow(projectId)` runs for a project with no TASK statuses
- **THEN** 8 `workflowStatus` rows (kind `TASK`) exist with keys `RECEIVED, ASSIGNED, IN_PROGRESS, REVIEW, DONE, ON_HOLD, REJECTED, CANCELED` at positions 0–7
- **AND** `RECEIVED` is the only row with `isDefault: true`
- **AND** `DONE`, `REJECTED`, `CANCELED` are the rows with `isClosed: true`

### Requirement: default TASK transitions [req-2]
The seed SHALL create the transition graph: linear `RECEIVED→ASSIGNED→IN_PROGRESS→REVIEW→DONE`, `REVIEW→IN_PROGRESS` back, `ON_HOLD` in/out of each active status (ASSIGNED, IN_PROGRESS, REVIEW), `REJECTED` from each active status, and `CANCELED` from RECEIVED plus each active status.

#### Scenario: transitions seeded
- **WHEN** `seedDefaultWorkflow(projectId)` runs
- **THEN** `workflowTransition` rows exist for each listed edge and no others

### Requirement: existing projects unaffected [req-3]
The change SHALL NOT alter workflows of projects that already have TASK statuses.

#### Scenario: guard holds
- **WHEN** `seedDefaultWorkflow(projectId)` runs for a project that already has ≥1 TASK status
- **THEN** it returns without creating or modifying any status or transition
