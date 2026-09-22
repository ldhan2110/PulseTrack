# Design: external-profile

## Overview

Add authenticated self-service profile endpoints to the `users` module and a
Profile modal on the web sidebar. All write operations are gated to
`userType === 'EXTERNAL'`; INTERNAL users get a read-only view because their
identity fields re-sync from Keycloak on every login (`jwt.strategy.ts:75-90`),
so a local edit would be clobbered.

## Architecture

```
Sidebar footer (AppSidebar) ──click "Profile"──▶ ProfileModal (gated on user.userType)
                                                     │
        EXTERNAL: editable                           │  INTERNAL: read-only "Managed by SSO"
                                                     ▼
  api.ts client ──▶ Users API (JwtAuthGuard)
     PATCH /users/me            { name }            ─▶ UsersService.updateOwnProfile
     POST  /users/me/avatar     multipart(file)     ─▶ UsersService.updateOwnAvatar   (diskStorage → /api/uploads/avatars)
     PATCH /users/me/password   { current, new }    ─▶ UsersService.changeOwnPassword (AuthService.verify/hash)
                                                        │ all: assert userType===EXTERNAL else 403
                                                        ▼
                                                     Prisma User (name / imageUrl / passwordHash)
     on success ──▶ AuthProvider.setUser(refreshed)  ──▶ sidebar name+avatar update
```

## Chosen approach

- **Endpoints live on the `users` module**, not `auth` — they act on the
  authenticated caller (`req.user`), following the existing `GET /users/me`
  precedent. `JwtAuthGuard` at class level.
- **Avatar upload reuses the project-avatar pattern verbatim**
  (`projects.controller.ts:126`): `FileInterceptor('file')` + `diskStorage` to
  `uploads/avatars/`, `randomUUID()+ext` filename, 2 MB limit, image-only
  `fileFilter`. Result URL `/api/uploads/avatars/<file>` written to
  `User.imageUrl`. Served by the existing static mount (`main.ts:49`).
- **Password change reuses argon2 helpers** from `AuthService`
  (`hashPassword`/`verifyPassword`, already public at `auth.service.ts:40/44`).
  `AuthModule` exports `AuthService`; `UsersModule` imports it. No new crypto.
- **Response sanitization**: a single `sanitizeUser()` strips `passwordHash`,
  `pwResetTokenHash`, `pwResetTokenExp`. Applied to `GET /users/me` (fixes a
  pre-existing leak) and every new endpoint's response.
- **Frontend**: new `ProfileModal` built from shadcn primitives (see `ui.md`),
  launched from `AppSidebar` footer. `AuthContextValue` gains `setUser` so the
  modal writes the refreshed user back into context.

## Rejected approaches

- **Editing profile for INTERNAL users** — rejected: Keycloak overwrites
  name/email/imageUrl each login, so the edit is silently lost. Read-only only.
- **Duplicating argon2 config in UsersService** — rejected: reuse the existing
  `AuthService` helpers to keep one hashing configuration.
- **A dedicated `/profile` route/page** — rejected: user chose a modal; less
  surface, no new route wiring.
- **Deleting the previous avatar file on replace** — rejected for parity with
  the projects avatar flow, which also leaves old files (low-risk disk use).

## Impact Area

### Decision Defaults

| Gray area | Default | Why |
|-----------|---------|-----|
| Avatar size/type limit | 2 MB, image mimetypes only | Match `projects` avatar multer exactly |
| Old avatar file on replace | Leave on disk (overwrite URL only) | Parity with `projects.updateAvatar` |
| Password change invalidates session? | No — keep current tokens | Only the hash changes; external tokens are self-issued HS256, not hash-derived |
| Name validation | Required, trimmed, 1–100 chars | Sensible default; `name` is display-only |
| Save orchestration | On Save: avatar (if new file) → name (if changed) → password (if all 3 filled), sequential, stop + show error on first failure | Endpoints are independent; keeps each testable |
| Password fields empty | Skip password call — name/avatar-only save | Fields optional per `ui.md` |
| INTERNAL calls a write endpoint directly | 403 Forbidden | Server-side gate, not just hidden UI |
| Confirm-password mismatch | Client-side block before submit; server ignores confirm | Confirm is a UX check only |

### Blast Radius

- `apps/api/src/users/users.controller.ts` — add 3 endpoints; `getMe` now returns sanitized user.
- `apps/api/src/users/users.service.ts` — add `updateOwnProfile`, `updateOwnAvatar`, `changeOwnPassword`, `sanitizeUser`.
- `apps/api/src/users/users.module.ts` — import `AuthModule`.
- `apps/api/src/auth/auth.module.ts` — export `AuthService`.
- `apps/web/src/auth/AuthProvider.tsx` — expose `setUser` on `AuthContextValue` (seam: currently no setter/refetch is exported).
- `apps/web/src/components/layout/AppSidebar.tsx` — add Profile trigger; **line ~121 avatar currently reads `keycloakUserInfo?.imgUrl` only → add `?? user?.imageUrl`** so an external user's uploaded avatar shows.
- `apps/web/src/lib/api.ts` — add `updateProfile`, `uploadOwnAvatar`, `changeOwnPassword` client calls.
- `apps/web/src/lib/types.ts` (or `UserProfile` type) — ensure `userType` + `imageUrl` present for gating/rendering.
- New `apps/web/src/components/profile/ProfileModal.tsx`.

### Risk tags

- Password change endpoint — **security-sensitive**, medium risk. Mitigation: verify current password before hashing new; gate to EXTERNAL; length ≥ 8 (matches existing `setPassword`).
- Response sanitization — **security fix** (removes existing secret leak), low risk, reversible.
- Avatar file upload — file-handling, medium risk. Mitigation: reuse the proven `projects` multer config (size + mime filter) unchanged.
- All changes additive and reversible; no destructive DB ops; no migration (uses existing `User.name`/`User.imageUrl`/`User.passwordHash` columns).
