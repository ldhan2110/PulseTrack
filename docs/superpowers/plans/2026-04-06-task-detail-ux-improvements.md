# Task Detail UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the task detail page with a two-card layout, description read/edit mode, rich text comments with clipboard image paste, and fix the stale data bug.

**Architecture:** The task detail page (`TaskDetailPage.tsx`) splits into two bordered cards — task content (description, acceptance criteria, attachments) and discussion (tabbed comments/activity). The `RichTextEditor` gains a read-only rendered mode with double-click-to-edit. `CommentComposer` switches from plain textarea to TipTap. Both editors support clipboard image paste via `@tiptap/extension-image`.

**Tech Stack:** React 19, TipTap 3, @tiptap/extension-image (new), shadcn/ui Tabs, TanStack Query 5

---

### Task 1: Fix Stale Data Bug in useTasks Hooks

**Files:**
- Modify: `apps/web/src/hooks/useTasks.ts`

This is the highest-priority fix — it unblocks correct behavior for all subsequent UI changes.

- [ ] **Step 1: Fix `useUpdateTask` cache invalidation**

In `apps/web/src/hooks/useTasks.ts`, the `onSettled` callback of `useUpdateTask` only invalidates `['tasks', projectId]`. It must also invalidate the single-task detail query and the task history query.

Replace the `onSettled` in `useUpdateTask` (line 55-57):

```typescript
onSettled: (_data, _error, { taskId }) => {
  void queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
  void queryClient.invalidateQueries({ queryKey: ['task', projectId, taskId] });
  void queryClient.invalidateQueries({ queryKey: ['task-history', projectId, taskId] });
},
```

Note: The `onMutate` optimistic update should also update the single-task cache. Add after the existing `setQueryData` for the tasks list (after line 46):

```typescript
const previousTask = queryClient.getQueryData(['task', projectId, taskId]);
queryClient.setQueryData(['task', projectId, taskId], (old: Task | undefined) =>
  old ? { ...old, ...data } : old,
);
```

And update the return to include `previousTask`:

```typescript
return { previousTasks, previousTask };
```

And in `onError`, restore it:

```typescript
onError: (_err, { taskId }, context) => {
  if (context?.previousTasks) {
    queryClient.setQueryData(['tasks', projectId], context.previousTasks);
  }
  if (context?.previousTask) {
    queryClient.setQueryData(['task', projectId, taskId], context.previousTask);
  }
  toast.error('Something went wrong. Please try again.');
},
```

- [ ] **Step 2: Fix `useUpdateTaskStatus` cache invalidation**

Same pattern — in `useUpdateTaskStatus`'s `onSettled` (line 105-107), add single-task and history invalidation:

```typescript
onSettled: (_data, _error, { taskId }) => {
  void queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
  void queryClient.invalidateQueries({ queryKey: ['task', projectId, taskId] });
  void queryClient.invalidateQueries({ queryKey: ['task-history', projectId, taskId] });
},
```

Also add optimistic update for the single-task cache in `onMutate`:

```typescript
const previousTask = queryClient.getQueryData(['task', projectId, taskId]);
queryClient.setQueryData(['task', projectId, taskId], (old: Task | undefined) =>
  old ? { ...old, status } : old,
);
```

Return `{ previousTasks, previousTask }` and restore in `onError`.

- [ ] **Step 3: Verify the fix works**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/useTasks.ts
git commit -m "fix: invalidate task detail and history cache on update"
```

---

### Task 2: Install @tiptap/extension-image

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install the package**

```bash
cd apps/web && npm install @tiptap/extension-image
```

- [ ] **Step 2: Verify installation**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json
```

If this is a monorepo with a root lockfile:

```bash
git add apps/web/package.json package-lock.json
```

```bash
git commit -m "deps: add @tiptap/extension-image for clipboard paste support"
```

---

### Task 3: Upgrade RichTextEditor with Read Mode and Image Paste

**Files:**
- Modify: `apps/web/src/components/tasks/RichTextEditor.tsx`

