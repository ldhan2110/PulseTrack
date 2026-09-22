/**
 * External (PulseTrack password) session token store.
 * Access token lives in memory only; the refresh token lives in localStorage so
 * an external session survives a reload (rotate-on-use, short-lived access).
 * Internal (Keycloak) users never touch this — their token comes from keycloak.
 */
const REFRESH_KEY = 'pt_refresh_token';

let accessToken: string | null = null;

export const externalSession = {
  setTokens(access: string, refresh: string) {
    accessToken = access;
    try {
      localStorage.setItem(REFRESH_KEY, refresh);
    } catch {
      // private mode / storage disabled — session just won't survive reload
    }
  },

  getAccessToken(): string | null {
    return accessToken;
  },

  getRefreshToken(): string | null {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },

  hasSession(): boolean {
    return !!this.getRefreshToken();
  },

  clear() {
    accessToken = null;
    try {
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      // ignore
    }
  },

  /** Exchange the stored refresh token for a fresh pair. Clears on failure. */
  async refresh(): Promise<string> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) throw new Error('no refresh token');
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      this.clear();
      throw new Error('refresh failed');
    }
    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    this.setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  },
};
