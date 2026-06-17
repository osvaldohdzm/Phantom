'use client';

import { cn } from '@/lib/utils';
import type { Finding } from '@/lib/secops-api';
import {
  detectionSourceLabels,
  formatCatalogDate,
  globalStatusLabel,
  hasMasterCatalogMeta,
  resolveSyncStatusVisual,
  SYNC_STATUS_DOT,
  SYNC_STATUS_LABEL,
} from '@/lib/finding-master-catalog';

type FindingMasterCatalogMetaProps = {
  finding: Finding;
  className?: string;
};

export function FindingMasterCatalogMeta({ finding, className }: FindingMasterCatalogMetaProps) {
  if (!hasMasterCatalogMeta(finding)) return null;

  const syncVisual = resolveSyncStatusVisual(finding);
  const sources = detectionSourceLabels(finding);
  const projects = finding.origin_projects ?? [];

  return (
    <div
      className={cn(
        'rounded-md border border-slate-800/80 bg-slate-900/40 p-3 space-y-2 text-[11px]',
        className
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        Catálogo maestro
      </p>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="inline-flex items-center gap-1 rounded border border-slate-700/60 px-1.5 py-0.5 text-slate-300">
          {SYNC_STATUS_DOT[syncVisual]} {SYNC_STATUS_LABEL[syncVisual]}
        </span>
        {finding.global_status ? (
          <span className="rounded border border-sky-800/50 bg-sky-950/30 px-1.5 py-0.5 text-sky-300">
            {globalStatusLabel(finding.global_status)}
          </span>
        ) : null}
        {sources.map((src) => (
          <span
            key={src}
            className="rounded border border-violet-800/40 bg-violet-950/20 px-1.5 py-0.5 text-violet-300"
          >
            {src}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-400">
        <span>
          <span className="text-slate-500">Primera vez:</span>{' '}
          {formatCatalogDate(finding.first_seen)}
        </span>
        <span>
          <span className="text-slate-500">Última vez:</span>{' '}
          {formatCatalogDate(finding.last_seen)}
        </span>
      </div>

      {projects.length > 0 ? (
        <div>
          <p className="text-slate-500 mb-1">Proyectos de origen</p>
          <ul className="space-y-0.5">
            {projects.map((p, i) => (
              <li key={p.engagement_id ?? i} className="text-slate-300">
                {p.name || 'Proyecto'}
                {p.last_seen ? (
                  <span className="text-slate-500 ml-1">({formatCatalogDate(p.last_seen)})</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {finding.ai_summary ? (
        <div>
          <p className="text-slate-500 mb-0.5">Resumen IA</p>
          <p className="text-slate-300 line-clamp-3">{finding.ai_summary}</p>
        </div>
      ) : null}
    </div>
  );
}
