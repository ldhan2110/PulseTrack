# Tasks: add-agent-write-consent

## 1. Consent column [req-1]
- [x] 1.1 [db] Add `allowWrite Boolean @default(false)` to `McpToken` model (`apps/api/prisma/schema.prisma:1182`)
- [x] 1.2 [db] Generate forward migration: `pnpm migrate` → `apps/api/prisma/migrations/<ts>_add_mcp_allow_write/` (additive, no backfill). Never hand-write DDL.
Verify: `pnpm --filter @pm/api exec prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-migrations prisma/migrations --exit-code` (clean) — schema and migrations agree.

## 2. Persist + expose consent [req-1]
- [x] 2.1 [backend] Add `allowWrite?: boolean` (`@IsOptional() @IsBoolean()`) to `CreateMcpTokenDto` (`apps/api/src/mcp/dto/create-mcp-token.dto.ts:15`)
- [x] 2.2 [service] `McpTokenService.createToken` (`apps/api/src/mcp/mcp-token.service.ts:18`) — persist `allowWrite: dto.allowWrite ?? false`
- [x] 2.3 [service] `McpTokenService.toDto` (`:53`) — include `allowWrite` in the returned DTO
- [x] 2.4 [test] `apps/api/src/mcp/mcp-token.spec.ts` — create with `allowWrite:true` persists true; omitted → false
Verify: `pnpm --filter @pm/api test mcp-token`

## 3. Gate write scopes on consent [req-2, req-3]
- [x] 3.1 [backend] Add `allowWrite: boolean` to `McpSession` interface (`apps/api/src/mcp/mcp-pat.guard.ts:5`); set it from the token row when building the session (`:46`)
- [x] 3.2 [backend] In `mcp-server.service.ts`: add `const WRITE_SCOPES = new Set([TASKS_WRITE, TASKS_LOGTIME, TASKS_ATTACH, TESTCASES_WRITE, EXEC_WRITE])`
- [x] 3.3 [backend] Extend `requireScope` (`apps/api/src/mcp/mcp-server.service.ts:43`) — after the scope check, if `WRITE_SCOPES.has(scope) && !session.allowWrite` throw `Error('Agent writes not permitted: token has no write consent')`
- [x] 3.4 [test] `apps/api/src/mcp/mcp-tools.spec.ts` — write tool with `allowWrite:false` → hard error, no mutation; with `true` → succeeds; read tool with `allowWrite:false` → succeeds; missing scope error still precedes consent error
Verify: `pnpm --filter @pm/api exec vitest run mcp-tools -t "consent gate"` — narrowed to this change's consent tests; the 3 other mcp-tools.spec failures are pre-existing and unrelated (out of scope).

## 4. Frontend consent checkbox [req-4]
- [x] 4.1 [frontend] Add `allowWrite: boolean` to the `McpToken` type and the create-token payload type in `apps/web/src/lib/types.ts`
- [x] 4.2 [frontend] Pass `allowWrite` through `api` create-token method (`apps/web/src/lib/api.ts`) and the `useCreateMcpToken` mutation input (`apps/web/src/hooks/useMcpTokens.ts`)
- [x] 4.3 [frontend] In `McpAccessCard.tsx`: add `allowWrite` state (default `false`); reset it in `resetForm` (`:69`); send it in `handleCreate` (`:85`)
- [x] 4.4 [frontend] Render consent block below the Scopes grid (`apps/web/src/components/settings/McpAccessCard.tsx:255`) — reuse `<Checkbox>` (`src/components/ui/checkbox.tsx`) + `<Label>` (`src/components/ui/label.tsx`), label "Allow this agent to write data as me" + muted hint
- [x] 4.5 [frontend] Show advisory warning when a write scope is selected and `allowWrite` is false — reuse the existing destructive banner style at `McpAccessCard.tsx:267` (`border-destructive/50 bg-destructive/10`). Does not disable Create.
- [x] 4.6 [test] `apps/web/src/components/settings/McpAccessCard.test.tsx` — checking consent sends `allowWrite:true`; write scope + no consent renders the warning
Verify: `pnpm --filter @pm/web exec vitest run McpAccessCard -t "req-4"` — narrowed to this change's consent tests; the pre-existing "revoked badge" failure is unrelated (out of scope).

## 5. Full build [req-1..req-4]
- [x] 5.1 [test] Both apps build and test clean
Verify: `pnpm build && pnpm --filter @pm/api exec vitest run mcp-token mcp-tools -t "consent" && pnpm --filter @pm/web exec vitest run McpAccessCard -t "req-4"` — build is fully green both apps; tests narrowed to this change's suites. Full `pnpm test` carries 4 pre-existing unrelated failures (3 in mcp-tools.spec, 1 "revoked badge" in McpAccessCard.test) ruled out of scope; baseline confirmed on clean HEAD.
