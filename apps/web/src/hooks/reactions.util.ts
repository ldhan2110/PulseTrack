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

/** Group a message's reactions by emoji, preserving first-seen order. */
export function groupReactions(reactions: MessageReaction[] = []) {
  const map = new Map<string, MessageReaction[]>();
  for (const r of reactions) {
    const rows = map.get(r.emoji);
    if (rows) rows.push(r);
    else map.set(r.emoji, [r]);
  }
  return [...map.entries()].map(([emoji, rows]) => ({ emoji, rows }));
}

/** Human list of who reacted, e.g. "you, Bo and Al". */
export function reactorNames(rows: MessageReaction[], myId: string) {
  const names = rows.map((r) => (r.userId === myId ? 'you' : r.user.name || r.user.username));
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
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
