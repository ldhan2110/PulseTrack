// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const addChatMembers = vi.fn((_id: string, _userIds: string[]) =>
  Promise.resolve({ id: 'c1', members: [] }),
);
const removeChatMember = vi.fn((_id: string, _userId: string) =>
  Promise.resolve({ removed: true }),
);
vi.mock('../lib/api', () => ({
  api: {
    addChatMembers: (id: string, userIds: string[]) => addChatMembers(id, userIds),
    removeChatMember: (id: string, userId: string) => removeChatMember(id, userId),
  },
}));

import { useAddChatMembers, useRemoveChatMember, chatKeys } from './useChat';

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

let qc: QueryClient;
beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  addChatMembers.mockClear();
  removeChatMember.mockClear();
});

describe('useAddChatMembers', () => {
  it('POSTs the userIds and invalidates conversations', async () => {
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useAddChatMembers(), {
      wrapper: makeWrapper(qc),
    });
    result.current.mutate({ id: 'c1', userIds: ['u2', 'u3'] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(addChatMembers).toHaveBeenCalledWith('c1', ['u2', 'u3']);
    expect(spy).toHaveBeenCalledWith({ queryKey: chatKeys.conversations });
  });
});

describe('useRemoveChatMember', () => {
  it('DELETEs the member and invalidates conversations', async () => {
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useRemoveChatMember(), {
      wrapper: makeWrapper(qc),
    });
    result.current.mutate({ id: 'c1', userId: 'u2' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(removeChatMember).toHaveBeenCalledWith('c1', 'u2');
    expect(spy).toHaveBeenCalledWith({ queryKey: chatKeys.conversations });
  });
});
