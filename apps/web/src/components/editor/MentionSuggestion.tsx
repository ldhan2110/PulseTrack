import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { SuggestionKeyDownProps } from '@tiptap/suggestion';

export interface MentionSuggestionRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

interface MentionListProps {
  items: Array<{ id: string; label: string }>;
  command: (item: { id: string; label: string }) => void;
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
            @{item.label}
          </button>
        ))}
      </div>
    );
  },
);
MentionList.displayName = 'MentionList';
