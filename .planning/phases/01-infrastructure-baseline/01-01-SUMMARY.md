---
phase: 01-infrastructure-baseline
plan: 01
subsystem: infrastructure
tags: [monorepo, pnpm, nestjs, prisma, bullmq, redis, postgresql, docker, vite, react, keycloak]
dependency_graph:
  requires: []
  provides:
    - pnpm-monorepo-structure
    - prisma-schema-all-phases
    - nestjs-api-scaffold
    - bullmq-queue-infrastructure
    - docker-compose-dev-environment
    - shared-types-package
  affects:
    - all subsequent plans in Phase 1
    - all phases 2-7 (schema, queue, shared types)
tech_stack:
  added:
    - pnpm@10.33.0 (workspace manager)
    - NestJS@11.1.18 (API framework)
    - Prisma@7.6.0 (ORM with library engine + @prisma/adapter-pg)
    - BullMQ@5.73.0 via @nestjs/bullmq (AI job queue)
    - React@19.2.4 + Vite@8.0.3 (frontend)
    - Tailwind CSS v4 (styling)
    - Vitest (test runner for both apps)
    - keycloak-js (frontend Keycloak adapter)
    - openid-client@6.8.2 (backend JWT validation)
    - @tanstack/react-query@5 (frontend data fetching)
    - zustand@4 (frontend client state)
    - @prisma/adapter-pg (Prisma 7 PostgreSQL driver adapter)
  patterns:
    - pnpm workspace:* for cross-package references
    - NestJS @Global() PrismaModule for app-wide DI
    - ConfigModule.forRoot({isGlobal:true}) for env vars
    - BullMQ forRootAsync pattern with ConfigService injection
    - Prisma 7 library engine with driver adapter (breaking change from Prisma 5/6)
key_files:
  created:
    - pnpm-workspace.yaml
    - package.json (root)
    - .gitignore
    - .env.example
    - .npmrc (pnpm build script allowlist)
    - packages/shared/package.json
    - packages/shared/src/index.ts
    - packages/shared/tsconfig.json
    - apps/api/package.json (@pm/api)
    - apps/api/tsconfig.json
    - apps/api/vitest.config.ts
    - apps/api/.env.example
    - apps/api/prisma/schema.prisma (10 models, 5 enums)
    - apps/api/prisma/migrations/20260405051711_init/migration.sql
    - apps/api/prisma.config.ts (Prisma 7 config file)
    - apps/api/src/prisma/prisma.service.ts
    - apps/api/src/prisma/prisma.module.ts
    - apps/api/src/queue/queue.module.ts
    - apps/web/package.json (@pm/web)
    - apps/web/vite.config.ts
    - apps/web/vitest.config.ts
    - apps/web/public/silent-check-sso.html
    - docker-compose.yml
  modified:
    - apps/api/src/app.module.ts (added ConfigModule, PrismaModule, QueueModule)
    - apps/api/src/main.ts (added ValidationPipe, CORS, global prefix, Swagger, shutdown hooks)
    - apps/api/src/app.controller.ts (added healthCheck endpoint)
    - apps/api/src/app.controller.spec.ts (migrated to Vitest)
    - apps/api/test/app.e2e-spec.ts (migrated to Vitest, updated endpoint)
decisions:
  - "Use Prisma 7 library engine (engineType=library) + @prisma/adapter-pg instead of legacy binary engine — Prisma 7 removed default binary engine requiring adapters or accelerateUrl"
  - "Installed PostgreSQL 16 via Homebrew for local dev (Docker not available in execution environment)"
  - "pm user granted CREATEDB privilege for Prisma shadow database during migrations"
  - "pnpm onlyBuiltDependencies configured in pnpm-workspace.yaml to allow Prisma, esbuild, NestJS build scripts"
metrics:
  duration: 15 minutes
  completed: 2026-04-05T05:25:00Z
  tasks_completed: 2
  files_created: 25
  files_modified: 6
---

# Phase 01 Plan 01: Infrastructure Baseline - Monorepo, Schema, and Queue Infrastructure Summary

pnpm monorepo scaffolded with NestJS API, React/Vite frontend, and shared types; full 10-model Prisma schema migrated to PostgreSQL; BullMQ queue infrastructure wired into NestJS with Redis; Docker Compose for local infrastructure services.

## Tasks Completed

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 | Scaffold monorepo, install all dependencies, create shared types package | daf045b | Complete |
| 2 | Create Prisma schema, Docker Compose, BullMQ queue, PrismaService, wire AppModule | 2fbd798 | Complete |
| - | Fix: migrate test specs to Vitest, fix broken test references | 99d1a04 | Auto-fixed |

## What Was Built

### Monorepo Structure

```
PM/
├── apps/
│   ├── api/           (@pm/api — NestJS backend)
│   └── web/           (@pm/web — React/Vite frontend)
├── packages/
│   └── shared/        (@pm/shared — TypeScript types)
├── pnpm-workspace.yaml
├── package.json
└── docker-compose.yml
```

### Shared Types (`packages/shared/src/index.ts`)

Exports: `UserRole`, `TaskStatus`, `AiJobStatus`, `AiJobType`, `SyncStatus` enums and `UserProfile`, `JwtPayload` interfaces.

