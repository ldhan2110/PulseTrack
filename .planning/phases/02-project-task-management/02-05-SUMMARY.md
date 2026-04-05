---
phase: 02-project-task-management
plan: 05
subsystem: ui
tags: [react, shadcn, recharts, tanstack-query, typescript, date-fns]

requires:
  - phase: 02-project-task-management
    plan: 04
    provides: useDashboard, useMembers, useProjectRole hooks, ProjectLayout, shadcn components

provides:
  - ProjectDashboardPage with stat cards, burndown chart, active sprint progress, and recent activity feed
  - StatCard component with Display typography and danger/warning variants
  - BurndownChart using Recharts LineChart with ideal/actual lines
  - RecentActivity scrollable feed with date-fns relative timestamps
  - MembersPage with table, add/remove, and role management (canManage gated)
  - MembersTable with Avatar, role Badge, DropdownMenu, AlertDialog removal confirmation
  - AddMemberDialog with Command combobox user search, FieldGroup form composition

affects:
  - 02-06 (Sprint board — dashboard now functional, members setup ready)
  - 02-07 (Bugs page — same page pattern established)

tech-stack:
  added:
    - "alert-dialog shadcn component — confirmation dialogs for destructive actions"
  patterns:
    - "BurndownPoint[] from API mapped to ideal/actual by linear interpolation in page component before passing to chart"
    - "DashboardData.recentActivity.ActivityItem mapped to display shape in ProjectDashboardPage (description/user.name flattening)"
    - "FieldGroup + Field pattern reproduced locally in each dialog component (no shadcn-native FieldGroup in this project)"
    - "AlertDialog for remove member confirmation with Cancel (no data loss) per UI-SPEC copywriting"

key-files:
  created:
    - apps/web/src/pages/ProjectDashboardPage.tsx
    - apps/web/src/components/dashboard/StatCard.tsx
    - apps/web/src/components/dashboard/BurndownChart.tsx
    - apps/web/src/components/dashboard/RecentActivity.tsx
    - apps/web/src/pages/MembersPage.tsx
    - apps/web/src/components/members/MembersTable.tsx
    - apps/web/src/components/members/AddMemberDialog.tsx
    - apps/web/src/components/ui/alert-dialog.tsx
  modified: []

key-decisions:
  - "BurndownPoint API type has only remaining (not ideal/actual) — ideal line computed in ProjectDashboardPage via linear interpolation from start points to 0; BurndownChart receives { date, ideal, actual }[] shape"
  - "FieldGroup/Field implemented as local lightweight components in each dialog/form (no shadcn-native FieldGroup installed) matching the pattern established in CreateProjectDialog"
  - "AlertDialog remove confirmation uses Cancel (not Discard) per UI-SPEC — no user-entered data in the confirmation dialog"
  - "alert-dialog shadcn component installed as deviation Rule 2 (required for destructive member removal confirmation)"

requirements-completed:
  - PROJ-01
  - PROJ-02
  - SPRT-03

duration: 4min
completed: 2026-04-05
---

# Phase 2 Plan 05: Dashboard and Members Pages Summary

**Project dashboard with 4 stat cards (Display typography), Recharts burndown chart with ideal/actual lines, active sprint progress bar, and recent activity feed; plus a Members page with searchable combobox add dialog, DropdownMenu role management, and AlertDialog removal confirmation — all gated by useProjectRole**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-05T12:43:00Z
- **Completed:** 2026-04-05T12:47:26Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Created `ProjectDashboardPage` with full UI-SPEC layout: 4-col stat cards (responsive 2/1), 60/40 burndown+sprint row, full-width recent activity
- `StatCard` uses Display typography (28px, 600 weight, -0.03em tracking), Label typography for title, Card composition
- `BurndownChart` wraps Recharts `LineChart` in `ResponsiveContainer`, two lines: ideal (dashed, muted) / actual (solid, primary), date-fns formatted X-axis, empty state
- `RecentActivity` uses `ScrollArea` (max-h 400px), `formatDistanceToNow`, bug/task icons, empty state, max 20 items
- `MembersPage` with `useMembers` + `useProjectRole`, header with gated "Add Member" button, loading skeleton (5 rows), empty state with `Users` icon per UI-SPEC
- `MembersTable` with Avatar (initials fallback), role Badge, `formatDistanceToNow` joined date, DropdownMenu per-row for role change + remove
- `AlertDialog` for member removal with correct copy: "Remove [Name] from this project? They will lose access to all project data." — Cancel / Remove (destructive)
- `AddMemberDialog` with `Command` combobox searching users (useSearchUsers, enabled at >=2 chars), `FieldGroup` form composition, role `Select`, Discard/Add buttons

