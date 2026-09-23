import { memo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Message } from '@/lib/types';
import { dayLabel, timeLabel } from '@/lib/chatFormat';
import { initials } from './chatUtils';
import { MessageRow } from './MessageRow';

export interface GroupProps {
  group: Message[];
  myId: string;
  showDay: boolean;
  editingId: string | null; // narrowed: only set when the edited row is in THIS group
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onCommitEdit: (id: string, body: string) => void;
  onRequestDelete: (id: string) => void;
  onRetry?: (m: Message) => void;
  onSetReply?: (m: Message) => void;
  onQuoteClick?: (parentId: string) => void;
}

/** One author-run: day divider + avatar + header + its rows. Memoized. */
export const MessageGroup = memo(function MessageGroup({
  group,
  myId,
  showDay,
  editingId,
  onStartEdit,
  onCancelEdit,
  onCommitEdit,
  onRequestDelete,
  onRetry,
  onSetReply,
  onQuoteClick,
}: GroupProps) {
  const first = group[0];
  const own = first.authorId === myId;
  return (
    <>
      {showDay && (
        <div className="flex items-center gap-3 py-2">
          <div className="h-px flex-1 bg-border" />
          <span className="px-2 text-xs font-medium text-muted-foreground">
            {dayLabel(first.createdAt)}
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
      )}
      <div className={`flex gap-2 ${own ? 'flex-row-reverse' : 'flex-row'}`}>
        {!own && (
          <Avatar className="mt-5 size-7 shrink-0">
            {first.author.imageUrl && <AvatarImage src={first.author.imageUrl} />}
            <AvatarFallback className="text-[10px]">
              {initials(first.author)}
            </AvatarFallback>
          </Avatar>
        )}
        <div className={`flex max-w-[75%] flex-col gap-1 ${own ? 'items-end' : 'items-start'}`}>
          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            {!own && (
              <span className="font-semibold text-foreground">
                {first.author.name ?? first.author.username}
              </span>
            )}
            <span>{timeLabel(first.createdAt)}</span>
          </div>

          {group.map((m) => (
            <MessageRow
              key={m.id}
              message={m}
              own={own}
              isEditing={editingId === m.id}
              myId={myId}
              onStartEdit={onStartEdit}
              onCancelEdit={onCancelEdit}
              onCommitEdit={onCommitEdit}
              onRequestDelete={onRequestDelete}
              onRetry={onRetry}
              onSetReply={onSetReply}
              onQuoteClick={onQuoteClick}
            />
          ))}
        </div>
      </div>
    </>
  );
});
