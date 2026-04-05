import React, { createContext, useEffect, useState, useCallback } from 'react';
import keycloak from './keycloak';

export type AuthContextValue = {
  authenticated: boolean;
  token: string | undefined;
  roles: string[];
  username: string | undefined;
  email: string | undefined;
  logout: () => void;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

let initialized = false;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initialized) return;
    initialized = true;

    keycloak
      .init({
        onLoad: 'check-sso',
        pkceMethod: 'S256',
        silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
        checkLoginIframe: false,
      })
      .then((auth) => {
        setAuthenticated(auth);
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

  const roles = keycloak.tokenParsed?.realm_access?.roles ?? [];
  const username = keycloak.tokenParsed?.preferred_username;
  const email = keycloak.tokenParsed?.email;

  return (
    <AuthContext.Provider
      value={{
        authenticated,
        token: keycloak.token,
        roles,
        username,
        email,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
