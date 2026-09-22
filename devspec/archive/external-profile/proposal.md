# Proposal: external-profile

## Why

EXTERNAL users (PulseTrack email/password accounts, no Keycloak) have no way to
maintain their own profile. Their `name` and `imageUrl` are set once at invite
and never updated afterward. INTERNAL users don't have this problem — their
`name`/`email`/`imageUrl` re-sync from Keycloak user-info on every login
(`jwt.strategy.ts:75-90`), so any local edit is overwritten anyway.

This change gives EXTERNAL users self-service control over their own display
name, avatar, and password.

## What it delivers

A **Profile** entry in the sidebar user footer that opens a **modal**:

- **Display name** — editable text field.
- **Avatar** — image upload, reusing the existing project-avatar upload
  pipeline (`diskStorage` → `/api/uploads/avatars/…`).
- **Change password** — current + new + confirm, reusing the existing argon2
  hashing/verification from the auth module.

## Scope

**In:**
- Backend: authenticated self-service endpoints on the `users` module to update
  own name, own avatar, and own password — all gated to `userType === EXTERNAL`.
- Frontend: a Profile modal launched from the sidebar user footer; refresh the
  cached current user after a successful save.
- Sanitize the `GET /users/me` response so secret fields
  (`passwordHash`, `pwResetTokenHash`, `pwResetTokenExp`) never leave the API.
- INTERNAL users see the profile as **read-only** with a "Managed by SSO" note.

**Out:**
- Editing email or username (email is an identity/login key; not in this change).
- Any profile editing for INTERNAL users (Keycloak owns their data).
- Admin editing of other users' profiles.
- Avatar cropping/resizing beyond what the existing upload pipeline does.

## Depends on

`dual-auth` (already done + archived) — provides EXTERNAL user type, argon2
password helpers, and the avatar upload pattern. Its code is merged, so this is
not a plan-time `depends_on`.
