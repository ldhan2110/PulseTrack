# Spec: dual-auth

### Requirement: external email/password login [req-1]
The API SHALL authenticate an `EXTERNAL`, `ACTIVE` user by email + password and issue PulseTrack tokens, and SHALL reject bad credentials without disclosing which factor failed.

#### Scenario: valid credentials
- **WHEN** `POST /auth/login` is called with an external user's correct email + password
- **THEN** the response is 200 with an access token, a refresh token, and the user

#### Scenario: wrong password
- **WHEN** `POST /auth/login` is called with a correct email but wrong password
- **THEN** the response is 401 with a generic "invalid email or password" message

#### Scenario: non-active external user
- **WHEN** an `INVITED` (password not yet set) or `LOCKED` external user attempts login
- **THEN** the response is 401 and no token is issued

### Requirement: dual authentication strategy [req-2]
The API SHALL accept both a Keycloak RS256 token and a PulseTrack HS256 token on every guarded route, resolving each to its DB user, and SHALL NOT let one strategy validate the other's tokens.

#### Scenario: keycloak token on a guarded route
- **WHEN** a request carries a valid Keycloak token
- **THEN** it is accepted and `req.user` is the internal user (unchanged behaviour)

#### Scenario: external token on a guarded route
- **WHEN** a request carries a valid PulseTrack external token
- **THEN** it is accepted and `req.user` is the external user

#### Scenario: token confusion rejected
- **WHEN** a PulseTrack-signed token is presented and the Keycloak strategy evaluates it (or vice-versa)
- **THEN** that strategy rejects it (wrong issuer/signature) and the request is 401 unless the correct strategy accepts it

### Requirement: no cross-claim of external accounts [req-3]
The Keycloak claim-by-email branch SHALL only claim rows where `userType = INTERNAL`; an `EXTERNAL` row SHALL never be claimed or mutated by a Keycloak login.

#### Scenario: keycloak login collides with an external email
- **WHEN** a Keycloak user logs in with an email that already exists as an `EXTERNAL` user row
- **THEN** the external row is not claimed, its `keycloakId` stays null, and the Keycloak login does not gain access to that account

### Requirement: external users are isolated from Blueprint [req-4]
An `EXTERNAL` user SHALL never receive Blueprint `user-info` sync (name/imageUrl from the Blueprint directory) and SHALL always have `keycloakId = null` and `passwordHash != null`.

#### Scenario: external user profile
- **WHEN** an external user's record is loaded during auth
- **THEN** no Blueprint `user-info` sync runs and `keycloakId` remains null

### Requirement: silent token refresh [req-5]
The API SHALL exchange a valid, unexpired refresh token for a new access + refresh pair (rotate-on-use), and reject expired or malformed refresh tokens.

#### Scenario: refresh before expiry
- **WHEN** `POST /auth/refresh` is called with a valid refresh token
- **THEN** the response is 200 with a new access token and a new refresh token

#### Scenario: expired refresh token
- **WHEN** `POST /auth/refresh` is called with an expired refresh token
- **THEN** the response is 401

### Requirement: invite external customer [req-6]
An admin invite marked external SHALL create an `EXTERNAL`, `INVITED` user with no password and send a single-use, time-limited set-password link by email.

#### Scenario: external invite
- **WHEN** an admin invites an external customer by email
- **THEN** a user is created with `userType=EXTERNAL`, `status=INVITED`, `passwordHash=null`, and a set-password email is enqueued

### Requirement: set password via single-use token [req-7]
The API SHALL let an invited/reset user set a password with a valid token, then activate the account and burn the token; invalid, expired, or reused tokens SHALL be rejected.

#### Scenario: valid set-password
- **WHEN** `POST /auth/set-password` is called with a valid token and an 8+ char password
- **THEN** `passwordHash` is set, `status` becomes `ACTIVE`, the token is invalidated, and the user is signed in

#### Scenario: expired or reused token
- **WHEN** `POST /auth/set-password` is called with an expired, unknown, or already-used token
- **THEN** the response is 400/401 with a generic message and no password is set

#### Scenario: weak or mismatched password
- **WHEN** the new password is under 8 characters
- **THEN** the response is 400 and no password is set

### Requirement: forgot password [req-8]
The API SHALL accept a forgot-password request and always return the same neutral response, emailing a single-use reset link only when the email maps to an external user.

#### Scenario: existing external email
- **WHEN** `POST /auth/forgot-password` is called with a registered external email
- **THEN** the response is a neutral confirmation and a reset link is emailed

#### Scenario: unknown email
- **WHEN** `POST /auth/forgot-password` is called with an unknown email
- **THEN** the response is the identical neutral confirmation and no email is sent

### Requirement: login rate limiting [req-9]
The API SHALL throttle repeated failed logins.

#### Scenario: too many failures
- **WHEN** 5 logins fail within 60s for the same IP + email
- **THEN** further attempts return 429

### Requirement: user directory scoping [req-10]
User search / member lookup SHALL return only users who share a project or conversation with the caller, not the whole user table.

#### Scenario: external user searches people
- **WHEN** an external user queries member/mention/user search
- **THEN** only users sharing a `ProjectMember`/`ConversationMember` with them are returned, never the full directory

### Requirement: dual login UI [req-11]
The web app SHALL present a login page offering both the Keycloak company-account flow and the email/password flow, and SHALL stop hard-redirecting unauthenticated users straight to Keycloak. Set-password and forgot-password pages SHALL exist.

#### Scenario: unauthenticated visitor
- **WHEN** an unauthenticated user opens the app
- **THEN** the CareOne login page renders with both a "Sign in with company account" button and an email/password form

#### Scenario: invalid set-password link
- **WHEN** a user opens the set-password page with an invalid/expired token
- **THEN** a generic "link invalid or expired" state renders with no password form

### Requirement: user model migration [req-12]
A forward migration SHALL add `userType`, `passwordHash`, `status`, and set-password token fields to `User`, backfilling existing rows to `INTERNAL`/`ACTIVE`.

#### Scenario: existing rows after migration
- **WHEN** the migration runs against a DB with existing users
- **THEN** every existing row has `userType=INTERNAL` and `status=ACTIVE` and the app still authenticates them via Keycloak
