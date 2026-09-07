import { useEffect, useRef } from 'react';
import type { PlannerMessage, PlannerScopeProposal } from '@/lib/types';
import { ChatMessage, StreamingMessage, ThinkingIndicator } from './ChatMessage';
import { ChatActionSuggestion } from './ChatActionSuggestion';

interface ChatMessageListProps {
  messages: PlannerMessage[];
  streamingContent: string;
  isStreaming: boolean;
  suggestedAction: { messageId: string; type: string; reason: string; proposal: PlannerScopeProposal } | null;
  onAcceptAction: (messageId: string, proposal: PlannerScopeProposal) => void;
  onDismissAction: (messageId: string) => void;
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
        <div key={msg.id} className="space-y-2">
          <ChatMessage message={msg} />
          {msg.proposalStatus === 'PENDING' && msg.proposal && (
            <ChatActionSuggestion type="scope_proposal" reason={`Proposed scope: ${msg.proposal.title}`} proposal={msg.proposal} onAccept={(proposal) => onAcceptAction(msg.id, proposal)} onDismiss={() => onDismissAction(msg.id)} />
          )}
        </div>
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
          proposal={suggestedAction.proposal}
          onAccept={(proposal) => onAcceptAction(suggestedAction.messageId, proposal)}
          onDismiss={() => onDismissAction(suggestedAction.messageId)}
        />
      )}
      <div ref={bottomRef} />
    </div>
  );
}
