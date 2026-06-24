'use client';

import { useMemo, useState } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { changePassword, type AuthSession } from '@/lib/auth-api';
import { passwordMeetsPolicy } from '@/lib/password-policy';
import { cn } from '@/lib/utils';

const PASSWORD_RULES_EN = [
  { id: 'length', label: 'At least 12 characters', test: (p: string) => p.length >= 12 },
  { id: 'upper', label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { id: 'digit', label: 'One number', test: (p: string) => /[0-9]/.test(p) },
  {
    id: 'special',
    label: 'One special character',
    test: (p: string) => /[^A-Za-z0-9]/.test(p),
  },
  {
    id: 'not_default',
    label: 'Not a common or default password',
    test: (p: string) =>
      !['phantom', 'password', 'password123', 'admin', 'changeme'].includes(
        p.trim().toLowerCase()
      ),
  },
  {
    id: 'not_login',
    label: 'Different from your username',
    test: (p: string, login?: string) => {
      const l = (login ?? '').trim().toLowerCase();
      return !l || p.trim().toLowerCase() !== l;
    },
  },
] as const;

type ForcePasswordChangeProps = {
  email: string;
  onComplete: (session: AuthSession) => void;
};

export function ForcePasswordChange({ email, onComplete }: ForcePasswordChangeProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const rulesOk = useMemo(
    () => PASSWORD_RULES_EN.map((r) => ({ ...r, ok: r.test(newPassword, email) })),
    [newPassword, email]
  );

  const canSubmit =
    currentPassword.length > 0 &&
    passwordMeetsPolicy(newPassword, email) &&
    newPassword === confirmPassword &&
    newPassword !== currentPassword;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const session = await changePassword(currentPassword, newPassword);
      onComplete(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-5 rounded-xl border border-amber-500/40 bg-card p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <ShieldAlert className="size-6 shrink-0 text-amber-500 mt-0.5" />
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">Password change required</h1>
            <p className="text-sm text-muted-foreground leading-snug">
              Set a strong password for <span className="font-mono text-foreground">{email}</span>{' '}
              before continuing.
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="current-pw" className="text-xs text-muted-foreground">
              Current password
            </label>
            <Input
              id="current-pw"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="new-pw" className="text-xs text-muted-foreground">
              New password
            </label>
            <Input
              id="new-pw"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirm-pw" className="text-xs text-muted-foreground">
              Confirm new password
            </label>
            <Input
              id="confirm-pw"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <ul className="rounded-md border border-border/60 bg-muted/30 p-2.5 space-y-1">
            {rulesOk.map((r) => (
              <li
                key={r.id}
                className={cn(
                  'text-[11px] flex items-center gap-1.5',
                  r.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                )}
              >
                <span className="size-1.5 rounded-full bg-current shrink-0" />
                {r.label}
              </li>
            ))}
            <li
              className={cn(
                'text-[11px] flex items-center gap-1.5',
                confirmPassword && newPassword === confirmPassword
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-muted-foreground'
              )}
            >
              <span className="size-1.5 rounded-full bg-current shrink-0" />
              Passwords match
            </li>
          </ul>

          {error ? (
            <p className="text-xs text-rose-600 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={!canSubmit || submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin mr-1.5" />
                Saving…
              </>
            ) : (
              'Save and continue'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
