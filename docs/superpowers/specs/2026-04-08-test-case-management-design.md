# Test Case Management — Design Spec

## Overview

QC-focused test case definition and execution system for PulseTrack. Standalone test cases with optional links to tasks/bugs, organized by modules (hierarchy) and suites (execution grouping). Formal test executions where QC picks cases, works through steps, records results with evidence, and can auto-fill bug reports from failures. Foundation for future automation testing.

## Data Model

### New Enums

```prisma
enum TestCaseStatus {
  DRAFT
  ACTIVE
  DEPRECATED
}

enum TestResultStatus {
  NOT_RUN
  IN_PROGRESS
  PASS
  FAIL
  BLOCKED
  SKIP
}

enum TestExecutionStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
}
```

### New Models

**TestModule** — Hierarchical folders for organizing test cases.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| name | String | Module name |
| position | Int | Sort order among siblings |
| projectId | String | FK → Project |
| parentId | String? | FK → TestModule (self-ref for hierarchy) |

- `@@unique([projectId, parentId, name])` — no duplicate names at same level

**TestCase** — A single test case definition.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| testCaseKey | String? | Auto-generated key e.g. "TC-1" (unique) |
| title | String | Required |
| preconditions | String? | Setup needed before testing |
| expectedResult | String? | Overall expected result |
| priority | Priority? | Reuses existing Priority enum |
| status | TestCaseStatus | Default: DRAFT |
| tags | String[] | Free-form labels for filtering |
| estimatedMinutes | Int? | Estimated execution time |
| moduleId | String | FK → TestModule |
| projectId | String | FK → Project |
| creatorId | String | FK → User |
| createdAt | DateTime | |
| updatedAt | DateTime | |

- Requires `testCaseSeq Int @default(0)` on Project model for auto-key generation

**TestCaseStep** — Ordered steps within a test case.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| testCaseId | String | FK → TestCase |
| position | Int | Step order |
| action | String | What to do |
| expectedResult | String | What should happen |

- `@@unique([testCaseId, position])`

**TestCaseLink** — Optional polymorphic link to Task or Bug.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| testCaseId | String | FK → TestCase |
| entityType | EntityType | TASK or BUG (reuses existing enum) |
| entityId | String | Task or Bug ID |

- `@@unique([testCaseId, entityType, entityId])`

**TestSuite** — Named grouping of test cases for execution.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| name | String | Suite name |
| description | String? | |
| projectId | String | FK → Project |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**TestSuiteMember** — Many-to-many: TestCase ↔ TestSuite.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| suiteId | String | FK → TestSuite |
| testCaseId | String | FK → TestCase |
| position | Int | Order within suite |

- `@@unique([suiteId, testCaseId])`

**TestExecution** — A formal test run.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| name | String | Run name |
| status | TestExecutionStatus | Default: PENDING |
| assigneeId | String | FK → User |
| projectId | String | FK → Project |
| sprintId | String? | FK → Sprint (optional) |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**TestExecutionCase** — Per-case result within an execution.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| executionId | String | FK → TestExecution |
| testCaseId | String | FK → TestCase |
| result | TestResultStatus | Default: NOT_RUN |
| notes | String? | Tester notes |
| executedById | String? | FK → User |
| executedAt | DateTime? | When result was recorded |

- `@@unique([executionId, testCaseId])`

**TestExecutionAttachment** — Evidence files per case execution.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| executionCaseId | String | FK → TestExecutionCase |
| filename | String | Original filename |
| storedName | String | Storage filename |
| mimeType | String | |
| size | Int | Bytes |
| uploaderId | String | FK → User |
| createdAt | DateTime | |

## Pages & Routes

| Route | Page Component | Description |
|---|---|---|
| `/projects/:projectPrefix/test-cases` | TestCasesPage | Module tree + case list + CRUD + suite management |
| `/projects/:projectPrefix/test-executions` | TestExecutionsPage | Execution list + detail + step-by-step runner |

Both routes added inside the existing `ProtectedRoute` wrapper in `App.tsx`.

## API Modules (NestJS)

### TestModulesModule
- `GET /projects/:id/test-modules` — list module tree
- `POST /projects/:id/test-modules` — create module
- `PATCH /test-modules/:id` — update (rename, move, reorder)
- `DELETE /test-modules/:id` — delete (cascade test cases or block if non-empty)

