---
phase: 08-jira-style-backlog-ticket-page-with-rich-editor-ac-tracking
verified: 2026-04-06T06:58:11Z
status: human_needed
score: 10/10 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 6/10
  gaps_closed:
    - "Attachment and TaskHistory models exist in schema.prisma"
    - "TasksService.update() creates TaskHistory entries for tracked field changes"
    - "GET /projects/:projectId/tasks/:taskId/history returns task history entries"
    - "uploads/ directory is created on API startup and gitignored"
    - "@types/multer is installed in the API (package.json devDependencies)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Verify activity log populates after task field change"
    expected: "After changing task status in the sidebar, the Activity Log section shows a new entry with actor name, field label (e.g. 'moved to In Progress'), and relative timestamp"
    why_human: "Requires running both API and web dev servers with a real database, then triggering a task update to confirm the history endpoint returns data and the frontend renders it correctly"

  - test: "Verify file attachment upload and download end-to-end"
    expected: "User can upload a file under 10 MB via the Attachments section, file appears in the list with filename/size/uploader, clicking download retrieves the file with its original filename"
    why_human: "Requires running servers with filesystem access; multipart upload and file serving cannot be tested programmatically"

  - test: "Verify comment thread reply and delete"
    expected: "User can post a comment, reply to it (reply appears indented with pl-8), and delete a comment (AlertDialog confirmation appears, then comment and its replies are removed)"
    why_human: "Interactive DOM state management cannot be verified programmatically"

  - test: "Verify Tiptap editor toolbar and blur auto-save"
    expected: "Clicking description area activates Tiptap editor with 5-button toolbar (Bold, Italic, Bullet List, Numbered List, Code Block); clicking outside triggers auto-save; Saving indicator appears briefly; content persists after page refresh"
    why_human: "Rich text editor DOM interaction and auto-save round-trip require a running browser"
---

# Phase 8: Jira-style Ticket Page Verification Report

**Phase Goal:** Upgrade the TaskDetailPage into a full Jira-style two-panel ticket view with Tiptap rich editor, threaded comments (backend + frontend), file attachments, polished AC tracking with inline editing, and a task history/activity log
**Verified:** 2026-04-06T06:58:11Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (commits ae4c71d and e05ea60 restored merge regression)

## Re-verification Summary

The 5 gaps identified in the previous verification (all caused by merge commit `9ffeff1` reverting Plan 08-01 backend changes) have been fully resolved:

| Gap | Previous Status | Current Status |
|-----|-----------------|----------------|
| schema.prisma missing Attachment + TaskHistory models | FAILED | VERIFIED |
| tasks.service.ts reverted to 2-arg update(), no history recording | FAILED | VERIFIED |
| tasks.controller.ts missing history endpoint + actorId | FAILED | FAILED → VERIFIED |
| main.ts missing mkdirSync + .gitignore missing uploads/ | FAILED | VERIFIED |
| @types/multer missing from package.json | FAILED (partial) | VERIFIED |

