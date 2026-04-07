# Image Handling Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace base64 image embedding in rich text editors with background upload + server URL, add inline image resizing, and add image preview in the attachment list.

**Architecture:** When a user pastes an image, it appears immediately as base64 in the editor while a background upload fires to the existing attachment endpoint. On save (blur/submit), any pending uploads are awaited and base64 srcs are atomically swapped to static server URLs before `getHTML()` is called. A shared `useImageUpload` hook handles this logic for both `RichTextEditor` and `CommentComposer`. A custom Tiptap NodeView (`ResizableImage` extension) replaces the built-in `Image` extension and adds drag-to-resize handles. Image attachments in `AttachmentList` gain thumbnails and a lightbox modal using shadcn `Dialog`.

**Tech Stack:** React 19, Tiptap v3 (`@tiptap/react`), Vitest + jsdom + Testing Library, shadcn Dialog, Tailwind CSS, existing attachment REST API

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/components/editor/ResizableImage.tsx` | Tiptap NodeView extension with drag-to-resize handles |
| Create | `src/hooks/useImageUpload.ts` | Background upload logic, pending upload tracking, base64→URL swap |
| Create | `src/hooks/useImageUpload.test.ts` | Unit tests for the upload hook |
| Create | `src/components/tasks/ImagePreviewModal.tsx` | Lightbox modal for attachment image preview |
| Create | `src/components/tasks/ImagePreviewModal.test.tsx` | Unit tests for the modal |
| Modify | `src/components/tasks/RichTextEditor.tsx` | Replace Image extension with ResizableImage, use useImageUpload |
| Modify | `src/components/tasks/CommentComposer.tsx` | Replace Image extension with ResizableImage, use useImageUpload |
| Modify | `src/components/tasks/CommentThread.tsx` | Forward projectId/taskId to CommentComposer and CommentItem |
| Modify | `src/components/tasks/CommentItem.tsx` | Add projectId/taskId props; fix broken RichTextEditor usage (wrong props) |
| Modify | `src/components/tasks/AttachmentList.tsx` | Add thumbnails and Preview button for image attachments |
| Create | `src/components/tasks/AttachmentList.test.tsx` | Unit tests for thumbnail/preview behavior |

---

## Task 1: Create the ResizableImage Tiptap extension

**Files:**
- Create: `apps/web/src/components/editor/ResizableImage.tsx`

- [ ] **Step 1: Create the file**

```tsx
// apps/web/src/components/editor/ResizableImage.tsx
import { useRef, useCallback } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';

function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startX.current = e.clientX;
      startWidth.current = imageRef.current?.offsetWidth ?? 300;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX.current;
        const newWidth = Math.max(50, startWidth.current + delta);
        if (imageRef.current) {
          imageRef.current.style.width = `${newWidth}px`;
        }
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        const delta = upEvent.clientX - startX.current;
        const newWidth = Math.max(50, startWidth.current + delta);
        updateAttributes({ width: newWidth });
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [updateAttributes],
  );

  return (
    <NodeViewWrapper className="inline-block relative group/img my-2">
      <img
        ref={imageRef}
        src={node.attrs.src as string}
        alt={(node.attrs.alt as string) ?? ''}
        title={(node.attrs.title as string) ?? undefined}
        style={{ width: node.attrs.width ? `${node.attrs.width as number}px` : undefined }}
        className={`max-w-full rounded-md block ${selected ? 'ring-2 ring-primary' : ''}`}
        draggable={false}
      />
      <div
        className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-8 bg-primary/60 rounded-sm cursor-col-resize opacity-0 group-hover/img:opacity-100 transition-opacity"
        onMouseDown={handleMouseDown}
        aria-label="Resize image"
      />
    </NodeViewWrapper>
  );
}

