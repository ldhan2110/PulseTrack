// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Conversation } from '../lib/types';

const deleteChatConversation = vi.fn((_id: string) =>
  Promise.resolve({ deleted: true }),
);
vi.mock('../lib/api', () => ({
  api: { deleteChatConversation: (id: string) => deleteChatConversation(id) },
}));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ token: 'tok', user: { id: 'me' } }),
}));

import { useDeleteConversation, chatKeys } from './useChat';
import { useUiStore } from '../store/uiStore';

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

let qc: QueryClient;
beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  deleteChatConversation.mockClear();
  useUiStore.setState({ activeConversationId: null });
});

describe('useDeleteConversation', () => {
  it('drops the convo from cache and clears active id when it was active', async () => {
    qc.setQueryData<Conversation[]>(chatKeys.conversations, [
      { id: 'c1' } as Conversation,
      { id: 'c2' } as Conversation,
    ]);
    useUiStore.getState().setActiveConversationId('c1');

    const { result } = renderHook(() => useDeleteConversation(), {
      wrapper: makeWrapper(qc),
    });
    result.current.mutate('c1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(qc.getQueryData<Conversation[]>(chatKeys.conversations)).toEqual([
      { id: 'c2' },
    ]);
    expect(useUiStore.getState().activeConversationId).toBeNull();
  });

  it('keeps active id when a non-active convo is deleted', async () => {
    qc.setQueryData<Conversation[]>(chatKeys.conversations, [
      { id: 'c1' } as Conversation,
      { id: 'c2' } as Conversation,
    ]);
    useUiStore.getState().setActiveConversationId('c2');

    const { result } = renderHook(() => useDeleteConversation(), {
      wrapper: makeWrapper(qc),
    });
    result.current.mutate('c1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(qc.getQueryData<Conversation[]>(chatKeys.conversations)).toEqual([
      { id: 'c2' },
    ]);
    expect(useUiStore.getState().activeConversationId).toBe('c2');
  });
});
