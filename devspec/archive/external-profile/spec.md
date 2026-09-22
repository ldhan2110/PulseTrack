# Spec: external-profile

### Requirement: update own display name [req-1]
The API SHALL let an authenticated EXTERNAL user update their own display name,
and SHALL reject the update for INTERNAL users.

#### Scenario: external updates name
- **WHEN** an EXTERNAL user sends `PATCH /users/me` with `{ "name": "Jane Cooper" }`
- **THEN** their `User.name` is updated and the sanitized user is returned

#### Scenario: internal forbidden
- **WHEN** an INTERNAL user sends `PATCH /users/me`
- **THEN** the API returns 403

#### Scenario: empty name rejected
- **WHEN** an EXTERNAL user sends `PATCH /users/me` with a blank/whitespace name
- **THEN** the API returns 400

### Requirement: update own avatar [req-2]
The API SHALL let an authenticated EXTERNAL user upload an avatar image, store it
via the shared avatar upload pipeline, and set it on their own `imageUrl`.

#### Scenario: external uploads avatar
- **WHEN** an EXTERNAL user posts a valid image to `POST /users/me/avatar` (multipart `file`)
- **THEN** the file is saved under `uploads/avatars/`, `User.imageUrl` is set to `/api/uploads/avatars/<file>`, and the sanitized user is returned

#### Scenario: non-image rejected
- **WHEN** the uploaded file is not an image mimetype
- **THEN** the API returns 400 and `imageUrl` is unchanged

#### Scenario: internal forbidden
- **WHEN** an INTERNAL user posts to `POST /users/me/avatar`
- **THEN** the API returns 403

### Requirement: change own password [req-3]
The API SHALL let an authenticated EXTERNAL user change their password by proving
the current one, reusing the existing argon2 helpers.

#### Scenario: correct current password
- **WHEN** an EXTERNAL user sends `PATCH /users/me/password` with a correct `currentPassword` and a `newPassword` of ≥ 8 chars
- **THEN** `User.passwordHash` is replaced with an argon2 hash of the new password and 200 is returned

#### Scenario: wrong current password
- **WHEN** the `currentPassword` does not match the stored hash
- **THEN** the API returns 401 and the stored hash is unchanged

#### Scenario: new password too short
- **WHEN** `newPassword` is shorter than 8 characters
- **THEN** the API returns 400

#### Scenario: internal forbidden
- **WHEN** an INTERNAL user sends `PATCH /users/me/password`
- **THEN** the API returns 403

### Requirement: sanitized user responses [req-4]
The API SHALL never expose secret fields on any user response.

#### Scenario: no secrets on /users/me
- **WHEN** any authenticated user calls `GET /users/me`
- **THEN** the response omits `passwordHash`, `pwResetTokenHash`, and `pwResetTokenExp`

#### Scenario: no secrets on profile writes
- **WHEN** any profile write endpoint returns the user
- **THEN** the response omits `passwordHash`, `pwResetTokenHash`, and `pwResetTokenExp`

### Requirement: profile modal on sidebar [req-5]
The web app SHALL provide a Profile modal launched from the sidebar user footer,
editable for EXTERNAL users and read-only for INTERNAL users.

#### Scenario: external sees editable form
- **WHEN** an EXTERNAL user opens the Profile modal
- **THEN** they see editable name, avatar upload, and change-password fields, and a disabled email field

#### Scenario: internal sees read-only
- **WHEN** an INTERNAL user opens the Profile modal
- **THEN** all fields are disabled, a "Managed by SSO" note is shown, and no Save/password section appears

#### Scenario: save reflects immediately
- **WHEN** an EXTERNAL user saves a new name or avatar successfully
- **THEN** the modal closes and the sidebar shows the updated name/avatar without a page reload

### Requirement: external avatar renders in sidebar [req-6]
The sidebar SHALL display an EXTERNAL user's uploaded avatar.

#### Scenario: external avatar shown
- **WHEN** an EXTERNAL user (no Keycloak user-info) has an `imageUrl` set
- **THEN** the sidebar footer avatar renders that image rather than only initials