The editor currently is always in edit mode. It needs:
1. A read-only HTML rendering mode (default)
2. Double-click to enter edit mode
3. Blur/Escape to save and return to read mode
4. Clipboard image paste support via the Image extension

- [ ] **Step 1: Rewrite RichTextEditor with read/edit modes and image paste**

Replace the entire content of `apps/web/src/components/tasks/RichTextEditor.tsx` with:

```tsx
import { useState, useRef, useCallback, useEffect } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import {
  Bold, Italic, List, ListOrdered, Code2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  initialContent: string;
  onSave: (html: string) => void;
  editable: boolean;
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
    </div>
  );
}

/** Handle paste events to convert clipboard images to base64 */
function handleImagePaste(editor: Editor, event: ClipboardEvent): boolean {
  const items = event.clipboardData?.items;
  if (!items) return false;

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      event.preventDefault();
      const file = item.getAsFile();
      if (!file) continue;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        editor.chain().focus().setImage({ src: base64 }).run();
      };
      reader.readAsDataURL(file);
      return true;
    }
  }
  return false;
}

export function RichTextEditor({
  initialContent,
  onSave,
  editable,
  alwaysEditing = false,
  placeholder: placeholderText = 'Add a description...',
}: RichTextEditorProps) {
  const [isEditing, setIsEditing] = useState(alwaysEditing);
  const initialContentRef = useRef(initialContent);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep initialContentRef in sync for read-mode rendering
  useEffect(() => {
    initialContentRef.current = initialContent;
  }, [initialContent]);

  const handleSaveAndExit = useCallback(
    (editor: Editor) => {
      const html = editor.getHTML();
      onSave(html);
      if (!alwaysEditing) {
        setIsEditing(false);
      }
    },
    [onSave, alwaysEditing],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Placeholder.configure({ placeholder: placeholderText }),
      Image.configure({ inline: true, allowBase64: true }),
    ],
    content: initialContentRef.current,
    editable: true,
    editorProps: {
      handlePaste: (view, event) => {
        if (view.state.tr) {
          const tiptapEditor = editor;
          if (tiptapEditor) {
            return handleImagePaste(tiptapEditor, event as unknown as ClipboardEvent);
          }
        }
        return false;
      },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Escape' && !alwaysEditing) {
          if (editor) handleSaveAndExit(editor);
          return true;
        }
        return false;
      },
    },
  });

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
      // Check if focus moved to the toolbar (still within our container)
      const relatedTarget = event.relatedTarget as Node | null;
      if (containerRef.current?.contains(relatedTarget)) return;
      handleSaveAndExit(editor);
    };

    editor.on('blur', handleBlur);
    return () => {
      editor.off('blur', handleBlur);
    };
  }, [editor, handleSaveAndExit, alwaysEditing]);

  // When entering edit mode, focus the editor
  useEffect(() => {
    if (isEditing && editor && !alwaysEditing) {
      // Update content to latest before editing
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
            className="prose prose-sm max-w-none p-3 text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: initialContent }}
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
        className="prose prose-sm max-w-none p-3 text-sm leading-relaxed focus-within:outline-none [&_.tiptap]:outline-none [&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_img]:max-w-full [&_img]:rounded-md [&_img]:my-2"
        aria-label="Task description"
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tasks/RichTextEditor.tsx
git commit -m "feat: add read/edit mode and clipboard image paste to RichTextEditor"
```

---

### Task 4: Upgrade CommentComposer to Rich Text

**Files:**
- Modify: `apps/web/src/components/tasks/CommentComposer.tsx`

Replace the plain `<Textarea>` with the `RichTextEditor` in `alwaysEditing` mode.

- [ ] **Step 1: Rewrite CommentComposer with RichTextEditor**

Replace the entire content of `apps/web/src/components/tasks/CommentComposer.tsx` with:

