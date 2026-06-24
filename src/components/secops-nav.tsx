'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
};

const nav: NavItem[] = [
  { href: '/', labelKey: 'navTablero', icon: LayoutDashboard },
  { href: '/assets', labelKey: 'navAssets', icon: Server },
  { href: '/vul-mgmt', labelKey: 'navVulnerabilities', icon: ShieldAlert },
  { href: '/reports', labelKey: 'navServices', icon: FileText },
  { href: '/vulns-catalog', labelKey: 'navOperationalCatalog', icon: BookOpen },
  { href: '/compliance', labelKey: 'navCompliance', icon: Scale },
  { href: '/sec-services', labelKey: 'navModules', icon: Layers },
  { href: '/canvas', labelKey: 'navEvidenceCanvas', icon: Layout },
  { href: '/vul-catalog', labelKey: 'navBaseCatalog', icon: Database },
  { href: '/ingesta-excel', labelKey: 'navExcelIngest', icon: FileSpreadsheet },
  { href: '/tools/phantom', labelKey: 'navPhantomEngine', icon: GitBranch },
  { href: '/pent-lifecycle', labelKey: 'navPentLifecycle', icon: Crosshair },
  { href: '/tools/nmap', labelKey: 'navToolsNmap', icon: Wrench },
  { href: '/tools/exposure', labelKey: 'navExposureReport', icon: Activity },
  { href: '/portal', labelKey: 'navClientPortal', icon: ExternalLink },
  { href: '/admin', labelKey: 'navAdministration', icon: Settings, adminOnly: true },
];

function visibleNav(role: UserRole | null) {
  if (!role || role === 'client_viewer') return nav.filter((n) => n.href === '/portal');
  return nav.filter((n) => !n.adminOnly || canAdminTenant(role));
}

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SecOpsSidebarNav() {
  const pathname = usePathname();
  const { role } = useAuth();
  const { t } = useUiT();
  const items = visibleNav(role);
  return (
    <nav className="flex-1 px-4 py-6 space-y-1">
      {items.map(({ href, labelKey, icon: Icon }) => {
        const active = isActive(pathname, href);
        const label = t(labelKey);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-xl px-4 min-h-11 text-sm font-medium transition-colors',
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            )}
          >
            <Icon className={cn('size-[1.125rem] shrink-0', active ? 'text-primary' : '')} />
            <span className="flex-1 leading-snug">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function shortMobileLabel(label: string) {
  if (label === 'Catálogo Vulns' || label === 'Operational Catalog') return 'Catalog';
  if (label === 'Ingesta Excel' || label === 'Excel Ingest') return 'Excel';
  if (label === 'Herramientas · Nmap' || label === 'Tools · Nmap') return 'Nmap';
  if (label === 'Network Exposure Live Report') return 'Exposure';
  if (label === 'PENT-Lifecycle') return 'PENT';
  if (label === 'SEC-Services') return 'SEC';
  if (label === 'Módulos M1–M17' || label === 'Modules M1–M17') return 'Modules';
  if (label === 'Activos' || label === 'Assets') return label === 'Assets' ? 'Assets' : 'Activos';
  if (label === 'Compliance') return 'Comp.';
  if (label === 'Servicio de vulnes') return 'Vulnes';
  if (label === 'Reportes Word') return 'Reportes';
  if (label === 'Phantom Engine') return 'Phantom';
  return label;
}

export function SecOpsMobileNav() {
  const pathname = usePathname();
  const { role } = useAuth();
  const { t } = useUiT();
  const items = visibleNav(role);
  return (
    <nav className="flex flex-wrap gap-2 justify-end type-small">
      {items.map(({ href, labelKey }) => {
        const active = isActive(pathname, href);
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
