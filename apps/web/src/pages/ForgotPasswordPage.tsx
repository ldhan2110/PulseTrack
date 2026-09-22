import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { AuthShell } from '../components/auth/AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.authForgotPassword(email);
    } catch {
      // Neutral either way — never reveal whether the address is registered.
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  };

  if (sent) {
    return (
      <AuthShell>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <Mail className="size-10 text-muted-foreground" />
          <h2 className="text-base font-semibold">Check your email</h2>
          <p className="text-sm text-muted-foreground">
            If an account exists for <b className="text-foreground">{email}</b>, we've sent a
            reset link. It expires shortly and can be used once.
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
        Enter your email and we'll send a reset link
      </p>

      <form onSubmit={onSubmit} noValidate>
        <div className="mb-4">
          <Label htmlFor="forgot-email" className="mb-1.5">
            Email
          </Label>
          <div className="relative flex items-center">
            <Mail className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="h-10 pl-9"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <Button type="submit" variant="default" className="h-10 w-full" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Sending…
            </>
          ) : (
            'Send reset link'
          )}
        </Button>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-[12.5px] text-muted-foreground hover:text-foreground hover:underline"
          >
            ← Back to sign in
          </button>
        </div>
      </form>
    </AuthShell>
  );
}

export default ForgotPasswordPage;
