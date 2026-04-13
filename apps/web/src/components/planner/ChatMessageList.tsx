import { useEffect, useRef } from 'react';
import type { PlannerMessage } from '@/lib/types';
import { ChatMessage, StreamingMessage, ThinkingIndicator } from './ChatMessage';
import { ChatActionSuggestion } from './ChatActionSuggestion';

interface ChatMessageListProps {
  messages: PlannerMessage[];
  streamingContent: string;
  isStreaming: boolean;
  suggestedAction: { type: string; reason: string } | null;
  onAcceptAction: (type: string) => void;
  onDismissAction: () => void;
}

export function ChatMessageList({
  messages, streamingContent, isStreaming, suggestedAction, onAcceptAction, onDismissAction,
}: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingContent, isStreaming]);

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {messages.length === 0 && !isStreaming && (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Start by describing your project requirements, or paste meeting notes and documents.
        </div>
      )}
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      {isStreaming && (
        streamingContent
          ? <StreamingMessage content={streamingContent} />
          : <ThinkingIndicator />
      )}
      {suggestedAction && (
        <ChatActionSuggestion
          type={suggestedAction.type}
          reason={suggestedAction.reason}
          onAccept={() => onAcceptAction(suggestedAction.type)}
          onDismiss={onDismissAction}
        />
      )}
      <div ref={bottomRef} />
    </div>
  );
}
