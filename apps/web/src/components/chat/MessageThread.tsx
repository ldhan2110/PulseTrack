import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Hash, MoreVertical, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/auth/useAuth';
import {
  useMessages,
  useEditMessage,
  useDeleteMessage,
  useDeleteConversation,
  usePresence,
  useTyping,
} from '@/hooks/useChat';
import type { Conversation, Message } from '@/lib/types';
import { getChatSocket } from '@/socket/instance';
import { dayKey, groupMessages } from '@/lib/chatFormat';
import { Composer } from './Composer';
import { convTitle, initials, peerOf } from './chatUtils';
import { MessageGroup } from './MessageGroup';
import { MembersPanel } from './MembersPanel';

/** Three dots with a staggered bounce. */
function TypingDots() {
  return (
    <span className="inline-flex items-end gap-0.5">
      <span className="size-1 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
      <span className="size-1 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
      <span className="size-1 animate-bounce rounded-full bg-current" />
    </span>
  );
}

interface ViewProps {
  messages: Message[]; // chronological (oldest → newest)
  myId: string;
  onEdit?: (id: string, body: string) => void;
  onDelete?: (id: string) => void;
  onRetry?: (m: Message) => void;
}

/** Presentational thread body — grouped bubbles. Exported for unit tests. */
export function MessageThreadView({
  messages,
  myId,
  onEdit,
  onDelete,
  onRetry,
}: ViewProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const groups = useMemo(() => groupMessages(messages), [messages]);

  const onStartEdit = useCallback((id: string) => setEditingId(id), []);
  const onCancelEdit = useCallback(() => setEditingId(null), []);
  const onCommitEdit = useCallback(
    (id: string, body: string) => {
      onEdit?.(id, body);
      setEditingId(null);
    },
    [onEdit],
  );
  const onRequestDelete = useCallback((id: string) => setConfirmId(id), []);

  return (
    <div className="space-y-4">
      {groups.map((group, i) => {
        const first = group[0];
        const prev = groups[i - 1]?.[0];
        const showDay = !prev || dayKey(prev.createdAt) !== dayKey(first.createdAt);
        // pass editingId only to the group that owns the edited row → others memo-skip
        const editingInGroup = group.some((m) => m.id === editingId) ? editingId : null;
        return (
          <MessageGroup
            key={first.id}
            group={group}
            myId={myId}
            showDay={showDay}
            editingId={editingInGroup}
            onStartEdit={onStartEdit}
            onCancelEdit={onCancelEdit}
            onCommitEdit={onCommitEdit}
            onRequestDelete={onRequestDelete}
            onRetry={onRetry}
          />
        );
      })}

      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This message will be removed for everyone. This can&rsquo;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmId) onDelete?.(confirmId);
                setConfirmId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function MessageThread({ conversation }: { conversation: Conversation }) {
  const { user } = useAuth();
  const myId = user?.id ?? '';
  const convId = conversation.id;
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useMessages(convId);
  const edit = useEditMessage(convId);
  const del = useDeleteMessage(convId);
  const editMutate = edit.mutate;
  const delMutate = del.mutate;
  const handleEdit = useCallback(
    (id: string, body: string) => {
      if (body) editMutate({ id, body });
    },
    [editMutate],
  );
  const handleDelete = useCallback((id: string) => delMutate(id), [delMutate]);
  const deleteConv = useDeleteConversation();
  const [confirmDeleteConv, setConfirmDeleteConv] = useState(false);
  const presence = usePresence();
  const typing = useTyping(convId);
  const typer =
    typing && typing.userId !== myId
      ? conversation.members.find((mem) => mem.userId === typing.userId)?.user
      : null;
  const typerName = typer?.name ?? typer?.username ?? 'Someone';

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Join the conversation room so its live events reach this socket.
  // Re-join on reconnect (socket.io drops room membership on disconnect).
  useEffect(() => {
    const socket = getChatSocket();
    const join = () => socket.emit('chat:join', convId);
    join();
    socket.on('connect', join);
    return () => {
      socket.off('connect', join);
    };
  }, [convId]);

  // pages are newest-first; flatten and reverse to chronological order
  const messages: Message[] = useMemo(
    () => (data?.pages ?? []).flatMap((p) => p.items).slice().reverse(),
    [data],
  );

  // stick to bottom on new messages (not when prepending history)
  const lastId = messages[messages.length - 1]?.id;

  // opening/switching a thread should jump to the latest message; flag the
  // pending jump so it lands once the new conversation's messages render
  const pendingJump = useRef(true);
  useEffect(() => {
    pendingJump.current = true;
  }, [convId]);

  useEffect(() => {
    if (pendingJump.current) {
      if (!lastId) return; // messages not loaded yet — wait
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight; // instant, no animation
      pendingJump.current = false;
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [convId, lastId]);

  // infinite scroll upward — load older, preserve position
  function onScroll() {
    const el = scrollRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    if (el.scrollTop < 48) {
      const prevHeight = el.scrollHeight;
      void fetchNextPage().then(() => {
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop =
              scrollRef.current.scrollHeight - prevHeight;
          }
        });
      });
    }
  }

  const isChannel = conversation.type === 'CHANNEL';
  const peer = peerOf(conversation, myId);
  const online = peer ? presence[peer.id] : false;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        {isChannel ? (
          <Hash className="size-4 text-muted-foreground" />
        ) : (
          <span className="relative">
            <Avatar className="size-6">
              {peer?.imageUrl && <AvatarImage src={peer.imageUrl} />}
              <AvatarFallback className="text-[10px]">
                {peer ? initials(peer) : '?'}
              </AvatarFallback>
            </Avatar>
            <span
              className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background ${
                online ? 'bg-green-500' : 'bg-muted-foreground/40'
              }`}
            />
          </span>
        )}
        <span className="font-semibold">{convTitle(conversation, myId)}</span>
        {!isChannel && (
          <span className="text-xs text-muted-foreground">
            {online ? 'online' : 'offline'}
          </span>
        )}
        {isChannel && <MembersPanel conversation={conversation} myId={myId} />}
        {!isChannel && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto size-8 text-muted-foreground"
                aria-label="Conversation options"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem
                variant="destructive"
                className="whitespace-nowrap"
                onSelect={() => setConfirmDeleteConv(true)}
              >
                <Trash2 className="size-4" />
                Delete conversation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <AlertDialog
        open={confirmDeleteConv}
        onOpenChange={(o) => !o && setConfirmDeleteConv(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the conversation from your chat. The other person
              keeps it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteConv.isPending}
              onClick={(e) => {
                e.preventDefault();
                deleteConv.mutate(conversation.id, {
                  onSuccess: () => setConfirmDeleteConv(false),
                });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto p-4">
        {isFetchingNextPage && (
          <div className="pb-2 text-center text-xs text-muted-foreground">Loading older…</div>
        )}
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading messages…
          </div>
        ) : (
          <MessageThreadView
            messages={messages}
            myId={myId}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
        {typing && typing.userId !== myId && (
          <div className="flex items-center gap-1.5 px-1 pt-2 text-xs italic text-muted-foreground">
            <span>{typerName} is typing</span>
            <TypingDots />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <Composer
        conversationId={convId}
        unread={conversation.unreadCount ?? 0}
        members={isChannel ? conversation.members : []}
      />
    </div>
  );
}
