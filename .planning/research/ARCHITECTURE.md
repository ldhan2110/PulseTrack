# Architecture Research

**Domain:** AI-Centric Project Management System (On-Premise, Multi-Role)
**Researched:** 2026-04-05
**Confidence:** HIGH (core patterns) / MEDIUM (Claude Code CLI subprocess specifics)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  React SPA — Role Views: PM | BA | Developer | Leadership        │   │
│  │  WebSocket/SSE listener   OIDC token (Keycloak)                  │   │
│  └────────────────────────────┬─────────────────────────────────────┘   │
└───────────────────────────────│─────────────────────────────────────────┘
                                │ HTTPS + Bearer token
┌───────────────────────────────▼─────────────────────────────────────────┐
│                          BACKEND API LAYER                               │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  Auth Guard  │  │  REST API     │  │  WebSocket   │  │  Blueprint│  │
│  │  (JWT/OIDC)  │  │  (Express/    │  │  /SSE Server │  │  Sync     │  │
│  │              │  │   Fastify)    │  │              │  │  Worker   │  │
│  └──────┬───────┘  └───────┬───────┘  └──────┬───────┘  └─────┬─────┘  │
│         │                  │                  │                │        │
│  ┌──────▼──────────────────▼──────────────────▼────────────────▼──────┐ │
│  │                    Service / Domain Layer                           │ │
│  │  ProjectService  StoryService  TaskService  ReportService          │ │
│  └──────────────────────────────┬──────────────────────────────────── ┘ │
│                                 │                                        │
│  ┌──────────────────────────────▼──────────────────────────────────────┐ │
│  │                    Data Access Layer (ORM)                          │ │
│  └──────────┬─────────────────────────────────┬───────────────────────┘ │
│             │                                 │                          │
│  ┌──────────▼──────────┐          ┌──────────▼──────────────┐           │
│  │  PostgreSQL          │          │  Redis                  │           │
│  │  (primary store)     │          │  (queue + pub/sub       │           │
│  │                      │          │   + cache)              │           │
│  └──────────────────────┘          └──────────┬──────────────┘           │
└─────────────────────────────────────────────────│──────────────────────── ┘
                                                  │ BullMQ job queue
┌─────────────────────────────────────────────────▼──────────────────────────┐
│                          AI SERVICE LAYER  (separate server)                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  BullMQ Worker — pulls job from Redis queue                         │   │
│  │      ↓                                                              │   │
│  │  Job Dispatcher — resolves prompt template, attaches context        │   │
│  │      ↓                                                              │   │
│  │  Claude Code CLI subprocess  (claude -p "..." --output-format json) │   │
│  │      ↓                                                              │   │
│  │  Result Parser — validates, structures output                       │   │
│  │      ↓                                                              │   │
│  │  Callback → enqueue result back to Redis → Backend picks up         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘

External services (network-reachable from Backend):
  Keycloak IdP ──── OIDC/JWT validation (JWKS endpoint)
  Blueprint API ─── REST sync (tasks, reports, time logs)
