# Spec: add-agent-write-consent

### Requirement: consent flag persisted on token [req-1]
The API SHALL persist a per-token `allowWrite` boolean, defaulting to `false`, set from the create-token request.

#### Scenario: create with consent on
- **WHEN** a token is created with `allowWrite: true`
- **THEN** the stored token has `allowWrite = true` and the returned token DTO reports `allowWrite: true`

#### Scenario: create with consent omitted
- **WHEN** a token is created with no `allowWrite` field
- **THEN** the stored token has `allowWrite = false`

#### Scenario: unknown field still rejected
- **WHEN** a create request includes a field not in the DTO
- **THEN** the API returns 400 (global `forbidNonWhitelisted`)

### Requirement: write tools gated on consent [req-2]
The MCP server SHALL reject any write-scoped tool call when the session token has `allowWrite = false`, with a hard error and no data change.

#### Scenario: write tool without consent
- **WHEN** an agent whose token has `tasks:write` but `allowWrite = false` calls `create_task`
- **THEN** the call fails with error `"Agent writes not permitted: token has no write consent"` and no task is created

#### Scenario: write tool with consent
- **WHEN** an agent whose token has `tasks:write` and `allowWrite = true` calls `create_task`
- **THEN** the task is created with the token owner as creator

#### Scenario: missing scope takes precedence
- **WHEN** an agent whose token lacks `tasks:write` calls `create_task` (regardless of `allowWrite`)
- **THEN** the call fails with `"Missing required scope: tasks:write"`

### Requirement: read tools unaffected [req-3]
The MCP server SHALL allow read-scoped tool calls regardless of `allowWrite`.

#### Scenario: read tool without consent
- **WHEN** an agent whose token has `tasks:read` and `allowWrite = false` calls `list_tasks`
- **THEN** the call succeeds and returns tasks

### Requirement: consent checkbox in create modal [req-4]
The create-token modal SHALL let the user set consent and SHALL warn when a write scope is selected without consent.

#### Scenario: toggle consent
- **WHEN** the user checks "Allow this agent to write data as me" and creates a token
- **THEN** the create request carries `allowWrite: true`

#### Scenario: write scope without consent shows warning
- **WHEN** a write scope is ticked and consent is off
- **THEN** an advisory warning is shown, but Create remains enabled

#### Scenario: consent off by default
- **WHEN** the modal is opened
- **THEN** the consent checkbox is unchecked
