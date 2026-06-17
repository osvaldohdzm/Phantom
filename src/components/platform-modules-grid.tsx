'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  MODULE_STATUS_LABEL,
  PLATFORM_MODULES,
  type ModuleStatus,
  type PlatformModule,
} from '@/lib/platform-modules';

const STATUS_STYLES: Record<ModuleStatus, string> = {
  live: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
  partial: 'border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-100',
  planned: 'border-border bg-muted/40 text-muted-foreground',
};

function ModuleCard({ mod }: { mod: PlatformModule }) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">{mod.id}</span>
        <span
          className={cn(
            'text-[9px] uppercase tracking-wide rounded-full px-2 py-0.5 border shrink-0',
            STATUS_STYLES[mod.status]
          )}
        >
          {MODULE_STATUS_LABEL[mod.status]}
        </span>
      </div>
      <p className="text-sm font-medium text-foreground leading-snug">{mod.name}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{mod.purpose}</p>
      {mod.phase ? (
        <p className="text-[10px] text-muted-foreground/80 pt-1">{mod.phase}</p>
      ) : null}
    </>
  );

  if (mod.href && mod.status !== 'planned') {
    return (
      <Link
        href={mod.href}
        className="rounded-lg border border-border bg-card/60 px-3 py-3 space-y-1.5 hover:border-primary/40 hover:bg-muted/30 transition-colors block"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card/40 px-3 py-3 space-y-1.5 opacity-90">
      {inner}
    </div>
  );
}

export function PlatformModulesGrid({ compact }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        'grid gap-3',
        compact ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
      )}
    >
      {PLATFORM_MODULES.map((mod) => (
        <ModuleCard key={mod.id} mod={mod} />
      ))}
    </div>
  );
}
