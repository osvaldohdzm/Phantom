import {
  catalogColumnForLocale,
  catalogColumnToFindingField,
  catalogLocaleAiColumns,
  catalogLocaleMandatoryColumns,
  LOCALE_DEFAULT_AI_HINTS,
  LOCALE_DEFAULT_MIN_LENGTHS,
  LOCALE_FIELD_SOURCE_HINTS,
  localeFieldKeyFromColumn,
  shouldHideCatalogColumnInEditor,
  type CatalogLocaleFieldKey,
  type TenantLanguage,
} from '@/lib/tenant-locale';
import type { ReviewFieldKey } from '@/lib/review-fields';
import { REVIEW_FIELDS } from '@/lib/review-fields';
import { VULNS_CATALOG_TOOL_ID_COLUMNS } from '@/lib/catalog-tool-index';
import {
  VULNS_CATALOG_EDITABLE_COLUMNS,
  catalogColumnLabel,
  defaultDisplayColumnsForLanguage,
  type VulnsCatalogEditableColumn,
} from '@/lib/vulns-catalog-columns';
import { updateTenantBranding } from '@/lib/branding-api';

/** @deprecated Usar CatalogLocaleColumn desde tenant-locale */
export {
  CATALOG_SPANISH_AI_FIELDS,
  CATALOG_SPANISH_CONTEXT_FIELDS,
  type CatalogSpanishAiField,
} from '@/lib/catalog-spanish-field-ids';

export type CatalogLocaleAiColumn = string;

export const CATALOG_FIELD_CONFIG_VERSION = 1;
export const CATALOG_FIELD_CONFIG_STORAGE_KEY = 'spectre.vulns-catalog.field-config';

/** Catálogo → hallazgo para evaluar completitud (es + en). */
export const CATALOG_COLUMN_TO_FINDING: Partial<
  Record<VulnsCatalogEditableColumn, ReviewFieldKey>
> = {
  Description: 'descripcion',
  EspDescripcionUnificada: 'descripcion',
  Danger: 'amenaza_ampliada',
  EspAmenazaUnificadaGeneral: 'amenaza_ampliada',
  EspAmenazaUnificadaDesdeInternet: 'amenaza_ampliada',
  Solution: 'propuesta_remediacion',
  EspPropuestaRemediacionUnificada: 'propuesta_remediacion',
  EspPropuestaRemediacionUnificadaEnRedPrivada: 'propuesta_remediacion',
  EspMetodoDeteccion: 'metodo_deteccion',
  SourceDetection: 'metodo_deteccion',
  EspExplicacionTecnica: 'explicacion_tecnica',
};

export type CatalogFieldConfig = {
  v: typeof CATALOG_FIELD_CONFIG_VERSION;
  mandatoryCatalogColumns: VulnsCatalogEditableColumn[];
  mandatoryFindingFields: ReviewFieldKey[];
  minLengthsCatalog: Partial<Record<VulnsCatalogEditableColumn, number>>;
  minLengthsFinding: Partial<Record<ReviewFieldKey, number>>;
  aiPrompts: Partial<Record<string, string>>;
  /** Columnas visibles en la tabla del catálogo operativo (orden). */
  displayColumns?: string[];
};

export type OfficialFieldsByLocale = Partial<Record<TenantLanguage, CatalogFieldConfig>>;

export type BrandingWithOfficialFields = {
  official_fields?: OfficialFieldsByLocale | null;
};

