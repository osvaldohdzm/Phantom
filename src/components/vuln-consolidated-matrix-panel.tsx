'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Download, FileSpreadsheet, Loader2, RefreshCw, Search, Table2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  deleteAllFindingsInRepository,
  fetchFindingsSeverityBreakdown,
  listAllAssets,
  streamAllFindingsInRepository,
  FINDINGS_LIST_MAX,
  type Finding,
  type SecopsAsset,
} from '@/lib/secops-api';
import {
  rowMatchesMatrixView,
  type VulnMatrixViewId,
} from '@/lib/vuln-matrix-classify';
import {
  TOOL_SOURCE_FILTER_OPTIONS,
  toolSourceFilterApiValue,
  type ToolSourceFilterId,
} from '@/lib/finding-source-filters';
import { VULN_MATRIX_PRIMARY_COLUMN_IDS } from '@/lib/vuln-matrix-columns';
import { VulnMatrixExcelGrid } from '@/components/vuln-matrix-excel-grid';
import { VulnMatrixActionsBar } from '@/components/vuln-matrix-actions-bar';
import { matchesReviewFilter, type ReviewFilter } from '@/lib/finding-completeness';
import type { Severity } from '@/lib/secops-api';
import type { MatrixColumnFilters, MatrixSort } from '@/lib/vuln-matrix-filters';
import { downloadVulnMatrixCsv, downloadVulnMatrixExcel } from '@/lib/vuln-matrix-export';
import { LongTaskProgress } from '@/components/long-task-progress';
import type { LoadProgress } from '@/lib/eta-progress';
import { useUiT } from '@/lib/use-ui-locale';

type VulnConsolidatedMatrixPanelProps = {
  refreshToken?: number;
};

