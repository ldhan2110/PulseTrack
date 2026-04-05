# PM — AI-Centric Project Management

## What This Is

An AI-powered project management tool for internal teams that handles the full lifecycle: project creation, user story generation, task assignment, time tracking, progress reporting, and real-time collaboration between PMs, BAs, and developers. It syncs all data to Blueprint (company internal task management) so the rest of the organization stays informed.

## Core Value

End-to-end AI-assisted project management that reduces manual effort — from BA describing a feature to AI-generated stories, smart task assignment, automated reports, and seamless Blueprint sync.

## Requirements

### Validated

- [x] Keycloak SSO login for all users (PM, BA, Developer, Leadership) — Validated in Phase 1: Infrastructure Baseline
- [x] Role-based access (PM, BA, Developer, Leadership views) — Validated in Phase 1: Infrastructure Baseline

### Active
- [ ] Multi-project support with project dashboards
- [ ] AI-powered user story generation from BA feature descriptions (with acceptance criteria & story points)
- [ ] AI-driven task auto-assignment based on developer workload and availability
- [ ] AI-generated daily/weekly status reports with risk flagging
- [ ] Real-time dashboards showing task status, progress, blockers across projects (WebSocket/SSE)
- [ ] Real-time push notifications for task changes, deadlines, assignments
- [ ] Time logging per task
- [ ] Developer workload visibility — see who has capacity, who's overloaded
- [ ] Comments and communication threads between BA and developers on tasks
- [ ] Task CRUD (create, read, update, delete) with status workflow
- [ ] Weekly task sync to Blueprint via REST API
- [ ] Daily report sync to Blueprint
- [ ] Time log sync to Blueprint
- [ ] Sprint/iteration management

### Out of Scope

- Mobile app — web-first, POC phase
- Claude API integration — using Claude Code CLI on dedicated server instead
- OAuth/social login — Keycloak handles all auth
- Billing/payments — internal tool
- Blueprint migration — Blueprint remains as-is, PM tool syncs to it

## Context

- **Team context:** Built for an internal development team to reduce project management overhead. POC for the team first, with potential to scale company-wide.
- **Blueprint:** Company-internal task management tool with REST API. PM tool is the primary workspace; Blueprint receives synced data (tasks, reports, time logs) for company-wide visibility.
- **Keycloak:** Already running and configured. Handles authentication/SSO for the PM tool.
- **AI architecture:** Dedicated server running Claude Code CLI. PM backend sends jobs via a message queue (Redis/RabbitMQ). AI server processes and returns results. This avoids API costs by leveraging existing Claude subscription.
- **Users:** PMs (oversight, dashboards), BAs (story generation, requirements), Developers (tasks, time logs), Leadership (cross-project reporting).
- **Scale:** POC for a single team now, designed to support multiple teams and large-scale company deployment long-term.

## Constraints

- **Auth**: Keycloak SSO only — already running, no additional auth providers
- **AI Runtime**: Claude Code CLI on separate server, queue-based communication — not Claude API
- **Integration**: Blueprint REST API — endpoints to be provided by user
- **Deployment**: Company on-premise servers
- **Scope**: POC first — must prove full end-to-end flow (create project → AI stories → assign → track → report → sync to Blueprint)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Claude Code CLI over Claude API | User has existing subscription, avoids API costs | — Pending |
| Queue-based AI communication | Decouples backend from AI processing, handles async workloads | — Pending |
| PM tool as primary, Blueprint as sync target | Team needs a better workflow tool, company still needs Blueprint data | — Pending |
| On-premise deployment | Company infrastructure requirements | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-05 after Phase 1 completion*
