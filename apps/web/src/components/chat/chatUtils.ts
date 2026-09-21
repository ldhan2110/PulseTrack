import type { Conversation, ChatUser } from '@/lib/types';

/** The other member of a DM (relative to the current user). */
export function peerOf(conv: Conversation, myId: string): ChatUser | null {
  const other = conv.members.find((m) => m.userId !== myId) ?? conv.members[0];
  return other?.user ?? null;
}

/** Display title: channels use their name, DMs use the peer's name. */
export function convTitle(conv: Conversation, myId: string): string {
  if (conv.type === 'CHANNEL') return conv.name ?? 'channel';
  const peer = peerOf(conv, myId);
  return peer?.name ?? peer?.username ?? 'Direct message';
}

export function initials(user: Pick<ChatUser, 'name' | 'username'>): string {
  const src = user.name ?? user.username ?? '?';
  return src
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
