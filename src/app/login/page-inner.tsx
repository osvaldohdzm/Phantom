'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BrandingLogo } from '@/components/branding-logo';
import { useAuth } from '@/contexts/auth-context';
import { useBranding } from '@/contexts/branding-context';
import { resolveBrandingAssetUrl } from '@/lib/tenant-branding';

export default function LoginPage() {
  const { login, loading, user } = useAuth();
  const { branding, loadPublicBranding } = useBranding();
  const searchParams = useSearchParams();
  const orgSlug = searchParams.get('org') || searchParams.get('tenant') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (orgSlug.trim()) void loadPublicBranding(orgSlug.trim());
  }, [orgSlug, loadPublicBranding]);

  const banner = resolveBrandingAssetUrl(branding.login_banner_url);

  if (user && !loading) {
    if (user.must_change_password || !user.initial_setup_complete) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">Completing account setup…</p>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Signed in. Redirecting…</p>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 bg-background relative"
      style={
        banner
          ? {
              backgroundImage: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.75)), url(${banner})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      <div className="w-full max-w-md space-y-6 relative z-10">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <BrandingLogo branding={branding} size="lg" fallback="Phantom" />
          </div>
          <h1 className="text-2xl font-semibold">Sign in</h1>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-border bg-card/95 backdrop-blur p-6 shadow-sm"
        >
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs text-muted-foreground">
              Username
            </label>
            <Input
              id="email"
              type="text"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs text-muted-foreground">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? (
            <p className="text-xs text-rose-600 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
