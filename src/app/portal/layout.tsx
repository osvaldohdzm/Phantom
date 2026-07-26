'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { SecOpsShell } from '@/components/secops-shell';
import { AppTopbar } from '@/components/app-topbar';
import { PortalBrandingHeader } from '@/components/portal-branding-header';
import { useSearchParams } from 'next/navigation';

function PortalLayoutInner({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  const searchParams = useSearchParams();
  
  const isEditor = searchParams.get('editor') === 'true';
  const isAdminOrSOC = role === 'platform_admin' || role === 'tenant_admin' || role === 'analyst';

  const [portalEnabled, setPortalEnabled] = useState(true);

  // Check if client portal is enabled in localStorage settings
  useEffect(() => {
    const val = localStorage.getItem('spectre_portal_enabled');
    if (val === 'false') {
      setPortalEnabled(false);
    }
  }, []);

  // Secure Block: If portal is deactivated and visitor is not an Admin/SOC, render a standard Next.js-looking 404
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

  // If the user is an admin/SOC and requested the editor mode, wrap in the full dashboard shell (with sidebar)
  if (isAdminOrSOC && isEditor) {
    return <SecOpsShell>{children}</SecOpsShell>;
  }

  // Client view or preview mode: show the independent layout without the admin sidebar menu
  return (
    <div className="min-h-full flex flex-col bg-background text-foreground animate-fade-in">
      <AppTopbar />
      <div className="border-b border-border bg-card/40">
        <PortalBrandingHeader />
      </div>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <PortalLayoutInner>{children}</PortalLayoutInner>
    </Suspense>
  );
}
