'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { Database, Loader2, Search } from 'lucide-react';
import type { Finding } from '@/lib/secops-api';
import type { SecopsAsset } from '@/lib/secops-api';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { SeverityBadge } from '@/components/severity-badge';
import type { Severity } from '@/lib/secops-api';
import {
  assetGroupKey,
  assetGroupLabel,
  type VulnMatrixViewId,
} from '@/lib/vuln-matrix-classify';
import {
  getVulnMatrixCellValue,
  matrixRowMatchesSearch,
  VULN_MATRIX_COLUMNS,
} from '@/lib/vuln-matrix-columns';
import { sortBySeverity } from '@/lib/severity-sort';

const ROW_HEIGHT = 30;

export type MatrixTableRow = {
  finding: Finding;
  asset?: SecopsAsset | null;
  sourceIndex: number;
};

type VulnMatrixTableProps = {
  rows: MatrixTableRow[];
  viewId: VulnMatrixViewId;
  loading?: boolean;
  groupByAsset?: boolean;
  repoEmpty?: boolean;
};

type DisplayRow =
  | { kind: 'group'; key: string; label: string; count: number }
  | { kind: 'data'; row: MatrixTableRow; folio: number; zebra: number };

/** Desplazamiento izquierdo acumulado para columnas sticky. */
const STICKY_OFFSETS = (() => {
  const map = new Map<string, number>();
  let left = 0;
  for (const col of VULN_MATRIX_COLUMNS) {
    if (col.sticky) {
      map.set(col.id, left);
      left += col.width;
    }
  }
  return map;
})();

