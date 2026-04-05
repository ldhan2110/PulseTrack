# Requirements: PM — AI-Centric Project Management

**Defined:** 2026-04-05
**Core Value:** End-to-end AI-assisted project management that reduces manual effort — from BA feature descriptions to AI-generated stories, smart task assignment, automated reports, and seamless Blueprint sync.

## v1 Requirements

### Authentication & Access

- [x] **AUTH-01**: User can log in via Keycloak SSO using company credentials
- [x] **AUTH-02**: User session persists across browser refresh (JWT token refresh)
- [x] **AUTH-03**: User can log out from any page
- [x] **RBAC-01**: PM role can create/manage projects, approve AI outputs, view all project data
- [x] **RBAC-02**: BA role can create feature descriptions, review/edit AI-generated stories, manage acceptance criteria
- [x] **RBAC-03**: Developer role can view assigned tasks, log time, update task status, add comments
- [x] **RBAC-04**: Leadership role can view cross-project dashboards and reports (read-only)

### Project & Task Management

- [x] **PROJ-01**: User can create, view, edit, and archive projects
- [ ] **PROJ-02**: User can view project dashboard with task status, blockers, and progress
- [ ] **TASK-01**: User can create, view, edit, and delete tasks within a project
- [ ] **TASK-02**: Task follows status workflow: Backlog → In Progress → In Review → Done → Blocked
- [ ] **TASK-03**: User can assign tasks to team members (includes unassigned state and reassignment)
- [ ] **TASK-04**: User can add acceptance criteria to user stories
- [ ] **TASK-05**: User can set or edit story points on user stories
- [ ] **SPRT-01**: User can create sprints with start/end dates within a project
- [ ] **SPRT-02**: User can add/remove tasks to/from sprints
- [ ] **SPRT-03**: User can view sprint progress (burndown, completed vs remaining points)

### Collaboration

- [ ] **COLB-01**: User can add threaded comments on tasks
- [ ] **COLB-02**: BA and developer can communicate in context of a task via comment threads
- [ ] **TIME-01**: User can log time against a task (manual entry or start/stop timer)
- [ ] **TIME-02**: User can view their own time log history
- [ ] **WORK-01**: PM can view developer workload — open tasks and estimated hours per developer
- [ ] **WORK-02**: PM can see which developers have capacity and who is overloaded

### AI Features

- [ ] **AI-01**: BA can submit a feature description and receive AI-generated user stories with acceptance criteria and story points
- [ ] **AI-02**: AI-generated stories enter DRAFT state requiring BA/PM approval before becoming active
- [ ] **AI-03**: BA/PM can edit AI-generated stories inline before accepting or rejecting
- [ ] **AI-04**: AI can suggest task assignment based on developer workload and availability
- [ ] **AI-05**: PM can accept, modify, or reject AI assignment suggestions
- [ ] **AI-06**: AI generates daily status reports per project with risk flags (blocked tasks, no updates, overloaded developers)
- [ ] **AI-07**: AI generates weekly summary reports across projects
- [ ] **AI-08**: User sees live AI job status indicator ("AI is generating...") via real-time updates

### AI Infrastructure

- [ ] **AIINFRA-01**: Backend sends AI jobs to a message queue (BullMQ/Redis) with structured context data (project data, task data, team data)
- [ ] **AIINFRA-02**: AI worker server consumes jobs from the queue and invokes Claude Code CLI in `--bare` mode
- [ ] **AIINFRA-03**: AI worker authenticates Claude Code CLI using existing subscription account (not API key) — requires session/OAuth setup on the AI server
- [ ] **AIINFRA-04**: AI worker returns structured results (stories, reports, assignments) back through the queue to the backend
- [ ] **AIINFRA-05**: Backend prepares and serializes project context (tasks, sprints, time logs, team workload) as input payload for each AI job type

### Real-Time

- [ ] **RT-01**: Dashboard updates in real-time when task status, assignments, or comments change (WebSocket/SSE)
- [ ] **RT-02**: User receives in-app push notifications for task assignments, status changes, and approaching deadlines
- [ ] **RT-03**: AI job status updates are pushed to the requesting user in real-time

### Blueprint Integration

