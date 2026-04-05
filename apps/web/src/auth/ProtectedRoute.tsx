import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import keycloak from './keycloak';

interface Props {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: Props) {
  const { authenticated, accessDenied, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!authenticated) {
    keycloak.login();
    return <div>Redirecting to login...</div>;
  }

  if (accessDenied) {
    return <Navigate to="/access-denied" replace />;
  }

  return <>{children}</>;
}
