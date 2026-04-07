# AI Task Generation — Design Spec

**Date:** 2026-04-07
**Status:** Draft
**Purpose:** Allow BAs to generate structured tasks (with sub-tasks) using AI, reviewed via a step-by-step wizard before creation.

---

## 1. Overview

BAs click "Generate with AI" on the task list page. A modal collects their prompt, optional document uploads, and toggle options. The backend enqueues a BullMQ job that pulls latest code, optionally scans the codebase via code-graph, constructs an AI prompt, and executes the configured CLI (Claude/Gemini/Codex). The AI returns structured JSON tasks. The BA reviews each task in a wizard flow — approving, editing, or skipping — before tasks are created.

**Key decisions:**
- Entry point: button on task list page next to "Create Task"
- Input: prompt + document upload + scan codebase toggle + break into sub-tasks toggle
- No sprint pre-selection — BAs assign sprints later
- Assignee left unassigned by default
- AI generates: title, description (user story format), acceptance criteria (Given/When/Then), priority, story points
- Output reviewed via step-by-step wizard (not bulk approve)
- Sub-task breakdown is a global toggle — AI generates full parent+child tree upfront
- Backend uses BullMQ job queue with `concurrency: 4` for parallel CLI execution
- Git always pulls latest before scanning
- Uploaded documents stored on disk, paths passed to CLI directly

---

## 2. Architecture

### Flow

```
BA clicks "Generate with AI"
  → Modal opens (prompt, files, toggles)
  → Submit
    → API stores uploaded files to disk
    → API enqueues BullMQ `ai-task-generation` job
    → Returns { jobId } immediately
  → Worker picks up job:
    1. git pull on cloned repo workspace
    2. If "Scan codebase" toggled:
       - Run CLI with code-graph pre-scan prompt scoped to user's prompt
       - Capture scan output as additional context
    3. Construct full AI prompt (system instructions + project context + scan results + file paths)
    4. Execute CLI with --output-format json
    5. Parse and validate JSON output
    6. Emit Socket.IO events throughout (progress, completed, failed)
  → Frontend receives ai-generation:completed
  → Wizard opens for step-by-step review
  → BA approves/edits/skips each task
  → Approved tasks created via existing TasksService.create()
```

### Concurrency

- BullMQ worker runs with `concurrency: 4` — supports 4 simultaneous CLI processes
- Each `execFile` spawns an independent child process; no interference between jobs
- 5th+ concurrent job queues and picks up when a slot opens
- BA sees "Queued..." status via Socket.IO until their job starts

---

## 3. Input Modal

### Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| Prompt | Textarea | Yes | "Describe what tasks you need..." — min 10 chars |
| Upload Documents | File dropzone | No | Max 5 files, 10MB each. Accepts: `.pdf`, `.docx`, `.txt`, `.md`, `.png`, `.jpg` |
| Scan Codebase | Toggle switch | No | Default off. When on, AI scans relevant repo parts via code-graph |
| Break into Sub-tasks | Toggle switch | No | Default off. When on, AI generates parent + child tasks |

### Behavior

- Submit disables the form, shows progress indicator with Socket.IO status
- BA can close the modal and keep working — toast notification appears when generation completes
- Clicking the toast re-opens the wizard
- If generation fails, error shown with retry button
- "Generate with AI" button disabled with tooltip when:
  - Repo not cloned: "Clone repository first"
  - AI config not set: "Configure AI settings first"

---

## 4. AI Prompt Construction

### Prompt Layers

The worker builds the prompt in layers:

**Layer 1 — System Instructions:**