export function buildDefaultCatalogFieldConfig(
  language: TenantLanguage = 'es'
): CatalogFieldConfig {
  const mandatoryCatalogColumns = catalogLocaleMandatoryColumns(
    language
  ) as VulnsCatalogEditableColumn[];

  const minLengthsCatalog: Partial<Record<VulnsCatalogEditableColumn, number>> = {};
  for (const [key, minLen] of Object.entries(LOCALE_DEFAULT_MIN_LENGTHS[language])) {
    const col = catalogColumnForLocale(key as CatalogLocaleFieldKey, language);
    minLengthsCatalog[col as VulnsCatalogEditableColumn] = minLen;
  }

  return {
    v: CATALOG_FIELD_CONFIG_VERSION,
    mandatoryCatalogColumns,
    mandatoryFindingFields: [
      'descripcion',
      'amenaza_ampliada',
      'propuesta_remediacion',
      'componente_afectado',
      'metodo_deteccion',
      'explicacion_tecnica',
    ],
    minLengthsCatalog,
    minLengthsFinding: Object.fromEntries(
      REVIEW_FIELDS.map((r) => [r.key, r.minLen])
    ) as Partial<Record<ReviewFieldKey, number>>,
    aiPrompts: {},
    displayColumns: [...defaultDisplayColumnsForLanguage(language)],
  };
}

const SHARED_OFFICIAL_COLUMNS: VulnsCatalogEditableColumn[] = [
  'CVE',
  'CWE',
  'NessusPluginId',
];

/** Columnas que el admin puede marcar como oficiales según idioma operativo. */
export function officialSelectableColumns(
  language: TenantLanguage = 'es'
): VulnsCatalogEditableColumn[] {
  const localeSet = new Set<string>([
    ...catalogLocaleMandatoryColumns(language),
    ...catalogLocaleAiColumns(language),
    catalogColumnForLocale('title', language),
  ]);
  if (language === 'es') {
    localeSet.add('StandardVulnerabilityName');
    localeSet.add('Description');
    localeSet.add('Danger');
    localeSet.add('Solution');
    localeSet.add('Severity');
  } else {
    localeSet.add('Vulnerability');
  }
  for (const col of VULNS_CATALOG_TOOL_ID_COLUMNS) {
    if (col !== 'NessusPluginId') localeSet.add(col);
  }
  return VULNS_CATALOG_EDITABLE_COLUMNS.filter((col) => {
    if (shouldHideCatalogColumnInEditor(col, language)) return false;
    if (localeSet.has(col) || SHARED_OFFICIAL_COLUMNS.includes(col)) return true;
    return false;
  });
}

export function resolveDisplayColumns(
  config: CatalogFieldConfig,
  language: TenantLanguage = 'es'
): string[] {
  const cols = config.displayColumns?.filter((c) => c.trim());
  if (cols?.length) return cols.includes('Id') ? cols : ['Id', ...cols];
  return [...defaultDisplayColumnsForLanguage(language)];
}

export function officialConfigFromBranding(
  branding: BrandingWithOfficialFields | null | undefined,
  language: TenantLanguage = 'es'
): CatalogFieldConfig | null {
  const raw = branding?.official_fields?.[language];
  if (!raw) return null;
  return normalizeConfig(raw, language);
}

/** Compatibilidad español (sin cambios). */
export const DEFAULT_MANDATORY_CATALOG_COLUMNS: VulnsCatalogEditableColumn[] =
  buildDefaultCatalogFieldConfig('es').mandatoryCatalogColumns;

export const DEFAULT_MANDATORY_FINDING_FIELDS: ReviewFieldKey[] = [
  'descripcion',
  'amenaza_ampliada',
  'propuesta_remediacion',
  'componente_afectado',
  'metodo_deteccion',
  'explicacion_tecnica',
];

export const DEFAULT_CATALOG_FIELD_CONFIG: CatalogFieldConfig =
  buildDefaultCatalogFieldConfig('es');

let cachedConfig: CatalogFieldConfig | null = null;
let cachedLanguage: TenantLanguage = 'es';

