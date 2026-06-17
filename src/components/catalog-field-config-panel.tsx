'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Save, Settings2, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  CATALOG_SPANISH_AI_FIELDS,
  type CatalogSpanishAiField,
} from '@/lib/catalog-ai-fields';
import {
  DEFAULT_CATALOG_FIELD_CONFIG,
  loadCatalogFieldConfig,
  saveCatalogFieldConfig,
  type CatalogFieldConfig,
} from '@/lib/catalog-field-config';
import type { ReviewFieldKey } from '@/lib/finding-completeness';
import { REVIEW_FIELDS } from '@/lib/finding-completeness';
import {
  VULNS_CATALOG_EDITABLE_COLUMNS,
  catalogColumnLabel,
  type VulnsCatalogEditableColumn,
} from '@/lib/vulns-catalog-columns';

type CatalogFieldConfigPanelProps = {
  open: boolean;
  onClose: () => void;
  onSaved?: (config: CatalogFieldConfig) => void;
};

export function CatalogFieldConfigPanel({ open, onClose, onSaved }: CatalogFieldConfigPanelProps) {
  const [config, setConfig] = useState<CatalogFieldConfig>(DEFAULT_CATALOG_FIELD_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadCatalogFieldConfig();
      setConfig(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar configuración');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const toggleCatalogMandatory = (col: VulnsCatalogEditableColumn) => {
    setConfig((prev) => {
      const set = new Set(prev.mandatoryCatalogColumns);
      if (set.has(col)) set.delete(col);
      else set.add(col);
      return { ...prev, mandatoryCatalogColumns: [...set] };
    });
  };

  const toggleFindingMandatory = (key: ReviewFieldKey) => {
    setConfig((prev) => {
      const set = new Set(prev.mandatoryFindingFields);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      return { ...prev, mandatoryFindingFields: [...set] };
    });
  };

  const setAiPrompt = (field: string, value: string) => {
    setConfig((prev) => ({
      ...prev,
      aiPrompts: { ...prev.aiPrompts, [field]: value },
    }));
  };

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await saveCatalogFieldConfig(config);
      onSaved?.(config);
      setNotice('Configuración guardada (servidor + navegador).');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Card className="border-violet-500/30 shadow-lg">
      <CardHeader className="border-b border-border pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 className="size-5 text-violet-600 dark:text-violet-400" />
              Campos obligatorios del catálogo
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Define qué columnas deben estar llenas en el catálogo operativo y qué campos se evalúan
              en hallazgos importados o manuales. La configuración se guarda en la base de datos.
            </CardDescription>
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-8" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        {loading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            Cargando configuración…
          </p>
        ) : (
          <>
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                Catálogo operativo (columnas obligatorias)
              </h3>
              <div className="grid gap-1 sm:grid-cols-2 max-h-56 overflow-y-auto rounded-lg border border-border p-2">
                {VULNS_CATALOG_EDITABLE_COLUMNS.map((col) => {
                  const mandatory = config.mandatoryCatalogColumns.includes(col);
                  return (
                    <label
                      key={col}
                      className={cn(
                        'flex items-center gap-2 text-xs rounded px-2 py-1.5 cursor-pointer',
                        mandatory ? 'bg-violet-500/10 text-violet-800 dark:text-violet-100' : 'text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={mandatory}
                        onChange={() => toggleCatalogMandatory(col)}
                        className="rounded border-input"
                      />
                      <span className="truncate">{catalogColumnLabel(col)}</span>
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                Hallazgos (campos obligatorios adicionales)
              </h3>
              <p className="text-[10px] text-muted-foreground">
                Los campos Esp* obligatorios del catálogo ya se mapean a hallazgos. Marca aquí extras
                como componente o referencias.
              </p>
              <div className="flex flex-wrap gap-2">
                {REVIEW_FIELDS.map(({ key, label }) => (
                  <label
                    key={key}
                    className={cn(
                      'flex items-center gap-1.5 text-xs rounded-full border px-2.5 py-1 cursor-pointer',
                      config.mandatoryFindingFields.includes(key)
                        ? 'border-sky-500/50 bg-sky-500/10 text-sky-800 dark:text-sky-200'
                        : 'border-border text-muted-foreground'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={config.mandatoryFindingFields.includes(key)}
                      onChange={() => toggleFindingMandatory(key)}
                      className="rounded border-input"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <Sparkles className="size-3.5" />
                Prompts IA por campo Español (opcional)
              </h3>
              <p className="text-[10px] text-muted-foreground">
                Cada campo Esp* usa texto plano; los ítems van con &quot; - &quot; por línea. Puedes añadir reglas o contexto extra
                para ese campo en particular.
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {CATALOG_SPANISH_AI_FIELDS.map((field) => (
                  <div key={field} className="rounded-lg border border-border p-2">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between text-left text-xs text-foreground"
                      onClick={() => setExpandedPrompt((c) => (c === field ? null : field))}
                    >
                      <span>{catalogColumnLabel(field)}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {config.aiPrompts[field]?.trim() ? 'personalizado' : 'default'}
                      </span>
                    </button>
                    {expandedPrompt === field ? (
                      <textarea
                        className="mt-2 w-full min-h-[72px] rounded border border-input bg-background px-2 py-1.5 text-xs text-foreground"
                        placeholder='Reglas extra: texto plano; listas con " - " por línea. Vacío = prompt por defecto.'
                        value={config.aiPrompts[field] ?? ''}
                        onChange={(e) => setAiPrompt(field, e.target.value)}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {notice ? (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <Check className="size-3.5" />
            {notice}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-violet-600 hover:bg-violet-500"
            disabled={loading || saving}
            onClick={() => void onSave()}
          >
            {saving ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Save className="size-3.5 mr-1" />}
            Guardar configuración
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
