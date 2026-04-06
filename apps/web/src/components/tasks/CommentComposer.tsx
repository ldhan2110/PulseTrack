import { useState, useRef, useCallback } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import {
  Bold, Italic, List, ListOrdered, Code2, Table as TableIcon,
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
  const handleSubmitRef = useRef<() => void>(() => {});
  const [isContentEmpty, setIsContentEmpty] = useState(true);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Placeholder.configure({ placeholder }),
      Image.configure({ inline: true, allowBase64: true }),
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
      handlePaste: (view, event) => {
        if (editorRef.current) {
          return handleImagePaste(editorRef.current, event as unknown as ClipboardEvent);
        }
        return false;
      },
      handleKeyDown: (_view, event) => {
        // Ctrl/Cmd+Enter to submit
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          handleSubmitRef.current();
          return true;
        }
        return false;
      },
    },
  });

  // Keep refs in sync
  editorRef.current = editor;

  const isEmpty = !editor || isContentEmpty;

  const handleSubmit = useCallback(() => {
    if (!editor || editor.isEmpty || isPending) return;
    const html = editor.getHTML();
    onSubmit(html);
    editor.commands.clearContent();
  }, [editor, isPending, onSubmit]);

  handleSubmitRef.current = handleSubmit;

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
