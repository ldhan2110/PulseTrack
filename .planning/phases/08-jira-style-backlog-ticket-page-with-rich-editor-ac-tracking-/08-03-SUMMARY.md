---
phase: 08-jira-style-backlog-ticket-page-with-rich-editor-ac-tracking
plan: 03
subsystem: frontend
tags: [tiptap, rich-editor, react-query, hooks, types, api-client]
dependency_graph:
  requires: [08-01]
  provides: [RichTextEditor, useComments, useAttachments, useTaskHistory, Comment types, Attachment types, TaskHistoryEntry types]
  affects: [08-04-TaskDetailPage]
tech_stack:
  added: ["@tiptap/react", "@tiptap/starter-kit", "@tiptap/extension-placeholder"]
  patterns: [React Query hooks, Tiptap editor, multipart form-data upload]
key_files:
  created:
    - apps/web/src/components/tasks/RichTextEditor.tsx
    - apps/web/src/hooks/useComments.ts
    - apps/web/src/hooks/useAttachments.ts
    - apps/web/src/hooks/useTaskHistory.ts
  modified:
    - apps/web/src/lib/types.ts
    - apps/web/src/lib/api.ts
    - apps/web/package.json
decisions:
  - uploadAttachment uses raw fetch (not request helper) to allow browser to set multipart/form-data boundary automatically
  - initialContentRef prevents Tiptap content from resetting on React Query refetches
  - heading disabled in StarterKit per UI-SPEC (not exposed in toolbar for this phase)
metrics:
  duration: 9 minutes
  completed: 2026-04-06
  tasks_completed: 2
  files_modified: 7
---

# Phase 08 Plan 03: Frontend Types, API Client, RichTextEditor, and React Query Hooks Summary

Tiptap RichTextEditor with 5-button toolbar + blur auto-save, plus Comment/Attachment/TaskHistoryEntry types, API client methods, and React Query hooks wired to backend endpoints.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Frontend types + API client methods | b7c452e | types.ts, api.ts, package.json |
| 2 | RichTextEditor + React Query hooks | f751657 | RichTextEditor.tsx, useComments.ts, useAttachments.ts, useTaskHistory.ts |

## What Was Built

### Task 1: Frontend Types + API Client

**New types in `apps/web/src/lib/types.ts`:**
- `Comment` — id, content, taskId, authorId, parentId, author (Pick), replies (nested)
- `CreateCommentPayload` — content string
- `Attachment` — id, filename, storedName, mimeType, size, uploaderId, uploader (Pick)
- `TaskHistoryEntry` — id, taskId, actorId, field, oldValue, newValue, actor (Pick)

**New API methods in `apps/web/src/lib/api.ts`:**
- `getComments`, `createComment`, `createReply`, `deleteComment`
- `getAttachments`, `uploadAttachment` (raw fetch for multipart), `getAttachmentDownloadUrl`, `deleteAttachment`
- `getTaskHistory`

### Task 2: RichTextEditor Component

`apps/web/src/components/tasks/RichTextEditor.tsx`:
- Tiptap editor with StarterKit (heading disabled per UI-SPEC) and Placeholder extension
- 5-button toolbar: Bold, Italic, Bullet List, Numbered List, Code Block
- Ghost buttons with `bg-muted` active state, `aria-pressed` for accessibility
- `initialContentRef` prevents content reset on parent re-renders (React Query refetches)
- `onBlur` handler calls `onSave(editor.getHTML())` — blur auto-save pattern
- `editable` prop controls toolbar visibility and edit mode
- `TooltipProvider` wrapping via Radix UI tooltip component

### Task 2: React Query Hooks

- `useComments` — query with `['comments', projectId, taskId]` key
- `useCreateComment` — mutation, invalidates comments query on success
- `useCreateReply` — mutation for threaded replies, invalidates comments query
- `useDeleteComment` — mutation, invalidates comments query
- `useAttachments` — query with `['attachments', projectId, taskId]` key
- `useUploadAttachment` — mutation accepting `File`, invalidates attachments query
- `useDeleteAttachment` — mutation, invalidates attachments query
- `useTaskHistory` — query with `['task-history', projectId, taskId]` key

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all hooks and API methods are fully wired to backend endpoints defined in Plan 08-01.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced. Client-side 10 MB file size check deferred to Plan 04's AttachmentList component per threat model (T-08-12 mitigated by Plan 04).

## Self-Check: PASSED

- `apps/web/src/components/tasks/RichTextEditor.tsx` — FOUND
- `apps/web/src/hooks/useComments.ts` — FOUND
- `apps/web/src/hooks/useAttachments.ts` — FOUND
- `apps/web/src/hooks/useTaskHistory.ts` — FOUND
- Commit b7c452e — FOUND (Task 1)
- Commit f751657 — FOUND (Task 2)
- `pnpm --filter @pm/web exec tsc --noEmit` — exits 0
