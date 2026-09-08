// apps/web/src/components/tasks/LinkPopoverButton.tsx
import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

// Escape a string for safe insertion inside an HTML attribute / text node.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Selection-aware link control. Replaces the old `window.prompt` toggle whose
 * empty-selection `setLink` applied a link mark to a zero-width range — an
 * invisible no-op. On open we read the selection and branch:
 *  - text selected → URL only, link the selection.
 *  - caret in a link → click toggles it off.
 *  - caret in plain text → URL + display text, insert a new anchor.
 */
export function LinkPopoverButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [hasSelection, setHasSelection] = useState(false);
  const isLink = editor.isActive('link');

  const handleOpenChange = (next: boolean) => {
    if (next) {
      if (isLink) {
        // Toggle off an existing link instead of opening the popover.
        editor.chain().focus().unsetLink().run();
        return;
      }
      const { from, to } = editor.state.selection;
      setHasSelection(from !== to);
      setUrl((editor.getAttributes('link').href as string | undefined) ?? '');
      setText('');
    }
    setOpen(next);
  };

  const save = () => {
    const href = url.trim();
    if (!href) {
      setOpen(false);
      return;
    }
    if (hasSelection || editor.isActive('link')) {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    } else {
      const label = escapeHtml(text.trim() || href);
      editor.chain().focus().insertContent(`<a href="${escapeHtml(href)}">${label}</a>`).run();
    }
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  const showTextField = !hasSelection && !editor.isActive('link');

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`size-7 ${isLink ? 'bg-muted' : ''}`}
              aria-label={isLink ? 'Remove Link' : 'Insert Link'}
              aria-pressed={isLink}
              type="button"
            >
              <LinkIcon className="size-3.5" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{isLink ? 'Remove Link' : 'Insert Link'}</TooltipContent>
      </Tooltip>
      <PopoverContent
        className="w-64 space-y-2 p-2"
        align="start"
        onKeyDown={onKeyDown}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <Input
          autoFocus
          placeholder="https://"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="h-8 text-sm"
          aria-label="URL"
        />
        {showTextField && (
          <Input
            placeholder="Text to display"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="h-8 text-sm"
            aria-label="Display text"
          />
        )}
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" className="h-7" type="button" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" className="h-7" type="button" onClick={save}>
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
