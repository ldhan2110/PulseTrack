import React, { createContext, useEffect, useState, useCallback } from 'react';
import keycloak from './keycloak';
import type { UserProfile } from '@pm/shared';

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
  logout: () => void;
  loading: boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

let initialized = false;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [keycloakUserInfo, setKeycloakUserInfo] = useState<KeycloakUserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initialized) return;
    initialized = true;

    keycloak
      .init({
        onLoad: 'login-required',
        pkceMethod: 'S256',
        checkLoginIframe: false,
      })
      .then(async (auth) => {
        if (!auth) {
          setAuthenticated(false);
          setLoading(false);
          return;
        }

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
              setKeycloakUserInfo({
                usrNm: userInfo.usrNm ?? null,
                imgUrl,
              });
            }
          } catch {
            // JWT decode failed — non-critical, fallback to DB user
          }
        }

        try {
          const apiUrl = import.meta.env.VITE_API_URL || '/api';
          const response = await fetch(`${apiUrl}/users/me`, {
            headers: { Authorization: `Bearer ${keycloak.token}` },
          });

          if (response.ok) {
            const profile: UserProfile = await response.json();
            setUser(profile);
          } else if (response.status === 401) {
            setAccessDenied(true);
          } else {
            setAccessDenied(true);
          }
        } catch (err) {
          console.error('Failed to fetch user profile:', err);
          setAccessDenied(true);
        }

        setLoading(false);
      })
      .catch((err) => {
        console.error('Keycloak init failed:', err);
        setLoading(false);
      });

    keycloak.onTokenExpired = () => {
      keycloak.updateToken(30).catch(() => keycloak.logout());
    };
  }, []);

  const logout = useCallback(() => {
    keycloak.logout({ redirectUri: window.location.origin });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        authenticated,
        accessDenied,
        token: keycloak.token,
        user,
        keycloakUserInfo,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
