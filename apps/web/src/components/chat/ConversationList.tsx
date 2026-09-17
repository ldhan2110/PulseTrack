import { Hash } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { Conversation, Member } from '@/lib/types';

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  currentUserId: string;
  members: Member[];
  onSelect: (id: string) => void;
}

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function Row({
  active,
  unread,
  onClick,
  children,
}: {
  active: boolean;
  unread: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary',
        active && 'bg-card shadow-[0_0_0_1px_var(--border),0_1px_2px_oklch(0_0_0/.05)]',
        unread > 0 && 'font-semibold',
      )}
    >
      {children}
      {unread > 0 && (
        <Badge className="ml-auto h-5 min-w-5 justify-center rounded-full px-1.5 text-[11px]">
          {unread}
        </Badge>
      )}
    </button>
  );
}

export function ConversationList({
  conversations,
  activeId,
  currentUserId,
  members,
  onSelect,
}: ConversationListProps) {
  const channel = conversations.find((c) => c.type === 'PROJECT');
  const dms = conversations.filter((c) => c.type === 'DIRECT');
  const memberByUserId = new Map(members.map((m) => [m.userId, m]));

  const dmName = (c: Conversation) => {
    const other = c.members.find((m) => m.userId !== currentUserId);
    const mem = other ? memberByUserId.get(other.userId) : undefined;
    return mem?.user.name ?? mem?.user.username ?? 'Direct message';
  };

  return (
    <ScrollArea className="w-[158px] shrink-0 border-r">
      <div className="p-2">
        <p className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Channel
        </p>
        {channel && (
          <Row
            active={channel.id === activeId}
            unread={channel.unreadCount}
            onClick={() => onSelect(channel.id)}
          >
            <Hash className="size-4 text-muted-foreground" />
            <span className="truncate">General</span>
          </Row>
        )}

        <p className="px-2 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Direct
        </p>
        {dms.length === 0 && (
          <p className="px-2 py-1 text-xs text-muted-foreground">No direct messages</p>
        )}
        {dms.map((c) => {
          const name = dmName(c);
          return (
            <Row
              key={c.id}
              active={c.id === activeId}
              unread={c.unreadCount}
              onClick={() => onSelect(c.id)}
            >
              <Avatar className="size-6">
                <AvatarFallback className="text-[10px]">{initials(name)}</AvatarFallback>
              </Avatar>
              <span className="truncate">{name}</span>
            </Row>
          );
        })}
      </div>
    </ScrollArea>
  );
}
