# Spec: delete-project

### Requirement: soft-delete column and migration [req-1]
The `Project` table SHALL have a nullable `deletedAt` timestamp, added by an additive migration, where `null` means live and a non-null value means soft-deleted.

#### Scenario: migration applies clean
- **WHEN** the migration runs on a database with existing projects
- **THEN** every existing project has `deletedAt = null` (still live) and no backfill or data change occurs

#### Scenario: column type
- **WHEN** the schema is inspected after migration
- **THEN** `Project.deletedAt` exists as a nullable timestamp

### Requirement: owner-only delete endpoint [req-2]
The API SHALL expose `DELETE /projects/:projectId` that sets `deletedAt` only when the caller is the project owner, and SHALL reject non-owners.

#### Scenario: owner deletes
- **WHEN** the project owner calls `DELETE /projects/:projectId`
- **THEN** the project's `deletedAt` is set to the current time and the response is success

#### Scenario: non-owner blocked
- **WHEN** a member who is not the owner calls `DELETE /projects/:projectId`
- **THEN** the API returns 403 Forbidden and `deletedAt` stays null

#### Scenario: unauthenticated blocked
- **WHEN** an unauthenticated request calls the endpoint
- **THEN** the API returns 401 (JwtAuthGuard)

### Requirement: soft-deleted projects are hidden [req-3]
The API SHALL exclude soft-deleted projects from list and detail reads so no user can see or reach them.

#### Scenario: dropped from list
- **WHEN** any member (owner included) lists their projects via `GET /projects`
- **THEN** projects with a non-null `deletedAt` are not in the result

#### Scenario: detail returns not found
- **WHEN** anyone fetches `GET /projects/:projectId` for a soft-deleted project
- **THEN** the API returns 404 Not Found

#### Scenario: live projects unaffected
- **WHEN** a project has `deletedAt = null`
- **THEN** it still appears in lists and its detail resolves normally

### Requirement: owner-only Danger Zone UI [req-4]
Project Settings → General SHALL show a Danger Zone with a delete action only to the project owner, and hide it entirely from everyone else.

#### Scenario: owner sees the card
- **WHEN** the owner opens Project Settings → General
- **THEN** a Danger Zone card with a "Delete project" button is shown

#### Scenario: non-owner does not see the card
- **WHEN** a non-owner member opens Project Settings → General
- **THEN** no Danger Zone card is rendered (absent, not merely disabled)

### Requirement: confirm, feedback, redirect [req-5]
The delete action SHALL require an explicit warning confirmation and, on success, remove the user from the deleted project's context.

#### Scenario: confirm required
- **WHEN** the owner clicks "Delete project"
- **THEN** an AlertDialog appears naming the project and warning that recovery is administrator-only, with Cancel and Delete actions

#### Scenario: cancel is a no-op
- **WHEN** the owner cancels the dialog
- **THEN** nothing is deleted and the dialog closes

#### Scenario: success feedback and redirect
- **WHEN** the delete request succeeds
- **THEN** a success toast shows and the user is navigated out of the project to the projects list, where the project no longer appears
