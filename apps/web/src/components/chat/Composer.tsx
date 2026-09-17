import { useState, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface ComposerProps {
  placeholder: string;
  disabled?: boolean;
  onSend: (body: string) => void;
}

export function Composer({ placeholder, disabled, onSend }: ComposerProps) {
  const [value, setValue] = useState('');
  const canSend = value.trim().length > 0 && !disabled;

  const send = () => {
    if (!canSend) return;
    onSend(value.trim());
    setValue('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex items-end gap-2 border-t bg-gradient-to-t from-background to-card p-3">
      <div className="flex flex-1 items-end rounded-xl border bg-background px-3 py-1 transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/15">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={1}
          className="max-h-[100px] min-h-6 resize-none border-0 bg-transparent px-0 py-1.5 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </div>
      <Button
        type="button"
        size="icon"
        disabled={!canSend}
        onClick={send}
        aria-label="Send message"
        className="size-9 rounded-xl bg-gradient-to-br from-primary to-neutral-700 shadow-md"
      >
        <Send className="size-4" />
      </Button>
    </div>
  );
}
