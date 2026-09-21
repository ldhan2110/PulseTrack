import { useEffect } from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { getChatSocket } from '../socket/instance';
import {
  chatKeys,
  typingKey,
  applyIncoming,
  applyUpdated,
  applyDeleted,
} from './useChat';
import type { Conversation, Message, MessagePage } from '../lib/types';

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
      qc.setQueryData<Infinite>(chatKeys.messages(msg.conversationId), (d) =>
        applyIncoming(d, msg),
      );
      void qc.invalidateQueries({ queryKey: chatKeys.conversations });
    }

    function onUpdated(msg: Message) {
      qc.setQueryData<Infinite>(chatKeys.messages(msg.conversationId), (d) =>
        applyUpdated(d, msg),
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

    socket.on('chat:message:new', onNew);
    socket.on('chat:message:updated', onUpdated);
    socket.on('chat:message:deleted', onDeleted);
    socket.on('chat:typing', onTyping);
    socket.on('chat:presence', onPresence);
    socket.on('chat:read', onRead);
    socket.on('connect', onReconnect);

    return () => {
      socket.off('chat:message:new', onNew);
      socket.off('chat:message:updated', onUpdated);
      socket.off('chat:message:deleted', onDeleted);
      socket.off('chat:typing', onTyping);
      socket.off('chat:presence', onPresence);
      socket.off('chat:read', onRead);
      socket.off('connect', onReconnect);
    };
  }, [socket, qc]);
}
