import {
  getAiPromptForField,
  localeFieldSourceHint,
  type CatalogFieldConfig,
} from '@/lib/catalog-field-config';
import { VULNS_CATALOG_TOOL_ID_COLUMNS } from '@/lib/catalog-tool-index';
import { applyFieldLengthRules } from '@/lib/ai-field-length';
import { sanitizeAiPlainText } from '@/lib/plain-report-text';
import {
  catalogColumnForLocale,
  catalogLocaleAiColumns,
  catalogLocaleContextColumns,
  LOCALE_SOURCE_COLUMNS,
  localeFieldKeyFromColumn,
  type CatalogLocaleFieldKey,
  type TenantLanguage,
} from '@/lib/tenant-locale';
import {
  catalogColumnLabel,
  VULNS_CATALOG_EDITABLE_COLUMNS,
  VULNS_CATALOG_SELECT_COLUMNS,
} from '@/lib/vulns-catalog-columns';

export {
  CATALOG_SPANISH_AI_FIELDS,
  CATALOG_SPANISH_CONTEXT_FIELDS,
  type CatalogSpanishAiField,
} from '@/lib/catalog-spanish-field-ids';

export type CatalogLocaleAiField = string;

function cellText(row: Record<string, unknown>, col: string): string | null {
  const raw = row[col];
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  return text || null;
}

function formatContextBlock(label: string, value: string): string {
  return `${label}:\n${value}`;
}

function sourceColumnsForLanguage(language: TenantLanguage): readonly string[] {
  if (language === 'en') {
    return [
      ...LOCALE_SOURCE_COLUMNS,
      ...VULNS_CATALOG_TOOL_ID_COLUMNS.filter((c) => c !== 'NessusPluginId'),
    ];
  }
  return [
    ...LOCALE_SOURCE_COLUMNS,
    ...VULNS_CATALOG_TOOL_ID_COLUMNS.filter((c) => c !== 'NessusPluginId'),
  ];
}

/**
 * Construye contexto para Gemini según idioma del tenant.
 */
export function buildContextForLocaleField(
  field: string,
  row: Record<string, unknown>,
  language: TenantLanguage = 'es'
): {
  full: string;
  filledLocale: string;
  currentField: string;
  sourceData: string;
  sourceHint: string;
  nonEmptyCount: number;
} {
  const currentFieldValue = cellText(row, field);
  const currentFieldLabel = catalogColumnLabel(field, language);
  const currentField = currentFieldValue
    ? `## Valor actual del campo a generar/mejorar: ${currentFieldLabel}\n${formatContextBlock(currentFieldLabel, currentFieldValue)}`
    : '';

  const contextColumns = catalogLocaleContextColumns(language);
  const filledLocaleParts: string[] = [];
  for (const col of contextColumns) {
    if (col === field) continue;
    const val = cellText(row, col);
    if (val) {
      filledLocaleParts.push(formatContextBlock(catalogColumnLabel(col, language), val));
    }
  }

  const seen = new Set<string>([field, 'Id', ...contextColumns]);
  const sourceParts: string[] = [];

  for (const col of sourceColumnsForLanguage(language)) {
    if (language === 'en' && contextColumns.includes(col)) continue;
    const val = cellText(row, col);
    if (!val) continue;
    sourceParts.push(formatContextBlock(catalogColumnLabel(col, language), val));
    seen.add(col);
  }

  const otherParts: string[] = [];

  for (const col of VULNS_CATALOG_SELECT_COLUMNS) {
    if (seen.has(col)) continue;
    const val = cellText(row, col);
    if (!val) continue;
    otherParts.push(formatContextBlock(catalogColumnLabel(col, language), val));
    seen.add(col);
  }

  for (const col of VULNS_CATALOG_EDITABLE_COLUMNS) {
    if (seen.has(col)) continue;
    const val = cellText(row, col);
    if (!val) continue;
    otherParts.push(formatContextBlock(catalogColumnLabel(col, language), val));
    seen.add(col);
  }

  for (const key of Object.keys(row)) {
    if (seen.has(key) || key === 'Id') continue;
    const val = cellText(row, key);
    if (!val) continue;
    otherParts.push(formatContextBlock(catalogColumnLabel(key, language), val));
    seen.add(key);
  }

  const localeLabel = language === 'en' ? 'locale' : 'español';
  const filledLocale = filledLocaleParts.length
    ? `## Campos ya completados en ${localeLabel} (mantén coherencia)\n${filledLocaleParts.join('\n\n')}`
    : '';

  const sourceLabel =
    language === 'en'
      ? '## Datos fuente del escáner / catálogo (usa todo lo relevante)\n'
      : '## Datos fuente en inglés / técnico (traduce y adapta; NO omitas)\n';
  const sourceData = sourceParts.length ? `${sourceLabel}${sourceParts.join('\n\n')}` : '';

  const complement = otherParts.length
    ? `## Otros datos del registro\n${otherParts.join('\n\n')}`
    : '';

  const sections = [currentField, filledLocale, sourceData, complement].filter(Boolean);
  const nonEmptyCount =
    (currentFieldValue ? 1 : 0) +
    filledLocaleParts.length +
    sourceParts.length +
    otherParts.length;

  return {
    full: sections.join('\n\n'),
    filledLocale,
    currentField,
    sourceData,
    sourceHint: localeFieldSourceHint(field, language),
    nonEmptyCount,
  };
}

