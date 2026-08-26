'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { SecOpsShell } from '@/components/secops-shell';
import { AppTopbar } from '@/components/app-topbar';
import { PortalBrandingHeader } from '@/components/portal-branding-header';
import { PortalThemeProvider } from '@/components/portal/PortalThemeProvider';
import { useSearchParams } from 'next/navigation';

function PortalLayoutInner({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  const searchParams = useSearchParams();

  const isEditor = searchParams.get('editor') === 'true';
  const isAdminOrSOC =
    role === 'platform_admin' || role === 'tenant_admin' || role === 'analyst' || role === 'lead';

  const [portalEnabled, setPortalEnabled] = useState(true);

  useEffect(() => {
    const val = localStorage.getItem('spectre_portal_enabled');
    if (val === 'false') {
      setPortalEnabled(false);
    }
  }, []);

  if (!portalEnabled && !isAdminOrSOC) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white font-sans select-none">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold font-mono border-r border-zinc-800 pr-4">404</h1>
          <h2 className="text-xs font-normal text-zinc-400">This page could not be found.</h2>
        </div>
      </div>
    );
  }

  // Editor: provide theme context for Themes tab; do not restyle SecOps chrome
  if (isAdminOrSOC && isEditor) {
    return (
      <PortalThemeProvider applyChrome={false}>
        <SecOpsShell>{children}</SecOpsShell>
      </PortalThemeProvider>
    );
  }

  // Client portal view only — themes scoped to [data-portal-root]
  return (
    <PortalThemeProvider applyChrome>
      <div className="portal-theme-header">
        <AppTopbar />
      </div>
      <div className="portal-theme-subheader">
        <PortalBrandingHeader />
      </div>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">{children}</main>
      <footer className="portal-theme-footer mt-auto px-4 py-3 text-xs">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-2 opacity-90">
          <span>Contact Information</span>
          <span aria-hidden>·</span>
          <span>GSD Numbers (regional phone numbers)</span>
        </div>
      </footer>
    </PortalThemeProvider>
  );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <PortalLayoutInner>{children}</PortalLayoutInner>
    </Suspense>
  );
}
