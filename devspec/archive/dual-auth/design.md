# Design: dual-auth

## Problem

Auth is Keycloak-only today: `JwtStrategy` (passport-jwt) validates RS256 Bearer tokens against the Keycloak realm JWKS, issuer-locked; the frontend `AuthProvider` hard-redirects to Keycloak (`onLoad:'login-required'`). External customers have only an email — no Keycloak/Blueprint identity — so they need PulseTrack-owned email+password auth living alongside the untouched Keycloak path.

## Chosen approach — Option B (PulseTrack owns external passwords)

Passwords for external users live in PulseTrack, not in a second Keycloak realm. A second passport strategy issues and validates PulseTrack-signed tokens; the existing Keycloak strategy is unchanged. One guard accepts either.

### Rejected approaches
- **A — External users as a second Keycloak realm/IdP.** Rejected: pushes external-customer lifecycle (invite, password, reset) into Keycloak config the team doesn't want to own per-customer; heavier ops than a `passwordHash` column.
- **C+ — Refresh token in httpOnly cookie.** Rejected — **rule conflict**. `rules.md`: *"No cookies/credentials (CORS `origin:'*'` relies on Bearer)."* Browsers forbid `Access-Control-Allow-Origin:'*'` together with credentials, and the product requires wildcard CORS (arbitrary browser origins). httpOnly cookies would force an explicit origin allowlist — the user explicitly kept `origin:'*'`. So the refresh token lives in `localStorage` instead. **Accepted tradeoff:** an XSS hole could read the refresh token. Mitigated by short refresh TTL + rotate-on-use + the app's CSP; server-side reuse-detection is deferred (needs a token store).

## Architecture

```
FRONTEND (apps/web)
  LoginPage ──"company account"──▶ keycloak.login()  (PKCE, unchanged) ──▶ KC token (RS256)
           └─"email + password"──▶ POST /api/auth/login ──▶ PT access (HS256) + refresh
  AuthProvider: no more hard redirect. Holds whichever token; silent-refresh timer.
    internal → keycloak.updateToken()   external → POST /api/auth/refresh (from localStorage)
  api.ts: Authorization: Bearer <access token>  (same header for both kinds)

BACKEND (apps/api)
  Guard: AuthGuard(['jwt','external-jwt'])  ── passport tries both, first valid wins
    ├─ 'jwt'          RS256, Keycloak JWKS, issuer-locked   → INTERNAL  (existing, unchanged)
    └─ 'external-jwt' HS256, EXTERNAL_JWT_SECRET, iss=pulsetrack → EXTERNAL (new)
  both resolve req.user = DB User → all 42 existing controllers work unchanged

  AuthController (new)
    POST /auth/login           email+pw → verify passwordHash → {access, refresh, user}
    POST /auth/refresh         refresh (rotate-on-use) → {access, refresh}
    POST /auth/set-password    {token,newPassword} → set hash, status ACTIVE, burn token
    POST /auth/forgot-password {email} → email reset link (neutral response)
  AuthService: argon2 hash/verify, PT-JWT sign/verify, token issue/redeem
  Admin invite (external) → User{EXTERNAL,INVITED} + emailed single-use set-password link
```

## Security invariants (enforce in code — the hostile-threat requirements)

