'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Layout,
  ShieldAlert,
  Database,
  Crosshair,
  Wrench,
  FileSpreadsheet,
  BookOpen,
  Activity,
  FileText,
  GitBranch,
  Server,
  Scale,
  Layers,
  ExternalLink,
  Settings,
  ClipboardList,
  ClipboardCheck,
  Shield,
  Sliders,
  Bot,
  ChevronDown,
  ChevronRight,
  Library,
  FolderTree,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { canAdminTenant, type UserRole } from '@/lib/auth-api';
import { useUiT } from '@/lib/use-ui-locale';
import type { SecOpsNavLabelKey } from '@/lib/ui-locale';

type NavItem = {
  href: string;
  labelKey: SecOpsNavLabelKey;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
  adminOnly?: boolean;
  isCatalog?: boolean;
  isTool?: boolean;
};

const nav: NavItem[] = [
  { href: '/', labelKey: 'navTablero', icon: LayoutDashboard },
  { href: '/assets', labelKey: 'navAssets', icon: Server },
  { href: '/reports', labelKey: 'navServices', icon: FileText },
  { href: '/vul-mgmt', labelKey: 'navVulnerabilities', icon: ShieldAlert },
  { href: '/pruebas-seguridad', labelKey: 'navSecurityTestsActive', icon: ShieldAlert },
  { href: '/evaluaciones', labelKey: 'navEvaluationsActive', icon: ClipboardCheck },
  { href: '/compliance', labelKey: 'navCompliance', icon: Scale },
  // Catalog sub-menu items
  { href: '/vulns-catalog', labelKey: 'navOperationalCatalog', icon: BookOpen, isCatalog: true },
  { href: '/pruebas-seguridad-catalogo', labelKey: 'navSecurityTestsCatalog', icon: Shield, isCatalog: true },
  { href: '/evaluaciones-catalogo', labelKey: 'navEvaluationsCatalog', icon: ClipboardList, isCatalog: true },
  { href: '/vul-catalog', labelKey: 'navBaseCatalog', icon: Database, isCatalog: true },
  // Tools sub-menu items
  { href: '/tools/methodologies-phantom', labelKey: 'navMethodologiesPhantom', icon: FolderTree, isTool: true },
  { href: '/tools', labelKey: 'navTools', icon: Wrench, isTool: true },
  // Admin & Portal items
  { href: '/agents', labelKey: 'navAgents', icon: Bot, adminOnly: true },
  { href: '/portal?editor=true', labelKey: 'navClientPortalEditor', icon: Sliders, adminOnly: true },
  { href: '/admin', labelKey: 'navAdministration', icon: Settings, adminOnly: true },
];

function visibleNav(role: UserRole | null) {
  const isPortalEnabled = typeof window !== 'undefined' ? localStorage.getItem('spectre_portal_enabled') !== 'false' : true;
  if (!role || role === 'client_viewer') {
    if (!isPortalEnabled) return [];
    return nav.filter((n) => n.href === '/portal');
  }
  return nav.filter((n) => !n.adminOnly || canAdminTenant(role));
}

