// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import {
  QueryClient,
  QueryClientProvider,
  type InfiniteData,
} from '@tanstack/react-query';
import type { Message, MessagePage } from '../lib/types';

// ── fake socket.io socket ─────────────────────────────────────────────────────
class FakeSocket {
  handlers: Record<string, ((p: unknown) => void)[]> = {};
  auth: unknown = {};
  connected = false;
  on(ev: string, cb: (p: unknown) => void) {
    (this.handlers[ev] ??= []).push(cb);
    return this;
  }
  off(ev: string, cb: (p: unknown) => void) {
    this.handlers[ev] = (this.handlers[ev] ?? []).filter((h) => h !== cb);
    return this;
  }
  connect() {
    this.connected = true;
    return this;
  }
  disconnect() {
    this.connected = false;
    return this;
  }
  emitServer(ev: string, payload: unknown) {
    (this.handlers[ev] ?? []).forEach((h) => h(payload));
  }
}

const fake = new FakeSocket();

vi.mock('../socket/instance', () => ({
  getChatSocket: () => fake,
}));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ token: 'tok', user: { id: 'me' } }),
}));

import { useChatSync } from './useChatSync';
import { chatKeys } from './useChat';

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

const author = {
  id: 'u2',
  username: 'mai',
  email: 'm@x.y',
  name: 'Mai',
  imageUrl: null,
};
function msg(id: string): Message {
  return {
    id,
    conversationId: 'c1',
    authorId: 'u2',
    author,
    body: 'yo',
    editedAt: null,
    deletedAt: null,
    createdAt: '2026-09-21T00:00:00.000Z',
    attachments: [],
  };
}

let qc: QueryClient;
beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  fake.handlers = {};
});

describe('useChatSync', () => {
  it('appends a chat:message:new event to the cached thread', () => {
    // seed an existing (empty) thread cache
    qc.setQueryData<InfiniteData<MessagePage>>(chatKeys.messages('c1'), {
      pages: [{ items: [], nextCursor: null }],
      pageParams: [undefined],
    });
    renderHook(() => useChatSync(), { wrapper: makeWrapper(qc) });

    fake.emitServer('chat:message:new', msg('m1'));

    const data = qc.getQueryData<InfiniteData<MessagePage>>(
      chatKeys.messages('c1'),
    );
    expect(data!.pages[0].items).toHaveLength(1);
    expect(data!.pages[0].items[0].id).toBe('m1');
  });

  it('updates the presence cache on chat:presence', () => {
    renderHook(() => useChatSync(), { wrapper: makeWrapper(qc) });

    fake.emitServer('chat:presence', { userId: 'u2', online: true });

    const presence = qc.getQueryData<Record<string, boolean>>(
      chatKeys.presence,
    );
    expect(presence).toEqual({ u2: true });
  });
});
