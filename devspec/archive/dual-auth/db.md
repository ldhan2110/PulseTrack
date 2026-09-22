# DB: dual-auth

**Dialect**: PostgreSQL via Prisma (`apps/api/prisma/schema.prisma`). Migrations = `prisma migrate` (forward SQL under `prisma/migrations/`).

## Touched table: `User` (existing)

Current relevant columns: `id`, `keycloakId String? @unique` (null = pending invite, claimed on first KC login), `email String @unique`, `username`, `name String?`, `imageUrl String?`.

### Additive columns (no drops, no type changes)

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `userType` | enum `UserType` | `INTERNAL` | `INTERNAL` (Keycloak) \| `EXTERNAL` (password). Default backfills every existing row to `INTERNAL`. |
| `passwordHash` | `String?` | `null` | argon2/bcrypt. Set only for `EXTERNAL`. Always `null` for `INTERNAL`. |
| `status` | enum `UserStatus` | `ACTIVE` | `INVITED` \| `ACTIVE` \| `LOCKED`. Default backfills existing rows to `ACTIVE`. New external invites start `INVITED`. |
| `pwResetTokenHash` | `String?` | `null` | Hash of the single-use set-password / reset token. Nulled after use (burns it). |
| `pwResetTokenExp` | `DateTime?` | `null` | Expiry for the above. |

### New enums
```
enum UserType   { INTERNAL EXTERNAL }
enum UserStatus { INVITED ACTIVE LOCKED }
```

## Migration verdict

- **Safe / additive.** All new columns are nullable or carry a `@default`, so the forward migration fills existing rows automatically — no manual backfill step, no downtime. Postgres applies the enum `@default` to existing rows on `ADD COLUMN`.
- **No new tables.** Set-password/reset token lives on `User` (`pwResetTokenHash` + `pwResetTokenExp`), single-use by nulling after redemption. Refresh tokens are **stateless** (signed, rotated on use) — no `RefreshToken` table this change (deferred; a server-side store would be the follow-up for revoke + reuse-detection).
- **Unique constraints unchanged.** `email` stays globally unique — an external and an internal user cannot share an email row. This is load-bearing for the anti-squatting invariant (see design.md): the claim-by-email branch must additionally gate on `userType = INTERNAL`.

## Excluded
No `DROP` / `DELETE` / `TRUNCATE`. Migration verified on a scratch/local DB, never the shared team DB.

## Generate
`pnpm --filter @pm/api prisma migrate dev --name dual_auth_user_fields` (writes the forward SQL; review before commit).
