# Proposal: dual-auth

## Why

Today PulseTrack authenticates **only** through Keycloak (internal corporate identity, federated with the Blueprint directory). Every user must exist in Keycloak. We now need to invite **external customers** who have only an email address and no corporate/Keycloak account. They need a way to sign in with an email + password managed by PulseTrack itself.

## What it delivers

- A dual login page (replaces the current auto-redirect to Keycloak):
  - **"Sign in with company account"** → existing Keycloak PKCE flow, unchanged (internal users).
  - **Email + password form** → new PulseTrack-native auth (external users).
- PulseTrack-owned password auth for external users: password set via an invite link, login issues PulseTrack-signed tokens, silent token refresh.
- Isolation so external users cannot escalate into or masquerade as internal users, and cannot enumerate the internal corporate directory.

## Scope — IN

- `userType` on User (`INTERNAL` | `EXTERNAL`), `passwordHash`, `status`, and set-password token fields; forward migration backfilling existing rows to `INTERNAL`.
- Second passport strategy (`external-jwt`, PulseTrack-signed) alongside the existing Keycloak `jwt` strategy; one guard accepts both.
- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/set-password`, `POST /auth/forgot-password` (external only).
- Admin invite path creating an `EXTERNAL` `INVITED` user + emailing a single-use set-password link.
- App-hosted login page + frontend auth handling both token sources with silent refresh.
- Security invariants: no cross-claim of an external row by a Keycloak token; external users never receive Blueprint `user-info` sync; token strategies never cross-validate.
- Scope user directory / mention search to shared membership (closes the internal-directory leak).

## Scope — OUT (deferred, do not build)

- **External self-registration** — invite-only for now. `userType` is designed so self-register can be added later without reshaping the model.
- **Corporate email domain allowlist** — not enforced yet.
- **`@InternalOnly` route gating** — external customers are normal platform users with the same UI and feature access; data isolation stays per-project via `ProjectMember` (already the model).
- **Server-side refresh-token store / reuse-detection** — refresh tokens are stateless, rotated on use. A persisted token store (enabling server-side revoke + reuse-detection) is a later hardening step.
- **httpOnly cookie refresh tokens (Option C+)** — rejected: requires dropping CORS `origin:'*'`, which must stay wildcard. Refresh token lives in `localStorage` instead (see design.md for the accepted XSS tradeoff).

## Breaking changes

- Frontend `AuthProvider` no longer hard-redirects to Keycloak (`onLoad:'login-required'`) — every unauthenticated entry point now lands on the new login page.
- `jwt.strategy.validate()` splits internal/external handling and gains a `userType` gate on the claim-by-email branch.
- User table migration (additive columns + backfill).