/** @deprecated Usar buildContextForLocaleField */
export function buildContextForSpanishField(
  field: string,
  row: Record<string, unknown>
) {
  const ctx = buildContextForLocaleField(field, row, 'es');
  return {
    ...ctx,
    filledSpanish: ctx.filledLocale,
  };
}

export async function suggestCatalogLocaleField(
  field: string,
  row: Record<string, unknown>,
  options?: { fieldHint?: string; config?: CatalogFieldConfig; language?: TenantLanguage }
): Promise<string> {
  const language = options?.language ?? 'es';
  const {
    full: sourceContext,
    filledLocale,
    currentField,
    sourceHint,
    nonEmptyCount,
  } = buildContextForLocaleField(field, row, language);

  if (!sourceContext.trim() || nonEmptyCount === 0) {
    throw new Error(
      language === 'en'
        ? 'No context in the record. Fill at least name, description, solution or CVE before using AI.'
        : 'No hay contexto en el registro. Completa al menos nombre, descripción, solución o CVE en inglés antes de usar IA.'
    );
  }

  const fieldHint =
    options?.fieldHint?.trim() ||
    getAiPromptForField(field, options?.config, language);

  const res = await fetch('/api/ai/suggest-catalog-locale', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      field,
      language,
      sourceContext,
      hasFilledLocale: filledLocale.length > 0 || currentField.length > 0,
      hasCurrentFieldValue: currentField.length > 0,
      currentValue: row[field] != null ? String(row[field]) : '',
      fieldHint,
      sourceHint,
      nonEmptyCount,
    }),
  });
  const data = (await res.json()) as { value?: string; error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'No se pudo generar sugerencia');
  }
  const raw = sanitizeAiPlainText((data.value || '').trim());
  return applyFieldLengthRules(raw, fieldHint);
}

/** @deprecated Usar suggestCatalogLocaleField */
export async function suggestCatalogSpanishField(
  field: string,
  row: Record<string, unknown>,
  options?: { fieldHint?: string; config?: CatalogFieldConfig }
): Promise<string> {
  return suggestCatalogLocaleField(field, row, { ...options, language: 'es' });
}

export function catalogAiColumnsForLanguage(language: TenantLanguage = 'es'): string[] {
  return catalogLocaleAiColumns(language);
}

export function catalogColumnForLocaleFieldKey(
  key: CatalogLocaleFieldKey,
  language: TenantLanguage = 'es'
): string {
  return catalogColumnForLocale(key, language);
}

export function isCatalogAiColumn(
  column: string,
  language: TenantLanguage = 'es'
): boolean {
  return catalogLocaleAiColumns(language).includes(column);
}

export function localeFieldKeyFromCatalogColumn(
  column: string,
  language: TenantLanguage = 'es'
): CatalogLocaleFieldKey | null {
  return localeFieldKeyFromColumn(column, language);
}
