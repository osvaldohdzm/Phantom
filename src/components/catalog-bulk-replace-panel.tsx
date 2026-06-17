'use client';

import { useMemo, useState } from 'react';
import { Loader2, Plus, Replace, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BULK_REPLACE_DEFAULT_COLUMNS,
  type BulkReplaceMode,
  type BulkReplaceRule,
  type BulkReplaceSample,
  type BulkReplaceScope,
} from '@/lib/catalog-bulk-replace';
import { catalogColumnLabel } from '@/lib/vulns-catalog-columns';

type RuleRow = BulkReplaceRule & { id: string };

type BulkReplaceResult = {
  dry_run: boolean;
  scoped_rows: number;
  affected_rows: number;
  affected_cells: number;
  updated_rows?: number;
  updated_cells?: number;
  samples: BulkReplaceSample[];
  hint?: string;
};

const PRESET_PACKS: { label: string; rules: Omit<BulkReplaceRule, 'columns'>[] }[] = [
  {
    label: 'Redirección → Open Redirect',
    rules: [
      { find: 'Redirección Abierta', replace: 'Open Redirect', mode: 'exact' },
      { find: 'redirección abierta', replace: 'open redirect', mode: 'exact' },
      { find: 'Redireccion Abierta', replace: 'Open Redirect', mode: 'exact' },
    ],
  },
  {
    label: 'openwsman (no traducir «hombre»)',
    rules: [
      { find: 'hombre abierto', replace: 'openwsman', mode: 'exact' },
      { find: 'Hombre abierto', replace: 'openwsman', mode: 'exact' },
      { find: ': hombre ', replace: ': openwsman ', mode: 'exact' },
      { find: ': Hombre ', replace: ': openwsman ', mode: 'exact' },
    ],
  },
  {
    label: 'Términos técnicos (cookies, relay)',
    rules: [
      { find: 'galletas', replace: 'cookies', mode: 'exact' },
      { find: 'Galletas', replace: 'Cookies', mode: 'exact' },
      { find: 'open relay', replace: 'Open Relay', mode: 'exact', case_insensitive: true },
    ],
  },
];

function newRuleId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function newRuleRow(): RuleRow {
  return {
    id: newRuleId(),
    find: '',
    replace: '',
    mode: 'exact',
    case_insensitive: true,
    columns: [...BULK_REPLACE_DEFAULT_COLUMNS],
  };
}

type Props = {
  availableColumns: string[];
  scope: BulkReplaceScope;
  scopedRowsHint?: number;
  onApplied?: () => void;
};

