import React from 'react';
import { useAuth } from './useAuth';
import keycloak from './keycloak';

interface Props {
  children: React.ReactNode;
  requiredRole?: string;
}

export function ProtectedRoute({ children, requiredRole }: Props) {
  const { authenticated, roles, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!authenticated) {
    keycloak.login();
    return <div>Redirecting to login...</div>;
  }

  if (requiredRole && !roles.includes(requiredRole)) {
    return (
      <div>
        <h2>Access Denied</h2>
        <p>Required role: {requiredRole}</p>
        <p>Your roles: {roles.join(', ') || 'none'}</p>
      </div>
    );
  }

  return <>{children}</>;
}
