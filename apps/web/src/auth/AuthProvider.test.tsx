import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, AuthContext } from './AuthProvider';
import { useContext } from 'react';

// Mock keycloak-js using vi.hoisted so the factory can reference the variable
const mockKeycloak = vi.hoisted(() => ({
  init: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  token: 'mock-token',
  tokenParsed: null as null,
  onTokenExpired: null as (() => void) | null,
  updateToken: vi.fn(),
}));

vi.mock('./keycloak', () => ({ default: mockKeycloak }));

// Mock fetch for /users/me
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function TestConsumer() {
  const ctx = useContext(AuthContext);
  if (!ctx) return <div>no context</div>;
  return (
    <div>
      <span data-testid="authenticated">{String(ctx.authenticated)}</span>
      <span data-testid="accessDenied">{String(ctx.accessDenied)}</span>
      <span data-testid="loading">{String(ctx.loading)}</span>
      <span data-testid="username">{ctx.user?.username ?? 'none'}</span>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets accessDenied=true when /users/me returns 401', async () => {
    mockKeycloak.init.mockResolvedValue(true);
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('true');
    expect(screen.getByTestId('accessDenied').textContent).toBe('true');
    expect(screen.getByTestId('username').textContent).toBe('none');
  });
});