function isActive(pathname: string | null, search: string, href: string, allItems: NavItem[]) {
  if (!pathname) return false;
  // Links that include query params need exact match including search
  if (href.includes('?')) {
    const [hrefPath, hrefQuery] = href.split('?');
    return pathname === hrefPath && search === `?${hrefQuery}`;
  }
  if (href === '/') return pathname === '/';
  // For plain hrefs: if a more specific query-param nav item is currently active
  // for this same pathname, do NOT activate the plain item (prevents double highlight).
  const hasMoreSpecificMatch = allItems.some((item) => {
    if (!item.href.includes('?')) return false;
    const [itemPath, itemQuery] = item.href.split('?');
    return itemPath === pathname && search === `?${itemQuery}`;
  });
  if (hasMoreSpecificMatch) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SecOpsSidebarNavInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const { role } = useAuth();
  const { t } = useUiT();
  const items = visibleNav(role);

  const mainItems = items.filter((item) => !item.isCatalog && !item.isTool);
  const catalogItems = items.filter((item) => item.isCatalog);
  const toolItems = items.filter((item) => item.isTool);
  const afterHrefs = ['/agents', '/portal?editor=true', '/admin'];

  const itemsBeforeCatalog = mainItems.filter((item) => !afterHrefs.includes(item.href));
  const itemsAfterCatalog = mainItems.filter((item) => afterHrefs.includes(item.href));

  // Determine if any catalog route is active to auto-expand it
  const isCatalogRouteActive = catalogItems.some((item) => {
    if (!pathname) return false;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  });

  const [isCatalogsOpen, setIsCatalogsOpen] = useState(isCatalogRouteActive);

  // Determine if any tools route is active to auto-expand it
  const isToolRouteActive = toolItems.some((item) => {
    if (!pathname) return false;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  });

  const [isToolsOpen, setIsToolsOpen] = useState(isToolRouteActive);

  useEffect(() => {
    if (isCatalogRouteActive) {
      setIsCatalogsOpen(true);
    }
  }, [isCatalogRouteActive]);

  useEffect(() => {
    if (isToolRouteActive) {
      setIsToolsOpen(true);
    }
  }, [isToolRouteActive]);

  const renderLink = (href: string, labelKey: SecOpsNavLabelKey, Icon: any, isSubItem = false) => {
    const active = isActive(pathname, search, href, items);
    const label = t(labelKey);
    return (
      <Link
        key={href}
        href={href}
        className={cn(
          'flex items-center gap-2.5 rounded-xl px-3 transition-all duration-200',
          isSubItem
            ? 'pl-5 min-h-[2.125rem] text-[11px] font-medium tracking-wide whitespace-nowrap'
            : 'min-h-11 text-sm font-medium',
          active
            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        )}
      >
        <Icon className={cn(isSubItem ? 'size-3.5 shrink-0' : 'size-[1.125rem] shrink-0 transition-transform duration-200 group-hover:scale-105', active ? 'text-primary' : 'text-muted-foreground/80')} />
        <span className="flex-1 leading-snug truncate">{label}</span>
      </Link>
    );
  };

  return (
    <nav className="flex-1 px-4 py-6 space-y-1 select-none">
      {/* 1. Main navigation before Catalogs */}
      {itemsBeforeCatalog.map((item) => renderLink(item.href, item.labelKey, item.icon))}

      {/* 2. Catalogs colapsable sub-menu */}
      {catalogItems.length > 0 && (
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => setIsCatalogsOpen(!isCatalogsOpen)}
            className={cn(
              'w-full flex items-center gap-2.5 rounded-xl px-3 min-h-11 text-sm font-medium transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-muted/50 focus:outline-none select-none',
              isCatalogRouteActive && 'text-foreground font-semibold'
            )}
          >
            <Library className="size-[1.125rem] shrink-0 text-muted-foreground/80" />
            <span className="flex-1 text-left leading-snug">Catalogs</span>
            <ChevronRight className={cn(
              'size-3.5 text-muted-foreground/60 shrink-0 transition-transform duration-300 ease-out',
              isCatalogsOpen && 'rotate-90 text-primary'
            )} />
          </button>

          <div className={cn(
            'pl-0.5 border-l border-border/20 ml-[1.125rem] transition-all duration-300 ease-in-out overflow-hidden space-y-0.5',
            isCatalogsOpen ? 'opacity-100 max-h-60 py-1' : 'opacity-0 max-h-0 pointer-events-none'
          )}>
            {catalogItems.map((item) => renderLink(item.href, item.labelKey, item.icon, true))}
          </div>
        </div>
      )}

      {/* 3. Tools colapsable sub-menu */}
      {toolItems.length > 0 && (
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => setIsToolsOpen(!isToolsOpen)}
            className={cn(
              'w-full flex items-center gap-2.5 rounded-xl px-3 min-h-11 text-sm font-medium transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-muted/50 focus:outline-none select-none',
              isToolRouteActive && 'text-foreground font-semibold'
            )}
          >
            <Wrench className="size-[1.125rem] shrink-0 text-muted-foreground/80" />
            <span className="flex-1 text-left leading-snug">{t('navTools')}</span>
            <ChevronRight className={cn(
              'size-3.5 text-muted-foreground/60 shrink-0 transition-transform duration-300 ease-out',
              isToolsOpen && 'rotate-90 text-primary'
            )} />
          </button>

          <div className={cn(
            'pl-0.5 border-l border-border/20 ml-[1.125rem] transition-all duration-300 ease-in-out overflow-hidden space-y-0.5',
            isToolsOpen ? 'opacity-100 max-h-60 py-1' : 'opacity-0 max-h-0 pointer-events-none'
          )}>
            {toolItems.map((item) => renderLink(item.href, item.labelKey, item.icon, true))}
          </div>
        </div>
      )}

      {/* 4. Main navigation after Tools */}
      {itemsAfterCatalog.map((item) => renderLink(item.href, item.labelKey, item.icon))}
    </nav>
  );
}

export function SecOpsSidebarNav() {
  return (
    <Suspense fallback={null}>
      <SecOpsSidebarNavInner />
    </Suspense>
  );
}


function shortMobileLabel(label: string) {
  if (label === 'Catálogo Vulns' || label === 'Vulnerabilities Catalog') return 'Catalog';
  if (label === 'Ingesta Excel' || label === 'Excel Ingest') return 'Excel';
  if (label === 'Herramientas · Nmap' || label === 'Tools') return 'Nmap';
  if (label === 'Network Exposure Live Report') return 'Exposure';
  if (label === 'PENT-Lifecycle') return 'PENT';
  if (label === 'SEC-Services') return 'SEC';
  if (label === 'Módulos M1–M17' || label === 'Modules M1–M17') return 'Modules';
  if (label === 'Activos' || label === 'Assets') return label === 'Assets' ? 'Assets' : 'Activos';
  if (label === 'Compliance') return 'Comp.';
  if (label === 'Servicio de vulnes') return 'Vulnes';
  if (label === 'Reportes Word') return 'Reportes';
  if (label === 'Methodologies Phantom') return 'Phantom';
  return label;
}

function SecOpsMobileNavInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const { role } = useAuth();
  const { t } = useUiT();
  const items = visibleNav(role);
  return (
    <nav className="flex flex-wrap gap-2 justify-end type-small">
      {items.map(({ href, labelKey }) => {
        const active = isActive(pathname, search, href, items);
        const label = t(labelKey);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
              active
                ? 'border-primary/50 bg-primary/10 text-foreground'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {shortMobileLabel(label)}
          </Link>
        );
      })}
    </nav>
  );
}

export function SecOpsMobileNav() {
  return (
    <Suspense fallback={null}>
      <SecOpsMobileNavInner />
    </Suspense>
  );
}