```
You are a Business Analyst assistant for a project management tool.
Generate tasks as structured JSON based on the user's request.

## Task Description Format
Write each task description as a user story:
- "As a [role], I want [capability], so that [business value]"
- Follow with implementation notes: what needs to happen technically,
  key considerations, edge cases
- Reference relevant code areas if codebase scan results are provided

## Acceptance Criteria Format
Every task MUST include acceptance criteria:
- Use "Given / When / Then" format where applicable
- Each criterion must be specific and verifiable
- No vague statements like "works correctly"
- Cover happy path, edge cases, and error scenarios
- For sub-tasks, scope criteria to that sub-task only

## Priority Assignment
- CRITICAL: Blocks other work or is a security/data concern
- HIGH: Core functionality required for the feature
- MEDIUM: Important but not blocking
- LOW: Nice-to-have, polish, or optimization

## Story Points (Fibonacci Scale)
1, 2, 3, 5, 8, 13 — base on complexity, not time.

## Output Format
Return ONLY valid JSON matching this schema:
{
  "tasks": [
    {
      "title": "string",
      "description": "string (user story + implementation notes)",
      "acceptanceCriteria": "string (checklist with Given/When/Then)",
      "priority": "CRITICAL | HIGH | MEDIUM | LOW",
      "storyPoints": number,
      "subTasks": [
        {
          "title": "string",
          "description": "string",
          "acceptanceCriteria": "string",
          "priority": "CRITICAL | HIGH | MEDIUM | LOW",
          "storyPoints": number
        }
      ]
    }
  ]
}

If "Break into sub-tasks" is not requested, omit the subTasks array entirely.
```

**Layer 2 — Project Context:**
The stored `projectContext` string from `AiConfig`.

**Layer 3 — Code-Graph Scan Results (if toggled):**
Output from the pre-scan CLI call scoped to the user's prompt.

**Layer 4 — User Prompt:**
The BA's freeform text input.