export const ResizableImage = Node.create({
  name: 'image',
  group: 'inline',
  inline: true,
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'img[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors related to the new file.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/editor/ResizableImage.tsx
git commit -m "feat: add ResizableImage Tiptap NodeView extension"
```

---

## Task 2: Create `useImageUpload` hook

**Files:**
- Create: `apps/web/src/hooks/useImageUpload.ts`
- Create: `apps/web/src/hooks/useImageUpload.test.ts`

**Key design:**
- Images are served from the static path: `/api/uploads/tasks/${taskId}/${storedName}` (no auth headers needed for `<img src>`, served directly by NestJS `useStaticAssets`)
- The `pendingUploads` Map is keyed by base64 src string and stores the in-flight upload Promise
- `swapSrcInEditor` uses a ProseMirror transaction to surgically update only the matching image node

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/hooks/useImageUpload.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImageUpload } from './useImageUpload';
import * as apiModule from '@/lib/api';
import type { Attachment } from '@/lib/types';

// Minimal editor mock
function makeEditorMock(imageSrc: string) {
  const dispatchedTrs: unknown[] = [];
  const nodes: Array<{ type: { name: string }; attrs: Record<string, unknown>; nodeSize: number }> = [
    { type: { name: 'image' }, attrs: { src: imageSrc, alt: null, width: null }, nodeSize: 1 },
  ];
  const mockTr = {
    setNodeMarkup: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };
  return {
    view: {
      state: {
        tr: mockTr,
        doc: {
          descendants: (fn: (node: unknown, pos: number) => boolean | void) => {
            for (const node of nodes) {
              fn(node, 0);
            }
          },
        },
      },
      dispatch: vi.fn((tr: unknown) => { dispatchedTrs.push(tr); }),
    },
    chain: () => ({ focus: () => ({ setImage: () => ({ run: vi.fn() }) }) }),
    dispatchedTrs,
    mockTr,
    nodes,
  };
}

const mockAttachment: Attachment = {
  id: 'att-1',
  filename: 'screenshot.png',
  storedName: 'uuid-123.png',
  mimeType: 'image/png',
  size: 50000,
  taskId: 'task-1',
  uploaderId: 'user-1',
  createdAt: '2026-04-07T00:00:00Z',
  uploader: { id: 'user-1', username: 'alice', email: 'alice@test.com' },
};

describe('useImageUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads file and swaps base64 src to static server URL on success', async () => {
    vi.spyOn(apiModule.api, 'uploadAttachment').mockResolvedValue(mockAttachment);
    const editor = makeEditorMock('data:image/png;base64,abc123');

    const { result } = renderHook(() =>
      useImageUpload({ projectId: 'proj-1', taskId: 'task-1' }),
    );

    const file = new File(['data'], 'screenshot.png', { type: 'image/png' });

    await act(async () => {
      result.current.handleImagePaste(file, editor as never, 'data:image/png;base64,abc123');
      await result.current.awaitPendingUploads();
    });

    expect(apiModule.api.uploadAttachment).toHaveBeenCalledWith('proj-1', 'task-1', file);
    // setNodeMarkup called to swap src → static URL
    expect(editor.mockTr.setNodeMarkup).toHaveBeenCalledWith(
      0,
      undefined,
      expect.objectContaining({ src: '/api/uploads/tasks/task-1/uuid-123.png' }),
    );
  });

  it('removes image and no pending upload remains when upload fails', async () => {
    vi.spyOn(apiModule.api, 'uploadAttachment').mockRejectedValue(new Error('Network error'));
    const editor = makeEditorMock('data:image/png;base64,abc123');

    const { result } = renderHook(() =>
      useImageUpload({ projectId: 'proj-1', taskId: 'task-1' }),
    );

    const file = new File(['data'], 'screenshot.png', { type: 'image/png' });

    await act(async () => {
      result.current.handleImagePaste(file, editor as never, 'data:image/png;base64,abc123');
      await result.current.awaitPendingUploads();
    });

    // delete transaction dispatched for failed image
    expect(editor.mockTr.delete).toHaveBeenCalledWith(0, 1);
  });

  it('awaitPendingUploads resolves immediately when no uploads are pending', async () => {
    const { result } = renderHook(() =>
      useImageUpload({ projectId: 'proj-1', taskId: 'task-1' }),
    );
    await expect(result.current.awaitPendingUploads()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
cd apps/web && npx vitest run src/hooks/useImageUpload.test.ts
```

Expected: FAIL — `useImageUpload` module not found.

- [ ] **Step 3: Write the hook implementation**

```ts
// apps/web/src/hooks/useImageUpload.ts
import { useRef, useCallback } from 'react';
import { type Editor } from '@tiptap/react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface UseImageUploadOptions {
  projectId: string;
  taskId: string;
}

export function useImageUpload({ projectId, taskId }: UseImageUploadOptions) {
  // Map from base64 src → Promise resolving to server URL (or rejecting)
  const pendingUploads = useRef<Map<string, Promise<string>>>(new Map());

  const swapSrcInEditor = useCallback(
    (editor: Editor, oldSrc: string, newSrc: string) => {
      const { state, dispatch } = editor.view;
      state.doc.descendants((node, pos) => {
        if (node.type.name === 'image' && (node.attrs as Record<string, unknown>).src === oldSrc) {
          const tr = state.tr.setNodeMarkup(pos, undefined, {
            ...(node.attrs as Record<string, unknown>),
            src: newSrc,
          });
          dispatch(tr);
          return false; // stop after first match
        }
      });
    },
    [],
  );

  const removeImageFromEditor = useCallback(
    (editor: Editor, src: string) => {
      const { state, dispatch } = editor.view;
      state.doc.descendants((node, pos) => {
        if (node.type.name === 'image' && (node.attrs as Record<string, unknown>).src === src) {
          const tr = state.tr.delete(pos, pos + node.nodeSize);
          dispatch(tr);
          return false;
        }
      });
    },
    [],
  );

  /**
   * Called after the editor has already inserted the image as base64.
   * Fires the upload in the background and swaps src when done.
   */
  const handleImagePaste = useCallback(
    (file: File, editor: Editor, base64Src: string) => {
      const uploadPromise = api
        .uploadAttachment(projectId, taskId, file)
        .then((attachment) => {
          const serverUrl = `/api/uploads/tasks/${taskId}/${attachment.storedName}`;
          swapSrcInEditor(editor, base64Src, serverUrl);
          pendingUploads.current.delete(base64Src);
          return serverUrl;
        })
        .catch((err: unknown) => {
          removeImageFromEditor(editor, base64Src);
          pendingUploads.current.delete(base64Src);
          toast.error('Image upload failed — please try again.');
          throw err;
        });

      pendingUploads.current.set(base64Src, uploadPromise);
    },
    [projectId, taskId, swapSrcInEditor, removeImageFromEditor],
  );

  /** Await all in-flight uploads. Call before getHTML() on save. */
  const awaitPendingUploads = useCallback(async () => {
    const pending = Array.from(pendingUploads.current.values());
    if (pending.length > 0) {
      await Promise.allSettled(pending);
    }
  }, []);

  return { handleImagePaste, awaitPendingUploads };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd apps/web && npx vitest run src/hooks/useImageUpload.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/useImageUpload.ts apps/web/src/hooks/useImageUpload.test.ts
git commit -m "feat: add useImageUpload hook for background image upload with base64 swap"
```

---

## Task 3: Update `RichTextEditor` to use ResizableImage and useImageUpload

**Files:**
- Modify: `apps/web/src/components/tasks/RichTextEditor.tsx`

- [ ] **Step 1: Replace imports and update the paste handler**

Replace the entire file content with:

```tsx
// apps/web/src/components/tasks/RichTextEditor.tsx
import { useState, useRef, useCallback, useEffect } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import {
  Bold, Italic, List, ListOrdered, Code2, Table as TableIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';
import { ResizableImage } from '@/components/editor/ResizableImage';
import { useImageUpload } from '@/hooks/useImageUpload';

interface RichTextEditorProps {
  initialContent: string;
  onSave: (html: string) => void;
  editable: boolean;
  projectId: string;
  taskId: string;
  /** Always show editor (no read/edit toggle). Used by CommentComposer. */
  alwaysEditing?: boolean;
  placeholder?: string;
}

function ToolbarButton({
  editor,
  action,
  isActiveKey,
  icon: Icon,
  label,
}: {
  editor: Editor;
  action: () => void;
  isActiveKey: string;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`size-7 ${editor.isActive(isActiveKey) ? 'bg-muted' : ''}`}
          onClick={action}
          aria-label={label}
          aria-pressed={editor.isActive(isActiveKey)}
          type="button"
        >
          <Icon className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function EditorToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  return (
    <div className="flex items-center gap-1 border-b p-1">
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleBold().run()}
        isActiveKey="bold"
        icon={Bold}
        label="Bold"
      />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleItalic().run()}
        isActiveKey="italic"
        icon={Italic}
        label="Italic"
      />
      <div className="mx-1 h-4 w-px bg-border" />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleBulletList().run()}
        isActiveKey="bulletList"
        icon={List}
        label="Bullet List"
      />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleOrderedList().run()}
        isActiveKey="orderedList"
        icon={ListOrdered}
        label="Numbered List"
      />
      <div className="mx-1 h-4 w-px bg-border" />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleCodeBlock().run()}
        isActiveKey="codeBlock"
        icon={Code2}
        label="Code Block"
      />
      <div className="mx-1 h-4 w-px bg-border" />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        isActiveKey="table"
        icon={TableIcon}
        label="Insert Table"
      />
    </div>
  );
}

export function RichTextEditor({
  initialContent,
  onSave,
  editable,
  projectId,
  taskId,
  alwaysEditing = false,
  placeholder: placeholderText = 'Add a description...',
}: RichTextEditorProps) {
  const [isEditing, setIsEditing] = useState(alwaysEditing);
  const [isSaving, setIsSaving] = useState(false);
  const initialContentRef = useRef(initialContent);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);

  const { handleImagePaste, awaitPendingUploads } = useImageUpload({ projectId, taskId });

  // Keep initialContentRef in sync for read-mode rendering
  useEffect(() => {
    initialContentRef.current = initialContent;
  }, [initialContent]);

  const handleSaveAndExit = useCallback(
    async (editor: Editor) => {
      setIsSaving(true);
      await awaitPendingUploads();
      const html = editor.getHTML();
      onSave(html);
      setIsSaving(false);
      if (!alwaysEditing) {
        setIsEditing(false);
      }
    },
    [onSave, alwaysEditing, awaitPendingUploads],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Placeholder.configure({ placeholder: placeholderText }),
      ResizableImage,
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: initialContentRef.current,
    editable: true,
    editorProps: {
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items || !editorRef.current) return false;
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) continue;
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = reader.result as string;
              editorRef.current!.chain().focus().setImage({ src: base64 }).run();
              handleImagePaste(file, editorRef.current!, base64);
            };
            reader.readAsDataURL(file);
            return true;
          }
        }
        return false;
      },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Escape' && !alwaysEditing) {
          if (editor) void handleSaveAndExit(editor);
          return true;
        }
        return false;
      },
    },
  });

  // Keep editorRef in sync so paste handler can access the editor instance
  editorRef.current = editor;

  // Update editor content when initialContent changes (e.g. after refetch)
  useEffect(() => {
    if (editor && !isEditing && initialContent !== editor.getHTML()) {
      editor.commands.setContent(initialContent);
    }
  }, [editor, initialContent, isEditing]);

  // Handle blur — save and exit edit mode
  useEffect(() => {
    if (!editor || alwaysEditing) return;

    const handleBlur = ({ event }: { event: FocusEvent }) => {
      const relatedTarget = event.relatedTarget as Node | null;
      if (containerRef.current?.contains(relatedTarget)) return;
      void handleSaveAndExit(editor);
    };

    editor.on('blur', handleBlur);
    return () => {
      editor.off('blur', handleBlur);
    };
  }, [editor, handleSaveAndExit, alwaysEditing]);

  // When entering edit mode, focus the editor
  useEffect(() => {
    if (isEditing && editor && !alwaysEditing) {
      editor.commands.setContent(initialContent);
      setTimeout(() => editor.commands.focus('end'), 0);
    }
  }, [isEditing, editor, alwaysEditing, initialContent]);

  const handleDoubleClick = () => {
    if (!editable || alwaysEditing) return;
    setIsEditing(true);
  };

  const isEmpty = !initialContent || initialContent === '<p></p>' || initialContent.trim() === '';

  // ── Read mode ──
  if (!isEditing) {
    return (
      <div
        className={cn(
          'rounded-md border',
          editable && 'cursor-pointer hover:border-muted-foreground/30 transition-colors group/desc',
        )}
        onDoubleClick={handleDoubleClick}
        onClick={isEmpty && editable ? () => setIsEditing(true) : undefined}
      >
        {isEmpty ? (
          <p className="text-sm text-muted-foreground p-3">{placeholderText}</p>
        ) : (
          <div
            className="prose prose-sm max-w-none p-3 text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-muted [&_th]:font-semibold"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(initialContent) }}
          />
        )}
        {editable && !isEmpty && (
          <div className="text-[11px] text-muted-foreground/0 group-hover/desc:text-muted-foreground/60 transition-colors px-3 pb-1.5 text-right">
            Double-click to edit
          </div>
        )}
      </div>
    );
  }

  // ── Edit mode (or alwaysEditing) ──
  return (
    <div className="rounded-md border border-ring/50" ref={containerRef}>
      <EditorToolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-3 text-sm leading-relaxed focus-within:outline-none [&_.tiptap]:outline-none [&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_img]:max-w-full [&_img]:rounded-md [&_img]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-muted [&_th]:font-semibold"
        aria-label="Task description"
      />
      {isSaving && (
        <div className="px-3 pb-2 text-xs text-muted-foreground">Uploading images…</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Find all usages of RichTextEditor and add the new props**

```bash
grep -rn "RichTextEditor" apps/web/src --include="*.tsx" | grep -v "RichTextEditor.tsx"
```

Note the files returned. For each usage, add `projectId` and `taskId` props. These values are already available in `TaskDetailPage.tsx` as part of the task data.

- [ ] **Step 3: Update TaskDetailPage (or wherever RichTextEditor is used)**

Open `apps/web/src/pages/TaskDetailPage.tsx` (or the file found in Step 2) and add `projectId={projectId}` and `taskId={task.id}` to the `<RichTextEditor>` call. The `projectId` and `taskId` are already in scope on that page.

- [ ] **Step 4: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/tasks/RichTextEditor.tsx apps/web/src/pages/
git commit -m "feat: update RichTextEditor to use ResizableImage extension and background image upload"
```

---

## Task 4: Update `CommentComposer` to use ResizableImage and useImageUpload

**Files:**
- Modify: `apps/web/src/components/tasks/CommentComposer.tsx`
- Modify: `apps/web/src/components/tasks/CommentThread.tsx` (add projectId/taskId props to CommentComposer calls)

- [ ] **Step 1: Replace the entire file content**

```tsx
// apps/web/src/components/tasks/CommentComposer.tsx
import { useState, useRef, useCallback } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import {
  Bold, Italic, List, ListOrdered, Code2, Table as TableIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ResizableImage } from '@/components/editor/ResizableImage';
import { useImageUpload } from '@/hooks/useImageUpload';

interface CommentComposerProps {
  onSubmit: (content: string) => void;
  isPending: boolean;
  projectId: string;
  taskId: string;
  placeholder?: string;
  onCancel?: () => void;
}

function ToolbarButton({
  editor,
  action,
  isActiveKey,
  icon: Icon,
  label,
}: {
  editor: Editor;
  action: () => void;
  isActiveKey: string;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`size-7 ${editor.isActive(isActiveKey) ? 'bg-muted' : ''}`}
          onClick={action}
          aria-label={label}
          aria-pressed={editor.isActive(isActiveKey)}
          type="button"
        >
          <Icon className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function CommentComposer({
  onSubmit,
  isPending,
  projectId,
  taskId,
  placeholder = 'Add a comment...',
  onCancel,
}: CommentComposerProps) {
  const editorRef = useRef<Editor | null>(null);
  const handleSubmitRef = useRef<() => void>(() => {});
  const [isContentEmpty, setIsContentEmpty] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const { handleImagePaste, awaitPendingUploads } = useImageUpload({ projectId, taskId });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Placeholder.configure({ placeholder }),
      ResizableImage,
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: '',
    onUpdate: ({ editor: e }) => {
      setIsContentEmpty(e.isEmpty);
    },
    editorProps: {
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items || !editorRef.current) return false;
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) continue;
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = reader.result as string;
              editorRef.current!.chain().focus().setImage({ src: base64 }).run();
              handleImagePaste(file, editorRef.current!, base64);
            };
            reader.readAsDataURL(file);
            return true;
          }
        }
        return false;
      },
      handleKeyDown: (_view, event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          handleSubmitRef.current();
          return true;
        }
        return false;
      },
    },
  });

  editorRef.current = editor;

  const isEmpty = !editor || isContentEmpty;

  const handleSubmit = useCallback(async () => {
    if (!editor || editor.isEmpty || isPending) return;
    setIsSaving(true);
    await awaitPendingUploads();
    const html = editor.getHTML();
    setIsSaving(false);
    onSubmit(html);
    editor.commands.clearContent();
  }, [editor, isPending, onSubmit, awaitPendingUploads]);

  handleSubmitRef.current = () => { void handleSubmit(); };

  if (!editor) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-md border focus-within:border-ring/50">
        <div className="flex items-center gap-1 border-b p-1">
          <ToolbarButton
            editor={editor}
            action={() => editor.chain().focus().toggleBold().run()}
            isActiveKey="bold"
            icon={Bold}
            label="Bold"
          />
          <ToolbarButton
            editor={editor}
            action={() => editor.chain().focus().toggleItalic().run()}
            isActiveKey="italic"
            icon={Italic}
            label="Italic"
          />
          <div className="mx-1 h-4 w-px bg-border" />
          <ToolbarButton
            editor={editor}
            action={() => editor.chain().focus().toggleBulletList().run()}
            isActiveKey="bulletList"
            icon={List}
            label="Bullet List"
          />
          <ToolbarButton
            editor={editor}
            action={() => editor.chain().focus().toggleOrderedList().run()}
            isActiveKey="orderedList"
            icon={ListOrdered}
            label="Numbered List"
          />
          <div className="mx-1 h-4 w-px bg-border" />
          <ToolbarButton
            editor={editor}
            action={() => editor.chain().focus().toggleCodeBlock().run()}
            isActiveKey="codeBlock"
            icon={Code2}
            label="Code Block"
          />
          <div className="mx-1 h-4 w-px bg-border" />
          <ToolbarButton
            editor={editor}
            action={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            isActiveKey="table"
            icon={TableIcon}
            label="Insert Table"
          />
        </div>
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none p-3 text-sm leading-relaxed min-h-[60px] focus-within:outline-none [&_.tiptap]:outline-none [&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_img]:max-w-full [&_img]:rounded-md [&_img]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-muted [&_th]:font-semibold"
          aria-label="Comment editor"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => { void handleSubmit(); }}
          disabled={isEmpty || isPending || isSaving}
        >
          {isSaving ? 'Uploading…' : 'Post Comment'}
        </Button>
        {onCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isPending || isSaving}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Find CommentComposer usages and add new props**

```bash
grep -rn "CommentComposer" apps/web/src --include="*.tsx" | grep -v "CommentComposer.tsx"
```

For each usage, add `projectId={projectId}` and `taskId={taskId}`. These are already in scope on the task detail page.

- [ ] **Step 3: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/tasks/CommentComposer.tsx
git commit -m "feat: update CommentComposer to use ResizableImage and background image upload"
```

---

## Task 4.5: Fix CommentThread and CommentItem to pass projectId/taskId

**Background:** `CommentThread` already has `projectId` and `taskId` as props but doesn't pass them to `CommentComposer` or `CommentItem`. Additionally, `CommentItem` uses `RichTextEditor` with incorrect props (`content`/`onChange`) that don't match the component's interface — this is a pre-existing bug that must be fixed now to avoid TypeScript errors.

**Files:**
- Modify: `apps/web/src/components/tasks/CommentThread.tsx`
- Modify: `apps/web/src/components/tasks/CommentItem.tsx`

- [ ] **Step 1: Update CommentThread — add projectId/taskId to CommentComposer calls and CommentItem calls**

In `apps/web/src/components/tasks/CommentThread.tsx`, make three changes:

**a) Add `projectId` and `taskId` to both `<CommentComposer>` calls:**

```tsx
{/* Inline reply composer */}
{replyingTo === comment.id && (
  <div className="ml-5 border-l-2 border-border pl-4">
    <CommentComposer
      onSubmit={(content) => handlePostReply(comment.id, content)}
      isPending={createReply.isPending}
      projectId={projectId}
      taskId={taskId}
      placeholder="Write a reply..."
      onCancel={() => setReplyingTo(null)}
    />
  </div>
)}
```

```tsx
{/* New top-level comment composer */}
<CommentComposer
  onSubmit={handlePostComment}
  isPending={createComment.isPending}
  projectId={projectId}
  taskId={taskId}
  placeholder="Add a comment..."
/>
```

**b) Add `projectId` and `taskId` to both `<CommentItem>` calls (top-level and reply):**

