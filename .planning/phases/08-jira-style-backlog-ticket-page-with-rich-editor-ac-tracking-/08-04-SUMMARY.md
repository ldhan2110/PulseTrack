---
phase: 08-jira-style-backlog-ticket-page-with-rich-editor-ac-tracking
plan: 04
subsystem: frontend/task-detail
tags: [ui, comments, attachments, activity-log, rich-editor, two-panel-layout]
dependency_graph:
  requires: [08-02, 08-03]
  provides: [TaskDetailPage, CommentThread, CommentItem, CommentComposer, AttachmentList, ActivityLog, ActivityEntry]
  affects: [apps/web/src/pages/TaskDetailPage.tsx]
tech_stack:
  added: []
  patterns:
    - two-panel sticky sidebar layout (flex-1 + w-60 sticky top-8)
    - CommentThread with inline reply composer pattern
    - client-side file size gate before upload mutation
    - reversed history array for chronological display
key_files:
  created:
    - apps/web/src/components/tasks/CommentComposer.tsx
    - apps/web/src/components/tasks/CommentItem.tsx
    - apps/web/src/components/tasks/CommentThread.tsx
    - apps/web/src/components/tasks/AttachmentList.tsx
    - apps/web/src/components/tasks/ActivityEntry.tsx
    - apps/web/src/components/tasks/ActivityLog.tsx
  modified:
    - apps/web/src/pages/TaskDetailPage.tsx
decisions:
  - "currentUserId sourced from useAuth().user.id (DB id from /api/users/me) — not keycloak sub — for correct match against comment.authorId and attachment.uploaderId"
  - "SubTaskMiniRow used in sidebar instead of full table — sidebar width (w-60) cannot accommodate a multi-column table"
  - "Pre-existing build errors in AddMemberDialog.tsx and BugsPage.tsx deferred — out of scope, verified pre-existing before plan started"
metrics:
  duration: 4 minutes
  completed: 2026-04-06
  tasks_completed: 3
  files_created: 6
  files_modified: 1
---

# Phase 08 Plan 04: Jira-style Ticket Page — UI Components + Full Page Assembly Summary

Complete two-panel Jira-style ticket page with Tiptap rich editor, threaded comments, file attachments (10 MB limit), AC checklist with completion badge, and read-only activity timeline — all wired to their Plan 02/03 backend hooks.

## What Was Built

### Task 1: 6 New UI Components

**CommentComposer** (`apps/web/src/components/tasks/CommentComposer.tsx`)
- Plain Textarea (rows=2, resize-none) + "Post Comment" primary button
- Optional Cancel button for inline reply mode
- Disabled when empty or pending; clears on submit

**CommentItem** (`apps/web/src/components/tasks/CommentItem.tsx`)
- Avatar (size-6) + author name + relative timestamp (date-fns formatDistanceToNow)
- Reply button (hidden if `isReply=true` — no nested replies beyond one level)
- Delete button (Trash2) with AlertDialog confirmation — visible only to comment author or PM
- Hover-reveal action buttons via `group/comment` pattern

**CommentThread** (`apps/web/src/components/tasks/CommentThread.tsx`)
- Uses `useComments`, `useCreateComment`, `useCreateReply`, `useDeleteComment` hooks
- Top-level comments filtered by `parentId === null`; replies from `comment.replies`
- Inline reply composer per comment (pl-8 indent) + persistent top-level composer at bottom
- `replyingTo: string | null` state toggles inline composers
- Empty state: "No comments yet. Start the conversation."

**AttachmentList** (`apps/web/src/components/tasks/AttachmentList.tsx`)
- Upload via hidden `<input type="file">` ref triggered by Attach file button
- Client-side 10 MB gate: `file.size > 10_485_760` → `toast.error('File is too large. Maximum size is 10 MB.')`
- File icon selection by mimeType prefix (FileText/ImageIcon/File)
- Each row: icon + filename (truncate max-w-[240px]) + size + uploader avatar + relative date + download link + delete with AlertDialog
- `api.getAttachmentDownloadUrl(projectId, taskId, attachmentId)` for download href

**ActivityEntry** (`apps/web/src/components/tasks/ActivityEntry.tsx`)
- Field-change text templates: status → "moved to {label}", assigneeId → "assigned to {username}", sprintId → "moved to sprint {name}", storyPoints → "set story points to {n}", title → "renamed to {n}"
- Member/sprint lookup from props arrays for human-readable names

