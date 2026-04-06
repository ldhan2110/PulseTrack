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
import DOMPurify from 'dompurify';
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
        className="prose prose-sm max-w-none p-3 text-sm leading-relaxed focus-within:outline-none [&_.tiptap]:outline-none [&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_img]:max-w-full [&_img]:rounded-md [&_img]:my-2"
        aria-label="Task description"
      />
    </div>
  );
}
