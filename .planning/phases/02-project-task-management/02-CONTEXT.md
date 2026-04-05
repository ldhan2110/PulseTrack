# Phase 2: Project & Task Management - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can create and manage projects, tasks, user stories, and sprints — with full status workflow and story point tracking — through the UI. Includes a separate bug tracking system with QC-driven verification workflow. This phase delivers the core CRUD and workflow for all project management entities.

</domain>

<decisions>
## Implementation Decisions

### Navigation & Layout
- **D-01:** Claude's discretion on sidebar vs top-nav layout — pick the best approach for a PM tool with multi-project support
- **D-02:** Home page shows a project list — all projects the user belongs to, displayed as cards with project name, user's role, and task summary
- **D-03:** Inside a project, navigation sections: Dashboard, Backlog, Sprints, Bugs, Members
- **D-04:** Task detail opens as a full page (`/projects/:id/tasks/:taskId`), not a side panel

### Project Dashboard
- **D-05:** Dashboard shows status overview + sprint progress: task count cards by status, active sprint progress bar (completed vs remaining story points), recent activity feed, blocker count
- **D-06:** Burndown chart (Recharts) showing story points remaining over time (ideal vs actual) plus progress bar for active sprint

### Backlog
- **D-07:** Table view with sortable columns (title, status, assignee, story points, sprint) and filters (status, assignee, sprint, points range, text search)
- **D-08:** Task creation via modal dialog — title, description, status, assignee, story points, sprint assignment

### Task Board
- **D-09:** Both Kanban board and list view with a toggle switch — user can choose preferred view
- **D-10:** Kanban board has columns for each status (Backlog, In Progress, In Review, Done, Blocked) with drag-and-drop between columns to change status
- **D-11:** Task cards show: title, assignee avatar/initials, story points badge, task type indicator
- **D-12:** Free status transitions — any status can move to any other status, no enforced linear flow

### Task Model
- **D-13:** Single Task type — no Task/Story distinction. Stories are tasks with acceptance criteria and story points filled in
- **D-14:** Sub-tasks supported with full status + assignee: SubTask model with title, status (same 5-status enum), assigneeId, parentId. Sub-tasks allow splitting work across multiple team members while tracking progress toward the parent task
- **D-15:** Acceptance criteria serve as the task's checklist (not sub-tasks). Sub-tasks are for work distribution only

### Bug Tracking (Separate Model)
- **D-16:** Bugs are a separate model from Tasks — not a task type flag
- **D-17:** Bugs are NOT related to sprints — they live in their own Bugs section and developers can pick and fix them anytime
- **D-18:** Bug fields: title, description, severity (Critical/High/Medium/Low), reproduction steps, environment info, reporter (auto-filled), assignee
- **D-19:** Bug status workflow: Open → In Fix → Fixed → Verified → Closed (QC-driven verification)
- **D-20:** Bugs page shows list with filters by severity, status, assignee, and text search

### Sprint Workflow
- **D-21:** Sprints page shows list of all sprints (past/active/future). Active sprint opens as the Kanban/list board. Past sprints are read-only
- **D-22:** One active sprint per project — enforced at service layer
- **D-23:** Add SprintStatus enum: PLANNED, ACTIVE, COMPLETED — explicit status tracking, not date-derived
- **D-24:** Tasks added to sprints from backlog via checkbox selection + "Move to Sprint" bulk action
- **D-25:** When a sprint is closed, incomplete tasks (not DONE) automatically move back to backlog (sprintId set to null)

### Project Setup & Membership
- **D-26:** Any authenticated user can create a project — no role restriction. Creator becomes PM of the project
- **D-27:** Project roles: PM, BA, QC, Developer — no Leadership role (remove entirely from schema and system)
- **D-28:** Members added by searching existing users (from Keycloak-synced User table) by name/email, then assigning a project role
- **D-29:** Multiple users can have PM role in the same project
- **D-30:** Archiving is soft — project hidden from lists, all data preserved read-only, can be unarchived

### Permissions (Project-Level RBAC)
- **D-31:** PM: full access — CRUD all entities, manage members, manage sprints, archive project
- **D-32:** BA: create/edit tasks, manage acceptance criteria, assign tasks
- **D-33:** QC: create/edit bugs, verify bugs (move to Verified/Closed), view all tasks
- **D-34:** Developer: update status on assigned tasks, create sub-tasks
- **D-35:** All roles can view all project data (tasks, bugs, sprints, members)

### Search & Filtering
- **D-36:** Backlog table: filter by status, assignee, sprint, story points range. Text search on title/description
- **D-37:** Bugs list: filter by severity, status, assignee. Text search on title/description
- **D-38:** No global cross-project search for POC

