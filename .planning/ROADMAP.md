# Roadmap: PM — AI-Centric Project Management

## Overview

Seven phases, each a hard prerequisite for the one after it. The build order follows the dependency chain identified in research: auth and schema first (nothing works without identity), then core domain (all features depend on task/project model), then collaboration and time tracking (team workflows), then real-time layer (AI results need a delivery path before AI ships), then AI integration (the primary differentiator), then Blueprint sync (depends on stable schema and AI reports existing), then reporting and analytics (consumes data from all prior phases). Every v1 requirement maps to exactly one phase. The POC end-to-end loop — create project, BA generates AI stories, PM approves, developer assigned, time logged, report generated, synced to Blueprint — is verifiable after Phase 6.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Infrastructure Baseline** - Auth, RBAC, schema, and queue foundation — nothing else is possible without this (completed 2026-04-05)
- [ ] **Phase 2: Project & Task Management** - End-to-end project creation, task CRUD, sprint management, and status workflow
- [ ] **Phase 3: Collaboration & Time Tracking** - Threaded comments, time logging, and developer workload visibility
- [ ] **Phase 4: Real-Time Layer** - Live dashboard updates, in-app push notifications, and AI job progress via WebSocket
- [ ] **Phase 5: AI Integration** - Story generation, task assignment suggestions, and report generation via Claude Code CLI queue
- [ ] **Phase 6: Blueprint Sync** - Weekly/daily transactional sync of tasks, reports, and time logs to Blueprint REST API
- [ ] **Phase 7: Reporting & Analytics** - Sprint velocity, capacity planning, and AI report views within the app

## Phase Details

### Phase 1: Infrastructure Baseline
**Goal**: All four user roles can authenticate via Keycloak SSO, and the backend enforces role-based access on every request — with the correct schema, AI queue infrastructure, and local dev environment in place
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, RBAC-01, RBAC-02, RBAC-03, RBAC-04
**Success Criteria** (what must be TRUE):
  1. User can log in via Keycloak SSO using company credentials and reach the application
  2. User session stays active across browser refresh without re-entering credentials
  3. User can log out from any page and is redirected to the Keycloak login screen
  4. A PM-role user accessing a BA-only endpoint receives a 403 response (RBAC enforced per role)
  5. Docker Compose brings up the full local dev stack (PostgreSQL, Redis, NestJS, React) with one command
**Plans:** 4/4 plans complete
Plans:
- [x] 01-01-PLAN.md — Monorepo scaffolding, dependencies, Docker Compose, Prisma schema, shared types
- [x] 01-02-PLAN.md — Backend JWT auth strategy, RBAC guards, user sync, role-gated endpoints
- [x] 01-03-PLAN.md — Frontend keycloak-js auth, AuthProvider, ProtectedRoute, role-gated pages
- [x] 01-04-PLAN.md — Integration verification checkpoint (automated + human)
**UI hint**: yes

### Phase 2: Project & Task Management
**Goal**: Users can create and manage projects, tasks, user stories, and sprints — with full status workflow and story point tracking — through the UI
**Depends on**: Phase 1
**Requirements**: PROJ-01, PROJ-02, TASK-01, TASK-02, TASK-03, TASK-04, TASK-05, SPRT-01, SPRT-02, SPRT-03
**Success Criteria** (what must be TRUE):
  1. PM can create a project and view its dashboard showing task status and active blockers
  2. User can create a task, move it through all five statuses (Backlog, In Progress, In Review, Done, Blocked), and delete it
  3. User can assign a task to a team member, reassign it, and leave it unassigned
  4. BA can add acceptance criteria and story points to a user story
  5. PM can create a sprint with dates, add tasks to it, and view sprint progress with burndown and completed vs. remaining points
**Plans:** 4/8 plans executed
Plans:
- [x] 02-01-PLAN.md — Schema migration (Bug, SubTask, enums, role updates) + Projects/Members backend modules
- [x] 02-02-PLAN.md — Tasks backend module (CRUD, sub-tasks, status, assignment)
- [x] 02-03-PLAN.md — Sprints/Bugs/Dashboard backend modules
- [x] 02-04-PLAN.md — Frontend infrastructure (shadcn, layout, routing, API client, stores, hooks, useTasks tests)
- [ ] 02-05-PLAN.md — Project Dashboard + Members pages
- [ ] 02-06-PLAN.md — Backlog (TanStack Table + Kanban dnd-kit) + Task Detail page + KanbanBoard tests
- [ ] 02-07-PLAN.md — Sprints + Bugs pages
- [ ] 02-08-PLAN.md — Integration verification checkpoint (automated + human)
**UI hint**: yes

