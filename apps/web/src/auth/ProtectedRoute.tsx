import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { Loader2 } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: Props) {
  const { authenticated, accessDenied, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Loading</h2>
            <p className="mt-1 text-sm text-muted-foreground">Checking your session...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    // No hard redirect to Keycloak — show the dual login page.
    return <Navigate to="/login" replace />;
  }

  if (accessDenied) {
    return <Navigate to="/access-denied" replace />;
  }

  return <>{children}</>;
}
