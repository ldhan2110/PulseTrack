# WBS Import Excel & AI Suggestion — Design Spec

**Date:** 2026-04-15
**Status:** Approved

## Overview

Two new features for the WBS (Work Breakdown Structure) module:

1. **Import Excel** — Parse an exported WBS Excel file client-side and bulk-import phases/tasks/subtasks into the project
2. **AI WBS Suggestion Wizard** — Multi-step wizard to collect scope, team, and constraints, then use AI (via CLI) to generate a fully scheduled WBS with chat-based iteration before importing

Both features share a single **bulk-create API endpoint** as their import target.

---

## Feature 1: Import Excel

### User Flow

1. User clicks "Import Excel" button in `WbsToolbar` (next to existing "Export Excel")
2. Dialog opens with a file dropzone accepting `.xlsx` files
3. After file selection, a preview table shows parsed rows with: Level (Phase/Task/Subtask), Title, Plan Start, Plan End, Actual Start, Actual End, Progress
4. Validation indicators highlight rows with errors (missing title, invalid dates)
5. User clicks "Import X items" to confirm
6. Items are appended to existing WBS data via the bulk-create endpoint

### Parsing Logic (Client-Side)

File: `apps/web/src/lib/importWbs.ts`

- Uses `xlsx-js-style` (already installed in web app)
- Accepts the same format as the existing export (`exportWbs.ts`)
- Skips header rows (row 0 = month headers, row 1 = day numbers)
- Detects hierarchy level by leading whitespace in the Task column:
  - 0 spaces = Phase (level 0)
  - 2 spaces = Task (level 1)
  - 4 spaces = Subtask (level 2)
- Parses dates in DD/MM/YYYY format (matching export)
- Parses progress column (strips `%` suffix)
- Builds nested `BulkCreateWbsDto` payload
- Returns both structured payload and flat preview array for UI display

### Import Behavior

- **Append mode**: Imported items are added alongside existing WBS data
- Positions are auto-calculated from the current maximum position
- Rollup calculations run after creation

---

## Feature 2: AI WBS Suggestion Wizard

### Wizard Steps

#### Step 1 — Scope Input
- **Excel upload (optional)**: Dropzone for `.xlsx` file containing scopes, features, or requirements
- **Manual feature list**: Add/remove feature items inline (text input with add button)
- **Additional instructions**: Free-text textarea for context (e.g., "Focus on MVP", "Use microservice architecture")
- User must provide at least one feature (from Excel or manual input)

#### Step 2 — Team Setup
- **Total team size**: Number input
- **Roles table**: Rows with role name + count (e.g., "Frontend Developer × 2")
- Add/remove role rows
- Preset common roles: Frontend Dev, Backend Dev, QA Engineer, DevOps, Project Manager, UI/UX Designer

#### Step 3 — Constraints
- **Project start date**: Date picker (required)
- **Target end date**: Date picker (optional)
- **Methodology**: Toggle between Agile / Waterfall / Hybrid
- **Sprint duration** (shown when Agile/Hybrid): 1 week / 2 weeks / 3 weeks

#### Step 4 — Review & Generate
- Summary of all inputs from steps 1-3
- "Generate WBS" button to start AI generation
- Displays progress via Socket.IO streaming (same pattern as task generation)

### Post-Generation: Preview + Chat Iteration

After AI generates the WBS, the wizard transitions to a split-panel view:

**Left panel — WBS Tree Preview:**
- Collapsible tree showing phases/tasks/subtasks with planned dates
- Stats bar: phase count, task count, subtask count
- "Import to WBS" button to confirm and create via bulk-create endpoint
- "Cancel" button to discard

**Right panel — Chat for Refinement:**
- Chat interface for iterating on the generated WBS
- User sends natural language feedback (e.g., "Break Phase 2 into smaller phases", "Add a testing phase after each development phase")
- AI sees the current WBS state and makes incremental edits (returns only modified phases)
- Updated WBS re-renders in the left preview panel in real-time
- Chat history is maintained for context

### AI Architecture

#### Backend Service: `AiWbsGenerationService`

Follows the established pattern from `AiTaskGenerationService`:

- Reuses project AI Config (same provider/model/key)
- Executes via CLI (claude/gemini/codex) with `--dangerously-skip-permissions` for Claude
- Job queue with Socket.IO streaming for progress updates
- Polling fallback every 5 seconds

#### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/projects/:projectId/ai/generate-wbs` | Start WBS generation (FormData with optional Excel file) |
| POST | `/projects/:projectId/ai/wbs-chat` | Send chat message with current WBS + user feedback, returns full updated WBS JSON |
| GET | `/projects/:projectId/ai/wbs-generation/:jobId` | Poll job status/result |

#### Socket.IO Events

| Event | Payload | Direction |
|-------|---------|-----------|
| `ai-wbs-generation:progress` | `{ jobId, step }` | Server → Client |
| `ai-wbs-generation:completed` | `{ jobId, phaseCount, taskCount }` | Server → Client |
| `ai-wbs-generation:failed` | `{ jobId, error }` | Server → Client |
| `ai-wbs-generation:stream` | `{ jobId, displayLines?, rawText? }` | Server → Client |

