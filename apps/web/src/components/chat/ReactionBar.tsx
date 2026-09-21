import { lazy, Suspense, useState } from 'react';
import { SmilePlus, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useReactMessage } from '@/hooks/useChat';
import { groupReactions, reactorNames } from '@/hooks/reactions.util';
import type { Message } from '@/lib/types';

const Picker = lazy(() => import('./EmojiPickerLazy'));

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

export function ReactionBar({ message, myId, convId }: { message: Message; myId: string; convId: string }) {
  const react = useReactMessage(convId);
  const [open, setOpen] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const groups = groupReactions(message.reactions);
  const toggle = (emoji: string) => react.mutate({ id: message.id, emoji });
  // ponytail: can't react to your own message; pills stay visible, just read-only
  const canReact = message.authorId !== myId;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {groups.map(({ emoji, rows }) => {
        const mine = rows.some((r) => r.userId === myId);
        return (
          <Tooltip key={emoji}>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={!canReact}
                onClick={() => toggle(emoji)}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${mine ? 'border-primary bg-primary/10' : 'border-border bg-muted'} ${canReact ? '' : 'cursor-default'}`}
              >
                <span>{emoji}</span>
                <span>{rows.length}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>{reactorNames(rows, myId)}</TooltipContent>
          </Tooltip>
        );
      })}

      {canReact && (
        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setShowPicker(false); }}>
          <PopoverTrigger asChild>
            <button type="button" className="rounded-full p-0.5 text-muted-foreground hover:bg-muted" aria-label="Add reaction">
              <SmilePlus className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            {showPicker ? (
              <Suspense fallback={<div className="p-4 text-xs text-muted-foreground">Loading…</div>}>
                <Picker onEmojiSelect={(e: { native: string }) => { toggle(e.native); setOpen(false); }} />
              </Suspense>
            ) : (
              <div className="flex items-center gap-1">
                {QUICK_EMOJIS.map((e) => (
                  <button key={e} type="button" className="rounded p-1 text-lg hover:bg-muted"
                    onClick={() => { toggle(e); setOpen(false); }}>
                    {e}
                  </button>
                ))}
                <button type="button" className="rounded-full p-1 text-muted-foreground hover:bg-muted"
                  aria-label="More emojis" onClick={() => setShowPicker(true)}>
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
