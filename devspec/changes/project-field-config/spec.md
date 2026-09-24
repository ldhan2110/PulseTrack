# Spec: project-field-config

### Requirement: field config persistence [req-1]
The API SHALL persist a per-project field-visibility map on `Project.fieldConfig` and return it with the project.

#### Scenario: save config
- **WHEN** a `PATCH /projects/:projectId` request includes `fieldConfig: { "storyPoints": false }`
- **THEN** the value is stored on the project and returned unchanged by `GET /projects/:projectId`

#### Scenario: unset config
- **WHEN** a project has never been configured
- **THEN** `fieldConfig` is `null` and the project loads normally

### Requirement: config edit permission [req-2]
The API SHALL allow only members with `projectSettings:update` to change `fieldConfig`, and the dialog trigger SHALL be disabled for others.

#### Scenario: unauthorized member
- **WHEN** a member without `projectSettings:update` opens Project Settings → General
- **THEN** the "Configure Fields" button is disabled

#### Scenario: authorized manager
- **WHEN** a member with `projectSettings:update` saves the dialog
- **THEN** the PATCH succeeds and the config is stored

### Requirement: configure-fields dialog [req-3]
The dialog SHALL list the 9 v1 task fields each with a show/hide toggle reflecting saved config, and Save SHALL persist all toggles.

#### Scenario: open reflects saved state
- **WHEN** `fieldConfig` marks `sprint` hidden and the manager opens the dialog
- **THEN** the Sprint toggle is off and all fields with no stored key are on

#### Scenario: save persists toggles
- **WHEN** the manager turns Story points off and clicks Save
- **THEN** the dialog closes and reopening shows Story points off

#### Scenario: cancel discards
- **WHEN** the manager changes toggles then clicks Cancel
- **THEN** no PATCH is sent and reopening shows the last saved state

### Requirement: hide required field with warning [req-4]
The dialog SHALL allow hiding the required Ticket type field and SHALL show a warning when it is toggled off, without blocking Save.

#### Scenario: toggle required off
- **WHEN** the manager toggles Ticket type off
- **THEN** an inline warning appears that new tasks will be created without a ticket type, and Save stays enabled

### Requirement: hidden fields omitted from task forms [req-5]
`CreateTaskDialog` and `TaskDetailPage` SHALL render only fields marked visible (default visible when unset), and SHALL drop the client-side required check for a hidden field.

#### Scenario: hidden field not rendered on create
- **WHEN** `fieldConfig` hides `sprint` and a user opens the create-task dialog
- **THEN** the Sprint field is not shown

#### Scenario: hidden required field does not block create
- **WHEN** `fieldConfig` hides `taskType` and a user submits the create-task dialog with no ticket type
- **THEN** the task is created (no "Ticket type is required" error)

#### Scenario: hidden field not rendered on detail
- **WHEN** `fieldConfig` hides `storyPoints` and a user opens a task detail page
- **THEN** the Story points field is not shown

#### Scenario: visible-by-default when unset
- **WHEN** a project has `fieldConfig = null`
- **THEN** all 9 fields render on both forms as they do today
