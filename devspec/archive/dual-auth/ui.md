# UI: dual-auth

**Mockups**: `mockups/login.html`, `mockups/set-password.html`, `mockups/forgot-password.html` (approved 2026-09-22)
**References**: real logo `apps/web/public/images/logo.png` (copied to `mockups/logo.png`); siblings existing shadcn primitives in `apps/web/src/components/ui/`.
**Style source**: tokens copied from `apps/web/src/index.css` (`:root` — `--primary`, `--muted-foreground`, `--destructive`, `--border`, `--radius`, all neutral oklch). `--brand`/`--brand2`/`--brand3` (`#4b3ff0`/`#9e93f5`/`#170f49`) are sampled from the logo for the background bubbles only — **not** existing CSS tokens; the real build should introduce them as tokens or keep them local to the auth pages. Styling = Tailwind 4 + shadcn per `conventions.md` FE block.

Pages live in `apps/web/src/pages/` (`*Page.tsx`), routed in `App.tsx` (react-router-dom 7), reachable **without** the `ProtectedRoute` wrapper.

## Shared shell (all three screens)
- Full-viewport gradient background + 4 animated blurred bubbles in the logo palette.
- Centered frosted `Card` (`components/ui/card.tsx`), ~404px, `backdrop-blur`.
- Brand row: real `logo.png` (34px) + "CareOne" wordmark in navy `--brand3`.
- Leading input icons (lucide-react — already a dep via shadcn): `Mail`, `Lock`.

## login (`LoginPage.tsx`)
Layout:
```
┌──────────────────────────────┐
│ [logo] CareOne               │
│ Sign in to continue          │
│ [ ✉ Sign in with company ]   │  ← primary (Keycloak, internal)
│ ──── or with email ────      │
│ ✉ Email    [____________]    │
│ 🔒 Password [____________]   │
│              Forgot password?│
│ [ Sign in ]                  │  ← outline (external email/password)
└──────────────────────────────┘
```
States: empty | submitting (email button disabled + spinner) | error (destructive `Alert` above fields, inputs red).
Interactions:
- "Sign in with company account" → `keycloak.login()` (existing PKCE). Unchanged internal path.
- Email form → `POST /auth/login`. Enter submits. Success → redirect to `/`.
- "Forgot password?" → `/forgot-password`.
Components: reuse `<Card>` (`components/ui/card.tsx`), `<Button variant="default">` + `<Button variant="outline">` (`components/ui/button.tsx`), `<Input>` (`components/ui/input.tsx`), `<Label>` (`components/ui/label.tsx`), `<Alert variant="destructive">` (`components/ui/alert.tsx`). Bubble background is a new local element (no existing component).

## set-password (`SetPasswordPage.tsx`) — invite link + reset link land here
Reads token from URL (`/set-password?token=…`).
States: empty (new + confirm password, 8-char hint) | submitting | error (mismatch/weak → destructive `Alert`) | **invalid/expired token** (no form: red ✕ icon, generic message, back-to-sign-in link).
Interactions: submit → `POST /auth/set-password {token, newPassword}`. Success → auto sign-in + redirect `/`.
Security copy: invalid-token state is generic (no "user not found") — no account disclosure.
Components: same primitives; invalid-token panel is a centered message block (icon + text), no form.

## forgot-password (`ForgotPasswordPage.tsx`)
States: empty (email) | submitting | **sent** (neutral confirmation — "if an account exists…", never confirms the address is registered = anti-enumeration).
Interactions: submit → `POST /auth/forgot-password {email}`. Always shows the same neutral "sent" state regardless of whether the email maps to an external user.
Components: `<Card>`, `<Input>`, `<Button>`; sent-state is a centered message block (mail icon + text).

## Verify
`/devspec-verify dual-auth` — agent-browser against the running app: each page's regions/inputs exist, styling is not browser-default (frosted card, brand logo present), the login page shows both the company button and the email form, and the error/sent/invalid-token states render. Plus a `MANUAL: BA approves screenshot` visual gate for the bubble background look.
