import React, { createContext, useEffect, useState, useCallback, useRef } from 'react';
import keycloak from './keycloak';
import { externalSession } from './externalSession';
import { keycloakSession } from './keycloakSession';

interface UserProfile {
  id: string;
  keycloakId: string | null;
  email: string;
  username: string;
  name: string | null;
  imageUrl: string | null;
}

export type KeycloakUserInfo = {
  usrNm: string | null;
  imgUrl: string | null;
};

export type AuthContextValue = {
  authenticated: boolean;
  accessDenied: boolean;
  token: string | undefined;
  user: UserProfile | null;
  keycloakUserInfo: KeycloakUserInfo | null;
  signInExternal: (email: string, password: string) => Promise<void>;
  signInWithTokens: (accessToken: string, refreshToken: string, user: UserProfile) => void;
  logout: () => void;
  loading: boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

let initialized = false;

// Refresh the external access token ~1 min before its 15-min expiry.
const EXTERNAL_REFRESH_MS = 14 * 60 * 1000;

const apiUrl = import.meta.env.VITE_API_URL || '/api';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [keycloakUserInfo, setKeycloakUserInfo] = useState<KeycloakUserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  // 'external' access token, mirrored into state so context.token re-renders.
  const [externalAccess, setExternalAccess] = useState<string | undefined>(undefined);
  const mode = useRef<'internal' | 'external' | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRefreshTimer = () => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  };

  const logout = useCallback(() => {
    if (mode.current === 'external') {
      clearRefreshTimer();
      externalSession.clear();
      mode.current = null;
      setExternalAccess(undefined);
      setUser(null);
      setAuthenticated(false);
      return;
    }
    keycloakSession.clear();
    keycloak.logout({ redirectUri: window.location.origin });
  }, []);

  const scheduleExternalRefresh = useCallback(() => {
    clearRefreshTimer();
    refreshTimer.current = setTimeout(async () => {
      try {
        const access = await externalSession.refresh();
        setExternalAccess(access);
        scheduleExternalRefresh();
      } catch {
        logout();
      }
    }, EXTERNAL_REFRESH_MS);
  }, [logout]);

  const loadExternalUser = useCallback(
    async (access: string) => {
      const res = await fetch(`${apiUrl}/users/me`, {
        headers: { Authorization: `Bearer ${access}` },
      });
      if (!res.ok) throw new Error('profile fetch failed');
      const profile: UserProfile = await res.json();
      mode.current = 'external';
      setUser(profile);
      setExternalAccess(access);
      setAuthenticated(true);
      scheduleExternalRefresh();
    },
    [scheduleExternalRefresh],
  );

  const signInWithTokens = useCallback(
    (accessToken: string, refreshToken: string, profile: UserProfile) => {
      externalSession.setTokens(accessToken, refreshToken);
      mode.current = 'external';
      setUser(profile);
      setExternalAccess(accessToken);
      setAuthenticated(true);
      setAccessDenied(false);
      scheduleExternalRefresh();
    },
    [scheduleExternalRefresh],
  );

  const signInExternal = useCallback(
    async (email: string, password: string) => {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message || 'Invalid email or password');
      }
      const data = (await res.json()) as {
        accessToken: string;
        refreshToken: string;
        user: UserProfile;
      };
      signInWithTokens(data.accessToken, data.refreshToken, data.user);
    },
    [signInWithTokens],
  );

  useEffect(() => {
    if (initialized) return;
    initialized = true;

    // 1) Existing external session → restore it without touching Keycloak.
    if (externalSession.hasSession()) {
      externalSession
        .refresh()
        .then((access) => loadExternalUser(access))
        .catch(() => {
          externalSession.clear();
          setAuthenticated(false);
        })
        .finally(() => setLoading(false));
      return;
    }

    // 2) No external session → restore / check the Keycloak session.
    // After auth: persist tokens, load the profile, drop the spinner.
    const finishInternal = async () => {
      mode.current = 'internal';
      keycloakSession.save(keycloak.token, keycloak.refreshToken);
      setAuthenticated(true);

      // Extract user-info from JWT payload
      if (keycloak.token) {
        try {
          const payload = JSON.parse(atob(keycloak.token.split('.')[1]));
          const userInfo = payload['user-info'];
          if (userInfo) {
            const blueprintUrl = import.meta.env.VITE_BLUEPRINT_URL || '';
            const imgUrl = userInfo.imgUrl
              ? `${blueprintUrl}/upload/${userInfo.imgUrl.replace(/\\/g, '/')}`
              : null;
            setKeycloakUserInfo({ usrNm: userInfo.usrNm ?? null, imgUrl });
          }
        } catch {
          // JWT decode failed — non-critical, fallback to DB user
        }
      }

      try {
        const response = await fetch(`${apiUrl}/users/me`, {
          headers: { Authorization: `Bearer ${keycloak.token}` },
        });
        if (response.ok) {
          setUser((await response.json()) as UserProfile);
        } else {
          setAccessDenied(true);
        }
      } catch (err) {
        console.error('Failed to fetch user profile:', err);
        setAccessDenied(true);
      }

      setLoading(false);
    };

    // Backstop only: init() can hang if the silent-SSO iframe never posts back.
    // 15s is safely above keycloak's own 10s timeout, so a valid session (~1s)
    // is never cut short — only a true infinite hang trips it.
    const killer = setTimeout(() => setLoading(false), 15000);

    // Prefer first-party restore from persisted tokens — no silent-SSO iframe,
    // so it survives third-party-cookie blocking when the app and Keycloak are
    // on different sites in production. Fall back to check-sso only when we have
    // no stored tokens (first load / the login-redirect callback), where the
    // code is in the URL and no cross-site cookie is needed.
    const stored = keycloakSession.get();
    const initInternal = stored.refreshToken
      ? keycloak
          .init({
            token: stored.token,
            refreshToken: stored.refreshToken,
            pkceMethod: 'S256',
            checkLoginIframe: false,
          })
          .then(async (auth) => {
            if (!auth) return false;
            // Force a refresh so a dead refresh token is rejected here.
            try {
              await keycloak.updateToken(30);
            } catch {
              return false;
            }
            return true;
          })
      : keycloak
          .init({
            onLoad: 'check-sso',
            silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
            pkceMethod: 'S256',
            checkLoginIframe: false,
          })
          .then((auth) => !!auth);

    initInternal
      .then(async (ok) => {
        if (ok) {
          await finishInternal();
          return;
        }
        // No valid session → clear stale tokens, show the login page.
        keycloakSession.clear();
        setAuthenticated(false);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Keycloak init failed:', err);
        keycloakSession.clear();
        setLoading(false);
      })
      .finally(() => clearTimeout(killer));

    keycloak.onTokenExpired = () => {
      keycloak
        .updateToken(30)
        .then(() => keycloakSession.save(keycloak.token, keycloak.refreshToken))
        .catch(() => keycloak.logout());
    };
  }, [loadExternalUser]);

  return (
    <AuthContext.Provider
      value={{
        authenticated,
        accessDenied,
        token: mode.current === 'external' ? externalAccess : keycloak.token,
        user,
        keycloakUserInfo,
        signInExternal,
        signInWithTokens,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
