'use client';

import { createPortal } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Severity } from '@/lib/secops-api';
import type { MatrixColumnFilter, MatrixSort } from '@/lib/vuln-matrix-filters';

const SEVERITY_LABEL: Record<Severity, string> = {
  Critical: 'Crítica',
  High: 'Alta',
  Medium: 'Media',
  Low: 'Baja',
  Info: 'Info',
};

const ALL_SEVERITIES: Severity[] = ['Critical', 'High', 'Medium', 'Low', 'Info'];

const FILTER_PANEL_WIDTH = 208;
const FILTER_PANEL_GAP = 4;

type FilterPanelPos = { top: number; left: number };

type VulnMatrixColumnHeaderProps = {
  columnId: string;
  label: string;
  sort: MatrixSort | null;
  filter?: MatrixColumnFilter;
  uniqueValues?: string[];
  onSort: (columnId: string, direction: 'asc' | 'desc') => void;
  onFilterChange: (columnId: string, filter: MatrixColumnFilter | null) => void;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  /** Columna de la vista principal consolidada. */
  emphasized?: boolean;
};

export function VulnMatrixColumnHeader({
  columnId,
  label,
  sort,
  filter,
  uniqueValues = [],
  onSort,
  onFilterChange,
  className,
  style,
  children,
  emphasized,
}: VulnMatrixColumnHeaderProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [panelPos, setPanelPos] = useState<FilterPanelPos | null>(null);
  const [textDraft, setTextDraft] = useState('');
  const [severityDraft, setSeverityDraft] = useState<Set<Severity>>(new Set());
  const ref = useRef<HTMLDivElement>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const active = Boolean(filter);

  useEffect(() => setMounted(true), []);

  const updatePanelPosition = useCallback(() => {
    const btn = filterBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const panelHeight = panelRef.current?.offsetHeight ?? 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < panelHeight + FILTER_PANEL_GAP && spaceAbove > spaceBelow;
    let left = rect.left;
    left = Math.min(left, window.innerWidth - FILTER_PANEL_WIDTH - 8);
    left = Math.max(8, left);
    const top = openUp
      ? rect.top - panelHeight - FILTER_PANEL_GAP
      : rect.bottom + FILTER_PANEL_GAP;
    setPanelPos((prev) => {
      if (prev?.left === left && prev?.top === top) return prev;
      return { left, top };
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }
    updatePanelPosition();
    const panel = panelRef.current;
    const ro = panel ? new ResizeObserver(() => updatePanelPosition()) : null;
    if (panel && ro) ro.observe(panel);
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [open, updatePanelPosition]);

  const sorted = sort?.column === columnId;

  useEffect(() => {
    if (!open) return;
    if (filter?.kind === 'contains' || filter?.kind === 'equals') {
      setTextDraft(filter.text);
    } else {
      setTextDraft('');
    }
    if (filter?.kind === 'severity_in') {
      setSeverityDraft(new Set(filter.values));
    } else if (columnId === 'severidad') {
      setSeverityDraft(new Set());
    }
  }, [open, filter, columnId]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const applyText = (kind: 'contains' | 'equals') => {
    const t = textDraft.trim();
    if (!t) onFilterChange(columnId, null);
    else onFilterChange(columnId, { kind, text: t });
    setOpen(false);
  };

  const applySeverity = () => {
    const values = [...severityDraft];
    if (!values.length) onFilterChange(columnId, null);
    else onFilterChange(columnId, { kind: 'severity_in', values });
    setOpen(false);
  };

  return (
    <div ref={ref} className={cn('relative flex items-center gap-0.5 min-w-0 pr-2', className)} style={style}>
      <span
        className={cn(
          'truncate text-[10px] font-semibold uppercase tracking-wide',
          emphasized ? 'text-violet-800 dark:text-violet-200' : 'text-foreground'
        )}
      >
        {label}
      </span>
      <button
        type="button"
        className="shrink-0 rounded p-0.5 hover:bg-muted"
        title={sorted ? `Orden ${sort!.direction}` : 'Ordenar'}
        onClick={(e) => {
          e.stopPropagation();
          const next =
            sorted && sort!.direction === 'asc'
              ? 'desc'
              : sorted && sort!.direction === 'desc'
                ? 'asc'
                : 'asc';
          onSort(columnId, next);
        }}
      >
        {sorted ? (
          sort!.direction === 'asc' ? (
            <ArrowUp className="size-3 text-violet-600" />
          ) : (
            <ArrowDown className="size-3 text-violet-600" />
          )
        ) : (
          <ArrowUpDown className="size-3 text-muted-foreground" />
        )}
      </button>
      <button
        ref={filterBtnRef}
        type="button"
        className={cn(
          'shrink-0 rounded p-0.5 hover:bg-muted',
          active && 'text-violet-600'
        )}
        title="Filtrar"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <Filter className="size-3" />
      </button>
      {children}
      {mounted && open
        ? createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: panelPos?.top ?? -9999,
            left: panelPos?.left ?? 0,
            width: FILTER_PANEL_WIDTH,
            zIndex: 9999,
            visibility: panelPos ? 'visible' : 'hidden',
          }}
          className="rounded-md border border-border bg-popover p-2 shadow-lg text-[11px] font-normal normal-case tracking-normal"
          onClick={(e) => e.stopPropagation()}
        >
          {columnId === 'severidad' ? (
            <div className="space-y-2">
              <p className="text-muted-foreground">Severidad</p>
              {ALL_SEVERITIES.map((sev) => (
                <label key={sev} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={severityDraft.has(sev)}
                    onChange={(e) => {
                      setSeverityDraft((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(sev);
                        else next.delete(sev);
                        return next;
                      });
                    }}
                  />
                  {SEVERITY_LABEL[sev]}
                </label>
              ))}
              <div className="flex gap-1 pt-1">
                <button
                  type="button"
                  className="flex-1 rounded bg-primary px-2 py-1 text-primary-foreground"
                  onClick={applySeverity}
                >
                  Aplicar
                </button>
                <button
                  type="button"
                  className="rounded border px-2 py-1"
                  onClick={() => {
                    onFilterChange(columnId, null);
                    setOpen(false);
                  }}
                >
                  <X className="size-3" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                placeholder="Texto…"
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
              />
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className="rounded border px-2 py-0.5 hover:bg-muted"
                  onClick={() => applyText('contains')}
                >
                  Contiene
                </button>
                <button
                  type="button"
                  className="rounded border px-2 py-0.5 hover:bg-muted"
                  onClick={() => applyText('equals')}
                >
                  Igual
                </button>
                <button
                  type="button"
                  className="rounded border px-2 py-0.5 hover:bg-muted"
                  onClick={() => onFilterChange(columnId, { kind: 'empty' })}
                >
                  Vacío
                </button>
                <button
                  type="button"
                  className="rounded border px-2 py-0.5 hover:bg-muted"
                  onClick={() => onFilterChange(columnId, { kind: 'not_empty' })}
                >
                  Con dato
                </button>
              </div>
              {uniqueValues.length > 0 ? (
                <div className="max-h-24 overflow-y-auto border-t border-border pt-1 space-y-0.5">
                  {uniqueValues.slice(0, 8).map((v) => (
                    <button
                      key={v}
                      type="button"
                      className="block w-full truncate text-left hover:text-violet-600"
                      onClick={() => {
                        onFilterChange(columnId, { kind: 'equals', text: v });
                        setOpen(false);
                      }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              ) : null}
              {active ? (
                <button
                  type="button"
                  className="text-destructive"
                  onClick={() => {
                    onFilterChange(columnId, null);
                    setOpen(false);
                  }}
                >
                  Quitar filtro
                </button>
              ) : null}
            </div>
          )}
        </div>,
        document.body
      )
        : null}
    </div>
  );
}
