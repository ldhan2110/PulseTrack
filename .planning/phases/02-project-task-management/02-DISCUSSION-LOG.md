# Phase 2: Project & Task Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 02-project-task-management
**Areas discussed:** Dashboard & navigation, Task board interaction, Sprint workflow, Project setup & membership, Bug tracking, Task types & sub-tasks, Permissions, Search & filtering

---

## Dashboard & Navigation Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar with project switcher | Left sidebar with project list, project sections | |
| Top nav with project dropdown | Horizontal top bar with dropdown | |
| You decide | Claude picks best layout | ✓ |

**User's choice:** You decide — Claude has discretion on layout style
**Notes:** None

---

## Project Dashboard Content

| Option | Description | Selected |
|--------|-------------|----------|
| Status overview + sprint progress | Cards, sprint progress bar, activity feed, blockers | ✓ |
| Minimal — just task counts | Simple summary, no charts | |
| You decide | Claude picks | |

**User's choice:** Status overview + sprint progress

---

## Home Page

| Option | Description | Selected |
|--------|-------------|----------|
| Project list home | Landing shows all projects as cards | ✓ |
| Last-used project auto-open | Auto-open most recent project | |
| You decide | Claude picks | |

**User's choice:** Project list home

---

## Project Navigation Sections

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard | Project overview | ✓ |
| Backlog | Tasks not in sprint | ✓ |
| Sprints | Sprint list and board | ✓ |
| Members | Member management | ✓ |

**User's choice:** All four selected
**Notes:** User also requested Bugs section — added as D-03

---

## Backlog View

| Option | Description | Selected |
|--------|-------------|----------|
| Table view with sorting/filtering | Spreadsheet-like table, sortable, filterable | ✓ |
| Card list | Vertical card list | |
| You decide | Claude picks | |

**User's choice:** Table view with sorting/filtering

---

## Task Detail View

| Option | Description | Selected |
|--------|-------------|----------|
| Side panel / drawer | Right drawer, stay on page | |
| Full task page | Navigate to /projects/:id/tasks/:taskId | ✓ |
| You decide | Claude picks | |

**User's choice:** Full task page

---

## Task Creation

| Option | Description | Selected |
|--------|-------------|----------|
| Modal dialog | Quick modal with all fields | ✓ |
| Inline in backlog table | New row in table | |
| Full page form | Dedicated create page | |

**User's choice:** Modal dialog

---

## Sprint Board Display

| Option | Description | Selected |
|--------|-------------|----------|
| Kanban board with columns | Columns per status, drag-and-drop | |
| List view grouped by status | Collapsible sections | |
| Both views with toggle | Switch between Kanban and list | ✓ |

**User's choice:** Both views with toggle

---

## Drag-and-Drop

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, drag between columns | Drag cards to change status | ✓ |
| No drag — click to change | Status via dropdown | |
| You decide | Claude picks | |

**User's choice:** Yes, drag between columns

---

## Task Card Information

| Option | Description | Selected |
|--------|-------------|----------|
| Title + assignee + points + type badge | Compact card with key info | ✓ |
| Title only | Minimal cards | |
| Title + full metadata | Detailed cards | |

**User's choice:** Title + assignee + points + type badge

---

## Status Transitions

| Option | Description | Selected |
|--------|-------------|----------|
| Free transitions | Any status to any status | ✓ |
| Linear flow with exceptions | Enforced flow, BLOCKED from any | |
| You decide | Claude picks | |

**User's choice:** Free transitions

---

## Sprint Management

| Option | Description | Selected |
|--------|-------------|----------|
| Sprint list + active sprint board | All sprints visible, one active | ✓ |
| Single active sprint focus | Only current sprint visible | |
| You decide | Claude picks | |

**User's choice:** Sprint list + active sprint board

---

## Adding Tasks to Sprint

| Option | Description | Selected |
|--------|-------------|----------|
| From backlog via drag or bulk action | Checkbox select + Move to Sprint | ✓ |
| From sprint page — search and add | Search dialog on sprint page | |
| You decide | Claude picks | |

**User's choice:** From backlog via bulk action

---

## Sprint Progress Visualization

| Option | Description | Selected |
|--------|-------------|----------|
| Burndown chart + progress bar | Line chart + bar, Recharts | ✓ |
| Progress bar only | Simple bar | |
| You decide | Claude picks | |

**User's choice:** Burndown chart + progress bar

---

## Active Sprint Limit

| Option | Description | Selected |
|--------|-------------|----------|
| One active sprint at a time | Enforced at service layer | ✓ |
| Allow overlapping sprints | Multiple active sprints | |
| You decide | Claude picks | |

**User's choice:** One active sprint at a time

---

## Sprint Close Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Move to backlog automatically | Incomplete tasks go to backlog | ✓ |
| Prompt to move or carry over | Dialog with choices | |
| Auto-carry to next sprint | Move to next sprint if exists | |

