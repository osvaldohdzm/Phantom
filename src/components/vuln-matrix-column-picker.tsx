'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Columns3, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  VULN_MATRIX_PRIMARY_COLUMN_IDS,
  type VulnMatrixColumnId,
} from '@/lib/vuln-matrix-columns';
import {
  isPrimaryMatrixColumn,
  optionalColumnsNotVisible,
} from '@/lib/vuln-matrix-column-layout';

type Props = {
  visibleColumnKeys: string[];
  onAddColumns: (ids: VulnMatrixColumnId[]) => void;
};

export function VulnMatrixColumnPicker({ visibleColumnKeys, onAddColumns }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  const available = useMemo(
    () => optionalColumnsNotVisible(visibleColumnKeys),
    [visibleColumnKeys]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter((c) => c.label.toLowerCase().includes(q));
  }, [available, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const togglePick = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const apply = () => {
    if (!picked.size) return;
    onAddColumns([...picked] as VulnMatrixColumnId[]);
    setPicked(new Set());
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-[11px]"
        onClick={() => setOpen((v) => !v)}
        disabled={available.length === 0}
        title="Agregar columnas CYB001 opcionales"
      >
        <Plus className="size-3.5" />
        Columnas CYB001
        {available.length > 0 ? (
          <span className="text-[10px] text-muted-foreground tabular-nums">+{available.length}</span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute left-0 top-full z-[9999] mt-1 w-80 rounded-lg border border-border bg-popover p-3 shadow-lg">
          <p className="text-[11px] font-medium text-foreground mb-1">Columnas opcionales CYB001</p>
          <p className="text-[10px] text-muted-foreground mb-2 leading-snug">
            Las {VULN_MATRIX_PRIMARY_COLUMN_IDS.length} columnas principales siempre están visibles
            (vulnerabilidad, severidad, evidencias 1–6, remediación…).
          </p>
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-8 text-xs"
              placeholder="Buscar columna…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-52 overflow-y-auto space-y-0.5 border border-border rounded-md p-1">
            {filtered.length === 0 ? (
              <p className="text-[10px] text-muted-foreground px-2 py-3 text-center">
                {available.length === 0
                  ? 'Todas las columnas CYB001 ya están en la tabla.'
                  : 'Sin coincidencias.'}
              </p>
            ) : (
              filtered.map((col) => (
                <label
                  key={col.id}
                  className={cn(
                    'flex items-start gap-2 rounded px-2 py-1.5 text-[11px] cursor-pointer hover:bg-muted/60',
                    picked.has(col.id) && 'bg-violet-500/10'
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={picked.has(col.id)}
                    onChange={() => togglePick(col.id)}
                  />
                  <span className="leading-snug">{col.label}</span>
                </label>
              ))
            )}
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              type="button"
              size="sm"
              className="h-7 text-[11px] flex-1"
              disabled={!picked.size}
              onClick={apply}
            >
              <Columns3 className="size-3.5 mr-1" />
              Agregar {picked.size || ''} columna(s)
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => {
                setOpen(false);
                setPicked(new Set());
              }}
            >
              Cerrar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PrimaryColumnBadge() {
  return (
    <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-violet-500/15 text-violet-700 dark:text-violet-300">
      Principal
    </span>
  );
}

export { isPrimaryMatrixColumn };
