# Project Research Summary

**Project:** AI-Centric Internal Project Management Tool
**Domain:** On-premise, multi-role PM tool with Claude Code CLI AI queue, Keycloak SSO, Blueprint REST sync
**Researched:** 2026-04-05
**Confidence:** HIGH (stack, architecture, core pitfalls) / MEDIUM (AI-specific patterns, feature prioritization)

## Executive Summary

This is a custom internal project management tool built around a queue-based AI pipeline, not a generic PM SaaS clone. The defining architectural characteristic is the separation of Claude Code CLI invocation onto a dedicated AI server, connected to the NestJS backend via BullMQ and Redis, returning results asynchronously over WebSocket. This means the AI is not a bolted-on feature — it is a first-class architectural concern that must be designed into the infrastructure from day one before any AI feature is attempted. The stack is greenfield-friendly and well-researched: React SPA (Vite 8) + NestJS 11 + PostgreSQL 16 + Prisma 7 + Redis 7 + BullMQ 5 + Socket.IO 4. All major packages have confirmed current versions as of 2026-04-05. The only hard constraint is that `keycloak-connect` is officially deprecated and must never be used; `openid-client` v6 + `passport-jwt` is the correct backend auth path.

The recommended build order — infrastructure baseline, then core API and domain model, then frontend shell, then real-time layer, then AI integration, then Blueprint sync, then reporting — is not arbitrary. Each layer is a prerequisite for the one above it. Attempting to build AI features before the real-time push pipeline is proven means AI results have no delivery path. Attempting Blueprint sync before the schema is stable means outbox records track the wrong data shape. The research findings from architecture, features, and pitfalls all converge on this order independently.

The primary risks are in three clusters: AI pipeline reliability (Claude CLI non-determinism without `--bare`, hallucinated report data, missing human approval gates), external integration fragility (Blueprint sync duplication on retry, Keycloak token validation gaps), and scope discipline (POC scope creep is rated a critical pitfall by name). All three are preventable by design decisions made before the first line of feature code is written. The POC success criteria must be defined and locked in writing before development begins.

## Key Findings

### Recommended Stack

The stack is a TypeScript monorepo (`apps/web`, `apps/api`, `apps/ai-worker` + `packages/shared-types`, `packages/queue-contracts`). React SPA with Vite is the correct frontend choice — no SSR, no Next.js, because WebSocket persistent connections require a custom server workaround in Next.js with no benefit for an authenticated internal tool. NestJS wins over Express because its module system, DI container, WebSocket gateway, and RBAC decorator patterns map exactly to what this tool needs. PostgreSQL is the right database choice given the deeply relational schema (users → roles → projects → sprints → tasks → time logs). The AI server is a completely separate Node.js process — not inside NestJS — to isolate Claude Code CLI subprocess lifecycle from the API server.

**Core technologies:**
- React 19.2.4 + Vite 8.0.3: Frontend SPA — no SSR needed, WebSocket/SSE easier than Next.js
- NestJS 11.1.18: Backend API + WebSocket server — built-in DI, guards, and Socket.IO adapter
- PostgreSQL 16: Primary data store — relational schema, JSONB for AI output
- Prisma 7.6.0: ORM + migrations — type-safe, schema-first, production-safe migrations
- Redis 7: BullMQ backing store + pub/sub for WebSocket horizontal scaling
- BullMQ 5.73.0: AI job queue — priorities, retries, delayed jobs, job events
- Socket.IO 4.8.3: Real-time push — rooms, namespaces, auto-reconnect, Redis adapter
- openid-client 6.8.2: Keycloak JWT validation — OIDC-certified, replaces deprecated `keycloak-connect`
- TanStack React Query 5.96.2: Frontend server state — caching, optimistic updates, Socket.IO-triggered invalidation
- Zustand 4.x: Frontend client state — sidebar, project selection, notification state

