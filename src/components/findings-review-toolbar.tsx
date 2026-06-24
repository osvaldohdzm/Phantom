'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  ArrowDownWideNarrow,
  CheckSquare,
  ChevronDown,
  Copy,
  Info,
  LayoutGrid,
  List,
  Loader2,
  ListOrdered,
  Layers,
  MoreHorizontal,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Square,
  Table2,
  Trash2,
  Upload,
  Eraser,
  Wrench,
} from 'lucide-react';
import { EXPLICACION_TECNICA_MAX_PARAGRAPHS } from '@/lib/truncate-paragraphs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Severity } from '@/lib/secops-api';
import type { ReviewFilter } from '@/lib/finding-completeness';
import { TOOL_SOURCE_FILTER_OPTIONS } from '@/lib/finding-source-filters';
import type { TableDensity } from '@/lib/data-table-pagination';
import { SeverityBadge } from '@/components/severity-badge';

const ALL_SEVERITIES: Severity[] = ['Critical', 'High', 'Medium', 'Low', 'Info'];

const SEVERITY_SELECT_LABEL: Record<Severity, string> = {
  Critical: 'Críticas',
  High: 'Altas',
  Medium: 'Medias',
  Low: 'Bajas',
  Info: 'Info',
};

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

type ViewMode = 'spreadsheet' | 'grouped' | 'list';

type ToolbarMenuProps = {
  label: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
  variant?: 'ghost' | 'outline' | 'secondary';
  size?: 'sm' | 'xs';
  disabled?: boolean;
  className?: string;
};

function ToolbarMenu({
  label,
  children,
  align = 'left',
  variant = 'outline',
  size = 'sm',
  disabled,
  className,
}: ToolbarMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={disabled}
        className={cn('h-7 gap-1 text-xs', className)}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {label}
        <ChevronDown className={cn('size-3 opacity-60 transition-transform', open && 'rotate-180')} />
      </Button>
      {open ? (
        <div
          className={cn(
            'absolute top-full z-[200] mt-1 min-w-[11rem] rounded-lg border border-border bg-popover py-1 shadow-xl',
            align === 'right' ? 'right-0' : 'left-0'
          )}
          role="menu"
        >
          <div onClick={() => setOpen(false)}>{children}</div>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  onClick,
  disabled,
  destructive,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors disabled:opacity-40',
        destructive
          ? 'text-destructive hover:bg-destructive/10'
          : 'text-foreground hover:bg-muted/80'
      )}
    >
      {children}
    </button>
  );
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { id: T; label: string; icon?: React.ReactNode }[];
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg border border-border/80 bg-muted/40 p-0.5',
        className
      )}
      role="tablist"
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={value === opt.id}
          onClick={() => onChange(opt.id)}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
            value === opt.id
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export type FindingsReviewToolbarProps = {
  /** `catalog-types` = revisión por tipo de vulnerabilidad (paso 4). */
  variant?: 'findings' | 'catalog-types';
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  showSearch: boolean;
  stats: {
    total: number;
    incomplete: number;
    geminiReady: number;
    duplicateRemove: number;
    groupedTotal: number;
    aiGroupCount?: number;
  };
  filteredTotal: number;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  severitySort: boolean;
  onSeveritySortToggle: () => void;
  severityCounts: Record<Severity, number>;
  severidadesMulti?: Severity[];
  onToggleSeverityFilter: (sev: Severity) => void;
  onClearSeverityFilter: () => void;
  filter: ReviewFilter;
  onFilterChange: (f: ReviewFilter) => void;
  advancedOpen: boolean;
  onAdvancedOpenChange: (open: boolean) => void;
  isAdvancedFilter: boolean;
  filteredPageCount: number;
  selectionCount: number;
  hasSelection: boolean;
  selectAllInQuery: boolean;
  selectingAll: boolean;
  onSelectAllInQuery: () => void;
  onSelectAllOnPage: () => void;
  onClearSelection: () => void;
  busy: 'gemini' | 'save' | 'delete' | 'sync' | 'consolidate' | 'assign-groups' | 'publish' | 'clear' | null;
  geminiTargetCount: number;
  geminiProgress: { done: number; total: number } | null;
  onGeminiCatalog: () => void;
  onConsolidateEngagement: () => void;
  onConsolidatePage: () => void;
  onConsolidateSelection: () => void;
  onSyncEngagement: () => void;
  onSyncPage: () => void;
  onSyncSelection: () => void;
  onDeleteDuplicates: () => void;
  onRepairText: () => void;
  onTruncateExplicacion: () => void;
  explicacionMaxParagraphs?: number;
  onDeleteSelected: () => void;
  engagementId?: string;
  showSpreadsheetActions: boolean;
  showTableOptions: boolean;
  missingField: string;
  onMissingFieldChange: (v: string) => void;
  missingFieldOptions: { id: string; label: string }[];
  showAllFields: boolean;
  onShowAllFieldsChange: (v: boolean) => void;
  density: TableDensity;
  onDensityChange: (v: TableDensity) => void;
  columnFilterCount: number;
  onClearColumnFilters: () => void;
  detailView: boolean;
  onDetailViewChange: (enabled: boolean) => void;
  onDetailPreset: (preset: {
    enableDetailView?: boolean;
    filter?: {
      columnId: string;
      filter: { kind: 'char_gte'; min: number };
    };
    sort?: { column: string; direction: 'asc' | 'desc' };
  }) => void;
  aiGroupedView?: boolean;
  onAiGroupedViewToggle?: () => void;
  onAssignAiGroups?: () => void;
  showToolSourceFilter?: boolean;
  toolSourceFilter?: import('@/lib/finding-source-filters').ToolSourceFilterId;
  onToolSourceFilterChange?: (id: import('@/lib/finding-source-filters').ToolSourceFilterId) => void;
  /** Paso de servicio: publicar o limpiar carga del engagement activo. */
  showServiceWorkflowActions?: boolean;
  onPublishToRepository?: () => void;
  onClearServiceLoad?: () => void;
  /** Instancias totales del servicio (todas las filas importadas, no solo tipos visibles). */
  serviceFindingsCount?: number;
  serviceTypeCount?: number;
};

