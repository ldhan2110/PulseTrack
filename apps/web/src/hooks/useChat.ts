import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import type {
  Conversation,
  Message,
  MessagePage,
  ChatUser,
  CreateConversationPayload,
} from '../lib/types';

// ── query keys ──────────────────────────────────────────────────────────────
export const chatKeys = {
  conversations: ['chat', 'conversations'] as const,
  messages: (id: string) => ['chat', 'messages', id] as const,
  presence: ['chat', 'presence'] as const,
};

export const typingKey = (conversationId: string) =>
  ['chat', 'typing', conversationId] as const;

type Infinite = InfiniteData<MessagePage> | undefined;

// ── pure cache helpers (exported for unit tests + useChatSync) ────────────────

/** Total unread across conversations. */
export function deriveUnread(convos: Conversation[]): number {
  return convos.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
}

const hasId = (data: Infinite, id: string): boolean =>
  !!data?.pages.some((p) => p.items.some((m) => m.id === id));

/** Prepend an incoming message to the newest page, deduped by id. */
export function applyIncoming(data: Infinite, msg: Message): Infinite {
  if (!data || data.pages.length === 0) {
    return { pages: [{ items: [msg], nextCursor: null }], pageParams: [undefined] };
  }
  if (hasId(data, msg.id)) return data;
  const pages = data.pages.map((p, i) =>
    i === 0 ? { ...p, items: [msg, ...p.items] } : p,
  );
  return { ...data, pages };
}

/** Insert an optimistic (sending) message. */
export function applyOptimistic(data: Infinite, temp: Message): Infinite {
  return applyIncoming(data, temp);
}

/** Replace the optimistic temp with the server echo; falls back to insert. */
export function reconcile(data: Infinite, msg: Message): Infinite {
  if (!data) return applyIncoming(data, msg);
  let replaced = false;
  const pages = data.pages.map((p) => ({
    ...p,
    items: p.items.map((m) => {
      if (msg.clientTempId && m.clientTempId === msg.clientTempId) {
        replaced = true;
        return { ...msg, status: 'sent' as const };
      }
      return m;
    }),
  }));
  if (!replaced) return applyIncoming(data, msg);
  return { ...data, pages };
}

/** Replace a message body in place (edit). */
export function applyUpdated(data: Infinite, msg: Message): Infinite {
  if (!data) return data;
  const pages = data.pages.map((p) => ({
    ...p,
    items: p.items.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)),
  }));
  return { ...data, pages };
}

/** Mark a message soft-deleted (placeholder, no body). */
export function applyDeleted(data: Infinite, id: string): Infinite {
  if (!data) return data;
  const pages = data.pages.map((p) => ({
    ...p,
    items: p.items.map((m) =>
      m.id === id
        ? { ...m, deletedAt: new Date().toISOString(), body: '' }
        : m,
    ),
  }));
  return { ...data, pages };
}

/** Flag an optimistic message as failed. */
export function markFailed(data: Infinite, clientTempId: string): Infinite {
  if (!data) return data;
  const pages = data.pages.map((p) => ({
    ...p,
    items: p.items.map((m) =>
      m.clientTempId === clientTempId ? { ...m, status: 'failed' as const } : m,
    ),
  }));
  return { ...data, pages };
}

function authToChatUser(u: {
  id: string;
  username: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
}): ChatUser {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    name: u.name,
    imageUrl: u.imageUrl,
  };
}

// ── hooks ─────────────────────────────────────────────────────────────────────

export function useConversations() {
  return useQuery({
    queryKey: chatKeys.conversations,
    queryFn: () => api.getChatConversations(),
  });
}

/** Total unread badge count, derived from the conversation list. */
export function useChatUnread(): number {
  const { data } = useConversations();
  return deriveUnread(data ?? []);
}

export function useMessages(conversationId: string | null) {
  return useInfiniteQuery({
    queryKey: chatKeys.messages(conversationId ?? '__none__'),
    queryFn: ({ pageParam }) =>
      api.getChatMessages(conversationId as string, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!conversationId,
  });
}

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = chatKeys.messages(conversationId);

  return useMutation({
    mutationFn: (vars: { body: string; clientTempId: string }) =>
      api.sendChatMessage(conversationId, vars.body, vars.clientTempId),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<InfiniteData<MessagePage>>(key);
      if (user) {
        const temp: Message = {
          id: vars.clientTempId,
          clientTempId: vars.clientTempId,
          status: 'sending',
          conversationId,
          authorId: user.id,
          author: authToChatUser(user),
          body: vars.body,
          editedAt: null,
          deletedAt: null,
          createdAt: new Date().toISOString(),
          attachments: [],
        };
        qc.setQueryData<Infinite>(key, (d) => applyOptimistic(d, temp));
      }
      return { prev };
    },
    onError: (err, vars, ctx) => {
      qc.setQueryData<Infinite>(key, (d) => markFailed(d, vars.clientTempId));
      toast.error(err instanceof Error ? err.message : 'Failed to send message');
      void ctx;
    },
    onSuccess: (msg, vars) => {
      qc.setQueryData<Infinite>(key, (d) =>
        reconcile(d, { ...msg, clientTempId: vars.clientTempId }),
      );
      void qc.invalidateQueries({ queryKey: chatKeys.conversations });
    },
  });
}

export function useEditMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: string }) =>
      api.editChatMessage(vars.id, vars.body),
    onSuccess: (msg) => {
      qc.setQueryData<Infinite>(chatKeys.messages(conversationId), (d) =>
        applyUpdated(d, msg),
      );
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to edit message'),
  });
}

export function useDeleteMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteChatMessage(id),
    onSuccess: (res) => {
      qc.setQueryData<Infinite>(chatKeys.messages(conversationId), (d) =>
        applyDeleted(d, res.id),
      );
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to delete message'),
  });
}

export function useMarkChatRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => api.markChatRead(conversationId),
    onSuccess: (res) => {
      qc.setQueryData<Conversation[]>(chatKeys.conversations, (list) =>
        list?.map((c) =>
          c.id === res.conversationId ? { ...c, unreadCount: 0 } : c,
        ),
      );
    },
  });
}

export function useSearchChatTargets(query: string) {
  return useQuery({
    queryKey: ['chat', 'search', query],
    queryFn: () => api.searchChatTargets(query),
    enabled: query.trim().length > 0,
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateConversationPayload) =>
      api.createChatConversation(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chatKeys.conversations });
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : 'Failed to start conversation',
      ),
  });
}
