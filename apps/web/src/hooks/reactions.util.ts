import type { InfiniteData } from '@tanstack/react-query';
import type { MessagePage, MessageReaction, ChatUser } from '../lib/types';

type Infinite = InfiniteData<MessagePage>;

function mapMessage(
  data: Infinite,
  messageId: string,
  fn: (rx: MessageReaction[]) => MessageReaction[],
): Infinite {
  let changed = false;
  const pages = data.pages.map((p) => {
    if (!p.items.some((m) => m.id === messageId)) return p;
    changed = true;
    return {
      ...p,
      items: p.items.map((m) =>
        m.id === messageId ? { ...m, reactions: fn(m.reactions ?? []) } : m,
      ),
    };
  });
  if (!changed) return data;
  return { ...data, pages };
}

export function upsertReactions(
  data: Infinite,
  messageId: string,
  reactions: MessageReaction[],
): Infinite {
  return mapMessage(data, messageId, () => reactions);
}

/** Optimistic local toggle for the current user; server broadcast reconciles. */
export function toggleReactionLocal(
  data: Infinite,
  messageId: string,
  emoji: string,
  user: ChatUser,
): Infinite {
  return mapMessage(data, messageId, (rx) => {
    const mine = rx.find((r) => r.userId === user.id && r.emoji === emoji);
    if (mine) return rx.filter((r) => r !== mine);
    return [
      ...rx,
      { id: `tmp-${emoji}-${user.id}`, messageId, emoji, userId: user.id, user },
    ];
  });
}
