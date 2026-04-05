import { vi, describe, it, expect } from 'vitest';
import { renderHook, render, screen, act } from '@testing-library/react';
import React from 'react';
import { useAuth } from './useAuth';
import { AuthProvider, AuthContext, AuthContextValue } from './AuthProvider';

// Mock keycloak-js module to avoid actual OIDC calls in tests
vi.mock('./keycloak', () => ({
  default: {
    init: vi.fn().mockResolvedValue(true),
    login: vi.fn(),
    logout: vi.fn(),
    token: 'mock-token',
    tokenParsed: {
      preferred_username: 'testuser',
      email: 'test@example.com',
      realm_access: { roles: ['pm'] },
    },
    onTokenExpired: null,
    updateToken: vi.fn().mockResolvedValue(true),
  },
}));

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within AuthProvider',
    );
  });
});

describe('AuthProvider', () => {
  it('renders children', async () => {
    await act(async () => {
      render(
        <AuthProvider>
          <div data-testid="child">Hello</div>
        </AuthProvider>,
      );
    });
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('provides auth context values when wrapped correctly', async () => {
    let capturedValue: AuthContextValue | null = null;

    await act(async () => {
      render(
        <AuthProvider>
          <AuthContext.Consumer>
            {(value) => {
              capturedValue = value;
              return null;
            }}
          </AuthContext.Consumer>
        </AuthProvider>,
      );
    });

    expect(capturedValue).not.toBeNull();
    expect(typeof capturedValue!.logout).toBe('function');
    expect(Array.isArray(capturedValue!.roles)).toBe(true);
  });
});
