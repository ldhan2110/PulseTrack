# Spec: export-excel-sanitize-parent

### Requirement: readable description in export [req-1]
The task Excel export SHALL write the Description cell as plain readable text, with HTML tags stripped and common HTML entities decoded.

#### Scenario: description with markup
- **WHEN** a task's description is `<p>Fix <b>login</b> bug</p>`
- **THEN** the Description cell contains `Fix login bug`

#### Scenario: description with entities
- **WHEN** a task's description is `<p>Ship A &amp; B when x &lt; y</p>`
- **THEN** the Description cell contains `Ship A & B when x < y`

#### Scenario: empty description
- **WHEN** a task has no description
- **THEN** the Description cell is empty

### Requirement: parent task key column [req-2]
The task Excel export SHALL include a "Parent Task Key" column, positioned immediately after "Task Key", identifying the parent of each sub-task.

#### Scenario: sub-task row
- **WHEN** a sub-task with parent task key `PROJ-1` is exported
- **THEN** its "Parent Task Key" cell contains `PROJ-1`

#### Scenario: parent task row
- **WHEN** a top-level (parent) task is exported
- **THEN** its "Parent Task Key" cell is empty

#### Scenario: column order
- **WHEN** the export is opened
- **THEN** the columns read `Task Key`, `Parent Task Key`, `Title`, `Description`, … in that order