**ActivityLog** (`apps/web/src/components/tasks/ActivityLog.tsx`)
- Uses `useTaskHistory(projectId, taskId)`
- `[...history].reverse()` for chronological ascending display
- Vertical timeline with `border-l border-border ml-3` connector line
- Error/empty states per UI-SPEC

### Task 2: TaskDetailPage Full Replacement

Complete rewrite of `apps/web/src/pages/TaskDetailPage.tsx`:

**Two-panel layout:**
- Left panel: `flex-1 flex flex-col gap-6` with 5 sections (Description, AC, Comments, Attachments, Activity)
- Right sidebar: `w-60 shrink-0` with `sticky top-8` inner div
- `gap-8` between panels

**Left panel sections:**
1. Description — RichTextEditor with `onSave={(html) => updateTask.mutate(...)}` + Saving indicator
2. Acceptance Criteria — `X/Y done` Badge (secondary variant), inline add/edit/delete, empty state
3. Comments — `<CommentThread>` component
4. Attachments — `<AttachmentList>` component
5. Activity — `<ActivityLog members={members} sprints={sprints}>`

**Right sidebar:**
- Status/Assignee/Sprint/Story Points selects (disabled when !canEdit)
- SubTaskMiniRow compact list (status badge + title + delete) instead of full table
- Meta: Created by, Created date, Updated date, Sprint name
- Delete Task AlertDialog (canManage only)

**Auth integration:** `useAuth().user.id` passed as `currentUserId` to CommentThread and AttachmentList — this is the DB user ID that matches `comment.authorId` and `attachment.uploaderId`.

### Task 3: Checkpoint (Auto-approved)

Auto-approved in auto-chain mode. TypeScript check (`tsc --noEmit`) passes clean.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Out-of-Scope Items Deferred

**Pre-existing build errors** (existed before this plan, verified via git stash):
1. `AddMemberDialog.tsx:155` — `Property 'name' does not exist on type 'UserSearchResult'`
2. `BugsPage.tsx:26` — Role comparison uses uppercase strings vs lowercase `ProjectRole` type

Logged in `deferred-items.md`.

### Design Adjustments

**SubTaskMiniRow instead of full sub-task table in sidebar:** The sidebar is `w-60` (240px). A full multi-column table (Title, Status, Assignee, Delete) cannot fit at this width. A compact mini-row showing StatusBadge + title + delete icon was used instead. This matches the UI-SPEC sidebar layout diagram more accurately than the full table pattern from the old page.

## Known Stubs

None. All sections are wired to real hooks and API calls.

## Threat Surface Scan

No new network endpoints introduced. All API calls use existing endpoints from Plan 02.

Security mitigations from threat model implemented:
- **T-08-14**: Delete buttons hidden unless `comment.authorId === currentUserId || canManage` (server-side is the real gate per Plan 02)
- **T-08-15**: `file.size > 10_485_760` check before upload mutation fires

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 658e364 | feat(08-04): build 6 UI components — CommentThread, CommentItem, CommentComposer, AttachmentList, ActivityLog, ActivityEntry |
| 2 | d4f7ae4 | feat(08-04): replace TaskDetailPage with two-panel Jira-style layout |

## Self-Check: PASSED

All 7 files exist on disk. Both commits (658e364, d4f7ae4) confirmed in git log.

Acceptance criteria verified:
- CommentThread.tsx contains `useComments` ✓
- CommentItem.tsx contains `AlertDialog` ✓
- CommentItem.tsx contains `formatDistanceToNow` ✓
- AttachmentList.tsx contains `10_485_760` ✓
- AttachmentList.tsx contains `getAttachmentDownloadUrl` ✓
- ActivityLog.tsx contains `useTaskHistory` ✓
- ActivityLog.tsx contains `.reverse()` ✓
- ActivityEntry.tsx contains `moved to` ✓
- ActivityEntry.tsx contains `assigned to` ✓
- TaskDetailPage.tsx contains all required patterns (RichTextEditor, CommentThread, AttachmentList, ActivityLog, sticky top-8, w-60, flex-1, gap-8, parseAcceptanceCriteria, AlertDialog, Skeleton) ✓
- `pnpm --filter @pm/web exec tsc --noEmit` exits 0 ✓