```tsx
import { useRef, useCallback } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import {
  Bold, Italic, List, ListOrdered, Code2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface CommentComposerProps {
  onSubmit: (content: string) => void;
  isPending: boolean;
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

function handleImagePaste(editor: Editor, event: ClipboardEvent): boolean {
  const items = event.clipboardData?.items;
  if (!items) return false;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      event.preventDefault();
      const file = item.getAsFile();
      if (!file) continue;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        editor.chain().focus().setImage({ src: base64 }).run();
      };
      reader.readAsDataURL(file);
      return true;
    }
  }
  return false;
}

export function CommentComposer({
  onSubmit,
  isPending,
  placeholder = 'Add a comment...',
  onCancel,
}: CommentComposerProps) {
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Placeholder.configure({ placeholder }),
      Image.configure({ inline: true, allowBase64: true }),
    ],
    content: '',
    editorProps: {
      handlePaste: (view, event) => {
        if (editorRef.current) {
          return handleImagePaste(editorRef.current, event as unknown as ClipboardEvent);
        }
        return false;
      },
      handleKeyDown: (_view, event) => {
        // Ctrl/Cmd+Enter to submit
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          handleSubmit();
          return true;
        }
        return false;
      },
    },
  });

  // Keep ref in sync
  editorRef.current = editor;

  const isEmpty = !editor || editor.isEmpty;

  const handleSubmit = useCallback(() => {
    if (!editor || editor.isEmpty || isPending) return;
    const html = editor.getHTML();
    onSubmit(html);
    editor.commands.clearContent();
  }, [editor, isPending, onSubmit]);

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
        </div>
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none p-3 text-sm leading-relaxed min-h-[60px] focus-within:outline-none [&_.tiptap]:outline-none [&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_img]:max-w-full [&_img]:rounded-md [&_img]:my-2"
          aria-label="Comment editor"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isEmpty || isPending}
        >
          Post Comment
        </Button>
        {onCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tasks/CommentComposer.tsx
git commit -m "feat: upgrade CommentComposer to TipTap rich editor with image paste"
```

---

### Task 5: Render Comment Content as HTML

**Files:**
- Modify: `apps/web/src/components/tasks/CommentItem.tsx`

Currently comment content renders as plain text via `{comment.content}`. Since comments will now store HTML, render with `dangerouslySetInnerHTML` and prose styling.

- [ ] **Step 1: Update comment content rendering**

In `apps/web/src/components/tasks/CommentItem.tsx`, replace line 66:

```tsx
<p className="text-sm mt-0.5 break-words">{comment.content}</p>
```

with:

```tsx
<div
  className="prose prose-sm max-w-none mt-0.5 break-words text-sm [&_img]:max-w-full [&_img]:rounded-md [&_img]:my-2 [&_p]:my-0.5"
  dangerouslySetInnerHTML={{ __html: comment.content }}
/>
```

This safely renders HTML content. Existing plain-text comments (no HTML tags) will render as plain paragraphs since browsers treat untagged text as text nodes inside a div.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tasks/CommentItem.tsx
git commit -m "feat: render comment content as HTML for rich text support"
```

---

### Task 6: Restructure TaskDetailPage Layout

**Files:**
- Modify: `apps/web/src/pages/TaskDetailPage.tsx`

This is the largest change. It:
1. Wraps Description + Acceptance Criteria + Attachments in a bordered card
2. Wraps Comments + Activity in a second bordered card with Tabs
3. Moves Attachments from position 4 to position 3 (right after Acceptance Criteria)
4. Removes the always-editing description behavior (RichTextEditor now handles read/edit internally)

- [ ] **Step 1: Add Tabs import**

At the top of `apps/web/src/pages/TaskDetailPage.tsx`, add the Tabs import. After the existing `Separator` import (line 10):

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
```

- [ ] **Step 2: Restructure the left panel JSX**

Replace the entire left panel section (the `{/* LEFT PANEL */}` div, lines 352-478) with:

