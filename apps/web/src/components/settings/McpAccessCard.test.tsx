// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { McpToken } from '@/lib/types';

// Mutable hook state driven per-test.
const state: {
  tokens: McpToken[];
  isLoading: boolean;
  isError: boolean;
  createResult: { token: string };
} = {
  tokens: [],
  isLoading: false,
  isError: false,
  createResult: { token: 'pt_mcp_deadbeefdeadbeefdeadbeefdeadbeef' },
};

const createMutate = vi.fn(async () => state.createResult);
const revokeMutate = vi.fn();

vi.mock('@/hooks/useMcpTokens', () => ({
  useMcpTokens: () => ({
    data: state.tokens,
    isLoading: state.isLoading,
    isError: state.isError,
    refetch: vi.fn(),
  }),
  useCreateMcpToken: () => ({ mutateAsync: createMutate, isPending: false, isError: false }),
  useRevokeMcpToken: () => ({ mutate: revokeMutate, isPending: false }),
}));

import { McpAccessCard } from './McpAccessCard';

const TOKEN: McpToken = {
  id: 't1',
  label: 'Cursor laptop',
  scopes: ['tasks:read', 'bugs:read'],
  lastUsedAt: null,
  expiresAt: null,
  revokedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
};

beforeEach(() => {
  state.tokens = [];
  state.isLoading = false;
  state.isError = false;
  createMutate.mockClear();
  revokeMutate.mockClear();
  // clipboard for copy actions
  Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
});

describe('McpAccessCard [req-7]', () => {
  it('shows the connect URL and a Create button for managers', () => {
    render(<McpAccessCard projectId="p1" canManage />);
    expect(screen.getByDisplayValue(`${window.location.origin}/api/mcp`)).toBeTruthy();
    expect(screen.getByText('+ Create token')).toBeTruthy();
  });

  it('read-only user: no create button, revoke hidden, but URL + list visible', () => {
    state.tokens = [TOKEN];
    render(<McpAccessCard projectId="p1" canManage={false} />);
    expect(screen.queryByText('+ Create token')).toBeNull();
    expect(screen.queryByText('Revoke')).toBeNull();
    expect(screen.getByDisplayValue(`${window.location.origin}/api/mcp`)).toBeTruthy();
    expect(screen.getByText('Cursor laptop')).toBeTruthy();
  });

  it('revoked token shows a revoked badge and no Revoke action', () => {
    state.tokens = [{ ...TOKEN, revokedAt: '2026-09-09T00:00:00.000Z' }];
    render(<McpAccessCard projectId="p1" canManage />);
    expect(screen.getByText('revoked')).toBeTruthy();
    expect(screen.queryByText('Revoke')).toBeNull();
  });

  it('create flow shows the secret once with a never-shown-again warning', async () => {
    render(<McpAccessCard projectId="p1" canManage />);
    fireEvent.click(screen.getByText('+ Create token'));

    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'My token' } });
    fireEvent.click(screen.getByText('Create'));

    // secret view appears
    expect(await screen.findByText(state.createResult.token)).toBeTruthy();
    expect(screen.getByText(/never be shown again/i)).toBeTruthy();
    expect(createMutate).toHaveBeenCalledOnce();
  });
});
