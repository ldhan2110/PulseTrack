import { useEffect, useRef, useState } from 'react';
import { Hash, Pencil, Trash2, Check, CheckCheck, RotateCw } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/auth/useAuth';
import {
  useMessages,
  useEditMessage,
  useDeleteMessage,
} from '@/hooks/useChat';
import type { Conversation, Message } from '@/lib/types';
import { Composer } from './Composer';
import { MessageAttachment } from './MessageAttachment';
import { convTitle, initials, peerOf, usePresence, useTyping } from './chatUtils';

const GROUP_WINDOW_MS = 5 * 60 * 1000;

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Consecutive same-author messages within the window form one group. */
function groupMessages(messages: Message[]): Message[][] {
  const groups: Message[][] = [];
  for (const m of messages) {
    const last = groups[groups.length - 1];
    const prev = last?.[last.length - 1];
    if (
      prev &&
      prev.authorId === m.authorId &&
      new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() <
        GROUP_WINDOW_MS
    ) {
      last.push(m);
    } else {
      groups.push([m]);
    }
  }
  return groups;
}

interface ViewProps {
  messages: Message[]; // chronological (oldest → newest)
  myId: string;
  peerLastReadAt?: string | null;
  onEdit?: (id: string, body: string) => void;
  onDelete?: (id: string) => void;
  onRetry?: (m: Message) => void;
}

/** Presentational thread body — grouped bubbles. Exported for unit tests. */
export function MessageThreadView({
  messages,
  myId,
  peerLastReadAt,
  onEdit,
  onDelete,
  onRetry,
}: ViewProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const groups = groupMessages(messages);

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const first = group[0];
        const own = first.authorId === myId;
        return (
          <div
            key={first.id}
            className={`flex gap-2 ${own ? 'flex-row-reverse' : 'flex-row'}`}
          >
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

              {group.map((m) => {
                const isEditing = editingId === m.id;
                if (m.deletedAt) {
                  return (
                    <div
                      key={m.id}
                      className="rounded-xl bg-muted/50 px-3 py-2 text-sm italic text-muted-foreground"
                      data-testid="deleted-placeholder"
                    >
                      message deleted
                    </div>
                  );
                }
                return (
                  <div key={m.id} className="group/msg relative flex items-center gap-1">
                    {own && !isEditing && (
                      <div className="flex opacity-0 transition group-hover/msg:opacity-100">
                        <button
                          aria-label="Edit"
                          className="rounded p-1 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setEditingId(m.id);
                            setDraft(m.body);
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          aria-label="Delete"
                          className="rounded p-1 text-muted-foreground hover:text-destructive"
                          onClick={() => onDelete?.(m.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    )}
                    {isEditing ? (
                      <Input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onEdit?.(m.id, draft.trim());
                            setEditingId(null);
                          } else if (e.key === 'Escape') {
                            setEditingId(null);
                          }
                        }}
                        onBlur={() => setEditingId(null)}
                        className="h-8 w-64"
                      />
                    ) : (
                      <div
                        className={`rounded-xl px-3 py-2 text-sm ${
                          own
                            ? 'rounded-br-sm bg-primary text-primary-foreground'
                            : 'rounded-bl-sm bg-muted'
                        } ${m.status === 'failed' ? 'opacity-60 ring-1 ring-destructive' : ''}`}
                      >
                        {m.body && <div className="whitespace-pre-wrap">{m.body}</div>}
                        {m.attachments && m.attachments.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {m.attachments.map((att) => (
                              <MessageAttachment key={att.id} attachment={att} />
                            ))}
                          </div>
                        )}
                        <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] opacity-70">
                          {m.editedAt && <span>edited</span>}
                          {own && m.status === 'sending' && <span>sending…</span>}
                          {own && m.status === 'failed' && (
                            <button
                              className="flex items-center gap-0.5 text-destructive"
                              onClick={() => onRetry?.(m)}
                            >
                              <RotateCw className="size-3" /> retry
                            </button>
                          )}
                          {own && m.status !== 'sending' && m.status !== 'failed' && (
                            peerLastReadAt && peerLastReadAt >= m.createdAt ? (
                              <CheckCheck className="size-3" />
                            ) : (
                              <Check className="size-3" />
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
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
  const presence = usePresence();
  const typing = useTyping(convId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // pages are newest-first; flatten and reverse to chronological order
  const messages: Message[] = (data?.pages ?? [])
    .flatMap((p) => p.items)
    .slice()
    .reverse();

  // stick to bottom on new messages (not when prepending history)
  const lastId = messages[messages.length - 1]?.id;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lastId]);

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
  const peerMember = conversation.members.find((m) => m.userId !== myId);

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
      </div>

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
            peerLastReadAt={peerMember?.lastReadAt}
            onEdit={(id, body) => body && edit.mutate({ id, body })}
            onDelete={(id) => del.mutate(id)}
          />
        )}
        {typing && typing.userId !== myId && (
          <div className="px-1 pt-2 text-xs italic text-muted-foreground">typing…</div>
        )}
        <div ref={bottomRef} />
      </div>

      <Composer conversationId={convId} />
    </div>
  );
}
