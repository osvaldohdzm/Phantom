'use client';

import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  nueva: 'bg-sky-600 text-white',
  identificado: 'bg-sky-600 text-white',
  validado: 'bg-indigo-600 text-white',
  mitigada: 'bg-emerald-600 text-white',
  remediado: 'bg-emerald-600 text-white',
  remediada: 'bg-emerald-600 text-white',
  'en proceso de remediación': 'bg-amber-500 text-slate-950',
  're-test pendiente': 'bg-orange-500 text-white',
  're-test en curso': 'bg-orange-600 text-white',
  cerrado: 'bg-slate-600 text-slate-100',
  'falso positivo': 'bg-zinc-500 text-white',
  'riesgo aceptado': 'bg-violet-600 text-white',
  atendido: 'bg-teal-600 text-white',
  reaparecido: 'bg-rose-600 text-white',
};

function normStatus(label: string): string {
  return label.trim().toLowerCase();
}

export function statusBadgeClass(label: string): string {
  return STATUS_STYLES[normStatus(label)] ?? 'bg-muted text-foreground';
}

export function FindingStatusBadge({
  label,
  className,
  compact,
}: {
  label: string;
  className?: string;
  compact?: boolean;
}) {
  const text = label.trim() || '—';
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-semibold rounded',
        compact ? 'text-[9px] px-1.5 py-0.5 min-w-[3.5rem]' : 'text-[10px] px-2 py-0.5 min-w-[4rem]',
        statusBadgeClass(text),
        className
      )}
    >
      {text}
    </span>
  );
}
