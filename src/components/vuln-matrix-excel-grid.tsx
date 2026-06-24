'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Columns3, Loader2, Sparkles } from 'lucide-react';
import { AssetExcelGrid } from '@/components/asset-excel-grid';
import { VulnMatrixColumnHeader } from '@/components/vuln-matrix-column-header';
import { VulnMatrixColumnPicker } from '@/components/vuln-matrix-column-picker';
import { isPrimaryMatrixColumn } from '@/lib/vuln-matrix-column-layout';
import { VulnMatrixSelectionActions } from '@/components/vuln-matrix-selection-actions';
import { MatrixFieldOptionsPanel } from '@/components/matrix-field-options-panel';
import type { AssetGridColumn } from '@/lib/asset-spreadsheet-columns';
import type { AssetGridRow } from '@/lib/asset-row-utils';
import { Button } from '@/components/ui/button';
import { bulkDeleteFindings, enrichFinding, listEvidence, updateFinding, updateFindingStatus, type Finding } from '@/lib/secops-api';
import { resolveEstadoSave } from '@/lib/matrix-field-options';
import type { EvidenceAttachment, SecopsAsset } from '@/lib/secops-api';
import {
  findingToMatrixGridRow,
  gridRowToFindingPatch,
  isMatrixColumnEditable,
  VULN_MATRIX_PRIMARY_COLUMN_IDS,
} from '@/lib/vuln-matrix-columns';
import {
  addOptionalMatrixColumns,
  fitColumnsToHeaderLabels,
  loadVulnMatrixGridColumns,
  saveVulnMatrixGridColumns,
} from '@/lib/vuln-matrix-column-layout';
import {
  applyMatrixColumnFilters,
  sortMatrixRows,
  uniqueMatrixColumnValues,
  type MatrixColumnFilter,
  type MatrixColumnFilters,
  type MatrixSort,
} from '@/lib/vuln-matrix-filters';
import { useUiT } from '@/lib/use-ui-locale';

export type MatrixTableRow = {
  finding: Finding;
  asset?: SecopsAsset | null;
  sourceIndex: number;
};

type VulnMatrixExcelGridProps = {
  rows: MatrixTableRow[];
  loading?: boolean;
  streaming?: boolean;
  searchQuery?: string;
  onSaved?: () => void;
  columnFilters?: MatrixColumnFilters;
  onColumnFiltersChange?: (filters: MatrixColumnFilters) => void;
  sort?: MatrixSort | null;
  onSortChange?: (sort: MatrixSort | null) => void;
};

