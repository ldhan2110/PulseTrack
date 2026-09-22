# Verify: external-profile (app vs mockup)

## profile modal — internal read-only variant — PASS  (verify/profile-internal.png)
Live-driven as `anle` (INTERNAL/Keycloak):
- Modal opens from sidebar "Profile" trigger ✓
- "Managed by SSO" note present ✓; description "Your profile is managed by your organization" ✓
- Display name, Email, Upload avatar all disabled ✓
- No password section ✓; footer shows Close only, no Save ✓
- Real shadcn Dialog styling (card background `oklch(1 0 0)`, `display:grid`, box-shadow) — non-plain ✓

No mismatches. Matches mockup `profile-modal.html` internal variant.

## profile modal — external editable variant — DEFERRED (no live proof)
Could not drive live: no EXTERNAL test account exists in this environment
(the only documented account, `anle`, is INTERNAL/Keycloak; the external form
requires a PulseTrack email/password user).

Covered by other rungs:
- Backend external logic unit-tested green (12 tests): EXTERNAL name/avatar/password
  update + INTERNAL 403 gating + wrong-password 401 + secret-strip.
- The editable and read-only variants are one shared `ProfileModal` component
  (`disabled={!isExternal}`); the read-only variant rendered correctly live.

Residual: a human should log in as an EXTERNAL user and spot-check the editable
flow (name/avatar/password save → sidebar reflects) once such an account exists.
Logged in `devspec/report/blockers.md` (non-blocking note).
