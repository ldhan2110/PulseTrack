---
phase: 01-infrastructure-baseline
plan: 02
subsystem: backend-auth
tags: [auth, jwt, rbac, keycloak, passport, nestjs, users]
dependency_graph:
  requires: ["01-01"]
  provides: ["jwt-auth-guard", "roles-guard", "users-service", "users-module"]
  affects: ["all subsequent API plans requiring authentication"]
tech_stack:
  added:
    - "passport-jwt + @nestjs/passport: JWT strategy via JWKS"
    - "jwks-rsa: passportJwtSecret for automatic Keycloak public key fetching"
    - "RolesGuard: Reflector-based RBAC enforcement via SetMetadata"
  patterns:
    - "Passport JWT strategy with JWKS URI (no hardcoded secrets, keys rotate automatically)"
    - "Roles decorator + RolesGuard pattern for controller-level RBAC"
    - "User upsert from JWT claims on /me (profile sync, not migration)"
key_files:
  created:
    - apps/api/src/auth/jwt.strategy.ts
    - apps/api/src/auth/jwt-auth.guard.ts
    - apps/api/src/auth/roles.decorator.ts
    - apps/api/src/auth/roles.guard.ts
    - apps/api/src/auth/auth.module.ts
    - apps/api/src/auth/jwt.strategy.spec.ts
    - apps/api/src/auth/roles.guard.spec.ts
    - apps/api/src/users/users.service.ts
    - apps/api/src/users/users.controller.ts
    - apps/api/src/users/users.module.ts
  modified:
    - apps/api/src/app.module.ts
decisions:
  - "Import UserRole from @prisma/client (not @pm/shared) in UsersService — Prisma generates the authoritative enum for the ORM layer"
  - "Use static import + vi.mock hoisting instead of top-level dynamic await for spec files — required for tsconfig nodenext compatibility"
metrics:
  duration_minutes: 2
  completed_date: "2026-04-05"
  tasks_completed: 2
  files_created: 10
  files_modified: 1
requirements:
  - AUTH-01
  - RBAC-01
  - RBAC-02
  - RBAC-03
  - RBAC-04
---

# Phase 01 Plan 02: Backend Auth and RBAC Summary

**One-liner:** JWT strategy with JWKS-based Keycloak token validation plus Reflector-driven RolesGuard enforcing 4 roles (pm, ba, developer, leadership) across role-gated UsersController endpoints.

## What Was Built

### Task 1: JWT Strategy, Guards, Decorator, and Auth Module

- **JwtStrategy** (`apps/api/src/auth/jwt.strategy.ts`): Passport JWT strategy that fetches Keycloak public keys via JWKS URI (`/realms/{realm}/protocol/openid-connect/certs`). Uses `passportJwtSecret` from `jwks-rsa` with caching and rate limiting. Extracts `sub`, `email`, `username`, and `roles` (from `realm_access.roles`) from JWT payload.
- **JwtAuthGuard** (`apps/api/src/auth/jwt-auth.guard.ts`): Thin wrapper around `AuthGuard('jwt')` — NestJS standard pattern.
- **@Roles decorator** (`apps/api/src/auth/roles.decorator.ts`): `SetMetadata(ROLES_KEY, roles)` — attaches required roles as handler/class metadata.
- **RolesGuard** (`apps/api/src/auth/roles.guard.ts`): Uses `Reflector.getAllAndOverride` to read roles metadata. Returns true if no roles required; throws `ForbiddenException('Insufficient role')` if user lacks required role.
- **AuthModule** (`apps/api/src/auth/auth.module.ts`): Provides `JwtStrategy` and `RolesGuard`, exports `PassportModule` and `RolesGuard`.
- **Unit tests**: 8 tests covering all role guard behaviors (allow match, deny mismatch, allow no decorator, allow multi-role match) and JWT validate() extraction.

### Task 2: UsersService, UsersController, and Module Wiring

- **UsersService** (`apps/api/src/users/users.service.ts`): `upsertFromJwt()` syncs user profile on every `/me` call via `prisma.user.upsert`. `mapPrimaryRole()` maps JWT roles array to single DB enum value (pm > ba > developer > leadership priority order).
- **UsersController** (`apps/api/src/users/users.controller.ts`): Role-gated endpoints proving all 4 RBAC roles work — `/me` (any authenticated), `/` (pm+leadership), `/pm-only`, `/ba-only`, `/dev-only`, `/leadership-only`.
- **UsersModule** (`apps/api/src/users/users.module.ts`): Imports `AuthModule` to access `JwtAuthGuard` and `RolesGuard`.
- **AppModule** (`apps/api/src/app.module.ts`): Added `AuthModule` and `UsersModule` to imports.

## Verification Results

- `pnpm --filter @pm/api test --run`: 9 tests, 3 test files — all passed
- `pnpm --filter @pm/api exec tsc --noEmit`: 0 errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed top-level await in jwt.strategy.spec.ts for tsconfig nodenext compat**
- **Found during:** Task 1 verification (tsc --noEmit)
- **Issue:** Original spec used `const { JwtStrategy } = await import('./jwt.strategy')` at module top level. `tsconfig.json` has `"module": "nodenext"` which treats `.ts` files as CommonJS by default — top-level await is invalid in CommonJS context. `tsc --noEmit` reported TS1309.
- **Fix:** Replaced with static import (`import { JwtStrategy } from './jwt.strategy'`) relying on Vitest's automatic `vi.mock` hoisting, which ensures mocks are in place before any imports resolve at runtime.
- **Files modified:** `apps/api/src/auth/jwt.strategy.spec.ts`
- **Commit:** 5387d27

## Known Stubs

None — all endpoints return real data from Prisma or static confirmed-access messages.

## Self-Check: PASSED

- apps/api/src/auth/jwt.strategy.ts: FOUND
- apps/api/src/auth/jwt-auth.guard.ts: FOUND
- apps/api/src/auth/roles.decorator.ts: FOUND
- apps/api/src/auth/roles.guard.ts: FOUND
- apps/api/src/auth/auth.module.ts: FOUND
- apps/api/src/auth/jwt.strategy.spec.ts: FOUND
- apps/api/src/auth/roles.guard.spec.ts: FOUND
- apps/api/src/users/users.service.ts: FOUND
- apps/api/src/users/users.controller.ts: FOUND
- apps/api/src/users/users.module.ts: FOUND
- apps/api/src/app.module.ts: FOUND (contains AuthModule and UsersModule)
- Commits 093a973, 5387d27, 0aa6525: FOUND
