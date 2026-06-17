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
  const { branding, workspaceName, productName, loadPublicBranding } = useBranding();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';
  const orgSlug = searchParams.get('org') || searchParams.get('tenant') || '';
  const [email, setEmail] = useState('admin@Phantom.local');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (orgSlug.trim()) void loadPublicBranding(orgSlug.trim());
  }, [orgSlug, loadPublicBranding]);

  const banner = resolveBrandingAssetUrl(branding.login_banner_url);

  if (user && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Sesión activa. Redirigiendo…</p>
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
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
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
            <BrandingLogo branding={branding} size="lg" fallback={workspaceName} />
          </div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{productName}</p>
          <h1 className="text-2xl font-semibold">{branding.login_headline || 'Iniciar sesión'}</h1>
          <p className="text-sm text-muted-foreground">
            {branding.login_subtitle || workspaceName}
          </p>
          {branding.login_message ? (
            <p className="text-[11px] text-muted-foreground/90 border border-border/50 rounded-md px-3 py-1.5 inline-block">
              {branding.login_message}
            </p>
          ) : null}
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-card/95 backdrop-blur p-6 shadow-sm">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs text-muted-foreground">
              Correo
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs text-muted-foreground">
              Contraseña
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
            {submitting ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>

        {orgSlug ? null : (
          <p className="text-center text-[10px] text-muted-foreground">
            White-label: añade <span className="font-mono">?org=slug-tenant</span> a la URL
          </p>
        )}

        {next !== '/login' ? (
          <p className="text-center text-xs text-muted-foreground">
            Tras login irás a <span className="font-mono">{next}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
