import { ShieldX } from 'lucide-react';
import { useAuth } from '../auth/useAuth';

export function AccessDeniedPage() {
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="mx-auto max-w-sm rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <div className="mb-4 flex justify-center">
          <ShieldX className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-foreground">Access Denied</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Your account is not registered in this application. Please contact your administrator.
        </p>
        <button
          onClick={logout}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
