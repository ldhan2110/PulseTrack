import { useState } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { SmilePlus, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useReactMessage } from '@/hooks/useChat';
import type { Message, MessageReaction } from '@/lib/types';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

export function groupReactions(reactions: MessageReaction[] = []) {
  const map = new Map<string, MessageReaction[]>();
  for (const r of reactions) {
    (map.get(r.emoji) ?? map.set(r.emoji, []).get(r.emoji)!).push(r);
  }
  return [...map.entries()].map(([emoji, rows]) => ({ emoji, rows }));
}

export function reactorNames(rows: MessageReaction[], myId: string) {
  const names = rows.map((r) => (r.userId === myId ? 'you' : r.user.name || r.user.username));
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

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
              <Picker data={data} onEmojiSelect={(e: { native: string }) => { toggle(e.native); setOpen(false); }} theme="light" />
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
