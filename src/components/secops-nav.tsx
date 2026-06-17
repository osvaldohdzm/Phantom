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

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
  adminOnly?: boolean;
};

const nav: NavItem[] = [
  { href: '/', label: 'Tablero', icon: LayoutDashboard },
  { href: '/assets', label: 'Activos', icon: Server },
  { href: '/vul-mgmt', label: 'Vulnerabilidades', icon: ShieldAlert },

  { href: '/reports', label: 'Servicios', icon: FileText },
  { href: '/vulns-catalog', label: 'Catálogo Operativo', icon: BookOpen },
  { href: '/compliance', label: 'Compliance', icon: Scale },
  { href: '/sec-services', label: 'Módulos M1–M17', icon: Layers },
  { href: '/canvas', label: 'Evidence Canvas', icon: Layout },
  { href: '/vul-catalog', label: 'Catálogo Base', icon: Database },
  { href: '/ingesta-excel', label: 'Ingesta Excel', icon: FileSpreadsheet },
  { href: '/tools/phantom', label: 'Phantom Engine', icon: GitBranch },
  { href: '/pent-lifecycle', label: 'PENT-Lifecycle', icon: Crosshair },
  { href: '/tools/nmap', label: 'Herramientas · Nmap', icon: Wrench },
  { href: '/tools/exposure', label: 'Network Exposure Live Report', icon: Activity },
  { href: '/portal', label: 'Portal cliente', icon: ExternalLink },
  { href: '/admin', label: 'Administración', icon: Settings, adminOnly: true },
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
  const items = visibleNav(role);
  return (
    <nav className="flex-1 px-4 py-6 space-y-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
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
  if (label === 'Catálogo Vulns') return 'Catálogo';
  if (label === 'Ingesta Excel') return 'Excel';
  if (label === 'Herramientas · Nmap') return 'Nmap';
  if (label === 'Network Exposure Live Report') return 'Exposure';
  if (label === 'PENT-Lifecycle') return 'PENT';
  if (label === 'SEC-Services') return 'SEC';
  if (label === 'Módulos M1–M17') return 'Módulos';
  if (label === 'Activos') return 'Activos';
  if (label === 'Compliance') return 'Comp.';
  if (label === 'Servicio de vulnes') return 'Vulnes';
  if (label === 'Reportes Word') return 'Reportes';
  if (label === 'Phantom Engine') return 'Phantom';
  return label;
}

export function SecOpsMobileNav() {
  const pathname = usePathname();
  const { role } = useAuth();
  const items = visibleNav(role);
  return (
    <nav className="flex flex-wrap gap-2 justify-end type-small">
      {items.map(({ href, label }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'inline-flex items-center min-h-11 px-2 rounded-lg',
              active ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {shortMobileLabel(label)}
          </Link>
        );
      })}
    </nav>
  );
}
