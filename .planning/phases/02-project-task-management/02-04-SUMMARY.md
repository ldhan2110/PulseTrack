---
phase: 02-project-task-management
plan: 04
subsystem: ui
tags: [react, shadcn, tanstack-query, zustand, vite, typescript, vitest]

requires:
  - phase: 02-project-task-management
    provides: Backend REST API endpoints for projects, tasks, sprints, bugs, members, dashboard

provides:
  - Typed API client (lib/api.ts) for all 30+ backend endpoints
  - TypeScript domain types (lib/types.ts) for all entities
  - Zustand UI store (store/uiStore.ts) for sidebar collapse and backlog view state
  - 24 shadcn UI components installed (dialog, input, select, badge, table, card, etc.)
  - TanStack Query hooks for all 6 domains (useProjects, useTasks, useSprints, useBugs, useMembers, useDashboard)
  - Collapsible sidebar (256px expanded / 48px collapsed) with project list and project nav
  - Full routing for all 9 project routes nested under ProjectLayout
  - ProjectsPage with card grid, empty state, and create project dialog using FieldGroup composition
  - StatusBadge component using CSS color variables
  - useProjectRole hook for role-based UI rendering
  - useTasks unit tests with optimistic update test

affects:
  - 02-05 (Backlog page — uses useTasks, AppSidebar, ProjectLayout)
  - 02-06 (Sprint board — uses useSprints, useUpdateTaskStatus)
  - 02-07 (Bugs page — uses useBugs)
  - 02-08 (Dashboard — uses useDashboard)

tech-stack:
  added:
    - "@tanstack/react-table ^8.x — headless table for backlog"
    - "@dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities — Kanban drag-and-drop"
    - "recharts ^2.x — dashboard burndown chart"
    - "date-fns — sprint date formatting"
    - "sonner — toast notifications"
    - "shadcn 24 components installed from radix-nova preset"
  patterns:
    - "TanStack Query hooks follow useEntity(projectId) pattern with queryKey ['entity', projectId]"
    - "Optimistic updates in useUpdateTaskStatus: cancel queries, snapshot cache, update, rollback on error, invalidate on settled"
    - "Zustand store for UI-only state (sidebar collapse, backlog view toggle)"
    - "FieldGroup + Field composition for all forms (shadcn skill rules)"
    - "Placeholder pages export a component returning 'Page Name - Coming Soon'"

key-files:
  created:
    - apps/web/src/lib/api.ts
    - apps/web/src/lib/types.ts
    - apps/web/src/store/uiStore.ts
    - apps/web/src/hooks/useProjects.ts
    - apps/web/src/hooks/useTasks.ts
    - apps/web/src/hooks/useTasks.test.ts
    - apps/web/src/hooks/useSprints.ts
    - apps/web/src/hooks/useBugs.ts
    - apps/web/src/hooks/useMembers.ts
    - apps/web/src/hooks/useDashboard.ts
    - apps/web/src/hooks/useProjectRole.ts
    - apps/web/src/components/layout/AppSidebar.tsx
    - apps/web/src/components/layout/ProjectLayout.tsx
    - apps/web/src/components/projects/CreateProjectDialog.tsx
    - apps/web/src/components/tasks/StatusBadge.tsx
    - apps/web/src/pages/ProjectsPage.tsx
    - apps/web/src/pages/ProjectDashboardPage.tsx (placeholder)
    - apps/web/src/pages/BacklogPage.tsx (placeholder)
    - apps/web/src/pages/SprintsPage.tsx (placeholder)
    - apps/web/src/pages/SprintBoardPage.tsx (placeholder)
    - apps/web/src/pages/BugsPage.tsx (placeholder)
    - apps/web/src/pages/MembersPage.tsx (placeholder)
    - apps/web/src/pages/TaskDetailPage.tsx (placeholder)
    - apps/web/src/components/ui/ (24 shadcn components)
  modified:
    - apps/web/src/index.css (status/severity/bug CSS variables added)
    - apps/web/src/main.tsx (QueryClientProvider + Toaster added)
    - apps/web/src/App.tsx (full routing replacing minimal routing)
    - apps/web/package.json (new deps: react-table, dnd-kit, recharts, date-fns, sonner)

key-decisions:
  - "AppSidebar wraps shadcn SidebarProvider + Sidebar components, syncing state with Zustand uiStore via open/onOpenChange props"
  - "useUpdateTaskStatus is a separate mutation hook (not useUpdateTask) to enable cleaner Kanban drag handler code"
  - "CreateProjectDialog extracted as shared component used by both AppSidebar and ProjectsPage"
  - "lib/types.ts is a separate file from lib/api.ts to keep type definitions reusable without importing the API module"
  - "Optimistic update test uses pre-populated QueryClient cache + delayed API mock to test cache update timing"

patterns-established:
  - "All hooks import from @/lib/api and @/lib/types using path aliases"
  - "Mutations show toast.success on onSuccess and toast.error on onError via sonner"
  - "useProjectRole combines useMembers + useAuth to derive role — no separate API endpoint needed"

requirements-completed:
  - PROJ-01
  - PROJ-02

duration: 6min
completed: 2026-04-05
---

# Phase 2 Plan 04: Frontend Infrastructure Summary

**24 shadcn components installed, typed API client for 30+ endpoints, TanStack Query hooks for all 6 domains, collapsible sidebar with 256px/48px toggle, full routing for 9 project pages, and useTasks unit tests with optimistic update verification**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-05T19:35:29Z
- **Completed:** 2026-04-05T19:41:55Z
- **Tasks:** 2
- **Files modified:** 57

## Accomplishments

