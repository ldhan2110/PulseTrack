# Tasks: dual-auth

## 1. User model migration [req-12]
- [x] 1.1 [db] Add to `User` in `apps/api/prisma/schema.prisma`: `userType UserType @default(INTERNAL)`, `passwordHash String?`, `status UserStatus @default(ACTIVE)`, `pwResetTokenHash String?`, `pwResetTokenExp DateTime?`; add enums `UserType {INTERNAL EXTERNAL}`, `UserStatus {INVITED ACTIVE LOCKED}`
- [x] 1.2 [db] Generate forward migration: `pnpm --filter @pm/api prisma migrate dev --name dual_auth_user_fields` — verify defaults backfill existing rows (INTERNAL/ACTIVE)
Verify: `pnpm --filter @pm/api prisma migrate diff` clean + a test asserting an existing-style row reads `userType=INTERNAL`, `status=ACTIVE` on a scratch DB

## 2. External JWT strategy + dual guard [req-2] [req-4]
- [x] 2.1 [backend] New `apps/api/src/auth/external-jwt.strategy.ts` — passport-jwt named `'external-jwt'`, HS256, secret `EXTERNAL_JWT_SECRET`, `issuer='pulsetrack'`; `validate()` loads the DB user by `sub`, asserts `userType=EXTERNAL`; never touches Blueprint
- [x] 2.2 [backend] `jwt-auth.guard.ts`: `AuthGuard('jwt')` → `AuthGuard(['jwt','external-jwt'])`
- [x] 2.3 [backend] Register `ExternalJwtStrategy` in `auth.module.ts`
- [x] 2.4 [test] `apps/api/src/auth/*.spec.ts`: external token accepted; KC token still accepted; a PT token is rejected by the KC strategy and vice-versa (req-2 confusion); external user carries no Blueprint sync (req-4)
Verify: `pnpm --filter @pm/api test auth`

## 3. Anti-squatting gate [req-3]
- [x] 3.1 [backend] In `jwt.strategy.ts` `validate()`, gate the claim-by-email branch on `pending.userType === 'INTERNAL'` — an `EXTERNAL` row is never claimed/mutated by a Keycloak token; keep Blueprint `user-info` sync internal-only
- [x] 3.2 [test] `jwt.strategy.spec.ts`: a KC login whose email matches an `EXTERNAL` row does NOT claim it (`keycloakId` stays null, no access granted)
Verify: `pnpm --filter @pm/api test jwt.strategy`

## 4. AuthService — login + refresh + rate limit [req-1] [req-5] [req-9]
- [x] 4.1 [service] New `apps/api/src/auth/auth.service.ts` — argon2 (`@node-rs/argon2`) hash/verify; sign PT access (15m) + refresh (7d, rotate-on-use) with `EXTERNAL_JWT_SECRET`/`iss=pulsetrack`
- [x] 4.2 [backend] New `apps/api/src/auth/auth.controller.ts` — `POST /auth/login` (email+pw → verify, only `EXTERNAL`+`ACTIVE` → `{accessToken, refreshToken, user}`; else 401 generic); `POST /auth/refresh` (valid refresh → new pair; expired → 401)
- [x] 4.3 [backend] Rate limit `POST /auth/login` via `@nestjs/throttler` (add dep if absent) — 5 fails / 60s per IP+email → 429
- [x] 4.4 [test] `auth.service.spec.ts` / `auth.controller.spec.ts`: valid login → tokens; wrong pw → 401; INVITED/LOCKED → 401 (req-1); refresh valid → new pair, expired → 401 (req-5); 6th failure in 60s → 429 (req-9)
Verify: `pnpm --filter @pm/api test auth`

