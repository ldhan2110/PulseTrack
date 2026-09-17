import { describe, it, expect } from 'vitest';
import { mergeIncomingMessage, bumpUnread } from './useChat';
import type { Conversation, Message } from '../lib/types';

const msg = (id: string, conversationId = 'c1'): Message => ({
  id,
  conversationId,
  senderId: 'u2',
  body: 'hi',
  createdAt: new Date().toISOString(),
});

describe('mergeIncomingMessage', () => {
  it('prepends a new message to the first (newest-first) page', () => {
    const old = { pages: [{ messages: [msg('m1')], nextCursor: null }], pageParams: [undefined] };
    const next = mergeIncomingMessage(old, msg('m2'));
    expect(next!.pages[0].messages.map((m) => m.id)).toEqual(['m2', 'm1']);
  });

  it('is idempotent — a duplicate id is not added twice', () => {
    const old = { pages: [{ messages: [msg('m1')], nextCursor: null }], pageParams: [undefined] };
    const next = mergeIncomingMessage(old, msg('m1'));
    expect(next!.pages[0].messages).toHaveLength(1);
  });
});

describe('bumpUnread', () => {
  it('increments unread only for the target conversation', () => {
    const old: Conversation[] = [
      { id: 'c1', unreadCount: 0 } as Conversation,
      { id: 'c2', unreadCount: 3 } as Conversation,
    ];
    const next = bumpUnread(old, 'c1');
    expect(next!.find((c) => c.id === 'c1')!.unreadCount).toBe(1);
    expect(next!.find((c) => c.id === 'c2')!.unreadCount).toBe(3);
  });
});
