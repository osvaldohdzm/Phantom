'use client';

import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckSquare,
  ExternalLink,
  Loader2,
  Search,
  Square,
  Table2,
  SlidersHorizontal,
} from 'lucide-react';
import {
  FINDINGS_UI_PAGE_SIZE_DEFAULT,
  FINDINGS_UI_PAGE_SIZE_OPTIONS,
  isAllPageSize,
  type FindingsUiPageSize,
} from '@/lib/secops-api';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { useVirtualRows } from '@/components/data-table/use-virtual-rows';
import {
  loadTableDensity,
  ROW_HEIGHT_PX,
  saveTableDensity,
  virtualScrollThreshold,
  type TableDensity,
} from '@/lib/data-table-pagination';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Finding, Severity } from '@/lib/secops-api';
import {
  getActiveReviewFields,
  getCatalogFieldConfigSync,
  loadCatalogFieldConfig,
} from '@/lib/catalog-field-config';
import { SpreadsheetColumnHeader } from '@/components/spreadsheet-column-header';
import { SpreadsheetCharCountHeader } from '@/components/spreadsheet-char-count-header';
import {
  applySpreadsheetColumnFilters,
  sortFindingsByColumn,
  uniqueColumnValues,
  type SpreadsheetColumnFilters,
  type SpreadsheetSort,
} from '@/lib/spreadsheet-column-filters';
import {
  findingCompleteness,
  matchesReviewFilter,
  type ReviewFieldKey,
  type ReviewFilter,
} from '@/lib/finding-completeness';
import {
  charCountTone,
  columnSupportsCharCount,
  getSpreadsheetCellCharCount,
  getSpreadsheetCellState,
  getSpreadsheetCellValue,
  findingMatchesSpreadsheetSearch,
  catalogAiFieldForSpreadsheetColumn,
  spreadsheetColumnsForLanguage,
  spreadsheetColumnSupportsCatalogGemini,
  toCharCountColumnId,
  type SpreadsheetColumn,
  type SpreadsheetColumnId,
  type SpreadsheetCharCountColumnId,
  type SpreadsheetSortableColumnId,
} from '@/lib/finding-spreadsheet-columns';
import type { CatalogTypeRowMeta } from '@/lib/catalog-type-spreadsheet';
import {
  fillCatalogFieldAndPropagate,
  type CatalogGeminiBatchResult,
} from '@/lib/catalog-gemini-batch';
import { OpenCatalogButton } from '@/components/open-catalog-button';
import { SeverityBadge } from '@/components/severity-badge';
import { CompletenessIndicator } from '@/components/completeness-indicator';
import { useAuth } from '@/contexts/auth-context';

const PRIMARY_FILTER_OPTIONS: { id: ReviewFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'incomplete', label: 'Pendientes' },
  { id: 'gemini-ready', label: 'Listos' },
];

const ADVANCED_FILTER_OPTIONS: { id: ReviewFilter; label: string }[] = [
  { id: 'complete', label: 'Completos' },
  { id: 'missing-descripcion', label: 'Sin descripción' },
  { id: 'missing-amenaza', label: 'Sin amenaza' },
];

export function buildMissingFieldFilters() {
  return [
    { id: 'any', label: 'Cualquier campo' },
    ...getActiveReviewFields().map((f) => ({ id: f.key, label: `Falta: ${f.label}` })),
  ];
}

function cellClass(state: ReturnType<typeof getSpreadsheetCellState>): string {
  switch (state) {
    case 'ok':
      return 'bg-emerald-500/8 text-foreground';
    case 'missing':
      return 'bg-rose-500/12 text-foreground ring-1 ring-inset ring-rose-500/25';
    case 'empty':
      return 'bg-rose-500/16 text-foreground font-medium';
    default:
      return 'text-muted-foreground';
  }
}

function truncate(text: string, max = 80): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export type SpreadsheetPagination = {
  total: number;
  page: number;
  pageSize: FindingsUiPageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: FindingsUiPageSize) => void;
  loading?: boolean;
};

export type CatalogTypeLeadingColumn = {
  id: 'instance_count' | 'tool_identifier';
  label: string;
  shortLabel: string;
  width: number;
};

