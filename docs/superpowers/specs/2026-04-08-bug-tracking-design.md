# Bug Tracking System Design

## Summary

A full bug tracking feature for the PM tool: structured bug reports with numbered reproduction steps, evidence attachments, parent-child linking to tasks, per-project configurable bug workflows (reusing the existing workflow editor), and a filterable bug list view. Extends the existing `Bug` model and `WorkflowStatus` system rather than building parallel infrastructure.

## Problem

- The existing Bug model has a hardcoded status enum (`OPEN → IN_FIX → FIXED → VERIFIED → CLOSED`) while tasks use a flexible per-project workflow — bugs need the same configurability
- Reproduction steps are a single text blob — no structure for step-by-step reproduction
- No evidence/attachment support on bugs (attachments are task-only today)
- No way to link bugs to the task they were found in
- No frontend bug UI exists — no creation form, no list view, no detail page
- Reporter roles are hardcoded (`pm`, `ba`, `qc`) — should be configurable per project

## Approach

**Extend WorkflowStatus with a `kind` discriminator** (`TASK` | `BUG`). The workflow editor gets a tab toggle. Each project defines task and bug workflows independently, sharing the same DB tables, editor UI, and transition logic. Bugs and Tasks remain separate models (different fields, different lifecycles).

## Data Model Changes

### New enum

```prisma
enum WorkflowKind {
  TASK
  BUG
}
```

### WorkflowStatus — add `kind` field

```prisma
model WorkflowStatus {
  // existing fields unchanged
  kind  WorkflowKind  @default(TASK)
}
```

All existing workflow statuses get `kind: TASK` via migration default. The workflow editor filters statuses by kind. `WorkflowTransition` is unchanged — transitions reference status IDs which already carry their kind.

### Bug model — replace enum status with workflow, add parentTaskId

```prisma
model Bug {
  id                String      @id @default(cuid())
  title             String
  description       String?
  severity          BugSeverity
  environment       String?
  expectedResult    String?
  actualResult      String?
  workflowStatusId  String?
  projectId         String
  reporterId        String
  assigneeId        String?
  parentTaskId      String?
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  project         Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  reporter        User             @relation("BugReporter", fields: [reporterId], references: [id])
  assignee        User?            @relation("BugAssignee", fields: [assigneeId], references: [id])
  parentTask      Task?            @relation("TaskBugs", fields: [parentTaskId], references: [id], onDelete: SetNull)
  workflowStatus  WorkflowStatus?  @relation("BugWorkflowStatus", fields: [workflowStatusId], references: [id], onDelete: SetNull)
  reproSteps      BugReproStep[]
  attachments     BugAttachment[]
}
```

**Removed fields:**
- `status` (BugStatus enum) — replaced by `workflowStatusId`
- `reproductionSteps` (single text) — replaced by `BugReproStep[]`

**Added fields:**
- `workflowStatusId` — FK to WorkflowStatus (kind=BUG)
- `parentTaskId` — optional FK to Task (parent-child relationship)
- `expectedResult` — what should happen
- `actualResult` — what actually happens

### Drop BugStatus enum

The `BugStatus` enum (`OPEN`, `IN_FIX`, `FIXED`, `VERIFIED`, `CLOSED`) is removed. Migration must convert existing bugs: create corresponding WorkflowStatus records (kind=BUG) per project and map existing enum values to them.

### New model: BugReproStep

```prisma
model BugReproStep {
  id        String @id @default(cuid())
  bugId     String
  position  Int
  content   String

  bug  Bug  @relation(fields: [bugId], references: [id], onDelete: Cascade)

  @@unique([bugId, position])
}
```

Each step is a separate row, ordered by `position`. Frontend sends the full ordered list on create/update; backend replaces all steps in a transaction (delete existing + insert new). The unique constraint ensures no duplicate positions per bug; the delete-then-insert approach within a transaction avoids constraint conflicts during reordering.

### New model: BugAttachment

