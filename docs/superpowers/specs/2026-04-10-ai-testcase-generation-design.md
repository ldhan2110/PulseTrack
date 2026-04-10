# AI Test Case Generation — Design Spec

## Overview

Add an AI-powered test case generation feature to the TestCasesPage. Users select user stories (tasks) as input, provide optional context, and the AI generates structured test cases that can be reviewed, edited, and approved before creation.

This feature replicates the proven `ai-task-generation` pipeline architecture as an independent `ai-testcase-generation` module (Approach 1: Clone & Adapt).

## User Flow

1. User clicks "AI Generate" button on TestCasesPage (next to "+ New Test Case")
2. **GenerateTestCasesModal** opens with form:
   - Multi-select task list (filterable by search, sprint, status) — at least one required
   - Additional instructions textarea (10–5000 chars)
   - Toggle: "Generate Detailed Steps" (on by default)
   - Toggle: "Scan Codebase" (off by default)
   - File upload area (max 5 files, 10MB each: pdf, docx, txt, md, png, jpg, jpeg)
3. Submit queues a BullMQ job; modal switches to progress terminal with real-time streaming
4. On completion, modal closes and **TestCaseGenerationWizard** opens
5. User reviews each generated test case:
   - All fields fully editable: title, module, preconditions, expected result, priority, estimated time, tags, steps
   - Module dropdown pre-filled with AI suggestion, changeable to any existing module
   - Steps table with inline editing, add/remove/reorder
   - Actions: Approve (creates test case), Skip, Approve All
6. Approved test cases created via existing `POST /projects/:projectId/test-cases` endpoint

## Architecture

### Backend — New Module

```
apps/api/src/ai-testcase-generation/
├── ai-testcase-generation.module.ts
├── ai-testcase-generation.controller.ts
├── ai-testcase-generation.service.ts
├── ai-testcase-generation.processor.ts
└── dto/
    └── generate-testcases.dto.ts
```

**Controller** (`/projects/:projectId/ai/generate-testcases`):
- `POST /` — Accepts multipart form (prompt, taskIds, options, files). Queues BullMQ job, returns `{ jobId }`.
- `GET /:jobId` — Returns job status and results.

**Service**:
- `getProjectAiConfig()` — Reuses same pattern as ai-task-generation (fetch config, decrypt key)
- `buildGenerationPrompt(opts)` — Builds system prompt + user stories context + project context + scan results + user instructions
- `buildCliArgs()` / `buildCliEnv()` — Same CLI builder pattern for claude/gemini/codex providers
- `parseAndValidateOutput()` — Parses AI JSON output, validates against GeneratedTestCase schema
- `augmentPromptWithFiles()` — Appends uploaded file contents for non-Claude providers

**Processor** (BullMQ queue: `ai-testcase-generation`, concurrency: 4):
1. **pulling** — `git pull` in workspace (60s timeout)
2. **building-graph** — Build code-review-graph (300s timeout)
3. **scanning** — Scan codebase for relevant context (300s timeout)
4. **generating** — Call AI CLI with full prompt (600s timeout)
5. **parsing** — Parse and validate output

Progress streamed via WebSocket using existing `notifications` service.

### Frontend — New Components

```
apps/web/src/components/test-cases/
├── GenerateTestCasesModal.tsx
└── TestCaseGenerationWizard.tsx
apps/web/src/hooks/
└── useAiTestCaseGeneration.ts
```

**GenerateTestCasesModal**: Two-phase dialog (form → progress terminal). Same streaming terminal pattern as `GenerateTasksModal`.

**TestCaseGenerationWizard**: Two-panel dialog:
- Left sidebar: test case list grouped by source user story, with status icons (pending/approved/skipped), step count, priority
- Main area: full editable form for the selected test case
- Footer: Previous/Next navigation, Skip, Approve, Approve All

**useAiTestCaseGeneration hook**: Manages generation state (jobId, step, progress, displayLines, rawText, tasks). Uses polling (5s) + WebSocket for real-time updates. Same pattern as `useAiTaskGeneration`.

### Integration Points

- **TestCasesPage** — Add "AI Generate" button, conditionally shown when AI config exists. Opens GenerateTestCasesModal.
- **API client** — Add `generateTestCases(projectId, formData)` and `getTestCaseGenerationJobResult(projectId, jobId)` to `apps/web/src/lib/api.ts`.
- **Types** — Add `GeneratedTestCase`, `GenerateTestCasesJobData`, `GenerateTestCasesJobResult` to `apps/web/src/lib/types.ts`.
- **WebSocket events** — New events: `ai-testcase-generation:progress`, `ai-testcase-generation:completed`, `ai-testcase-generation:failed`, `ai-testcase-generation:stream`. Same payload structure as task generation events, scoped by jobId to avoid collision.

## Data Structures

### Request DTO

```typescript
class GenerateTestCasesDto {
  @IsString() @MinLength(10) @MaxLength(5000)
  prompt: string;

  @IsArray() @IsString({ each: true }) @ArrayMinSize(1)
  taskIds: string[];

  @IsOptional() @IsBoolean()
  generateSteps?: boolean; // default true

  @IsOptional() @IsBoolean()
  scanCodebase?: boolean; // default false
}
```

### AI Output Schema

```typescript
interface GeneratedTestCase {
  title: string;                    // max 200 chars
  preconditions: string | null;
  expectedResult: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedMinutes: number | null;
  tags: string[];
  suggestedModule: string;          // existing module name, best guess
  sourceTaskTitle: string;          // which user story this derives from
  steps?: GeneratedTestCaseStep[];  // only if generateSteps=true
}

interface GeneratedTestCaseStep {
  position: number;
  action: string;
  expectedResult: string;
}
```

### Job Data

```typescript
interface TestCaseGenerationJobData {
  projectId: string;
  userId: string;
  prompt: string;
  taskIds: string[];
  generateSteps: boolean;
  scanCodebase: boolean;
  uploadedFilePaths: string[];
}

interface TestCaseGenerationJobResult {
  testCases: GeneratedTestCase[];
}
```

## AI Prompt Strategy

The system prompt instructs the AI to:
- Generate positive, negative, and edge-case test scenarios per user story
- Use acceptance criteria as the primary source for test coverage
- Reference existing module names (passed in context) for `suggestedModule`
- Follow Given/When/Then thinking for step generation
- Keep test cases atomic — one scenario per test case
- Include `sourceTaskTitle` to map each test case back to its origin story

Input context includes:
- System prompt (QA best practices, output schema)
- Selected user stories: title + full description + acceptance criteria for each
- Project context from AI config
- Codebase scan results (if toggled on)
- User's additional instructions
- Uploaded file contents

## Edge Cases

- **No user stories selected** — Generate button disabled with tooltip
- **No AI config** — Info banner: "Configure AI in Project Settings to use this feature"
- **No modules exist** — Module dropdown in wizard shows warning; user must create a module before approving
- **Generation fails** — Error state with retry button, same as GenerateTasksModal
- **0 test cases generated** — Message: "AI couldn't generate test cases from the selected stories. Try adding more context."
- **Large task list (>50)** — Virtual scrolling in task selector with search/sprint/status filters
- **Duplicate detection** — Not in v1; user skips duplicates manually in wizard

## Out of Scope (v1)

- Duplicate test case detection
- Bulk module assignment in wizard
- Re-generation of individual test cases
- Test case linking to source user story (can be added later via TestCaseLink)
