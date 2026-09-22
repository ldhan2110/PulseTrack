import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import keycloak from '../auth/keycloak';
import { useAuth } from '../auth/useAuth';
import { AuthShell } from '../components/auth/AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function LoginPage() {
  const navigate = useNavigate();
  const { signInExternal, authenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authenticated) navigate('/', { replace: true });
  }, [authenticated, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      await signInExternal(trimmedEmail, password);
      navigate('/', { replace: true });
    } catch (err) {
      // fetch throws TypeError on network failure — don't surface "Failed to fetch".
      setError(
        err instanceof TypeError
          ? 'Unable to reach the server. Please check your connection and try again.'
          : err instanceof Error && err.message
            ? err.message
            : 'The email or password you entered is incorrect. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <p className="mb-5 text-sm text-muted-foreground">
        Welcome back — sign in to access your workspace.
      </p>

      <Button
        type="button"
        variant="default"
        className="h-10 w-full"
        onClick={() => keycloak.login()}
      >
        <Mail className="size-4" />
        Sign in with company account
      </Button>

      <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or with email
        <span className="h-px flex-1 bg-border" />
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate>
        <div className="mb-3.5">
          <Label htmlFor="email" className="mb-1.5">
            Email
          </Label>
          <div className="relative flex items-center">
            <Mail className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="h-10 pl-9"
              aria-invalid={!!error}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="mb-4">
          <Label htmlFor="password" className="mb-1.5">
            Password
          </Label>
          <div className="relative flex items-center">
            <Lock className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="h-10 pl-9"
              aria-invalid={!!error}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => navigate('/forgot-password')}
            className="text-[12.5px] text-muted-foreground hover:text-foreground hover:underline"
          >
            Forgot password?
          </button>
        </div>

        <Button type="submit" variant="outline" className="h-10 w-full" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </Button>
      </form>
    </AuthShell>
  );
}

export default LoginPage;