function normalizeConfig(
  raw: unknown,
  language: TenantLanguage = 'es'
): CatalogFieldConfig {
  const base = buildDefaultCatalogFieldConfig(language);
  if (!raw || typeof raw !== 'object') return { ...base };

  const o = raw as Partial<CatalogFieldConfig>;
  const editable = new Set(VULNS_CATALOG_EDITABLE_COLUMNS);
  const reviewKeys = new Set(REVIEW_FIELDS.map((r) => r.key));

  const mandatoryCatalogColumns = Array.isArray(o.mandatoryCatalogColumns)
    ? o.mandatoryCatalogColumns.filter((c): c is VulnsCatalogEditableColumn =>
        typeof c === 'string' && editable.has(c as VulnsCatalogEditableColumn)
      )
    : [...base.mandatoryCatalogColumns];

  const mandatoryFindingFields = Array.isArray(o.mandatoryFindingFields)
    ? o.mandatoryFindingFields.filter((k): k is ReviewFieldKey =>
        typeof k === 'string' && reviewKeys.has(k as ReviewFieldKey)
      )
    : [...base.mandatoryFindingFields];

  const displayColumns = Array.isArray(o.displayColumns)
    ? o.displayColumns.filter((c): c is string => typeof c === 'string' && c.trim() !== '')
    : [...base.displayColumns!];

  return {
    v: CATALOG_FIELD_CONFIG_VERSION,
    mandatoryCatalogColumns,
    mandatoryFindingFields,
    minLengthsCatalog: { ...base.minLengthsCatalog, ...(o.minLengthsCatalog ?? {}) },
    minLengthsFinding: { ...base.minLengthsFinding, ...(o.minLengthsFinding ?? {}) },
    aiPrompts: typeof o.aiPrompts === 'object' && o.aiPrompts ? { ...o.aiPrompts } : {},
    displayColumns,
  };
}

export function getCatalogFieldConfigSync(
  language: TenantLanguage = cachedLanguage
): CatalogFieldConfig {
  if (cachedConfig && cachedLanguage === language) return cachedConfig;
  return buildDefaultCatalogFieldConfig(language);
}

export function setCatalogFieldConfigCache(
  config: CatalogFieldConfig,
  language: TenantLanguage = cachedLanguage
): void {
  cachedConfig = config;
  cachedLanguage = language;
}

