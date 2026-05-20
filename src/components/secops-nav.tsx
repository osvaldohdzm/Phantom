'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Layout,
  ShieldAlert,
  Database,
  Crosshair,
  Briefcase,
  Wrench,
  ChevronRight,
  FileSpreadsheet,
  BookOpen,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const nav = [
  { href: '/', label: 'Tablero', icon: LayoutDashboard },
  { href: '/canvas', label: 'Evidence Canvas', icon: Layout },
  { href: '/vul-catalog', label: 'Catálogo Base', icon: Database },
  { href: '/vulns-catalog', label: 'Catálogo Operativo', icon: BookOpen },
  { href: '/ingesta-excel', label: 'Ingesta Excel', icon: FileSpreadsheet },
  { href: '/vul-mgmt', label: 'VUL-Mgmt', icon: ShieldAlert },
  { href: '/pent-lifecycle', label: 'PENT-Lifecycle', icon: Crosshair },
  { href: '/sec-services', label: 'SEC-Services', icon: Briefcase },
  { href: '/tools/nmap', label: 'Herramientas · Nmap', icon: Wrench },
  { href: '/tools/exposure', label: 'Network Exposure Live Report', icon: Activity },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SecOpsSidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex-1 p-3 space-y-0.5">
      {nav.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'group flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors',
              active
                ? 'bg-violet-500/15 text-violet-100 border border-violet-500/25'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
            )}
          >
            <Icon className={cn('size-4', active ? 'text-violet-300' : 'opacity-80')} />
            <span className="flex-1">{label}</span>
            <ChevronRight className={cn('size-3', active ? 'opacity-60' : 'opacity-0 group-hover:opacity-50')} />
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
  if (label === 'VUL-Mgmt') return 'VUL';
  return label;
}

export function SecOpsMobileNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-x-2.5 gap-y-1 justify-end text-[11px]">
      {nav.map(({ href, label }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              active ? 'text-violet-300 font-medium' : 'text-slate-400 hover:text-slate-200'
            )}
          >
            {shortMobileLabel(label)}
          </Link>
        );
      })}
    </nav>
  );
}