**User's choice:** Move to backlog automatically

---

## Sprint Status Tracking

| Option | Description | Selected |
|--------|-------------|----------|
| SprintStatus enum (PLANNED/ACTIVE/COMPLETED) | Explicit status field | ✓ |
| Derive from dates | No status field, compute from dates | |
| You decide | Claude picks | |

**User's choice:** SprintStatus enum

---

## Project Creation Access

| Option | Description | Selected |
|--------|-------------|----------|
| Any authenticated user | No role restriction, creator becomes PM | ✓ |
| PM and BA roles only | Restricted creation | |
| You decide | Claude picks | |

**User's choice:** Any authenticated user
**Notes:** User specified "any user can create project, and added to other project"

---

## Adding Members

| Option | Description | Selected |
|--------|-------------|----------|
| Search existing users + assign role | Search by name/email, pick role | ✓ |
| Invite by email | Email invitation | |
| You decide | Claude picks | |

**User's choice:** Search existing users + assign role

---

## Project Roles

| Option | Description | Selected |
|--------|-------------|----------|
| PM, BA, QC, Dev (no Leadership) | Four roles, Leadership removed entirely | ✓ |
| PM, BA, QC, Dev, Leadership | Five roles | |

**User's choice:** PM, BA, QC, Developer — no Leadership role at all
**Notes:** User explicitly stated "there is no Leadership role"

---

## PM Role Multiplicity

| Option | Description | Selected |
|--------|-------------|----------|
| Multiple PMs allowed | Any number of PMs per project | ✓ |
| Single PM only | One PM per project | |

**User's choice:** Multiple PMs allowed

---

## Project Archiving

| Option | Description | Selected |
|--------|-------------|----------|
| Soft archive — hidden, read-only, restorable | Can be unarchived | ✓ |
| Soft delete — hidden, no restore | Data kept but no UI restore | |
| You decide | Claude picks | |

**User's choice:** Soft archive

---

## Bug Model

| Option | Description | Selected |
|--------|-------------|----------|
| Task type field | Type enum on Task model | |
| Separate Bug model | Own model with specific fields | ✓ |

**User's choice:** Separate Bug model

---

## Bug Fields

| Option | Description | Selected |
|--------|-------------|----------|
| Severity | Critical/High/Medium/Low | ✓ |
| Reproduction steps | Dedicated text field | ✓ |
| Environment info | Browser/OS/version | ✓ |
| Reporter + Assignee | Who found, who fixes | ✓ |

**User's choice:** All four fields selected

---

## Bug Status Workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Open → In Fix → Fixed → Verified → Closed | QC-driven 5-status workflow | ✓ |
| Open → In Progress → Done | Simple 3-status | |
| Same as task workflow | Shared TaskStatus | |

**User's choice:** Open → In Fix → Fixed → Verified → Closed
**Notes:** Bugs are completely separate from sprints. Developers pick and fix bugs freely anytime.

---

## Task Types

| Option | Description | Selected |
|--------|-------------|----------|
| Single Task type | No Task/Story distinction | ✓ |
| Task + Story distinction | TaskType enum | |
| You decide | Claude picks | |

**User's choice:** Single Task type — stories are tasks with AC and points filled in

---

## Sub-Tasks

| Option | Description | Selected |
|--------|-------------|----------|
| Full status + assignee | SubTask model with status and assignee | ✓ |
| Title + done flag only | Simple checkbox items | |

**User's choice:** Full status + assignee
**Notes:** Sub-tasks are for work distribution (one task, multiple people). Acceptance criteria are the checklist on the task itself.

---

## Permissions

| Option | Description | Selected |
|--------|-------------|----------|
| Role-based with PM as admin | PM full, BA tasks, QC bugs, Dev own tasks | ✓ |
| Everyone can do everything | No restrictions, roles are labels | |
| You decide | Claude designs | |

**User's choice:** Role-based with PM as admin

---

## Search & Filtering

| Option | Description | Selected |
|--------|-------------|----------|
| Column filters + text search | Filter by status/assignee/sprint/severity + text search | ✓ |
| Basic text search only | Just title search | |
| Full search with saved filters | Advanced with presets | |
| You decide | Claude picks | |

**User's choice:** Column filters + text search — no global cross-project search for POC

---

## Claude's Discretion

- Navigation layout style (sidebar vs top-nav)
- Component library choices from shadcn/ui
- Drag-and-drop library
- Loading/empty/error states
- API endpoint naming and DTO structure
- Pagination strategy
- Tailwind styling

## Deferred Ideas

- Comments/threads on tasks — Phase 3
- Time logging — Phase 3
- Real-time updates — Phase 4
- AI story generation — Phase 5
- Global cross-project search — future
- Saved filter presets — future
