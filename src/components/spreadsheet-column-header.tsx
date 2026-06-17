'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Filter, Loader2, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Severity } from '@/lib/secops-api';
import type { SpreadsheetColumnId } from '@/lib/finding-spreadsheet-columns';
import {
  SPREADSHEET_SEVERITIES,
  type SpreadsheetColumnFilter,
  type SpreadsheetSort,
} from '@/lib/spreadsheet-column-filters';

const SEVERITY_LABEL: Record<Severity, string> = {
  Critical: 'Crítica',
  High: 'Alta',
  Medium: 'Media',
  Low: 'Baja',
  Info: 'Info',
};

type SpreadsheetColumnHeaderProps = {
  columnId: SpreadsheetColumnId;
  label: string;
  shortLabel: string;
  sort: SpreadsheetSort | null;
  filter?: SpreadsheetColumnFilter;
  uniqueValues?: string[];
  onSort: (columnId: SpreadsheetColumnId, direction: 'asc' | 'desc') => void;
  onFilterChange: (columnId: SpreadsheetColumnId, filter: SpreadsheetColumnFilter | null) => void;
  showGemini?: boolean;
  geminiBusy?: boolean;
  onGemini?: () => void;
  className?: string;
  style?: React.CSSProperties;
};

export function SpreadsheetColumnHeader({
  columnId,
  label,
  shortLabel,
  sort,
  filter,
  uniqueValues = [],
  onSort,
  onFilterChange,
  showGemini = false,
  geminiBusy = false,
  onGemini,
  className,
  style,
}: SpreadsheetColumnHeaderProps) {
  const [open, setOpen] = useState(false);
  const [textDraft, setTextDraft] = useState('');
  const [severityDraft, setSeverityDraft] = useState<Set<Severity>>(new Set());
  const ref = useRef<HTMLTableCellElement>(null);

  const active = Boolean(filter);
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
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
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
    <th
      ref={ref}
      style={style}
      className={cn(
        'border-b border-slate-800/40 px-2 py-2 text-left font-medium text-[10px] uppercase tracking-wider text-slate-500 whitespace-nowrap relative',
        className
      )}
    >
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          className="flex items-center gap-0.5 hover:text-slate-200 min-w-0 flex-1"
          title={label}
          onClick={() => onSort(columnId, sorted && sort?.direction === 'asc' ? 'desc' : 'asc')}
        >
          <span className="truncate">{shortLabel}</span>
          {sorted ? (
            sort?.direction === 'asc' ? (
              <ArrowUp className="size-3 shrink-0 text-violet-400" />
            ) : (
              <ArrowDown className="size-3 shrink-0 text-violet-400" />
            )
          ) : (
            <ArrowUpDown className="size-3 shrink-0 opacity-30" />
          )}
        </button>
        {showGemini ? (
          <button
            type="button"
            className={cn(
              'p-0.5 rounded shrink-0',
              geminiBusy
                ? 'text-violet-400'
                : 'text-violet-600/80 hover:text-violet-400 hover:bg-violet-500/10 dark:text-violet-400'
            )}
            title="Gemini: usa el prompt configurado en catálogo para esta columna y propaga a hallazgos del mismo tipo"
            disabled={geminiBusy}
            onClick={(e) => {
              e.stopPropagation();
              onGemini?.();
            }}
          >
            {geminiBusy ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Sparkles className="size-3" />
            )}
          </button>
        ) : null}
        <button
          type="button"
          className={cn(
            'p-0.5 rounded hover:bg-slate-800 shrink-0',
            active ? 'text-violet-400' : 'text-slate-600 hover:text-slate-400'
          )}
          title="Filtrar columna"
          onClick={() => setOpen((o) => !o)}
        >
          <Filter className="size-3" />
        </button>
      </div>

      {open ? (
        <div
          className="absolute left-0 top-full mt-1 z-[200] w-52 rounded-lg border border-slate-700 bg-slate-900 shadow-xl p-2 space-y-2 normal-case tracking-normal"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[10px] font-semibold text-slate-300">{label}</p>
          <div className="flex gap-1">
            <button
              type="button"
              className="flex-1 px-2 py-1 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200"
              onClick={() => {
                onSort(columnId, 'asc');
                setOpen(false);
              }}
            >
              <ArrowUp className="size-3 inline mr-0.5" />
              A → Z
            </button>
            <button
              type="button"
              className="flex-1 px-2 py-1 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200"
              onClick={() => {
                onSort(columnId, 'desc');
                setOpen(false);
              }}
            >
              <ArrowDown className="size-3 inline mr-0.5" />
              Z → A
            </button>
          </div>

          {columnId === 'severidad' ? (
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {SPREADSHEET_SEVERITIES.map((sev) => (
                <label key={sev} className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
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
                    className="rounded border-slate-600"
                  />
                  {SEVERITY_LABEL[sev]}
                </label>
              ))}
              <button
                type="button"
                className="w-full mt-1 px-2 py-1 rounded text-[10px] bg-violet-600 hover:bg-violet-500 text-white"
                onClick={applySeverity}
              >
                Aplicar severidad
              </button>
            </div>
          ) : (
            <>
              <input
                className="w-full h-7 rounded border border-slate-700 bg-slate-950 px-2 text-[11px] text-slate-200"
                placeholder="Contiene…"
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyText('contains');
                }}
              />
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-200 hover:bg-slate-700"
                  onClick={() => applyText('contains')}
                >
                  Contiene
                </button>
                <button
                  type="button"
                  className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-200 hover:bg-slate-700"
                  onClick={() => applyText('equals')}
                >
                  Igual a
                </button>
                <button
                  type="button"
                  className="px-2 py-0.5 rounded text-[10px] text-slate-400 hover:text-slate-200"
                  onClick={() => {
                    onFilterChange(columnId, { kind: 'empty' });
                    setOpen(false);
                  }}
                >
                  Vacíos
                </button>
                <button
                  type="button"
                  className="px-2 py-0.5 rounded text-[10px] text-slate-400 hover:text-slate-200"
                  onClick={() => {
                    onFilterChange(columnId, { kind: 'not_empty' });
                    setOpen(false);
                  }}
                >
                  Con valor
                </button>
              </div>
              {uniqueValues.length > 0 ? (
                <div className="border-t border-slate-800 pt-1 max-h-24 overflow-y-auto space-y-0.5">
                  {uniqueValues.slice(0, 12).map((v) => (
                    <button
                      key={v}
                      type="button"
                      className="block w-full text-left text-[10px] text-slate-400 hover:text-violet-300 truncate px-1"
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
            </>
          )}

          {active ? (
            <button
              type="button"
              className="flex items-center gap-1 w-full px-2 py-1 rounded text-[10px] text-rose-400 hover:bg-rose-500/10"
              onClick={() => {
                onFilterChange(columnId, null);
                setOpen(false);
              }}
            >
              <X className="size-3" />
              Limpiar filtro
            </button>
          ) : null}
        </div>
      ) : null}
    </th>
  );
}
