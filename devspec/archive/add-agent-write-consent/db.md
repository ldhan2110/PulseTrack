# DB: add-agent-write-consent

**Source**: file-derived (`apps/api/prisma/schema.prisma:1182`) — no live DB MCP reachable; may lag prod.
**Dialect**: postgresql (`@prisma/adapter-pg`, per conventions.md backend block)
**Migration path**: Prisma — edit `schema.prisma`, `pnpm migrate` generates `apps/api/prisma/migrations/<ts>_add_mcp_allow_write/`. Never hand-write DDL (rules.md).

## Tables touched

### McpToken  (exists)
| col | type | null | default | note |
|-----|------|------|---------|------|
| id | String | no | cuid() | PK |
| userId | String | no | — | FK → User.id, cascade. Token actor = this user (self). |
| projectId | String | no | — | FK → Project.id, cascade |
| scopes | String[] | no | `[]` | includes write scopes (`tasks:write` etc.) |
| **allowWrite** | Boolean | **add** | **false** | new — consent gate. Agent may run write-scoped tools only when true. |

Additive, nullable-safe: new `Boolean @default(false)` on a populated table → no backfill. Existing tokens land `false` = fail-closed (write tools blocked until re-consented). Intended.

## Impact
- `McpPatGuard.canActivate` (`apps/api/src/mcp/mcp-pat.guard.ts:26`) already loads the token row → read `allowWrite` here for free; add to `McpSession` (`:5`).
- `requireScope` (`apps/api/src/mcp/mcp-server.service.ts:43`) — single choke point every write handler calls. Gate write scopes on `session.allowWrite` here (not in 8 handlers).
- `McpTokenService.createToken` (`apps/api/src/mcp/mcp-token.service.ts:18`) persists new token → accept + store `allowWrite`.
- `McpTokenService.toDto` (`:53`) — expose `allowWrite` so UI list shows it.
- `CreateMcpTokenDto` (`apps/api/src/mcp/dto/create-mcp-token.dto.ts:15`) — add `allowWrite?: boolean` (global `forbidNonWhitelisted:true` rejects unknown fields otherwise → rules.md).
- No other feature writes `McpToken` (grep: only `src/mcp/`). No shared-table seam.

## Migration verdict
Additive column, default `false`, no backfill, no data reshape. Safe forward migration.

## Open questions
- None. Consent scoped per-token (creator = actor = self); no cross-user impersonation, no self-only endpoint needed.
