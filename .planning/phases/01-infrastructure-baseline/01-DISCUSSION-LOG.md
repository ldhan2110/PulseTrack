# Phase 1: Infrastructure Baseline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 01-infrastructure-baseline
**Areas discussed:** Monorepo structure, Schema scope, Frontend auth flow, RBAC enforcement pattern
**Mode:** --auto (all decisions auto-selected with recommended defaults)

---

## Monorepo Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Monorepo with pnpm workspaces | Single repo, apps/web + apps/api + packages/shared | ✓ |
| Separate repos | Independent frontend and backend repositories | |
| Monorepo with npm workspaces | Similar to pnpm but using npm native workspaces | |

**User's choice:** [auto] Monorepo with pnpm workspaces (recommended default)
**Notes:** Simplifies shared types, Docker Compose, and CI. pnpm is the standard for NestJS + React monorepos.

---

## Schema Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full schema upfront | Define all tables for all 7 phases in Phase 1 | ✓ |
| Incremental per phase | Only create tables needed for the current phase | |
| Core + stubs | Create core tables now, add stubs for future tables | |

**User's choice:** [auto] Full schema upfront (recommended default)
**Notes:** Prisma migrations are incremental. Full schema prevents foreign key surprises. Later phases add logic, not tables.

---

## Frontend Auth Flow

| Option | Description | Selected |
|--------|-------------|----------|
| keycloak-js adapter | Official Keycloak JS adapter for browser (PKCE flow) | ✓ |
| Generic OIDC client (oidc-client-ts) | Framework-agnostic OIDC library | |
| Manual fetch-based auth | Custom implementation using fetch/axios | |

**User's choice:** [auto] keycloak-js adapter (recommended default)
**Notes:** CLAUDE.md explicitly states keycloak-js is still supported for browser/public client side. Backend uses openid-client + passport-jwt per stack spec.

---

## RBAC Enforcement Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Custom @Roles() decorator + RolesGuard | NestJS decorator pattern, roles from JWT claims | ✓ |
| CASL-based authorization | Attribute-based access control library | |
| Middleware-based role checking | Express-style middleware before route handlers | |

**User's choice:** [auto] Custom @Roles() decorator + RolesGuard (recommended default)
**Notes:** Standard NestJS RBAC pattern. Roles extracted from realm_access.roles in JWT. 401 for unauthenticated, 403 for unauthorized.

---

## Claude's Discretion

- pnpm workspace configuration details
- Prisma schema field-level design
- Docker Compose service configuration
- ESLint/Prettier setup
- NestJS module organization

## Deferred Ideas

None — discussion stayed within phase scope
