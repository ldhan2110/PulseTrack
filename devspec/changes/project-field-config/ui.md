# UI: project-field-config

**Mockups**: `mockups/configure-fields-dialog.html` (approved 2026-09-24)
**References**: sibling of existing Project Settings tabs (`apps/web/src/pages/ProjectSettingsPage.tsx`) and shadcn dialogs (`ProfileModal`, `CreateTaskDialog`)
**Style source**: tokens from `apps/web/src/index.css` (`:root` shadcn neutral/oklch — `--primary`, `--muted-foreground`, `--destructive`, `--border`, `--radius`); Tailwind 4 utility classes per project convention

## Entry point — General tab card
A `<Card>` in Project Settings → General tab, above/below existing cards:
```
  ┌───────────────────────────────────────────────┐
  │ Task fields                                    │
  │ Choose which fields appear on task create &    │
  │ detail forms.            [ Configure Fields ]  │
  └───────────────────────────────────────────────┘
```
Button `variant=outline`, `disabled={!canManage}`. Opens the dialog.

## Configure Fields dialog
Layout:
```
  ┌─ Configure Fields ────────────────────────┐
  │ Hidden fields won't show on task create &  │
  │ detail forms. Existing task data is kept.  │
  ├────────────────────────────────────────────┤
  │ Ticket type   [Required]           ( on )  │
  │ Assignee                           ( on )  │
  │ Priority                           ( on )  │
  │ Sprint                             ( on )  │
  │ Story points                       (off )  │
  │ Planned start date                 ( on )  │
  │ Planned end date                   ( on )  │
  │ Actual start date                  (off )  │
  │ Actual end date                    (off )  │
  │ ⚠ [warning row, only when a required       │
  │    field is toggled OFF]                    │
  ├────────────────────────────────────────────┤
  │                     [ Cancel ]  [ Save ]   │
  └────────────────────────────────────────────┘
```
Fields (v1, mapped to real `Task` columns): Ticket type (`taskTypeId`, Required badge), Assignee (`assigneeId`), Priority (`priority`), Sprint (`sprintId`), Story points (`storyPoints`), Planned start date (`plannedStartDate`), Planned end date (`plannedEndDate`), Actual start date (`actualStartDate`), Actual end date (`actualEndDate`). Each row = label + `<Switch>`.

States: default (toggles reflect saved config) | required-off (inline destructive warning: hiding Ticket type → new tasks saved with no ticket type) | saving (Save disabled + spinner, Cancel disabled) | error (destructive banner above footer, Save re-enabled to retry).

Interactions: toggling a Switch is local until Save. Toggling a Required field off reveals the warning row but does NOT block Save. Save persists all toggles → close on success. Cancel discards local changes. Re-open reflects last saved state.

Components (reuse, real `path:symbol`):
- `<Dialog>` / `DialogContent` / `DialogHeader` / `DialogTitle` / `DialogDescription` / `DialogFooter` — `apps/web/src/components/ui/dialog.tsx`
- `<Switch>` — `apps/web/src/components/ui/switch.tsx`
- `<Button>` (`variant=outline` trigger, `variant=ghost` Cancel, default Save) — `apps/web/src/components/ui/button.tsx`
- `<Badge>` (Required) — `apps/web/src/components/ui/badge.tsx`
- `<Label>` — `apps/web/src/components/ui/label.tsx`
- `<Card>`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent` for the General-tab entry card — `apps/web/src/components/ui/card.tsx`
- warning/error banner: reuse `<Alert variant=destructive>` — `apps/web/src/components/ui/alert.tsx`
