// apps/web/src/components/tasks/RichTextEditor.tsx
import { useState, useRef, useCallback, useEffect } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Link from '@tiptap/extension-link';
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
  projectId?: string;
  entityType?: 'task' | 'bug';
  entityId?: string;
  /** @deprecated Use entityId instead */
  taskId?: string;
  /** Always show editor (no read/edit toggle). Used by CommentComposer. */
  alwaysEditing?: boolean;
  placeholder?: string;
  /** Called on every content change — useful for uncontrolled collection (e.g. creation forms). */
  onChange?: (html: string) => void;
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
  entityType = 'task',
  entityId,
  taskId,
  alwaysEditing = false,
  placeholder: placeholderText = 'Add a description...',
  onChange,
}: RichTextEditorProps) {
  const resolvedEntityId = entityId ?? taskId ?? '';
  const [isEditing, setIsEditing] = useState(alwaysEditing);
  const [isSaving, setIsSaving] = useState(false);
  const initialContentRef = useRef(initialContent);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);

  const supportsImages = Boolean(projectId && resolvedEntityId);
  const { handleImagePaste, awaitPendingUploads } = useImageUpload({ projectId: projectId ?? '', entityType, entityId: resolvedEntityId });

  // Keep initialContentRef in sync for read-mode rendering
  useEffect(() => {
    initialContentRef.current = initialContent;
  }, [initialContent]);

  const handleSaveAndExit = useCallback(
    async (editor: Editor) => {
      setIsSaving(true);
      try {
        await awaitPendingUploads();
        const html = editor.getHTML();
        onSave(html);
      } finally {
        setIsSaving(false);
        if (!alwaysEditing) {
          setIsEditing(false);
        }
      }
    },
    [onSave, alwaysEditing, awaitPendingUploads],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Placeholder.configure({ placeholder: placeholderText }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: 'text-blue-600 underline underline-offset-2 hover:text-blue-300 cursor-pointer',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      ResizableImage,
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: initialContentRef.current,
    editable: true,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      handlePaste: (_view, event) => {
        if (!supportsImages) return false;
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
              editorRef.current!.chain().focus().insertContent({ type: 'image', attrs: { src: base64 } }).run();
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
            className="prose prose-sm max-w-none p-3 text-sm leading-relaxed [&_a]:text-blue-400 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-blue-300 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-muted [&_th]:font-semibold"
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
      <div className="max-h-50 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-3 text-sm leading-relaxed focus-within:outline-none [&_.tiptap]:outline-none [&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_img]:max-w-full [&_img]:rounded-md [&_img]:my-2 [&_a]:text-blue-400 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-blue-300 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-muted [&_th]:font-semibold"
        aria-label="Task description"
      />
      </div>
      {isSaving && (
        <div className="px-3 pb-2 text-xs text-muted-foreground">Uploading images…</div>
      )}
    </div>
  );
}
