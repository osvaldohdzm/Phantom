'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SecOpsMobileNav, SecOpsSidebarNav } from '@/components/secops-nav';
import { AppTopbar } from '@/components/app-topbar';
import { BrandingLogo } from '@/components/branding-logo';
import { useBranding } from '@/contexts/branding-context';
import { useAuth } from '@/contexts/auth-context';
import { SidebarProvider, useSidebar } from '@/contexts/sidebar-context';
import { markSecOpsPath } from '@/lib/reports-reentry';
import { resolveBrandingAssetUrl } from '@/lib/tenant-branding';
import { cn } from '@/lib/utils';

function SecOpsShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { open, hydrated, toggle } = useSidebar();
  const { uiLanguage } = useAuth();
  const { branding, workspaceName, productName } = useBranding();
  const banner = resolveBrandingAssetUrl(branding.dashboard_banner_url);
  const secondaryLogo = resolveBrandingAssetUrl(branding.logo_secondary_url);

  useEffect(() => {
    if (pathname) markSecOpsPath(pathname);
  }, [pathname]);

  useEffect(() => {
    document.documentElement.lang = uiLanguage === 'en' ? 'en' : 'es';
  }, [uiLanguage]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return (
    <div className="min-h-full flex bg-background text-foreground">
      <aside
        className={cn(
          'hidden md:flex shrink-0 flex-col border-r border-border bg-sidebar overflow-hidden',
          'transition-[width,border-color] duration-200 ease-out',
          open ? 'w-64' : 'w-0 border-r-transparent'
        )}
        aria-hidden={!open}
      >
        <div
          className={cn(
            'flex w-64 flex-col h-full min-h-0 transition-opacity duration-150',
            open && hydrated ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          <div className="px-6 py-6 border-b border-border space-y-4 shrink-0">
            <Link href="/" className="block group min-w-0">
              <div className="flex items-center gap-3">
                <BrandingLogo branding={branding} size="md" fallback={workspaceName} />
                <div className="min-w-0 flex-1">
                  <span className="type-small font-medium uppercase tracking-widest text-muted-foreground truncate block">
                    {productName}
                  </span>
                  <span className="block mt-0.5 text-lg font-semibold tracking-tight text-foreground truncate">
                    {workspaceName}
                  </span>
                </div>
                {secondaryLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={secondaryLogo} alt="" className="h-7 max-w-[4rem] object-contain opacity-90" />
                ) : null}
              </div>
            </Link>
          </div>
          <SecOpsSidebarNav />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <AppTopbar />
        <header className="md:hidden flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-card/80">
          <Link href="/" className="flex items-center gap-2 min-w-0 text-base font-semibold text-foreground shrink-0">
            <BrandingLogo branding={branding} size="sm" />
            <span className="truncate">{workspaceName}</span>
          </Link>
          <SecOpsMobileNav />
        </header>
        {banner ? (
          <div
            className="hidden md:block h-28 border-b border-border/60 bg-cover bg-center"
            style={{ backgroundImage: `url(${banner})` }}
          />
        ) : null}
        <main className="flex-1 overflow-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

export function SecOpsShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <SecOpsShellInner>{children}</SecOpsShellInner>
    </SidebarProvider>
  );
}