### Database Schema (10 models)

All tables for all 7 phases created in a single migration:
- **User** — Keycloak SSO profile storage
- **Project** — Multi-project support
- **ProjectMember** — Role-based project membership
- **Sprint** — Iteration/sprint management
- **Task** — Core task with status workflow, story points, acceptance criteria
- **Comment** — Threaded task comments
- **TimeLog** — Time tracking per task
- **AiJob** — AI queue job tracking with BullMQ job ID reference
- **Report** — AI-generated daily/weekly reports
- **BlueprintSync** — Transactional outbox for Blueprint REST API sync

### NestJS API Configuration

- `ConfigModule.forRoot({ isGlobal: true })` — env vars available everywhere
- `PrismaModule` with `@Global()` — PrismaService injected in all modules
- `QueueModule` — BullMQ connected to Redis with `ai-jobs` queue registered
- `main.ts` — ValidationPipe, CORS, global prefix `/api`, Swagger at `/api/docs`, shutdown hooks

### Infrastructure (Docker Compose)

- PostgreSQL 16 with healthcheck (`pg_isready`)
- Redis 7 with healthcheck (`redis-cli ping`)
- Both services available on standard ports (5432, 6379)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prisma 7 requires driver adapter — binary engine removed**
- **Found during:** Task 2
- **Issue:** Prisma 7.6.0 removed the traditional binary engine. `new PrismaClient()` without options throws `PrismaClientInitializationError` requiring either `adapter` or `accelerateUrl`
- **Fix:** Added `engineType = "library"` to schema.prisma generator, installed `@prisma/adapter-pg` + `pg` packages, updated PrismaService to construct `PrismaPg` adapter with `DATABASE_URL` and pass it to `super({ adapter })`
- **Files modified:** `apps/api/prisma/schema.prisma`, `apps/api/src/prisma/prisma.service.ts`, `apps/api/package.json`
- **Commit:** 2fbd798

**2. [Rule 3 - Blocking] Docker not installed — PostgreSQL provisioned via Homebrew**
- **Found during:** Task 2
- **Issue:** Docker CLI not available in execution environment (`command not found: docker`)
- **Fix:** Installed PostgreSQL 16 via `brew install postgresql@16`, started via `brew services start postgresql@16`, created `pm` database user with CREATEDB privilege
- **Impact:** Docker Compose file created correctly with healthchecks for production use; local dev uses Homebrew PostgreSQL directly
- **Files modified:** None (infrastructure setup only)

**3. [Rule 3 - Blocking] Prisma shadow database permission denied**
- **Found during:** Task 2 migration
- **Issue:** `prisma migrate dev` requires CREATEDB privilege on the database user for shadow database
- **Fix:** `ALTER USER pm CREATEDB;`
- **Commit:** N/A (database configuration)

**4. [Rule 1 - Bug] Test spec files referenced deleted method and Jest globals**
- **Found during:** TypeScript compile verification
- **Issue:** NestJS CLI generated `app.controller.spec.ts` using `getHello()` (removed) and Jest globals (replaced by Vitest)
- **Fix:** Replaced Jest globals with explicit Vitest imports; updated `app.controller.spec.ts` to call `healthCheck()`; added `"types": ["vitest/globals"]` to `tsconfig.json`; updated e2e spec to test `/api` endpoint
- **Files modified:** `apps/api/src/app.controller.spec.ts`, `apps/api/test/app.e2e-spec.ts`, `apps/api/tsconfig.json`
- **Commit:** 99d1a04

**5. [Rule 3 - Blocking] `dotenv` missing for prisma.config.ts**
- **Found during:** Task 2
- **Issue:** Prisma 7 init generated `prisma.config.ts` with `import "dotenv/config"` but dotenv was not a dependency
- **Fix:** `pnpm add dotenv` in apps/api
- **Files modified:** `apps/api/package.json`
- **Commit:** 2fbd798

**6. [Rule 2 - Missing critical] `pnpm onlyBuiltDependencies` needed for build scripts**
- **Found during:** Task 1 installation
- **Issue:** pnpm blocked build scripts for `@prisma/engines`, `esbuild`, `@nestjs/core`, etc. without explicit allowlist
- **Fix:** Added `onlyBuiltDependencies` array to `pnpm-workspace.yaml`
- **Files modified:** `pnpm-workspace.yaml`
- **Commit:** daf045b

## Known Stubs

None — this plan establishes infrastructure only, no business logic or UI.

## Self-Check: PASSED

All files exist and all commits are present in git log.

| Check | Result |
|-------|--------|
| pnpm-workspace.yaml | FOUND |
| apps/api/prisma/schema.prisma | FOUND |
| apps/api/src/prisma/prisma.service.ts | FOUND |
| apps/api/src/queue/queue.module.ts | FOUND |
| docker-compose.yml | FOUND |
| packages/shared/src/index.ts | FOUND |
| apps/api/prisma/migrations/ | FOUND |
| Commit daf045b (Task 1) | FOUND |
| Commit 2fbd798 (Task 2) | FOUND |
| Commit 99d1a04 (fix specs) | FOUND |
