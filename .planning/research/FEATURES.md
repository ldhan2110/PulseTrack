# Feature Research

**Domain:** AI-centric internal project management tool (PM, BA, Developer, Leadership roles)
**Researched:** 2026-04-05
**Confidence:** MEDIUM — core PM features HIGH, AI-specific patterns MEDIUM (market is moving fast)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Task CRUD with status workflow | Every PM tool has create/read/update/delete with state transitions (To Do → In Progress → Done) | LOW | Statuses: Backlog, In Progress, In Review, Done, Blocked |
| Multi-project support | Teams run more than one project; a single-project tool is a toy | LOW | Project dashboards per project + cross-project leadership view |
| Role-based access control (RBAC) | PM, BA, Developer, Leadership see different views and have different permissions | MEDIUM | Keycloak provides roles; app enforces them per view and action |
| SSO login via Keycloak | Internal tool — users expect company credentials, not another password | LOW | Keycloak already running; integrate via OIDC |
| Task assignment to team member | You can't manage work without knowing who owns what | LOW | Includes unassigned state and reassignment |
| Sprint/iteration management | Agile teams work in sprints; without this the tool feels pre-agile | MEDIUM | Sprint creation, adding tasks to sprints, sprint status |
| Time logging per task | Required for project reporting and capacity tracking | LOW | Start/stop or manual entry; per-task log |
| Developer workload visibility | If you can't see who is overloaded, assignment is guesswork | MEDIUM | Aggregate view of open tasks + estimated hours per developer |
| Comments and threaded discussion on tasks | BAs and developers must communicate in context of a task | LOW | Thread per task; @mention support is a plus, not required |
| Real-time status updates (WebSocket/SSE) | Modern tools push changes live; polling feels broken | MEDIUM | Task state, assignment, and comment changes pushed to open sessions |
| Push notifications for assignments and deadlines | Users miss updates without active notifications | MEDIUM | In-app notification feed; email is optional |
| Dashboard showing task status and blockers | PMs need a single-screen view of project health | MEDIUM | Per-project and cross-project; blocker count, velocity, open tasks |
| Acceptance criteria on user stories | Stories without acceptance criteria are ambiguous; developers need done-ness defined | LOW | Structured field on story; required before moving to In Progress |
| Story points on user stories | Teams use points for sprint capacity planning; without them sprint planning is blind | LOW | Numeric field; can be AI-suggested or manually set |
| Blueprint sync (tasks, reports, time logs) | Company requires Blueprint visibility; this is a hard organizational requirement | HIGH | Weekly task sync + daily report sync + time log sync via REST API |

---

### Differentiators (Competitive Advantage)

