import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { SuggestionKeyDownProps } from '@tiptap/suggestion';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

export interface MentionSuggestionRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

interface MentionListProps {
  items: Array<{ id: string; label: string, imageUrl?: string | null }>;
  command: (item: { id: string; label: string, imageUrl?: string | null }) => void;
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export const MentionList = forwardRef<MentionSuggestionRef, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => setSelectedIndex(0), [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((i) => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === 'Enter') {
          const item = items[selectedIndex];
          if (item) command(item);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) return null;

    return (
      <div className="rounded-md border bg-popover p-1 shadow-md">
        {items.map((item, i) => (
          <button
            key={item.id}
            className={`flex w-full items-center rounded-sm px-2 py-1.5 text-sm ${
              i === selectedIndex ? 'bg-accent text-accent-foreground' : ''
            }`}
            onClick={() => command(item)}
          >
            <Avatar className="size-4 shrink-0">
              {item.imageUrl && <AvatarImage src={item.imageUrl} />}
              {!item.imageUrl && (
                <AvatarFallback className="text-[8px]">
                  {getInitials(item.label)}
                </AvatarFallback>
              )}
            </Avatar>
            {item.label}
          </button>
        ))}
      </div>
    );
  },
);
MentionList.displayName = 'MentionList';