```prisma
model BugAttachment {
  id          String   @id @default(cuid())
  bugId       String
  filename    String
  storedName  String
  mimeType    String
  size        Int
  uploaderId  String
  createdAt   DateTime @default(now())

  bug       Bug   @relation(fields: [bugId], references: [id], onDelete: Cascade)
  uploader  User  @relation("BugAttachmentUploader", fields: [uploaderId], references: [id])
}
```

Mirrors the existing `Attachment` model but with `bugId` instead of `taskId`. Accepts any file type — images, videos, logs, HAR files, etc.

### Task model — add reverse relation

```prisma
model Task {
  // existing fields unchanged
  bugs  Bug[]  @relation("TaskBugs")
}
```

### Project model — add configurable reporter roles

```prisma
model Project {
  // existing fields unchanged
  bugReporterRoles  String[]  @default(["pm", "ba", "qc"])
}
```

Array of role strings. PM can modify via project settings. The `BugsController` checks this on creation.

## Workflow Integration

### Default bug workflow seeding

When a project is created, seed a default bug workflow alongside the existing task workflow:

```
Statuses (kind=BUG):
  OPEN (isInitial: true, color: green)
  IN_FIX (color: blue)
  FIXED (color: purple)
  VERIFIED (color: teal)
  CLOSED (isFinal: true, color: gray)
  REOPENED (color: orange)

Transitions:
  OPEN → IN_FIX
  IN_FIX → FIXED
  FIXED → VERIFIED
  FIXED → REOPENED
  VERIFIED → CLOSED
  VERIFIED → REOPENED
  REOPENED → IN_FIX
  CLOSED → REOPENED
```

### Workflow editor changes

The existing `WorkflowEditor.tsx` gets a tab bar at the top: **Task Workflow** | **Bug Workflow**. Same visual editor (React Flow nodes + edges), filtered by `kind`. The `WorkflowService.getStatuses()` and `WorkflowService.save()` methods accept a `kind` parameter.

### Bug creation auto-assigns initial status

When a bug is created, the service finds the WorkflowStatus with `kind=BUG` and `isInitial=true` for that project and sets `workflowStatusId` automatically.

## API Changes

### Bug endpoints (updated)

```
POST   /projects/:projectId/bugs          — create bug (checks bugReporterRoles)
GET    /projects/:projectId/bugs          — list bugs (filterable)
GET    /projects/:projectId/bugs/:bugId   — get bug detail
PATCH  /projects/:projectId/bugs/:bugId   — update bug
DELETE /projects/:projectId/bugs/:bugId   — delete bug (PM only)
```

### Bug attachment endpoints (new)

```
POST   /projects/:projectId/bugs/:bugId/attachments    — upload file(s)
GET    /projects/:projectId/bugs/:bugId/attachments    — list attachments
DELETE /projects/:projectId/bugs/:bugId/attachments/:id — delete attachment
GET    /projects/:projectId/bugs/:bugId/attachments/:id/download — download file
```

### Workflow endpoints (updated)

```
GET  /projects/:projectId/workflow?kind=TASK   — get task workflow (default)
GET  /projects/:projectId/workflow?kind=BUG    — get bug workflow
PUT  /projects/:projectId/workflow             — save workflow (dto includes kind)
```

### Query filters for bug list

```
GET /projects/:projectId/bugs?severity=CRITICAL&workflowStatusId=xxx&assigneeId=xxx&parentTaskId=xxx&search=keyword
```

Supported filters: `severity`, `workflowStatusId`, `assigneeId`, `parentTaskId`, `reporterId`, `search` (title text search).

### CreateBugDto (updated)

```typescript
class CreateBugDto {
  title: string;           // required, 3-200 chars
  description?: string;    // optional, max 5000 chars
  severity: BugSeverity;   // required: CRITICAL | HIGH | MEDIUM | LOW
  environment?: string;    // optional, max 1000 chars
  expectedResult?: string; // optional, max 5000 chars
  actualResult?: string;   // optional, max 5000 chars
  assigneeId?: string;     // optional
  parentTaskId?: string;   // optional
  reproSteps?: { position: number; content: string }[];  // optional ordered list
}
```

