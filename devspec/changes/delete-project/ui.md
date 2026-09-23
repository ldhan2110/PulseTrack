# UI: delete-project

**Mockups**: `mockups/danger-zone.html` (approved 2026-09-23)
**References**: sibling of existing `apps/web/src/pages/ProjectSettingsPage.tsx` General tab cards
**Style source**: oklch tokens from `apps/web/src/index.css` (`--card`, `--border`, `--destructive`, `--muted-foreground`, `--radius`); Tailwind 4 + shadcn per `conventions.md` FE block. Destructive button look from `apps/web/src/components/ui/button.tsx` (`variant="destructive"` = subtle `bg-destructive/10 text-destructive`).

## Danger Zone card — Project Settings › General tab (owner only)

Layout (appended at bottom of the General `TabsContent`, after existing cards):
```
┌─ Danger Zone ─────────────────────────────── (red-tint border) ┐
│ Irreversible actions for this project.                          │
│                                                                 │
│ Delete this project                          [ Delete project ] │
│ Hides the project from everyone incl members.                   │
│ Data kept but inaccessible. Admin-only recovery.                │
└─────────────────────────────────────────────────────────────────┘
```

**Render gate**: card mounts only when `user?.id === project.ownerId`. Non-owner → card absent (not disabled — not in the tree at all).

Confirm dialog (shadcn AlertDialog) on "Delete project":
```
┌───────────────────────────────────────┐
│ Delete "Apollo Platform"?             │
│ Hides project from all members and you.│
│ Data preserved but unreachable in app. │
│ Cannot be undone from the app — admin  │  ← destructive-colored
│ only can restore.                      │
│                   [ Cancel ] [ Delete ]│
└───────────────────────────────────────┘
```

**States**:
- default — card shown, button idle
- confirm open — AlertDialog with project name in title, admin-recovery warning in destructive color
- deleting — Cancel + Delete disabled, Delete shows spinner + "Deleting…"
- success — dialog closes, `toast.success("Project deleted")` (sonner), redirect out of project → projects list
- error — dialog stays, `toast.error(...)` (per `onError` convention)
- non-owner — card not rendered

**Interactions**: button → open AlertDialog. Delete → mutation. Cancel/overlay → close, no-op.

**Components (reuse, real path:symbol — do NOT hand-roll)**:
- `Card`/`CardHeader`/`CardTitle`/`CardContent` — `@/components/ui/card`
- `AlertDialog` + `AlertDialogTrigger`/`Content`/`Header`/`Title`/`Description`/`Footer`/`Cancel`/`Action` — `@/components/ui/alert-dialog`
- `Button` `variant="destructive"` — `@/components/ui/button`
- toast via `sonner` (`toast.success`/`toast.error`) per `conventions.md`
- current user via `useAuth()` (`@/auth/useAuth`) → `user.id`; owner from `project.ownerId`
- redirect via `useNavigate()` (react-router-dom 7)