```tsx
<CommentItem
  comment={comment}
  currentUserId={currentUserId}
  canManage={canManage}
  projectId={projectId}
  taskId={taskId}
  onReply={handleReply}
  onDelete={handleDelete}
  onEdit={handleEdit}
/>
```

```tsx
<CommentItem
  key={reply.id}
  comment={reply}
  currentUserId={currentUserId}
  canManage={canManage}
  projectId={projectId}
  taskId={taskId}
  onReply={handleReply}
  onDelete={handleDelete}
  onEdit={handleEdit}
  isReply
/>
```

- [ ] **Step 2: Update CommentItem — add projectId/taskId props and fix RichTextEditor usage**

Replace the full `CommentItem.tsx` content:

```tsx
// apps/web/src/components/tasks/CommentItem.tsx
import { useState } from 'react';
import { cn } from '@/lib/utils';
import DOMPurify from 'dompurify';
import { formatDistanceToNow } from 'date-fns';
import { Trash2, Reply, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { RichTextEditor } from './RichTextEditor';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { Comment } from '@/lib/types';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface CommentItemProps {
  comment: Comment;
  currentUserId: string;
  canManage: boolean;
  projectId: string;
  taskId: string;
  onReply: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  onEdit: (commentId: string, content: string) => void;
  isReply?: boolean;
}

export function CommentItem({
  comment,
  currentUserId,
  canManage,
  projectId,
  taskId,
  onReply,
  onDelete,
  onEdit,
  isReply = false,
}: CommentItemProps) {
  const canDelete = comment.authorId === currentUserId || canManage;
  const canEditComment = comment.authorId === currentUserId || canManage;
  const [isEditing, setIsEditing] = useState(false);

  const relativeTime = (() => {
    try {
      return formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });
    } catch {
      return comment.createdAt;
    }
  })();

  return (
    <div className={cn('flex gap-2 group/comment', isReply && 'rounded-md bg-muted/30 p-2')}>
      <Avatar className="size-6 shrink-0 mt-0.5">
        <AvatarFallback className="text-[10px]">
          {getInitials(comment.author.username)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-medium">{comment.author.username}</span>
          <span className="text-xs text-muted-foreground">{relativeTime}</span>
          {comment.isEdited && (
            <span className="text-xs text-muted-foreground italic">(edited)</span>
          )}
        </div>
        {isEditing ? (
          <div className="mt-1">
            <RichTextEditor
              initialContent={comment.content}
              onSave={(html) => {
                onEdit(comment.id, html);
                setIsEditing(false);
              }}
              editable={true}
              alwaysEditing={true}
              projectId={projectId}
              taskId={taskId}
              placeholder="Edit comment..."
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs mt-1"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div
            className="prose prose-sm max-w-none mt-0.5 break-words text-sm [&_img]:max-w-full [&_img]:rounded-md [&_img]:my-2 [&_p]:my-0.5 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-1.5 [&_td]:text-xs [&_th]:border [&_th]:border-border [&_th]:p-1.5 [&_th]:text-xs [&_th]:bg-muted [&_th]:font-semibold"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment.content) }}
          />
        )}
        <div className="flex items-center gap-1 mt-1 opacity-0 group-hover/comment:opacity-100 transition-opacity">
          {!isReply && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs gap-1"
              onClick={() => onReply(comment.id)}
            >
              <Reply className="size-3" />
              Reply
            </Button>
          )}
          {canEditComment && !isEditing && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs gap-1"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="size-3" />
              Edit
            </Button>
          )}
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="size-6">
                  <Trash2 className="size-3" />
                  <span className="sr-only">Delete comment</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Comment</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this comment. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => onDelete(comment.id)}
                  >
                    Delete Comment
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/tasks/CommentThread.tsx apps/web/src/components/tasks/CommentItem.tsx
git commit -m "fix: pass projectId/taskId through CommentThread to CommentComposer and CommentItem; fix broken RichTextEditor props in CommentItem"
```