Features that set this product apart. Not expected, but produce real value when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI user story generation from BA description | BA writes a feature paragraph; AI returns structured stories with acceptance criteria and story points. Eliminates hours of manual writing and grooming | HIGH | Claude Code CLI on dedicated server; queue-based async job; output requires PM/BA review before acceptance |
| AI story point suggestion from historical data | AI analyzes completed stories to suggest points based on team velocity, not gut feel. Reduces estimation debates and inflation | HIGH | Requires historical story data to exist first; build after enough sprint history accumulates |
| AI task auto-assignment based on workload | AI recommends developer for each task based on current open tasks, estimated hours, and declared availability. PM can accept or override | HIGH | Requires workload data model; auto-assignment is a suggestion, not a forced action |
| AI-generated daily/weekly status reports | AI reads task states, blockers, and time logs; produces a narrative status summary per project. Leadership and PMs read a report instead of gathering data | HIGH | Queue-based; Claude Code CLI generates; output synced to Blueprint daily report endpoint |
| AI risk flagging in reports | Report generation identifies anomalies — blocked tasks with no updates, sprints with too many high-point stories, developers with no logged time | MEDIUM | Embedded in report generation job; flag categories defined upfront |
| Async AI job status indicator | Users see "AI is generating stories..." with live status rather than a blank screen. Builds trust in async AI flow | LOW | WebSocket update when AI job transitions from queued → processing → complete |
| Per-sprint velocity tracking | Chart of story points completed per sprint surfaces team throughput trends. Helps PMs forecast and identify degradation early | MEDIUM | Computed from completed stories per sprint; simple chart |
| Capacity planning view | Show available hours per developer across sprints so sprint loading decisions are data-backed | MEDIUM | Based on workload data + time logs; shows headroom or overload |
| Leadership cross-project dashboard | Executives see all projects in one view: status, risk flags, headcount load, overdue tasks. No drilling into individual projects required | MEDIUM | Aggregated read-only view; filtered to Leadership role |
| Editable AI output before commit | AI-generated stories and reports are drafts. PM/BA can edit inline before accepting. AI output is never silently applied | LOW | Edit-in-place with accept/reject per story; important for trust |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create disproportionate cost or risk for this stage.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time AI generation (streaming tokens) | Feels faster and interactive | Claude Code CLI is async by design; forcing streaming requires a fundamentally different integration and adds fragility. POC should prove the loop works, not optimize UX before validation | Show a spinner with live job-status updates via WebSocket; stream the final result when ready |
| Automated AI application of suggestions (no human review) | "Save clicks" by having AI auto-assign tasks or auto-commit stories | AI errors land directly in production workflow; PMs and BAs lose trust immediately when assignments are wrong | All AI output is a draft; PM/BA confirms before applying |
| Full email notification system | Users want to be notified outside the app | Email infra (SMTP, templates, bounce handling) is non-trivial and adds operational overhead in POC phase | In-app notification feed + real-time push covers the use case; add email post-validation |
| Mobile app | "Everyone has a phone" | This is a PM/BA/dev internal tool used at desks; mobile adds a second surface to maintain with no validated demand | Responsive web layout handles occasional mobile use without a native app |
| Git/CI integration (PR linking, build status) | Developers want code and task linked | Increases scope significantly; Blueprint handles company-wide visibility; this tool focuses on PM workflow | Manual task-to-PR linking via a URL field on tasks as a low-cost workaround |
| Custom workflow builder (per-project status states) | Power users want flexibility | Per-project state machines multiply complexity in the data model and AI report generation | Fixed workflow (Backlog → In Progress → In Review → Done → Blocked) covers 90% of cases |
| Gantt charts | Leadership asks for Gantt views | Gantt requires rigid dependency modeling and date-first thinking that conflicts with agile sprint-based flow | Sprint-based timeline view per project shows delivery cadence without full Gantt |
| AI chatbot / natural language query interface | "Ask the AI anything about my project" | Open-ended chat is high complexity, unpredictable output, and hard to trust for project decisions | Scoped AI actions (generate stories, generate report) with defined inputs and outputs are more reliable and auditable |
| Billing, payments, or seat licensing | If tool scales company-wide | Internal tool — organizational access is via Keycloak; no commercial model needed | Keycloak groups control access |

---

## Feature Dependencies

```
[Keycloak SSO]
    └──required by──> [RBAC (PM/BA/Developer/Leadership roles)]
                          └──required by──> [All role-scoped views and actions]

[Task CRUD + Status Workflow]
    └──required by──> [Sprint/Iteration Management]
    └──required by──> [Time Logging]
    └──required by──> [Comments on Tasks]
    └──required by──> [Developer Workload Visibility]
    └──required by──> [AI Task Auto-Assignment]
    └──required by──> [Blueprint Sync (tasks)]

[Sprint/Iteration Management]
    └──required by──> [Story Points on Stories]
    └──required by──> [Sprint Velocity Tracking]
    └──required by──> [Capacity Planning View]
    └──required by──> [AI Story Point Suggestion] (needs history)

[User Story (as a task subtype)]
    └──required by──> [Acceptance Criteria Field]
    └──required by──> [Story Points Field]
    └──required by──> [AI User Story Generation]

[AI User Story Generation]
    └──required by──> [Async AI Job Status Indicator]
    └──depends on──> [Queue-based AI server (Claude Code CLI)]

[Time Logging]
    └──required by──> [Blueprint Time Log Sync]
    └──enhances──> [Developer Workload Visibility]

[AI-Generated Reports]
    └──requires──> [Task CRUD + Status Workflow]
    └──requires──> [Time Logging]
    └──requires──> [Sprint data]
    └──required by──> [Blueprint Daily Report Sync]
    └──enhances──> [Risk Flagging in Reports]

[Developer Workload Visibility]
    └──enhances──> [AI Task Auto-Assignment]
    └──enhances──> [Capacity Planning View]

[Dashboard (per-project)]
    └──required by──> [Leadership Cross-Project Dashboard]
```

