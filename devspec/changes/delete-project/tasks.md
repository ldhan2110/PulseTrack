# Tasks: delete-project

## 1. Schema + migration [req-1]
- [x] 1.1 [db] Add `deletedAt DateTime?` to `model Project` in `apps/api/prisma/schema.prisma` (next to `archived`)
- [x] 1.2 [db] Write additive migration `apps/api/prisma/migrations/<timestamp>_add_project_soft_delete/migration.sql` — `ALTER TABLE "Project" ADD COLUMN "deletedAt" TIMESTAMP(3);` (nullable, no backfill). Hand-authored per repo pattern; team DB applied by human.
Verify: apply migration on a scratch DB and assert `Project.deletedAt` exists nullable; existing rows have `deletedAt IS NULL`. `pnpm --filter @pm/api build` clean.

## 2. Owner-guarded delete endpoint [req-2]
- [x] 2.1 [service] Add `async remove(projectId: string, userId: string)` to `ProjectsService` (`apps/api/src/projects/projects.service.ts`) — load project (`findUnique`), if missing or `deletedAt != null` throw `NotFoundException`, if `ownerId !== userId` throw `ForbiddenException`, else `update` set `deletedAt: new Date()`
- [x] 2.2 [backend] Add `@Delete(':projectId')` handler to `ProjectsController` (`apps/api/src/projects/projects.controller.ts`) — class-level `JwtAuthGuard` only, **no** `ProjectRolesGuard`/`@RequirePermission`; `remove(@Req() req, @Param('projectId') id)` → `service.remove(id, req.user.id)`
- [x] 2.3 [test] `apps/api/src/projects/*.spec.ts`: owner → sets deletedAt; non-owner → 403; deletedAt unchanged on 403
Verify: `pnpm --filter @pm/api test` — owner deletes (deletedAt set), non-owner 403.

## 3. Hide soft-deleted from reads [req-3]
- [x] 3.1 [service] `findAllForUser` (`projects.service.ts:120`) — extend the archived filter to `.filter((m) => !m.project.archived && !m.project.deletedAt)`
- [x] 3.2 [service] `findOne` (`projects.service.ts:148`) — after fetch, if `deletedAt != null` throw `NotFoundException`
- [x] 3.3 [test] `apps/api/src/projects/*.spec.ts`: soft-deleted project absent from `findAllForUser`; `findOne` on it → 404; live project still listed + resolves
Verify: `pnpm --filter @pm/api test` — list excludes deleted, findOne 404 on deleted, live unaffected.

## 4. Web API client + hook [req-5]
- [x] 4.1 [frontend] Add `deleteProject: (id: string) => request<void>('/projects/${id}', { method: 'DELETE' })` to `apps/web/src/lib/api.ts` (next to `archiveProject`, L266)
- [x] 4.2 [frontend] Add `useDeleteProject(projectId)` hook in `apps/web/src/hooks/` (mirror existing project mutation hooks) — react-query `useMutation`, invalidate the projects list query, `onError` → `toast.error(...)` (sonner) per convention
Verify: `pnpm --filter @pm/web build` clean.

## 5. Owner-only Danger Zone UI [req-4, req-5]
- [x] 5.1 [frontend] In `apps/web/src/pages/ProjectSettingsPage.tsx` General `TabsContent`, append a Danger Zone card — reuse `Card`/`CardHeader`/`CardTitle`/`CardContent` from `@/components/ui/card`; render only when `user?.id === project.ownerId` (`user` from `useAuth()` `@/auth/useAuth`, `project.ownerId` already on the project)
- [x] 5.2 [frontend] Delete button — reuse `Button variant="destructive"` (`@/components/ui/button`) — opens confirm via `AlertDialog` + parts from `@/components/ui/alert-dialog`; dialog names the project and warns recovery is administrator-only (copy per `ui.md`)
- [x] 5.3 [frontend] Wire `useDeleteProject`: Delete action calls the mutation; while pending disable Cancel + Delete and show "Deleting…"; on success `toast.success('Project deleted')` + `useNavigate()` to the projects list; on error keep dialog (hook's `onError` toasts)
Verify: `/devspec-verify delete-project` (agent-browser: owner sees styled Danger Zone card + working AlertDialog confirm; computed CSS non-plain; confirm deletes and redirects; project gone from list).

## 6. Non-owner hidden — visual gate [req-4]
- [ ] 6.1 MANUAL: BA confirms a non-owner member's General tab shows no Danger Zone card (needs a second, non-owner account not guaranteed in the runner env)
Verify: MANUAL: BA approves non-owner screenshot (no Danger Zone card present).
