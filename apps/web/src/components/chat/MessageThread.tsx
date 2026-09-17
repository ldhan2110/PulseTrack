import { useEffect, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useMessages, useMarkRead } from '@/hooks/useChat';
import type { Conversation, Member, Message } from '@/lib/types';

interface MessageThreadProps {
  projectId: string;
  conversation: Conversation;
  currentUserId: string;
  members: Member[];
}

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function time(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function MessageThread({
  projectId,
  conversation,
  currentUserId,
  members,
}: MessageThreadProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch } =
    useMessages(projectId, conversation.id);
  const markRead = useMarkRead(projectId);

  // Mark read whenever this conversation opens.
  useEffect(() => {
    if (conversation.id) markRead.mutate(conversation.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  const userById = useMemo(() => {
    const m = new Map<string, Member>();
    for (const mem of members) m.set(mem.userId, mem);
    return m;
  }, [members]);

  // Pages are newest-first; flatten then reverse to render oldest→newest.
  const messages: Message[] = useMemo(
    () => (data?.pages.flatMap((p) => p.messages) ?? []).slice().reverse(),
    [data],
  );

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-3 p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 w-2/3 animate-pulse rounded-xl bg-secondary" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <p>Failed to load messages.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-3.5 p-4">
        {hasNextPage && (
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="mx-auto rounded-full border px-3.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary"
          >
            {isFetchingNextPage ? 'Loading…' : '↑ Load earlier'}
          </button>
        )}
        {messages.length === 0 && (
          <p className="mx-auto py-8 text-sm text-muted-foreground">No messages yet. Say hello 👋</p>
        )}
        {messages.map((msg) => {
          const mine = msg.senderId === currentUserId;
          const sender = userById.get(msg.senderId);
          const name = sender?.user.name ?? sender?.user.username ?? 'Unknown';
          if (mine) {
            return (
              <div key={msg.id} className="flex flex-col items-end">
                <div className="max-w-[78%] rounded-2xl bg-gradient-to-br from-primary to-neutral-700 px-3 py-2 text-sm text-primary-foreground shadow-sm">
                  {msg.body}
                </div>
                <span className="mt-1 text-[11px] text-muted-foreground">{time(msg.createdAt)}</span>
              </div>
            );
          }
          return (
            <div key={msg.id} className="flex items-start gap-2.5">
              <Avatar className="size-7 shrink-0">
                <AvatarFallback className="text-[11px]">{initials(name)}</AvatarFallback>
              </Avatar>
              <div className="flex max-w-[78%] flex-col items-start">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium">{name}</span>
                  <span className="text-[11px] text-muted-foreground">{time(msg.createdAt)}</span>
                </div>
                <div className="mt-0.5 rounded-2xl bg-secondary px-3 py-2 text-sm shadow-sm">
                  {msg.body}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
