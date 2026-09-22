# Tasks: sidebar-permission-gating

## 1. Add `wiki` permission area [req-4]
- [x] 1.1 [frontend] `apps/web/src/lib/permissions.ts` — add `wiki: PermissionSet;` to `RolePermissions` interface and `{ key: 'wiki', label: 'Wiki' }` to `PERMISSION_AREAS`
- [x] 1.2 [backend] `apps/api/src/auth/permissions.ts` — add `wiki: PermissionSet;` to `RolePermissions` and a `wiki` entry to `SYSTEM_ROLE_PERMISSIONS` (ALL_TRUE), `DEFAULT_MEMBER_PERMISSIONS` (VIEW_ONLY), `EMPTY_PERMISSIONS` (ALL_FALSE)
Verify: `pnpm --filter @pm/web build && pnpm --filter @pm/api build` (both typecheck clean with the new key)

## 2. Gate sidebar nav items by view permission [req-1] [req-2] [req-3]
- [x] 2.1 [frontend] `AppSidebar.tsx` — add optional `area?: PermissionArea` to the `NavItem` interface; set it on each entry in `PROJECT_NAV_ITEMS` per the design map (Dashboard→dashboard, Backlog→tasks, Sprints→sprints, Test Cases→testCases, Test Executions→testExecutions, Bugs→bugs, Reports→report, Members & Groups→members, Wiki→wiki, Settings→projectSettings; children Scope Definition→planner, WBS→wbs; leave the "Project Planner" parent with no `area`)
- [x] 2.2 [frontend] Add a pure helper `filterNavByPermission(items, can)` in `AppSidebar.tsx` — for each item: keep a leaf when `!item.area || can(item.area, 'view')`; for a parent with `children`, filter children first and keep the parent only if ≥1 child remains
- [x] 2.3 [frontend] In `AppSidebarInner`, call `usePermissions(activeProjectId)` and render `filterNavByPermission(PROJECT_NAV_ITEMS, can)` instead of the raw list; do not touch the top-level My Tasks / Chat / project-switcher / footer nav
- [x] 2.4 [test] `apps/web/src/components/layout/AppSidebar.test.tsx` (or a `filterNavByPermission` unit test) — assert: bugs hidden when `bugs.view=false`; all items shown when `can` returns true (system role); Project Planner hidden when both planner+wbs denied; Project Planner shown with only WBS child when planner denied & wbs granted; item with no `area` always shown
Verify: `pnpm --filter @pm/web test -- AppSidebar`

## 3. Live visual check [req-1] [req-3] [req-4]
- [ ] 3.1 [frontend] Reuse existing sidebar rendering only — no new component; confirm collapsed-sidebar mode also shows the reduced set (filtering runs before render)
Verify: `/devspec-verify sidebar-permission-gating` (agent-browser: with a role whose view boxes are selectively unchecked — e.g. bugs.view off, wiki.view off — the Bugs and Wiki items are absent from the sidebar; a system/admin user still sees the full list; Project Planner collapses when both planner+wbs are off)
