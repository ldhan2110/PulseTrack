import { useState, useCallback } from 'react';
import type { PlannerMessage } from '@/lib/types';
import { useSendPlannerMessage } from '@/hooks/usePlanner';
import { usePlannerSSE } from '@/hooks/usePlannerSSE';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';

interface PlannerChatPanelProps {
  sessionId: string;
  messages: PlannerMessage[];
}

export function PlannerChatPanel({ sessionId, messages }: PlannerChatPanelProps) {
  const [streamingContent, setStreamingContent] = useState('');
  const [suggestedAction, setSuggestedAction] = useState<{ type: string; reason: string } | null>(null);
  const sendMessage = useSendPlannerMessage(sessionId);
  const { connect, isStreaming } = usePlannerSSE(sessionId);

  const handleSend = useCallback(
    async (content: string, files: File[]) => {
      setStreamingContent('');
      setSuggestedAction(null);

      const result = await sendMessage.mutateAsync({ content, files });

      connect(result.streamToken, {
        onToken: (text) => setStreamingContent((prev) => prev + text),
        onMessageComplete: () => setStreamingContent(''),
        onScopeAdded: () => {},
        onScopeUpdated: () => {},
        onFeatureAdded: () => {},
        onFeatureUpdated: () => {},
        onActionSuggested: (data) => setSuggestedAction(data),
        onError: () => setStreamingContent(''),
        onDone: () => setStreamingContent(''),
      });
    },
    [sendMessage, connect],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Chat
        </span>
      </div>
      <ChatMessageList
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
        suggestedAction={suggestedAction}
        onAcceptAction={() => setSuggestedAction(null)}
        onDismissAction={() => setSuggestedAction(null)}
      />
      <ChatInput onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}