const CATALOG_TYPE_LEADING_COLUMNS_ES: CatalogTypeLeadingColumn[] = [
  { id: 'instance_count', label: 'Instancias', shortLabel: 'Inst.', width: 64 },
  { id: 'tool_identifier', label: 'Identificador', shortLabel: 'ID', width: 120 },
];

const CATALOG_TYPE_LEADING_COLUMNS_EN: CatalogTypeLeadingColumn[] = [
  { id: 'instance_count', label: 'Instances', shortLabel: 'Inst.', width: 64 },
  { id: 'tool_identifier', label: 'Identifier', shortLabel: 'ID', width: 120 },
];

function catalogTypeLeadingColumns(
  language: import('@/lib/tenant-locale').TenantLanguage
): CatalogTypeLeadingColumn[] {
  return language === 'en' ? CATALOG_TYPE_LEADING_COLUMNS_EN : CATALOG_TYPE_LEADING_COLUMNS_ES;
}

export type FindingsSpreadsheetTableProps = {
  findings: Finding[];
  /** Oculta columnas (p. ej. componente en revisión por tipo). */
  excludeColumnIds?: SpreadsheetColumnId[];
  /** Metadatos por fila en modo catálogo/tipos. */
  catalogTypeRowMeta?: Record<string, CatalogTypeRowMeta>;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAll?: (ids: string[]) => void;
  expandedId?: string | null;
  onRowClick?: (id: string) => void;
  renderExpandedRow?: (finding: Finding) => React.ReactNode;
  severityFilter?: Severity | 'all';
  showCatalogAction?: boolean;
  /** Paginación controlada por el padre (servidor). */
  pagination?: SpreadsheetPagination;
  /** Búsqueda controlada; si `serverSearch`, no filtra en cliente. */
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  serverSearch?: boolean;
  /** Filtro de severidad multi en servidor (columna Sev.). */
  onServerSeverityFilter?: (severities: import('@/lib/secops-api').Severity[] | undefined) => void;
  /** Oculta «Seleccionar N en página» del pie (toolbar externo arriba). */
  hideFooterSelection?: boolean;
  /** Toolbar unificado en el padre (sin buscar/filtros duplicados). */
  externalToolbar?: boolean;
  completenessFilter?: ReviewFilter;
  onCompletenessFilterChange?: (f: ReviewFilter) => void;
  missingField?: string;
  onMissingFieldChange?: (field: string) => void;
  showAllFields?: boolean;
  onShowAllFieldsChange?: (show: boolean) => void;
  density?: TableDensity;
  onDensityChange?: (density: TableDensity) => void;
  onColumnFilterMetaChange?: (meta: { count: number; clear: () => void }) => void;
  engagementId?: string;
  onCatalogColumnGeminiDone?: (
    columnId: SpreadsheetColumnId,
    result: CatalogGeminiBatchResult
  ) => void;
  /** Vista detalles: columnas # de caracteres a la derecha de cada campo. */
  detailView?: boolean;
  onDetailViewChange?: (enabled: boolean) => void;
  /** Atajos desde toolbar (filtro/orden en columnas de conteo). */
  detailPreset?: {
    key: number;
    enableDetailView?: boolean;
    filter?: { columnId: SpreadsheetSortableColumnId; filter: import('@/lib/spreadsheet-column-filters').SpreadsheetColumnFilter };
    sort?: import('@/lib/spreadsheet-column-filters').SpreadsheetSort;
  };
};

function getCatalogTypeLeadingValue(
  finding: Finding,
  columnId: CatalogTypeLeadingColumn['id'],
  meta?: CatalogTypeRowMeta
): string {
  if (!meta) return '—';
  if (columnId === 'instance_count') return String(meta.instanceCount);
  return meta.toolLabel || '—';
}