No regressions introduced in the restoration commits.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Attachment and TaskHistory models exist in schema.prisma | VERIFIED | schema.prisma lines 301 (model Attachment) and 319 (model TaskHistory) with all back-relations |
| 2 | Tiptap packages are installed in the web app | VERIFIED | apps/web/package.json lines 23-26: @tiptap/extension-placeholder, @tiptap/pm, @tiptap/react, @tiptap/starter-kit ^3.22.2 |
| 3 | @types/multer is installed in the API | VERIFIED | apps/api/package.json devDependencies: "@types/multer": "^2.1.0" |
| 4 | TasksService.update() creates TaskHistory entries for tracked field changes | VERIFIED | tasks.service.ts line 60: 3-arg signature with actorId; line 65: trackedFields; line 77: $transaction; line 96: taskHistory.create |
| 5 | GET /projects/:projectId/tasks/:taskId/history returns task history entries | VERIFIED | tasks.controller.ts line 40: @Get(':taskId/history') placed above @Get(':taskId'); line 42: calls tasksService.getHistory(taskId) |
| 6 | uploads/ directory is created on API startup and gitignored | VERIFIED | main.ts line 4: `import { mkdirSync } from 'fs'`; line 42: mkdirSync call; .gitignore contains `uploads/` |
| 7 | CommentsModule: CRUD endpoints with threading registered in AppModule | VERIFIED | apps/api/src/comments/ has all 5 files; app.module.ts lines 15, 31: CommentsModule imported and registered |
| 8 | AttachmentsModule: upload/download/delete endpoints registered in AppModule | VERIFIED | apps/api/src/attachments/ has all 4 files; app.module.ts lines 16, 32: AttachmentsModule imported and registered |
| 9 | RichTextEditor component renders Tiptap with 5-button toolbar and blur auto-save | VERIFIED | RichTextEditor.tsx: useEditor (line 106), StarterKit, Placeholder, toggleBold (line 56), toggleCodeBlock (line 86), onBlur: handleBlur, aria-pressed (line 39), initialContentRef (line 97) |
| 10 | TaskDetailPage renders two-panel layout with all 5 left sections and sticky sidebar | VERIFIED | TaskDetailPage.tsx (867 lines): imports RichTextEditor, CommentThread, AttachmentList, ActivityLog; contains sticky top-8 (line 482), w-60, flex-1, gap-8, parseAcceptanceCriteria, AC badge "{acChecked}/{acTotal} done" (line 381), AlertDialog, Skeleton |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/prisma/schema.prisma` | Attachment and TaskHistory models with relations | VERIFIED | model Attachment (line 301), model TaskHistory (line 319), Task.attachments/history back-relations (lines 169-170), User.uploadedAttachments/taskHistories (lines 96-97) |
| `apps/api/src/tasks/tasks.service.ts` | History recording on update, getHistory method | VERIFIED | 3-arg update() with trackedFields, $transaction, taskHistory.create; getHistory() at line 102 |
| `apps/api/src/tasks/tasks.controller.ts` | GET history endpoint, actorId passed to update | VERIFIED | @Get(':taskId/history') at line 40 above @Get(':taskId'); PATCH at line 50 passes req.user.id |
| `apps/api/src/tasks/tasks.service.spec.ts` | Vitest test stubs | VERIFIED | Contains describe('TasksService') with history recording tests |
| `apps/api/src/comments/comments.module.ts` | CommentsModule NestJS module | VERIFIED | Contains @Module |
| `apps/api/src/comments/comments.service.ts` | Comment CRUD with threading | VERIFIED | findAll, create, createReply, delete with deleteMany for replies, ForbiddenException |
| `apps/api/src/attachments/attachments.module.ts` | AttachmentsModule NestJS module | VERIFIED | Contains @Module |
| `apps/api/src/attachments/attachments.service.ts` | Attachment upload, list, delete, download | VERIFIED | create, findOne, delete with unlinkSync (line 3), ForbiddenException |
| `apps/web/src/components/tasks/RichTextEditor.tsx` | Tiptap editor with toolbar | VERIFIED | useEditor, StarterKit, Placeholder, toggleBold, toggleCodeBlock, onBlur, initialContentRef, aria-pressed |
| `apps/web/src/hooks/useComments.ts` | Comment CRUD hooks | VERIFIED | useCreateComment (line 13), useCreateReply (line 27), useDeleteComment (line 41) |
| `apps/web/src/hooks/useAttachments.ts` | Attachment upload/delete hooks | VERIFIED | useUploadAttachment (line 13), useDeleteAttachment (line 26) |
| `apps/web/src/hooks/useTaskHistory.ts` | Task history query hook | VERIFIED | useTaskHistory (line 4) calls api.getTaskHistory |
| `apps/web/src/lib/types.ts` | Comment, Attachment, TaskHistoryEntry interfaces | VERIFIED | interface Comment (line 269), interface Attachment (line 287), interface TaskHistoryEntry (line 301) |
| `apps/web/src/pages/TaskDetailPage.tsx` | Full two-panel ticket page (min 200 lines) | VERIFIED | 867 lines; imports all components; 2-panel layout with sticky sidebar |
| `apps/web/src/components/tasks/CommentThread.tsx` | Comment list with reply forms | VERIFIED | Uses useComments, useCreateComment, useCreateReply, useDeleteComment |
| `apps/web/src/components/tasks/CommentItem.tsx` | Single comment with reply/delete | VERIFIED | AlertDialog, formatDistanceToNow, Trash2, Reply; isReply flag prevents nested replies |
| `apps/web/src/components/tasks/CommentComposer.tsx` | Plain text comment input | VERIFIED | "Post Comment" button, isPending, onCancel prop |
| `apps/web/src/components/tasks/AttachmentList.tsx` | File list with upload/download/delete | VERIFIED | 10_485_760 (line 159), getAttachmentDownloadUrl (line 66), AlertDialog |
| `apps/web/src/components/tasks/ActivityLog.tsx` | History timeline container | VERIFIED | useTaskHistory (line 13), [...history].reverse() (line 16) |
| `apps/web/src/components/tasks/ActivityEntry.tsx` | Single history entry | VERIFIED | "moved to" (line 32), "assigned to" (line 38), formatDistanceToNow (line 69) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| tasks.service.ts | prisma.taskHistory.create | $transaction in update() | WIRED | Line 96: taskHistory.create inside $transaction at line 77 |
| tasks.controller.ts | tasks.service.ts getHistory | @Get(':taskId/history') endpoint | WIRED | Line 40-43: endpoint calls tasksService.getHistory(taskId) |
| comments.service.ts | prisma.comment.* | Prisma queries | WIRED | Lines 9, 25, 36, 40, 49, 58, 59 all query prisma.comment |
| attachments.controller.ts | FileInterceptor | Multer disk storage | WIRED | FileInterceptor (line 5), randomUUID (line 7), fileSize limit (line 41) |
| app.module.ts | CommentsModule, AttachmentsModule | imports array | WIRED | Lines 31-32 in AppModule.imports |
| TaskDetailPage.tsx | RichTextEditor | import + render in left panel | WIRED | Imported line 32, rendered with onSave handler |
| TaskDetailPage.tsx | useComments, useAttachments, useTaskHistory | via child components | WIRED | CommentThread uses useComments; AttachmentList uses useAttachments; ActivityLog uses useTaskHistory |
| CommentThread.tsx | CommentItem, CommentComposer | child component composition | WIRED | Both imported and rendered |
| useComments.ts | api.getComments, api.createComment, etc. | api.* calls | WIRED | All 4 comment API methods called from hooks |
| ActivityLog.tsx | useTaskHistory → GET /tasks/:id/history | backend endpoint | WIRED | Endpoint restored in tasks.controller.ts; service queries prisma.taskHistory |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| ActivityLog.tsx | history (from useTaskHistory) | GET /projects/:projectId/tasks/:taskId/history | Yes — tasks.controller.ts endpoint calls tasksService.getHistory() which queries prisma.taskHistory.findMany() | FLOWING |
| CommentThread.tsx | comments (from useComments) | GET /projects/:projectId/tasks/:taskId/comments | Yes — CommentsModule endpoint queries prisma.comment.findMany() with replies | FLOWING |
| AttachmentList.tsx | attachments (from useAttachments) | GET /projects/:projectId/tasks/:taskId/attachments | Yes — AttachmentsModule endpoint queries prisma.attachment.findMany() | FLOWING |
| TaskDetailPage.tsx | task (from useTask) | GET /projects/:projectId/tasks/:taskId | Yes — existing tasks endpoint with full task data | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — requires running dev servers to test API responses and browser rendering.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| COLB-01 | 08-01, 08-02, 08-03, 08-04 | User can add threaded comments on tasks | SATISFIED | CommentsModule with POST/GET/DELETE endpoints; CommentThread frontend component; all hooks wired to API |
| COLB-02 | 08-01, 08-02, 08-03, 08-04 | BA and developer can communicate via comment threads | SATISFIED | Same as COLB-01 — threaded reply support via parentId self-relation; CommentsController with reply route |
| REQ-AC | 08-04 | Polished AC tracking with inline editing | SATISFIED | TaskDetailPage contains parseAcceptanceCriteria, "{acChecked}/{acTotal} done" Badge, inline add/edit/delete |
| REQ-RTE | 08-03, 08-04 | Tiptap rich text editor | SATISFIED | RichTextEditor.tsx fully implemented with 5-button toolbar, blur auto-save, placeholder; wired into TaskDetailPage |
| REQ-ATTACH | 08-01, 08-02, 08-03, 08-04 | File attachments | SATISFIED | Attachment model in schema; AttachmentsModule with Multer upload/download/delete; @types/multer in package.json; AttachmentList frontend component with 10 MB gate |
| REQ-HIST | 08-01, 08-03, 08-04 | Task history/activity log | SATISFIED | TaskHistory model in schema; history recording in TasksService.$transaction; GET history endpoint; ActivityLog + ActivityEntry frontend components with data flowing |

**Note on requirement IDs:** REQ-AC, REQ-RTE, REQ-ATTACH, REQ-HIST are shorthand IDs used in ROADMAP.md for Phase 8 — they are not entries in REQUIREMENTS.md. COLB-01 and COLB-02 are formal requirements in REQUIREMENTS.md; the traceability table maps them to Phase 3 (Pending) but the implementation was delivered in Phase 8.

### Anti-Patterns Found

No blockers or warnings detected in the restored files. No TODO/FIXME/placeholder comments found in tasks.service.ts, tasks.controller.ts, schema.prisma, or main.ts. All implementations are substantive with real Prisma queries and business logic.

### Human Verification Required

#### 1. Activity Log End-to-End

**Test:** Start API and web dev servers. Open a task detail page. Change the task status via the sidebar Select dropdown.
**Expected:** A new entry appears in the Activity Log section showing "{actor name} moved to {new status label}" with a relative timestamp (e.g. "just now").
**Why human:** Requires running servers with database access. Automated grep confirms the endpoint and data pipeline exist, but cannot verify the history is actually written to DB and rendered correctly in the browser.

#### 2. File Attachment Upload and Download

**Test:** Open a task detail page. Click "Attach file" in the Attachments section. Select a file under 10 MB. Observe the list.
**Expected:** File appears immediately in the list with filename, formatted size, uploader name, and relative date. Clicking the download icon retrieves the file with its original filename via Content-Disposition header.
**Why human:** Requires running servers with filesystem access. Multipart form-data upload and file serving cannot be tested without starting the NestJS server.

#### 3. Comment Thread Reply and Delete

**Test:** Post a comment in the Comments section. Click "Reply" on the comment. Post a reply. Click delete on the parent comment, confirm in the AlertDialog.
**Expected:** Reply appears indented (pl-8) below the parent. Deleting the parent removes both the parent comment and its replies from the list. AlertDialog shows "Delete Comment" title with correct body text.
**Why human:** Stateful DOM interaction and server roundtrip confirmation require a running application.

#### 4. Tiptap Editor Toolbar and Blur Auto-Save

**Test:** Click the description area of a task. Apply bold formatting and create a bullet list. Click outside the editor. Refresh the page.
**Expected:** Toolbar shows active state on formatting buttons. Clicking outside triggers save (Saving... indicator appears briefly). After page refresh, the formatted content is preserved.
**Why human:** Rich text editor DOM interaction, toolbar state changes, and auto-save round-trip require a running browser with Tiptap rendered.

### Gaps Summary

No gaps remain. All 10 must-have truths are verified, all artifacts are substantive and wired, and all data flows are confirmed. The phase goal is achieved at the automated verification level.

Automated checks passed. Awaiting human verification of 4 interactive end-to-end flows.

---

_Verified: 2026-04-06T06:58:11Z_
_Verifier: Claude (gsd-verifier)_