export function VulnMatrixExcelGrid({
  rows,
  loading,
  streaming = false,
  searchQuery = '',
  onSaved,
  columnFilters: columnFiltersProp,
  onColumnFiltersChange,
  sort: sortProp,
  onSortChange,
}: VulnMatrixExcelGridProps) {
  const { t } = useUiT();
  const [columns, setColumns] = useState<AssetGridColumn[]>(() =>
    loadVulnMatrixGridColumns(isMatrixColumnEditable)
  );
  const [evidenceByFinding, setEvidenceByFinding] = useState<
    Record<string, EvidenceAttachment[]>
  >({});
  const [internalFilters, setInternalFilters] = useState<MatrixColumnFilters>({});
  const [internalSort, setInternalSort] = useState<MatrixSort | null>(null);
  const [gridRows, setGridRows] = useState<AssetGridRow[]>([]);
  const [activeRow, setActiveRow] = useState(0);
  const [selectionRange, setSelectionRange] = useState({ r1: 0, r2: 0, c1: 0, c2: 0 });
  const [geminiBusy, setGeminiBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [optionsTick, setOptionsTick] = useState(0);

  const columnFilters = columnFiltersProp ?? internalFilters;
  const setColumnFilters = onColumnFiltersChange ?? setInternalFilters;
  const sort = sortProp ?? internalSort;
  const setSort = onSortChange ?? setInternalSort;

  const processedRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = [...rows];
    if (q) {
      list = list.filter((r) => {
        const blob = [
          r.finding.titulo,
          r.finding.cve,
          r.finding.componente_afectado,
          r.asset?.nombre,
          r.finding.tool_source,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return blob.includes(q);
      });
    }
    list = applyMatrixColumnFilters(list, columnFilters);
    list = sortMatrixRows(list, sort);
    return list;
  }, [rows, searchQuery, columnFilters, sort]);

  const rowMeta = useMemo(
    () => processedRows.map((r) => ({ findingId: r.finding.id, finding: r.finding })),
    [processedRows]
  );

  const selectedFindingIds = useMemo(() => {
    const ids: string[] = [];
    for (let r = selectionRange.r1; r <= selectionRange.r2; r += 1) {
      const id = gridRows[r]?.id?.trim();
      if (id) ids.push(id);
    }
    return ids;
  }, [gridRows, selectionRange.r1, selectionRange.r2]);

  const selectionRowCount = selectionRange.r2 - selectionRange.r1 + 1;
  const selectionColCount = selectionRange.c2 - selectionRange.c1 + 1;
  const showSelectionActions = selectionRowCount > 1 || selectionColCount > 1;

  const uniqueByColumn = useMemo(() => {
    const map = new Map<string, string[]>();
    // Scanning every row for distinct values is 16×O(n); while the repository is
    // still streaming in (loading) we skip it so each batch flush stays cheap.
    // The column-filter dropdowns populate once the load settles.
    if (loading) return map;
    for (const col of columns.slice(0, 16)) {
      map.set(col.key, uniqueMatrixColumnValues(rows, col.key));
    }
    return map;
  }, [columns, rows, loading]);

  const evidenceColumnVisible = useMemo(
    () => columns.some((c) => c.key.startsWith('evidencia_')),
    [columns]
  );

  useEffect(() => {
    if (!evidenceColumnVisible) return;
    let cancelled = false;
    const ids = processedRows.map((r) => r.finding.id).slice(0, 40);
    if (!ids.length) return;

    void (async () => {
      const chunkSize = 6;
      for (let i = 0; i < ids.length; i += chunkSize) {
        if (cancelled) return;
        const chunk = ids.slice(i, i + chunkSize);
        const entries = await Promise.all(
          chunk.map(async (id) => {
            try {
              const list = await listEvidence(id);
              return [id, list] as const;
            } catch {
              return [id, []] as const;
            }
          })
        );
        if (cancelled) return;
        setEvidenceByFinding((prev) => {
          const next = { ...prev };
          for (const [id, list] of entries) next[id] = [...list];
          return next;
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [processedRows, evidenceColumnVisible]);

  useEffect(() => {
    setGridRows(
      processedRows.map((r, i) =>
        findingToMatrixGridRow(
          r.finding,
          r.asset,
          i,
          evidenceByFinding[r.finding.id]
        ) as AssetGridRow
      )
    );
  }, [processedRows, evidenceByFinding]);

  useEffect(() => {
    setActiveRow(0);
  }, [processedRows]);

  const handleColumnsChange = useCallback((next: AssetGridColumn[]) => {
    setColumns(next);
    saveVulnMatrixGridColumns(next);
  }, []);

  useEffect(() => {
    setColumns(loadVulnMatrixGridColumns(isMatrixColumnEditable));
  }, [optionsTick]);

  const handleAddOptionalColumns = useCallback(
    (ids: string[]) => {
      const next = addOptionalMatrixColumns(columns, ids, isMatrixColumnEditable);
      handleColumnsChange(next);
      setNotice(`${ids.length} columna(s) CYB001 agregadas.`);
    },
    [columns, handleColumnsChange]
  );

  const fitAllColumnsToHeaders = useCallback(() => {
    const fitted = fitColumnsToHeaderLabels(columns, { extraChrome: 58 });
    handleColumnsChange(fitted);
    setNotice('Columnas ajustadas al ancho de los títulos.');
  }, [columns, handleColumnsChange]);

  const handleSave = useCallback(
    async (dirtyRows: AssetGridRow[], deletedIds: string[]) => {
      if (deletedIds.length > 0) {
        await bulkDeleteFindings(deletedIds);
      }
      let saved = 0;
      for (const row of dirtyRows) {
        const findingId = row.id?.trim();
        if (!findingId) continue;
        const source = processedRows.find((r) => r.finding.id === findingId);
        const originalRow = source
          ? (findingToMatrixGridRow(
              source.finding,
              source.asset,
              source.sourceIndex,
              evidenceByFinding[findingId]
            ) as AssetGridRow)
          : null;
        const patch = gridRowToFindingPatch(row);

        if (patch.severidad && patch.severidad !== originalRow?.severidad) {
          await updateFinding(findingId, { severidad: patch.severidad });
          saved += 1;
        }

        if (patch.estado && patch.estado !== originalRow?.estado) {
          const { workflowStatus, seguimientoLabel } = resolveEstadoSave(patch.estado);
          if (workflowStatus) {
            await updateFindingStatus(findingId, workflowStatus, `Matriz: ${patch.estado}`);
          }
          if (seguimientoLabel) {
            await updateFinding(findingId, { seguimiento_estatus: seguimientoLabel });
          }
          saved += 1;
        }

        const { severidad: _s, estado: _e, ...rest } = patch;
        if (Object.keys(rest).length) {
          await updateFinding(findingId, rest);
          saved += 1;
        }
      }
      const deleted = deletedIds.length;
      if (deleted > 0 && saved > 0) {
        setNotice(`${deleted} hallazgo(s) eliminados, ${saved} actualizados.`);
      } else if (deleted > 0) {
        setNotice(`${deleted} hallazgo(s) eliminados.`);
      } else {
        setNotice(saved > 0 ? `${saved} hallazgo(s) guardados.` : 'Sin cambios.');
      }
      onSaved?.();
    },
    [onSaved, processedRows, evidenceByFinding]
  );

  const runGeminiActiveRow = useCallback(async () => {
    const meta = rowMeta[activeRow];
    if (!meta) return;
    setGeminiBusy(true);
    setNotice(null);
    try {
      await enrichFinding(meta.findingId);
      setNotice('Fila activa enriquecida con Gemini.');
      onSaved?.();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Error con Gemini');
    } finally {
      setGeminiBusy(false);
    }
  }, [activeRow, rowMeta, onSaved]);

  const handleSort = useCallback(
    (columnId: string, direction: 'asc' | 'desc') => {
      setSort({ column: columnId, direction });
    },
    [setSort]
  );

  const handleFilterChange = useCallback(
    (columnId: string, filter: MatrixColumnFilter | null) => {
      const next = { ...columnFilters };
      if (!filter) delete next[columnId];
      else next[columnId] = filter;
      setColumnFilters(next);
    },
    [columnFilters, setColumnFilters]
  );

  const renderColumnHeader = useCallback(
    (col: AssetGridColumn) => (
      <VulnMatrixColumnHeader
        columnId={col.key}
        label={col.label}
        emphasized={isPrimaryMatrixColumn(col.key)}
        sort={sort}
        filter={columnFilters[col.key]}
        uniqueValues={uniqueByColumn.get(col.key)}
        onSort={handleSort}
        onFilterChange={handleFilterChange}
      />
    ),
    [sort, columnFilters, uniqueByColumn, handleSort, handleFilterChange]
  );

  const activeFilterCount = Object.keys(columnFilters).length;

  if (loading && gridRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mb-2" />
        <p className="text-xs">{t('matrixLoadingGrid')}</p>
      </div>
    );
  }

  if (!loading && gridRows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {t('matrixEmpty')}
        {activeFilterCount > 0 ? ` (${activeFilterCount} ${t('matrixEmptyFiltersActive')})` : ''}.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {streaming ? (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="size-3 animate-spin shrink-0" />
          {t('matrixStreamingBanner')}
        </p>
      ) : null}
      <p className="text-[10px] text-muted-foreground leading-snug">
        Excel: clic / Shift+arrastrar selección · Ctrl+C copiar · Ctrl+X cortar · Ctrl+V pegar ·
        Ctrl+Z deshacer · Ctrl+A todo · F2 o Enter editar · Delete vaciar · arrastra ⋮⋮ en encabezado
        para reordenar (auto-scroll) · ‹› mover · Shift+‹› inicio · Shift+› final · borde derecho: ancho · Severidad y Estado con color y lista desplegable
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="h-7 gap-1 text-[11px] bg-violet-600 hover:bg-violet-700"
          disabled={geminiBusy || !rowMeta[activeRow]}
          onClick={() => void runGeminiActiveRow()}
        >
          {geminiBusy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          Gemini fila activa
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-[11px]"
          title="Ajusta el ancho de cada columna al título del encabezado"
          onClick={fitAllColumnsToHeaders}
        >
          <Columns3 className="size-3.5" />
          Ajustar columnas
        </Button>
        <VulnMatrixColumnPicker
          visibleColumnKeys={columns.map((c) => c.key)}
          onAddColumns={handleAddOptionalColumns}
        />
        <MatrixFieldOptionsPanel onSaved={() => setOptionsTick((n) => n + 1)} />
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {columns.length} cols
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {gridRows.length.toLocaleString()} filas
          {activeFilterCount > 0 ? ` · ${activeFilterCount} filtro(s) columna` : ''}
          {sort ? ` · orden ${sort.column} ${sort.direction === 'asc' ? 'A→Z' : 'Z→A'}` : ''}
          {' · '}fila {activeRow + 1}
        </span>
        {notice ? (
          <span className="text-[10px] text-violet-700 dark:text-violet-300">{notice}</span>
        ) : null}
        {actionError ? (
          <span className="text-[10px] text-destructive">{actionError}</span>
        ) : null}
      </div>

      {showSelectionActions ? (
        <VulnMatrixSelectionActions
          findingIds={selectedFindingIds}
          rowCount={selectionRowCount}
          onDone={(message) => {
            setNotice(message);
            setActionError(null);
          }}
          onError={setActionError}
          onReload={() => onSaved?.()}
        />
      ) : null}

      <AssetExcelGrid
        columns={columns}
        rows={gridRows}
        loading={loading}
        allowRowMutations={false}
        allowRowDelete={false}
        allowColumnInsert={false}
        allowColumnDelete={false}
        onRowsChange={setGridRows}
        onSave={handleSave}
        onColumnsChange={handleColumnsChange}
        onActiveCellChange={(pos) => setActiveRow(pos.row)}
        onSelectionChange={setSelectionRange}
        renderColumnHeader={renderColumnHeader}
      />
    </div>
  );
}
