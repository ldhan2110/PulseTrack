# Design: delete-project

## Chosen approach
Soft delete via a nullable `Project.deletedAt` timestamp, gated by project ownership (not the permission system). Frontend hides the action from non-owners; backend independently enforces ownership. Visibility is enforced at the two project read entry points; children are hidden transitively (no project access ⇒ no route to their reads), so no per-child flag.

See `db.md` for the schema grid and migration verdict.

## Architecture

```
Owner in Project Settings › General
        │  (Danger Zone card renders only if user.id === project.ownerId)
        ▼
  AlertDialog confirm ──► useDeleteProject (react-query)
        │                       │ DELETE /projects/:projectId
        ▼                       ▼
   toast + navigate      ProjectsController.remove(@Req req)
   out of project          └─► ProjectsService.remove(projectId, req.user.id)
                                  ├─ load project
                                  ├─ ownerId !== userId ──► 403 Forbidden
                                  └─ set deletedAt = now()

Reads now filter deletedAt:
  GET /projects      → findAllForUser  → drop m.project.deletedAt (L120, next to archived)
  GET /projects/:id  → findOne         → deletedAt != null ⇒ 404 NotFound
```

## Key decisions

- **Owner gate, not permission.** Everything else in settings uses `can(resource, action)` via `ProjectRolesGuard`. Delete is deliberately owner-only, so it does **not** use `ProjectRolesGuard`/`@RequirePermission`. Ownership is checked in the service (`ownerId === req.user.id`), matching the existing `req.user.id` pattern (`projects.controller.ts:37,43`). No new guard — one endpoint doesn't justify one.
- **Soft not hard.** Preserves children (tasks/bugs/sprints/wiki/…) for admin recovery. Follows the existing soft-delete precedent (`ConversationMember.deletedAt`, schema L1268) — the intentional exception to the repo's hard-delete norm.
- **Enforce visibility at read entry points, not per child.** A soft-deleted project is unreachable, so its children need no flag. Two edits: `findAllForUser` filter + `findOne` guard.
- **Frontend gate is UX, backend gate is security.** Card absence for non-owners is convenience; the 403 in the service is the real boundary.
- **`deletedAt` distinct from `archived`.** Both kept, orthogonal. A project could in principle be archived then deleted; delete wins for visibility (filtered out regardless of archived).

## Rejected

- **New `OwnerGuard`** — over-engineered for a single endpoint; a service-level `ownerId` check is enough (YAGNI). Revisit if a second owner-only endpoint appears.
- **Hard delete** — irreversible, loses audit/recovery; contradicts the soft-delete requirement.
- **Reusing archive** — wrong gate (perm not owner) and wrong visibility (archived view still shows it); the whole point is "gone for everyone".
- **Cascading `deletedAt` to children** — unnecessary writes across many tables; transitive hiding already achieves it.

## Impact Area

### Decision Defaults (worker proceeds on these, no stall)
| Gray area | Default |
|---|---|
| Which guard for delete | JwtAuthGuard only (class-level) + service `ownerId` check; NOT ProjectRolesGuard |
| Non-owner hitting endpoint directly | `ForbiddenException` (403) |
| Fetch of a soft-deleted project | `NotFoundException` (404), same as a missing id |
| Confirm dialog style | plain Cancel / Delete AlertDialog (no "type project name" step) — see open question |
| After successful delete | close dialog, `toast.success`, `navigate` to projects list |
| Archived + then deleted | `deletedAt` filter applies regardless of `archived` |
| Already-deleted project deleted again | idempotent — 404 on load (already filtered), no error path needed beyond NotFound |
| Migration application to team DB | human applies (per repo pattern); worker verifies on scratch DB |

### Blast Radius
- `apps/api/prisma/schema.prisma` — `Project` model (+`deletedAt`).
- New migration dir `apps/api/prisma/migrations/<ts>_add_project_soft_delete/migration.sql`.
- `apps/api/src/projects/projects.service.ts` — `findAllForUser` (L120), `findOne` (L148), new `remove`.
- `apps/api/src/projects/projects.controller.ts` — new `@Delete(':projectId')` handler (`@Delete` already imported).
- `apps/web/src/lib/api.ts` — `deleteProject` (next to `archiveProject` L266).
- `apps/web/src/hooks/` — new `useDeleteProject` (mirror existing project hooks; react-query + sonner `onError`).
- `apps/web/src/pages/ProjectSettingsPage.tsx` — Danger Zone card in General `TabsContent`, owner-gated.
- Reuses `@/components/ui/{card,alert-dialog,button}`, `@/auth/useAuth`, `useNavigate`.

### Risk tags
- **reversibility**: soft delete is DB-reversible (admin) — low data-loss risk.
- **security**: owner gate MUST be server-enforced; frontend-only would be a hole → covered by req-2.
- **migration**: additive nullable column, no backfill → low risk.
- **regression**: read-path filter edits could over/under-filter → covered by req-3 tests.

## Open questions
- Confirm dialog: plain Cancel/Delete (default) or require typing the project name to enable Delete? Defaulted to plain; escalate only if BA wants the stronger gate.
