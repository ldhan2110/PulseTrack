# Image Handling Improvements — Design Spec

**Date:** 2026-04-07
**Status:** Approved
**Scope:** Rich text editor inline images + attachment image preview

---

## Problem

When users paste images into description or comment fields, the editor converts them to base64 and embeds them directly in the HTML string saved to the database. A single high-resolution screenshot can exceed the 10 MB body size limit, causing saves to fail silently or with an error.

---

## Goals

1. Paste images seamlessly into descriptions and comments — no user friction
2. Images upload automatically in the background; only server URLs are persisted (no base64 in DB)
3. Users can resize inline images by dragging
4. Image attachments in the attachment list are previewable in a lightbox modal

---

## Out of Scope

- CDN or external object storage (images are served from the existing `/api/uploads/` path)
- Image compression or resizing on upload
- Drag-and-drop image insertion (paste only)

---

## Architecture

### Shared Hook: `useImageUpload`

A new hook extracted into `apps/web/src/hooks/useImageUpload.ts`. Used by both `RichTextEditor` and `CommentComposer` to avoid duplication.

**Responsibilities:**
- Accept `projectId` and `taskId` as inputs
- Expose a `handleImagePaste(file: File, editor: Editor): void` function
- Maintain a `pendingUploads` ref: `Map<string, Promise<string>>` keyed by base64 src, resolving to server URL
- Expose an `awaitPendingUploads(editor: Editor): Promise<void>` function that awaits all in-flight uploads and swaps base64 srcs to server URLs in the editor content
- On upload failure: remove the image node from editor content, show a toast error

**Upload target:** `POST /api/projects/:projectId/tasks/:taskId/attachments` (existing endpoint, no backend changes needed)

**Paste flow:**
1. Paste intercepted — image blob extracted from clipboard
2. `FileReader.readAsDataURL()` converts to base64 → inserted into editor immediately (instant visual feedback)
3. Upload fires in background via `useUploadAttachment` mutation
4. Upload resolves → editor content walked, base64 src replaced with server URL, promise removed from `pendingUploads`

**Save flow (blur):**
1. `awaitPendingUploads()` called before `getHTML()`
2. If uploads still in flight: show brief loading state on the save trigger
3. Once all resolved: `getHTML()` called — content contains only server URLs
4. Normal save proceeds

---

### Image Resizing: `tiptap-extension-resize-image`

Replaces the current `Image` extension (with `allowBase64: true`) in both `RichTextEditor` and `CommentComposer`.

- Package: `tiptap-extension-resize-image`
- Drag handles appear on corners/edges of selected images
- Width stored as `width` attribute on `<img>` tag (e.g., `width="400"`)
- Resize constrained to editor container width (no overflow)
- Read-only mode: handles hidden, images render at stored width
- `allowBase64: true` retained on the extension for the brief period between paste and upload swap

---

### Attachment Image Preview: `ImagePreviewModal`

A new component at `apps/web/src/components/tasks/ImagePreviewModal.tsx`.

**Detection:** `mimeType.startsWith('image/')` — checked per attachment item in `AttachmentList`.

**AttachmentList changes:**
- Image attachments render a thumbnail (`<img>` tag, max-height constrained via CSS, cursor pointer)
- Thumbnail (and a new "Preview" button) opens `ImagePreviewModal`
- Non-image attachments: no change to existing behavior

**ImagePreviewModal:**
- Built on shadcn `Dialog` (handles overlay, focus trap, Escape to close, click-outside to close)
- Dark overlay, image centered and scaled to viewport (`max-w-[90vw] max-h-[90vh] object-contain`)
- Filename shown below image
- Download button inside modal (reuses existing `downloadAttachment` API call)
- No external lightbox library

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Image upload fails during paste | Image removed from editor, toast: "Image upload failed — please try again" |
| User blurs before upload finishes | Save waits (brief loading state), then proceeds once resolved |
| Image fails to load in preview modal | Fallback: show filename + download button only |
| Attachment thumbnail fails to load | Fallback to file icon (existing behavior) |

---

## Files Changed

### New
- `apps/web/src/hooks/useImageUpload.ts` — shared image upload hook
- `apps/web/src/components/tasks/ImagePreviewModal.tsx` — lightbox modal component

### Modified
- `apps/web/src/components/tasks/RichTextEditor.tsx` — use `useImageUpload`, replace Image extension with resize extension
- `apps/web/src/components/tasks/CommentComposer.tsx` — use `useImageUpload`, replace Image extension with resize extension
- `apps/web/src/components/tasks/AttachmentList.tsx` — add thumbnail + preview button for image attachments

### Backend
- No backend changes required — existing attachment upload/download endpoints are used as-is

### Dependencies
- Add: `tiptap-extension-resize-image`

---

## Testing Criteria

1. Paste a large image (>2 MB) into description → saves successfully with server URL in HTML
2. Paste image, immediately blur → save waits for upload, then succeeds
3. Paste image, upload fails (simulate) → image removed, toast shown, save proceeds
4. Resize image inline by dragging → width persisted, renders correctly on reload
5. Upload an image as attachment → thumbnail shown in attachment list
6. Click thumbnail → lightbox opens with full image + download button
7. Non-image attachment → no thumbnail, no preview button
8. Press Escape or click overlay in lightbox → modal closes
