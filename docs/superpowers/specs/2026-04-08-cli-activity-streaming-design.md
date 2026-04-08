# CLI Activity Streaming + Wizard Footer Fix

**Date:** 2026-04-08
**Status:** Approved

## Overview

Two changes to the AI task generation flow:
1. Stream real-time CLI activity (tool calls, file reads, searches) to the terminal during AI generation using Claude Code's `stream-json` output format
2. Fix wizard modal footer being pushed off-screen by long content

## Feature 1: CLI Activity Streaming

### Problem

The terminal in `GenerateTasksModal` shows raw CLI text output — just the final JSON response being generated character by character. Users have no visibility into what the AI is actually doing (reading files, searching code, reasoning).

### Solution

Switch Claude Code CLI from `--output-format text` to `--output-format stream-json`. Parse the structured JSON events in real-time and translate tool calls into human-readable status messages.

### Backend Changes

**File: `apps/api/src/ai-task-generation/ai-task-generation.processor.ts`**

- Modify `runCliStreaming` to accept a `parseMode` option: `'raw'` (default) or `'stream-json'`
- When `parseMode` is `'stream-json'`:
  - Each stdout line is parsed as a JSON event
  - Tool use events are translated to friendly messages via `formatStreamEvent()`
  - Two buffers are maintained: `displayLines: string[]` and `rawText: string`
  - `onChunk` callback receives `{ displayLine?: string; rawText: string }`
- When `parseMode` is `'raw'`: current behavior unchanged

**Event translation table:**

| stream-json event type | Display message format |
|---|---|
| `assistant` tool_use: `Read` | `Reading <file_path>` |
| `assistant` tool_use: `Grep` | `Searching for "<pattern>"` |
| `assistant` tool_use: `Glob` | `Finding files matching <pattern>` |
| `assistant` tool_use: `Bash` | `Running command...` |
| `assistant` tool_use: `Edit`/`Write` | `Editing <file_path>` |
| `assistant` text content | (silent — accumulate into rawText) |
| `result` | (silent — final output captured for parsing) |
| Unknown/other | (silent — skip) |

**Socket payload change for `ai-generation:stream`:**

```typescript
// Before
{ jobId: string; text: string }

// After
{ jobId: string; displayLines: string[]; rawText: string }
```

**File: `apps/api/src/ai-task-generation/ai-task-generation.service.ts`**

- For Claude provider: change `--output-format text` to `--output-format stream-json` in `buildCliArgs()`
- Non-Claude providers: no changes

### Frontend Changes

**File: `apps/web/src/hooks/useAiTaskGeneration.ts`**

- Replace `streamText: string` state with `displayLines: string[]` and `rawText: string`
- Update `onStream` handler to set both fields
- Update polling fallback to sync both fields
- Export both from the hook

**File: `apps/web/src/components/tasks/GenerateTasksModal.tsx`**

- `TerminalOutput` accepts `displayLines: string[]` and `rawText: string`
- Default view: render `displayLines` as styled status entries (each on its own line with a subtle icon)
- Add a small "Raw" toggle button in the terminal header bar
- When toggled: show `rawText` (current behavior)
- Fallback: if `displayLines` is empty, show `rawText` (for non-Claude providers)

### Non-Claude Provider Behavior

Gemini and Codex keep current raw streaming. The frontend detects empty `displayLines` and falls back to showing `rawText` automatically.

## Feature 2: Wizard Sticky Footer

### Problem

In `TaskGenerationWizard.tsx`, the action bar (Back/Skip/Approve/Approve All) at line 594 gets pushed below the viewport when task content is long, despite the modal having `max-h-[85vh]`.

### Solution

Add `shrink-0` to the footer div to prevent flex compression. The existing `flex-1 min-h-0` on the ScrollArea parent should constrain the scrollable area properly once the footer can't shrink.

**File: `apps/web/src/components/tasks/TaskGenerationWizard.tsx`**

- Line 594: Add `shrink-0` class to the footer `<div>`

## Scope Boundaries

- No changes to the scan step CLI args (scan also uses CLI — same stream-json parsing applies)
- No new npm dependencies
- No changes to the BullMQ job data schema
- Polling fallback extended but same pattern
- `stream-json` is a documented Claude Code CLI output format
