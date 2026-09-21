<!-- Team-agreed conventions not (yet) in code: naming, flow rules, process agreements. -->

## Always add audit fields to new DB tables
_captured: 2026-09-21_

When designing any new DB table/model, ALWAYS include audit fields.

For PulseTrack `@pm/api` (Prisma / postgresql):
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`
- an actor FK for "who created" — `creatorId` / `createdById` / `senderId` → `User` relation, following the existing `Task` / `User` pattern.

**Not** the legacy `CRE_USR_ID` / `UPD_USR_ID` string-column pattern — that belongs to the `caris_upgrade` project, not `@pm/api`.

Add `updatedBy`-style actor tracking only where an entity is meaningfully edited by someone other than its creator (most tables don't need it — the creator FK + `updatedAt` suffice).

Standing rule for all future `db.md` / `schema.prisma` design in this repo.