### Dependency Notes

- **Keycloak SSO required by RBAC:** Role enforcement depends on having a verified identity token. Keycloak is already running; RBAC is the application-layer enforcement on top of it.
- **Task CRUD required by nearly everything:** All AI features, sync features, and reporting features consume task state. It must be solid before any AI feature is built.
- **Sprint Management required by velocity and capacity features:** No sprint container = no meaningful velocity data. Build sprints before building analytics that depend on them.
- **AI Story Generation requires queue infrastructure first:** Claude Code CLI is async. The message queue (Redis/RabbitMQ) and AI server communication layer must exist before any AI feature can ship. This is the shared platform dependency for all three AI features.
- **AI Story Point Suggestion requires historical data:** The model needs completed stories with known points to calibrate. Build this feature after 2-3 sprints of real data, not at launch.
- **Reports require full task + time data:** Report quality is directly proportional to data completeness. Ship reporting after logging and task management are stable.

---

## MVP Definition

### Launch With (v1 — POC validation)

Goal: Prove the end-to-end loop — project creation → AI story generation → assignment → tracking → reporting → Blueprint sync.

- [ ] Keycloak SSO login — no auth = no product
- [ ] Task CRUD with status workflow — core object model
- [ ] User story subtype with acceptance criteria and story point fields — AI output target
- [ ] Sprint management (create sprint, add stories) — container for work
- [ ] AI user story generation from BA description — primary AI differentiator
- [ ] Async AI job status indicator — user feedback while AI processes
- [ ] AI task auto-assignment suggestion (PM confirms) — secondary AI feature
- [ ] Developer workload visibility — dependency for meaningful auto-assignment
- [ ] Time logging per task — required for Blueprint sync and reports
- [ ] AI-generated daily/weekly reports with risk flags — third AI feature
- [ ] RBAC (PM, BA, Developer, Leadership views) — multi-role product requirement
- [ ] Blueprint sync (tasks, reports, time logs) — hard organizational requirement
- [ ] Real-time dashboard (WebSocket) — task status and blocker view
- [ ] Comments on tasks — BA/developer communication
- [ ] Push notifications (in-app) — assignment and deadline alerts

### Add After Validation (v1.x)

Features to add once core loop is proven working and the team is using the tool.

- [ ] Sprint velocity tracking chart — trigger: 2+ completed sprints of data
- [ ] Capacity planning view — trigger: auto-assignment is being used regularly
- [ ] AI story point suggestion from history — trigger: 3+ sprints of completed stories
- [ ] Leadership cross-project dashboard — trigger: more than 2 active projects

### Future Consideration (v2+)

Defer until company-wide rollout is decided.