**Uploaded files** are passed as CLI file arguments — the AI reads them directly from disk. File argument handling varies by provider:
- **Claude:** files passed via the prompt referencing their absolute paths (Claude Code reads files from the filesystem)
- **Gemini/Codex:** file contents read by the worker and injected into the prompt as text (fallback for CLIs that don't support filesystem access)

### Code-Graph Pre-Scan

When "Scan codebase" is toggled:

1. Worker runs `git pull` on the workspace (always, regardless of toggle)
2. Worker executes CLI with a pre-scan prompt:

```
Using the code-graph skill, scan this codebase for areas related to:
"{user_prompt}"

Return a structured summary of:
- Relevant files and their purpose
- Key functions/classes involved
- Current architecture in the affected area
- Any existing patterns that new code should follow

Keep the summary concise and focused on what's relevant to the request.
```

3. Pre-scan output is injected as Layer 3 context for the main generation prompt

### Git Pull

`git pull` always runs before any operation — even if codebase scan is off. This ensures the project context references are against the latest code.

---

## 5. Wizard Review Flow

### Layout

- **Left sidebar** — vertical task list showing all generated tasks with status badges:
  - Pending (default) — gray
  - Current — blue highlight
  - Approved — green check
  - Skipped — strikethrough
  - Parent tasks show nested sub-tasks indented below
- **Main area** — current task rendered in full:
  - Title (editable in edit mode)
  - Description rendered as formatted text (editable as textarea in edit mode)
  - Acceptance criteria rendered as checklist (editable in edit mode)
  - Priority badge (editable as dropdown in edit mode)
  - Story points (editable as number input in edit mode)
- **Bottom action bar:**
  - "Back" — return to previous task (approved tasks shown read-only)
  - "Skip" — discard this task, move to next
  - "Edit & Approve" — toggle fields to editable, button changes to "Save & Approve"
  - "Approve" — create task immediately, move to next
  - "Approve All Remaining" — bulk approve everything left without edits

### Sub-Task Handling

- Wizard order: Parent 1 → Sub-task 1.1 → Sub-task 1.2 → Parent 2 → Sub-task 2.1 → ...
- After approving a parent, its sub-tasks are shown next
- Sub-tasks created with parent's `id` as `parentId` via `TasksService.create()`
- If BA skips a parent, all its sub-tasks are automatically skipped
- Sub-tasks indented in the sidebar under their parent

### Completion Screen

After all tasks are reviewed:
- Summary: "Created X tasks, Y sub-tasks, Z skipped"
- Button: "View Tasks" — navigates to the task list (filtered to show new tasks)
- Button: "Generate More" — re-opens the input modal

### Persistence

- Job result persists on BullMQ job data
- If BA closes browser mid-wizard, they can resume via:
  - Toast notification (if still in session)
  - "Recent Generations" indicator on the "Generate with AI" button showing pending wizard sessions

---

## 6. Backend Components

### New Module: `AiTaskGenerationModule`

**Files:**

```
apps/api/src/ai-task-generation/
  ai-task-generation.module.ts
  ai-task-generation.controller.ts
  ai-task-generation.service.ts
  ai-task-generation.processor.ts
  dto/
    generate-tasks.dto.ts
```

### Controller

```
POST /projects/:projectId/ai/generate-tasks
  - Accepts: multipart/form-data
  - Fields: prompt (string), scanCodebase (boolean), breakIntoSubTasks (boolean)
  - Files: documents[] (max 5, max 10MB each)
  - Stores files to: workspaces/{projectId}/uploads/{jobId}/
  - Enqueues BullMQ job
  - Returns: { jobId: string }

GET /projects/:projectId/ai/generate-tasks/:jobId
  - Returns job status + result (parsed task list) when completed
  - Response: { status: 'queued' | 'active' | 'completed' | 'failed', tasks?: GeneratedTask[], error?: string }
```

### DTO

```typescript
class GenerateTasksDto {
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  prompt: string;

  @IsOptional()
  @IsBoolean()
  scanCodebase?: boolean; // default false

  @IsOptional()
  @IsBoolean()
  breakIntoSubTasks?: boolean; // default false
}
```

### Processor (BullMQ Worker)

```
Queue name: 'ai-task-generation'
Concurrency: 4

Job data: {
  projectId: string
  prompt: string
  scanCodebase: boolean
  breakIntoSubTasks: boolean
  uploadedFilePaths: string[]
  userId: string
}

Steps:
1. Emit progress: 'pulling'
2. git pull on workspace
3. If scanCodebase:
   a. Emit progress: 'scanning'
   b. Run CLI with code-graph pre-scan prompt
   c. Capture scan output
4. Emit progress: 'generating'
5. Build full prompt (system instructions + project context + scan + user prompt)
6. Run CLI with --output-format json, passing uploaded file paths as arguments
7. Emit progress: 'parsing'
8. Parse and validate JSON output
9. Store result on job
10. Emit ai-generation:completed
```

### Service

Orchestration logic:
- `constructPrompt()` — assembles all prompt layers
- `validateOutput()` — validates AI JSON against expected schema
- `buildCliArgs()` — constructs CLI arguments including file paths
- `cleanupUploads()` — removes upload directory after job completes

### Socket.IO Events

| Event | Payload | When |
|---|---|---|
| `ai-generation:progress` | `{ jobId, step: 'pulling' \| 'scanning' \| 'generating' \| 'parsing' }` | Each processing stage |
| `ai-generation:completed` | `{ jobId, taskCount: number }` | Job finished successfully |
| `ai-generation:failed` | `{ jobId, error: string }` | Job failed |

Events emitted to the BA's user room (not project room — generation is personal to the BA).

---

## 7. Frontend Components

### New Files

```
apps/web/src/components/tasks/
  GenerateTasksModal.tsx        — input modal with form + progress
  TaskGenerationWizard.tsx      — step-by-step review wizard
apps/web/src/hooks/
  useAiTaskGeneration.ts        — mutation + Socket.IO listener + job result query
```

### `GenerateTasksModal.tsx`

- Triggered by "Generate with AI" button (with Sparkles icon) on task list page
- Form: prompt textarea, file dropzone, two toggle switches
- On submit: calls `POST /projects/:projectId/ai/generate-tasks` with `multipart/form-data`
- Progress state: idle → uploading → queued → pulling → scanning → generating → parsing → completed
- On completed: auto-transitions to `TaskGenerationWizard`
- Closeable during processing — toast notification on completion

### `TaskGenerationWizard.tsx`

- Full-screen modal or overlay
- Left sidebar: task tree with status indicators
- Main area: task detail (read-only default, editable on "Edit & Approve")
- Bottom action bar: Back / Skip / Edit & Approve / Approve / Approve All Remaining
- Each "Approve" calls existing `POST /projects/:projectId/tasks` endpoint
- Completion summary screen with task counts and navigation links

### `useAiTaskGeneration.ts`

```typescript
// Mutation to submit generation request
const generate = useMutation(submitGenerationRequest);

// Socket.IO listener for progress events
useEffect(() => {
  socket.on('ai-generation:progress', handler);
  socket.on('ai-generation:completed', handler);
  socket.on('ai-generation:failed', handler);
  return () => { /* cleanup */ };
}, [jobId]);

// Query to fetch job result for wizard
const { data: result } = useQuery({
  queryKey: ['ai-task-generation', projectId, jobId],
  queryFn: () => fetchJobResult(projectId, jobId),
  enabled: !!jobId && status === 'completed',
});
```

### Modified Files

- **Task list page** — add "Generate with AI" button next to existing "Create Task" button
  - Button disabled with tooltip when repo not cloned or AI config not set

---

## 8. File Upload & Storage

- Frontend sends files as `multipart/form-data` with the generation request
- Backend stores to: `workspaces/{projectId}/uploads/{jobId}/` preserving original filenames
- File paths passed directly as CLI arguments — AI reads files natively
- After wizard completes: uploaded files attached to approved parent tasks via existing `Attachment` model
- Size limits: 10MB per file, max 5 files per request
- Accepted types: `.pdf`, `.docx`, `.txt`, `.md`, `.png`, `.jpg`
- Cleanup: upload directory removed 24 hours after job completion via `@nestjs/schedule` cron job

---

## 9. Error Handling

| Scenario | Handling |
|---|---|
| CLI timeout (>120s) | Job marked failed, BA gets `ai-generation:failed` with retry option |
| CLI returns malformed JSON | Worker retries once with stricter prompt. If still fails, returns error to BA |
| Repo not cloned | "Generate with AI" button disabled — tooltip: "Clone repository first" |
| AI config not set | Button disabled — tooltip: "Configure AI settings first" |
| Git pull fails | Job fails with "Could not pull latest code" message, BA can retry |
| BA closes browser mid-wizard | Job result persists — BA can resume via toast or "Recent Generations" indicator |
| Concurrent generation by same BA | Allowed — each job is independent |
| 5+ simultaneous jobs across BAs | 5th+ job queues, BA sees "Queued..." status via Socket.IO |
| Upload too large | 413 response, frontend shows "File exceeds 10MB limit" |
| Unsupported file type | Frontend validation rejects before upload |

---

## 10. Expected AI Output Schema

```typescript
interface GeneratedTaskOutput {
  tasks: GeneratedTask[];
}

interface GeneratedTask {
  title: string;                    // max 200 chars
  description: string;              // user story format + implementation notes
  acceptanceCriteria: string;       // Given/When/Then checklist format
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  storyPoints: 1 | 2 | 3 | 5 | 8 | 13;
  subTasks?: GeneratedTask[];       // only when breakIntoSubTasks is true
}
```

---

## 11. What's NOT in Scope

- Sprint assignment at generation time — BAs assign later
- Auto-assignment of tasks to team members
- Generation history / saved prompts (future enhancement)
- Streaming task output (uses job queue, not SSE)
- Editing the system prompt from the UI
- Batch re-generation of specific tasks from wizard