```

---

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| React SPA | Role-aware UI; real-time dashboard; form submission | React + React Query + Socket.IO client or EventSource |
| Auth Guard | Validate OIDC bearer token on every request; extract roles/user | Keycloak JWKS middleware (passport-jwt or fastify-jwt) |
| REST API | CRUD for projects, tasks, stories, time logs; triggers AI jobs | Express or Fastify — controllers → services → ORM |
| WebSocket/SSE Server | Push real-time events to connected clients (task updates, AI result ready, notifications) | Socket.IO (WebSocket) or native SSE; Redis Pub/Sub as fanout |
| Service Layer | Business logic, validation, domain rules, AI job scheduling | Plain TypeScript classes — no framework coupling |
| Data Access Layer | DB reads/writes; query abstraction | Prisma ORM (PostgreSQL) |
| Blueprint Sync Worker | Scheduled or triggered outbox processor; pushes tasks, reports, time logs to Blueprint REST API | BullMQ repeatable job + axios/fetch |
| Redis | Queue broker (BullMQ), real-time pub/sub (SSE fanout), optional short-lived cache | Redis 7+ |
| PostgreSQL | Single source of truth; persists all domain data + outbox table | PostgreSQL 15+ |
| AI Service Worker | Consumes AI jobs; spawns Claude Code CLI subprocess; returns result | Node.js BullMQ worker on dedicated server |
| Claude Code CLI | Executes AI tasks (story generation, assignment, reports); returns JSON | `claude -p "..." --output-format json --bare` |
| Keycloak | SSO identity provider; issues OIDC tokens; manages user/role claims | Already running; no code changes needed |
| Blueprint API | External system that receives synced data; read-only from PM tool perspective | REST API — endpoints to be supplied |

---

## Recommended Project Structure

```
pm-tool/
├── apps/
│   ├── web/                     # React SPA
│   │   ├── src/
│   │   │   ├── features/        # Feature-scoped modules (projects, tasks, stories, reports)
│   │   │   ├── components/      # Shared UI components
│   │   │   ├── hooks/           # Shared React Query hooks + WebSocket hooks
│   │   │   ├── lib/             # Keycloak adapter, API client, SSE client
│   │   │   └── pages/           # Route-level page components
│   │   └── package.json
│   │
│   ├── api/                     # Backend REST API + WebSocket server
│   │   ├── src/
│   │   │   ├── routes/          # HTTP route handlers (thin controllers)
│   │   │   ├── services/        # Domain services (business logic)
│   │   │   ├── jobs/            # BullMQ queue producers (AI job enqueue, Blueprint sync)
│   │   │   ├── realtime/        # WebSocket/SSE event emitter, Redis pub/sub subscriber
│   │   │   ├── middleware/      # Auth guard, error handler, RBAC
│   │   │   ├── db/              # Prisma client, migrations, seed
│   │   │   └── lib/             # Blueprint HTTP client, Keycloak JWKS config
│   │   └── package.json
│   │
│   └── ai-worker/               # AI service (separate server)
│       ├── src/
│       │   ├── worker.ts        # BullMQ worker entrypoint — pulls jobs from Redis
│       │   ├── dispatcher.ts    # Resolves job type → prompt template + context
│       │   ├── prompts/         # Prompt templates per job type (story, assign, report)
│       │   ├── runner.ts        # Claude Code CLI subprocess execution
│       │   ├── parser.ts        # Validates and structures CLI JSON output
│       │   └── result.ts        # Enqueues result back to Redis for backend
│       └── package.json
│
├── packages/
│   ├── shared-types/            # Zod schemas + TypeScript types shared across apps
│   └── queue-contracts/         # Job payload types for producer/consumer contract
│
└── package.json                 # Monorepo root (pnpm workspaces or turborepo)
```

### Structure Rationale

- **apps/web, apps/api, apps/ai-worker:** Three deployable units reflecting the three-server topology. Monorepo avoids type drift.
- **features/ inside web:** Co-locates components, hooks, and API calls per domain feature — reduces cross-feature coupling.
- **services/ inside api:** Pure domain logic, not bound to HTTP. Testable in isolation.
- **jobs/ inside api:** Queue producers are distinct from services — services do not know about async dispatch.
- **prompts/ inside ai-worker:** Prompt templates are isolated from job execution — easy to iterate without touching runner code.
- **packages/shared-types + queue-contracts:** Job payload types defined once; both API (producer) and AI worker (consumer) import from the same source.

---

## Architectural Patterns

### Pattern 1: Queue-Mediated AI Dispatch

**What:** Backend enqueues an AI job (with context payload) to Redis via BullMQ. The AI worker on a separate server picks it up, runs Claude Code CLI as a subprocess, and posts the result back. Backend picks up the result asynchronously and publishes a real-time event to connected clients.

**When to use:** Any operation that involves Claude — story generation, auto-assignment, report generation. These can take 10-60 seconds and must not block the HTTP request cycle.

**Trade-offs:** Adds latency for the queue round-trip; requires the result-pickup mechanism (polling or a second queue). Gain: backend and AI server are fully decoupled; AI server can be scaled, restarted, or swapped independently.

**Pattern:**
```typescript
// API side — producer
await aiQueue.add('generate-stories', {
  jobId: story.id,
  projectId: project.id,
  featureDescription: dto.description,
  callbackQueue: 'ai-results',
});

// AI worker side — consumer
worker = new Worker('generate-stories', async (job) => {
  const result = await runClaudeCLI(buildPrompt(job.data));
  await resultsQueue.add('story-result', {
    jobId: job.data.jobId,
    stories: result.stories,
  });
}, { connection: redis });

