import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { Loader2 } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: Props) {
  const { authenticated, accessDenied, loading } = useAuth();

  if (loading || !authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {loading ? 'Loading' : 'Redirecting'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading ? 'Checking your session...' : 'Taking you to sign in...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return <Navigate to="/access-denied" replace />;
  }

  return <>{children}</>;
}