#### AI Prompt Design

**Generation prompt includes:**
- System prompt instructing AI to act as a project estimator using bottom-up estimation
- Features/scope list (from Excel content or manual input)
- Team composition (roles and counts)
- Constraints (start date, end date, methodology, sprint duration)
- Project context from the project's AI Config
- Instructions to calculate: `available_hours = team_size × roles × hours_per_sprint`
- Instructions to schedule tasks sequentially within dependencies, parallel across independent work streams
- Output format: structured JSON matching `BulkCreateWbsDto` schema

**Chat prompt includes:**
- The full current WBS state as JSON
- The user's message
- AI is instructed to return the full WBS JSON (all phases) so the frontend can simply replace the preview state. The prompt encourages the AI to only modify relevant sections, but the response format is always the complete WBS structure for simplicity
- Conversation history for context continuity

---

## Shared: Bulk-Create API

### Endpoint

`POST /projects/:projectId/wbs/bulk-create`

### Request Payload (`BulkCreateWbsDto`)

```json
{
  "phases": [
    {
      "title": "string (required)",
      "description": "string (optional)",
      "planStart": "ISO date string (optional)",
      "planEnd": "ISO date string (optional)",
      "actualStart": "ISO date string (optional)",
      "actualEnd": "ISO date string (optional)",
      "progress": "number 0-100 (optional, default 0)",
      "tasks": [
        {
          "title": "string (required)",
          "description": "string (optional)",
          "planStart": "ISO date string (optional)",
          "planEnd": "ISO date string (optional)",
          "actualStart": "ISO date string (optional)",
          "actualEnd": "ISO date string (optional)",
          "progress": "number 0-100 (optional, default 0)",
          "subtasks": [
            {
              "title": "string (required)",
              "description": "string (optional)",
              "planStart": "ISO date string (optional)",
              "planEnd": "ISO date string (optional)",
              "actualStart": "ISO date string (optional)",
              "actualEnd": "ISO date string (optional)",
              "progress": "number 0-100 (optional, default 0)"
            }
          ]
        }
      ]
    }
  ]
}
```

### Behavior

- Appends to existing WBS data (does not replace)
- Auto-calculates positions from current max per level
- Creates all items in a single Prisma transaction
- Runs rollup calculations after creation
- Returns created phases with full nested structure

---

## File Structure

### New Files

```
# API (Backend)
apps/api/src/wbs/dto/bulk-create-wbs.dto.ts
apps/api/src/ai-wbs-generation/
  ai-wbs-generation.module.ts
  ai-wbs-generation.service.ts
  ai-wbs-generation.controller.ts
  ai-wbs-generation.gateway.ts
  dto/generate-wbs.dto.ts

# Web (Frontend)
apps/web/src/lib/importWbs.ts
apps/web/src/hooks/useAiWbsGeneration.ts
apps/web/src/hooks/useWbsImport.ts
apps/web/src/components/wbs/WbsImportDialog.tsx
apps/web/src/components/wbs/WbsAiWizard.tsx
apps/web/src/components/wbs/wizard/
  WizardScopeStep.tsx
  WizardTeamStep.tsx
  WizardConstraintsStep.tsx
  WizardReviewStep.tsx
  WizardPreviewChat.tsx
  WbsTreePreview.tsx
  WizardChatPanel.tsx
```

### Modified Files

```
# API
apps/api/src/wbs/wbs.service.ts          — add bulkCreate() method
apps/api/src/wbs/wbs.controller.ts        — add bulkCreate endpoint
apps/api/src/wbs/wbs.module.ts            — import AiWbsGenerationModule
apps/api/src/app.module.ts                — register AiWbsGenerationModule

# Web
apps/web/src/components/wbs/WbsToolbar.tsx — add Import Excel + AI Suggest buttons
apps/web/src/hooks/useWbs.ts              — add useBulkCreateWbs mutation
apps/web/src/lib/api.ts                   — add bulkCreateWbs, generateWbs, wbsChat, getWbsGenerationResult
apps/web/src/lib/types.ts                 — add WBS wizard types
apps/web/src/pages/WbsPage.tsx            — wire up import dialog + wizard dialog state
```

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Excel parsing location | Client-side | Instant preview, reuses `xlsx-js-style`, no file upload needed |
| Import behavior | Append (not replace) | Non-destructive, safer for existing data |
| AI config | Reuse project AI Config | Simpler, consistent with task/testcase generation |
| Wizard output | Preview with chat iteration | Users can refine before committing; chat keeps context |
| Excel in wizard | Optional | Users may want to type features directly |
| Chat iteration | Context-aware incremental edits | AI sees current WBS state, modifies only affected parts |
| WBS scheduling | Full dates calculated | AI uses team capacity + estimation techniques to produce planStart/planEnd |
| Shared endpoint | Bulk-create for both features | Single API surface, DRY, both features produce same payload format |