export function VulnConsolidatedMatrixPanel({ refreshToken }: VulnConsolidatedMatrixPanelProps) {
  const { t, format, matrixViews } = useUiT();
  const viewOptions = matrixViews();

  const friendlyLoadError = useCallback(
    (message: string): string => {
      if (/less than or equal to 100,?000/i.test(message)) {
        return t('matrixLoadLimit');
      }
      return message;
    },
    [t]
  );
  const [viewId, setViewId] = useState<VulnMatrixViewId>('completa');
  const [toolSourceFilter, setToolSourceFilter] = useState<ToolSourceFilterId>('all');
  const [searchQ, setSearchQ] = useState('');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [assets, setAssets] = useState<SecopsAsset[]>([]);
  const [repoTotal, setRepoTotal] = useState(0);
  const [serverSeverityCounts, setServerSeverityCounts] = useState<Record<Severity, number> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [columnFilters, setColumnFilters] = useState<MatrixColumnFilters>({});
  const [matrixSort, setMatrixSort] = useState<MatrixSort | null>(null);
  const [clearingTable, setClearingTable] = useState(false);
  const [loadProgress, setLoadProgress] = useState<LoadProgress | null>(null);
  const [clearProgress, setClearProgress] = useState<LoadProgress | null>(null);
  const deferredSearch = useDeferredValue(searchQ);
  const deferredFindings = useDeferredValue(findings);
  const loadAbortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    const { signal } = controller;

    setLoading(true);
    setStreaming(false);
    setError(null);
    setWarning(null);
    setFindings([]);
    setRepoTotal(0);
    setServerSeverityCounts(null);
    setTruncated(false);
    setLoadProgress({ phase: 'counting', loaded: 0, total: 0 });
    const tool_source = toolSourceFilterApiValue(toolSourceFilter);

    // Conteo por severidad agregado en el servidor (1 query indexada): pinta el total
    // y las insignias al instante, sin esperar a que bajen las ~50k filas.
    void fetchFindingsSeverityBreakdown({ tool_source: tool_source ?? undefined }, signal)
      .then((b) => {
        if (signal.aborted) return;
        setServerSeverityCounts(b.by_severity);
        setRepoTotal((prev) => (prev > 0 ? prev : b.total));
      })
      .catch(() => {
        /* el conteo cliente cubre el fallback */
      });

    // Coalesce streamed batches so we re-render at most a few times per second
    // instead of once per network response (smooth while 50k rows arrive).
    const buffer: Finding[] = [];
    let flushTimer: number | null = null;
    const flush = () => {
      flushTimer = null;
      if (signal.aborted || buffer.length === 0) return;
      const chunk = buffer.splice(0, buffer.length);
      setFindings((prev) => prev.concat(chunk));
    };
    const scheduleFlush = () => {
      if (flushTimer != null) return;
      flushTimer = window.setTimeout(flush, 80);
    };

    let firstBatch = true;

    // Assets load in parallel; they only affect view classification, so they
    // must not block findings from streaming into the table.
    void listAllAssets()
      .then((a) => {
        if (!signal.aborted) setAssets(a);
      })
      .catch((e) => {
        if (signal.aborted) return;
        setAssets([]);
        setWarning(friendlyLoadError(e instanceof Error ? e.message : t('matrixLoadAssetsError')));
      });

    try {
      const { totalInDb, truncated: isTruncated } = await streamAllFindingsInRepository({
        tool_source,
        signal,
        onBatch: (batch, info) => {
          buffer.push(...batch);
          scheduleFlush();
          setRepoTotal(info.total);
          if (firstBatch && batch.length > 0) {
            firstBatch = false;
            setLoading(false);
            setStreaming(true);
          }
        },
        onProgress: (p) => {
          if (!signal.aborted) setLoadProgress(p);
        },
      });
      if (flushTimer != null) window.clearTimeout(flushTimer);
      flush();
      if (signal.aborted) return;
      setTruncated(isTruncated);
      setRepoTotal(totalInDb);
    } catch (e) {
      if (signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) return;
      setError(
        friendlyLoadError(e instanceof Error ? e.message : t('matrixLoadFindingsError'))
      );
    } finally {
      if (loadAbortRef.current === controller) {
        setLoading(false);
        setStreaming(false);
        setLoadProgress(null);
      }
    }
  }, [toolSourceFilter, friendlyLoadError, t]);

  useEffect(() => {
    void load();
  }, [load, refreshToken, reloadTick]);

  useEffect(() => () => loadAbortRef.current?.abort(), []);

  const assetById = useMemo(() => {
    const map = new Map<string, SecopsAsset>();
    for (const a of assets) map.set(a.id, a);
    return map;
  }, [assets]);

  const matrixRows = useMemo(() => {
    const out: { finding: Finding; asset?: SecopsAsset | null; sourceIndex: number }[] = [];
    let idx = 0;
    for (const finding of deferredFindings) {
      const asset = finding.asset_id ? assetById.get(finding.asset_id) ?? null : null;
      if (!rowMatchesMatrixView(finding, asset, viewId)) continue;
      if (severityFilter !== 'all' && finding.severidad !== severityFilter) continue;
      if (!matchesReviewFilter(finding, reviewFilter)) continue;
      out.push({ finding, asset, sourceIndex: idx });
      idx += 1;
    }
    return out;
  }, [deferredFindings, assetById, viewId, severityFilter, reviewFilter]);

  const severityCounts = useMemo(() => {
    const counts: Record<Severity, number> = {
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0,
      Info: 0,
    };
    for (const finding of deferredFindings) {
      const asset = finding.asset_id ? assetById.get(finding.asset_id) ?? null : null;
      if (!rowMatchesMatrixView(finding, asset, viewId)) continue;
      counts[finding.severidad] += 1;
    }
    return counts;
  }, [deferredFindings, assetById, viewId]);

  // En la vista del repositorio completo (sin clasificación por activo) el conteo del
  // servidor es exacto y aparece al instante; en vistas derivadas usamos el del cliente.
  const displaySeverityCounts = useMemo(() => {
    if (viewId === 'completa' && reviewFilter === 'all' && serverSeverityCounts) {
      return serverSeverityCounts;
    }
    return severityCounts;
  }, [viewId, reviewFilter, serverSeverityCounts, severityCounts]);

  const actionTargets = useMemo(() => matrixRows.map((r) => r.finding), [matrixRows]);

  const activeView = viewOptions.find((v) => v.id === viewId)!;

  const handleClearTable = useCallback(async () => {
    if (repoTotal <= 0) return;
    const tool_source = toolSourceFilterApiValue(toolSourceFilter);
    const count = repoTotal.toLocaleString();
    const ok = window.confirm(
      toolSourceFilter === 'all'
        ? format('matrixConfirmDeleteAll', { count })
        : format('matrixConfirmDeleteFiltered', { count })
    );
    if (!ok) return;
    setClearingTable(true);
    setError(null);
    setClearProgress({ phase: 'deleting', loaded: 0, total: repoTotal });
    try {
      const deleted = await deleteAllFindingsInRepository({
        ...(tool_source ? { tool_source } : {}),
        onProgress: (p) => setClearProgress(p),
      });
      setReloadTick((n) => n + 1);
      if (deleted === 0) {
        setWarning(t('matrixClearNone'));
      } else {
        setWarning(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('matrixClearError'));
    } finally {
      setClearingTable(false);
      setClearProgress(null);
    }
  }, [repoTotal, toolSourceFilter, format, t]);

  return (
    <div className="space-y-0">
      <div className="border-b border-border/70 bg-muted/10 px-3 py-2 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[10rem] flex-1 max-w-xs">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-8 text-xs bg-background"
              placeholder={t('matrixSearch')}
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
          </div>
          <span className="text-[11px] tabular-nums text-muted-foreground whitespace-nowrap">
            <Table2 className="inline size-3 mr-0.5" />
            <span className="font-medium text-foreground">{matrixRows.length}</span>/{repoTotal} ·{' '}
            {VULN_MATRIX_PRIMARY_COLUMN_IDS.length} {t('matrixCols')}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-[11px] text-destructive border-destructive/40 hover:bg-destructive/10"
            disabled={loading || streaming || clearingTable || repoTotal <= 0}
            onClick={() => void handleClearTable()}
          >
            {clearingTable ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
            {t('matrixClearTable')}
          </Button>
          <span
            className="text-[10px] text-muted-foreground hidden sm:inline"
            title={t('matrixClearTableTitle')}
          >
            {t('matrixResetRepo')}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-[11px]"
            disabled={loading || streaming || matrixRows.length === 0}
            onClick={() => downloadVulnMatrixCsv(matrixRows)}
            title={t('matrixExportCsvTitle')}
          >
            <Download className="size-3.5" />
            CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-[11px]"
            disabled={loading || streaming || matrixRows.length === 0}
            onClick={() => downloadVulnMatrixExcel(matrixRows)}
            title={t('matrixExportExcelTitle')}
          >
            <FileSpreadsheet className="size-3.5" />
            Excel
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 ml-auto gap-1 px-2 text-[11px]"
            disabled={loading || streaming}
            onClick={() => void load()}
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            {t('matrixRefresh')}
          </Button>
        </div>

        <div className="flex flex-wrap gap-0.5 rounded-md border border-border/60 bg-background p-0.5">
          {viewOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              title={opt.label}
              onClick={() => setViewId(opt.id)}
              className={cn(
                'flex-1 min-w-[4rem] rounded px-1.5 py-1 text-[10px] sm:text-[11px]',
                viewId === opt.id
                  ? 'bg-foreground text-background font-medium'
                  : 'text-muted-foreground hover:bg-muted/50'
              )}
            >
              {opt.short}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-muted-foreground mr-1">{t('matrixSource')}</span>
          {TOOL_SOURCE_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setToolSourceFilter(opt.id)}
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] border',
                toolSourceFilter === opt.id
                  ? 'border-violet-500/60 bg-violet-500/15 font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {opt.id === 'all' ? t('matrixAll') : opt.label}
            </button>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground">{activeView.description}</p>

        <VulnMatrixActionsBar
          targets={actionTargets}
          severityCounts={displaySeverityCounts}
          severityFilter={severityFilter}
          onSeverityFilterChange={setSeverityFilter}
          reviewFilter={reviewFilter}
          onReviewFilterChange={setReviewFilter}
          columnFilterCount={Object.keys(columnFilters).length}
          onClearColumnFilters={() => setColumnFilters({})}
          onReload={() => setReloadTick((n) => n + 1)}
        />
      </div>

      {(error || warning || truncated) && (
        <div className="border-b border-border/50 px-3 py-1.5 text-xs space-y-0.5">
          {error ? (
            <p className="text-destructive flex items-center gap-1">
              <AlertTriangle className="size-3.5" /> {error}
            </p>
          ) : null}
          {warning ? <p className="text-amber-700 dark:text-amber-300">{warning}</p> : null}
          {truncated ? (
            <p className="text-amber-700 dark:text-amber-300">
              {format('matrixTruncated', { max: FINDINGS_LIST_MAX.toLocaleString() })}
            </p>
          ) : null}
        </div>
      )}

      {(loadProgress && (loading || streaming)) || clearProgress ? (
        <div className="border-b border-border/50 px-3 py-2">
          {loadProgress && (loading || streaming) ? (
            <LongTaskProgress
              title={t('matrixLoadingTitle')}
              phase={loadProgress.label}
              loaded={loadProgress.loaded}
              total={loadProgress.total}
              hint={streaming ? t('matrixStreamingHint') : t('matrixLoadingHint')}
            />
          ) : null}
          {clearProgress ? (
            <LongTaskProgress
              title={t('matrixClearingTitle')}
              phase={clearProgress.label}
              loaded={clearProgress.loaded}
              total={clearProgress.total}
              hint={t('matrixClearingHint')}
            />
          ) : null}
        </div>
      ) : null}

      <div className="p-3">
        <VulnMatrixExcelGrid
          rows={matrixRows}
          loading={loading}
          streaming={streaming}
          searchQuery={deferredSearch}
          columnFilters={columnFilters}
          onColumnFiltersChange={setColumnFilters}
          sort={matrixSort}
          onSortChange={setMatrixSort}
          onSaved={() => setReloadTick((n) => n + 1)}
        />
      </div>
    </div>
  );
}