export function FindingsSpreadsheetTable({
  findings,
  excludeColumnIds,
  catalogTypeRowMeta,
  selected,
  onToggleSelect,
  onSelectAll,
  expandedId,
  onRowClick,
  renderExpandedRow,
  severityFilter = 'all',
  showCatalogAction = true,
  pagination,
  searchQuery: controlledSearch,
  onSearchQueryChange,
  serverSearch = false,
  onServerSeverityFilter,
  hideFooterSelection = false,
  externalToolbar = false,
  completenessFilter: controlledCompletenessFilter,
  onCompletenessFilterChange,
  missingField: controlledMissingField,
  onMissingFieldChange,
  showAllFields: controlledShowAllFields,
  onShowAllFieldsChange,
  density: controlledDensity,
  onDensityChange,
  onColumnFilterMetaChange,
  engagementId,
  onCatalogColumnGeminiDone,
  detailView: controlledDetailView,
  detailPreset,
}: FindingsSpreadsheetTableProps) {
  const { tenantLanguage, branding } = useAuth();
  const spreadsheetColumns = useMemo(
    () => spreadsheetColumnsForLanguage(tenantLanguage),
    [tenantLanguage]
  );
  const [internalSearch, setInternalSearch] = useState('');
  const search = controlledSearch ?? internalSearch;
  const setSearch = onSearchQueryChange ?? setInternalSearch;
  const deferredSearch = useDeferredValue(search);
  const [clientPage, setClientPage] = useState(1);
  const [internalCompletenessFilter, setInternalCompletenessFilter] =
    useState<ReviewFilter>('all');
  const completenessFilter = controlledCompletenessFilter ?? internalCompletenessFilter;
  const setCompletenessFilter = onCompletenessFilterChange ?? setInternalCompletenessFilter;
  const [internalMissingField, setInternalMissingField] = useState('any');
  const missingField = controlledMissingField ?? internalMissingField;
  const setMissingField = onMissingFieldChange ?? setInternalMissingField;
  const [missingFieldFilters, setMissingFieldFilters] = useState(() => buildMissingFieldFilters());

  useEffect(() => {
    void loadCatalogFieldConfig(tenantLanguage, { branding }).then(() =>
      setMissingFieldFilters(buildMissingFieldFilters())
    );
  }, [tenantLanguage, branding]);
  const [sort, setSort] = useState<SpreadsheetSort | null>({
    column: 'severidad',
    direction: 'asc',
  });
  const [columnFilters, setColumnFilters] = useState<SpreadsheetColumnFilters>({});
  const [internalShowAllFields, setInternalShowAllFields] = useState(true);
  const showAllFields = controlledShowAllFields ?? internalShowAllFields;
  const setShowAllFields = onShowAllFieldsChange ?? setInternalShowAllFields;
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [internalDetailView, setInternalDetailView] = useState(false);
  const detailView = controlledDetailView ?? internalDetailView;
  const [internalDensity, setInternalDensity] = useState<TableDensity>('compact');
  const density = controlledDensity ?? internalDensity;
  const setDensity = (next: TableDensity) => {
    if (onDensityChange) onDensityChange(next);
    else setInternalDensity(next);
  };
  const [geminiColumnId, setGeminiColumnId] = useState<SpreadsheetColumnId | null>(null);
  const [geminiColumnError, setGeminiColumnError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (controlledDensity === undefined) {
      setInternalDensity(loadTableDensity());
    }
  }, [controlledDensity]);

  const activeColumnFilterCount = useMemo(
    () => Object.keys(columnFilters).length,
    [columnFilters]
  );

  const clearColumnFiltersRef = useRef<() => void>(() => {});
  clearColumnFiltersRef.current = () => {
    setColumnFilters({});
    onServerSeverityFilter?.(undefined);
  };

  useEffect(() => {
    onColumnFilterMetaChange?.({
      count: activeColumnFilterCount,
      clear: () => clearColumnFiltersRef.current(),
    });
  }, [activeColumnFilterCount, onColumnFilterMetaChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const baseColumns = useMemo(() => {
    const excluded = new Set(excludeColumnIds ?? []);
    const cols = showAllFields
      ? spreadsheetColumns
      : spreadsheetColumns.filter((c) => c.reportField || c.id === 'completeness');
    return cols.filter((c) => !excluded.has(c.id));
  }, [showAllFields, excludeColumnIds, spreadsheetColumns]);

  const leadingColumns = catalogTypeRowMeta ? catalogTypeLeadingColumns(tenantLanguage) : [];

  const visibleColumns = baseColumns;

  type DisplayColumn =
    | { kind: 'leading'; col: CatalogTypeLeadingColumn; leadingIndex: number }
    | { kind: 'field'; col: SpreadsheetColumn; fieldIndex: number }
    | { kind: 'count'; sourceCol: SpreadsheetColumn; countId: SpreadsheetCharCountColumnId };

  const displayColumns = useMemo((): DisplayColumn[] => {
    const out: DisplayColumn[] = [];
    visibleColumns.forEach((col, fieldIndex) => {
      out.push({ kind: 'field', col, fieldIndex });
      if (col.id === 'severidad' && leadingColumns.length > 0) {
        leadingColumns.forEach((lc, leadingIndex) => {
          out.push({ kind: 'leading', col: lc, leadingIndex });
        });
      }
      if (detailView && columnSupportsCharCount(col.id)) {
        out.push({
          kind: 'count',
          sourceCol: col,
          countId: toCharCountColumnId(col.id),
        });
      }
    });
    return out;
  }, [visibleColumns, detailView, leadingColumns]);

  useEffect(() => {
    if (!detailPreset) return;
    if (detailPreset.enableDetailView && controlledDetailView === undefined) {
      setInternalDetailView(true);
    }
    if (detailPreset.filter) {
      setColumnFilters((prev) => ({
        ...prev,
        [detailPreset.filter!.columnId]: detailPreset.filter!.filter,
      }));
    }
    if (detailPreset.sort) {
      setSort(detailPreset.sort);
    }
  }, [detailPreset, controlledDetailView]);

  const pageSize = pagination?.pageSize ?? FINDINGS_UI_PAGE_SIZE_DEFAULT;
  const page = pagination?.page ?? clientPage;

  useEffect(() => {
    if (!pagination) setClientPage(1);
  }, [pagination, deferredSearch, completenessFilter, missingField, severityFilter, findings.length]);

  const handleColumnFilterChange = (
    columnId: SpreadsheetSortableColumnId,
    filter: import('@/lib/spreadsheet-column-filters').SpreadsheetColumnFilter | null
  ) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (filter) next[columnId] = filter;
      else delete next[columnId];
      if (columnId === 'severidad' && onServerSeverityFilter) {
        const sevFilter = filter?.kind === 'severity_in' ? filter.values : undefined;
        onServerSeverityFilter(sevFilter?.length ? sevFilter : undefined);
      }
      return next;
    });
  };

  const filtered = useMemo(() => {
    let list = findings.filter((f) => {
      if (severityFilter !== 'all' && f.severidad !== severityFilter) return false;
      if (!matchesReviewFilter(f, completenessFilter)) return false;
      if (!serverSearch && !findingMatchesSpreadsheetSearch(f, deferredSearch, tenantLanguage)) return false;
      if (missingField !== 'any') {
        const c = findingCompleteness(f);
        if (!c.missingKeys.includes(missingField as ReviewFieldKey)) return false;
      }
      return true;
    });

    const clientFilters = { ...columnFilters };
    if (serverSearch && clientFilters.severidad) {
      delete clientFilters.severidad;
    }
    list = applySpreadsheetColumnFilters(list, clientFilters, tenantLanguage);
    if (!serverSearch || sort) {
      list = sortFindingsByColumn(list, sort, tenantLanguage);
    }
    return list;
  }, [
    findings,
    severityFilter,
    completenessFilter,
    deferredSearch,
    missingField,
    columnFilters,
    sort,
    serverSearch,
    tenantLanguage,
  ]);

  const totalRows = pagination?.total ?? filtered.length;
  const totalPages = isAllPageSize(pageSize)
    ? 1
    : Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageSlice = pagination
    ? filtered
    : isAllPageSize(pageSize)
      ? filtered
      : filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const setPage = (p: number) => {
    const next = Math.max(1, Math.min(p, totalPages));
    if (pagination) pagination.onPageChange(next);
    else setClientPage(next);
  };

  const handleSort = (columnId: SpreadsheetSortableColumnId, direction: 'asc' | 'desc') => {
    setSort({ column: columnId, direction });
  };

  const runColumnCatalogGemini = async (columnId: SpreadsheetColumnId) => {
    const catalogField = catalogAiFieldForSpreadsheetColumn(columnId);
    if (!catalogField || !engagementId) return;
    if (!filtered.length) {
      setGeminiColumnError('No hay filas visibles con el filtro actual.');
      return;
    }
    setGeminiColumnId(columnId);
    setGeminiColumnError(null);
    try {
      await loadCatalogFieldConfig();
      const result = await fillCatalogFieldAndPropagate(filtered, engagementId, catalogField, {
        fieldConfig: getCatalogFieldConfigSync(),
      });
      onCatalogColumnGeminiDone?.(columnId, result);
    } catch (e) {
      setGeminiColumnError(e instanceof Error ? e.message : 'Error al aplicar Gemini en columna');
    } finally {
      setGeminiColumnId(null);
    }
  };

  const allSelected =
    pageSlice.length > 0 && pageSlice.every((f) => selected?.has(f.id));

  const rowHeight = ROW_HEIGHT_PX[density];
  const useVirtual =
    pageSlice.length >= virtualScrollThreshold(pageSize) && !expandedId;
  const { rows: virtualRows, paddingTop, paddingBottom } = useVirtualRows({
    items: pageSlice,
    rowHeight,
    containerRef: scrollRef,
    enabled: useVirtual,
  });
  const rowsToRender = useVirtual ? virtualRows : pageSlice.map((item, index) => ({ item, index }));
  const colSpan =
    displayColumns.length + (onToggleSelect ? 1 : 0) + (showCatalogAction ? 1 : 0);

  const charCountCellClass = (length: number): string => {
    switch (charCountTone(length)) {
      case 'critical':
        return 'text-rose-600 dark:text-rose-400 font-semibold tabular-nums';
      case 'alert':
        return 'text-orange-600 dark:text-orange-400 font-medium tabular-nums';
      case 'warn':
        return 'text-amber-700 dark:text-amber-300 tabular-nums';
      default:
        return 'text-muted-foreground tabular-nums';
    }
  };

  const stickyLeft = (colIndex: number, col: SpreadsheetColumn) => {
    if (!col.sticky) return undefined;
    let left = onToggleSelect ? 44 : 0;
    for (let i = 0; i < colIndex; i++) {
      const c = visibleColumns[i];
      if (c?.sticky) left += c.width;
    }
    return left;
  };

  const hasAdvancedFilters =
    completenessFilter !== 'all' || missingField !== 'any' || !showAllFields;

  return (
    <div className="space-y-0">
      {!externalToolbar && (
      <div className="sticky top-0 z-30 -mx-1 px-1 py-2 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800/50">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="size-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              ref={searchRef}
              className="h-9 pl-9 pr-14 text-sm bg-slate-900/80 border-slate-700/80 focus-visible:border-violet-500/50 focus-visible:ring-violet-500/20"
              placeholder="Buscar hallazgos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-500 font-mono">
              ⌘K
            </kbd>
          </div>
          <div className="flex items-center gap-0.5">
            {PRIMARY_FILTER_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setCompletenessFilter(o.id)}
                className={cn(
                  'px-2 py-1 rounded-md text-[11px] font-medium transition-colors',
                  completenessFilter === o.id
                    ? 'bg-violet-600/25 text-violet-200'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setAdvancedOpen((o) => !o)}
            className={cn(
              'px-2 py-1 rounded-md text-[11px] flex items-center gap-1 transition-colors shrink-0',
              advancedOpen || hasAdvancedFilters
                ? 'bg-slate-800 text-slate-200'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
            )}
          >
            <SlidersHorizontal className="size-3" />
            Avanzados
            {hasAdvancedFilters && <span className="size-1.5 rounded-full bg-violet-500" />}
          </button>
          <span className="text-[10px] text-slate-600 ml-auto hidden md:inline tabular-nums">
            {pagination
              ? `${totalRows.toLocaleString()} en consulta`
              : `${filtered.length} filas`}
          </span>
        </div>
        {advancedOpen && (
          <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-slate-800/40">
            <div className="flex flex-wrap gap-1 items-center">
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">Estado</span>
              {ADVANCED_FILTER_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setCompletenessFilter(o.id)}
                  className={cn(
                    'px-2 py-0.5 rounded text-[11px] transition-colors',
                    completenessFilter === o.id
                      ? 'bg-slate-700 text-slate-100'
                      : 'text-slate-500 hover:text-slate-300'
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span>Campo faltante</span>
              <select
                className="h-7 rounded-md border border-slate-700/80 bg-slate-900 px-2 text-[11px] text-slate-300"
                value={missingField}
                onChange={(e) => setMissingField(e.target.value)}
              >
                {missingFieldFilters.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 type-small text-muted-foreground">
              <input
                type="checkbox"
                checked={showAllFields}
                onChange={(e) => setShowAllFields(e.target.checked)}
                className="rounded border-border size-4"
              />
              Todos los campos
            </label>
            <label className="flex items-center gap-1.5 type-small text-muted-foreground">
              <input
                type="checkbox"
                checked={density === 'comfortable'}
                onChange={(e) => {
                  const next: TableDensity = e.target.checked ? 'comfortable' : 'compact';
                  setDensity(next);
                  saveTableDensity(next);
                }}
                className="rounded border-border size-4"
              />
              Filas cómodas (52px)
            </label>
            {useVirtual ? (
              <span className="type-small text-primary/80">Scroll virtual activo</span>
            ) : null}
            {activeColumnFilterCount > 0 ? (
              <button
                type="button"
                className="text-[10px] text-rose-400 hover:text-rose-300"
                onClick={() => {
                  setColumnFilters({});
                  onServerSeverityFilter?.(undefined);
                }}
              >
                Limpiar {activeColumnFilterCount} filtro(s) columna
              </button>
            ) : null}
          </div>
        )}
      </div>
      )}

      {geminiColumnError ? (
        <p className="mb-2 px-3 py-1.5 text-[11px] text-rose-500 rounded-lg border border-rose-500/30 bg-rose-500/5">
          {geminiColumnError}
        </p>
      ) : null}
      <div
        ref={scrollRef}
        className="relative z-0 overflow-auto max-h-[min(72vh,780px)] rounded-xl border border-border bg-card shadow-sm"
      >
        {pagination?.loading ? (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/70 backdrop-blur-[1px]">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : null}
        <table className="border-collapse text-sm w-max min-w-full">
          <thead className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm">
            <tr>
              {onToggleSelect ? (
                <th className="sticky left-0 z-30 bg-background/95 border-b border-border p-1 w-11">
                  <button
                    type="button"
                    className="text-slate-400 hover:text-violet-300 p-1"
                    onClick={() =>
                      onSelectAll?.(allSelected ? [] : pageSlice.map((f) => f.id))
                    }
                  >
                    {allSelected ? <CheckSquare className="size-3.5" /> : <Square className="size-3.5" />}
                  </button>
                </th>
              ) : null}
              {displayColumns.map((dc) =>
                dc.kind === 'leading' ? (
                  <th
                    key={dc.col.id}
                    className="border-b border-border px-2 py-3 text-left font-medium text-xs uppercase text-muted-foreground whitespace-nowrap"
                    style={{ minWidth: dc.col.width, maxWidth: dc.col.width }}
                  >
                    <span className="truncate" title={dc.col.label}>
                      {dc.col.shortLabel}
                    </span>
                  </th>
                ) : dc.kind === 'field' ? (
                  <SpreadsheetColumnHeader
                    key={dc.col.id}
                    columnId={dc.col.id}
                    label={dc.col.label}
                    shortLabel={dc.col.shortLabel}
                    sort={sort}
                    filter={columnFilters[dc.col.id]}
                    uniqueValues={uniqueColumnValues(findings, dc.col.id, 40, tenantLanguage)}
                    onSort={handleSort}
                    onFilterChange={handleColumnFilterChange}
                    showGemini={Boolean(engagementId) && spreadsheetColumnSupportsCatalogGemini(dc.col.id, tenantLanguage)}
                    geminiBusy={geminiColumnId === dc.col.id}
                    onGemini={() => void runColumnCatalogGemini(dc.col.id)}
                    style={{
                      minWidth: dc.col.width,
                      maxWidth: dc.col.width,
                      left: stickyLeft(dc.fieldIndex, dc.col),
                    }}
                    className={dc.col.sticky ? 'sticky z-20 bg-background/95' : undefined}
                  />
                ) : (
                  <SpreadsheetCharCountHeader
                    key={dc.countId}
                    countColumnId={dc.countId}
                    sourceLabel={dc.sourceCol.shortLabel}
                    sort={sort}
                    filter={columnFilters[dc.countId]}
                    onSort={handleSort}
                    onFilterChange={handleColumnFilterChange}
                    showGemini={
                      Boolean(engagementId) &&
                      spreadsheetColumnSupportsCatalogGemini(dc.sourceCol.id, tenantLanguage)
                    }
                    geminiBusy={geminiColumnId === dc.sourceCol.id}
                    onGemini={() => void runColumnCatalogGemini(dc.sourceCol.id)}
                    style={{ minWidth: 44, maxWidth: 44 }}
                  />
                )
              )}
              {showCatalogAction ? (
                <th
                  className="border-b border-border px-1 py-3 text-center font-medium text-xs uppercase text-muted-foreground whitespace-nowrap w-11 sticky right-0 z-20 bg-background/95"
                  title="Abrir catálogo (nueva pestaña)"
                >
                  <ExternalLink className="size-3.5 mx-auto opacity-60" />
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {pageSlice.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="p-12 text-center type-small text-muted-foreground">
                  {catalogTypeRowMeta
                    ? 'Ningún tipo de vulnerabilidad coincide con los filtros.'
                    : 'Ningún hallazgo coincide con los filtros.'}
                </td>
              </tr>
            ) : (
              <>
                {paddingTop > 0 ? (
                  <tr aria-hidden>
                    <td colSpan={colSpan} style={{ height: paddingTop, padding: 0, border: 0 }} />
                  </tr>
                ) : null}
                {rowsToRender.map(({ item: f, index: rowIdx }) => {
                const isExpanded = expandedId === f.id;
                const isSelected = selected?.has(f.id);
                const completeness = findingCompleteness(f);
                const stickyBg = rowIdx % 2 === 0 ? 'bg-card' : 'bg-muted/20';

                return (
                  <Fragment key={f.id}>
                    <tr
                      style={{ height: rowHeight }}
                      className={cn(
                        'cursor-pointer transition-colors group border-b border-border/60',
                        rowIdx % 2 === 1 && 'bg-muted/15',
                        'hover:bg-muted/40',
                        isSelected && 'bg-primary/8 hover:bg-primary/12',
                        isExpanded && 'bg-muted/50',
                      )}
                      onClick={() => onRowClick?.(f.id)}
                    >
                      {onToggleSelect ? (
                        <td
                          className={cn(
                            'sticky left-0 z-10 border-b border-border/60 p-1 w-11',
                            stickyBg,
                            isSelected && 'bg-primary/8',
                            'group-hover:bg-muted/40'
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="flex size-11 items-center justify-center text-muted-foreground hover:text-primary"
                            onClick={() => onToggleSelect(f.id)}
                          >
                            {isSelected ? (
                              <CheckSquare className="size-3.5" />
                            ) : (
                              <Square className="size-3.5" />
                            )}
                          </button>
                        </td>
                      ) : null}
                      {displayColumns.map((dc) => {
                        if (dc.kind === 'leading') {
                          const meta = catalogTypeRowMeta?.[f.id];
                          const value = getCatalogTypeLeadingValue(f, dc.col.id, meta);
                          return (
                            <td
                              key={dc.col.id}
                              style={{ minWidth: dc.col.width, maxWidth: dc.col.width }}
                              title={value}
                              className={cn(
                                'border-b border-border/60 px-2 align-middle type-small truncate',
                                dc.col.id === 'instance_count'
                                  ? 'text-right tabular-nums text-muted-foreground'
                                  : 'font-mono text-[11px] text-muted-foreground'
                              )}
                            >
                              {value}
                            </td>
                          );
                        }

                        if (dc.kind === 'count') {
                          const len = getSpreadsheetCellCharCount(f, dc.sourceCol.id, tenantLanguage);
                          return (
                            <td
                              key={dc.countId}
                              style={{ minWidth: 44, maxWidth: 44 }}
                              title={`${dc.sourceCol.label}: ${len} caracteres`}
                              className={cn(
                                'border-b border-border/60 bg-muted/20 px-1 align-middle text-center text-[11px]',
                                charCountCellClass(len)
                              )}
                            >
                              {len > 0 ? len.toLocaleString() : '—'}
                            </td>
                          );
                        }

                        const col = dc.col;
                        const state = getSpreadsheetCellState(f, col.id);
                        const value = getSpreadsheetCellValue(f, col.id, tenantLanguage);
                        const display =
                          col.id === 'severidad'
                            ? null
                            : col.id === 'completeness'
                              ? null
                              : col.id === 'raw_tool_output'
                                ? value ? `${value.length} chars` : '—'
                                : truncate(value, showAllFields ? 200 : col.id === 'titulo' ? 120 : 72) || '—';

                        return (
                          <td
                            key={col.id}
                            style={{
                              minWidth: col.width,
                              maxWidth: col.width,
                              left: stickyLeft(dc.fieldIndex, col),
                            }}
                            title={value || undefined}
                            className={cn(
                              'border-b border-border/60 px-4 align-middle max-w-0 type-small',
                              col.sticky && cn(
                                'sticky z-10',
                                stickyBg,
                                isSelected && 'bg-primary/8',
                                'group-hover:bg-muted/40'
                              ),
                              col.id !== 'severidad' && col.id !== 'completeness' && 'truncate',
                              col.id !== 'severidad' && col.id !== 'completeness' && cellClass(state),
                            )}
                          >
                            {col.id === 'severidad' ? (
                              <SeverityBadge severity={f.severidad} compact />
                            ) : col.id === 'completeness' ? (
                              <CompletenessIndicator percent={completeness.percent} />
                            ) : (
                              display
                            )}
                          </td>
                        );
                      })}
                      {showCatalogAction ? (
                        <td
                          className={cn(
                            'border-b border-border/60 px-0.5 align-middle text-center sticky right-0 z-10 w-11',
                            stickyBg,
                            isSelected && 'bg-primary/8',
                            'group-hover:bg-muted/40'
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <OpenCatalogButton
                            finding={f}
                            label="Catálogo"
                            openInNewTab
                            compact
                            variant="ghost"
                            className="size-11 p-0 text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
                          />
                        </td>
                      ) : null}
                    </tr>
                    {isExpanded && renderExpandedRow ? (
                      <tr className="bg-muted/30">
                        <td colSpan={colSpan} className="border-b border-border p-6">
                          {renderExpandedRow(f)}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
                {paddingBottom > 0 ? (
                  <tr aria-hidden>
                    <td colSpan={colSpan} style={{ height: paddingBottom, padding: 0, border: 0 }} />
                  </tr>
                ) : null}
              </>
            )}
          </tbody>
        </table>
      </div>

      <div className="relative z-20 rounded-xl border border-border shadow-sm">
        {!hideFooterSelection && pageSlice.length > 0 && onSelectAll ? (
          <div className="px-4 py-2 border-b border-border bg-muted/20">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onSelectAll(pageSlice.map((f) => f.id))}
            >
              <Table2 className="size-4 mr-2" />
              Seleccionar {pageSlice.length} en página
            </Button>
          </div>
        ) : null}
        {(totalPages > 1 || pagination) && (
          <DataTablePagination
            page={safePage}
            pageSize={pageSize}
            total={totalRows}
            pageSizeOptions={FINDINGS_UI_PAGE_SIZE_OPTIONS}
            loading={pagination?.loading}
            onPageChange={setPage}
            onPageSizeChange={
              pagination?.onPageSizeChange
                ? (size) => pagination.onPageSizeChange?.(size)
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
