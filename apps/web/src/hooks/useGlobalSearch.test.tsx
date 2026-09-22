// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const globalSearch = vi.fn((_q: string) =>
  Promise.resolve({ projects: [], tasks: [] }),
);
vi.mock('../lib/api', () => ({
  api: { globalSearch: (q: string) => globalSearch(q) },
}));

import { useGlobalSearch } from './useGlobalSearch';

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

let qc: QueryClient;
beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  globalSearch.mockClear();
});

describe('useGlobalSearch', () => {
  it('is disabled below 2 chars (no request)', () => {
    renderHook(() => useGlobalSearch('a'), { wrapper: makeWrapper(qc) });
    expect(globalSearch).not.toHaveBeenCalled();
  });

  it('does not fire for a whitespace-only query', () => {
    renderHook(() => useGlobalSearch('   '), { wrapper: makeWrapper(qc) });
    expect(globalSearch).not.toHaveBeenCalled();
  });

  it('calls api.globalSearch at >= 2 chars', async () => {
    renderHook(() => useGlobalSearch('lo'), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(globalSearch).toHaveBeenCalledWith('lo'));
  });
});
