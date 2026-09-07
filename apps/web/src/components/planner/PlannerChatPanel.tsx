import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PlannerMessage, PlannerScopeProposal } from '@/lib/types';
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
  const [suggestedAction, setSuggestedAction] = useState<{ messageId: string; type: string; reason: string; proposal: PlannerScopeProposal } | null>(null);
  const queryClient = useQueryClient();
  const sendMessage = useSendPlannerMessage(sessionId);
  const { connect, isStreaming } = usePlannerSSE(sessionId);

  const isBusy = isStreaming || sendMessage.isPending;

  const handleSend = useCallback(
    async (content: string, files: File[]) => {
      if (sendMessage.isPending || isStreaming) return;

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
    [sendMessage, connect, isStreaming],
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
        isStreaming={isBusy}
        suggestedAction={suggestedAction}
        onAcceptAction={async (messageId, proposal) => {
          await api.acceptPlannerProposal(messageId, proposal);
          if (suggestedAction?.messageId === messageId) setSuggestedAction(null);
          await Promise.all([queryClient.invalidateQueries({ queryKey: ['planner-messages', sessionId] }), queryClient.invalidateQueries({ queryKey: ['planner-scopes', sessionId] })]);
        }}
        onDismissAction={async (messageId) => {
          await api.dismissPlannerProposal(messageId);
          if (suggestedAction?.messageId === messageId) setSuggestedAction(null);
          await queryClient.invalidateQueries({ queryKey: ['planner-messages', sessionId] });
        }}
      />
      <ChatInput onSend={handleSend} disabled={isBusy} />
    </div>
  );
}
