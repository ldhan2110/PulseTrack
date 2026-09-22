# Proposal: sidebar-permission-gating

## Why
The project already has a full RBAC system: each custom role carries a per-area
`view/create/update/delete` permission set, edited via the checkbox grid in
**Settings → Roles & Permissions** (`RolesPermissionsTab`). The backend enforces
these on every route (`@RequirePermission`), but the **left project sidebar
(`AppSidebar`) ignores them** — every nav item (Dashboard, Backlog, Sprints,
Bugs, Wiki, …) is rendered for every member regardless of their role's `view`
permission. A member with `bugs.view = false` still sees the Bugs link (and only
hits a wall when the API rejects them).

## What it delivers
Each project nav item in the sidebar is shown only when the current member's role
grants `view` on that item's permission area; otherwise the item is hidden. The
"checked view box" in the permissions grid becomes the switch that shows/hides the
matching sidebar entry. System roles (`isSystem`) keep seeing everything (they
already bypass all permission checks).

## Scope

**In**
- Gate every item in `PROJECT_NAV_ITEMS` (`AppSidebar.tsx`) by its area's `view`
  permission, using the existing `usePermissions(projectId).can(...)`.
- Map each nav item to a permission area (see design). Parent "Project Planner"
  is shown when any of its children is viewable.
- Add a new **`wiki`** permission area (web + api) so the Wiki nav item — which
  currently has no matching area — becomes gate-able and gets its own view
  checkbox in the permissions grid.

**Out**
- No change to non-project, top-level nav (My Tasks, Chat, project switcher,
  profile/footer) — those are not project-area-scoped.
- No change to route-level guards or the API `@RequirePermission` enforcement
  (already correct). This is sidebar visibility only; it does not replace
  server-side authorization.
- No backfill of existing custom roles' stored permission JSON for the new `wiki`
  key — see design open question (accepted fail-closed default).
- No new checkbox-grid UI work: `RolesPermissionsTab` already renders whatever is
  in `PERMISSION_AREAS`, so the new `wiki` area appears automatically.
