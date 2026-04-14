import { Bot } from 'lucide-react';
import type { PlannerMessage } from '@/lib/types';
import { ChatAttachment } from './ChatAttachment';

interface ChatMessageProps {
  message: PlannerMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'USER';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
          isUser
            ? 'rounded-br-sm bg-primary text-primary-foreground'
            : 'rounded-bl-sm bg-muted'
        }`}
      >
        {!isUser && (
          <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-primary/70">
            <Bot className="size-3" />
            AI Assistant
          </div>
        )}
        <div className="whitespace-pre-wrap">{message.content}</div>
        {message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.attachments.map((att) => (
              <ChatAttachment key={att.id} attachment={att} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface StreamingMessageProps {
  content: string;
}

export function StreamingMessage({ content }: StreamingMessageProps) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-xl rounded-bl-sm bg-muted px-3 py-2 text-sm">
        <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-primary/70">
          <Bot className="size-3" />
          AI Assistant
        </div>
        <div className="whitespace-pre-wrap">
          {content}
          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-foreground/70" />
        </div>
      </div>
    </div>
  );
}

export function ThinkingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-xl rounded-bl-sm bg-muted px-3 py-2 text-sm">
        <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-primary/70">
          <Bot className="size-3" />
          AI Assistant
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="inline-block size-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
          <span className="inline-block size-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
          <span className="inline-block size-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
          <span className="ml-1.5 text-xs">Thinking...</span>
        </div>
      </div>
    </div>
  );
}
