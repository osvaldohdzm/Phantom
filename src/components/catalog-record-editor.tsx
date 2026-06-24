'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Save, ShieldAlert, Sparkles, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VULNS_CATALOG_TOOL_ID_COLUMNS } from '@/lib/catalog-tool-index';
import {
  VULNS_CATALOG_EDITABLE_COLUMNS,
  catalogColumnLabel,
  isLongTextCatalogColumn,
  type VulnsCatalogEditableColumn,
} from '@/lib/vulns-catalog-columns';
import {
  isCatalogAiColumn,
  suggestCatalogLocaleField,
} from '@/lib/catalog-ai-fields';
import { catalogLocaleAiColumns, shouldHideCatalogColumnInEditor } from '@/lib/tenant-locale';
import {
  catalogRowCompleteness,
  getAiPromptForField,
  mandatoryLocaleAiFields,
  saveCatalogFieldAiPrompt,
  type CatalogFieldConfig,
} from '@/lib/catalog-field-config';
import { useAuth } from '@/contexts/auth-context';
import { syncFindingsFromCatalogApi, getFinding } from '@/lib/secops-api';
import { charCountTone } from '@/lib/finding-spreadsheet-columns';
import { cn } from '@/lib/utils';

export type CatalogRow = Record<string, unknown> & { Id: string };

type CatalogRecordEditorProps = {
  row: CatalogRow;
  onClose: () => void;
  onSaved?: (row: CatalogRow, sync?: { synced: number; total: number }) => void;
  highlightFromFinding?: boolean;
  engagementId?: string;
  fromFindingId?: string;
  className?: string;
  fieldConfig: CatalogFieldConfig;
  onFieldConfigUpdate?: (config: CatalogFieldConfig) => void;
};

function rowToFormValues(row: CatalogRow): Partial<Record<VulnsCatalogEditableColumn, string>> {
  const next: Partial<Record<VulnsCatalogEditableColumn, string>> = {};
  for (const col of VULNS_CATALOG_EDITABLE_COLUMNS) {
    const raw = row[col];
    next[col] = raw === null || raw === undefined ? '' : String(raw);
  }
  return next;
}

function isLocaleAiField(col: string, language: 'es' | 'en'): boolean {
  return isCatalogAiColumn(col, language);
}

type CatalogFieldLayout = 'default' | 'compact' | 'hero';

function fieldMeetsMin(
  row: Record<string, unknown>,
  col: VulnsCatalogEditableColumn,
  config: CatalogFieldConfig
): boolean {
  const min = config.minLengthsCatalog[col] ?? 3;
  return String(row[col] ?? '').trim().length >= min;
}

function catalogFieldCharCountClass(length: number, belowMin: boolean): string {
  if (belowMin) return 'text-amber-600 dark:text-amber-400';
  switch (charCountTone(length)) {
    case 'critical':
      return 'text-rose-600 dark:text-rose-400';
    case 'alert':
      return 'text-orange-600 dark:text-orange-400';
    case 'warn':
      return 'text-amber-600 dark:text-amber-400';
    default:
      return 'text-muted-foreground';
  }
}

function CatalogFieldCharCount({
  length,
  minLength,
  mandatory,
  belowMin = false,
}: {
  length: number;
  minLength?: number;
  mandatory: boolean;
  belowMin?: boolean;
}) {
  return (
    <p
      className={cn(
        'text-[10px] font-mono tabular-nums text-right leading-none pt-1',
        catalogFieldCharCountClass(length, belowMin)
      )}
    >
      {length.toLocaleString('es-MX')}
      {mandatory && minLength != null ? (
        <span className="text-muted-foreground font-sans"> · mín {minLength}</span>
      ) : (
        <span className="text-muted-foreground font-sans"> caracteres</span>
      )}
    </p>
  );
}

