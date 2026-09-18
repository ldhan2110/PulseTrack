# Design: add-agent-write-consent

## Chosen approach
Per-token consent flag `McpToken.allowWrite` (Boolean, default `false`), enforced at the single `requireScope` choke point. The token owner (`McpToken.userId`) is already the acting identity for every write, so consent is self-scoped by construction.

Flow: modal checkbox → create-token payload → `McpToken.allowWrite` persisted → `McpPatGuard` loads it onto `McpSession` → `requireScope` rejects write scopes when `allowWrite` is false.

## Architecture

```
Create modal (McpAccessCard)
  └─ POST /api/projects/:projectId/mcp-tokens  { label, scopes, allowWrite, expiresAt }
        └─ McpTokenController.create → McpTokenService.createToken
              └─ McpToken row { userId=self, scopes, allowWrite }

Agent request
  Bearer PAT → /api/mcp
    └─ McpPatGuard.canActivate → loads token row → McpSession { userId, projectId, scopes, allowWrite }
          └─ tool handler → requireScope(session, 'tasks:write')
                ├─ scope not in token.scopes            → "Missing required scope"
                ├─ write scope AND !allowWrite          → "Agent writes not permitted…" (HARD ERROR)
                └─ else → TasksService.create(projectId, session.userId, dto)   [actor = self]
```

## Enforcement point
`requireScope` (`apps/api/src/mcp/mcp-server.service.ts:43`) is called by every write handler. Add a set of write scopes and gate there — one edit covers all 5 write tools instead of touching 8 handlers.

```
WRITE_SCOPES = { tasks:write, tasks:logtime, tasks:attach, testcases:write, testexec:write }
requireScope(session, scope):
  if scope not in session.scopes: throw "Missing required scope: <scope>"
  if scope in WRITE_SCOPES and not session.allowWrite:
      throw "Agent writes not permitted: token has no write consent"
```
Read scopes are never in `WRITE_SCOPES`, so read tools are untouched.

## Rejected approaches
- **Per-member / project-wide consent switch** (`ProjectMember.allowAgentWrite`) — needs a new self-only PATCH endpoint + a new settings UI surface, and duplicates the existing per-token scope model. Per-token reuses the create modal and the row the guard already loads. Rejected for cost.
- **Impersonate arbitrary members** (checkbox list of members) — real privilege escalation, per-call identity surface across every write handler + guard. Owner chose self-only. Rejected.
- **Consent auto-enables write scopes (replace manual scope ticking)** — restructures the existing scopes UI. Kept scopes as-is; consent is an independent master gate. Rejected for minimal diff.

## Data shape
See `db.md`. One additive column: `McpToken.allowWrite Boolean @default(false)`. No backfill, no reshape.

## Impact Area

### Decision Defaults
| Gray area | Default |
|-----------|---------|
| Write scope ticked but consent off at create time | Allow token creation; agent writes fail at call time with hard error. Modal shows advisory warning. (Do not block Create — a read-consent token is valid.) |
| Consent-off agent calls a write tool | Hard error `"Agent writes not permitted: token has no write consent"`, no data returned. Tool still listed. |
| Existing tokens after migration | `allowWrite = false` (fail-closed). No auto-grant. |
| Edit consent on an existing token | Not supported — revoke + recreate (matches existing token immutability; no update endpoint exists). |
| `allowWrite` omitted from create payload | Defaults to `false` (DTO optional, column default). |
| Error message wording | `"Agent writes not permitted: token has no write consent"` (mirrors existing `"Missing required scope: …"` style). |

### Blast Radius
- `apps/api/prisma/schema.prisma:1182` — `McpToken` model + new migration dir.
- `apps/api/src/mcp/dto/create-mcp-token.dto.ts:15` — add optional `allowWrite`.
- `apps/api/src/mcp/mcp-token.service.ts:18` (`createToken`) + `:53` (`toDto`) — persist + expose.
- `apps/api/src/mcp/mcp-pat.guard.ts:5` (`McpSession`) + `:46` (session build) — carry `allowWrite`.
- `apps/api/src/mcp/mcp-server.service.ts:43` (`requireScope`) — gate write scopes.
- `apps/web/src/lib/types.ts` — `McpToken` type + create-payload type gain `allowWrite`.
- `apps/web/src/lib/api.ts` — create-token method passes `allowWrite`.
- `apps/web/src/hooks/useMcpTokens.ts` — mutation input type gains `allowWrite`.
- `apps/web/src/components/settings/McpAccessCard.tsx:242` — checkbox + warning + state.

### Risk tags
- **security / privilege**: consent gate on delegated writes. Fail-closed default is the safe posture. Actor is always self — no impersonation surface added.
- **reversibility**: high — additive column, single choke-point gate. Revert = drop gate + column.
- **behavior change**: existing write-scoped tokens stop writing until re-consented (see proposal). Accepted.

## Open questions
None — settled in exploration.
