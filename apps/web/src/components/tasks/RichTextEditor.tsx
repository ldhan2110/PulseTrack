import { useRef, useCallback } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, Italic, List, ListOrdered, Code2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface RichTextEditorProps {
  initialContent: string;
  onSave: (html: string) => void;
  editable: boolean;
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

export function RichTextEditor({ initialContent, onSave, editable }: RichTextEditorProps) {
  // Use ref to capture initial content — prevents re-render overwrites (Pitfall 3)
  const initialContentRef = useRef(initialContent);

  const handleBlur = useCallback(
    ({ editor }: { editor: Editor }) => {
      onSave(editor.getHTML());
    },
    [onSave],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, // No heading toolbar button per UI-SPEC
      }),
      Placeholder.configure({
        placeholder: 'Add a description...',
      }),
    ],
    content: initialContentRef.current,
    editable,
    onBlur: handleBlur,
  });

  return (
    <div className="rounded-md border">
      {editable && <EditorToolbar editor={editor} />}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-3 text-sm leading-relaxed focus-within:outline-none [&_.tiptap]:outline-none [&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child::before]:h-0"
        aria-label="Task description"
      />
    </div>
  );
}
