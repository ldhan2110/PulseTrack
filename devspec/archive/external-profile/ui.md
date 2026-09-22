# UI: external-profile

**Mockups**: `mockups/profile-modal.html` (approved 2026-09-22)
**References**: no user images; sibling to existing shadcn dialogs in the app.
**Style source**: tokens from `apps/web/src/index.css` (`--background`, `--primary`,
`--muted`, `--destructive`, `--border`, `--radius`); Geist Variable font; shadcn +
Tailwind 4 per `conventions.md` FE block.

## Trigger
Sidebar user footer (`apps/web/src/components/layout/AppSidebar.tsx`, footer near
line 389) gains a **Profile** item next to Logout. Clicking opens the modal.
Not a route.

## profile modal
Layout (single scrollable dialog):
```
┌─────────────────────────────────────┐
│ Profile                             │
│ Update your name, avatar, password. │
│                                     │
│ (avatar)  [ Upload avatar ]         │
│           PNG/JPG up to 5MB         │
│                                     │
│ Display name  [________________]    │
│ Email         [____ disabled ___]   │  ← read-only, "can't be changed"
│ ───────────────────────────────     │
│ Change password                     │
│ Current password [____________]     │
│ New password     [____________]     │  ← hint "at least 8 characters"
│ Confirm new pw   [____________]     │
│                                     │
│              [ Cancel ] [ Save ]    │
└─────────────────────────────────────┘
```

States:
- **empty/default** — external user; fields editable, prefilled with current name/avatar.
- **saving** — all inputs + buttons disabled; Save shows spinner + "Saving…".
- **error** — red alert at top (e.g. "Current password is incorrect."); offending
  field border turns `--destructive`. Also covers name/avatar/validation errors.
- **internal read-only** — "🔒 Managed by SSO" note; all fields disabled; no
  password section; footer shows **Close** only (no Save).

Interactions:
- Avatar "Upload avatar" opens the browser file picker; on select, uploads and
  shows the new image. No crop/resize UI.
- Name save + password change submit together on **Save changes**; password
  fields are optional — empty password fields = name/avatar-only save.
- Confirm-password must match new password (client check before submit).
- Success → close modal, refresh the cached current user so sidebar avatar/name
  update immediately.

Gating:
- Modal content branches on `user.userType`. `EXTERNAL` → editable form above.
  `INTERNAL` → read-only variant.

## Components to reuse (real path:symbol)
- `<Dialog>` / `<DialogContent>` / `<DialogHeader>` / `<DialogTitle>` /
  `<DialogDescription>` / `<DialogFooter>` — `apps/web/src/components/ui/dialog.tsx`
- `<Avatar>` / `<AvatarImage>` / `<AvatarFallback>` — `apps/web/src/components/ui/avatar.tsx`
- `<Input>` — `apps/web/src/components/ui/input.tsx`
- `<Label>` — `apps/web/src/components/ui/label.tsx`
- `<Button>` (`variant="default"` primary, `variant="outline"`, `variant="ghost"`) —
  `apps/web/src/components/ui/button.tsx`

Build the modal from these; `devspec-verify` flags a plain one-off if it doesn't
match the project's dialog styling.