**Critical version constraints:**
- NestJS 11 requires Node.js 20+ LTS (dropped 16/18 support)
- BullMQ 5 requires Redis 7.0+ (Redis 6.2 reaches end-of-life Dec 2025)
- openid-client 6 is a breaking rewrite from v5; verify against your specific Keycloak version

### Expected Features

The feature set divides cleanly into a POC layer (prove the end-to-end loop) and a post-validation layer. The critical dependency chain: Keycloak SSO is required by RBAC; RBAC gates all role-scoped views; Task CRUD is required by every AI feature, sprint feature, time logging, and Blueprint sync; the AI queue infrastructure must exist before any AI feature ships.

**Must have (table stakes for POC):**
- Keycloak SSO login — no auth, no product
- Task CRUD with fixed 5-state workflow (Backlog, In Progress, In Review, Done, Blocked)
- User story subtype with acceptance criteria and story points fields
- Sprint management (create sprint, add stories, sprint status)
- RBAC enforcement for PM, BA, Developer, Leadership roles
- Time logging per task — required for Blueprint sync and reports
- Developer workload visibility — prerequisite for meaningful AI assignment
- Comments on tasks — BA/developer communication
- Real-time dashboard (WebSocket) — task status and blocker view
- Push notifications (in-app) — assignment and deadline alerts
- Blueprint sync (tasks, reports, time logs) — hard organizational requirement

**Should have (AI differentiators for POC):**
- AI user story generation from BA description — primary differentiator; async queue-based; BA must approve before stories are visible to developers
- AI task auto-assignment suggestion — PM confirms before commitment; uses story points not task count
- AI-generated daily/weekly status reports with risk flags — grounded in actual DB data injected into prompt; synced to Blueprint
- Async AI job status indicator — queue position, estimated time, job ID confirmation

**Defer to v1.x (post-validation):**
- Sprint velocity tracking chart — needs 2+ completed sprints of data
- Capacity planning view — trigger: auto-assignment in active use
- AI story point suggestion from history — needs 3+ sprints of completed story data
- Leadership cross-project dashboard — trigger: more than 2 active projects

**Defer to v2+ (do not build now):**
- Email notifications, Git/PR linking, Gantt views, advanced export, mobile app, AI chatbot

### Architecture Approach

The system is three deployable units sharing a Redis backbone: the React SPA (Nginx), the NestJS backend (REST API + WebSocket gateway + Blueprint sync scheduler), and the AI worker (separate Node.js process on a dedicated server). PostgreSQL is the single source of truth. Redis serves three roles simultaneously: BullMQ job queue broker, pub/sub fanout for WebSocket scaling, and optional short-lived cache. The monorepo structure enforces shared type contracts between the API queue producer and the AI worker consumer, preventing payload drift.

**Major components:**
1. React SPA — role-aware views (PM/BA/Developer/Leadership), React Query for server state, Socket.IO client for real-time events, Keycloak-js for OIDC auth flow
2. NestJS Auth Guard — validates Keycloak JWT via JWKS endpoint on every request, extracts roles from `realm_access.roles` claims
3. NestJS REST API — thin controllers delegating to domain services; never calls Claude CLI directly
4. NestJS WebSocket Gateway — Socket.IO rooms per project, backed by Redis pub/sub for multi-instance fanout
5. NestJS Blueprint Sync Worker — transactional outbox pattern; BullMQ scheduled job reads pending outbox records and pushes to Blueprint REST API
6. BullMQ AI Job Queue — producer in NestJS API, consumer in the separate AI worker; job contracts defined in `packages/queue-contracts`
7. AI Worker (separate server) — BullMQ worker pulls jobs, invokes `claude --bare -p "..." --output-format json`, parses result, enqueues back to Redis; result consumer in NestJS notifies clients via WebSocket
8. PostgreSQL — projects, sprints, tasks, stories, time logs, outbox table, sync state tracking (`blueprint_id`, `sync_status` per synced entity)