function loadFromLocalStorage(language: TenantLanguage): CatalogFieldConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${CATALOG_FIELD_CONFIG_STORAGE_KEY}.${language}`);
    if (!raw) return null;
    return normalizeConfig(JSON.parse(raw), language);
  } catch {
    return null;
  }
}

function saveToLocalStorage(config: CatalogFieldConfig, language: TenantLanguage): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      `${CATALOG_FIELD_CONFIG_STORAGE_KEY}.${language}`,
      JSON.stringify(config)
    );
  } catch {
    /* quota */
  }
}

export async function loadCatalogFieldConfig(
  language: TenantLanguage = 'es',
  options?: { branding?: BrandingWithOfficialFields | null }
): Promise<CatalogFieldConfig> {
  const fromBranding = officialConfigFromBranding(options?.branding, language);
  if (fromBranding) {
    cachedConfig = fromBranding;
    cachedLanguage = language;
    saveToLocalStorage(fromBranding, language);
    return fromBranding;
  }

  const local = loadFromLocalStorage(language);
  if (local) {
    cachedConfig = local;
    cachedLanguage = language;
    return local;
  }

  const defaults = buildDefaultCatalogFieldConfig(language);
  cachedConfig = defaults;
  cachedLanguage = language;
  return defaults;
}

export async function saveCatalogFieldConfig(
  config: CatalogFieldConfig,
  language: TenantLanguage = cachedLanguage,
  options?: { tenantId: string; branding?: BrandingWithOfficialFields | null }
): Promise<void> {
  const normalized = normalizeConfig(config, language);
  cachedConfig = normalized;
  cachedLanguage = language;
  saveToLocalStorage(normalized, language);

  if (options?.tenantId) {
    const official_fields: OfficialFieldsByLocale = {
      ...(options.branding?.official_fields ?? {}),
      [language]: normalized,
    };
    await updateTenantBranding(options.tenantId, { official_fields });
    return;
  }

  const res = await fetch('/api/vulns-catalog/field-config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config: normalized }),
  });
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error ?? 'No se pudo guardar la configuración');
  }
}

export async function saveCatalogFieldAiPrompt(
  field: string,
  value: string,
  language: TenantLanguage = cachedLanguage
): Promise<CatalogFieldConfig> {
  const base = getCatalogFieldConfigSync(language);
  const trimmed = value.trim();
  const aiPrompts = { ...base.aiPrompts };
  if (trimmed) {
    aiPrompts[field] = trimmed;
  } else {
    delete aiPrompts[field];
  }
  const next = normalizeConfig({ ...base, aiPrompts }, language);
  await saveCatalogFieldConfig(next, language);
  return next;
}

export function isMandatoryCatalogColumn(
  column: string,
  config: CatalogFieldConfig = getCatalogFieldConfigSync()
): boolean {
  return config.mandatoryCatalogColumns.includes(column as VulnsCatalogEditableColumn);
}

export function catalogRowCompleteness(
  row: Record<string, unknown>,
  config: CatalogFieldConfig = getCatalogFieldConfigSync(),
  language: TenantLanguage = cachedLanguage
): { missing: string[]; missingColumns: VulnsCatalogEditableColumn[]; percent: number } {
  const missing: string[] = [];
  const missingColumns: VulnsCatalogEditableColumn[] = [];

  for (const col of config.mandatoryCatalogColumns) {
    const minLen = config.minLengthsCatalog[col] ?? 3;
    const val = String(row[col] ?? '').trim();
    if (val.length < minLen) {
      missing.push(catalogColumnLabel(col, language));
      missingColumns.push(col);
    }
  }

  const total = config.mandatoryCatalogColumns.length || 1;
  const filled = total - missingColumns.length;
  return {
    missing,
    missingColumns,
    percent: Math.round((filled / total) * 100),
  };
}

export function getActiveReviewFields(
  config: CatalogFieldConfig = getCatalogFieldConfigSync()
): { key: ReviewFieldKey; label: string; minLen: number }[] {
  const keys = new Set<ReviewFieldKey>(config.mandatoryFindingFields);

  for (const col of config.mandatoryCatalogColumns) {
    const fk = CATALOG_COLUMN_TO_FINDING[col] ?? catalogColumnToFindingField(col);
    if (fk) keys.add(fk as ReviewFieldKey);
  }

  if (keys.size === 0) return [...REVIEW_FIELDS];

  return REVIEW_FIELDS.filter((r) => keys.has(r.key)).map((r) => ({
    ...r,
    minLen: config.minLengthsFinding[r.key] ?? r.minLen,
  }));
}

export function getAiPromptForField(
  field: string,
  config: CatalogFieldConfig = getCatalogFieldConfigSync(),
  language: TenantLanguage = cachedLanguage
): string {
  const custom = config.aiPrompts[field]?.trim();
  if (custom) return custom;

  const fieldKey = localeFieldKeyFromColumn(field, language);
  if (fieldKey) {
    return LOCALE_DEFAULT_AI_HINTS[language][fieldKey] ?? '';
  }

  return language === 'en'
    ? `Write the "${catalogColumnLabel(field, language)}" field in professional English for security reports.`
    : `Redacta el campo "${catalogColumnLabel(field, language)}" en español profesional para informes de ciberseguridad en México/LATAM.`;
}

export function mandatoryLocaleAiFields(
  config: CatalogFieldConfig = getCatalogFieldConfigSync(),
  language: TenantLanguage = cachedLanguage
): CatalogLocaleAiColumn[] {
  const aiCols = new Set(catalogLocaleAiColumns(language));
  return config.mandatoryCatalogColumns.filter((f) => aiCols.has(f));
}

/** @deprecated Usar mandatoryLocaleAiFields */
export function mandatorySpanishAiFields(
  config: CatalogFieldConfig = getCatalogFieldConfigSync()
): CatalogLocaleAiColumn[] {
  return mandatoryLocaleAiFields(config, 'es');
}

export function localeFieldSourceHint(
  field: string,
  language: TenantLanguage = cachedLanguage
): string {
  const key = localeFieldKeyFromColumn(field, language);
  if (!key) return '';
  return LOCALE_FIELD_SOURCE_HINTS[language][key] ?? '';
}
