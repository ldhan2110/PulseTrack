import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Loader2, AlertCircle, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { AuthShell } from '../components/auth/AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function SetPasswordPage() {
  const navigate = useNavigate();
  const { signInWithTokens } = useAuth();
  const [params] = useSearchParams();
  const token = params.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Set once the server rejects the token (invalid / expired / already used).
  const [invalidToken, setInvalidToken] = useState(!token);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.authSetPassword(token!, password);
      signInWithTokens(res.accessToken, res.refreshToken, res.user);
      navigate('/', { replace: true });
    } catch {
      // Generic — never discloses whether the token or the user is the problem.
      setInvalidToken(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (invalidToken) {
    return (
      <AuthShell>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <XCircle className="size-10 text-destructive" />
          <h2 className="text-base font-semibold">This link is invalid or has expired</h2>
          <p className="text-sm text-muted-foreground">
            Invite and reset links are single-use and time-limited. Ask an admin to re-send
            your invite, or request a new reset.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-[12.5px] text-muted-foreground hover:text-foreground hover:underline"
          >
            ← Back to sign in
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <p className="mb-5 text-sm text-muted-foreground">
        Set your password to activate your account
      </p>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate>
        <div className="mb-1.5">
          <Label htmlFor="new-password" className="mb-1.5">
            New password
          </Label>
          <div className="relative flex items-center">
            <Lock className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              className="h-10 pl-9"
              aria-invalid={!!error}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>
        <p className="mb-3.5 text-xs text-muted-foreground">At least 8 characters.</p>

        <div className="mb-4">
          <Label htmlFor="confirm-password" className="mb-1.5">
            Confirm password
          </Label>
          <div className="relative flex items-center">
            <Lock className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              className="h-10 pl-9"
              aria-invalid={!!error}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
        </div>

        <Button type="submit" variant="default" className="h-10 w-full" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Setting password…
            </>
          ) : (
            'Set password & sign in'
          )}
        </Button>
      </form>
    </AuthShell>
  );
}

export default SetPasswordPage;
