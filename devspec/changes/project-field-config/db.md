# DB: project-field-config

## Touched table
`Project` (`apps/api/prisma/schema.prisma:253`).

## Change
Add one nullable JSON column — same pattern as the existing `Project.workflowLayout Json?` (`schema.prisma:278`):

```prisma
fieldConfig Json?   // { <fieldKey>: boolean } — task-form field visibility; missing key = visible
```

Field keys (match `Task` columns): `taskType`, `assignee`, `priority`, `sprint`, `storyPoints`, `plannedStartDate`, `plannedEndDate`, `actualStartDate`, `actualEndDate`.

## Impact
- Additive, nullable → no backfill, no default needed. `null` = all fields visible (frontend treats absent config / absent key as visible).
- `findOne` uses `include` (not `select`) so the column is returned automatically; no read-path change.
- No index (single-row read by project id).
- Non-destructive. No data migration.

## Migration
Forward migration file (Prisma SQL migration, matching existing layout under `apps/api/prisma/migrations/`), named `20260924000000_add_project_field_config/migration.sql`:

```sql
ALTER TABLE "Project" ADD COLUMN "fieldConfig" JSONB;
```

Verify on a scratch/test DB only. **Note (recurring env constraint, per board):** the shared team DB is off-limits and the Prisma migrate engine (`rtk`) is absent in this env — the migration file is authored + the Prisma client regenerated, but applying to a running DB is a human ops step (see other changes' `report/blockers.md`).