- Installed 24 shadcn/ui components (dialog, card, badge, table, sidebar, command, etc.) from radix-nova preset
- Created fully typed API client (`lib/api.ts`) and domain type definitions (`lib/types.ts`) covering all backend endpoints from Plans 01–03
- Created TanStack Query hooks for all 6 domains with caching, invalidation, optimistic updates, and toast feedback
- Built collapsible AppSidebar (256px expanded / 48px collapsed, 200ms ease-in-out) with project list, per-project nav, and Tooltip accessibility in collapsed state
- Established full React Router routing with ProjectLayout wrapping all 9 project routes
- Created ProjectsPage with responsive card grid (1/2/3 columns), empty state, and FieldGroup-composed create dialog
- 4 useTasks unit tests passing including optimistic update verification

## Task Commits

1. **Task 1: shadcn components, API client, CSS variables, stores** - `c1def64` (feat)
2. **Task 2: routing, sidebar, hooks, tests** - `9782957` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `apps/web/src/lib/api.ts` — Typed API client for all 30+ backend REST endpoints
- `apps/web/src/lib/types.ts` — TypeScript interfaces for all domain entities (Task, Sprint, Bug, Member, etc.)
- `apps/web/src/store/uiStore.ts` — Zustand store: sidebarCollapsed, activeProjectId, backlogView
- `apps/web/src/hooks/useProjects.ts` — useProjects, useProject, useCreateProject, useUpdateProject, useArchiveProject
- `apps/web/src/hooks/useTasks.ts` — useTasks, useTask, useCreateTask, useUpdateTask, useDeleteTask, useUpdateTaskStatus (with optimistic update)
- `apps/web/src/hooks/useTasks.test.ts` — 4 unit tests for useTasks (getTasks, createTask, optimistic update, deleteTask)
- `apps/web/src/hooks/useSprints.ts` — useSprints, useSprint, useCreateSprint, useActivateSprint, useCloseSprint
- `apps/web/src/hooks/useBugs.ts` — useBugs, useBug, useCreateBug, useUpdateBug, useDeleteBug
- `apps/web/src/hooks/useMembers.ts` — useMembers, useSearchUsers, useAddMember, useChangeMemberRole, useRemoveMember
- `apps/web/src/hooks/useDashboard.ts` — useDashboard
- `apps/web/src/hooks/useProjectRole.ts` — useProjectRole (derives canEdit/canManage from member role)
- `apps/web/src/components/layout/AppSidebar.tsx` — Collapsible sidebar using shadcn Sidebar components
- `apps/web/src/components/layout/ProjectLayout.tsx` — Layout with Outlet, active project tracking
- `apps/web/src/components/projects/CreateProjectDialog.tsx` — Create project dialog with FieldGroup form
- `apps/web/src/components/tasks/StatusBadge.tsx` — Badge with CSS color variable styling per 5 task statuses
- `apps/web/src/pages/ProjectsPage.tsx` — Projects list with card grid, empty state, create dialog
- `apps/web/src/pages/*.tsx` — 7 placeholder pages for project routes (Dashboard, Backlog, Sprints, SprintBoard, Bugs, Members, TaskDetail)
- `apps/web/src/index.css` — Added 14 CSS variables: status, severity, and bug color tokens
- `apps/web/src/main.tsx` — Added Toaster (already had QueryClientProvider)
- `apps/web/src/App.tsx` — Full routing replacing 2-route stub

## Decisions Made

- AppSidebar wraps shadcn SidebarProvider + Sidebar components, syncing state with Zustand uiStore via open/onOpenChange props to keep a single source of truth
- `useUpdateTaskStatus` is a dedicated mutation hook separate from `useUpdateTask` to provide a cleaner API for Kanban drag handlers in future plans
- `CreateProjectDialog` extracted as a shared component used by both AppSidebar (new project button) and ProjectsPage (header button)
- `lib/types.ts` kept separate from `lib/api.ts` so type imports don't pull in the fetch client
- Optimistic update test uses pre-populated QueryClient cache + delayed API mock to reliably test the cache update before resolution

## Deviations from Plan

None - plan executed exactly as written.

The one test failure (optimistic update) was a test authoring issue (two separate wrappers creating separate QueryClient instances). Fixed by pre-populating a shared QueryClient. The production hook code was correct throughout.

## Known Stubs

These placeholder pages are intentional per plan spec — they exist to prevent import errors and will be implemented in subsequent plans:

| File | Line | Reason |
|------|------|--------|
| `apps/web/src/pages/ProjectDashboardPage.tsx` | 1 | Implemented in Phase 2 Plan 05 |
| `apps/web/src/pages/BacklogPage.tsx` | 1 | Implemented in Phase 2 Plan 05 |
| `apps/web/src/pages/SprintsPage.tsx` | 1 | Implemented in Phase 2 Plan 06 |
| `apps/web/src/pages/SprintBoardPage.tsx` | 1 | Implemented in Phase 2 Plan 06 |
| `apps/web/src/pages/BugsPage.tsx` | 1 | Implemented in Phase 2 Plan 07 |
| `apps/web/src/pages/MembersPage.tsx` | 1 | Implemented in future plan |
| `apps/web/src/pages/TaskDetailPage.tsx` | 1 | Implemented in future plan |

## Issues Encountered

None.

## Next Phase Readiness

- Full frontend infrastructure in place — all hooks, routing, sidebar, and layout ready
- Plans 05–08 can directly import hooks (useTasks, useSprints, etc.) and use ProjectLayout
- StatusBadge component ready for use in Backlog table and Kanban cards
- Placeholder pages accept real implementations by replacing the stub component body

---
*Phase: 02-project-task-management*
*Completed: 2026-04-05*
