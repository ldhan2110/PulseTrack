/**
 * Keycloak token store for first-party session restore.
 * keycloak-js keeps tokens in memory only, so a new tab falls back to the
 * silent-SSO iframe — which is blocked by third-party-cookie policies once the
 * app and Keycloak live on different sites in production. Persisting the token
 * pair here (same tradeoff already accepted for the external refresh token) lets
 * a new tab restore via keycloak.init({ token, refreshToken }) with no iframe.
 */
const TOKEN_KEY = 'pt_kc_token';
const REFRESH_KEY = 'pt_kc_refresh';
// idToken is needed as id_token_hint on logout — without it Keycloak shows a
// "confirm logout" page instead of redirecting straight back.
const ID_KEY = 'pt_kc_id';

export const keycloakSession = {
  save(token?: string, refreshToken?: string, idToken?: string) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
      if (idToken) localStorage.setItem(ID_KEY, idToken);
    } catch {
      // storage disabled — restore just won't survive a new tab
    }
  },
  get(): { token?: string; refreshToken?: string; idToken?: string } {
    try {
      return {
        token: localStorage.getItem(TOKEN_KEY) ?? undefined,
        refreshToken: localStorage.getItem(REFRESH_KEY) ?? undefined,
        idToken: localStorage.getItem(ID_KEY) ?? undefined,
      };
    } catch {
      return {};
    }
  },
  has(): boolean {
    return !!this.get().refreshToken;
  },
  // Local exp check — no network. A dead refresh token otherwise forces a
  // blocking keycloak.updateToken() on first load that hangs until the init
  // timeout. Decode the JWT exp and reject client-side instead.
  isRefreshExpired(): boolean {
    const t = this.get().refreshToken;
    if (!t) return true;
    try {
      const { exp } = JSON.parse(atob(t.split('.')[1]));
      return !exp || exp * 1000 < Date.now();
    } catch {
      return true; // unparseable → treat as dead
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(ID_KEY);
    } catch {
      // ignore
    }
  },
};