1. **No cross-claim (anti-squatting).** `JwtStrategy.validate()` claim-by-email branch must match `userType = INTERNAL` only. An `EXTERNAL` row is never claimable by a Keycloak token. Without this, an external who occupies `ceo@company.com` would capture the real CEO's Keycloak login. `email` is globally unique, so the two never share a row — the gate makes the collision safe.
2. **No Blueprint bleed to external.** Only `JwtStrategy` (internal) does the Blueprint `user-info` sync. `external-jwt` never touches Blueprint. (External users never present a KC token, so this holds by construction — assert it, don't rely on it.)
3. **Strategies never cross-validate.** Separate signing material + `issuer` claim; a PT token is rejected by the KC strategy and vice-versa (token-confusion defense).
4. **Directory scoping.** `chat.service.searchTargets`, `users.service.findAll`, and global user search currently do unscoped `prisma.user.findMany()` — scope them to users sharing a `ProjectMember`/`ConversationMember` with the caller. Closes external→internal directory enumeration; also correct for internal users. **Overlaps `chat-members-mentions` (board status: blocked)** — coordinate: the chat member/mention search may already be conversation-scoped there. Worker checks that change's `searchTargets` before editing; if already scoped, this requirement is satisfied for chat and only `users.findAll`/global search remain.

## Impact Area

### Decision Defaults (worker proceeds on these unless told otherwise)

| Gray area | Default |
|-----------|---------|
| Password hash | argon2id (`@node-rs/argon2`); bcrypt acceptable if argon dep is a problem |
| Password policy | min 8 chars (matches UI hint). No complexity rules (deferred). |
| Access token TTL | 15 min, HS256, `iss=pulsetrack`, claims `{sub:user.id, userType:'EXTERNAL'}` |
| Refresh token | 7 days, rotate-on-use (each refresh returns a new one), stateless (signed). Sent in `POST /auth/refresh` body; stored client-side in `localStorage`. |
| Set-password / reset token | random 32-byte, stored **hashed** on `User`, single-use (nulled on redeem). Invite token TTL 24h, reset token TTL 1h. |
| Login failure copy | generic "Invalid email or password" (no account disclosure) |
| forgot-password response | always neutral "if an account exists…" (anti-enumeration), regardless of match |
| Login rate limit | `@nestjs/throttler` (add if absent) — 5 failed logins / 60s per IP+email → 429; not a persistent lockout (status `LOCKED` reserved, admin-set only, not auto for now) |
| Internal vs external at invite | explicit `external: true` flag on the invite action — inviter chooses. No domain inference (allowlist deferred). |
| Keycloak path | untouched. CORS stays `origin:'*'`. No `main.ts` CORS change. |

### Blast Radius (resolved via code graph)

**Backend**
- `apps/api/src/auth/jwt.strategy.ts` — gate claim-by-email on `userType=INTERNAL` (invariant 1); Blueprint sync stays internal-only (invariant 2).
- `apps/api/src/auth/jwt-auth.guard.ts` — `AuthGuard('jwt')` → `AuthGuard(['jwt','external-jwt'])`.
- `apps/api/src/auth/auth.module.ts` — register `ExternalJwtStrategy`, `AuthController`, `AuthService`.
- **new**: `external-jwt.strategy.ts`, `auth.controller.ts`, `auth.service.ts`.
- `apps/api/src/members/members.service.ts:142` — external-invite branch: create `EXTERNAL/INVITED`, issue set-password token, enqueue invite email (reuse `notification-email` invite job).
- `apps/api/src/chat/chat.service.ts:204` (`searchTargets`), `apps/api/src/users/users.service.ts` (`findAll`), `apps/api/src/search/search.service.ts` — membership-scope user results (invariant 4).
- `apps/api/prisma/schema.prisma` + forward migration (see `db.md`).

**Frontend**
- `apps/web/src/auth/AuthProvider.tsx` — drop `onLoad:'login-required'` hard redirect; render `LoginPage` when unauthenticated; hold external token; dual silent-refresh.
- `apps/web/src/lib/api.ts` — attach external access token as Bearer; on 401 for external, call `/auth/refresh` then retry.
- **new pages**: `LoginPage.tsx`, `SetPasswordPage.tsx`, `ForgotPasswordPage.tsx` in `src/pages/`; routes in `App.tsx` (outside `ProtectedRoute`).

### Risk tags
- **security-critical**: jwt.strategy claim-by-email gate (invariant 1), strategy isolation (invariant 3), argon2 hashing, token TTLs. These get explicit tests.
- **breaking / high-blast**: `AuthProvider` entry flow (every unauthenticated entry point), `jwt-auth.guard` (all 42 controllers now reachable by external — acceptable: external = normal user, data still `ProjectMember`-gated).
- **reversible / low**: DB migration is additive; new endpoints are new surface.

## Open questions (for a human)
- **chat-members-mentions overlap** — that change is `blocked` on a MANUAL gate. If its `searchTargets` is already conversation-scoped, invariant 4 for chat is done; confirm before editing to avoid a conflicting edit.
- No destructive DB ops required. No `main.ts` CORS change required (wildcard retained).
