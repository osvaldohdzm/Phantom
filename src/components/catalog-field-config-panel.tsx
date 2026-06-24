'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Save, Settings2, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  buildDefaultCatalogFieldConfig,
  loadCatalogFieldConfig,
  officialSelectableColumns,
  resolveDisplayColumns,
  saveCatalogFieldConfig,
  type CatalogFieldConfig,
  type BrandingWithOfficialFields,
} from '@/lib/catalog-field-config';
import { useAuth } from '@/contexts/auth-context';
import { catalogLocaleAiColumns } from '@/lib/tenant-locale';
import type { ReviewFieldKey } from '@/lib/finding-completeness';
import { REVIEW_FIELDS } from '@/lib/finding-completeness';
import {
  catalogColumnLabel,
  type VulnsCatalogEditableColumn,
} from '@/lib/vulns-catalog-columns';
import { useUiT } from '@/lib/use-ui-locale';

type CatalogFieldConfigPanelProps = {
  open: boolean;
  onClose?: () => void;
  onSaved?: (config: CatalogFieldConfig) => void;
  embedded?: boolean;
  /** Tenant a persistir (Administración). Si no se pasa, usa el tenant activo. */
  tenantId?: string;
  branding?: BrandingWithOfficialFields | null;
  /** Idioma operativo a configurar (por defecto el del tenant activo). */
  configLanguage?: 'es' | 'en';
};

export function CatalogFieldConfigPanel({
  open,
  onClose,
  onSaved,
  embedded = false,
  tenantId: tenantIdProp,
  branding,
  configLanguage,
}: CatalogFieldConfigPanelProps) {
  const { tenantLanguage, activeTenant, branding: sessionBranding, refresh } = useAuth();
  const { t } = useUiT();
  const language = configLanguage ?? tenantLanguage;
  const tenantId = tenantIdProp ?? activeTenant?.id ?? '';
  const brandingSource = branding ?? sessionBranding;

  const [config, setConfig] = useState<CatalogFieldConfig>(() =>
    buildDefaultCatalogFieldConfig(language)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);

  const selectableColumns = useMemo(
    () => officialSelectableColumns(language),
    [language]
  );

  const displayColumnOptions = useMemo(() => {
    const set = new Set<string>(['Id', ...config.mandatoryCatalogColumns]);
    return [...set];
  }, [config.mandatoryCatalogColumns]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadCatalogFieldConfig(language, { branding: brandingSource });
      setConfig(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [language, brandingSource, t]);

  useEffect(() => {
    if (open || embedded) void load();
  }, [open, embedded, load, language]);

  const toggleCatalogMandatory = (col: VulnsCatalogEditableColumn) => {
    setConfig((prev) => {
      const set = new Set(prev.mandatoryCatalogColumns);
      if (set.has(col)) set.delete(col);
      else set.add(col);
      const mandatoryCatalogColumns = [...set];
      const displaySet = new Set(prev.displayColumns ?? resolveDisplayColumns(prev, language));
      if (!set.has(col)) displaySet.delete(col);
      else displaySet.add(col);
      return {
        ...prev,
        mandatoryCatalogColumns,
        displayColumns: [...displaySet],
      };
    });
  };

  const toggleDisplayColumn = (col: string) => {
    setConfig((prev) => {
      const current = new Set(prev.displayColumns ?? resolveDisplayColumns(prev, language));
      if (current.has(col)) current.delete(col);
      else current.add(col);
      const ordered = displayColumnOptions.filter((c) => current.has(c));
      return { ...prev, displayColumns: ordered.length ? ordered : ['Id'] };
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
    if (!tenantId) {
      setError(t('officialFieldsNoTenant'));
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await saveCatalogFieldConfig(config, language, {
        tenantId,
        branding: brandingSource,
      });
      await refresh();
      onSaved?.(config);
      setNotice(t('officialFieldsSaved'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorGeneric'));
    } finally {
      setSaving(false);
    }
  };

  if (!open && !embedded) return null;

  const langLabel = language === 'en' ? t('languageEnglish') : t('languageSpanish');

  return (
    <Card className={embedded ? 'border-border shadow-sm' : 'border-violet-500/30 shadow-lg'}>
      <CardHeader className="border-b border-border pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 className="size-5 text-violet-600 dark:text-violet-400" />
              {t('officialFieldsTitle')}
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {t('officialFieldsDesc')} — <span className="font-medium">{langLabel}</span>
            </CardDescription>
          </div>
          {!embedded && onClose ? (
            <Button type="button" variant="ghost" size="sm" className="h-8" onClick={onClose}>
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        {loading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            {t('tenantLoadingBranding')}
          </p>
        ) : (
          <>
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                {t('officialFieldsCatalogTitle')}
              </h3>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {language === 'en' ? t('officialFieldsCatalogHintEn') : t('officialFieldsCatalogHintEs')}
              </p>
              <div className="grid gap-1 sm:grid-cols-2 max-h-56 overflow-y-auto rounded-lg border border-border p-2">
                {selectableColumns.map((col) => {
                  const mandatory = config.mandatoryCatalogColumns.includes(col);
                  return (
                    <label
                      key={col}
                      className={cn(
                        'flex items-center gap-2 text-xs rounded px-2 py-1.5 cursor-pointer',
                        mandatory
                          ? 'bg-violet-500/10 text-violet-800 dark:text-violet-100'
                          : 'text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={mandatory}
                        onChange={() => toggleCatalogMandatory(col)}
                        className="rounded border-input"
                      />
                      <span className="truncate">{catalogColumnLabel(col, language)}</span>
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                {t('officialFieldsTableTitle')}
              </h3>
              <p className="text-[10px] text-muted-foreground">{t('officialFieldsTableHint')}</p>
              <div className="flex flex-wrap gap-2 rounded-lg border border-border p-2">
                {displayColumnOptions.map((col) => {
                  const visible = (config.displayColumns ?? resolveDisplayColumns(config, language)).includes(
                    col
                  );
                  return (
                    <label
                      key={col}
                      className={cn(
                        'flex items-center gap-1.5 text-xs rounded-full border px-2.5 py-1 cursor-pointer',
                        visible
                          ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-800 dark:text-indigo-200'
                          : 'border-border text-muted-foreground'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={() => toggleDisplayColumn(col)}
                        className="rounded border-input"
                      />
                      {catalogColumnLabel(col, language)}
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                {t('officialFieldsFindingsTitle')}
              </h3>
              <p className="text-[10px] text-muted-foreground">{t('officialFieldsFindingsHint')}</p>
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
                {t('officialFieldsAiTitle')} ({langLabel})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {catalogLocaleAiColumns(language).map((field) => (
                  <div key={field} className="rounded-lg border border-border p-2">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between text-left text-xs text-foreground"
                      onClick={() => setExpandedPrompt((c) => (c === field ? null : field))}
                    >
                      <span>{catalogColumnLabel(field, language)}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {config.aiPrompts[field]?.trim() ? t('officialFieldsAiCustom') : t('officialFieldsAiDefault')}
                      </span>
                    </button>
                    {expandedPrompt === field ? (
                      <textarea
                        className="mt-2 w-full min-h-[72px] rounded border border-input bg-background px-2 py-1.5 text-xs text-foreground"
                        placeholder={t('officialFieldsAiPlaceholder')}
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
          {!embedded && onClose ? (
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {t('close')}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="bg-violet-600 hover:bg-violet-500"
            disabled={loading || saving || !tenantId}
            onClick={() => void onSave()}
          >
            {saving ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Save className="size-3.5 mr-1" />}
            {t('officialFieldsSave')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
