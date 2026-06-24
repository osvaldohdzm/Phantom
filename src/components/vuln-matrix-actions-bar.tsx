'use client';

import { useState } from 'react';
import { Loader2, RefreshCw, Sparkles, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Finding } from '@/lib/secops-api';
import {
  consolidateMasterCatalogApi,
  enrichFinding,
  syncFindingsFromCatalogApi,
} from '@/lib/secops-api';
import { SeverityBadge } from '@/components/severity-badge';
import type { Severity } from '@/lib/secops-api';
import type { ReviewFilter } from '@/lib/finding-completeness';
import { useUiT } from '@/lib/use-ui-locale';

const ALL_SEVERITIES: Severity[] = ['Critical', 'High', 'Medium', 'Low', 'Info'];

type VulnMatrixActionsBarProps = {
  targets: Finding[];
  severityCounts: Record<Severity, number>;
  severityFilter: Severity | 'all';
  onSeverityFilterChange: (sev: Severity | 'all') => void;
  reviewFilter: ReviewFilter;
  onReviewFilterChange: (filter: ReviewFilter) => void;
  columnFilterCount: number;
  onClearColumnFilters: () => void;
  onReload: () => void;
};

export function VulnMatrixActionsBar({
  targets,
  severityCounts,
  severityFilter,
  onSeverityFilterChange,
  reviewFilter,
  onReviewFilterChange,
  columnFilterCount,
  onClearColumnFilters,
  onReload,
}: VulnMatrixActionsBarProps) {
  const { t, format, reviewFilters } = useUiT();
  const reviewFilterOptions = reviewFilters();
  const [busy, setBusy] = useState<'gemini' | 'consolidate' | 'sync' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [geminiProgress, setGeminiProgress] = useState<{ done: number; total: number } | null>(null);

  const ids = targets.map((f) => f.id);
  const disabled = busy !== null || ids.length === 0;

  const runGeminiBatch = async () => {
    const batch = targets.slice(0, 25);
    if (!batch.length) return;
    setBusy('gemini');
    setError(null);
    setNotice(null);
    setGeminiProgress({ done: 0, total: batch.length });
    let ok = 0;
    const errors: string[] = [];
    for (let i = 0; i < batch.length; i++) {
      try {
        await enrichFinding(batch[i].id);
        ok += 1;
      } catch (e) {
        errors.push(e instanceof Error ? e.message : 'Error');
      }
      setGeminiProgress({ done: i + 1, total: batch.length });
    }
    setNotice(
      `Gemini: ${ok}/${batch.length} fila(s) enriquecida(s)` +
        (batch.length < targets.length ? ` (lote de 25)` : '') +
        '.'
    );
    if (errors.length) setError(errors[0]);
    setBusy(null);
    setGeminiProgress(null);
    onReload();
  };

  const runConsolidate = async () => {
    setBusy('consolidate');
    setError(null);
    setNotice(null);
    try {
      const result = await consolidateMasterCatalogApi({ finding_ids: ids });
      setNotice(
        `Consolidado: ${result.synced} en catálogo · ${result.groups} grupo(s)` +
          (result.skipped > 0 ? ` · ${result.skipped} omitidos` : '') +
          '.'
      );
      if (result.errors.length) setError(`${result.errors.length} error(es).`);
      onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al consolidar');
    } finally {
      setBusy(null);
    }
  };

  const runSync = async () => {
    setBusy('sync');
    setError(null);
    setNotice(null);
    try {
      const result = await syncFindingsFromCatalogApi({ finding_ids: ids });
      setNotice(`Sync catálogo: ${result.synced} actualizado(s) · ${result.skipped} omitidos.`);
      if (result.errors.length) setError(`${result.errors.length} error(es).`);
      onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al sincronizar');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2 border-t border-border/50 pt-2">
      <div className="flex flex-wrap items-center gap-1">
        {ALL_SEVERITIES.map((sev) => {
          const count = severityCounts[sev] ?? 0;
          if (!count) return null;
          const active = severityFilter === sev;
          return (
            <button
              key={sev}
              type="button"
              onClick={() => onSeverityFilterChange(active ? 'all' : sev)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition-colors',
                active ? 'border-violet-500/60 bg-violet-500/10' : 'border-transparent hover:bg-muted/60'
              )}
            >
              <SeverityBadge severity={sev} className="text-[9px] px-1 py-0" />
              <span className="text-[10px] tabular-nums text-muted-foreground">{count}</span>
            </button>
          );
        })}
        {severityFilter !== 'all' ? (
          <button
            type="button"
            className="text-[10px] text-muted-foreground underline"
            onClick={() => onSeverityFilterChange('all')}
          >
            {t('matrixRemoveSeverity')}
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-border/60 bg-background p-0.5">
          {reviewFilterOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onReviewFilterChange(opt.id)}
              className={cn(
                'rounded px-2 py-0.5 text-[10px]',
                reviewFilter === opt.id
                  ? 'bg-foreground text-background font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <Button
          type="button"
          size="sm"
          className="h-7 gap-1 text-[11px] bg-foreground text-background hover:bg-foreground/90"
          disabled={disabled}
          onClick={() => void runGeminiBatch()}
        >
          {busy === 'gemini' ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          Gemini ({ids.length.toLocaleString()})
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-[11px]"
          disabled={disabled}
          onClick={() => void runConsolidate()}
        >
          {busy === 'consolidate' ? <Loader2 className="size-3.5 animate-spin" /> : <Wrench className="size-3.5" />}
          {t('matrixConsolidate')}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-[11px]"
          disabled={disabled}
          onClick={() => void runSync()}
        >
          {busy === 'sync' ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Sync
        </Button>

        {columnFilterCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] text-violet-700"
            onClick={onClearColumnFilters}
          >
            {format('matrixClearColumnFilters', { n: columnFilterCount })}
          </Button>
        ) : null}

        {geminiProgress ? (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            Gemini {geminiProgress.done}/{geminiProgress.total}
          </span>
        ) : null}
        {notice ? <span className="text-[10px] text-emerald-700 dark:text-emerald-400">{notice}</span> : null}
        {error ? <span className="text-[10px] text-destructive">{error}</span> : null}
      </div>
    </div>
  );
}