### UpdateBugDto (updated)

Same fields as CreateBugDto, all optional. Plus:
- `workflowStatusId?: string` — transition to new status (validated against workflow transitions)

## Frontend

### Pages and routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/projects/:id/bugs` | `BugListPage` | Filterable table of all bugs in project |
| `/projects/:id/bugs/new` | `BugCreatePage` | Full-page bug report form |
| `/projects/:id/bugs/:bugId` | `BugDetailPage` | View/edit bug details |

### BugCreatePage layout

Two-column layout:

**Left column (main content):**
- Title input (required)
- Description textarea
- Reproduction steps — numbered step fields with add/remove/reorder (↑↓×) controls and "+ Add step" button
- Expected Result / Actual Result — side-by-side textareas
- Evidence — "Evidence" label with single "+ Upload" button, uploaded files shown as compact chips (filename, size, × remove)

**Right sidebar (metadata):**
- Severity — labeled dropdown with color-dot indicator
- Assignee — user picker dropdown
- Environment — text input
- Parent Task — searchable task picker (shows taskKey + title)
- Status — auto-set to initial, shown as read-only on create
- Submit / Cancel buttons

### BugListPage

Table columns: Title, Severity (color-coded badge), Status (workflow status badge), Assignee (avatar), Parent Task (taskKey link), Reporter, Created date.

Filter bar above the table: severity dropdown, status dropdown, assignee dropdown, parent task dropdown, text search input.

### BugDetailPage

Same layout as BugCreatePage but in view mode with inline editing. Clicking a field toggles it to edit mode. Status changes via dropdown that only shows valid transitions from current status.

### Task detail — bugs section

The TaskDetailPage gets a "Bugs" section showing child bugs as a compact list (title, severity badge, status badge). Includes an "Add Bug" button that navigates to BugCreatePage with `parentTaskId` pre-filled.

### Workflow editor — bug workflow tab

Add a tab bar to `WorkflowEditor.tsx`: **Task Workflow** | **Bug Workflow**. Switching tabs filters the statuses/transitions by `kind`. The "Add Status" and connection logic remain identical.

### Project settings — bug reporter roles

Add a "Bug Reporting" section to project settings where the PM can toggle which roles are allowed to create bugs. Checkboxes for each role in the project.

## File storage

Bug attachments use the same file storage approach as task attachments — local filesystem storage at `uploads/bugs/{bugId}/{storedName}`. The `storedName` is a UUID + original extension to prevent collisions. The service handles multipart upload, generates `storedName`, and creates the `BugAttachment` record.

## Migration strategy

1. Add `WorkflowKind` enum and `kind` column to `WorkflowStatus` (default `TASK`)
2. Add new models: `BugReproStep`, `BugAttachment`
3. Add `expectedResult`, `actualResult`, `parentTaskId`, `workflowStatusId` to `Bug`
4. Add `bugReporterRoles` to `Project` (default `["pm", "ba", "qc"]`)
5. Add `bugs` relation to `Task`
6. Data migration: for each project that has bugs, create default bug workflow statuses (kind=BUG), then map existing `status` enum values to the new workflow status IDs
7. Drop `status` column from `Bug`
8. Drop `reproductionSteps` column from `Bug`
9. Drop `BugStatus` enum

Steps 6-9 should be in a separate migration after verifying the data migration succeeded.

## Testing

- **BugsService**: create with repro steps, update with status transition validation, filter queries, parent task linking
- **BugAttachment**: upload, list (non-inline only), delete permissions (uploader or PM)
- **WorkflowService**: get/save statuses filtered by kind, default bug workflow seeding
- **BugsController**: role-based access using configurable `bugReporterRoles`, parameter validation
- **Frontend**: BugCreatePage form submission, repro step add/remove/reorder, file upload flow, BugListPage filtering
