'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Download, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/vul-mgmt/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/vul-mgmt/hallazgos', label: 'Hallazgos', icon: Download },
  { href: '/vul-mgmt/ingesta', label: 'Ingesta', icon: Upload },
] as const;

export function VulnMgmtNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/30 p-1">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href === '/vul-mgmt/dashboard' && pathname === '/vul-mgmt');
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
            )}
          >
            <Icon className="size-3.5 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
