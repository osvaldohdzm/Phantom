'use client';

import { cn } from '@/lib/utils';
import type { Severity } from '@/lib/secops-api';

const LABEL: Record<Severity, string> = {
  Critical: 'Crítica',
  High: 'Alta',
  Medium: 'Media',
  Low: 'Baja',
  Info: 'Info',
};

/** Badges sólidos de alto contraste para escaneo rápido. */
const SOLID: Record<Severity, string> = {
  Critical: 'bg-rose-600 text-white',
  High: 'bg-orange-600 text-white',
  Medium: 'bg-amber-500 text-slate-950',
  Low: 'bg-sky-600 text-white',
  Info: 'bg-slate-600 text-slate-100',
};

export function SeverityBadge({
  severity,
  className,
  compact,
}: {
  severity: Severity;
  className?: string;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-semibold uppercase tracking-wide rounded',
        compact ? 'text-[9px] px-1.5 py-0.5 min-w-[3.25rem]' : 'text-[10px] px-2 py-0.5 min-w-[3.5rem]',
        SOLID[severity],
        className
      )}
    >
      {LABEL[severity]}
    </span>
  );
}

export function severityBadgeClass(severity: Severity): string {
  return SOLID[severity];
}
