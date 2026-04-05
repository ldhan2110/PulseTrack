# Phase 1: Infrastructure Baseline - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a working foundation: Keycloak SSO login for all four roles (PM, BA, Developer, Leadership), backend RBAC enforcement on every request, the full PostgreSQL schema, BullMQ/Redis queue infrastructure, and a Docker Compose local dev environment that brings everything up with one command. No business logic, no UI beyond a login page and role-gated placeholder routes.

</domain>

<decisions>
## Implementation Decisions

### Monorepo Structure
- **D-01:** Monorepo with pnpm workspaces — single repository containing `apps/web` (React/Vite frontend) and `apps/api` (NestJS backend), with a shared `packages/shared` for TypeScript types used by both. pnpm is the standard workspace tool for NestJS + React monorepos.

### Schema Scope
- **D-02:** Full database schema defined upfront in Phase 1 via Prisma. All tables for all 7 phases (users, projects, tasks, sprints, comments, time_logs, ai_jobs, blueprint_sync, reports, etc.) are created now. Later phases add business logic and data — not new tables. This prevents foreign key surprises and migration conflicts as phases build on each other.

### Frontend Auth Flow
- **D-03:** Use `keycloak-js` adapter for the frontend (public client, Authorization Code Flow with PKCE). keycloak-js is still supported for browser-side use per CLAUDE.md stack spec. Backend validates Bearer JWTs using `openid-client` v6 + `passport-jwt` as specified.
- **D-04:** Auth state managed via a React context provider wrapping the app. Token refresh handled automatically by keycloak-js. Authenticated routes use a ProtectedRoute wrapper component.

### RBAC Enforcement Pattern
- **D-05:** NestJS custom `@Roles()` decorator + `RolesGuard` pattern. Guard extracts roles from `realm_access.roles` in the JWT claims and checks against the decorator's required roles. Unauthenticated requests get 401; authenticated but unauthorized requests get 403.
- **D-06:** Four roles: `pm`, `ba`, `developer`, `leadership`. Roles are managed in Keycloak (realm roles), not in the PM database. The PM database stores user profiles synced from Keycloak tokens on first login.

### Claude's Discretion
- Specific pnpm workspace configuration and package naming conventions
- Prisma schema field-level details (field types, constraints, indexes) — follow best practices
- Docker Compose service naming and networking configuration
- ESLint/Prettier configuration details
- NestJS module organization within the API app

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack Specification
- `CLAUDE.md` §Technology Stack — Full stack decisions, versions, and patterns
- `CLAUDE.md` §Stack Patterns by Variant — BullMQ queue pattern, Socket.IO gateway pattern, Keycloak auth pattern
- `CLAUDE.md` §AI Server Architecture Note — Claude Code CLI integration constraints
- `CLAUDE.md` §What NOT to Use — Explicit exclusions (keycloak-connect, Next.js, CRA, Redux, etc.)

### Project Context
- `.planning/PROJECT.md` — Project vision, constraints, key decisions
- `.planning/REQUIREMENTS.md` — Full v1 requirements with AUTH and RBAC specs
- `.planning/ROADMAP.md` §Phase 1 — Phase goal, success criteria, requirement mapping

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None — Phase 1 establishes the patterns all subsequent phases will follow

### Integration Points
- Keycloak server (already running) — OIDC discovery endpoint needed for openid-client configuration
- Redis (to be provisioned via Docker Compose) — BullMQ queue backing store
- PostgreSQL (to be provisioned via Docker Compose) — Primary database via Prisma

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow the stack specification in CLAUDE.md closely.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-infrastructure-baseline*
*Context gathered: 2026-04-05*