**Key patterns to follow:**
- Queue-mediated AI dispatch: never call Claude CLI synchronously from an HTTP handler; always return HTTP 202 Accepted and deliver via WebSocket
- Transactional outbox for Blueprint sync: write domain change and sync intent in one DB transaction; let the outbox worker handle delivery and retries
- Redis pub/sub fanout: service layer publishes to Redis channels; WebSocket gateway subscribes and pushes to rooms (not in-process connection references)
- RBAC via Keycloak claims only: never duplicate roles in the app DB; read `realm_access.roles` from JWT on every request

### Critical Pitfalls

1. **Claude CLI non-determinism in queue workers** — Always invoke with `--bare` flag in automated contexts. Without it, the CLI loads local config, MCP servers, and CLAUDE.md — producing environment-dependent, non-reproducible output. Also set `--output-format json`, an explicit `--allowedTools` allowlist, and a `timeout` option on `execFile`. Never use `exec` (shell injection risk); use `execFile` with an arguments array.

2. **Missing human-in-the-loop approval gate on AI stories** — All AI-generated stories must enter `DRAFT`/`PENDING_REVIEW` status before developers can see them. The BA who requested generation must explicitly approve, edit, or reject each story. This state must be in the initial schema — retrofitting it after launch requires migrating live data and rebuilding trust with the team.

3. **Blueprint sync duplication on retry** — Track `blueprint_id` per synced entity in the initial schema migration. Before creating a Blueprint record, check if `blueprint_id` is populated — if so, issue PUT not POST. Process batch syncs record-by-record with individual success/failure tracking. On retry, only re-attempt records where `sync_status = FAILED`.

4. **Keycloak JWT validation gaps** — Validate signature, `exp`, `iss`, and `aud` on every request. Fetch the public key from Keycloak's JWKS endpoint with periodic refresh — never hardcode it. Configure Keycloak's Frontend URL to a canonical stable URL so `iss` is consistent regardless of network entry point. A hardcoded key breaks silently when Keycloak rotates signing keys.

5. **POC scope creep** — Define POC success criteria in writing before any code: one project, one BA generates 3 stories, one developer assigned, one report generated, one Blueprint sync. Lock the scope document. Set a hard 4-6 week timebox. Any feature request during POC goes to a post-POC backlog, not into the current build.

6. **AI report data hallucination** — Every report prompt must inject explicit structured data (task counts by status, time logged vs. estimated per developer, overdue task IDs, sprint state) as JSON. Instruct Claude to derive observations only from provided data and to flag missing data rather than estimating. Verify report numbers against the DB query that generated the injected data.

7. **WebSocket connections not surviving on-premise proxies** — Configure nginx with `proxy_read_timeout 3600s` and header pass-through. Implement server-side heartbeat/ping-pong every 30 seconds. Implement client-side auto-reconnect with exponential backoff. Test through the actual production reverse proxy configuration before claiming real-time works — never only in local dev.

## Implications for Roadmap

Based on research, the architecture's build order and feature dependency chain together suggest a 7-phase structure. Each phase is a hard prerequisite for the one after it.

### Phase 1: Infrastructure Baseline
**Rationale:** Nothing else is possible without auth, schema, and queue. This phase has no external dependencies and must be rock-solid before any feature work begins. Getting Keycloak JWT validation correct here prevents a class of intermittent auth bugs in every subsequent phase.
**Delivers:** PostgreSQL schema + Prisma migrations (including `blueprint_id` and `sync_status` columns, `outbox` table, story `DRAFT` status), Redis connection + BullMQ queue setup, Keycloak OIDC JWT middleware (full claim validation: signature, `iss`, `aud`, `exp`), Docker Compose local dev environment
**Avoids:** Keycloak validation gaps (Pitfall 4), missing `blueprint_id` schema (Pitfall 3), missing `DRAFT` story status (Pitfall 2)
**Research flag:** Standard patterns — skip phase research. JWT validation and Prisma migrations are well-documented.