## 5. Set-password + forgot-password [req-7] [req-8]
- [x] 5.1 [service] In `auth.service.ts`: issue random 32-byte token, store `pwResetTokenHash` + `pwResetTokenExp` on `User` (invite TTL 24h, reset TTL 1h); redeem = match hash + not expired, then set `passwordHash`, `status=ACTIVE`, null both token fields (single-use)
- [x] 5.2 [backend] `POST /auth/set-password {token,newPassword}` — valid+≥8 chars → set & sign in; expired/unknown/reused → 400/401 generic; <8 chars → 400
- [x] 5.3 [backend] `POST /auth/forgot-password {email}` — always neutral 200; email a reset link only when the email is an `EXTERNAL` user (reuse `notification-email` invite/reset job)
- [x] 5.4 [test] `auth.service.spec.ts`: valid set-password activates + burns token; reused token rejected (req-7); forgot-password returns identical response for known vs unknown email, sends only for known external (req-8)
Verify: `pnpm --filter @pm/api test auth`

## 6. External invite [req-6]
- [x] 6.1 [service] `apps/api/src/members/members.service.ts:142` — external-invite branch (`external: true` on the invite action): create `User{userType:EXTERNAL,status:INVITED,passwordHash:null}`, issue set-password token (§5.1), enqueue invite email with the set-password link
- [x] 6.2 [test] `members.service.spec.ts`: external invite creates the right row + enqueues the set-password email; internal invite path unchanged
Verify: `pnpm --filter @pm/api test members`

## 7. User directory scoping [req-10]
- [x] 7.1 [backend] Scope `apps/api/src/chat/chat.service.ts:204` `searchTargets` and `apps/api/src/users/users.service.ts` `findAll` (and `search.service.ts` user results) to users sharing a `ProjectMember`/`ConversationMember` with the caller — NOT global `findMany()`. First check whether `chat-members-mentions` already scoped `searchTargets`; if so, leave it and fix only the remaining callers
- [x] 7.2 [test] `chat.service.spec.ts` / `users.service.spec.ts`: a caller with no shared membership sees no other users; a co-member is returned
Verify: `pnpm --filter @pm/api test chat users`

## 8. Auth pages (login / set-password / forgot) [req-11]
- [x] 8.1 [frontend] `apps/web/src/pages/LoginPage.tsx` — reuse `<Card>` (`components/ui/card.tsx`), `<Button variant="default">` (company) + `<Button variant="outline">` (email), `<Input>` (`components/ui/input.tsx`), `<Label>`, `<Alert variant="destructive">`; `lucide-react` Mail/Lock icons; bubble background per `mockups/login.html`. Company button → `keycloak.login()`; email form → `POST /auth/login`
- [x] 8.2 [frontend] `SetPasswordPage.tsx` (reads `?token=`) → `POST /auth/set-password`; render invalid/expired-token state (no form) per `mockups/set-password.html`
- [x] 8.3 [frontend] `ForgotPasswordPage.tsx` → `POST /auth/forgot-password`; neutral "check your email" sent-state per `mockups/forgot-password.html`
- [x] 8.4 [frontend] Routes for all three in `App.tsx`, outside `ProtectedRoute`
Verify: `/devspec-verify dual-auth` (agent-browser: login shows both company button + email form, error/sent/invalid-token states render, frosted card + real logo present, not browser-default)

## 9. AuthProvider dual-token + silent refresh [req-11] [req-5]
- [x] 9.1 [frontend] `apps/web/src/auth/AuthProvider.tsx` — remove `onLoad:'login-required'` hard redirect; render `LoginPage` when unauthenticated; on external login store refresh token in `localStorage`, access token in memory; hold whichever token type
- [x] 9.2 [frontend] Silent refresh: internal keeps `keycloak.updateToken()`; external runs a timer that calls `POST /auth/refresh` before access expiry (survives reload from `localStorage`)
- [x] 9.3 [frontend] `apps/web/src/lib/api.ts` — send access token as `Authorization: Bearer`; on 401 for an external session, call `/auth/refresh` once then retry
Verify: `pnpm --filter @pm/web build` + `/devspec-verify dual-auth` confirms an external session survives a reload without re-login
