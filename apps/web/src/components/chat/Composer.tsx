import { useRef, useState } from 'react';
import { Smile, Image as ImageIcon, Paperclip, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { getChatSocket } from '@/socket/instance';
import { useSendMessage, chatKeys } from '@/hooks/useChat';

const EMOJIS = ['😀', '😂', '😅', '👍', '🙏', '🎉', '❤️', '🔥', '✅', '👀'];

export function Composer({ conversationId }: { conversationId: string }) {
  const [text, setText] = useState('');
  const [pending, setPending] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const send = useSendMessage(conversationId);
  const qc = useQueryClient();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<number | undefined>(undefined);
  const sendingRef = useRef(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  function autoGrow() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
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
        send.mutate({ body, clientTempId: crypto.randomUUID() });
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
      <div
        className={`flex items-end gap-1 rounded-2xl border bg-background px-2 py-1 ${
          dragOver ? 'ring-2 ring-primary' : ''
        }`}
      >
        <textarea
          ref={taRef}
          value={text}
          rows={1}
          onChange={(e) => {
            setText(e.target.value);
            autoGrow();
            emitTyping();
          }}
          onKeyDown={(e) => {
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
          <PopoverContent className="w-auto p-2">
            <div className="grid grid-cols-5 gap-1">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  className="rounded p-1 text-lg hover:bg-accent"
                  onClick={() => setText((t) => t + e)}
                >
                  {e}
                </button>
              ))}
            </div>
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
