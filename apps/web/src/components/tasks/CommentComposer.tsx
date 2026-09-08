// apps/web/src/components/tasks/CommentComposer.tsx
import { useState, useRef, useCallback } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Link from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { buildMention } from '@/components/editor/mentionExtension';
import {
  Bold, Italic, List, ListOrdered, Code2, Table as TableIcon,
  Link as LinkIcon, Image as ImageIcon, Baseline, Eraser,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ResizableImage } from '@/components/editor/ResizableImage';
import { useImageUpload } from '@/hooks/useImageUpload';

interface CommentComposerProps {
  onSubmit: (content: string) => void;
  isPending: boolean;
  projectId: string;
  entityType?: 'task' | 'bug';
  entityId?: string;
  /** @deprecated Use entityId instead */
  taskId?: string;
  placeholder?: string;
  onCancel?: () => void;
  members?: Array<{ id: string; label: string, imageUrl?: string | null }>;
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
  entityType = 'task',
  entityId,
  taskId,
  placeholder = 'Add a comment...',
  onCancel,
  members,
}: CommentComposerProps) {
  const resolvedEntityId = entityId ?? taskId ?? '';
  const editorRef = useRef<Editor | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const handleSubmitRef = useRef<() => void>(() => {});
  const [isContentEmpty, setIsContentEmpty] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const { handleImagePaste, awaitPendingUploads } = useImageUpload({ projectId, entityType, entityId: resolvedEntityId });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Placeholder.configure({ placeholder }),
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
      TextStyle,
      Color,
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      buildMention(members ?? []),
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
    try {
      await awaitPendingUploads();
      const html = editor.getHTML();
      onSubmit(html);
      editor.commands.clearContent();
    } finally {
      setIsSaving(false);
    }
  }, [editor, isPending, onSubmit, awaitPendingUploads]);

  handleSubmitRef.current = () => { void handleSubmit(); };

  const handleImageFile = (file: File) => {
    const ed = editorRef.current;
    if (!ed) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      ed.chain().focus().insertContent({ type: 'image', attrs: { src: base64 } }).run();
      handleImagePaste(file, ed, base64);
    };
    reader.readAsDataURL(file);
  };

  const toggleLink = () => {
    if (!editor) return;
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt('URL');
    if (url) editor.chain().focus().setLink({ href: url }).run();
  };

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
          <div className="mx-1 h-4 w-px bg-border" />
          <ToolbarButton
            editor={editor}
            action={toggleLink}
            isActiveKey="link"
            icon={LinkIcon}
            label="Insert Link"
          />
          <ToolbarButton
            editor={editor}
            action={() => fileInputRef.current?.click()}
            isActiveKey="__never__"
            icon={ImageIcon}
            label="Upload Image"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => colorInputRef.current?.click()}
                aria-label="Font Color"
                type="button"
              >
                <Baseline className="size-3.5" style={{ color: editor.getAttributes('textStyle').color || undefined }} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Font Color</TooltipContent>
          </Tooltip>
          <input
            ref={colorInputRef}
            type="color"
            className="sr-only"
            value={editor.getAttributes('textStyle').color || '#000000'}
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            tabIndex={-1}
            aria-hidden="true"
          />
          <ToolbarButton
            editor={editor}
            action={() => editor.chain().focus().unsetColor().run()}
            isActiveKey="__never__"
            icon={Eraser}
            label="Clear Color"
          />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImageFile(file);
            e.target.value = '';
          }}
        />
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
            onClick={() => {
              editor.commands.clearContent();
              onCancel();
            }}
            disabled={isPending || isSaving}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
