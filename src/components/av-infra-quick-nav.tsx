'use client';

import Link from 'next/link';
import { BarChart3, Map, Table2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/vul-mgmt/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/vul-mgmt/hallazgos', label: 'Hallazgos', icon: Table2 },
  { href: '/vul-mgmt/ingesta', label: 'Ingesta', icon: Upload },
  { href: '/vul-mgmt/mapa', label: 'Mapa', icon: Map },
] as const;

export function AvInfraQuickNav({ className }: { className?: string }) {
  return (
    <nav
      className={cn(
        'flex flex-wrap gap-1 rounded-lg border border-violet-500/25 bg-violet-500/5 p-1',
        className
      )}
      aria-label="Accesos rápidos AV Infraestructura"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-200 px-2 py-1.5 self-center">
        Repositorio
      </span>
      {LINKS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-violet-900 dark:text-violet-100 hover:bg-violet-500/15 transition-colors"
        >
          <Icon className="size-3.5 shrink-0" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
