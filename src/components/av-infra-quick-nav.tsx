'use client';

import Link from 'next/link';
import { BarChart3, Map, Table2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUiT } from '@/lib/use-ui-locale';

const LINKS = [
  { href: '/vul-mgmt/dashboard', labelKey: 'navDashboard' as const, icon: BarChart3 },
  { href: '/vul-mgmt/hallazgos', labelKey: 'navFindings' as const, icon: Table2 },
  { href: '/vul-mgmt/ingesta', labelKey: 'navIngest' as const, icon: Upload },
  { href: '/vul-mgmt/mapa', labelKey: 'navMap' as const, icon: Map },
] as const;

export function AvInfraQuickNav({ className }: { className?: string }) {
  const { t } = useUiT();

  return (
    <nav
      className={cn(
        'flex flex-wrap gap-1 rounded-lg border border-violet-500/25 bg-violet-500/5 p-1',
        className
      )}
      aria-label={t('avInfraQuickNavAria')}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-200 px-2 py-1.5 self-center">
        {t('avInfraRepository')}
      </span>
      {LINKS.map(({ href, labelKey, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-violet-900 dark:text-violet-100 hover:bg-violet-500/15 transition-colors"
        >
          <Icon className="size-3.5 shrink-0" />
          {t(labelKey)}
        </Link>
      ))}
    </nav>
  );
}