// Backend result consumer
resultsWorker = new Worker('ai-results', async (job) => {
  await storyService.save(job.data);
  pubsub.publish(`project:${projectId}:stories-ready`, job.data);
});
```

### Pattern 2: Redis Pub/Sub for Real-Time Fanout

**What:** Backend services publish domain events to Redis channels. A WebSocket/SSE gateway layer subscribes to those channels and pushes events to relevant connected clients. This decouples service layer from connection management.

**When to use:** Any state change that must reach the browser in real-time — task status updates, AI job completion, assignment changes, deadline alerts.

**Trade-offs:** Adds Redis as a runtime dependency for real-time. Gain: backend services never hold references to WebSocket connections; horizontal scaling of API nodes works because all nodes share the Redis pub/sub channel.

**Pattern:**
```typescript
// Service emits to Redis
await redis.publish(`project:${projectId}:events`, JSON.stringify({
  type: 'task.updated',
  payload: { taskId, status, updatedBy },
}));

// Gateway subscribes and fans out to WebSocket clients
subscriber.subscribe(`project:${projectId}:events`);
subscriber.on('message', (channel, message) => {
  const event = JSON.parse(message);
  socketServer.to(`project:${projectId}`).emit(event.type, event.payload);
});
```

### Pattern 3: Transactional Outbox for Blueprint Sync

**What:** When a domain action (task update, report generation, time log) occurs, write a sync record to an `outbox` table inside the same database transaction as the domain write. A background BullMQ job processes the outbox, calls the Blueprint REST API, and marks records as synced.

**When to use:** The weekly task sync, daily report sync, and time log sync to Blueprint. Prevents silent data loss if Blueprint is unavailable at write time.

**Trade-offs:** Adds an `outbox` table and a polling worker. Gain: atomic guarantee — domain write and sync intent are never split across two systems. Retries are safe with idempotency keys.

**Pattern:**
```typescript
// Inside a single DB transaction
await prisma.$transaction([
  prisma.task.update({ where: { id }, data: taskData }),
  prisma.syncOutbox.create({
    data: {
      entityType: 'task',
      entityId: id,
      operation: 'upsert',
      status: 'pending',
    },
  }),
]);

// Outbox processor (scheduled BullMQ job)
const pending = await prisma.syncOutbox.findMany({ where: { status: 'pending' }});
for (const record of pending) {
  await blueprintClient.upsertTask(record.entityId);
  await prisma.syncOutbox.update({ where: { id: record.id }, data: { status: 'synced' } });
}
```

### Pattern 4: RBAC via Keycloak Role Claims

**What:** Keycloak issues OIDC access tokens that include role claims (PM, BA, Developer, Leadership) in the JWT. Backend middleware validates the token against Keycloak's JWKS endpoint and attaches the decoded principal to the request context. Route-level guards enforce which roles can access which endpoints.

**When to use:** Every authenticated route. Frontend also reads the token claims to conditionally render role-appropriate views.

**Trade-offs:** Roles are managed in Keycloak, not in the app DB. Gain: centralized identity management; no separate user table for authentication.

---

## Data Flow

### User Story Generation Flow (Primary AI Flow)

```
BA fills form in browser
    ↓ HTTP POST /api/stories/generate
API validates request, saves draft story (status=pending)
    ↓ enqueue job to Redis (BullMQ queue: 'generate-stories')
HTTP 202 Accepted → browser polls or holds SSE connection
    ↓ (async, separate server)
AI Worker dequeues job
    ↓ builds prompt with feature description + project context
Claude Code CLI subprocess: claude -p "..." --output-format json --bare
    ↓ returns JSON: { stories: [...], acceptance_criteria: [...], points: [...] }
AI Worker enqueues result to 'ai-results' queue in Redis
    ↓
Backend result consumer picks up result
    ↓ updates story records in PostgreSQL (status=ready)
    ↓ publishes to Redis pub/sub channel: project:{id}:events
WebSocket/SSE gateway forwards event to browser
Browser receives 'stories.ready' event → React Query invalidates + re-fetches
BA sees generated stories
```

### Task Update + Blueprint Sync Flow

```
Developer updates task status in browser
    ↓ HTTP PATCH /api/tasks/:id
TaskService updates task in PostgreSQL + writes outbox record (same transaction)
    ↓ publishes Redis event: task.updated
WebSocket gateway pushes update to all project room members (real-time)
    ↓ (async, scheduled)
Blueprint Sync Worker processes outbox queue
    ↓ reads pending outbox records
    ↓ calls Blueprint REST API (upsert task)
    ↓ marks outbox record as synced
```

### Authentication Flow

```
Browser redirects to Keycloak login page
    ↓ user authenticates with SSO credentials
Keycloak issues OIDC access token (JWT with role claims) + refresh token
    ↓ token stored in browser (memory + HttpOnly cookie via BFF, or in-memory)
