'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BrandingLogo } from '@/components/branding-logo';
import { useAuth } from '@/contexts/auth-context';
import { useBranding } from '@/contexts/branding-context';
import { resolveBrandingAssetUrl } from '@/lib/tenant-branding';
import { ShieldCheck, Activity, Globe, Terminal, Eye, EyeOff } from 'lucide-react';

export default function LoginClientPage() {
  const { login, loading, user } = useAuth();
  const { branding, loadPublicBranding } = useBranding();
  const searchParams = useSearchParams();
  const orgSlug = searchParams.get('org') || searchParams.get('tenant') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (orgSlug.trim()) void loadPublicBranding(orgSlug.trim());
  }, [orgSlug, loadPublicBranding]);

  const banner = resolveBrandingAssetUrl(branding.login_banner_url);

  if (user && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 text-zinc-200">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-zinc-400">Accediendo al Portal de Clientes…</p>
        </div>
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
      setError(err instanceof Error ? err.message : 'Credenciales inválidas para el portal de clientes');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col md:flex-row bg-zinc-950 text-zinc-100 relative font-sans overflow-y-auto"
      style={
        banner
          ? {
              backgroundImage: `linear-gradient(rgba(9,9,11,0.85), rgba(9,9,11,0.96)), url(${banner})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      {/* LEFT COLUMN: Features Info Column */}
      <div className="flex-1 flex flex-col justify-center p-8 md:p-16 space-y-8 max-w-2xl bg-zinc-900/40 backdrop-blur-md border-r border-zinc-800/50">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="size-3.5" />
            Authorized Client Security Portal
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold leading-tight tracking-tight text-white">
            Monitor & Request <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              Security Assessments
            </span>
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Welcome to the client security portal. Request security audits, monitor penetration testing tickets, and execute authorized automated diagnostics across your infrastructure.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 w-fit">
              <Activity className="size-5" />
            </div>
            <h3 className="font-bold text-sm text-white">DDoS & Stress Testing</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Request traffic and load simulations to validate server mitigation capabilities and network resilience.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 w-fit">
              <Globe className="size-5" />
            </div>
            <h3 className="font-bold text-sm text-white">DNS & Web Audits</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Audit DNS configurations, subdomain leakage, dangling records, and application security headers.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-2 sm:col-span-2">
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 w-fit">
              <Terminal className="size-5" />
            </div>
            <h3 className="font-bold text-sm text-white">Automated SSH Audit Workflows</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Define and execute automated workflows to connect to your infrastructure via SSH and run rapid vulnerability audits (e.g. Nmap).
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Sign In Form Box */}
      <div className="flex-1 flex items-center justify-center p-8 md:p-16">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <BrandingLogo branding={branding} size="lg" fallback="Phantom Client" />
            </div>
            <h2 className="text-xl font-bold text-white">Portal Sign In</h2>
            <p className="text-xs text-zinc-500">Enter your client credentials to access the portal</p>
          </div>

          <form
            onSubmit={onSubmit}
            className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/80 backdrop-blur-xl p-6 md:p-8 shadow-2xl"
          >
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs text-zinc-400 font-semibold">
                Username / Email
              </label>
              <Input
                id="email"
                type="text"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-white placeholder-zinc-700 text-sm"
                placeholder="e.g. client_corp"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs text-zinc-400 font-semibold">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-white text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            {error ? (
              <p className="text-xs text-rose-500 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 leading-relaxed">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all py-2.5 rounded-xl shadow-lg hover:shadow-emerald-500/10 active:scale-[0.98]"
              disabled={submitting}
            >
              {submitting ? 'Authenticating...' : 'Sign In'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