### Phase 2: Core API and Domain Model
**Rationale:** Frontend needs a stable API contract before it can be built. Business logic in the service layer must be correct and independently testable before real-time and AI layers are added on top.
**Delivers:** Project CRUD, Task CRUD with 5-state workflow, User story subtype with acceptance criteria and story point fields, Sprint management, Time logging, User/role mapping from Keycloak claims, RBAC enforcement on all endpoints, Comments on tasks
**Implements:** NestJS domain modules (ProjectModule, TaskModule, StoryModule, SprintModule, TimeLogModule), Prisma data access, role-based guards
**Avoids:** Role duplication in app DB (Architecture Anti-Pattern 3)
**Research flag:** Standard patterns — skip phase research.

### Phase 3: Frontend Shell
**Rationale:** Role-based routing and auth must be proven working in the browser before adding real-time or AI complexity. This phase validates the React Query + REST contract and confirms all four role views render correctly.
**Delivers:** React SPA with Keycloak auth, role-based routing (PM/BA/Developer/Leadership views), React Query API client layer, shadcn/ui component primitives, task and project views, developer workload visibility
**Uses:** React 19, Vite 8, TanStack Query 5, Zustand, Tailwind 4, shadcn/ui
**Avoids:** Purpose-built role views from day one — not a single view with filtered columns (UX Pitfall)
**Research flag:** Standard patterns — skip phase research.

### Phase 4: Real-Time Layer
**Rationale:** The AI result notification path reuses real-time infrastructure. It must be proven working — including through the production reverse proxy — before AI jobs need to deliver results to the browser. Building real-time after AI means AI results have no delivery path.
**Delivers:** NestJS Socket.IO gateway, Redis pub/sub fanout, per-project rooms, client-side event subscriptions with auto-reconnect, live dashboard updates (task status, assignment changes, AI job progress)
**Implements:** Redis pub/sub subscriber in gateway, `socket.emit('join-project', id)` room pattern, React Query cache invalidation on Socket.IO events
**Avoids:** WebSocket proxy timeout in on-premise infra (Pitfall 6), in-process connection state (Anti-Pattern 4)
**Research flag:** Needs validation — test WebSocket connections through actual company reverse proxy configuration before marking complete. This is the phase most likely to surface on-premise infrastructure surprises.

### Phase 5: AI Integration
**Rationale:** All AI features share one queue infrastructure. Build it once, correctly, then layer the three AI features (story generation, auto-assignment, report generation) on top. The `--bare` flag and JSON output parsing must be correct at this layer — errors here corrupt every AI feature built above it.
**Delivers:** BullMQ AI job queue producer in NestJS API, AI worker service (separate server) with Claude Code CLI subprocess runner using `execFile` with `--bare --output-format json`, prompt templates for story generation, task assignment, and report generation, result consumer with WebSocket notification, async AI job status indicator in the UI, BA story approval gate (`DRAFT` → `READY` flow), PM assignment confirmation flow, AI report generation with grounded data injection
**Avoids:** Claude CLI non-determinism (Pitfall 1), missing approval gate (Pitfall 2), AI assignment using task count not story points (Pitfall 5), AI report hallucination (Pitfall 8)
**Research flag:** Needs deeper research during planning — Claude Code CLI subprocess behavior, prompt template design, JSON schema validation for AI output, and error handling for subprocess timeout/crash all require careful upfront design. Plan for a research-phase sub-step before implementation.

