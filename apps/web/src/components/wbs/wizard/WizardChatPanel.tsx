import { useRef, useEffect, useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface WizardChatPanelProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function WizardChatPanel({ messages, onSend, isLoading }: WizardChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full border-l border-border">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold">Refine with AI</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-muted/30 text-foreground'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Thinking...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-2 border-t border-border p-3">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask AI to adjust..."
          disabled={isLoading}
          className="flex-1"
        />
        <Button
          type="button"
          size="icon"
          onClick={handleSend}
          disabled={isLoading || !inputValue.trim()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
