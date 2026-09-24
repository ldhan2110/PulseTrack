# Proposal: project-field-config

## Why
Different projects need different task fields. Some teams don't use sprints, story points, or planned/actual dates, but every task form shows them all — noise the team must ignore on every create and edit. There's no way to tailor the form per project.

## What it delivers
A per-project **field visibility config**: a project admin opens a "Configure Fields" dialog from Project Settings → General and toggles which task fields appear on the task **create** and **detail (edit)** forms. Config is stored on the project and applied wherever those forms render.

## Scope

**In (v1):**
- New nullable `Project.fieldConfig` JSON column holding a `{ <fieldKey>: boolean }` map (missing key = visible).
- `PATCH /projects/:projectId` accepts `fieldConfig` (existing endpoint + DTO), returned by `GET /projects/:projectId` (already included).
- "Configure Fields" dialog (shadcn `Dialog` + `Switch`), launched from a General-tab card. Editable only by `canManage` (`projectSettings:update`).
- 9 toggleable task fields: Ticket type (required-by-default), Assignee, Priority, Sprint, Story points, Planned start, Planned end, Actual start, Actual end.
- Hiding a required field (Ticket type) is allowed; a warning explains new tasks are then saved with no ticket type. Frontend drops its required-validation for a hidden field.
- Hidden fields are conditionally rendered out of `CreateTaskDialog` and `TaskDetailPage`.

**Out (v1):**
- Board/list columns and saved-filter fields (still show all) — defer.
- Bug forms and WBS task dialog — task only.
- Custom/user-defined fields — fixed known field set only.
- Per-field default values or picking a fallback ticket type when hidden — hidden required field just saves null.
- Backend enforcement of visibility — config is a UI concern; the API still accepts any field (no new server-side rejection).