### Phase 6: Blueprint Sync
**Rationale:** Blueprint sync depends on the domain schema being stable — sync contracts are defined by the final shape of task, time log, and report records. Building sync before core data model is stable means outbox records track the wrong fields.
**Delivers:** Transactional outbox processor (BullMQ scheduled job), Blueprint REST API client (axios-based, idempotency keys, exponential backoff retry), per-record sync state tracking (`blueprint_id`, `sync_status`, `last_synced_at`), sync health status visible on dashboard, weekly task sync, daily report sync, time log sync
**Implements:** Outbox pattern (domain write + outbox record in one Prisma transaction), `@nestjs/schedule` cron triggers, `BlueprintModule` wrapping axios
**Avoids:** Blueprint sync duplication on retry (Pitfall 3), silent sync failures (UX Pitfall)
**Research flag:** Needs validation — Blueprint REST API endpoints, field names, and idempotency behavior are TBD from the client. Plan a research step to obtain Blueprint API documentation before implementation.

### Phase 7: Reporting and Leadership Views
**Rationale:** Report quality depends on real data from tasks, time logs, and sprints accumulated over actual use. Building reporting before the data model is stable and populated produces meaningless output. This is the last phase because it consumes everything that came before it.
**Delivers:** AI-generated daily/weekly project reports scheduled via `@nestjs/schedule`, risk flagging (blocked tasks, sprint overload, zero time logged), sprint velocity tracking chart (Recharts), leadership cross-project dashboard (read-only aggregated view), report generation timestamp and data window display
**Avoids:** AI report hallucination (Pitfall 8 — grounded data injection required), reports without generation timestamp (UX Pitfall)
**Research flag:** Standard patterns for charting (Recharts, React Query). The AI prompt design for reports benefits from the lessons learned in Phase 5.

### Phase Ordering Rationale

- Auth and schema before everything: no feature is possible without a valid identity and a stable data model. Schema decisions made in Phase 1 (outbox table, `blueprint_id`, `DRAFT` status) prevent expensive migrations later.
- API before frontend: frontend has a tested contract to integrate against; avoids building UI against a moving target.
- Frontend before real-time: confirms routing, auth, and REST integration work before adding WebSocket complexity.
- Real-time before AI: AI results need a delivery path. Proving real-time works with simple domain events (task updates) before AI results flow through it reduces debugging surface area.
- AI before Blueprint sync: AI-generated reports are synced to Blueprint. The sync layer needs AI output to exist first.
- Blueprint sync before reporting: sync health status (last sync, failures) is a reporting input. Full reporting view benefits from confirmed sync behavior.

### Research Flags

Phases needing deeper research during planning:
- **Phase 4 (Real-Time):** On-premise reverse proxy WebSocket configuration is the highest-risk infrastructure unknown. Obtain actual nginx/HAProxy config from the company's ops team and test before finalizing the real-time approach. SSE fallback may be needed.
- **Phase 5 (AI Integration):** Claude Code CLI subprocess edge cases (timeout, crash, malformed JSON, environment isolation) require careful upfront design. Blueprint API field mapping for AI-generated reports may require negotiation. Plan a research-phase sub-step.
- **Phase 6 (Blueprint Sync):** Blueprint REST API endpoints, authentication, field names, and idempotency behavior are not yet documented in the research. This is the largest external unknown. Obtain Blueprint API documentation before beginning Phase 6 implementation.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Infrastructure):** PostgreSQL + Prisma migrations, Redis setup, Keycloak JWT validation — all well-documented with official sources.
- **Phase 2 (Core API):** NestJS CRUD, role-based guards, domain services — textbook NestJS patterns.
- **Phase 3 (Frontend Shell):** React + Vite + React Query + Keycloak-js — standard React SPA patterns.
- **Phase 7 (Reporting):** Recharts integration and report scheduling follow patterns established in earlier phases.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified via npm registry 2026-04-05. Official docs confirm all major library choices. `keycloak-connect` deprecation verified via official Keycloak blog. |
| Features | MEDIUM | Core PM features are HIGH confidence — industry-standard. AI-specific PM feature patterns are MEDIUM — market is fast-moving. Blueprint sync requirements are assumed from context, not from actual Blueprint API docs. |
| Architecture | HIGH | Core patterns (outbox, queue-mediated AI dispatch, Redis pub/sub fanout, RBAC via JWT claims) are well-documented. Claude Code CLI subprocess specifics are MEDIUM — some behavior sourced from community posts, not only official docs. |
| Pitfalls | MEDIUM-HIGH | Critical pitfalls (CLI non-determinism, approval gate, Blueprint duplication, JWT validation) are grounded in official docs and verified sources. POC scope creep and AI hallucination pitfalls are well-evidenced industry patterns. |