```tsx
        {/* LEFT PANEL */}
        <div className="flex-1 flex flex-col gap-6 min-w-0">

          {/* CARD 1: Task Content */}
          <div className="rounded-lg border p-5 flex flex-col gap-5">
            {/* 1. Description */}
            <section>
              <h2 className="text-[13px] font-semibold text-muted-foreground mb-2">Description</h2>
              <RichTextEditor
                initialContent={task.description ?? ''}
                onSave={(html) =>
                  updateTask.mutate({ taskId, data: { description: html } })
                }
                editable={canEdit}
              />
              {updateTask.isPending && (
                <div className="flex items-center gap-1 mt-1">
                  <Loader2 className="size-3 animate-spin" />
                  <span className="text-xs text-muted-foreground">Saving...</span>
                </div>
              )}
            </section>

            {/* 2. Acceptance Criteria */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-[13px] font-semibold text-muted-foreground">
                  Acceptance Criteria
                </h2>
                {acTotal > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {acChecked}/{acTotal} done
                  </Badge>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {acceptanceCriteria.length === 0 && !addingCriteria && (
                  <p className="text-sm text-muted-foreground">
                    No acceptance criteria. Add the first one.
                  </p>
                )}
                {acceptanceCriteria.map((ac) => (
                  <AcceptanceCriteriaItem
                    key={ac.id}
                    ac={ac}
                    canEdit={canEdit}
                    onToggle={() => toggleCriteria(ac)}
                    onDelete={() => deleteCriteria(ac.id)}
                    onSaveText={(text) => updateCriteriaText(ac.id, text)}
                  />
                ))}
              </div>
              {addingCriteria ? (
                <div className="flex items-center gap-2 mt-1">
                  <div className="size-4 shrink-0" />
                  <Input
                    placeholder="Add criterion..."
                    value={newCriteriaText}
                    onChange={(e) => setNewCriteriaText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addCriteria();
                      if (e.key === 'Escape') {
                        setAddingCriteria(false);
                        setNewCriteriaText('');
                      }
                    }}
                    autoFocus
                    className="h-7 text-sm"
                  />
                  <Button size="sm" className="h-7" onClick={addCriteria}>
                    Add
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    onClick={() => {
                      setAddingCriteria(false);
                      setNewCriteriaText('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-fit gap-1 text-muted-foreground -ml-2 mt-1"
                    onClick={() => setAddingCriteria(true)}
                  >
                    <Plus className="size-3.5" />
                    Add criteria
                  </Button>
                )
              )}
            </section>

            {/* 3. Attachments (moved here from below comments) */}
            <section>
              <AttachmentList
                projectId={projectId}
                taskId={taskId}
                currentUserId={currentUserId}
                canManage={canManage}
              />
            </section>
          </div>

          {/* CARD 2: Discussion (Comments / Activity tabs) */}
          <div className="rounded-lg border p-5">
            <Tabs defaultValue="comments">
              <TabsList variant="line" className="mb-4">
                <TabsTrigger value="comments">Comments</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>
              <TabsContent value="comments">
                <CommentThread
                  projectId={projectId}
                  taskId={taskId}
                  currentUserId={currentUserId}
                  canManage={canManage}
                />
              </TabsContent>
              <TabsContent value="activity">
                <ActivityLog
                  projectId={projectId}
                  taskId={taskId}
                  members={members}
                  sprints={sprints}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
```

- [ ] **Step 3: Remove the "Comments" and "Activity" h2 headers from child components**

Since the Tabs now provide the section headers, remove the duplicate `<h2>` from:

In `apps/web/src/components/tasks/CommentThread.tsx`, remove line 55:
```tsx
<h2 className="text-[13px] font-semibold text-muted-foreground">Comments</h2>
```

In `apps/web/src/components/tasks/ActivityLog.tsx`, remove line 20:
```tsx
<h2 className="text-[13px] font-semibold text-muted-foreground">Activity</h2>
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 5: Verify the dev server works**

Run: `cd apps/web && npm run dev`
Open the browser and navigate to a task detail page. Verify:
- Two-card layout renders correctly
- Description shows in read mode, double-click enters edit mode
- Tabs switch between Comments and Activity
- Attachments appear below Acceptance Criteria
- Rich comment editor has toolbar and accepts formatting
- Updating status/assignee/sprint immediately reflects in the UI

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/TaskDetailPage.tsx apps/web/src/components/tasks/CommentThread.tsx apps/web/src/components/tasks/ActivityLog.tsx
git commit -m "feat: restructure task detail with two-card layout and tabbed comments/activity"
```
