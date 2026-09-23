# DB: delete-project

**Source**: file-derived (`apps/api/prisma/schema.prisma` + `apps/api/src/projects/projects.service.ts`) — no DB MCP reachable; may drift from prod.
**Dialect**: postgresql (schema uses `String[]` array columns — Postgres-only)
**Migration tool**: Prisma, hand-authored SQL under `apps/api/prisma/migrations/<timestamp>_<name>/migration.sql` (per prior changes: `..._add_chat_member_soft_close`, `..._dual_auth_user_fields`). Team DB applied by a human; verify on scratch DB.

## Tables touched

### Project  (exists)
| col | type | null | default | note |
|-----|------|------|---------|------|
| id | text (cuid) | no | — | PK |
| archived | boolean | no | false | **exists** — separate soft-hide (in-app restore). NOT reused. |
| ownerId | text | **no** | — | required FK → User.id. Every project always has an owner → no ownerless case. |
| deletedAt | timestamptz | **add** | — | new, nullable. `null` = live, non-null = soft-deleted. No backfill. |

`deletedAt` is the second soft-delete exception to the repo's hard-delete norm (first: chat `ConversationMember.deletedAt`, schema L1268). Consistent precedent.

## Impact
- `ProjectsService.findAllForUser` (`apps/api/src/projects/projects.service.ts:120`) — currently `.filter((m) => !m.project.archived)`; add `&& !m.project.deletedAt` so soft-deleted projects drop from every member's list (owner included).
- `ProjectsService.findOne` (`apps/api/src/projects/projects.service.ts:148`) — `findUnique` by id; after fetch, treat `deletedAt != null` as not found (throw `NotFoundException`) so detail + all nested reads 404.
- Children (tasks, bugs, sprints, members, wiki, aiConfig, …) **untouched** — hidden transitively (no project access ⇒ no route to children). No cascade flag needed. This is the point of soft delete.
- Other `project.findUnique` sites — `:32` (prefix uniqueness on create, unaffected), `:195` (unarchive). Not visibility-listing paths; out of scope unless a deleted project must reject archive/unarchive (edge, defer).
- New `remove`/`softDelete` writer sets `deletedAt: new Date()` guarded by `ownerId === caller` (see spec).

## Migration verdict
**Additive, safe.** One nullable column on `Project`. No backfill (null = existing live projects, correct default). No constraint change, no data reshape, no destructive op.

## Open questions
- None on schema. Recovery = DB-only by admin (`UPDATE "Project" SET "deletedAt" = NULL`), not in scope as an app feature.