### TestCasesModule
- `GET /projects/:id/test-cases` — list with filters (moduleId, suiteId, tags, status, priority, search)
- `GET /test-cases/:id` — get with steps, links
- `POST /projects/:id/test-cases` — create with steps and links
- `PATCH /test-cases/:id` — update case, steps, links
- `DELETE /test-cases/:id` — delete
- `POST /test-cases/bulk-suite` — add multiple cases to a suite

### TestSuitesModule
- `GET /projects/:id/test-suites` — list suites with case count
- `POST /projects/:id/test-suites` — create
- `PATCH /test-suites/:id` — update
- `DELETE /test-suites/:id` — delete
- `POST /test-suites/:id/members` — add cases
- `DELETE /test-suites/:id/members/:testCaseId` — remove case
- `PATCH /test-suites/:id/members/reorder` — reorder cases

### TestExecutionsModule
- `GET /projects/:id/test-executions` — list with stats
- `GET /test-executions/:id` — get with cases and results
- `POST /projects/:id/test-executions` — create (from suite or cherry-picked cases)
- `PATCH /test-executions/:id` — update name/status/assignee
- `DELETE /test-executions/:id` — delete
- `PATCH /test-execution-cases/:id/result` — update result, notes
- `POST /test-execution-cases/:id/attachments` — upload evidence
- `DELETE /test-execution-attachments/:id` — delete evidence
- `GET /test-executions/:id/stats` — pass/fail/blocked/skip/not-run counts

## Frontend Components

### Test Cases Page
- **ModuleTree** — collapsible tree, drag-to-reorder, right-click rename/delete, "+" button for new module
- **TestCasesTable** — sortable columns (ID, title, priority, status, steps count, est. time, tags), search, filters
- **TestCaseForm** — create/edit modal with title, preconditions, expected result, priority, module selector, tags input, links picker, estimated time
- **StepsBuilder** — ordered list with action + expected result per row. Tab to add next row. Drag to reorder. Paste multi-line auto-splits into steps.
- **SuiteManager** — sidebar section listing suites with counts. Modal for CRUD. Bulk add selected cases to suite.
- **TestCaseLinkPicker** — search and link to existing tasks or bugs

### Test Executions Page
- **ExecutionList** — cards showing name, assignee, suite, sprint, progress bar with color-coded result breakdown, completion %
- **ExecutionDetail** — case checklist table with ID, title, priority, result badge, executed by, actions. "+" Add Cases" button.
- **ExecutionRunner** — step-by-step mode showing preconditions, expected result, each step with Pass/Fail/Blocked/Skip buttons and optional note. Prev/Next case navigation. "Mark All Pass" shortcut.
- **ResultBadge** — clickable status selector dropdown
- **EvidenceUploader** — file upload area per test case execution result. Supports images, screenshots, files.
- **BugAutoFillModal** — pre-filled bug creation form with title (includes TC key), description (execution context), repro steps (from test steps), expected result, severity (mapped from priority), linked task/bug (from test case links), evidence attachments

## Key Behaviors

### Auto-generated Keys
Add `testCaseSeq Int @default(0)` to the Project model. Test cases get keys like "TC-1", "TC-2" using the same pattern as `taskSeq` and `bugSeq`.

### Easy Input
- Steps builder: Tab key adds next row. Paste multi-line text auto-splits into individual steps.
- Quick-add from list view: title-only creation, fill details later.
- Inline editing where possible to reduce modal fatigue.

### Test Evidence
- Per test case execution (not per step) — one attachment area for screenshots, files, screen recordings.
- Evidence attachments carry over to auto-filled bug reports.
- Reuses the same file upload infrastructure as task/bug attachments.

### Fail to Bug Auto-Fill
When QC marks a test case as failed and clicks "Create Bug":
- **Title**: `[TC-{key}] {test case title} — {failed step summary}`
- **Description**: Execution context (run name, tester, date)
- **Repro Steps**: Populated from test case steps, with failed step highlighted
- **Expected Result**: From test case expected result
- **Actual Result**: Empty (QC fills in)
- **Severity**: Mapped from test case priority (CRITICAL→CRITICAL, HIGH→HIGH, MEDIUM→MEDIUM, LOW→LOW)
- **Linked Task**: From test case links (if any)
- **Attachments**: Evidence files from the execution case

### Automation Foundation
- TestCase and TestCaseStep have stable IDs and structured data (action + expected result) ready for mapping to automation scripts.
- TestExecutionCase results can be written programmatically via API (automation runner posts results).
- TestExecution can be created and populated via API for CI/CD integration.

## Sidebar Navigation

Two new items in the project sidebar, placed after "Bugs":
- "Test Cases" (icon: clipboard/checklist)
- "Test Executions" (icon: play button)