### Schema Changes Required
- **D-39:** Add `Bug` model with: title, description, severity (enum), reproductionSteps, environment, status (BugStatus enum), reporterId, assigneeId, projectId
- **D-40:** Add `BugSeverity` enum: CRITICAL, HIGH, MEDIUM, LOW
- **D-41:** Add `BugStatus` enum: OPEN, IN_FIX, FIXED, VERIFIED, CLOSED
- **D-42:** Add `SprintStatus` enum: PLANNED, ACTIVE, COMPLETED — add `status` field to Sprint model
- **D-43:** Add `SubTask` model with: title, status (TaskStatus), assigneeId, parentId (references Task)
- **D-44:** Update `ProjectRole` enum: pm, ba, qc, developer (remove `leadership`)
- **D-45:** Remove `SystemRole` enum and leadership-related code — no Leadership role in the system

### Claude's Discretion
- Navigation layout style (sidebar vs top-nav) — pick what works best for multi-project PM tool
- Exact component library choices from shadcn/ui (Table, Dialog, Badge, etc.)
- Drag-and-drop library choice (dnd-kit, @hello-pangea/dnd, etc.)
- Loading states, empty states, error states
- Exact API endpoint naming and DTO structure
- Pagination strategy for tables (offset vs cursor)
- Specific Tailwind styling and spacing

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack & Patterns
- `CLAUDE.md` §Technology Stack — Full stack decisions, versions, and patterns
- `CLAUDE.md` §Stack Patterns by Variant — NestJS module pattern, React Query invalidation on Socket.IO events
- `CLAUDE.md` §What NOT to Use — Explicit exclusions

### Project Context
- `.planning/PROJECT.md` — Project vision, constraints, key decisions
- `.planning/REQUIREMENTS.md` §Project & Task Management — PROJ-01, PROJ-02, TASK-01 through TASK-05, SPRT-01 through SPRT-03
- `.planning/ROADMAP.md` §Phase 2 — Phase goal, success criteria, requirement mapping

### Prior Phase
- `.planning/phases/01-infrastructure-baseline/01-CONTEXT.md` — Monorepo structure, auth patterns, Prisma schema decisions

### Schema
- `apps/api/prisma/schema.prisma` — Current full schema (needs Bug, SubTask, SprintStatus, role updates)

### Existing Code
- `apps/api/src/auth/` — Auth guards, role decorators (system-roles and project-roles already exist)
- `apps/api/src/app.module.ts` — Current NestJS module structure
- `apps/web/src/App.tsx` — Current routing (needs expansion for project pages)
- `apps/web/src/auth/` — AuthProvider, ProtectedRoute, useAuth hook

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AuthProvider` + `useAuth` hook: Authentication state management — reuse for all authenticated pages
- `ProtectedRoute` wrapper: Wraps authenticated routes — extend for project-level role checks
- `system-roles.guard.ts` + `system-roles.decorator.ts`: System-level RBAC — pattern to follow for project-level guards
- `project-roles.guard.ts` + `project-roles.decorator.ts`: Project-level RBAC guards already exist — extend with QC role
- `PrismaService`: Database access — inject into all new NestJS modules
- `QueueModule`: BullMQ infrastructure ready — not needed for this phase but available

### Established Patterns
- NestJS module pattern: Module + Controller + Service per domain (see UsersModule)
- Prisma as sole ORM — all database access through PrismaService
- React Router for page routing with ProtectedRoute wrapper
- TanStack Query for data fetching (not yet used but specified in stack)
- shadcn/ui + Tailwind for UI components (not yet used but specified in stack)

### Integration Points
- `apps/web/src/App.tsx` — Add routes for: `/projects`, `/projects/:id/dashboard`, `/projects/:id/backlog`, `/projects/:id/sprints`, `/projects/:id/bugs`, `/projects/:id/members`, `/projects/:id/tasks/:taskId`
- `apps/api/src/app.module.ts` — Register new modules: ProjectsModule, TasksModule, SprintsModule, BugsModule
- `apps/api/prisma/schema.prisma` — Add Bug, SubTask models; add SprintStatus enum; update ProjectRole enum

</code_context>

<specifics>
## Specific Ideas

- User wants this tool to replace their current system — ease of use is critical, the UI should be intuitive and fast
- Bugs are explicitly separate from sprint workflow — developers pick bugs freely, QC drives the verification cycle
- Sub-tasks are for work distribution (one task, multiple people), not for checklist items (that's acceptance criteria)
- Multiple PMs per project is important for team collaboration

</specifics>

<deferred>
## Deferred Ideas

- Comments and communication threads on tasks — Phase 3 (COLB-01, COLB-02)
- Time logging against tasks — Phase 3 (TIME-01, TIME-02)
- Real-time updates when task status changes — Phase 4 (RT-01)
- AI-generated user stories from feature descriptions — Phase 5 (AI-01)
- Global cross-project search — future enhancement
- Saved filter presets — future enhancement

</deferred>

---

*Phase: 02-project-task-management*
*Context gathered: 2026-04-05*