export function VulnMatrixTable({
  rows,
  viewId,
  loading,
  groupByAsset = true,
  repoEmpty,
}: VulnMatrixTableProps) {
  const [searchQ, setSearchQ] = useState('');
  const deferredSearch = useDeferredValue(searchQ);

  const displayRows = useMemo((): DisplayRow[] => {
    let filtered = rows.filter((r) =>
      matrixRowMatchesSearch(r.finding, r.asset, deferredSearch, r.sourceIndex)
    );
    filtered = sortBySeverity(filtered, (r) => r.finding.severidad);

    if (groupByAsset) {
      const byAsset = new Map<string, MatrixTableRow[]>();
      for (const row of filtered) {
        const key = assetGroupKey(row.finding, row.asset);
        const list = byAsset.get(key) ?? [];
        list.push(row);
        byAsset.set(key, list);
      }
      const out: DisplayRow[] = [];
      let folio = 0;
      let zebra = 0;
      const groups = [...byAsset.entries()].sort((a, b) =>
        assetGroupLabel(a[1][0].finding, a[1][0].asset).localeCompare(
          assetGroupLabel(b[1][0].finding, b[1][0].asset),
          'es'
        )
      );
      for (const [key, members] of groups) {
        out.push({
          kind: 'group',
          key,
          label: assetGroupLabel(members[0].finding, members[0].asset),
          count: members.length,
        });
        const sorted = sortBySeverity(members, (r) => r.finding.severidad);
        for (const row of sorted) {
          folio += 1;
          zebra += 1;
          out.push({ kind: 'data', row, folio, zebra });
        }
      }
      return out;
    }

    return filtered.map((row, i) => ({
      kind: 'data' as const,
      row,
      folio: i + 1,
      zebra: i,
    }));
  }, [rows, deferredSearch, groupByAsset]);

  const dataRowCount = displayRows.filter((r) => r.kind === 'data').length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-sm bg-background"
            placeholder="Buscar activo, CVE, título, IP…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            disabled={loading}
          />
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground whitespace-nowrap">
          {loading ? 'Cargando…' : `${dataRowCount.toLocaleString()} filas`}
          {groupByAsset && !loading ? ' · por activo' : ''}
        </span>
      </div>

      <div className="relative rounded-lg border border-border overflow-hidden bg-background">
        <div className="pointer-events-none absolute right-2 top-2 z-40 rounded bg-background/90 px-1.5 py-0.5 text-[9px] text-muted-foreground border border-border/60 shadow-sm">
          ↔ {VULN_MATRIX_COLUMNS.length} cols
        </div>
        <div className="overflow-auto max-h-[min(65vh,680px)]">
          <table className="w-max min-w-full border-collapse text-[11px]">
            <thead className="sticky top-0 z-30 bg-muted shadow-[0_1px_0_0_hsl(var(--border))]">
              <tr>
                {VULN_MATRIX_COLUMNS.map((col) => {
                  const stickyLeft = STICKY_OFFSETS.get(col.id);
                  return (
                    <th
                      key={col.id}
                      className={cn(
                        'border-b border-r border-border/50 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap',
                        col.sticky && 'sticky z-40 bg-muted'
                      )}
                      style={{
                        minWidth: col.width,
                        maxWidth: col.width,
                        ...(col.sticky && stickyLeft != null ? { left: stickyLeft } : {}),
                      }}
                    >
                      {col.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={VULN_MATRIX_COLUMNS.length} className="py-16 text-center">
                    <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                    <p className="mt-2 text-xs text-muted-foreground">Cargando matriz…</p>
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td colSpan={VULN_MATRIX_COLUMNS.length} className="py-14 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-muted-foreground">
                      <Database className="size-8 opacity-40" />
                      <p className="text-sm font-medium text-foreground">
                        {repoEmpty ? 'Repositorio vacío' : 'Sin resultados en esta vista'}
                      </p>
                      <p className="text-xs leading-relaxed">
                        {repoEmpty
                          ? 'Importa Nessus, Acunetix, Nmap o CSV en la sección de carga inferior.'
                          : 'Prueba otra vista (Completa / Int. / Ext.) o cambia el filtro de fuente.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayRows.map((item) => {
                  if (item.kind === 'group') {
                    return (
                      <tr key={`g-${item.key}`} className="bg-violet-500/6">
                        <td
                          colSpan={VULN_MATRIX_COLUMNS.length}
                          className="border-b border-violet-500/15 px-3 py-1.5"
                        >
                          <span className="inline-flex items-center gap-2 text-[11px] font-semibold text-violet-900 dark:text-violet-100">
                            <span className="size-1.5 rounded-full bg-violet-500" aria-hidden />
                            {item.label}
                            <span className="font-normal text-muted-foreground">
                              {item.count} vuln.
                            </span>
                          </span>
                        </td>
                      </tr>
                    );
                  }
                  const { finding, asset } = item.row;
                  const zebra = item.zebra % 2 === 0;
                  return (
                    <tr
                      key={finding.id}
                      className={cn(
                        'group/row transition-colors hover:bg-violet-500/5',
                        zebra ? 'bg-card' : 'bg-muted/20'
                      )}
                      style={{ height: ROW_HEIGHT }}
                    >
                      {VULN_MATRIX_COLUMNS.map((col) => {
                        const raw = getVulnMatrixCellValue(
                          finding,
                          asset,
                          col.id,
                          item.folio - 1
                        );
                        const isSeverity =
                          col.id === 'severidad' || col.id === 'severidad_modificada';
                        const isLong = raw.length > 100;
                        const display = isLong ? `${raw.slice(0, 97)}…` : raw;
                        const stickyLeft = STICKY_OFFSETS.get(col.id);
                        return (
                          <td
                            key={col.id}
                            title={isLong ? raw : undefined}
                            className={cn(
                              'border-b border-r border-border/30 px-2 py-0.5 align-middle truncate max-w-[220px]',
                              col.sticky &&
                                'sticky z-20 bg-inherit group-hover/row:bg-violet-500/5',
                              col.id === 'nombre_hallazgo' && 'font-medium text-foreground'
                            )}
                            style={{
                              minWidth: col.width,
                              maxWidth: col.width,
                              ...(col.sticky && stickyLeft != null ? { left: stickyLeft } : {}),
                            }}
                          >
                            {isSeverity && raw ? (
                              <SeverityBadge severity={raw as Severity} compact />
                            ) : display ? (
                              display
                            ) : (
                              <span className="text-muted-foreground/35">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
