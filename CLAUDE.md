<!-- GSD:project-start source:PROJECT.md -->
## Project

**PM — AI-Centric Project Management**

An AI-powered project management tool for internal teams that handles the full lifecycle: project creation, user story generation, task assignment, time tracking, progress reporting, and real-time collaboration between PMs, BAs, and developers. It syncs all data to Blueprint (company internal task management) so the rest of the organization stays informed.

**Core Value:** End-to-end AI-assisted project management that reduces manual effort — from BA describing a feature to AI-generated stories, smart task assignment, automated reports, and seamless Blueprint sync.

### Constraints

- **Auth**: Keycloak SSO only — already running, no additional auth providers
- **AI Runtime**: Claude Code CLI on separate server, queue-based communication — not Claude API
- **Integration**: Blueprint REST API — endpoints to be provided by user
- **Deployment**: Company on-premise servers
- **Scope**: POC first — must prove full end-to-end flow (create project → AI stories → assign → track → report → sync to Blueprint)
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | 19.2.4 | Frontend SPA | SPA is the right choice for an internal tool behind Keycloak auth — no SSR/SEO needed, clean separation from backend, WebSocket/SSE easier to manage than in Next.js (Next.js requires a custom server workaround for persistent WebSocket connections, which adds complexity with no benefit here) |
| Vite | 8.0.3 | Frontend build tool | Fastest build tooling available (Rolldown bundler in v8, 10-30x faster than Webpack). Standard for React SPAs in 2025. Replaces Create React App which is abandoned. |
| NestJS | 11.1.18 | Backend REST API + WebSocket server | Opinionated, modular, TypeScript-first Node.js framework. Has first-class WebSocket gateways (Socket.IO adapter built-in), BullMQ integration module, and a well-established Keycloak/OIDC guard pattern. The architecture fits perfectly: modules per domain (Projects, Tasks, Users, AI Jobs, Blueprint Sync). Express is too bare for an app this size; NestJS provides guards, interceptors, and decorators that map cleanly to RBAC and auth middleware. |
| PostgreSQL | 16.x (latest) | Primary database | Project management data is deeply relational: users → roles → projects → sprints → tasks → comments → time logs. PostgreSQL enforces referential integrity, handles complex joins for dashboards and reports, and supports JSONB for flexible AI output storage. MongoDB would introduce join complexity without benefit. |
| Prisma | 7.6.0 | ORM + migrations | Best-in-class TypeScript type safety — generated client types eliminate runtime schema errors. Declarative schema with migration tooling (prisma migrate dev/deploy) is production-safe. Wins over TypeORM because Prisma's schema-first approach prevents drift; wins over Drizzle for a team that needs readable migrations and lower onboarding friction. |
| Redis | 7.x (official Docker image) | Message queue backing store + pub/sub for WebSocket scaling | BullMQ requires Redis. Also used for Socket.IO Redis adapter (horizontal scaling). On-premise deployment via `redis/redis-stack-server` Docker image. Redis 7 supports persistence (AOF + RDB), making job queue durable across restarts. |
| BullMQ | 5.73.0 | AI job queue (PM backend → AI server) | The standard Node.js queue for Redis. Powers AI pipelines in production at scale. Features needed here: delayed jobs (scheduled report generation), priorities (user-triggered AI > background sync), retries with backoff (Claude Code CLI can time out), job events (worker can emit progress back to API). NestJS has an official `@nestjs/bullmq` module. |
| Socket.IO | 4.8.3 | Real-time push (task updates, notifications, dashboard refresh) | NestJS `@nestjs/platform-socket.io` is the first-class adapter. Socket.IO adds automatic reconnection, rooms (per-project channels), namespaces, and transport fallbacks — all needed for a dashboard with multiple concurrent users. Raw `ws` requires manual re-implementation of all this. Redis adapter enables horizontal scaling later. |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @nestjs/bullmq | latest (pinned to NestJS 11) | BullMQ NestJS module | Use for every AI job queue: story generation, task assignment, report generation, Blueprint sync. Provides DI-injectable producers and decorated processor classes. |
| openid-client | 6.8.2 | Keycloak OIDC token validation on the backend | Use in NestJS AuthGuard to validate Bearer JWTs issued by Keycloak. `keycloak-connect` is **officially deprecated** by Keycloak (2022, confirmed active) — do not use it. `openid-client` is the officially recommended replacement and is OIDC-certified. |
| @tanstack/react-query | 5.96.2 | Frontend server-state management and data fetching | Use for all REST API calls. Provides caching, background refetch, optimistic updates (task status changes), and invalidation on Socket.IO events. Eliminates Redux for server state — use only for data that comes from the API. |
| Zustand | 4.x | Frontend client-state management | Use for UI state that doesn't belong in React Query: current project selection, sidebar state, notification drawer open/close. Lighter than Redux, no boilerplate. |
| Tailwind CSS | 4.x | Styling | Utility-first CSS. No design system overhead for an internal tool. Fast iteration. Pairs with shadcn/ui for accessible component primitives. |
| shadcn/ui | latest | UI component library | Unstyled Radix UI primitives with Tailwind variants — not a dependency, components are copied into the repo. Provides accessible Dialog, Table, Badge, Dropdown, Tabs, and Tooltip out of the box. Avoids the overhead of Ant Design or MUI for a custom internal tool. |
| Recharts | 2.x | Dashboard charts | Workload visualization, sprint burndown, progress bars. React-native charting, no D3 learning curve required. Composable API works well with React Query data. |
| @nestjs/schedule | latest | Cron scheduling | Use for scheduled jobs: daily Blueprint sync, weekly report generation, daily report auto-generation. Wraps `node-cron` with DI integration. |
| axios | 1.x | Blueprint REST API HTTP client | Use in the NestJS Blueprint sync module to call external Blueprint endpoints. On the frontend, React Query handles fetching — axios is backend-only here. |
| class-validator + class-transformer | latest | NestJS DTO validation | Required for NestJS ValidationPipe. Validates incoming request bodies against typed DTOs at the framework level. Prevents invalid data from reaching service layer. |
| Passport.js + passport-jwt | latest | NestJS JWT strategy | Used alongside openid-client. Passport's JWT strategy validates the Keycloak-issued Bearer token on each request. NestJS has first-class `@nestjs/passport` integration. |
| @nestjs/swagger | latest | API documentation | Auto-generates OpenAPI spec from NestJS decorators. Essential for the Blueprint sync integration and any future consumers of the PM API. |
| Pino | latest | Structured logging | JSON by default, low overhead. Use for request logging, AI job lifecycle events, Blueprint sync errors. NestJS-compatible via `nestjs-pino`. |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| Docker + Docker Compose | Local dev environment parity with on-premise production | Run PostgreSQL 16, Redis 7, and the NestJS API in containers locally. Mirrors deployment environment exactly. |
| Prisma CLI | Database migrations and schema management | `prisma migrate dev` for local, `prisma migrate deploy` in CI/CD. Never run raw SQL migrations manually. |
| Bull Board (`@bull-board/nestjs`) | BullMQ job queue monitoring UI | Mount at `/admin/queues`. Inspect pending/failed AI jobs in development and production without custom tooling. |
| ESLint + Prettier | Code quality | NestJS ships with ESLint config. Add `eslint-plugin-react` and `prettier` for frontend. Enforce consistent style across the full monorepo. |
| Vitest | Unit and integration testing | Vite-native test runner. Replaces Jest for the frontend. Use in NestJS as well (compatible via `vitest` config). Faster than Jest, same API surface. |
| ts-node / tsx | NestJS dev server | `ts-node` for NestJS (`nest start --watch`). No compilation step needed in development. |
## Installation
# --- Backend (NestJS) ---
# Dev dependencies (backend)
# --- Frontend (React SPA) ---
# Add shadcn/ui components via CLI (not a package dep):
# npx shadcn@latest init
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| React SPA + Vite | Next.js | Use Next.js only if you need SSR for SEO (irrelevant here) or a public-facing product. Next.js WebSocket support requires a custom Node.js server, adding complexity with no benefit for an authenticated internal tool. |
| NestJS | Express.js | Use Express when team size is 1-2 and the app is simple CRUD. Express has no built-in WebSocket gateways, no DI, no module system — you would re-invent all of this for a multi-role, multi-project PM tool. |
| NestJS | FastAPI (Python) | Use FastAPI if the team is Python-first or if heavy ML/data processing happens in the same process. Here, the AI is offloaded to Claude Code CLI on a separate server, so Node.js is the right choice for the team and codebase. |
| Prisma | TypeORM | Use TypeORM if you need fine-grained SQL control or are migrating a legacy codebase that already uses it. Prisma's migration tooling and type safety are superior for greenfield projects. |
| Prisma | Drizzle ORM | Use Drizzle if raw query performance is the top priority and the team is comfortable with SQL-like query builders. Drizzle has less ecosystem tooling than Prisma for migrations. |
| BullMQ + Redis | RabbitMQ | Use RabbitMQ if the team already runs it on-premise or if you need complex message routing (topic exchanges, dead-letter exchanges with routing keys). BullMQ is simpler to operate and deploy for a single-team tool. |
| Socket.IO | raw ws library | Use `ws` if you need minimal overhead and are building a high-frequency real-time system (e.g., 1000+ messages/second per connection). For a PM dashboard with task update events, Socket.IO's automatic reconnection and room support are worth the small overhead. |
| openid-client | keycloak-connect | Never use `keycloak-connect` — officially deprecated by Keycloak in 2022. The Keycloak team stated they no longer maintain it due to lack of Node.js expertise. `openid-client` is the OIDC-certified replacement. |
| PostgreSQL | MySQL | Use MySQL if existing company infrastructure mandates it. PostgreSQL has better JSONB support (useful for AI-generated structured output), better full-text search, and stronger standards compliance. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `keycloak-connect` / `keycloak-js` (backend) | Officially deprecated by Keycloak in 2022. Not maintained. Will break with future Keycloak versions. | `openid-client` v6 + `passport-jwt` |
| Next.js | WebSocket/SSE support requires a custom Node.js server, negating Next.js's value. SSR is unnecessary for an authenticated internal tool. Adds complexity with no benefit. | React SPA + Vite |
| Create React App (CRA) | Unmaintained since 2023. Webpack-based, slow builds. No longer recommended by the React team. | Vite 8 |
| Redux Toolkit | Overkill for server state when React Query handles it. Adds boilerplate and complexity for what `zustand` covers for client state. | TanStack Query (server state) + Zustand (client state) |
| Sequelize | Older ORM with weak TypeScript support, verbose configuration, and less intuitive migration tooling. Active but outclassed. | Prisma |
| Bull (legacy, not BullMQ) | Bull (`npm: bull`) is the predecessor. BullMQ is the rewrite with full TypeScript, better reliability, and active maintenance. Bull is in maintenance mode only. | BullMQ |
| MongoDB | Project management data is relational: tasks belong to sprints, sprints belong to projects, users have roles per project, time logs belong to tasks. Joins in MongoDB require `$lookup` aggregations — far more complex than SQL joins for this schema. | PostgreSQL |
| GraphQL (for this POC) | Adds schema definition, resolver complexity, and N+1 query concerns. The Blueprint REST API integration is HTTP-based anyway. REST is simpler and sufficient for this scope. | REST (NestJS controllers + Prisma) |
## Stack Patterns by Variant
- BullMQ Queue on PM backend: `@nestjs/bullmq` producer adds jobs
- AI server is a separate Node.js process with a BullMQ Worker that connects to the same Redis instance
- Worker invokes Claude Code CLI via `child_process.execFile` (not `exec` — use `execFile` with an array of arguments to prevent shell injection):
- Worker updates job result; PM backend listens for job completion events and emits Socket.IO update to frontend
- Use `--bare` flag on Claude Code CLI to skip auto-discovery and ensure reproducible results
- Set a generous `timeout` option on `execFile` (e.g., 120000ms) — AI processing can be slow
- NestJS Socket.IO gateway emits to named rooms (e.g., `project:${projectId}`)
- Frontend joins room on project open via `socket.emit('join-project', projectId)`
- When task changes (via REST), the task service also emits via the gateway
- React Query invalidates the relevant query keys on Socket.IO events — no polling needed
- Frontend: standard OIDC Authorization Code Flow — the Keycloak JS adapter (`keycloak-js`) is still supported for the browser/public client side only
- Backend: validates Bearer JWT on every request using `openid-client` + `passport-jwt` NestJS guard
- Roles extracted from JWT claims (`realm_access.roles`) and mapped to NestJS RBAC decorators
- NestJS `@nestjs/schedule` cron jobs trigger weekly task sync and daily report sync
- Sync jobs are enqueued into a BullMQ queue (not run inline) so they are retryable and non-blocking
- A dedicated `BlueprintModule` wraps axios calls to Blueprint REST endpoints
- Docker Compose with services: `postgres`, `redis`, `api` (NestJS), `frontend` (Nginx serving built Vite SPA)
- AI server runs as a separate Docker Compose service or standalone Node.js process on the dedicated AI server
- No cloud dependencies — all services are self-contained
## Version Compatibility
| Package | Compatible With | Notes |
|---------|-----------------|-------|
| NestJS 11 | Node.js 20+ LTS | NestJS 11 dropped support for Node.js 16/18. Use Node.js 20 or 22 LTS. |
| Prisma 7.x | PostgreSQL 16, 15, 14 | Prisma 7 requires Node.js 18.18+. Supports all current PostgreSQL versions. |
| BullMQ 5.x | Redis 7.x | BullMQ 5 requires Redis 7.0+. Redis 6.2 reaches end-of-life Dec 2025. Use Redis 7. |
| React 19 | Vite 8, @tanstack/react-query 5.x | React 19 is stable (Dec 2024). TanStack Query 5.x supports React 19 concurrent features including Suspense. |
| Socket.IO 4.x | @nestjs/platform-socket.io (NestJS 11) | Socket.IO 4.x is current stable. Requires socket.io-client 4.x on the frontend (versions must match major). |
| openid-client 6.x | Keycloak 22+ | openid-client 6 is a breaking rewrite from v5 (changed Passport integration). Verify compatibility against your specific Keycloak version before finalizing. v5.x is an alternative if existing Passport patterns are preferred. |
## AI Server Architecture Note (Claude Code CLI Integration)
- Use `child_process.execFile` with an explicit arguments array — safer and avoids shell injection
- Always set a `timeout` option (Claude Code processing can take 30-120 seconds)
- Set `maxBuffer` appropriately for large AI responses (default 1MB is often too small)
- The `--bare` flag is critical for headless use: skips auto-discovery, OAuth reads, and keychain reads, and ensures consistent behaviour across machines. Per official docs, `--bare` will become the default for `-p` in a future release.
- Use `--output-format json` for structured result parsing
- The AI server worker should be a standalone Node.js process (not inside the NestJS app) to isolate Claude Code process lifecycle from the API server
## Sources
- npm registry (live query, 2026-04-05) — exact versions for: `prisma` (7.6.0), `@nestjs/core` (11.1.18), `bullmq` (5.73.0), `socket.io` (4.8.3), `react` (19.2.4), `vite` (8.0.3), `@tanstack/react-query` (5.96.2), `openid-client` (6.8.2) — HIGH confidence
- [Claude Code Headless Docs](https://code.claude.com/docs/en/headless) — programmatic usage, `--bare` flag, `--output-format json`, known Node.js spawn behavior — HIGH confidence, official source
- [Keycloak Adapter Deprecation announcement](https://www.keycloak.org/2022/02/adapter-deprecation) — official deprecation of `keycloak-connect` and Node.js adapter, `openid-client` recommended — HIGH confidence, official Keycloak blog
- [NestJS WebSocket Docs](https://docs.nestjs.com/websockets/gateways) — Socket.IO gateway first-class support confirmed — HIGH confidence
- [BullMQ Official Site](https://bullmq.io/) — AI pipeline use cases, NestJS integration, Redis 7 requirement — HIGH confidence
- [Vite 8 release announcement](https://vite.dev/blog/announcing-vite8) — Rolldown bundler, version 8.0 stable — HIGH confidence, official
- [React 19 stable release](https://react.dev/blog/2024/12/05/react-19) — v19 stable Dec 2024, v19.2.4 current — HIGH confidence, official React blog
- WebSearch results (2026-04-05): NestJS vs Express comparison, Socket.IO vs ws decision, PostgreSQL vs MongoDB for relational data, Prisma vs TypeORM for greenfield TypeScript — MEDIUM confidence, multiple sources corroborated
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
