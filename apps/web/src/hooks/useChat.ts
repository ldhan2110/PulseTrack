import { useEffect } from 'react';
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useSocket } from '../socket/useSocket';
import type { Conversation, Message } from '../lib/types';

export function useConversations(projectId: string) {
  return useQuery({
    queryKey: ['chat', 'conversations', projectId],
    queryFn: () => api.chat.listConversations(projectId),
    enabled: !!projectId,
  });
}

export function useMessages(projectId: string, conversationId: string | null) {
  return useInfiniteQuery({
    queryKey: ['chat', 'messages', projectId, conversationId],
    queryFn: ({ pageParam }) =>
      api.chat.getMessages(projectId, conversationId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!projectId && !!conversationId,
  });
}

export function useSendMessage(projectId: string, conversationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      api.chat.sendMessage(projectId, conversationId!, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['chat', 'messages', projectId, conversationId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['chat', 'conversations', projectId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send message');
    },
  });
}

export function useMarkRead(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => api.chat.markRead(projectId, conversationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['chat', 'conversations', projectId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to mark read');
    },
  });
}

type MessagePages =
  | { pages: { messages: Message[]; nextCursor: string | null }[]; pageParams: unknown[] }
  | undefined;

// Prepend a live message to the newest-first first page; idempotent by id.
export function mergeIncomingMessage(old: MessagePages, message: Message): MessagePages {
  if (!old) return old;
  if (old.pages[0]?.messages.some((m) => m.id === message.id)) return old;
  const pages = old.pages.map((p, i) =>
    i === 0 ? { ...p, messages: [message, ...p.messages] } : p,
  );
  return { ...old, pages };
}

export function bumpUnread(
  old: Conversation[] | undefined,
  conversationId: string,
): Conversation[] | undefined {
  return old?.map((c) =>
    c.id === conversationId ? { ...c, unreadCount: c.unreadCount + 1 } : c,
  );
}

// Live delivery: join the project room, push chat:new into the messages cache
// and bump the unread count in the conversation list.
export function useChatSocket(projectId: string) {
  const socket = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket || !projectId) return;
    socket.emit('chat:join-project', projectId);

    const onNew = (message: Message) => {
      queryClient.setQueryData(
        ['chat', 'messages', projectId, message.conversationId],
        (old: MessagePages) => mergeIncomingMessage(old, message),
      );
      queryClient.setQueryData(
        ['chat', 'conversations', projectId],
        (old: Conversation[] | undefined) => bumpUnread(old, message.conversationId),
      );
    };

    socket.on('chat:new', onNew);
    return () => {
      socket.off('chat:new', onNew);
    };
  }, [socket, projectId, queryClient]);
}

export function useOpenDirect(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.chat.openDirect(projectId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['chat', 'conversations', projectId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to open conversation');
    },
  });
}
