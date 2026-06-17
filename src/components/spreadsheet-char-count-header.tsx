'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Filter, Loader2, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SpreadsheetCharCountColumnId } from '@/lib/finding-spreadsheet-columns';
import type { SpreadsheetColumnFilter, SpreadsheetSort } from '@/lib/spreadsheet-column-filters';

type SpreadsheetCharCountHeaderProps = {
  countColumnId: SpreadsheetCharCountColumnId;
  sourceLabel: string;
  sort: SpreadsheetSort | null;
  filter?: SpreadsheetColumnFilter;
  onSort: (columnId: SpreadsheetCharCountColumnId, direction: 'asc' | 'desc') => void;
  onFilterChange: (
    columnId: SpreadsheetCharCountColumnId,
    filter: SpreadsheetColumnFilter | null
  ) => void;
  showGemini?: boolean;
  geminiBusy?: boolean;
  onGemini?: () => void;
  className?: string;
  style?: React.CSSProperties;
};

export function SpreadsheetCharCountHeader({
  countColumnId,
  sourceLabel,
  sort,
  filter,
  onSort,
  onFilterChange,
  showGemini = false,
  geminiBusy = false,
  onGemini,
  className,
  style,
}: SpreadsheetCharCountHeaderProps) {
  const [open, setOpen] = useState(false);
  const [minDraft, setMinDraft] = useState('');
  const [maxDraft, setMaxDraft] = useState('');
  const ref = useRef<HTMLTableCellElement>(null);

  const active = Boolean(filter);
  const sorted = sort?.column === countColumnId;

  useEffect(() => {
    if (!open) return;
    if (filter?.kind === 'char_gte') setMinDraft(String(filter.min));
    else setMinDraft('');
    if (filter?.kind === 'char_lte') setMaxDraft(String(filter.max));
    else if (filter?.kind === 'char_gte') setMaxDraft('');
    else setMaxDraft('');
  }, [open, filter]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const applyMin = () => {
    const min = Number.parseInt(minDraft, 10);
    if (!Number.isFinite(min) || min < 0) onFilterChange(countColumnId, null);
    else onFilterChange(countColumnId, { kind: 'char_gte', min });
    setOpen(false);
  };

  const applyMax = () => {
    const max = Number.parseInt(maxDraft, 10);
    if (!Number.isFinite(max) || max < 0) onFilterChange(countColumnId, null);
    else onFilterChange(countColumnId, { kind: 'char_lte', max });
    setOpen(false);
  };

  return (
    <th
      ref={ref}
      style={style}
      className={cn(
        'border-b border-border/60 bg-muted/30 px-1 py-2 text-center font-medium text-[9px] uppercase tracking-wider text-muted-foreground whitespace-nowrap relative',
        active && 'ring-1 ring-inset ring-primary/30',
        className
      )}
      title={`Caracteres · ${sourceLabel}`}
    >
      <div className="flex items-center justify-center gap-0.5">
        <button
          type="button"
          className="flex items-center gap-0.5 hover:text-foreground min-w-0"
          onClick={() => onSort(countColumnId, sorted && sort?.direction === 'asc' ? 'desc' : 'asc')}
        >
          <span className="tabular-nums">#</span>
          {sorted ? (
            sort?.direction === 'asc' ? (
              <ArrowUp className="size-2.5 shrink-0 text-primary" />
            ) : (
              <ArrowDown className="size-2.5 shrink-0 text-primary" />
            )
          ) : (
            <ArrowUpDown className="size-2.5 shrink-0 opacity-30" />
          )}
        </button>
        {showGemini ? (
          <button
            type="button"
            className={cn(
              'p-0.5 rounded shrink-0',
              geminiBusy
                ? 'text-violet-400'
                : 'text-violet-600/80 hover:text-violet-400 hover:bg-violet-500/10'
            )}
            title={`Gemini en catálogo (${sourceLabel}) con prompt configurado`}
            disabled={geminiBusy}
            onClick={(e) => {
              e.stopPropagation();
              onGemini?.();
            }}
          >
            {geminiBusy ? (
              <Loader2 className="size-2.5 animate-spin" />
            ) : (
              <Sparkles className="size-2.5" />
            )}
          </button>
        ) : null}
        <button
          type="button"
          className={cn(
            'p-0.5 rounded hover:bg-muted shrink-0',
            active ? 'text-primary' : 'text-muted-foreground/60 hover:text-muted-foreground'
          )}
          title="Filtrar por longitud"
          onClick={() => setOpen((o) => !o)}
        >
          <Filter className="size-2.5" />
        </button>
      </div>

      {open ? (
        <div
          className="absolute left-1/2 top-full z-[200] mt-1 w-44 -translate-x-1/2 rounded-lg border border-border bg-popover p-2 shadow-xl space-y-2 normal-case tracking-normal text-left"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[10px] font-medium text-foreground">{sourceLabel}</p>
          <div className="flex gap-1">
            <button
              type="button"
              className="flex-1 rounded bg-muted px-2 py-1 text-[10px] hover:bg-muted/80"
              onClick={() => {
                onSort(countColumnId, 'asc');
                setOpen(false);
              }}
            >
              Menor → Mayor
            </button>
            <button
              type="button"
              className="flex-1 rounded bg-muted px-2 py-1 text-[10px] hover:bg-muted/80"
              onClick={() => {
                onSort(countColumnId, 'desc');
                setOpen(false);
              }}
            >
              Mayor → Menor
            </button>
          </div>
          <label className="block text-[10px] text-muted-foreground">
            Mín. caracteres
            <input
              type="number"
              min={0}
              className="mt-0.5 h-7 w-full rounded border border-input bg-background px-2 text-[11px]"
              value={minDraft}
              onChange={(e) => setMinDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyMin();
              }}
            />
          </label>
          <button
            type="button"
            className="w-full rounded bg-primary/90 px-2 py-1 text-[10px] text-primary-foreground"
            onClick={applyMin}
          >
            Aplicar mínimo
          </button>
          <label className="block text-[10px] text-muted-foreground">
            Máx. caracteres
            <input
              type="number"
              min={0}
              className="mt-0.5 h-7 w-full rounded border border-input bg-background px-2 text-[11px]"
              value={maxDraft}
              onChange={(e) => setMaxDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyMax();
              }}
            />
          </label>
          <button
            type="button"
            className="w-full rounded bg-muted px-2 py-1 text-[10px]"
            onClick={applyMax}
          >
            Aplicar máximo
          </button>
          <div className="flex flex-wrap gap-1 border-t border-border pt-1">
            {[500, 1000, 2000].map((n) => (
              <button
                key={n}
                type="button"
                className="rounded bg-muted/80 px-1.5 py-0.5 text-[9px] hover:bg-muted"
                onClick={() => {
                  onFilterChange(countColumnId, { kind: 'char_gte', min: n });
                  setOpen(false);
                }}
              >
                ≥{n}
              </button>
            ))}
          </div>
          {active ? (
            <button
              type="button"
              className="flex w-full items-center gap-1 rounded px-2 py-1 text-[10px] text-destructive hover:bg-destructive/10"
              onClick={() => {
                onFilterChange(countColumnId, null);
                setOpen(false);
              }}
            >
              <X className="size-3" />
              Limpiar
            </button>
          ) : null}
        </div>
      ) : null}
    </th>
  );
}
