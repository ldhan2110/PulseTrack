import { lazy, Suspense, useRef, useState } from 'react';
import { Smile, Image as ImageIcon, Paperclip, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { getChatSocket } from '@/socket/instance';
import { useSendMessage, useMarkChatRead, chatKeys } from '@/hooks/useChat';
import { initials } from './chatUtils';
import type { ConversationMember, Message } from '@/lib/types';

const EmojiPicker = lazy(() => import('./EmojiPickerLazy'));

/** Match a mention being typed: `@query` at start or after whitespace, up to the caret. */
function activeMention(value: string, caret: number): { query: string; start: number } | null {
  const upto = value.slice(0, caret);
  const m = upto.match(/(?:^|\s)@([^\s@]*)$/);
  if (!m) return null;
  return { query: m[1], start: caret - m[1].length - 1 };
}

export function Composer({
  conversationId,
  unread = 0,
  members = [],
  replyTarget = null,
  onCancelReply,
}: {
  conversationId: string;
  unread?: number;
  members?: ConversationMember[];
  replyTarget?: Message | null;
  onCancelReply?: () => void;
}) {
  const [text, setText] = useState('');
  const [pending, setPending] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const send = useSendMessage(conversationId);
  const markRead = useMarkChatRead();
  const qc = useQueryClient();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<number | undefined>(undefined);
  const sendingRef = useRef(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // @mention autocomplete
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [highlight, setHighlight] = useState(0);
  const picked = useRef<{ display: string; userId: string }[]>([]);

  const matches = mention
    ? members
        .filter((m) => {
          const q = mention.query.toLowerCase();
          return (
            (m.user.name ?? '').toLowerCase().includes(q) ||
            m.user.username.toLowerCase().includes(q)
          );
        })
        .slice(0, 8)
    : [];
  const pickerOpen = mention !== null && matches.length > 0;

  function autoGrow() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  function onChangeText(value: string, caret: number) {
    setText(value);
    autoGrow();
    emitTyping();
    const m = activeMention(value, caret);
    setMention(m);
    setHighlight(0);
  }

  function selectMention(member: ConversationMember) {
    if (!mention) return;
    const display = member.user.name ?? member.user.username;
    const caret = taRef.current?.selectionStart ?? text.length;
    const before = text.slice(0, mention.start);
    const after = text.slice(caret);
    const next = `${before}@${display} ${after}`;
    picked.current.push({ display, userId: member.userId });
    setText(next);
    setMention(null);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (el) {
        const pos = before.length + display.length + 2; // "@" + display + " "
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    });
  }

  /** Serialize picked mentions still present as plain @Display into @[Display](userId) tokens. */
  function serialize(body: string): string {
    let out = body;
    for (const p of picked.current) {
      out = out.replace(`@${p.display}`, `@[${p.display}](${p.userId})`);
    }
    return out;
  }

  function emitTyping() {
    if (typingTimer.current) return; // debounce: at most one emit / 1.5s
    getChatSocket().emit('chat:typing', conversationId);
    typingTimer.current = window.setTimeout(() => {
      typingTimer.current = undefined;
    }, 1500);
  }

  async function handleSend() {
    if (sendingRef.current) return; // guard rapid double-fire (key repeat, stale closure)
    const body = text.trim();
    if (!body && pending.length === 0) return;
    sendingRef.current = true;
    setText('');
    if (taRef.current) taRef.current.style.height = 'auto'; // shrink back after send
    const files = pending;
    setPending([]);
    try {
      if (body) {
        send.mutate({
          body: serialize(body),
          clientTempId: crypto.randomUUID(),
          replyToId: replyTarget?.id,
          replyTo: replyTarget
            ? {
                id: replyTarget.id,
                body: replyTarget.body,
                deletedAt: replyTarget.deletedAt,
                author: replyTarget.author,
              }
            : null,
        });
        picked.current = [];
        onCancelReply?.();
      }
      // attachments upload as their own messages (backend emits chat:message:new)
      for (const file of files) {
        try {
          await api.uploadChatAttachment(conversationId, file);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Upload failed');
        }
      }
      if (files.length) {
        void qc.invalidateQueries({ queryKey: chatKeys.messages(conversationId) });
        void qc.invalidateQueries({ queryKey: chatKeys.conversations });
      }
    } finally {
      sendingRef.current = false;
    }
  }

  function addFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    if (arr.length) setPending((p) => [...p, ...arr]);
  }

  function onPaste(e: React.ClipboardEvent) {
    const imgs = Array.from(e.clipboardData.files).filter((f) =>
      f.type.startsWith('image/'),
    );
    if (imgs.length) {
      e.preventDefault();
      addFiles(imgs);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  return (
    <div
      className="border-t p-3"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {pending.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {pending.map((f, i) => (
            <div key={i} className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
              <span className="max-w-[140px] truncate">{f.name}</span>
              <button
                onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Remove attachment"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {replyTarget && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border-l-2 border-primary/50 bg-muted px-3 py-1.5 text-xs">
          <span className="shrink-0 text-muted-foreground">Replying to</span>
          <span className="shrink-0 font-semibold text-primary">
            {replyTarget.author?.name ?? replyTarget.author?.username ?? 'User'}
          </span>
          <span className="flex-1 truncate text-muted-foreground">
            {replyTarget.body.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, '@$1')}
          </span>
          <button
            type="button"
            onClick={() => onCancelReply?.()}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Cancel reply"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
      <div
        className={`relative flex items-end gap-1 rounded-2xl border bg-background px-2 py-1 ${
          dragOver ? 'ring-2 ring-primary' : ''
        }`}
      >
        {mention && (
          <div className="absolute bottom-full left-0 z-20 mb-2 w-64 overflow-hidden rounded-lg border bg-popover shadow-md">
            <p className="border-b px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Members
            </p>
            {matches.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                No members match “{mention.query}”
              </p>
            ) : (
              <div className="max-h-56 overflow-y-auto py-1">
                {matches.map((m, i) => (
                  <button
                    key={m.userId}
                    type="button"
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => selectMention(m)}
                    className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm ${
                      i === highlight ? 'bg-accent' : ''
                    }`}
                  >
                    <Avatar className="size-6">
                      {m.user.imageUrl && <AvatarImage src={m.user.imageUrl} />}
                      <AvatarFallback className="text-[10px]">{initials(m.user)}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate">{m.user.name ?? m.user.username}</span>
                    <span className="truncate text-xs text-muted-foreground">@{m.user.username}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <textarea
          ref={taRef}
          value={text}
          rows={1}
          onFocus={() => {
            if (unread) markRead.mutate(conversationId);
          }}
          onChange={(e) => onChangeText(e.target.value, e.target.selectionStart ?? e.target.value.length)}
          onKeyDown={(e) => {
            if (pickerOpen) {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlight((h) => (h + 1) % matches.length);
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlight((h) => (h - 1 + matches.length) % matches.length);
                return;
              }
              if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                selectMention(matches[highlight]);
                return;
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setMention(null);
                return;
              }
            }
            if (e.key === 'Escape' && replyTarget) {
              e.preventDefault();
              onCancelReply?.();
              return;
            }
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              !e.repeat &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              void handleSend();
            }
          }}
          onPaste={onPaste}
          placeholder="Type a message… (Shift+Enter for new line)"
          className="flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none max-h-32"
        />

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Emoji">
              <Smile className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto border-0 p-0">
            <Suspense fallback={<div className="p-4 text-xs text-muted-foreground">Loading…</div>}>
              <EmojiPicker
                previewPosition="none"
                onEmojiSelect={(e: { native: string }) =>
                  setText((t) => t + e.native)
                }
              />
            </Suspense>
          </PopoverContent>
        </Popover>

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label="Attach image"
          onClick={() => imageInputRef.current?.click()}
        >
          <ImageIcon className="size-4" />
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label="Attach file"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="size-4" />
        </Button>

        {(text.trim() || pending.length > 0) && (
          <Button
            size="icon"
            className="size-8 shrink-0 rounded-full"
            aria-label="Send"
            onClick={() => void handleSend()}
          >
            <Send className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
