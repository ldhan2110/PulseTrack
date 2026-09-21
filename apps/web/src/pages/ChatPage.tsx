import { useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { useChatSync } from '@/hooks/useChatSync';
import { useConversations } from '@/hooks/useChat';
import { useUiStore } from '@/store/uiStore';
import { ConversationList } from '@/components/chat/ConversationList';
import { MessageThread } from '@/components/chat/MessageThread';
import { NewConversationDialog } from '@/components/chat/NewConversationDialog';

export function ChatPage() {
  useChatSync();
  const activeId = useUiStore((s) => s.activeConversationId);
  const setFullWidth = useUiStore((s) => s.setFullWidth);

  useEffect(() => {
    setFullWidth(true);
    return () => setFullWidth(false);
  }, [setFullWidth]);

  const { data: conversations } = useConversations();
  const active = (conversations ?? []).find((c) => c.id === activeId) ?? null;

  return (
    <div className="flex h-full min-h-0 flex-1" data-testid="chat-page">
      <ConversationList />
      {active ? (
        <MessageThread key={active.id} conversation={active} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
          <MessageSquare className="size-8" />
          <p className="text-sm">Select a conversation or start a new one.</p>
        </div>
      )}
      <NewConversationDialog />
    </div>
  );
}