Every API request includes: Authorization: Bearer <token>
Backend Auth Guard validates JWT via Keycloak JWKS endpoint (cached public keys)
    ↓ extracts user ID, roles, email from token claims
Request proceeds with principal attached to context
```

### Real-Time Dashboard Flow

```
Client connects WebSocket (or opens SSE stream)
Auth Guard validates token on connection upgrade
Client joins project rooms matching their accessible projects
    ↓ (any domain event)
Service layer publishes to Redis pub/sub
WebSocket gateway receives event from Redis
    ↓ routes to correct project room
All connected clients in that room receive the event
React Query cache is invalidated — UI updates without full re-fetch
```

---

## Build Order (Component Dependencies)

The following order maps to phase/milestone structure. Each layer depends on the one before it.

```
1. Infrastructure baseline
   PostgreSQL schema + Prisma migrations
   Redis connection + BullMQ setup
   Keycloak OIDC integration (JWT middleware)

2. Core API + domain model
   Project CRUD
   Task CRUD + status workflow
   User/role mapping from Keycloak claims
   Basic REST endpoints (no AI yet)

3. Frontend shell
   React app with Keycloak auth
   Role-based routing (PM/BA/Developer/Leadership views)
   API client layer (React Query)
   No real-time yet

4. Real-time layer
   WebSocket/SSE gateway
   Redis pub/sub fanout
   Client-side event subscriptions
   Live dashboard updates

5. AI integration
   BullMQ producer in API (enqueue AI jobs)
   AI worker service (separate server)
   Claude Code CLI subprocess runner
   Prompt templates (stories, assignment, reports)
   Result consumer + real-time notification

6. Blueprint sync
   Outbox table + transactional write pattern
   BullMQ scheduled Blueprint sync worker
   Blueprint REST API client
   Sync status tracking

7. Reporting + leadership views
   AI-generated report scheduling
   Cross-project dashboards
   Risk flagging
