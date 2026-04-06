# Sidebar & URL UX Improvements — Design Spec

**Date:** 2026-04-06
**Status:** Approved

---

## Overview

Four targeted UX fixes for the PM app:

1. Sidebar expand button is inaccessible when collapsed
2. No logout button in the sidebar
3. Project URLs show raw UUIDs instead of a human-readable prefix
4. Task URLs show raw UUIDs instead of the task key (e.g., `HRM-1`)

---

## 1. Sidebar Expand Button Fix

### Problem

`AppSidebar` uses `collapsible="icon"` (shadcn/ui). The collapse toggle button exists in the footer but is placed in a second child `div` below the user info row. The footer has a fixed `h-12` class, causing the second element to overflow and be clipped. The logo click also toggles the sidebar when collapsed, but this is invisible UX with no affordance.

### Solution

Move the collapse/expand toggle button into the **sidebar header**.

- **Expanded state:** Header row = `[logo icon + "PulseTrack" text] [ChevronLeft toggle button]`
- **Collapsed state:** Header row = `[ChevronRight toggle button]` (centered)
- Remove the collapse button from the footer entirely (both expanded and collapsed variants)
- The logo click behavior (navigate to `/` when expanded, toggle when collapsed) is removed in favour of consistent click-to-navigate, with the toggle exclusively on the dedicated button

This matches the pattern used by Linear, Notion, and other tools — the toggle lives at the top where it's always in view.

---

## 2. Logout Button

### Problem

The `logout` function is available via `useAuth()` but is only wired up on the `AccessDeniedPage`. The main sidebar has no logout affordance.

### Solution

Add a logout icon button to the **sidebar footer**, after the user info.

- **Expanded state:** `[avatar] [username truncated] ... [LogOut icon button]`
- **Collapsed state:** `[avatar with tooltip]` on its own row, `[LogOut icon button with tooltip "Sign out"]` below it
- Use the `LogOut` icon from `lucide-react`
- Calls `keycloak.logout({ redirectUri: window.location.origin })` via `useAuth().logout`
- Button styled as `variant="ghost" size="icon"` to match the existing collapse button

---

## 3. Project URLs — Prefix Instead of UUID

### Problem

All project routes use `:projectId` (UUID), producing URLs like:
```
/projects/cm9abc123def456ghi/dashboard
```

### Solution

Replace `:projectId` with `:projectPrefix` in all frontend routes, using the project's `prefix` field (2–10 uppercase letters, e.g., `HRM`).

**New URL pattern:**
```
/projects/HRM/dashboard
/projects/HRM/backlog
/projects/HRM/sprints
/projects/HRM/members
/projects/HRM/settings
```

**Why `prefix` and not slugified name:**
- `prefix` is already unique (DB unique constraint)
- Already short and uppercase (ideal for URLs)
- Backend already has `GET /projects/by-prefix/:prefix` and `findByPrefix()` service method
- Frontend already has `api.getProjectByPrefix(prefix)` in `api.ts`

**Implementation approach:**
- `ProjectLayout` reads `projectPrefix` from `useParams()`, calls `getProjectByPrefix(prefix)` once on mount, stores the resolved project (including its UUID) in React Query cache and/or context
- All internal API calls continue using `project.id` (UUID) — no backend changes needed for projects
- `AppSidebar` navigates using `project.prefix` instead of `project.id`
- All `useParams()` consumers that read `projectId` switch to `projectPrefix` and use the resolved project ID from context

**Edge case:** Projects created without a prefix default to `'US'` (enforced in `ProjectsService.create`). If somehow a project lacks a prefix, fall back to UUID in navigation.

**Project resolution context:**

`ProjectLayout` will resolve the project and make it available to child routes via a React context (`ProjectContext`), so child pages call `useProject()` to get `{ project }` rather than re-fetching by prefix themselves.

---

## 4. Task URLs — Task Key Instead of UUID

### Problem

Task detail routes use `:taskId` (UUID), producing URLs like:
```
/projects/HRM/tasks/cm9xyz789abc
```

### Solution

Replace `:taskId` with `:taskKey` in the task detail route, using the task's `taskKey` field (e.g., `HRM-1`).

**New URL pattern:**
```
/projects/HRM/tasks/HRM-1
```

**Backend change (one new endpoint):**

Add to `TasksController`:
```
GET /projects/:projectId/tasks/by-key/:taskKey
```
This delegates to the existing `tasksService.findByTaskKey(taskKey)` which already exists. Note: NestJS route ordering requires this before `GET :taskId` to avoid conflict.

Add to `api.ts`:
```ts
getTaskByKey: (projectId: string, taskKey: string) =>
  request<Task>(`/projects/${projectId}/tasks/by-key/${taskKey}`)
```

**Frontend changes:**

- `App.tsx` route: `/projects/:projectPrefix/tasks/:taskKey`
- `TaskDetailPage`: reads `taskKey` from params, fetches via `useTaskByKey(projectId, taskKey)`, uses `task.id` (UUID) for all mutations
- `KanbanCard.tsx`: navigate to `task.taskKey` instead of `task.id`
- `TasksTable.tsx`: same as above
- `useTasks.ts`: add `useTaskByKey(projectId, taskKey)` hook

**Edge case:** Tasks without a `taskKey` (e.g., created before prefix was set) fall back to UUID in navigation.

---

## Files Changed

### Backend
| File | Change |
|------|--------|
| `apps/api/src/tasks/tasks.controller.ts` | Add `GET :taskId/by-key/:taskKey` route — wait, actually `GET by-key/:taskKey` before the `GET :taskId` route |

### Frontend
| File | Change |
|------|--------|
| `apps/web/src/App.tsx` | Routes: `:projectId` → `:projectPrefix`, `:taskId` → `:taskKey` |
| `apps/web/src/components/layout/ProjectLayout.tsx` | Resolve project by prefix, provide via context |
| `apps/web/src/components/layout/AppSidebar.tsx` | Toggle in header, logout in footer, nav uses prefix |
| `apps/web/src/pages/TaskDetailPage.tsx` | Fetch by taskKey, use task.id for mutations |
| `apps/web/src/hooks/useTasks.ts` | Add `useTaskByKey` hook |
| `apps/web/src/lib/api.ts` | Add `getTaskByKey` function |
| `apps/web/src/components/tasks/KanbanCard.tsx` | Navigate using `task.taskKey` |
| `apps/web/src/components/tasks/TasksTable.tsx` | Navigate using `task.taskKey` |

---

## Non-Goals

- Bugs URLs are not changed (bugs use a different ID system)
- Sprint URLs are not changed
- No redirect/aliasing from old UUID URLs to new prefix URLs (internal POC, no need)
- No URL slug based on project name
