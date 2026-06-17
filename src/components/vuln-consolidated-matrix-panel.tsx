'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, FileSpreadsheet, Loader2, RefreshCw, Search, Table2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  deleteAllFindingsInRepository,
  listAllAssets,
  listAllFindingsInRepository,
  type Finding,
  type SecopsAsset,
} from '@/lib/secops-api';
import {
  rowMatchesMatrixView,
  VULN_MATRIX_VIEW_OPTIONS,
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

type VulnConsolidatedMatrixPanelProps = {
  refreshToken?: number;
};

function friendlyLoadError(message: string): string {
  if (/less than or equal to 5000/i.test(message)) {
    return 'Límite de carga del servidor alcanzado.';
  }
  return message;
}

export function VulnConsolidatedMatrixPanel({ refreshToken }: VulnConsolidatedMatrixPanelProps) {
  const [viewId, setViewId] = useState<VulnMatrixViewId>('completa');
  const [toolSourceFilter, setToolSourceFilter] = useState<ToolSourceFilterId>('all');
  const [searchQ, setSearchQ] = useState('');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [assets, setAssets] = useState<SecopsAsset[]>([]);
  const [repoTotal, setRepoTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [columnFilters, setColumnFilters] = useState<MatrixColumnFilters>({});
  const [matrixSort, setMatrixSort] = useState<MatrixSort | null>(null);
  const [clearingTable, setClearingTable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setWarning(null);
    const tool_source = toolSourceFilterApiValue(toolSourceFilter);

    try {
      const [findingsResult, assetResult] = await Promise.allSettled([
        listAllFindingsInRepository({ tool_source }),
        listAllAssets(),
      ]);

      if (findingsResult.status === 'fulfilled') {
        const { findings: loaded, truncated: isTruncated, totalInDb } = findingsResult.value;
        setFindings(loaded);
        setTruncated(isTruncated);
        setRepoTotal(totalInDb);
      } else {
        setFindings([]);
        setRepoTotal(0);
        setTruncated(false);
        setError(
          friendlyLoadError(
            findingsResult.reason instanceof Error
              ? findingsResult.reason.message
              : 'No se pudieron cargar hallazgos'
          )
        );
      }

      if (assetResult.status === 'fulfilled') {
        setAssets(assetResult.value);
      } else {
        setAssets([]);
        const msg =
          assetResult.reason instanceof Error ? assetResult.reason.message : 'Error al cargar activos';
        setWarning(friendlyLoadError(msg));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [toolSourceFilter]);

  useEffect(() => {
    void load();
  }, [load, refreshToken, reloadTick]);

  const assetById = useMemo(() => {
    const map = new Map<string, SecopsAsset>();
    for (const a of assets) map.set(a.id, a);
    return map;
  }, [assets]);

  const matrixRows = useMemo(() => {
    const out: { finding: Finding; asset?: SecopsAsset | null; sourceIndex: number }[] = [];
    let idx = 0;
    for (const finding of findings) {
      const asset = finding.asset_id ? assetById.get(finding.asset_id) ?? null : null;
      if (!rowMatchesMatrixView(finding, asset, viewId)) continue;
      if (severityFilter !== 'all' && finding.severidad !== severityFilter) continue;
      if (!matchesReviewFilter(finding, reviewFilter)) continue;
      out.push({ finding, asset, sourceIndex: idx });
      idx += 1;
    }
    return out;
  }, [findings, assetById, viewId, severityFilter, reviewFilter]);

  const severityCounts = useMemo(() => {
    const counts: Record<Severity, number> = {
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0,
      Info: 0,
    };
    for (const finding of findings) {
      const asset = finding.asset_id ? assetById.get(finding.asset_id) ?? null : null;
      if (!rowMatchesMatrixView(finding, asset, viewId)) continue;
      counts[finding.severidad] += 1;
    }
    return counts;
  }, [findings, assetById, viewId]);

  const actionTargets = useMemo(() => matrixRows.map((r) => r.finding), [matrixRows]);

  const activeView = VULN_MATRIX_VIEW_OPTIONS.find((v) => v.id === viewId)!;

  const handleClearTable = useCallback(async () => {
    if (repoTotal <= 0) return;
    const tool_source = toolSourceFilterApiValue(toolSourceFilter);
    const scope =
      toolSourceFilter === 'all'
        ? `las ${repoTotal.toLocaleString()} vulnerabilidades del repositorio`
        : `${repoTotal.toLocaleString()} vulnerabilidades (filtro de fuente activo)`;
    const ok = window.confirm(
      `¿Eliminar ${scope}?\n\nEsta acción es permanente y no se puede deshacer.`
    );
    if (!ok) return;
    setClearingTable(true);
    setError(null);
    try {
      const deleted = await deleteAllFindingsInRepository(
        tool_source ? { tool_source } : undefined
      );
      setReloadTick((n) => n + 1);
      if (deleted === 0) {
        setWarning('No se eliminó ningún hallazgo.');
      } else {
        setWarning(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo vaciar la tabla');
    } finally {
      setClearingTable(false);
    }
  }, [repoTotal, toolSourceFilter]);

  return (
    <div className="space-y-0">
      <div className="border-b border-border/70 bg-muted/10 px-3 py-2 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[10rem] flex-1 max-w-xs">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-8 text-xs bg-background"
              placeholder="Buscar…"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
          </div>
          <span className="text-[11px] tabular-nums text-muted-foreground whitespace-nowrap">
            <Table2 className="inline size-3 mr-0.5" />
            <span className="font-medium text-foreground">{matrixRows.length}</span>/{repoTotal} ·{' '}
            {VULN_MATRIX_PRIMARY_COLUMN_IDS.length} cols
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-[11px] text-destructive border-destructive/40 hover:bg-destructive/10"
            disabled={loading || clearingTable || repoTotal <= 0}
            onClick={() => void handleClearTable()}
          >
            {clearingTable ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
            Vaciar tabla
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-[11px]"
            disabled={loading || matrixRows.length === 0}
            onClick={() => downloadVulnMatrixCsv(matrixRows)}
            title="Exportar filas visibles a CSV"
          >
            <Download className="size-3.5" />
            CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-[11px]"
            disabled={loading || matrixRows.length === 0}
            onClick={() => downloadVulnMatrixExcel(matrixRows)}
            title="Exportar filas visibles a Excel"
          >
            <FileSpreadsheet className="size-3.5" />
            Excel
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 ml-auto gap-1 px-2 text-[11px]"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Actualizar
          </Button>
        </div>

        <div className="flex flex-wrap gap-0.5 rounded-md border border-border/60 bg-background p-0.5">
          {VULN_MATRIX_VIEW_OPTIONS.map((opt) => (
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
          <span className="text-[10px] text-muted-foreground mr-1">Fuente</span>
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
              {opt.id === 'all' ? 'Todas' : opt.label}
            </button>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground">{activeView.description}</p>

        <VulnMatrixActionsBar
          targets={actionTargets}
          severityCounts={severityCounts}
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
            <p className="text-amber-700 dark:text-amber-300">Datos truncados — usa filtro por fuente.</p>
          ) : null}
        </div>
      )}

      <div className="p-3">
        <VulnMatrixExcelGrid
          rows={matrixRows}
          loading={loading}
          searchQuery={searchQ}
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