**Overall confidence:** HIGH for build decisions, MEDIUM for AI pipeline specifics and Blueprint integration details.

### Gaps to Address

- **Blueprint REST API spec:** The single largest unknown. No API documentation was available during research. Field names, authentication, idempotency support, rate limits, and endpoint behavior are all unverified. Must be obtained before Phase 6 begins. Request from client before roadmap is finalized.
- **Company reverse proxy configuration:** WebSocket behavior through the on-premise infrastructure is unverified. Obtain nginx/HAProxy configuration from ops team before committing to the real-time approach.
- **openid-client v6 vs v5 compatibility:** openid-client 6 is a breaking rewrite from v5. Compatibility with the specific Keycloak version in production should be verified before Phase 1 begins. If Keycloak is older than 22, v5 may be safer.
- **AI worker server environment:** The dedicated AI server's OS, Node.js version, and whether Claude Code CLI is pre-installed are unknown. These affect the AI worker deployment plan.
- **Claude Code CLI account and authentication on the AI server:** Headless Claude Code CLI requires authentication. The mechanism for providing credentials on the server (non-interactive, persistent) needs to be confirmed with the team before Phase 5 begins.

## Sources

### Primary (HIGH confidence)
- npm registry (live, 2026-04-05) — exact package versions for all core dependencies
- [Claude Code Headless Docs](https://code.claude.com/docs/en/headless) — `--bare` flag, `--output-format json`, subprocess behavior
- [Keycloak Adapter Deprecation](https://www.keycloak.org/2022/02/adapter-deprecation) — official `keycloak-connect` deprecation, `openid-client` as replacement
- [NestJS WebSocket Docs](https://docs.nestjs.com/websockets/gateways) — Socket.IO gateway first-class support
- [BullMQ Official Docs](https://docs.bullmq.io/) — worker, queue, job lifecycle patterns
- [Transactional Outbox Pattern](https://microservices.io/patterns/data/transactional-outbox.html) — outbox for Blueprint sync
- [Keycloak Authorization Services Guide](https://www.keycloak.org/docs/latest/authorization_services/index.html) — RBAC via JWT claims
- [React 19 stable release](https://react.dev/blog/2024/12/05/react-19) — v19 stable Dec 2024
- [Vite 8 release announcement](https://vite.dev/blog/announcing-vite8) — Rolldown bundler, v8 stable

### Secondary (MEDIUM confidence)
- [Claude Code Subagent Token Overhead (DEV Community)](https://dev.to/jungjaehoon/why-claude-code-subagents-waste-50k-tokens-per-turn-and-how-to-fix-it-41ma) — 50K token overhead per subprocess without `--bare`
- [Keycloak Token Validation Best Practices (Skycloak)](https://skycloak.io/docs/tutorials/jwt-validation-best-practices/) — JWT claim validation requirements
- [WebSockets at Scale (WebSocket.org)](https://websocket.org/guides/websockets-at-scale/) — proxy timeout pitfalls
- AI PM tool benchmarks and feature landscape (Zapier, AgileGenesis, Epicflow, 2026) — feature expectations
- NestJS vs Express, PostgreSQL vs MongoDB, Prisma vs TypeORM comparisons — multiple sources corroborated

### Tertiary (requires validation)
- Blueprint REST API behavior — no documentation reviewed; all sync behavior is inferred from requirements
- Company reverse proxy configuration — unverified; assumed nginx-compatible

---
*Research completed: 2026-04-05*
*Ready for roadmap: yes*
