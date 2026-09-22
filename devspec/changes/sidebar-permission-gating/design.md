# Design: sidebar-permission-gating

## Chosen approach
Reuse the existing permission stack end to end — invent no new mechanism:

- `usePermissions(projectId).can(area, 'view')` already exists and fails closed
  while members load or when the role is unknown; system roles return `true`.
  (`apps/web/src/hooks/usePermissions.ts`)
- `AppSidebar` already holds `activeProjectId` (`useUiStore`), so it can call
  `usePermissions(activeProjectId)` directly.

Add an optional `area` field to each `NavItem`, then filter `PROJECT_NAV_ITEMS`
before render:

- **Leaf item**: visible when `item.area` is unset OR `can(item.area, 'view')`.
- **Parent with children** (Project Planner): filter its children first; the
  parent is visible when at least one child survives.

Extract the filter as a pure helper `filterNavByPermission(items, can)` so it is
unit-testable without rendering the whole sidebar.

Follows `patterns.md` (permission checks via `usePermissions`/`PermissionGate`)
and `conventions.md` (typed `PermissionArea`, no raw strings). Fits `rules.md`
fail-closed default.

### Nav item → permission area map
| Nav item          | area (`view`)      | note |
|-------------------|--------------------|------|
| Dashboard         | `dashboard`        | |
| Project Planner   | *(parent)*         | visible if any child visible |
| ↳ Scope Definition| `planner`          | |
| ↳ WBS             | `wbs`              | |
| Backlog           | `tasks`            | backlog is the task list |
| Sprints           | `sprints`          | |
| Test Cases        | `testCases`        | |
| Test Executions   | `testExecutions`   | |
| Bugs              | `bugs`             | |
| Reports           | `report`           | |
| Members & Groups  | `members`          | |
| Wiki              | `wiki`             | **new area** |
| Settings          | `projectSettings`  | |

### New `wiki` permission area
The Wiki nav item has no matching area today, so it cannot be gated. Add `wiki`:

- **web** `apps/web/src/lib/permissions.ts`: add `wiki: PermissionSet;` to
  `RolePermissions` and `{ key: 'wiki', label: 'Wiki' }` to `PERMISSION_AREAS`.
- **api** `apps/api/src/auth/permissions.ts`: add `wiki: PermissionSet;` to
  `RolePermissions` and a `wiki` entry to all three presets —
  `SYSTEM_ROLE_PERMISSIONS` (ALL_TRUE), `DEFAULT_MEMBER_PERMISSIONS` (VIEW_ONLY),
  `EMPTY_PERMISSIONS` (ALL_FALSE).
- `RolesPermissionsTab` iterates `PERMISSION_AREAS`, so the Wiki row + checkboxes
  appear automatically — no component change.

## Rejected approaches
- **Gate by route `path` string** — brittle: `backlog`≠`tasks`, two children both
  map off `planner`. An explicit area field is renames-safe and typed.
- **Add route-guard redirects instead of hiding** — out of scope; the ask is
  sidebar show/hide. Server already blocks the data.
- **Backfill every stored role JSON with `wiki`** — a data migration over a JSON
  column; rejected as unnecessary (fail-closed hides Wiki for stale roles until
  re-saved, which is safe). See open question.

## Open question (accepted default, no human block)
Existing custom roles' `permissions` JSON in the DB predates `wiki`, so it has no
`wiki` key. `hasPermission` returns `false` for a missing key → **Wiki is hidden
for those roles until an admin re-saves the role** (re-save writes the full
current shape incl. `wiki`). System roles are unaffected (bypass). This is the
safe fail-closed default; **no destructive migration** is specced. If product
later wants existing roles to default-show Wiki, that is a separate additive
backfill change.

## Architecture

```
Member opens project
        │
        ▼
AppSidebar (activeProjectId from uiStore)
        │  usePermissions(activeProjectId).can(area,'view')
        ▼
filterNavByPermission(PROJECT_NAV_ITEMS, can)
        │        ├─ leaf: show if !area || can(area,'view')
        │        └─ parent: show if any child survives
        ▼
render surviving items only
        ▲
        │ role.permissions[area].view   (isSystem ⇒ always true)
   RolesPermissionsTab checkbox grid ── writes ──▶ role.permissions (JSON)
        ▲
   PERMISSION_AREAS (now includes `wiki`)
```

## Impact Area

### Decision Defaults
| Gray area | Default the worker takes |
|-----------|--------------------------|
| Sidebar render while members still loading | `can` already returns `false` (fail closed) → items hidden until load resolves; matches existing `PermissionGate`. Do not add a spinner. |
| No `activeProjectId` (outside a project) | `PROJECT_NAV_ITEMS` block isn't rendered anyway; leave that branch untouched. |
| System role member | `can` returns `true` for all → sees every item, incl. Wiki. Correct. |
| Existing custom role missing `wiki` key | Fail-closed hide Wiki (see open question). No backfill. |
| Parent "Project Planner" with all children hidden | Hide the parent entirely (no empty expandable). |
| Collapsed-sidebar / tooltip rendering | Filtering happens before render, so collapsed mode shows the same reduced set; no separate logic. |
| New `wiki` defaults | SYSTEM=all true, DEFAULT_MEMBER=view only, EMPTY=all false — mirror the other read-mostly areas. |

### Blast Radius
- `apps/web/src/components/layout/AppSidebar.tsx` — add `area` to `NavItem`, add
  `usePermissions`, filter `PROJECT_NAV_ITEMS` (+ extract `filterNavByPermission`).
- `apps/web/src/lib/permissions.ts` — `wiki` in `RolePermissions` + `PERMISSION_AREAS`.
- `apps/api/src/auth/permissions.ts` — `wiki` in `RolePermissions` + 3 presets.
- Auto-affected, no edit: `RolesPermissionsTab` (renders new area), `PermissionGate`
  / `hasPermission` (already generic over area string).
- Not touched: API `@RequirePermission` route guards, DB schema/migrations, routing.

### Risk tags
- **Reversibility**: high — pure additive; revert = restore two files' prior nav
  render + drop the `wiki` entries.
- **Risk**: low-medium. Main hazard is over-hiding (a member who *should* see an
  item is hidden due to a wrong map entry or a stale role JSON). Mitigated by the
  unit test over `filterNavByPermission` + live verify with a role that has
  selective `view` boxes. Server-side data access is unchanged, so no security
  regression — hiding is UX, not the enforcement boundary.
