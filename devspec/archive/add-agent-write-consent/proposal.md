# Proposal: add-agent-write-consent

## Why
External AI agents connect over MCP with a Personal Access Token (PAT) that already carries write scopes (`tasks:write`, `tasks:logtime`, `tasks:attach`, `testcases:write`, `testexec:write`). Today, ticking a write scope is the only gate — there is no explicit, human-readable consent that the agent may act on the token owner's behalf. We want an explicit opt-in: a checkbox on the create-token modal that authorizes the agent to create/update/log data **as the token owner**.

## What this delivers
- A per-token consent flag (`McpToken.allowWrite`, default `false`).
- A checkbox in the Create MCP token modal: "Allow this agent to write data as me".
- Enforcement: write-scoped MCP tools are rejected with a hard error unless the token has `allowWrite = true`. Read tools are unaffected.

## How it fits
The agent already acts as a specific user — `McpToken.userId`, which is the token creator (self). The token creator is the acting identity, so consent is inherently self-scoped: no impersonation of other members, no new self-service endpoint. This adds a consent gate on top of the existing scope system.

## Scope
**In:**
- `McpToken.allowWrite` column (additive migration, default `false`).
- Create-token DTO + service + list DTO carry `allowWrite`.
- MCP guard surfaces `allowWrite` on the session; `requireScope` blocks write scopes when consent is off.
- Modal checkbox + advisory warning banner when a write scope is ticked but consent is off.

**Out:**
- Impersonating other project members (actor is always the token owner).
- Per-member / project-wide consent switch (rejected — see design).
- Editing consent after creation (revoke + recreate; matches existing token immutability).
- Any change to read tools or existing scope semantics.

## Behavior change note
Existing tokens migrate to `allowWrite = false` (fail-closed). Any agent currently relying on write scopes stops writing until a new token is minted with consent on. This is intentional for a consent gate. Accepted by owner.
