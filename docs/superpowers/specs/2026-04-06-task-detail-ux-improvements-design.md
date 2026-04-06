# Task Detail UX Improvements

**Date:** 2026-04-06
**Scope:** Task detail page layout restructure, description read/edit mode, rich comments, clipboard image paste, stale data fix

## Problem

The task detail page has several UX issues:
- Attachments are positioned after Comments instead of near the task content
- Comments and Activity are stacked with no visual separation from task content
- Task description is always in edit mode (TipTap), not readable as rendered HTML
- Comments use a plain textarea with no formatting support
- Updating task status/data doesn't refresh the detail view (stale data bug)

## Design

### 1. Two-Card Layout

The left panel splits into two visually distinct bordered cards:

**Card 1 — Task Content:**
- Description (read mode by default)
- Acceptance Criteria
- Attachments (moved here from below Comments)

**Card 2 — Discussion:**
- Tabbed interface with two tabs: **Comments** | **Activity**
- Comments tab shows the comment thread + rich composer
- Activity tab shows the change history timeline
- Only one tab visible at a time

Both cards use `border rounded-lg p-5` styling to create clear visual zones.

### 2. Description: Read Mode with Double-Click to Edit

**Current behavior:** TipTap editor is always active with toolbar visible. Auto-saves on blur.

**New behavior:**
- **Read mode (default):** Renders the stored HTML as formatted content inside a styled container. Shows a subtle "double-click to edit" hint on hover (for users with edit permission). Uses TipTap's `EditorContent` in read-only mode (or raw `dangerouslySetInnerHTML` with prose styling).
- **Edit mode (on double-click):** Shows the TipTap editor with toolbar, pre-populated with current content. Triggered by double-clicking the description area.
- **Save & exit:** Clicking outside the editor (blur) or pressing Escape saves the content and returns to read mode. Same auto-save pattern as current, but now toggles back to read mode.
- **Empty state:** When no description exists, show placeholder text "Add a description..." that enters edit mode on click (single click, since there's nothing to "read").

Implementation approach: Add `editingDescription` state to `TaskDetailPage`. The `RichTextEditor` component gets a new `readOnly` rendering path that shows formatted HTML. Double-click handler on the read-only view toggles to edit mode.

### 3. Rich Text Comments

**Current behavior:** `CommentComposer` uses a plain `<Textarea>` for input. Comments display as plain text.

**New behavior:**
- `CommentComposer` uses TipTap with the same toolbar as description (Bold, Italic, Bullet List, Numbered List, Code Block)
- Comment content is stored as HTML (not plain text)
- `CommentItem` renders comment content as HTML using `dangerouslySetInnerHTML` with prose styling (or a read-only TipTap instance)
- The rich editor appears in the composer area at the bottom of the Comments tab

**Backend consideration:** The `content` field on comments already stores strings. HTML strings are compatible — no schema change needed. Existing plain-text comments will render fine (they'll just appear as unstyled paragraphs).

### 4. Clipboard Image Paste (Base64)

Both the description editor and comment composer support pasting images from clipboard.

**Implementation:**
- Add TipTap `Image` extension to the editor configuration
- Add a custom paste handler that intercepts `clipboardData.items` for image types
- Convert pasted images to base64 data URIs using `FileReader.readAsDataURL()`
- Insert as `<img src="data:image/png;base64,..." />` into the editor content
- No server upload — images are stored inline in the HTML content

**TipTap extensions needed:**
- `@tiptap/extension-image` — for image node support in the editor

**Trade-offs:**
- Simpler implementation, no API changes needed
- Increases stored content size (base64 is ~33% larger than binary)
- Acceptable for a POC; can migrate to server-side storage later if needed

### 5. Stale Data Bug Fix

**Root cause:** `useUpdateTask` in `useTasks.ts` performs optimistic updates on `['tasks', projectId]` (the task list) and invalidates that same key on settle. However, it does NOT invalidate:
- `['task', projectId, taskId]` — the single task detail query used by `TaskDetailPage`
- `['task-history', projectId, taskId]` — the activity log query

So after updating status, assignee, etc., the detail page shows stale data until a full page refresh.

**Fix:** In `useUpdateTask`'s `onSettled` callback, also invalidate:
```typescript
void queryClient.invalidateQueries({ queryKey: ['task', projectId] });
void queryClient.invalidateQueries({ queryKey: ['task-history', projectId] });
```

Using prefix matching (`['task', projectId]`) invalidates both the list and any detail queries for that project. Same for task history.

Also apply the same fix to `useUpdateTaskStatus` which has the identical issue.

### 6. Attachments Reorder

Move the `<AttachmentList>` section from position 4 (after Comments) to position 3 (after Acceptance Criteria), inside Card 1.

No functional changes — purely a position swap in the JSX.

## Files to Modify

| File | Changes |
|------|---------|
| `apps/web/src/pages/TaskDetailPage.tsx` | Two-card layout, reorder sections, add description read/edit toggle, tab state for Comments/Activity |
| `apps/web/src/components/tasks/RichTextEditor.tsx` | Add read-only rendered view, double-click handler, Image extension, clipboard paste handler |
| `apps/web/src/components/tasks/CommentComposer.tsx` | Replace Textarea with TipTap editor, add toolbar, support image paste |
| `apps/web/src/components/tasks/CommentItem.tsx` | Render comment content as HTML instead of plain text |
| `apps/web/src/hooks/useTasks.ts` | Fix cache invalidation in `useUpdateTask` and `useUpdateTaskStatus` |

## New Dependencies

| Package | Purpose |
|---------|---------|
| `@tiptap/extension-image` | Image node support for clipboard paste in TipTap |

## Out of Scope

- Server-side image storage (using base64 inline for now)
- Image resizing/compression on paste
- Drag-and-drop image upload into editors
- Comment editing (only creation exists currently)
- Markdown source editing toggle