- [ ] Email notifications — only if in-app notifications prove insufficient
- [ ] Advanced reporting (custom date ranges, export to PDF/CSV) — demand unclear until internal use matures
- [ ] Git/PR linking on tasks — only if developer adoption is high and they request it
- [ ] Gantt-style timeline view — only if leadership explicitly requests it over sprint view

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Keycloak SSO | HIGH | LOW | P1 |
| Task CRUD + Status Workflow | HIGH | LOW | P1 |
| RBAC (role-scoped views) | HIGH | MEDIUM | P1 |
| Sprint Management | HIGH | MEDIUM | P1 |
| AI User Story Generation | HIGH | HIGH | P1 |
| AI Task Auto-Assignment | HIGH | HIGH | P1 |
| AI-Generated Reports + Risk Flags | HIGH | HIGH | P1 |
| Blueprint Sync | HIGH | HIGH | P1 |
| Real-time Dashboard (WebSocket) | HIGH | MEDIUM | P1 |
| Time Logging | HIGH | LOW | P1 |
| Developer Workload Visibility | HIGH | MEDIUM | P1 |
| Comments on Tasks | MEDIUM | LOW | P1 |
| Push Notifications (in-app) | MEDIUM | MEDIUM | P1 |
| Async AI Job Status Indicator | MEDIUM | LOW | P1 |
| Acceptance Criteria + Story Points | MEDIUM | LOW | P1 |
| Sprint Velocity Chart | MEDIUM | LOW | P2 |
| Capacity Planning View | MEDIUM | MEDIUM | P2 |
| AI Story Point Suggestion | MEDIUM | HIGH | P2 |
| Leadership Cross-Project Dashboard | MEDIUM | MEDIUM | P2 |
| Email Notifications | LOW | HIGH | P3 |
| Git/PR Linking | LOW | MEDIUM | P3 |
| Gantt Timeline View | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for POC launch — proves the end-to-end loop
- P2: Should have — add once loop is validated
- P3: Nice to have — future consideration, don't build until explicitly requested

---

## Competitor Feature Analysis

Relevant comparisons are tools used by similar internal dev teams: Jira, Linear, Shortcut (Clubhouse). None have the specific AI-via-CLI architecture or Blueprint sync, but their feature sets define user expectations.

| Feature | Jira | Linear | Our Approach |
|---------|------|--------|--------------|
| Task CRUD + workflow | Full, complex | Minimal, opinionated | Fixed 5-state workflow; simpler than Jira, more structured than bare Linear |
| AI story generation | Atlassian Intelligence (cloud-only, API-based) | Not native | Claude Code CLI on-prem; avoids API costs; async queue-based |
| Auto-assignment | Basic rule-based | Manual | AI workload-aware suggestions; PM confirms |
| Reporting | Extensive (Jira dashboards) | Lightweight | AI-generated narrative reports; not chart-heavy |
| Sprint management | Yes, full | Yes (cycles) | Yes; keeps sprint as primary planning unit |
| RBAC | Yes, complex | Yes, simple | Keycloak-provided roles enforced at app layer; 4 role types |
| Time logging | Yes (with plugins) | Not native | Native; required for Blueprint sync |
| External sync | Integrations marketplace | GitHub/Linear sync | Blueprint REST sync only; scoped to company requirement |
| Real-time updates | Limited (polling in many views) | Yes (full real-time) | WebSocket/SSE for dashboard and task views |

---

## Sources

- [Jira Intelligence vs. Linear vs. ClickUp Brain: 2026 AI Benchmarks](https://agileleadershipdayindia.org/blogs/atlassian-intelligence-and-agentic-workflows/jira-intelligence-vs-linear-vs-clickup-brain.html)
- [The 6 best AI project management tools in 2026 — Zapier](https://zapier.com/blog/best-ai-project-management-tools/)
- [AI PM Tool Rankings 2026 — AgileGenesis](https://www.agilegenesis.com/post/ai-project-management-tool-rankings-2026)
- [Best AI Project Management Tools 2026 — Epicflow](https://www.epicflow.com/blog/excellent-ai-project-management-software-tools-setting-new-standards/)
- [How to Use AI for User Stories in 2026 — Vegavid](https://vegavid.com/blog/how-to-use-ai-for-user-stories)
- [AI-Powered Project Management in 2026 — Blockchain Council](https://www.blockchain-council.org/blockchain/ai-powered-project-management-automate-planning-scheduling-resource-allocation/)
- [Mastering AI-Powered Story Point Estimation — Growing Scrum Masters](https://www.growingscrummasters.com/keywords/ai-story-point-estimation/)
- [5 Best AI Sprint Estimation Tools 2026 — Baseliner](https://baseliner.ai/blog/top-ai-sprint-estimation-tools-2026/)
- [Software development management tools 2026 — Monday.com](https://monday.com/blog/rnd/software-development-management-tools/)
- [Keycloak RBAC Authorization Services](https://www.keycloak.org/docs/latest/authorization_services/index.html)

---
*Feature research for: AI-centric internal project management tool*
*Researched: 2026-04-05*