---

## Task 5: Create `ImagePreviewModal`

**Files:**
- Create: `apps/web/src/components/tasks/ImagePreviewModal.tsx`
- Create: `apps/web/src/components/tasks/ImagePreviewModal.test.tsx`

Note: Image thumbnails and the preview modal use the static URL `/api/uploads/tasks/${taskId}/${storedName}` — served without auth by `useStaticAssets` in `main.ts`. This is safe for `<img src>` attributes.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/tasks/ImagePreviewModal.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImagePreviewModal } from './ImagePreviewModal';
import type { Attachment } from '@/lib/types';

vi.mock('@/lib/api', () => ({
  api: {
    downloadAttachment: vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/png' })),
  },
}));

const mockAttachment: Attachment = {
  id: 'att-1',
  filename: 'screenshot.png',
  storedName: 'uuid-abc.png',
  mimeType: 'image/png',
  size: 12345,
  taskId: 'task-1',
  uploaderId: 'user-1',
  createdAt: '2026-04-07T00:00:00Z',
  uploader: { id: 'user-1', username: 'alice', email: 'alice@test.com' },
};

describe('ImagePreviewModal', () => {
  it('renders image with static URL when open', () => {
    render(
      <ImagePreviewModal
        attachment={mockAttachment}
        projectId="proj-1"
        taskId="task-1"
        open={true}
        onClose={vi.fn()}
      />,
    );
    const img = screen.getByRole('img', { name: /screenshot\.png/i });
    expect(img).toHaveAttribute('src', '/api/uploads/tasks/task-1/uuid-abc.png');
  });

  it('shows filename in dialog title', () => {
    render(
      <ImagePreviewModal
        attachment={mockAttachment}
        projectId="proj-1"
        taskId="task-1"
        open={true}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('screenshot.png')).toBeInTheDocument();
  });

  it('shows Download button', () => {
    render(
      <ImagePreviewModal
        attachment={mockAttachment}
        projectId="proj-1"
        taskId="task-1"
        open={true}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
  });

  it('calls onClose when dialog is closed', () => {
    const onClose = vi.fn();
    render(
      <ImagePreviewModal
        attachment={mockAttachment}
        projectId="proj-1"
        taskId="task-1"
        open={true}
        onClose={onClose}
      />,
    );
    // Press Escape to close
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when attachment is null', () => {
    const { container } = render(
      <ImagePreviewModal
        attachment={null}
        projectId="proj-1"
        taskId="task-1"
        open={false}
        onClose={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
cd apps/web && npx vitest run src/components/tasks/ImagePreviewModal.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the component**

```tsx
// apps/web/src/components/tasks/ImagePreviewModal.tsx
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { Attachment } from '@/lib/types';

interface ImagePreviewModalProps {
  attachment: Attachment | null;
  projectId: string;
  taskId: string;
  open: boolean;
  onClose: () => void;
}

export function ImagePreviewModal({
  attachment,
  projectId,
  taskId,
  open,
  onClose,
}: ImagePreviewModalProps) {
  if (!attachment) return null;

  const staticUrl = `/api/uploads/tasks/${taskId}/${attachment.storedName}`;

  const handleDownload = async () => {
    try {
      const blob = await api.downloadAttachment(projectId, taskId, attachment.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download file.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[90vw] w-fit flex flex-col items-center gap-4 p-6">
        <DialogTitle className="text-sm font-medium truncate max-w-[80vw]">
          {attachment.filename}
        </DialogTitle>
        <img
          src={staticUrl}
          alt={attachment.filename}
          className="max-w-[85vw] max-h-[70vh] object-contain rounded-md"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        <Button variant="outline" size="sm" onClick={() => { void handleDownload(); }} className="gap-2">
          <Download className="size-3.5" />
          Download
        </Button>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd apps/web && npx vitest run src/components/tasks/ImagePreviewModal.test.tsx
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/tasks/ImagePreviewModal.tsx apps/web/src/components/tasks/ImagePreviewModal.test.tsx
git commit -m "feat: add ImagePreviewModal lightbox for attachment image preview"
```

---

## Task 6: Update `AttachmentList` to show thumbnails and open preview modal

**Files:**
- Modify: `apps/web/src/components/tasks/AttachmentList.tsx`
- Create: `apps/web/src/components/tasks/AttachmentList.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// apps/web/src/components/tasks/AttachmentList.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { Attachment } from '@/lib/types';
import * as attachmentHooks from '@/hooks/useAttachments';

vi.mock('@/lib/api', () => ({
  api: {
    downloadAttachment: vi.fn().mockResolvedValue(new Blob()),
  },
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

const imageAttachment: Attachment = {
  id: 'att-img',
  filename: 'photo.png',
  storedName: 'uuid-img.png',
  mimeType: 'image/png',
  size: 8000,
  taskId: 'task-1',
  uploaderId: 'user-1',
  createdAt: '2026-04-07T00:00:00Z',
  uploader: { id: 'user-1', username: 'alice', email: 'alice@test.com' },
};

const fileAttachment: Attachment = {
  id: 'att-file',
  filename: 'report.pdf',
  storedName: 'uuid-pdf.pdf',
  mimeType: 'application/pdf',
  size: 20000,
  taskId: 'task-1',
  uploaderId: 'user-1',
  createdAt: '2026-04-07T00:00:00Z',
  uploader: { id: 'user-1', username: 'alice', email: 'alice@test.com' },
};

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('AttachmentList image preview', () => {
  beforeEach(() => {
    vi.spyOn(attachmentHooks, 'useAttachments').mockReturnValue({
      data: [imageAttachment, fileAttachment],
    } as unknown as ReturnType<typeof attachmentHooks.useAttachments>);
    vi.spyOn(attachmentHooks, 'useUploadAttachment').mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof attachmentHooks.useUploadAttachment>);
    vi.spyOn(attachmentHooks, 'useDeleteAttachment').mockReturnValue({
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof attachmentHooks.useDeleteAttachment>);
  });

  it('renders thumbnail img for image attachments', async () => {
    const { AttachmentList } = await import('./AttachmentList');
    render(
      <AttachmentList
        projectId="proj-1"
        taskId="task-1"
        currentUserId="user-1"
        canManage={false}
      />,
      { wrapper },
    );
    // Thumbnail img src = static URL
    const thumb = screen.getByRole('img', { name: /photo\.png/i });
    expect(thumb).toHaveAttribute('src', '/api/uploads/tasks/task-1/uuid-img.png');
  });

  it('renders Preview button only for image attachments', async () => {
    const { AttachmentList } = await import('./AttachmentList');
    render(
      <AttachmentList
        projectId="proj-1"
        taskId="task-1"
        currentUserId="user-1"
        canManage={false}
      />,
      { wrapper },
    );
    const previewButtons = screen.getAllByRole('button', { name: /preview/i });
    expect(previewButtons).toHaveLength(1); // only for image attachment
  });

  it('opens ImagePreviewModal when Preview is clicked', async () => {
    const { AttachmentList } = await import('./AttachmentList');
    render(
      <AttachmentList
        projectId="proj-1"
        taskId="task-1"
        currentUserId="user-1"
        canManage={false}
      />,
      { wrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: /preview photo\.png/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('photo.png')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
cd apps/web && npx vitest run src/components/tasks/AttachmentList.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Update AttachmentList to add thumbnail and Preview button**

Replace the full file content:

```tsx
// apps/web/src/components/tasks/AttachmentList.tsx
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Upload, Loader2, FileText, File, Image as ImageIcon, Trash2, Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  useAttachments,
  useUploadAttachment,
  useDeleteAttachment,
} from '@/hooks/useAttachments';
import { api } from '@/lib/api';
import type { Attachment } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { ImagePreviewModal } from './ImagePreviewModal';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('text/')) return FileText;
  if (mimeType.startsWith('image/')) return ImageIcon;
  return File;
}

interface AttachmentRowProps {
  attachment: Attachment;
  projectId: string;
  taskId: string;
  currentUserId: string;
  canManage: boolean;
  onDelete: (attachmentId: string) => void;
  onPreview: (attachment: Attachment) => void;
}

function AttachmentRow({
  attachment,
  projectId,
  taskId,
  currentUserId,
  canManage,
  onDelete,
  onPreview,
}: AttachmentRowProps) {
  const canDelete = attachment.uploaderId === currentUserId || canManage;
  const isImage = attachment.mimeType.startsWith('image/');
  const FileIcon = getFileIcon(attachment.mimeType);
  const staticUrl = `/api/uploads/tasks/${taskId}/${attachment.storedName}`;

  const handleDownload = async () => {
    try {
      const blob = await api.downloadAttachment(projectId, taskId, attachment.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download file.');
    }
  };

  const relativeTime = (() => {
    try {
      return formatDistanceToNow(new Date(attachment.createdAt), { addSuffix: true });
    } catch {
      return attachment.createdAt;
    }
  })();

  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-b-0">
      {isImage ? (
        <button
          type="button"
          className="shrink-0 size-8 rounded overflow-hidden border bg-muted hover:opacity-80 transition-opacity"
          onClick={() => onPreview(attachment)}
          aria-label={`Preview ${attachment.filename}`}
        >
          <img
            src={staticUrl}
            alt={attachment.filename}
            className="size-8 object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        </button>
      ) : (
        <FileIcon className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="text-sm font-medium truncate max-w-[200px] flex-1">
        {attachment.filename}
      </span>
      <span className="text-xs text-muted-foreground shrink-0">
        {formatFileSize(attachment.size)}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        <Avatar className="size-5">
          <AvatarFallback className="text-[8px]">
            {getInitials(attachment.uploader.username)}
          </AvatarFallback>
        </Avatar>
        <span className="text-xs text-muted-foreground">{attachment.uploader.username}</span>
      </div>
      <span className="text-xs text-muted-foreground shrink-0">{relativeTime}</span>
      {isImage && (
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={() => onPreview(attachment)}
          aria-label={`Preview ${attachment.filename}`}
        >
          <Eye className="size-3.5" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        onClick={() => { void handleDownload(); }}
      >
        <Download className="size-3.5" />
        <span className="sr-only">Download {attachment.filename}</span>
      </Button>
      {canDelete && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7 shrink-0">
              <Trash2 className="size-3.5" />
              <span className="sr-only">Delete {attachment.filename}</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Attachment</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete {attachment.filename}. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => onDelete(attachment.id)}
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

interface AttachmentListProps {
  projectId: string;
  taskId: string;
  currentUserId: string;
  canManage: boolean;
}

export function AttachmentList({
  projectId,
  taskId,
  currentUserId,
  canManage,
}: AttachmentListProps) {
  const { data: attachments = [] } = useAttachments(projectId, taskId);
  const uploadAttachment = useUploadAttachment(projectId, taskId);
  const deleteAttachment = useDeleteAttachment(projectId, taskId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10_485_760) {
      toast.error('File is too large. Maximum size is 10 MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    uploadAttachment.mutate(file, {
      onSettled: () => {
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
    });
  };

  const handleDelete = (attachmentId: string) => {
    deleteAttachment.mutate(attachmentId);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-muted-foreground">Attachments</h2>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadAttachment.isPending}
        >
          {uploadAttachment.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          Attach file
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          aria-label="Upload attachment"
          onChange={handleFileChange}
        />
      </div>

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attachments.</p>
      ) : (
        <div>
          {attachments.map((attachment) => (
            <AttachmentRow
              key={attachment.id}
              attachment={attachment}
              projectId={projectId}
              taskId={taskId}
              currentUserId={currentUserId}
              canManage={canManage}
              onDelete={handleDelete}
              onPreview={setPreviewAttachment}
            />
          ))}
        </div>
      )}

      <ImagePreviewModal
        attachment={previewAttachment}
        projectId={projectId}
        taskId={taskId}
        open={previewAttachment !== null}
        onClose={() => setPreviewAttachment(null)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && npx vitest run src/components/tasks/AttachmentList.test.tsx
```

Expected: 3 tests PASS.

- [ ] **Step 5: Run all tests to check for regressions**

```bash
cd apps/web && npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/tasks/AttachmentList.tsx apps/web/src/components/tasks/AttachmentList.test.tsx
git commit -m "feat: add image thumbnail and preview modal in AttachmentList"
```

---

## Manual Verification Checklist

After all tasks are complete, verify in the browser:

1. **Paste large image into description** → image appears instantly, blur → saves without error, DB contains `/api/uploads/...` URL (not base64)
2. **Paste image and immediately blur** → brief "Uploading images…" indicator, then saves cleanly
3. **Paste image, upload fails (disconnect network)** → image removed from editor, toast error shown
4. **Select image in editor** → resize handle appears on right edge; drag right → image grows; blur → width persists on reload
5. **Upload image file as attachment** → thumbnail appears in attachment list (not file icon)
6. **Click thumbnail** → lightbox opens with full image and Download button
7. **Upload PDF attachment** → no thumbnail, no Preview button — only Download + Delete
8. **Press Escape in lightbox** → modal closes