export function CatalogRecordEditor({
  row,
  onClose,
  onSaved,
  highlightFromFinding,
  className,
  fieldConfig,
  onFieldConfigUpdate,
  engagementId,
  fromFindingId,
}: CatalogRecordEditorProps) {
  const { tenantLanguage } = useAuth();
  const [formValues, setFormValues] = useState(() => rowToFormValues(row));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestingField, setSuggestingField] = useState<string | 'all' | 'mandatory' | null>(
    null
  );
  const [aiSuggested, setAiSuggested] = useState<Set<string>>(new Set());
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  const [promptOverrides, setPromptOverrides] = useState<Record<string, string>>({});
  const [promptSaveState, setPromptSaveState] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});
  const promptDebounceRef = useRef<Record<string, number>>({});

  const { mandatoryColumns, optionalColumns, identityToolColumns } = useMemo(() => {
    const mandatorySet = new Set(fieldConfig.mandatoryCatalogColumns);
    const mandatory: VulnsCatalogEditableColumn[] = [];
    const optional: VulnsCatalogEditableColumn[] = [];
    const identityTools = new Set<VulnsCatalogEditableColumn>(['NessusPluginId']);

    for (const col of VULNS_CATALOG_TOOL_ID_COLUMNS) {
      if (col === 'NessusPluginId') continue;
      const raw = formValues[col] ?? row[col];
      if (String(raw ?? '').trim()) identityTools.add(col);
    }

    const topIdentity = new Set<VulnsCatalogEditableColumn>([
      'StandardVulnerabilityName',
      ...identityTools,
    ]);

    for (const col of VULNS_CATALOG_EDITABLE_COLUMNS) {
      if (topIdentity.has(col)) continue;
      if (shouldHideCatalogColumnInEditor(col, tenantLanguage)) continue;
      if (mandatorySet.has(col)) mandatory.push(col);
      else optional.push(col);
    }

    const identityToolColumns = VULNS_CATALOG_TOOL_ID_COLUMNS.filter((col) =>
      identityTools.has(col)
    );

    return { mandatoryColumns: mandatory, optionalColumns: optional, identityToolColumns };
  }, [fieldConfig.mandatoryCatalogColumns, formValues, row, tenantLanguage]);

  useEffect(() => {
    setFormValues(rowToFormValues(row));
    setAiSuggested(new Set());
    setError(null);
  }, [row.Id]);

  useEffect(() => {
    return () => {
      for (const timer of Object.values(promptDebounceRef.current)) {
        clearTimeout(timer);
      }
    };
  }, []);

  const resolveFieldHint = useCallback(
    (field: string) => {
      const draft = promptOverrides[field]?.trim();
      if (draft) return draft;
      return getAiPromptForField(field, fieldConfig, tenantLanguage);
    },
    [fieldConfig, promptOverrides, tenantLanguage]
  );

  const persistFieldPrompt = useCallback(
    async (field: string, value: string) => {
      setPromptSaveState((prev) => ({ ...prev, [field]: 'saving' }));
      try {
        const next = await saveCatalogFieldAiPrompt(field, value);
        onFieldConfigUpdate?.(next);
        setPromptOverrides((prev) => {
          const copy = { ...prev };
          delete copy[field];
          return copy;
        });
        setPromptSaveState((prev) => ({ ...prev, [field]: 'saved' }));
        window.setTimeout(() => {
          setPromptSaveState((prev) => {
            if (prev[field] !== 'saved') return prev;
            const copy = { ...prev };
            delete copy[field];
            return copy;
          });
        }, 2000);
      } catch {
        setPromptSaveState((prev) => ({ ...prev, [field]: 'error' }));
      }
    },
    [onFieldConfigUpdate]
  );

  const onPromptChange = useCallback(
    (field: string, value: string) => {
      setPromptOverrides((prev) => ({ ...prev, [field]: value }));
      const existing = promptDebounceRef.current[field];
      if (existing) clearTimeout(existing);
      promptDebounceRef.current[field] = window.setTimeout(() => {
        void persistFieldPrompt(field, value);
      }, 700);
    },
    [persistFieldPrompt]
  );

  const promptValueFor = useCallback(
    (field: string) => promptOverrides[field] ?? fieldConfig.aiPrompts[field] ?? '',
    [fieldConfig.aiPrompts, promptOverrides]
  );

  const mergedRow = { ...row, ...formValues };
  const completeness = catalogRowCompleteness(mergedRow, fieldConfig, tenantLanguage);

  const suggestOne = useCallback(
    async (field: string) => {
      setSuggestingField(field);
      setError(null);
      try {
        const hint = resolveFieldHint(field);
        const latestRow = { ...row, ...formValues };
        const value = await suggestCatalogLocaleField(field, latestRow, {
          fieldHint: hint,
          config: fieldConfig,
          language: tenantLanguage,
        });
        setFormValues((prev) => ({ ...prev, [field]: value }));
        setAiSuggested((prev) => new Set([...prev, field]));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al sugerir campo');
      } finally {
        setSuggestingField(null);
      }
    },
    [row, formValues, fieldConfig, resolveFieldHint, tenantLanguage]
  );

  const suggestFields = useCallback(
    async (fields: string[], mode: 'all' | 'mandatory') => {
      setSuggestingField(mode);
      setError(null);
      try {
        let current: Record<string, unknown> = { ...row, ...formValues };
        for (const field of fields) {
          setSuggestingField(field);
          const hint = resolveFieldHint(field);
          const value = await suggestCatalogLocaleField(field, current, {
            fieldHint: hint,
            config: fieldConfig,
            language: tenantLanguage,
          });
          current = { ...current, [field]: value };
          setFormValues((prev) => ({ ...prev, [field]: value }));
          setAiSuggested((prev) => new Set([...prev, field]));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al sugerir campos');
      } finally {
        setSuggestingField(null);
      }
    },
    [row, formValues, fieldConfig, resolveFieldHint, tenantLanguage]
  );

  const suggestAll = () => void suggestFields([...catalogLocaleAiColumns(tenantLanguage)], 'all');

  const suggestMandatory = () => {
    const mandatory = mandatoryLocaleAiFields(fieldConfig, tenantLanguage);
    void suggestFields(mandatory, 'mandatory');
  };

  const renderColumnField = (
    column: VulnsCatalogEditableColumn,
    mandatory: boolean,
    layout: CatalogFieldLayout = 'default'
  ) => {
    const isAiField = isLocaleAiField(column, tenantLanguage);
    const isBusy = suggestingField === column;
    const wasSuggested = aiSuggested.has(column);
    const rawValue = String(formValues[column] ?? '');
    const valLen = rawValue.trim().length;
    const charLen = rawValue.length;
    const minLen = fieldConfig.minLengthsCatalog[column] ?? 3;
    const isShort = mandatory && valLen > 0 && valLen < minLen;
    const isEmpty = mandatory && valLen === 0;

    const labelClass =
      layout === 'hero'
        ? 'text-[11px] uppercase tracking-wider font-bold text-foreground'
        : layout === 'compact'
          ? 'text-[9px] uppercase tracking-wider font-semibold text-muted-foreground'
          : cn(
              'text-[10px] uppercase tracking-wider font-bold flex items-center gap-1.5',
              mandatory ? 'text-foreground/90' : 'text-muted-foreground'
            );

    return (
      <label
        className={cn(
          'space-y-1.5',
          layout === 'compact' && 'min-w-[7.5rem] max-w-[11rem] shrink-0',
          layout === 'hero' && 'w-full'
        )}
        key={column}
      >
        <div className="flex items-center justify-between gap-2">
          <span className={cn(labelClass, layout !== 'compact' && 'flex items-center gap-1.5')}>
            {catalogColumnLabel(column, tenantLanguage)}
            {mandatory ? <span className="text-rose-500">*</span> : null}
            {wasSuggested ? (
              <span className="text-violet-600 dark:text-violet-400 normal-case font-semibold">· IA</span>
            ) : null}
          </span>
          {isAiField ? (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={suggestingField !== null || saving}
                onClick={() => setExpandedPrompt((c) => (c === column ? null : column))}
                className="h-6 px-1.5 text-[9px] text-muted-foreground hover:text-foreground"
              >
                ctx
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={suggestingField !== null || saving}
                onClick={() => void suggestOne(column)}
                className="h-6 px-2 text-[10px] text-violet-700 dark:text-violet-300 hover:bg-violet-500/10"
              >
                {isBusy ? (
                  <Loader2 className="size-3 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="size-3 mr-1" />
                )}
                IA
              </Button>
            </div>
          ) : null}
        </div>
        {isAiField && expandedPrompt === column ? (
          <div className="space-y-1">
            <textarea
              className="min-h-[88px] w-full rounded-md border border-violet-500/25 bg-muted/30 px-2.5 py-2 text-[11px] leading-relaxed text-foreground"
              placeholder="Instrucciones para la IA en este campo. Se guardan automáticamente y aplican a todas las vulnerabilidades."
              value={promptValueFor(column)}
              onChange={(e) => onPromptChange(column, e.target.value)}
              onBlur={(e) => {
                const existing = promptDebounceRef.current[column];
                if (existing) clearTimeout(existing);
                void persistFieldPrompt(column, e.target.value);
              }}
            />
            <p className="text-[9px] text-muted-foreground">
              {promptSaveState[column] === 'saving'
                ? 'Guardando prompt…'
                : promptSaveState[column] === 'saved'
                  ? 'Prompt guardado para todo el catálogo'
                  : promptSaveState[column] === 'error'
                    ? 'No se pudo guardar el prompt'
                    : fieldConfig.aiPrompts[column]?.trim()
                      ? 'Prompt personalizado activo en este campo'
                      : 'Sin prompt personalizado (se usan reglas por defecto)'}
            </p>
          </div>
        ) : null}
        {isLongTextCatalogColumn(column) ? (
          <textarea
            className={cn(
              'min-h-[100px] w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 transition-all',
              isEmpty
                ? 'border-rose-500/50 focus:ring-rose-500/40'
                : isShort
                  ? 'border-amber-500/40 focus:ring-amber-500/40'
                  : mandatory
                    ? 'border-border focus:ring-ring/30'
                    : 'border-input focus:ring-ring/40'
            )}
            value={formValues[column] ?? ''}
            onChange={(event) => setFormValues((prev) => ({ ...prev, [column]: event.target.value }))}
          />
        ) : (
          <Input
            className={cn(
              layout === 'hero' && 'h-10 text-sm font-medium',
              layout === 'compact' && 'h-8 text-xs font-mono',
              isEmpty
                ? 'border-rose-500/50'
                : isShort
                  ? 'border-amber-500/40'
                  : mandatory
                    ? 'border-border'
                    : layout === 'hero'
                      ? 'border-border bg-muted/20'
                      : ''
            )}
            value={formValues[column] ?? ''}
            onChange={(event) => setFormValues((prev) => ({ ...prev, [column]: event.target.value }))}
          />
        )}
        <CatalogFieldCharCount
          length={charLen}
          minLength={mandatory ? minLen : undefined}
          mandatory={mandatory}
          belowMin={isShort}
        />
      </label>
    );
  };

  const onSave = async () => {
    const updates: Partial<Record<VulnsCatalogEditableColumn, string | null>> = {};
    for (const col of VULNS_CATALOG_EDITABLE_COLUMNS) {
      const current = row[col];
      const next = (formValues[col] ?? '').trim();
      const currentNormalized = current === null || current === undefined ? '' : String(current).trim();
      if (next !== currentNormalized) {
        updates[col] = next === '' ? null : next;
      }
    }

    if (Object.keys(updates).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/vulns-catalog/${row.Id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const payload = (await response.json()) as { row?: CatalogRow; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible guardar los cambios');
      }
      if (payload.row) {
        let engagement = engagementId;
        if (!engagement && fromFindingId) {
          try {
            const finding = await getFinding(fromFindingId);
            engagement = finding.engagement_id ?? undefined;
          } catch {
            /* ignore */
          }
        }
        let syncResult: { synced: number; total: number } | undefined;
        try {
          const sync = await syncFindingsFromCatalogApi({
            catalog_id: String(payload.row.Id),
            engagement_id: engagement,
          });
          syncResult = { synced: sync.synced, total: sync.total };
        } catch {
          /* el catálogo ya guardó; la sync es complementaria */
        }
        onSaved?.(payload.row, syncResult);
      }
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      id="catalog-editor"
      className={cn(
        'shadow-lg animate-in fade-in slide-in-from-bottom-4 scroll-mt-24',
        highlightFromFinding && 'border-emerald-500/40 ring-1 ring-emerald-500/20',
        className
      )}
    >
      <CardHeader className="border-b border-border mb-4">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-amber-500 shrink-0" />
            <span>
              Edición de registro #{row.Id}
              {highlightFromFinding ? (
                <span className="ml-2 text-xs font-normal text-emerald-600 dark:text-emerald-400">desde hallazgo</span>
              ) : null}
            </span>
          </CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground hover:text-foreground"
            onClick={onClose}
            disabled={saving}
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span
            className={cn(
              'text-[10px] px-2 py-0.5 rounded-full border font-mono',
              completeness.percent >= 100
                ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                : 'border-amber-500/40 text-amber-700 dark:text-amber-300'
            )}
          >
            Obligatorios: {completeness.percent}%
          </span>
          {completeness.missing.length > 0 ? (
            <span className="text-[10px] text-muted-foreground truncate">
              Falta: {completeness.missing.join(' · ')}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs bg-violet-600 hover:bg-violet-500"
            disabled={suggestingField !== null || saving}
            onClick={suggestAll}
          >
            {suggestingField === 'all' || (suggestingField && suggestingField !== 'mandatory') ? (
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5 mr-1.5" />
            )}
            Rellenar todos con IA
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs border-violet-500/40 text-violet-700 dark:text-violet-300"
            disabled={suggestingField !== null || saving || mandatoryLocaleAiFields(fieldConfig, tenantLanguage).length === 0}
            onClick={suggestMandatory}
          >
            {suggestingField === 'mandatory' ? (
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5 mr-1.5" />
            )}
            Solo obligatorios
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <section
          aria-labelledby="catalog-identity-heading"
          className="rounded-xl border border-border border-l-[3px] border-l-sky-500/70 bg-card p-4 sm:p-5 space-y-3"
        >
          <div className="border-b border-border/80 pb-2">
            <h3 id="catalog-identity-heading" className="text-sm font-semibold text-foreground">
              Identificación
            </h3>
            <p className="text-xs text-muted-foreground">
              Plugin o identificador de herramienta y nombre estándar de la vulnerabilidad.
            </p>
          </div>
          {identityToolColumns.length > 0 ? (
            <div className="flex flex-wrap items-end gap-3">
              {identityToolColumns.map((column) => renderColumnField(column, false, 'compact'))}
            </div>
          ) : null}
          {renderColumnField('StandardVulnerabilityName', false, 'hero')}
        </section>

        {mandatoryColumns.length > 0 ? (
          <section
            aria-labelledby="catalog-mandatory-heading"
            className="rounded-xl border border-border border-l-[3px] border-l-rose-500/70 bg-card p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/80 pb-3">
              <div className="space-y-0.5">
                <h3 id="catalog-mandatory-heading" className="text-sm font-semibold text-foreground">
                  Campos obligatorios
                </h3>
                <p className="text-xs text-muted-foreground max-w-xl">
                  {tenantLanguage === 'en'
                    ? 'Report fields · must be complete'
                    : 'Campos para informe Word · deben estar completos'}{' '}
                  ({completeness.percent}%)
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-rose-500/30 bg-rose-500/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                {mandatoryColumns.length} obligatorios
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {mandatoryColumns.map((column) => renderColumnField(column, true))}
            </div>
          </section>
        ) : null}

        {optionalColumns.length > 0 ? (
          <section
            aria-labelledby="catalog-optional-heading"
            className="rounded-xl border border-border border-l-[3px] border-l-muted-foreground/30 bg-muted/20 p-4 sm:p-5 space-y-4"
          >
            <div className="border-b border-border pb-3 space-y-0.5">
              <h3 id="catalog-optional-heading" className="text-sm font-semibold text-foreground">
                Datos fuente y complementarios
              </h3>
              <p className="text-xs text-muted-foreground max-w-xl">
                Referencia Nessus/CVE y campos en inglés. La IA usa{' '}
                <strong className="font-medium text-foreground/80">todos los campos no vacíos</strong>{' '}
                (inglés + español ya completados) para rellenar los obligatorios.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {optionalColumns.map((column) => renderColumnField(column, false))}
            </div>
          </section>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Descartar
          </Button>
          <Button
            onClick={() => void onSave()}
            disabled={saving || suggestingField !== null}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            <Save className="size-4" />
            {saving ? 'Guardando...' : 'Actualizar catálogo'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
