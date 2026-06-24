'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Download, Map, Settings2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUiT } from '@/lib/use-ui-locale';
import type { UiMessageKey } from '@/lib/ui-locale';

const TABS: { href: string; labelKey: UiMessageKey; icon: typeof BarChart3 }[] = [
  { href: '/vul-mgmt/dashboard', labelKey: 'navDashboard', icon: BarChart3 },
  { href: '/vul-mgmt/hallazgos', labelKey: 'navFindings', icon: Download },
  { href: '/vul-mgmt/ingesta', labelKey: 'navIngest', icon: Upload },
  { href: '/vul-mgmt/mapa', labelKey: 'navMap', icon: Map },
  { href: '/vul-mgmt/admin', labelKey: 'navAdmin', icon: Settings2 },
];

export function VulnMgmtNav() {
  const pathname = usePathname();
  const { t } = useUiT();

  return (
    <nav className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/30 p-1">
      {TABS.map(({ href, labelKey, icon: Icon }) => {
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
            {t(labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
