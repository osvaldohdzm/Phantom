'use client';

import { cn } from '@/lib/utils';
import type { Finding } from '@/lib/secops-api';

const EVENT_LABEL: Record<string, string> = {
  ingest: 'Ingesta',
  consolidate: 'Consolidación catálogo',
  consolidate_error: 'Error de consolidación',
  update: 'Actualización',
  status_change: 'Cambio de estado',
  ai_enrich: 'Enriquecimiento IA',
  ai_group_assign: 'Agrupación IA',
};

function formatDetail(detail: string | Record<string, unknown> | null | undefined): string {
  if (!detail) return '';
  if (typeof detail === 'string') return detail;
  if (typeof detail === 'object') {
    const parts: string[] = [];
    if ('from' in detail && 'to' in detail) {
      parts.push(`${String(detail.from)} → ${String(detail.to)}`);
    }
    if ('result' in detail) parts.push(String(detail.result));
    if ('fields' in detail && Array.isArray(detail.fields)) {
      parts.push((detail.fields as string[]).join(', '));
    }
    if ('tool_source' in detail) parts.push(String(detail.tool_source));
    if ('error' in detail) parts.push(String(detail.error));
    return parts.join(' · ') || JSON.stringify(detail);
  }
  return String(detail);
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type FindingHistoryTimelineProps = {
  finding: Finding;
  className?: string;
};

export function FindingHistoryTimeline({ finding, className }: FindingHistoryTimelineProps) {
  const events = [...(finding.lifecycle_history ?? [])].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
  );

  if (!events.length) {
    return (
      <p className={cn('text-[11px] text-slate-500 italic', className)}>
        Sin eventos de ciclo de vida registrados.
      </p>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Historial</p>
      <ol className="relative border-l border-slate-700/60 pl-3 space-y-2">
        {events.map((ev, i) => {
          const detail = formatDetail(ev.detail);
          return (
            <li key={`${ev.at}-${i}`} className="text-[11px]">
              <span className="absolute -left-[5px] mt-1 size-2 rounded-full bg-violet-500/80" />
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-medium text-slate-200">
                  {EVENT_LABEL[ev.type] ?? ev.type}
                </span>
                <span className="text-slate-500 tabular-nums">{formatWhen(ev.at)}</span>
                {ev.actor ? (
                  <span className="text-slate-500 truncate max-w-[140px]">{ev.actor}</span>
                ) : null}
              </div>
              {detail ? <p className="text-slate-400 mt-0.5 line-clamp-2">{detail}</p> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