export function CatalogBulkReplacePanel({
  availableColumns,
  scope,
  scopedRowsHint,
  onApplied,
}: Props) {
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState<RuleRow[]>([newRuleRow()]);
  const [useScope, setUseScope] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkReplaceResult | null>(null);

  const columnOptions = useMemo(() => {
    const set = new Set(availableColumns);
    return [...BULK_REPLACE_DEFAULT_COLUMNS, ...availableColumns].filter(
      (c, i, arr) => set.has(c) && arr.indexOf(c) === i
    );
  }, [availableColumns]);

  const effectiveScope = useScope ? scope : undefined;

  async function run(dryRun: boolean) {
    setBusy(true);
    setError(null);
    if (dryRun) setResult(null);
    try {
      const payload = {
        dry_run: dryRun,
        scope: effectiveScope ?? null,
        rules: rules.map(({ find, replace, mode, case_insensitive, columns }) => ({
          find,
          replace,
          mode,
          case_insensitive,
          columns: columns?.length ? columns : null,
        })),
      };
      const res = await fetch('/api/vulns-catalog/bulk-replace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as BulkReplaceResult & { error?: string; details?: string };
      if (!res.ok) throw new Error(data.details || data.error || 'Error en reemplazo masivo');
      setResult(data);
      if (!dryRun && (data.updated_rows ?? 0) > 0) {
        onApplied?.();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setBusy(false);
    }
  }

  function updateRule(id: string, patch: Partial<RuleRow>) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function toggleRuleColumn(id: string, column: string) {
    setRules((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const cols = r.columns ?? [];
        const next = cols.includes(column)
          ? cols.filter((c) => c !== column)
          : [...cols, column];
        return { ...r, columns: next.length ? next : [...BULK_REPLACE_DEFAULT_COLUMNS] };
      })
    );
  }

  function addPreset(packIndex: number) {
    const pack = PRESET_PACKS[packIndex];
    if (!pack) return;
    setRules((prev) => [
      ...prev,
      ...pack.rules.map((r) => ({
        ...r,
        id: newRuleId(),
        columns: [...BULK_REPLACE_DEFAULT_COLUMNS],
      })),
    ]);
  }

  if (!open) {
    return (
      <div className="w-full">
        <Button
          type="button"
          variant="outline"
          className="border-violet-500/40 text-violet-700 dark:text-violet-300"
          onClick={() => setOpen(true)}
        >
          <Replace className="size-4 mr-2" />
          Buscar y reemplazar (edición avanzada)
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg border border-violet-500/30 bg-violet-500/5 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">Edición avanzada: buscar y reemplazar</p>
          <p className="text-xs text-muted-foreground mt-1">
            Corrige traducciones erróneas en lote (texto exacto o expresión regular). Varias reglas se aplican en
            orden.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cerrar
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="text-[10px] uppercase text-muted-foreground self-center">Plantillas:</span>
        {PRESET_PACKS.map((pack, i) => (
          <Button key={pack.label} type="button" variant="outline" size="sm" onClick={() => addPreset(i)}>
            + {pack.label}
          </Button>
        ))}
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={useScope}
          onChange={(e) => setUseScope(e.target.checked)}
          className="rounded border-input"
        />
        Solo filas del filtro actual
        {useScope && scopedRowsHint !== undefined ? (
          <span className="text-foreground">({scopedRowsHint.toLocaleString()} en vista)</span>
        ) : null}
        {!useScope ? <span className="text-amber-700 dark:text-amber-400">— todo el catálogo</span> : null}
      </label>

      <div className="space-y-3">
        {rules.map((rule, index) => (
          <div
            key={rule.id}
            className="rounded-lg border border-border bg-card p-3 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Regla {index + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={rules.length <= 1}
                onClick={() => setRules((prev) => prev.filter((r) => r.id !== rule.id))}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>

            <div className="grid gap-2 lg:grid-cols-[1fr_1fr_auto]">
              <label className="space-y-1">
                <span className="text-[10px] uppercase text-muted-foreground">Buscar</span>
                {rule.mode === 'regex' ? (
                  <textarea
                    className="flex min-h-[4.5rem] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    placeholder="Ej: hombre|galletas"
                    value={rule.find}
                    onChange={(e) => updateRule(rule.id, { find: e.target.value })}
                  />
                ) : (
                  <Input
                    className="font-mono text-xs"
                    placeholder="Ej: Redirección Abierta"
                    value={rule.find}
                    onChange={(e) => updateRule(rule.id, { find: e.target.value })}
                  />
                )}
              </label>
              <label className="space-y-1">
                <span className="text-[10px] uppercase text-muted-foreground">Reemplazar por</span>
                <Input
                  className="font-mono text-xs"
                  placeholder="Ej: Open Redirect"
                  value={rule.replace}
                  onChange={(e) => updateRule(rule.id, { replace: e.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] uppercase text-muted-foreground">Modo</span>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                  value={rule.mode}
                  onChange={(e) =>
                    updateRule(rule.id, { mode: e.target.value as BulkReplaceMode })
                  }
                >
                  <option value="exact">Texto exacto</option>
                  <option value="regex">Expresión regular</option>
                </select>
                {rule.mode === 'exact' ? (
                  <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1">
                    <input
                      type="checkbox"
                      checked={rule.case_insensitive !== false}
                      onChange={(e) => updateRule(rule.id, { case_insensitive: e.target.checked })}
                      className="rounded border-input"
                    />
                    Ignorar mayúsculas
                  </label>
                ) : (
                  <p className="text-[10px] text-muted-foreground mt-1">Sintaxis JavaScript (flags gi)</p>
                )}
              </label>
            </div>

            <fieldset className="space-y-1.5">
              <legend className="text-[10px] uppercase text-muted-foreground">Columnas</legend>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {columnOptions.map((col) => (
                  <label
                    key={`${rule.id}-${col}`}
                    className="flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[10px] cursor-pointer hover:bg-muted/60"
                  >
                    <input
                      type="checkbox"
                      checked={(rule.columns ?? []).includes(col)}
                      onChange={() => toggleRuleColumn(rule.id, col)}
                    />
                    {catalogColumnLabel(col)}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setRules((prev) => [...prev, newRuleRow()])}>
          <Plus className="size-3.5 mr-1" />
          Añadir regla
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void run(true)}>
          {busy ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : null}
          Vista previa
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={busy}
          className="bg-violet-600 hover:bg-violet-700 text-white"
          onClick={() => {
            if (
              !window.confirm(
                `¿Aplicar ${rules.length} regla(s) en ${
                  useScope ? 'las filas filtradas' : 'TODO el catálogo'
                }? Esta acción modifica PostgreSQL.`
              )
            ) {
              return;
            }
            void run(false);
          }}
        >
          {busy ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : null}
          Aplicar cambios
        </Button>
      </div>

      {error ? (
        <p className="text-xs text-rose-600 border border-rose-500/30 rounded px-2 py-1.5">{error}</p>
      ) : null}

      {result ? (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-xs">
          <p className="font-medium text-foreground">
            {result.dry_run ? 'Vista previa' : 'Aplicado'}: {result.affected_rows.toLocaleString()} fila(s),{' '}
            {result.affected_cells.toLocaleString()} celda(s)
            {!result.dry_run && result.updated_rows !== undefined
              ? ` · guardadas ${result.updated_rows.toLocaleString()}`
              : ''}
          </p>
          {result.hint ? <p className="text-muted-foreground">{result.hint}</p> : null}
          {result.samples.length > 0 ? (
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {result.samples.map((s, i) => (
                <li key={`${s.id}-${s.column}-${i}`} className="rounded border border-border bg-background p-2">
                  <span className="font-mono text-violet-700 dark:text-violet-300">
                    #{s.id} · {catalogColumnLabel(s.column)}
                  </span>
                  <p className="text-rose-700/90 dark:text-rose-400 line-through mt-1">{s.before}</p>
                  <p className="text-emerald-700 dark:text-emerald-400 mt-0.5">{s.after}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Ninguna coincidencia con las reglas actuales.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
