# Spec: sidebar-permission-gating

### Requirement: sidebar items gated by view permission [req-1]
The project sidebar SHALL render a nav item only when the current member's role
grants `view` on that item's mapped permission area.

#### Scenario: view granted
- **WHEN** the member's role has `bugs.view = true`
- **THEN** the "Bugs" sidebar item is visible

#### Scenario: view denied
- **WHEN** the member's role has `bugs.view = false`
- **THEN** the "Bugs" sidebar item is not rendered

#### Scenario: system role sees all
- **WHEN** the member's role `isSystem` is true
- **THEN** every project nav item is visible regardless of stored permissions

#### Scenario: fail closed while loading
- **WHEN** the member/role has not resolved yet (`can` returns false)
- **THEN** gated items are hidden rather than shown

### Requirement: correct nav-to-area mapping [req-2]
Each nav item SHALL be gated by the area defined in the design map (Dashboard→dashboard,
Backlog→tasks, Sprints→sprints, Test Cases→testCases, Test Executions→testExecutions,
Bugs→bugs, Reports→report, Members & Groups→members, Wiki→wiki, Settings→projectSettings,
Scope Definition→planner, WBS→wbs).

#### Scenario: backlog maps to tasks
- **WHEN** the role has `tasks.view = false`
- **THEN** the "Backlog" item is hidden

#### Scenario: item without a mapped area
- **WHEN** a nav item has no area assigned
- **THEN** it is always visible (not gated)

### Requirement: parent visible when any child is [req-3]
The "Project Planner" parent SHALL be visible when at least one of its children
(Scope Definition, WBS) is visible, and hidden when all children are hidden.

#### Scenario: one child viewable
- **WHEN** the role has `planner.view = false` and `wbs.view = true`
- **THEN** "Project Planner" is visible and shows only the "WBS" child

#### Scenario: no child viewable
- **WHEN** the role has both `planner.view = false` and `wbs.view = false`
- **THEN** "Project Planner" is not rendered at all

### Requirement: wiki permission area exists [req-4]
The system SHALL define a `wiki` permission area on both web and api so the Wiki
nav item is gate-able and appears in the roles permission grid.

#### Scenario: wiki area present in grid
- **WHEN** an admin opens Settings → Roles & Permissions and selects a role
- **THEN** a "Wiki" row with view/create/update/delete checkboxes is shown

#### Scenario: wiki gates the nav item
- **WHEN** the role has `wiki.view = false`
- **THEN** the "Wiki" sidebar item is hidden

#### Scenario: preset defaults
- **WHEN** a new default-member role is created
- **THEN** its `wiki` permission is view-only (view true, create/update/delete false)
