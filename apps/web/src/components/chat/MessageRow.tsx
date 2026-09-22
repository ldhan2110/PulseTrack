import { memo, useEffect, useState } from 'react';
import { Pencil, Trash2, RotateCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Message } from '@/lib/types';
import { MessageAttachment } from './MessageAttachment';
import { ReactionBar } from './ReactionBar';

const MENTION_RE = /@\[([^\]]+)\]\(([^)]+)\)/g;

/** Render @[Name](userId) tokens as colored bold text; plain text stays plain. */
function renderBody(body: string, myId: string) {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of body.matchAll(MENTION_RE)) {
    const [full, display, userId] = match;
    const idx = match.index ?? 0;
    if (idx > last) nodes.push(body.slice(last, idx));
    const isMe = userId === myId;
    nodes.push(
      <span
        key={key++}
        data-mention={isMe ? 'me' : 'other'}
        className={
          isMe
            ? 'font-semibold text-[oklch(0.45_0.17_250)]'
            : 'font-semibold text-[oklch(0.5_0.12_250)]'
        }
      >
        @{display}
      </span>,
    );
    last = idx + full.length;
  }
  if (last < body.length) nodes.push(body.slice(last));
  return nodes;
}

export interface RowProps {
  message: Message;
  own: boolean;
  isEditing: boolean;
  myId: string;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onCommitEdit: (id: string, body: string) => void;
  onRequestDelete: (id: string) => void;
  onRetry?: (m: Message) => void;
}

/** One message bubble. Memoized so only the changed row re-renders. */
export const MessageRow = memo(function MessageRow({
  message: m,
  own,
  isEditing,
  myId,
  onStartEdit,
  onCancelEdit,
  onCommitEdit,
  onRequestDelete,
  onRetry,
}: RowProps) {
  const mentionsMe = m.body
    ? [...m.body.matchAll(MENTION_RE)].some((x) => x[2] === myId)
    : false;
  // draft lives here → typing in the edit box no longer re-renders the thread
  const [draft, setDraft] = useState(m.body);
  useEffect(() => {
    if (isEditing) setDraft(m.body);
  }, [isEditing, m.body]);

  if (m.deletedAt) {
    return (
      <div
        className="rounded-xl bg-muted/50 px-3 py-2 text-sm italic text-muted-foreground"
        data-testid="deleted-placeholder"
      >
        {m.author?.name ?? m.author?.username ?? 'User'} has deleted this message
      </div>
    );
  }

  return (
    <div className="group/msg relative flex items-center gap-1">
      {own && !isEditing && (
        <div className="absolute -top-3 right-2 z-10 hidden rounded-md border bg-background shadow-sm group-hover/msg:flex">
          <button
            aria-label="Edit"
            className="rounded-l-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => onStartEdit(m.id)}
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            aria-label="Delete"
            className="rounded-r-md p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
            onClick={() => onRequestDelete(m.id)}
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
              onCommitEdit(m.id, draft.trim());
            } else if (e.key === 'Escape') {
              onCancelEdit();
            }
          }}
          onBlur={onCancelEdit}
          className="h-8 w-64"
        />
      ) : (
        <div className="flex flex-col gap-1">
          <div
            className={`rounded-xl px-3 py-2 text-sm ${
              own
                ? 'rounded-br-sm bg-primary text-primary-foreground'
                : 'rounded-bl-sm bg-muted'
            } ${mentionsMe ? 'border-l-[3px] border-l-[oklch(0.6_0.16_250)]' : ''} ${
              m.status === 'failed' ? 'opacity-60 ring-1 ring-destructive' : ''
            }`}
          >
            {m.body && (
              <div className="whitespace-pre-wrap">{renderBody(m.body, myId)}</div>
            )}
            {m.attachments && m.attachments.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {m.attachments.map((att) => (
                  <MessageAttachment key={att.id} attachment={att} own={own} />
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
            </div>
          </div>
          <ReactionBar message={m} myId={myId} convId={m.conversationId} />
        </div>
      )}
    </div>
  );
});