- [ ] **BPINT-01**: System syncs tasks to Blueprint via REST API on a weekly schedule
- [ ] **BPINT-02**: System syncs AI-generated daily reports to Blueprint
- [ ] **BPINT-03**: System syncs time log entries to Blueprint
- [ ] **BPINT-04**: System supports creating tasks in Blueprint directly via REST API (auto-submit)
- [ ] **BPINT-05**: Sync uses idempotency (blueprint_id per entity) to prevent duplicates on retry
- [ ] **BPINT-06**: Sync failures are logged and retried without data loss (transactional outbox pattern)

### Reporting

- [ ] **REPT-01**: PM can view per-project dashboard with task status, blocker count, and sprint progress
- [ ] **REPT-02**: PM can view sprint velocity chart (story points completed per sprint)
- [ ] **REPT-03**: PM can view capacity planning view showing available hours per developer across sprints
- [ ] **REPT-04**: PM can view AI-generated daily/weekly reports within the app

## v2 Requirements

### Leadership & Advanced Reporting

- **LEAD-01**: Leadership cross-project dashboard with aggregated status, risk flags, and headcount
- **VELO-01**: AI story point suggestion from historical sprint data
- **REPT-05**: Email digest of weekly reports to stakeholders

### Enhanced Collaboration

- **COLB-03**: @mention support in comments with notification
- **NOTF-01**: Email notifications for critical events (blocked tasks, missed deadlines)

### Advanced AI

- **AI-09**: AI chatbot for natural language project queries
- **AI-10**: AI-powered sprint planning recommendations based on velocity and capacity

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile app | Web-first; internal tool used at desks. Responsive web covers occasional mobile use |
| Claude API integration | Using Claude Code CLI with existing subscription instead |
| OAuth/social login | Keycloak handles all authentication |
| Billing/payments | Internal tool — no commercial model |
| Custom workflow builder | Fixed workflow covers 90% of cases; reduces AI report complexity |
| Gantt charts | Conflicts with agile sprint-based flow; sprint timeline view sufficient |
| Git/CI integration | Blueprint handles company visibility; manual PR link via URL field |
| Real-time AI streaming | Claude CLI is async; spinner + job status is sufficient for POC |
| Full email notification system | In-app + real-time push covers the use case for POC |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| RBAC-01 | Phase 1 | Complete |
| RBAC-02 | Phase 1 | Complete |
| RBAC-03 | Phase 1 | Complete |
| RBAC-04 | Phase 1 | Complete |
| PROJ-01 | Phase 2 | Complete |
| PROJ-02 | Phase 2 | Pending |
| TASK-01 | Phase 2 | Pending |
| TASK-02 | Phase 2 | Pending |
| TASK-03 | Phase 2 | Pending |
| TASK-04 | Phase 2 | Pending |
| TASK-05 | Phase 2 | Pending |
| SPRT-01 | Phase 2 | Pending |
| SPRT-02 | Phase 2 | Pending |
| SPRT-03 | Phase 2 | Pending |
| COLB-01 | Phase 3 | Pending |
| COLB-02 | Phase 3 | Pending |
| TIME-01 | Phase 3 | Pending |
| TIME-02 | Phase 3 | Pending |
| WORK-01 | Phase 3 | Pending |
| WORK-02 | Phase 3 | Pending |
| AI-01 | Phase 5 | Pending |
| AI-02 | Phase 5 | Pending |
| AI-03 | Phase 5 | Pending |
| AI-04 | Phase 5 | Pending |
| AI-05 | Phase 5 | Pending |
| AI-06 | Phase 5 | Pending |
| AI-07 | Phase 5 | Pending |
| AI-08 | Phase 5 | Pending |
| AIINFRA-01 | Phase 5 | Pending |
| AIINFRA-02 | Phase 5 | Pending |
| AIINFRA-03 | Phase 5 | Pending |
| AIINFRA-04 | Phase 5 | Pending |
| AIINFRA-05 | Phase 5 | Pending |
| RT-01 | Phase 4 | Pending |
| RT-02 | Phase 4 | Pending |
| RT-03 | Phase 4 | Pending |
| BPINT-01 | Phase 6 | Pending |
| BPINT-02 | Phase 6 | Pending |
| BPINT-03 | Phase 6 | Pending |
| BPINT-04 | Phase 6 | Pending |
| BPINT-05 | Phase 6 | Pending |
| BPINT-06 | Phase 6 | Pending |
| REPT-01 | Phase 7 | Pending |
| REPT-02 | Phase 7 | Pending |
| REPT-03 | Phase 7 | Pending |
| REPT-04 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 49 total
- Mapped to phases: 49
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-05*
*Last updated: 2026-04-05 after roadmap creation*
