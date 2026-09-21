import { describe, it, expect } from 'vitest';
import type { InfiniteData } from '@tanstack/react-query';
import {
  deriveUnread,
  applyOptimistic,
  reconcile,
  applyIncoming,
} from './useChat';
import type { Conversation, Message, MessagePage } from '../lib/types';

const author = {
  id: 'u1',
  username: 'anle',
  email: 'a@b.c',
  name: 'An Le',
  imageUrl: null,
};

function msg(id: string, extra: Partial<Message> = {}): Message {
  return {
    id,
    conversationId: 'c1',
    authorId: 'u1',
    author,
    body: 'hi',
    editedAt: null,
    deletedAt: null,
    createdAt: '2026-09-21T00:00:00.000Z',
    attachments: [],
    ...extra,
  };
}

const empty: InfiniteData<MessagePage> = {
  pages: [{ items: [], nextCursor: null }],
  pageParams: [undefined],
};

describe('deriveUnread', () => {
  it('sums per-conversation unread counts', () => {
    const convos = [
      { unreadCount: 3 },
      { unreadCount: 4 },
      { unreadCount: 0 },
      {}, // missing count → 0
    ] as Conversation[];
    expect(deriveUnread(convos)).toBe(7);
  });
});

describe('optimistic send then reconcile on echo', () => {
  it('inserts a temp message then replaces it with the server echo', () => {
    const temp = msg('temp-1', { clientTempId: 'temp-1', status: 'sending' });
    const withTemp = applyOptimistic(empty, temp);
    expect(withTemp!.pages[0].items).toHaveLength(1);
    expect(withTemp!.pages[0].items[0].status).toBe('sending');

    // server echo arrives with the real id, carrying the same clientTempId
    const echo = msg('real-1', { clientTempId: 'temp-1' });
    const reconciled = reconcile(withTemp, echo);
    expect(reconciled!.pages[0].items).toHaveLength(1); // replaced, not duplicated
    expect(reconciled!.pages[0].items[0].id).toBe('real-1');
    expect(reconciled!.pages[0].items[0].status).toBe('sent');
  });

  it('dedupes an incoming message already present by id', () => {
    const one = applyIncoming(empty, msg('real-1'));
    const again = applyIncoming(one, msg('real-1'));
    expect(again!.pages[0].items).toHaveLength(1);
  });
});