## Task Commits

1. **Task 1: Project dashboard page** - `954fabb` (feat)
2. **Task 2: Members page with table, add/remove, role management** - `1d694a0` (feat)

## Files Created/Modified

- `apps/web/src/pages/ProjectDashboardPage.tsx` — Full dashboard page with stat cards, burndown, sprint progress, activity feed
- `apps/web/src/components/dashboard/StatCard.tsx` — Stat card with Display number, Label title, icon, danger/warning variants
- `apps/web/src/components/dashboard/BurndownChart.tsx` — Recharts burndown with ideal/actual lines, date-fns X-axis, empty state
- `apps/web/src/components/dashboard/RecentActivity.tsx` — Scrollable activity list with icons, relative timestamps, empty state
- `apps/web/src/pages/MembersPage.tsx` — Members page with loading/empty states and Add Member button (PM-gated)
- `apps/web/src/components/members/MembersTable.tsx` — Table with avatar, role badge, joined date, action dropdown, remove confirmation
- `apps/web/src/components/members/AddMemberDialog.tsx` — Add member dialog with Command combobox search and FieldGroup role select
- `apps/web/src/components/ui/alert-dialog.tsx` — Installed alert-dialog shadcn component

## Decisions Made

- `BurndownPoint[]` API type only carries `remaining` — ideal line is derived in `ProjectDashboardPage` by linear interpolation (start → 0 over burndown length), then passed as `{ date, ideal, actual }[]` to `BurndownChart`
- `FieldGroup`/`Field`/`FieldLabel` implemented as lightweight local components matching the pattern from `CreateProjectDialog` — no shadcn-native equivalent installed
- AlertDialog for member removal uses "Cancel" (not "Discard") per UI-SPEC copywriting contract — no user-entered data in the confirmation dialog
- `alert-dialog` component installed (was missing, needed for member removal — Rule 2 auto-add)

## Deviations from Plan

### Auto-added Missing Critical Functionality

**1. [Rule 2 - Missing Component] Installed alert-dialog shadcn component**
- **Found during:** Task 2 (MembersTable AlertDialog for remove confirmation)
- **Issue:** `alert-dialog` was not in the installed shadcn components list but is required for the destructive member remove confirmation pattern
- **Fix:** Ran `pnpm dlx shadcn@latest add alert-dialog`
- **Files modified:** `apps/web/src/components/ui/alert-dialog.tsx`
- **Commit:** 954fabb (included in Task 1 commit alongside the component files)

## Known Stubs

None — all placeholder pages replaced with real implementations. The following were the placeholder stubs from Plan 04 that this plan resolved:

- `apps/web/src/pages/ProjectDashboardPage.tsx` — now fully implemented
- `apps/web/src/pages/MembersPage.tsx` — now fully implemented

## Issues Encountered

None.

## Next Phase Readiness

- Dashboard and Members pages are production-ready implementations
- Plans 06–07 (Sprints board, Bugs page) can follow the same page layout pattern established here
- `alert-dialog` component now available for any future destructive confirmation dialogs

---
*Phase: 02-project-task-management*
*Completed: 2026-04-05*