### Phase 3: Collaboration & Time Tracking
**Goal**: Team members can communicate in context on tasks, log time against work, and PMs can see who has capacity and who is overloaded
**Depends on**: Phase 2
**Requirements**: COLB-01, COLB-02, TIME-01, TIME-02, WORK-01, WORK-02
**Success Criteria** (what must be TRUE):
  1. User can add a threaded comment on any task and BA and developer can exchange replies in that thread
  2. Developer can log time against a task manually or with a start/stop timer, and view their own time log history
  3. PM can view a workload screen showing each developer's open tasks and estimated hours
  4. PM can distinguish at a glance which developers have capacity and which are overloaded
**Plans**: TBD
**UI hint**: yes

### Phase 4: Real-Time Layer
**Goal**: The application updates live — task changes appear on dashboards without a page refresh, users receive in-app notifications for relevant events, and AI job progress is visible in real-time
**Depends on**: Phase 3
**Requirements**: RT-01, RT-02, RT-03
**Success Criteria** (what must be TRUE):
  1. When a task status changes in one browser tab, the project dashboard in another tab updates within 2 seconds without a page refresh
  2. When a task is assigned to a developer, that developer receives an in-app notification without reloading the page
  3. When an AI job is submitted, the requesting user sees a live status indicator ("AI is generating...") that resolves when the job completes
**Plans**: TBD
**UI hint**: yes

### Phase 5: AI Integration
**Goal**: BA can submit a feature description and receive AI-generated user stories for review; PM can accept AI task assignment suggestions; AI generates grounded daily and weekly status reports with risk flags — all via the async Claude Code CLI queue
**Depends on**: Phase 4
**Requirements**: AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, AI-07, AI-08, AIINFRA-01, AIINFRA-02, AIINFRA-03, AIINFRA-04, AIINFRA-05
**Success Criteria** (what must be TRUE):
  1. BA submits a feature description and receives AI-generated user stories (with acceptance criteria and story points) in DRAFT state, visible only to BA and PM until approved
  2. BA or PM can edit AI-generated stories inline and approve or reject each one — approved stories become active tasks visible to developers
  3. PM views AI-suggested task assignments based on developer workload and can accept, modify, or reject each suggestion before any assignment is committed
  4. AI generates a daily status report per project that includes blocked task count, developers with zero time logged, and sprint overload flags — derived from actual DB data
  5. AI generates a weekly cross-project summary report accessible within the app
**Plans**: TBD

### Phase 6: Blueprint Sync
**Goal**: Tasks, AI-generated reports, and time log entries sync reliably to Blueprint on schedule — with idempotency on retry, failure logging, and sync health visible to PMs
**Depends on**: Phase 5
**Requirements**: BPINT-01, BPINT-02, BPINT-03, BPINT-04, BPINT-05, BPINT-06
**Success Criteria** (what must be TRUE):
  1. Tasks sync to Blueprint on a weekly schedule and re-running sync does not create duplicate Blueprint records
  2. AI-generated daily reports sync to Blueprint automatically after generation
  3. Time log entries sync to Blueprint and can be traced to the correct task via Blueprint record ID
  4. PM can see sync health status on the dashboard — last sync time and any sync failures
  5. A failed sync retries without data loss and failures are logged for investigation
**Plans**: TBD

### Phase 7: Reporting & Analytics
**Goal**: PMs have access to sprint velocity charts, capacity planning views, and AI-generated report history within the app — giving full visibility into team performance and project health
**Depends on**: Phase 6
**Requirements**: REPT-01, REPT-02, REPT-03, REPT-04
**Success Criteria** (what must be TRUE):
  1. PM can view a per-project dashboard showing task status breakdown, blocker count, and sprint progress in one screen
  2. PM can view a sprint velocity chart showing story points completed per sprint across the project history
  3. PM can view a capacity planning screen showing available hours per developer across current and upcoming sprints
  4. PM can view AI-generated daily and weekly reports within the app, with the generation timestamp and data window displayed
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure Baseline | 4/4 | Complete   | 2026-04-05 |
| 2. Project & Task Management | 4/8 | In Progress|  |
| 3. Collaboration & Time Tracking | 0/? | Not started | - |
| 4. Real-Time Layer | 0/? | Not started | - |
| 5. AI Integration | 0/? | Not started | - |
| 6. Blueprint Sync | 0/? | Not started | - |
| 7. Reporting & Analytics | 0/? | Not started | - |
