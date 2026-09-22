# Verify: dual-auth (app vs mockup) — PASS

Live check via agent-browser against web `localhost:5173` (HMR) + API `localhost:3000`
running on a **migrated scratch DB** (team DB untouched). All three screens + states render.

## login — PASS  (verify/login.png, verify/login-error.png)
- both actions present: `Sign in with company account` (Keycloak) + email/password form
- frosted Card matches mockup: `background oklch(1 0 0 / .82)`, `backdrop-filter blur(12px)`, `width 404px`, box-shadow match
- company button = primary (`bg oklch(0.205 0 0)`), sign-in = outline — match mockup btn-primary/btn-outline
- error state: destructive Alert visible, text "Invalid email or password" (generic, no disclosure)

## set-password — PASS  (verify/set-password-invalid.png, verify/set-password-form.png)
- no/blank token → invalid state: "This link is invalid or has expired", no form
- with token → form: new + confirm password inputs, "Set password & sign in"

## forgot-password — PASS  (verify/forgot.png, verify/forgot-sent.png)
- email input + "Send reset link"
- submit → neutral sent state "Check your email" (anti-enumeration)

## Resolved during verify
- [x] `.authx-card` background: mockup `oklch(1 0 0 / .82)`, app was `oklch(0.205 0 0 / .82)` under a dark-OS browser — AuthShell used `@media (prefers-color-scheme: dark)`, but PulseTrack drives dark mode with a `.dark` **class** (`@custom-variant dark` in index.css). Fixed to `.dark .authx-card { … }`; re-checked → card now `oklch(1 0 0 / .82)`, matches mockup and is theme-consistent with the app.

## Note — advisory BA gate
ui.md mentions a "MANUAL: BA approves screenshot" for the bubble background look, but tasks.md
§8/§9 encode no `MANUAL:` subtask — the verify line is `/devspec-verify`. Screenshots under
`verify/` are provided for a human to eyeball the bubble aesthetic.
