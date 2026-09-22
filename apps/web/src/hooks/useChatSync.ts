import { useEffect } from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { getChatSocket } from '../socket/instance';
import {
  chatKeys,
  typingKey,
  reconcile,
  applyUpdated,
  applyDeleted,
} from './useChat';
import { upsertReactions } from './reactions.util';
import type { Conversation, Message, MessagePage, MessageReaction } from '../lib/types';

type Infinite = InfiniteData<MessagePage> | undefined;

/**
 * Mounted at the chat page. Owns the `/chat` socket lifecycle (connect +
 * reconnect on Keycloak token refresh, mirroring SocketProvider) and pushes
 * live events into the react-query cache so the UI updates without refetching.
 */
export function useChatSync() {
  const qc = useQueryClient();
  const { token } = useAuth();
  const socket = getChatSocket();

  // Connection + token refresh (mirror SocketProvider.tsx).
  useEffect(() => {
    if (!token) return;
    socket.auth = { token };
    if (socket.connected) {
      socket.disconnect().connect();
    } else {
      socket.connect();
    }
    return () => {
      socket.disconnect();
    };
  }, [socket, token]);

  // Live cache sync.
  useEffect(() => {
    if (!socket) return;

    function onNew(msg: Message) {
      // reconcile (not applyIncoming): replaces the sender's optimistic temp by
      // clientTempId; for other members it has no match and simply inserts.
      qc.setQueryData<Infinite>(chatKeys.messages(msg.conversationId), (d) =>
        reconcile(d, msg),
      );
      // the sender's message just arrived → they stopped typing; clear the dots
      qc.setQueryData(typingKey(msg.conversationId), (cur) =>
        cur && (cur as { userId: string }).userId === msg.authorId ? null : cur,
      );
      void qc.invalidateQueries({ queryKey: chatKeys.conversations });
    }

    function onUpdated(msg: Message) {
      qc.setQueryData<Infinite>(chatKeys.messages(msg.conversationId), (d) =>
        applyUpdated(d, msg),
      );
    }

    function onReaction(payload: { messageId: string; reactions: MessageReaction[] }) {
      // no conversationId on this payload, unlike onUpdated/onDeleted — apply across
      // all messages caches; upsertReactions is a no-op for pages that don't contain it.
      qc.setQueriesData<Infinite>({ queryKey: ['chat', 'messages'] }, (d) =>
        d ? upsertReactions(d, payload.messageId, payload.reactions) : d,
      );
    }

    function onDeleted(payload: { id: string; conversationId: string }) {
      qc.setQueryData<Infinite>(chatKeys.messages(payload.conversationId), (d) =>
        applyDeleted(d, payload.id),
      );
    }

    function onTyping(payload: { conversationId: string; userId: string }) {
      qc.setQueryData(typingKey(payload.conversationId), {
        userId: payload.userId,
        at: Date.now(),
      });
      // clear the indicator after a quiet window
      window.setTimeout(() => {
        qc.setQueryData(typingKey(payload.conversationId), (cur) =>
          cur && (cur as { at: number }).at + 2900 <= Date.now() ? null : cur,
        );
      }, 3000);
    }

    function onPresence(payload: { userId: string; online: boolean }) {
      qc.setQueryData<Record<string, boolean>>(chatKeys.presence, (m) => ({
        ...(m ?? {}),
        [payload.userId]: payload.online,
      }));
    }

    // Full online set sent on (re)connect — replace the map so stale entries clear.
    function onPresenceSnapshot(userIds: string[]) {
      qc.setQueryData<Record<string, boolean>>(
        chatKeys.presence,
        Object.fromEntries(userIds.map((id) => [id, true])),
      );
    }

    function onRead(payload: {
      conversationId: string;
      userId: string;
      lastReadAt: string;
    }) {
      qc.setQueryData<Conversation[]>(chatKeys.conversations, (list) =>
        list?.map((c) =>
          c.id === payload.conversationId
            ? {
                ...c,
                members: c.members.map((mem) =>
                  mem.userId === payload.userId
                    ? { ...mem, lastReadAt: payload.lastReadAt }
                    : mem,
                ),
              }
            : c,
        ),
      );
    }

    function onReconnect() {
      void qc.invalidateQueries({ queryKey: ['chat'] });
    }

    // Membership changes (added/removed to a channel, or its roster changed) →
    // refresh the conversation list. Reuses the existing invalidation pattern.
    function onMembershipChanged() {
      void qc.invalidateQueries({ queryKey: chatKeys.conversations });
    }

    function onMention(payload: {
      conversationId: string;
      from: { id: string; name: string | null };
      preview: string;
    }) {
      toast(`${payload.from.name ?? 'Someone'} mentioned you`, {
        description: payload.preview,
      });
    }

    socket.on('chat:message:new', onNew);
    socket.on('chat:message:updated', onUpdated);
    socket.on('chat:message:deleted', onDeleted);
    socket.on('chat:message:reaction', onReaction);
    socket.on('chat:typing', onTyping);
    socket.on('chat:presence', onPresence);
    socket.on('chat:presence:snapshot', onPresenceSnapshot);
    socket.on('chat:read', onRead);
    socket.on('chat:conversation:added', onMembershipChanged);
    socket.on('chat:conversation:removed', onMembershipChanged);
    socket.on('chat:members:changed', onMembershipChanged);
    socket.on('chat:mention', onMention);
    socket.on('connect', onReconnect);

    return () => {
      socket.off('chat:message:new', onNew);
      socket.off('chat:message:updated', onUpdated);
      socket.off('chat:message:deleted', onDeleted);
      socket.off('chat:message:reaction', onReaction);
      socket.off('chat:typing', onTyping);
      socket.off('chat:presence', onPresence);
      socket.off('chat:presence:snapshot', onPresenceSnapshot);
      socket.off('chat:read', onRead);
      socket.off('chat:conversation:added', onMembershipChanged);
      socket.off('chat:conversation:removed', onMembershipChanged);
      socket.off('chat:members:changed', onMembershipChanged);
      socket.off('chat:mention', onMention);
      socket.off('connect', onReconnect);
    };
  }, [socket, qc]);
}