export function FindingsReviewToolbar({
  variant = 'findings',
  searchQuery,
  onSearchQueryChange,
  searchInputRef,
  showSearch,
  stats,
  filteredTotal,
  viewMode,
  onViewModeChange,
  severitySort,
  onSeveritySortToggle,
  severityCounts,
  severidadesMulti,
  onToggleSeverityFilter,
  onClearSeverityFilter,
  filter,
  onFilterChange,
  advancedOpen,
  onAdvancedOpenChange,
  isAdvancedFilter,
  filteredPageCount,
  selectionCount,
  hasSelection,
  selectAllInQuery,
  selectingAll,
  onSelectAllInQuery,
  onSelectAllOnPage,
  onClearSelection,
  busy,
  geminiTargetCount,
  geminiProgress,
  onGeminiCatalog,
  onConsolidateEngagement,
  onConsolidatePage,
  onConsolidateSelection,
  onSyncEngagement,
  onSyncPage,
  onSyncSelection,
  onDeleteDuplicates,
  onRepairText,
  onTruncateExplicacion,
  explicacionMaxParagraphs = EXPLICACION_TECNICA_MAX_PARAGRAPHS,
  onDeleteSelected,
  engagementId,
  showSpreadsheetActions,
  showTableOptions,
  missingField,
  onMissingFieldChange,
  missingFieldOptions,
  showAllFields,
  onShowAllFieldsChange,
  density,
  onDensityChange,
  columnFilterCount,
  onClearColumnFilters,
  detailView,
  onDetailViewChange,
  onDetailPreset,
  aiGroupedView,
  onAiGroupedViewToggle,
  onAssignAiGroups,
  showToolSourceFilter,
  toolSourceFilter = 'all',
  onToolSourceFilterChange,
  showServiceWorkflowActions,
  onPublishToRepository,
  onClearServiceLoad,
  serviceFindingsCount = 0,
  serviceTypeCount = 0,
}: FindingsReviewToolbarProps) {
  const isCatalogTypes = variant === 'catalog-types';
  const viewOptions: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: 'spreadsheet', label: 'Tabla', icon: <Table2 className="size-3" /> },
    { id: 'grouped', label: 'Grupos', icon: <LayoutGrid className="size-3" /> },
    { id: 'list', label: 'Lista', icon: <List className="size-3" /> },
  ];

  const filtersExpanded = advancedOpen || isAdvancedFilter;

  return (
    <div className="sticky top-[4.5rem] z-50 isolate overflow-visible rounded-xl border border-border bg-card/95 shadow-sm backdrop-blur-sm">
      {/* Primary: search, metrics, view */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/60 px-3 py-2">
        {showSearch ? (
          <div className="relative min-w-[12rem] flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              className="h-8 pl-8 pr-10 text-sm"
              placeholder={isCatalogTypes ? 'Buscar tipo de vulnerabilidad…' : 'Buscar hallazgos…'}
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
            />
            <kbd className="absolute right-2 top-1/2 hidden -translate-y-1/2 font-mono text-[10px] text-muted-foreground sm:inline">
              ⌘K
            </kbd>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          <span className="tabular-nums">
            <span className="font-medium text-foreground">{stats.total.toLocaleString()}</span>{' '}
            {isCatalogTypes ? 'tipos' : 'total'}
          </span>
          {isCatalogTypes ? (
            <>
              <span className="text-border">·</span>
              <span className="tabular-nums">
                <span className="font-medium text-foreground">
                  {stats.groupedTotal.toLocaleString()}
                </span>{' '}
                inst.
              </span>
            </>
          ) : null}
          <span className="hidden text-border sm:inline">·</span>
          <button
            type="button"
            onClick={() => onFilterChange('incomplete')}
            className={cn(
              'tabular-nums transition-colors hover:text-foreground',
              filter === 'incomplete' && 'font-medium text-amber-700 dark:text-amber-300'
            )}
          >
            <span className="font-medium text-foreground">{stats.incomplete}</span> pend.
          </button>
          <span className="text-border">·</span>
          <button
            type="button"
            onClick={() => onFilterChange('gemini-ready')}
            className={cn(
              'tabular-nums transition-colors hover:text-foreground',
              filter === 'gemini-ready' && 'font-medium text-violet-700 dark:text-violet-300'
            )}
          >
            <span className="font-medium text-foreground">{stats.geminiReady}</span> IA
          </button>
          {!isCatalogTypes && onAiGroupedViewToggle ? (
            <>
              <span className="text-border">·</span>
              <button
                type="button"
                onClick={onAiGroupedViewToggle}
                className={cn(
                  'tabular-nums transition-colors hover:text-foreground inline-flex items-center gap-0.5',
                  aiGroupedView && 'font-medium text-indigo-700 dark:text-indigo-300'
                )}
              >
                <Layers className="size-3" />
                <span className="font-medium text-foreground">
                  {stats.aiGroupCount?.toLocaleString() ?? 0}
                </span>{' '}
                agrup. IA
              </button>
            </>
          ) : null}
          {!isCatalogTypes && stats.duplicateRemove > 0 ? (
            <>
              <span className="text-border">·</span>
              <span className="tabular-nums text-orange-700 dark:text-orange-300">
                {stats.duplicateRemove} dup.
              </span>
            </>
          ) : null}
          {!isCatalogTypes ? (
            <>
              <span className="hidden text-border md:inline">·</span>
              <span className="hidden tabular-nums md:inline">{stats.groupedTotal} grupos</span>
            </>
          ) : null}
          <span className="hidden text-border lg:inline">·</span>
          <span className="hidden tabular-nums lg:inline">{filteredTotal.toLocaleString()} en consulta</span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {!isCatalogTypes ? (
            <SegmentedControl value={viewMode} options={viewOptions} onChange={onViewModeChange} />
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={onSeveritySortToggle}
            title={severitySort ? 'Ordenar por severidad' : 'Ordenar por fecha'}
          >
            <ArrowDownWideNarrow className="size-3.5" />
            <span className="hidden sm:inline">{severitySort ? 'Severidad' : 'Fecha'}</span>
          </Button>
        </div>
      </div>

      {/* Filters: severity + status */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-muted/10 px-3 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ALL_SEVERITIES.filter((sev) => severityCounts[sev] > 0).map((sev) => {
            const active = severidadesMulti?.length === 1 && severidadesMulti[0] === sev;
            return (
              <button
                key={sev}
                type="button"
                title={`Filtrar ${SEVERITY_SELECT_LABEL[sev]}`}
                onClick={() => onToggleSeverityFilter(sev)}
                className={cn(
                  'flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 transition-all',
                  active ? 'ring-2 ring-primary/40 ring-offset-1 ring-offset-background' : 'opacity-85 hover:opacity-100'
                )}
              >
                <SeverityBadge severity={sev} compact />
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {severityCounts[sev].toLocaleString()}
                </span>
              </button>
            );
          })}
          {severidadesMulti?.length ? (
            <button
              type="button"
              className="shrink-0 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={onClearSeverityFilter}
            >
              Todas
            </button>
          ) : null}
        </div>

        {showToolSourceFilter && onToolSourceFilterChange ? (
          <>
            <span className="hidden h-4 w-px shrink-0 bg-border md:block" />
            <div className="flex min-w-0 shrink-0 items-center gap-1 overflow-x-auto pb-0.5 max-w-[min(100%,28rem)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TOOL_SOURCE_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onToolSourceFilterChange(opt.id)}
                  className={cn(
                    'shrink-0 rounded-md border px-2 py-0.5 text-[10px] transition-colors',
                    toolSourceFilter === opt.id
                      ? 'border-indigo-500/50 bg-indigo-500/10 font-medium text-indigo-800 dark:text-indigo-200'
                      : 'border-border/60 text-muted-foreground hover:text-foreground'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        ) : null}

        <span className="hidden h-4 w-px shrink-0 bg-border sm:block" />

        <SegmentedControl
          value={
            filter === 'incomplete' || filter === 'gemini-ready' || filter === 'all'
              ? filter
              : ('all' as ReviewFilter)
          }
          options={PRIMARY_FILTER_OPTIONS}
          onChange={onFilterChange}
          className="shrink-0"
        />

        <Button
          type="button"
          variant={filtersExpanded ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 shrink-0 gap-1 px-2 text-[11px]"
          onClick={() => onAdvancedOpenChange(!advancedOpen)}
        >
          <SlidersHorizontal className="size-3" />
          Filtros
          {isAdvancedFilter ? <span className="size-1.5 rounded-full bg-primary" /> : null}
        </Button>

        {showTableOptions ? (
          <ToolbarMenu
            label={
              <span className="inline-flex items-center gap-1">
                <ListOrdered className="size-3.5" />
                Detalles
              </span>
            }
            align="right"
            variant={detailView ? 'secondary' : 'ghost'}
            className="shrink-0"
          >
            <div className="space-y-2 px-3 py-2 min-w-[14rem]">
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={detailView}
                  onChange={(e) => onDetailViewChange(e.target.checked)}
                  className="size-3.5 rounded border-border"
                />
                Conteo de caracteres (#)
              </label>
              <p className="text-[10px] text-muted-foreground leading-snug">
                Columna # a la derecha de cada campo. Ordena y filtra textos largos (p. ej. explicación
                técnica).
              </p>
              {detailView ? (
                <div className="space-y-1 border-t border-border pt-2">
                  <p className="text-[10px] font-medium text-foreground">Expl. técnica</p>
                  <button
                    type="button"
                    className="block w-full rounded-md bg-muted/80 px-2 py-1 text-left text-[10px] hover:bg-muted"
                    onClick={() =>
                      onDetailPreset({
                        enableDetailView: true,
                        filter: {
                          columnId: 'count:explicacion_tecnica',
                          filter: { kind: 'char_gte', min: 500 },
                        },
                        sort: { column: 'count:explicacion_tecnica', direction: 'desc' },
                      })
                    }
                  >
                    ≥ 500 caracteres · ordenar ↓
                  </button>
                  <button
                    type="button"
                    className="block w-full rounded-md bg-muted/80 px-2 py-1 text-left text-[10px] hover:bg-muted"
                    onClick={() =>
                      onDetailPreset({
                        enableDetailView: true,
                        filter: {
                          columnId: 'count:explicacion_tecnica',
                          filter: { kind: 'char_gte', min: 1000 },
                        },
                        sort: { column: 'count:explicacion_tecnica', direction: 'desc' },
                      })
                    }
                  >
                    ≥ 1000 caracteres · ordenar ↓
                  </button>
                  <button
                    type="button"
                    className="block w-full rounded-md bg-muted/80 px-2 py-1 text-left text-[10px] hover:bg-muted"
                    onClick={() =>
                      onDetailPreset({
                        enableDetailView: true,
                        sort: { column: 'count:explicacion_tecnica', direction: 'desc' },
                      })
                    }
                  >
                    Solo ordenar por longitud ↓
                  </button>
                </div>
              ) : null}
            </div>
          </ToolbarMenu>
        ) : null}

        {showTableOptions ? (
          <ToolbarMenu
            label="Vista"
            align="right"
            variant="ghost"
            className="shrink-0"
          >
            <div className="space-y-2 px-3 py-2">
              <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                Campo faltante
                <select
                  className="h-7 rounded-md border border-input bg-background px-2 text-[11px] text-foreground"
                  value={missingField}
                  onChange={(e) => onMissingFieldChange(e.target.value)}
                >
                  {missingFieldOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showAllFields}
                  onChange={(e) => onShowAllFieldsChange(e.target.checked)}
                  className="size-3.5 rounded border-border"
                />
                Todos los campos
              </label>
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={density === 'comfortable'}
                  onChange={(e) => onDensityChange(e.target.checked ? 'comfortable' : 'compact')}
                  className="size-3.5 rounded border-border"
                />
                Filas cómodas
              </label>
              {columnFilterCount > 0 ? (
                <button
                  type="button"
                  className="text-[10px] text-destructive hover:underline"
                  onClick={onClearColumnFilters}
                >
                  Limpiar {columnFilterCount} filtro(s) de columna
                </button>
              ) : null}
            </div>
          </ToolbarMenu>
        ) : null}
      </div>

      {advancedOpen ? (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 bg-muted/5 px-3 py-1.5">
          <span className="mr-1 text-[10px] uppercase tracking-wide text-muted-foreground">Más filtros</span>
          {ADVANCED_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onFilterChange(opt.id)}
              className={cn(
                'rounded-md px-2 py-0.5 text-[11px] transition-colors',
                filter === opt.id
                  ? 'bg-muted text-foreground ring-1 ring-border'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* Selection + bulk actions */}
      <div className="relative flex flex-wrap items-center gap-1.5 px-3 py-1.5">
        <ToolbarMenu
          label={
            hasSelection ? (
              <span className="inline-flex items-center gap-1.5">
                {selectAllInQuery ? (
                  <CheckSquare className="size-3.5 text-primary" />
                ) : (
                  <Square className="size-3.5" />
                )}
                {selectionCount.toLocaleString()} sel.
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Square className="size-3.5" />
                Selección
              </span>
            )
          }
          variant="secondary"
        >
          <MenuItem
            disabled={busy !== null || selectingAll || filteredTotal === 0}
            onClick={onSelectAllInQuery}
          >
            {selectingAll ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CheckSquare className="size-3.5" />
            )}
            Todos en consulta ({filteredTotal.toLocaleString()})
          </MenuItem>
          <MenuItem disabled={busy !== null || filteredPageCount === 0} onClick={onSelectAllOnPage}>
            <Table2 className="size-3.5" />
            Página actual ({filteredPageCount})
          </MenuItem>
          <MenuItem onClick={onClearSelection}>
            <Square className="size-3.5" />
            Ninguno
          </MenuItem>
        </ToolbarMenu>

        <span className="hidden h-4 w-px bg-border sm:block" />

        <Button
          type="button"
          size="sm"
          className="h-7 gap-1 text-xs"
          disabled={
            busy !== null ||
            geminiTargetCount === 0 ||
            (selectAllInQuery && !isCatalogTypes)
          }
          onClick={onGeminiCatalog}
          title="Mejora campos Español en catálogo y sincroniza hallazgos del mismo tipo"
        >
          {busy === 'gemini' ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          Gemini
          <span className="tabular-nums opacity-80">({geminiTargetCount})</span>
          {geminiProgress ? (
            <span className="tabular-nums opacity-70">
              {geminiProgress.done}/{geminiProgress.total}
            </span>
          ) : null}
        </Button>

        {showSpreadsheetActions ? (
          <ToolbarMenu
            label={
              <span className="inline-flex items-center gap-1">
                {busy === 'consolidate' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Layers className="size-3.5" />
                )}
                Consolidar
              </span>
            }
            disabled={busy !== null}
            align="left"
          >
            <MenuItem disabled={!engagementId} onClick={onConsolidateEngagement}>
              <Layers className="size-3.5" />
              Catálogo maestro → todo el proyecto
            </MenuItem>
            <MenuItem disabled={filteredPageCount === 0} onClick={onConsolidatePage}>
              <Table2 className="size-3.5" />
              Catálogo maestro → página actual
            </MenuItem>
            <MenuItem disabled={!hasSelection || selectAllInQuery} onClick={onConsolidateSelection}>
              <CheckSquare className="size-3.5" />
              Catálogo maestro → selección
            </MenuItem>
            {onAssignAiGroups ? (
              <MenuItem disabled={!engagementId} onClick={onAssignAiGroups}>
                {busy === 'assign-groups' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Layers className="size-3.5" />
                )}
                Asignar grupos IA → proyecto
              </MenuItem>
            ) : null}
          </ToolbarMenu>
        ) : null}

        {showSpreadsheetActions ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs"
              disabled={busy !== null || !engagementId}
              onClick={onSyncEngagement}
              title="Sincroniza TODOS los hallazgos del servicio desde el catálogo operativo (no solo el filtro visible)"
            >
              {busy === 'sync' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Sync servicio
              {serviceFindingsCount > 0 ? (
                <span className="tabular-nums opacity-80">
                  ({serviceFindingsCount.toLocaleString()})
                </span>
              ) : null}
            </Button>
            <ToolbarMenu
              label={<MoreHorizontal className="size-3.5" />}
              variant="ghost"
              className="px-2"
              disabled={busy !== null}
              align="left"
            >
              <MenuItem disabled={filteredPageCount === 0} onClick={onSyncPage}>
                <Table2 className="size-3.5" />
                Sync solo vista actual ({filteredPageCount.toLocaleString()} tipos)
              </MenuItem>
              <MenuItem disabled={!hasSelection || selectAllInQuery} onClick={onSyncSelection}>
                <CheckSquare className="size-3.5" />
                Sync solo selección
              </MenuItem>
            </ToolbarMenu>
          </>
        ) : null}

        {showServiceWorkflowActions && engagementId ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="default"
              className="h-7 gap-1 text-xs"
              disabled={busy !== null || serviceFindingsCount === 0}
              onClick={onPublishToRepository}
              title={
                serviceFindingsCount > 0
                  ? `Carga las ${serviceFindingsCount.toLocaleString()} instancias del servicio en gestión de vulnerabilidades (todas las importadas del CSV, no solo el filtro visible)`
                  : 'Confirma la carga en gestión de vulnerabilidades (repositorio global del tenant)'
              }
            >
              {busy === 'publish' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              Cargar a gestión
              {serviceFindingsCount > 0 ? (
                <span className="tabular-nums opacity-80">
                  ({serviceFindingsCount.toLocaleString()})
                </span>
              ) : null}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
              disabled={busy !== null || serviceFindingsCount === 0}
              onClick={onClearServiceLoad}
              title="Elimina todos los hallazgos importados en este servicio (p. ej. archivo equivocado)"
            >
              {busy === 'clear' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Eraser className="size-3.5" />
              )}
              Limpiar tabla
            </Button>
          </>
        ) : null}

        <ToolbarMenu
          label={
            <span className="inline-flex items-center gap-1">
              <Wrench className="size-3.5" />
              Correctivas
            </span>
          }
          variant="ghost"
          className="px-2"
          align="left"
          disabled={busy !== null}
        >
          {!isCatalogTypes ? (
            <MenuItem disabled={!engagementId} onClick={onRepairText}>
              Reparar acentos (hallazgos)
            </MenuItem>
          ) : null}
          <MenuItem disabled={!engagementId || geminiTargetCount === 0} onClick={onTruncateExplicacion}>
            Acotar explicación técnica ({explicacionMaxParagraphs} ¶, catálogo)
          </MenuItem>
        </ToolbarMenu>

        {!isCatalogTypes ? (
          <ToolbarMenu
            label={<MoreHorizontal className="size-3.5" />}
            variant="ghost"
            className="px-2"
            align="left"
          >
            <MenuItem
              disabled={busy !== null || stats.duplicateRemove === 0}
              onClick={onDeleteDuplicates}
            >
              <Copy className="size-3.5" />
              Eliminar duplicados ({stats.duplicateRemove})
            </MenuItem>
          </ToolbarMenu>
        ) : null}

        <details className="group ml-auto hidden text-[11px] text-muted-foreground lg:block">
          <summary className="flex cursor-pointer list-none items-center gap-1 hover:text-foreground [&::-webkit-details-marker]:hidden">
            <Info className="size-3" />
            Catálogo
          </summary>
          <p className="absolute right-3 z-40 mt-1 max-w-sm rounded-lg border border-border bg-popover p-2 text-[11px] leading-snug shadow-lg">
            El <strong className="font-medium text-foreground">Catálogo Operativo</strong> es la fuente de
            verdad para campos Español. Gemini mejora el catálogo y propaga por plugin/identificador.{' '}
            <strong className="font-medium text-foreground">Sync servicio</strong> y{' '}
            <strong className="font-medium text-foreground">Cargar a gestión</strong> aplican a{' '}
            <strong className="font-medium text-foreground">todas</strong> las instancias importadas del
            servicio ({serviceFindingsCount > 0 ? serviceFindingsCount.toLocaleString() : 'todas'}), no al
            filtro visible
            {serviceTypeCount > 0 ? ` (${serviceTypeCount.toLocaleString()} tipos)` : ''}.
          </p>
        </details>

        {!isCatalogTypes ? (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className={cn('h-7 gap-1 text-xs', !hasSelection && 'ml-auto lg:ml-0')}
            disabled={busy !== null || !hasSelection}
            onClick={onDeleteSelected}
          >
            <Trash2 className="size-3.5" />
            Eliminar
            {hasSelection ? (
              <span className="tabular-nums">({selectionCount.toLocaleString()})</span>
            ) : null}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
