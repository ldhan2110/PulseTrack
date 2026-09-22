<!-- Team-agreed conventions not (yet) in code: naming, flow rules, process agreements. -->

## Always add audit fields to new DB tables
_captured: 2026-09-21_

When designing any new DB table/model, ALWAYS include audit fields.

For PulseTrack `@pm/api` (Prisma / postgresql), the audit quad on every new table:
- `createdBy String?` — user id, **plain string, no `Id` suffix, no FK relation** (pure audit; survives user deletion)
- `createdAt DateTime @default(now())`
- `updatedBy String?` — user id, plain string, no relation
- `updatedAt DateTime @updatedAt`

Column names are exactly `createdBy` / `updatedBy` (NOT `createdById`/`updatedById`, NOT legacy `CRE_USR_ID`/`UPD_USR_ID`).

Keep these audit columns **separate** from domain display FKs (e.g. `authorId`, `creatorId`, `userId`) that the app navigates to a `User` relation for name/avatar — those stay real `@relation` FKs; the audit pair is relation-free.

Standing rule for all future `db.md` / `schema.prisma` design in this repo.