```

**Rationale for this order:**
- Auth and schema must exist before any feature work — nothing is possible without them.
- Core API before frontend — frontend has a stable contract to integrate against.
- Frontend shell before real-time — confirms routing and auth work before layering in sockets.
- Real-time before AI — validates the push pipeline with simple domain events before AI results flow through it.
- AI integration after real-time — the AI result notification path reuses the real-time infrastructure already proven.
- Blueprint sync after core data model is stable — sync contracts depend on final schema shape.
- Reporting last — depends on having real data from tasks, stories, and time logs.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Keycloak | OIDC — validate JWT via JWKS endpoint on every request | Public keys cached locally; no Keycloak call per request. Use `jwks-rsa` or Keycloak adapter. Token refresh handled by frontend lib (keycloak-js). |
| Blueprint REST API | REST push from outbox worker — HTTP upsert calls | Endpoints TBD from client. Use idempotency keys on writes. Retry with exponential backoff for 5xx. |
| Claude Code CLI | Subprocess invocation: `claude -p "<prompt>" --output-format json --bare` | Must run on dedicated AI server. Returns JSON. Use `--bare` for predictable, fast execution. Session ID available for multi-turn context if needed. |
| Redis | BullMQ job queues (AI dispatch, Blueprint sync), Pub/Sub (real-time fanout), optional cache | Redis 7+. Single Redis instance covers all three uses for POC; separate instances if needed at scale. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Frontend ↔ Backend API | HTTPS REST + Bearer token auth | React Query handles caching, retries, and invalidation |
| Frontend ↔ WebSocket/SSE Server | Persistent connection with token auth on handshake | Socket.IO or native SSE; reconnect logic built-in |
| Backend API ↔ AI Worker | Redis queue (BullMQ) — job payload JSON | Contracts defined in `packages/queue-contracts`; both sides import the same types |
| Backend API ↔ Redis | ioredis driver | Separate connection instances for BullMQ, pub/sub subscriber, and pub/sub publisher (Redis protocol requires separate connections for subscribe mode) |
| Service Layer ↔ DB | Prisma ORM — typed queries | No raw SQL in services; migrations managed via `prisma migrate` |
| Blueprint Sync Worker ↔ Blueprint API | HTTP REST via outbox processor | Runs on same server as Backend API; separate process or BullMQ worker thread |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-50 users (POC) | Single backend instance, single Redis, single AI worker. All three app tiers on two servers (backend+Redis on one; AI worker on the other). |
| 50-500 users | Multiple backend API instances behind load balancer; Redis pub/sub already handles multi-instance fanout. One or two AI worker instances for parallelism. |
| 500+ users | Redis Cluster or Redis Sentinel for HA. Separate Redis instances for queue vs pub/sub. Database read replicas for report queries. AI worker autoscaling based on queue depth. |

### Scaling Priorities

1. **First bottleneck:** AI Worker throughput — Claude CLI jobs are synchronous per worker. Add more AI worker instances to process jobs in parallel. BullMQ concurrency config controls parallelism per instance.
2. **Second bottleneck:** Database read load from dashboards and reports. Add a read replica and route report queries there.

---

## Anti-Patterns

### Anti-Pattern 1: Calling Claude CLI Synchronously from HTTP Request

**What people do:** Spawn the Claude CLI subprocess directly inside an HTTP handler and await the result before responding.

**Why it's wrong:** Claude CLI jobs take 10-60+ seconds. The HTTP connection times out, the user sees an error, and the server cannot handle concurrent requests while waiting. On-premise servers have limited connection pools.

**Do this instead:** Always enqueue AI jobs to BullMQ. Return HTTP 202 Accepted immediately. Deliver the result via WebSocket/SSE when the worker completes.

### Anti-Pattern 2: Dual-Write to Blueprint Without Outbox

**What people do:** Call Blueprint REST API directly from the service layer, at the same time as saving to the local DB, treating them as independent calls.

**Why it's wrong:** If Blueprint is unavailable or the second call fails, local DB and Blueprint are out of sync with no recovery path. Manual reconciliation becomes the only option.

**Do this instead:** Use the transactional outbox pattern. Write the sync intent into the DB atomically with the domain change. Let the outbox worker handle delivery, retries, and error tracking.

### Anti-Pattern 3: Storing Roles in the Application Database

**What people do:** Add a `users` table with a `role` column, sync roles from Keycloak, keep them current manually.

**Why it's wrong:** Roles drift out of sync. Keycloak is already the authority. Double-managing roles adds complexity and a class of bugs.

**Do this instead:** Read roles exclusively from Keycloak JWT claims on every request. If user records must exist in the app DB (for foreign keys on tasks/assignments), store only the Keycloak user ID and display name — no role duplication.

### Anti-Pattern 4: Separate WebSocket Server with No Pub/Sub Backing

**What people do:** Run a single WebSocket server, store connections in memory, broadcast directly from service code.

**Why it's wrong:** Works for one instance. Breaks when a second API instance is deployed — events emitted on instance A don't reach clients connected to instance B. Load balancers for WebSockets also require sticky sessions, which limits failover.

**Do this instead:** Back the WebSocket gateway with Redis Pub/Sub from day one. Service layer publishes to Redis; all WebSocket instances subscribe to Redis and push to their connected clients.

---

## Sources

- [Run Claude Code programmatically (official Anthropic docs)](https://code.claude.com/docs/en/headless) — HIGH confidence
- [BullMQ documentation — Workers, Queues, Job Lifecycle](https://docs.bullmq.io/) — HIGH confidence
- [BullMQ vs Other Queue Systems (RabbitMQ, SQS) — 2026](https://oneuptime.com/blog/post/2026-01-21-bullmq-vs-other-queues/view) — MEDIUM confidence
- [Transactional Outbox Pattern — microservices.io](https://microservices.io/patterns/data/transactional-outbox.html) — HIGH confidence
- [Keycloak Authorization Services Guide (official)](https://www.keycloak.org/docs/latest/authorization_services/index.html) — HIGH confidence
- [Streaming in 2026: SSE vs WebSockets vs RSC — JetBI](https://jetbi.com/blog/streaming-architecture-2026-beyond-websockets) — MEDIUM confidence
- [Building Real-Time Applications with WebSockets 2026 — ZeonEdge](https://zeonedge.com/nl/blog/building-real-time-applications-websockets-2026-architecture-scaling) — MEDIUM confidence
- [Modern Queueing Architectures: Celery, RabbitMQ, Redis, or Temporal? — Medium](https://medium.com/@pranavprakash4777/modern-queueing-architectures-celery-rabbitmq-redis-or-temporal-f93ea7c526ec) — MEDIUM confidence
- [On-Premise AI Architecture: Enterprise Deployment Guide 2026 — DEV Community](https://dev.to/jaipalsingh/on-premise-ai-architecture-complete-enterprise-deployment-guide-for-2026-3ge7) — MEDIUM confidence

---

*Architecture research for: AI-Centric Project Management System*
*Researched: 2026-04-05*
