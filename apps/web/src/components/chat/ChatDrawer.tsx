import { useEffect, useState } from 'react';
import { Hash, PenSquare, Users } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useConversations, useChatSocket, useOpenDirect, useSendMessage } from '@/hooks/useChat';
import { useMembers } from '@/hooks/useMembers';
import { useAuth } from '@/auth/useAuth';
import { ConversationList } from './ConversationList';
import { MessageThread } from './MessageThread';
import { Composer } from './Composer';
import { NewDmPicker } from './NewDmPicker';
import type { Conversation } from '@/lib/types';

interface ChatDrawerProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatDrawer({ projectId, open, onOpenChange }: ChatDrawerProps) {
  const { user } = useAuth();
  const currentUserId = user?.id ?? '';
  const { data: conversations = [] } = useConversations(projectId);
  const { data: members = [] } = useMembers(projectId);
  const openDirect = useOpenDirect(projectId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  useChatSocket(projectId);

  const sendMessage = useSendMessage(projectId, activeId);

  // Default to the project channel once conversations load.
  useEffect(() => {
    if (!activeId && conversations.length > 0) {
      const channel = conversations.find((c) => c.type === 'PROJECT');
      setActiveId(channel?.id ?? conversations[0].id);
    }
  }, [conversations, activeId]);

  const active: Conversation | undefined = conversations.find((c) => c.id === activeId);

  const threadTitle = (() => {
    if (!active) return '';
    if (active.type === 'PROJECT') return 'General';
    const other = active.members.find((m) => m.userId !== currentUserId);
    const mem = other ? members.find((m) => m.userId === other.userId) : undefined;
    return mem?.user.name ?? mem?.user.username ?? 'Direct message';
  })();

  const handlePick = (userId: string) => {
    openDirect.mutate(userId, {
      onSuccess: (convo) => {
        setActiveId(convo.id);
        setPicking(false);
      },
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[640px]">
        <SheetHeader className="flex-row items-center gap-2 border-b px-4 py-3.5 space-y-0">
          <SheetTitle className="flex items-center gap-1.5 text-base">
            <span aria-hidden>💬</span> Chat
          </SheetTitle>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="New direct message"
              onClick={() => setPicking((p) => !p)}
            >
              <PenSquare className="size-4" />
            </Button>
          </div>
        </SheetHeader>

        {picking ? (
          <NewDmPicker members={members} currentUserId={currentUserId} onPick={handlePick} />
        ) : (
          <div className="flex min-h-0 flex-1">
            <ConversationList
              conversations={conversations}
              activeId={activeId}
              currentUserId={currentUserId}
              members={members}
              onSelect={setActiveId}
            />
            <div className="flex min-w-0 flex-1 flex-col">
              {active ? (
                <>
                  <div className="flex items-center gap-2 border-b px-4 py-3">
                    {active.type === 'PROJECT' ? (
                      <Hash className="size-4 text-muted-foreground" />
                    ) : (
                      <Avatar className="size-6">
                        <AvatarFallback className="text-[10px]">
                          {threadTitle.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <span className="text-sm font-medium">{threadTitle}</span>
                    {active.type === 'PROJECT' && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="size-3" /> {members.length} members
                      </span>
                    )}
                  </div>
                  <MessageThread
                    projectId={projectId}
                    conversation={active}
                    currentUserId={currentUserId}
                    members={members}
                  />
                  <Composer
                    placeholder={`Message ${active.type === 'PROJECT' ? '#General' : threadTitle}`}
                    disabled={sendMessage.isPending}
                    onSend={(body) => sendMessage.mutate(body)}
                  />
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  Select a conversation
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
