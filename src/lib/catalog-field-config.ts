import {
  CATALOG_SPANISH_AI_FIELDS,
  type CatalogSpanishAiField,
} from '@/lib/catalog-spanish-field-ids';
import type { ReviewFieldKey } from '@/lib/review-fields';
import { REVIEW_FIELDS } from '@/lib/review-fields';
import {
  VULNS_CATALOG_EDITABLE_COLUMNS,
  catalogColumnLabel,
  type VulnsCatalogEditableColumn,
} from '@/lib/vulns-catalog-columns';

export const CATALOG_FIELD_CONFIG_VERSION = 1;
export const CATALOG_FIELD_CONFIG_STORAGE_KEY = 'spectre.vulns-catalog.field-config';

/** Catálogo → hallazgo para evaluar completitud en vulnerabilidades importadas/manuales. */
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
  EspExplicacionTecnica: 'explicacion_tecnica',
};

export type CatalogFieldConfig = {
  v: typeof CATALOG_FIELD_CONFIG_VERSION;
  /** Columnas del catálogo operativo que deben estar llenas. */
  mandatoryCatalogColumns: VulnsCatalogEditableColumn[];
  /** Campos de hallazgo obligatorios (además de los derivados del catálogo). */
  mandatoryFindingFields: ReviewFieldKey[];
  minLengthsCatalog: Partial<Record<VulnsCatalogEditableColumn, number>>;
  minLengthsFinding: Partial<Record<ReviewFieldKey, number>>;
  /** Contexto/reglas opcionales por campo para IA (clave = columna catálogo o Esp*). */
  aiPrompts: Partial<Record<string, string>>;
};

export const DEFAULT_MANDATORY_CATALOG_COLUMNS: VulnsCatalogEditableColumn[] = [
  'EspNombreVulnerabilidadUnificado',
  'EspSeveridadUnificada',
  'EspDescripcionUnificada',
  'EspAmenazaUnificadaGeneral',
  'EspPropuestaRemediacionUnificada',
  'EspMetodoDeteccion',
  'EspExplicacionTecnica',
];

export const DEFAULT_MANDATORY_FINDING_FIELDS: ReviewFieldKey[] = [
  'descripcion',
  'amenaza_ampliada',
  'propuesta_remediacion',
  'componente_afectado',
  'metodo_deteccion',
  'explicacion_tecnica',
];

export const DEFAULT_CATALOG_AI_HINTS: Record<CatalogSpanishAiField, string> = {
  EspSeveridadUnificada:
    'Usa exactamente uno de: Crítica, Alta, Media, Baja, Informativa (según la severidad en inglés).',
  EspDescripcionUnificada:
    'Descripción clara de la vulnerabilidad en español, orientada a informe ejecutivo y técnico. Si enumeras CVE o fallos concretos, un CVE o fallo por línea con prefijo " - " (salto de línea antes de cada uno; nunca varios en la misma línea).',
  EspAmenazaUnificadaGeneral:
    'Amenaza/impacto en español: párrafo inicial y, si aplica, escenarios por actor en líneas con prefijo " - " (espacio-guion-espacio), por ejemplo: " - Actor interno: ...". Sin viñetas ni numeración.',
  EspAmenazaUnificadaDesdeInternet:
    'Amenaza si el activo es expuesto a Internet; párrafo narrativo y escenarios en líneas " - " si hay varios puntos. Sin viñetas.',
  EspPropuestaRemediacionUnificada:
    'Remediación general en español: párrafo introductorio y cada paso en una línea con prefijo " - " (espacio-guion-espacio). Sin viñetas ni numeración.',
  EspPropuestaRemediacionUnificadaEnRedPrivada:
    'Remediación en red privada en español: párrafo y acciones en líneas " - " (una acción por línea). Sin listas markdown.',
  EspMetodoDeteccion:
    'Breve descripción del método de detección (escáner Nessus, prueba manual, etc.).',
  EspExplicacionTecnica:
    'Explicación técnica en español: causa raíz, protocolo o configuración involucrada. Detalles técnicos o CVE en líneas separadas con prefijo " - " (uno por línea).',
};

const DEFAULT_MIN_CATALOG: Partial<Record<VulnsCatalogEditableColumn, number>> = {
  EspNombreVulnerabilidadUnificado: 5,
  EspSeveridadUnificada: 3,
  EspDescripcionUnificada: 30,
  EspAmenazaUnificadaGeneral: 30,
  EspAmenazaUnificadaDesdeInternet: 20,
  EspPropuestaRemediacionUnificada: 15,
  EspPropuestaRemediacionUnificadaEnRedPrivada: 15,
  EspMetodoDeteccion: 5,
  EspExplicacionTecnica: 10,
};

export const DEFAULT_CATALOG_FIELD_CONFIG: CatalogFieldConfig = {
  v: CATALOG_FIELD_CONFIG_VERSION,
  mandatoryCatalogColumns: [...DEFAULT_MANDATORY_CATALOG_COLUMNS],
  mandatoryFindingFields: [...DEFAULT_MANDATORY_FINDING_FIELDS],
  minLengthsCatalog: { ...DEFAULT_MIN_CATALOG },
  minLengthsFinding: Object.fromEntries(
    REVIEW_FIELDS.map((r) => [r.key, r.minLen])
  ) as Partial<Record<ReviewFieldKey, number>>,
  aiPrompts: {},
};

let cachedConfig: CatalogFieldConfig | null = null;

function normalizeConfig(raw: unknown): CatalogFieldConfig {
  const base = DEFAULT_CATALOG_FIELD_CONFIG;
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

  return {
    v: CATALOG_FIELD_CONFIG_VERSION,
    mandatoryCatalogColumns,
    mandatoryFindingFields,
    minLengthsCatalog: { ...base.minLengthsCatalog, ...(o.minLengthsCatalog ?? {}) },
    minLengthsFinding: { ...base.minLengthsFinding, ...(o.minLengthsFinding ?? {}) },
    aiPrompts: typeof o.aiPrompts === 'object' && o.aiPrompts ? { ...o.aiPrompts } : {},
  };
}

export function getCatalogFieldConfigSync(): CatalogFieldConfig {
  return cachedConfig ?? DEFAULT_CATALOG_FIELD_CONFIG;
}

export function setCatalogFieldConfigCache(config: CatalogFieldConfig): void {
  cachedConfig = config;
}

function loadFromLocalStorage(): CatalogFieldConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CATALOG_FIELD_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    return normalizeConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

function saveToLocalStorage(config: CatalogFieldConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CATALOG_FIELD_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    /* quota */
  }
}

export async function loadCatalogFieldConfig(): Promise<CatalogFieldConfig> {
  try {
    const res = await fetch('/api/vulns-catalog/field-config', { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as { config?: unknown };
      const config = normalizeConfig(data.config);
      cachedConfig = config;
      saveToLocalStorage(config);
      return config;
    }
  } catch {
    /* offline */
  }

  const local = loadFromLocalStorage();
  if (local) {
    cachedConfig = local;
    return local;
  }

  cachedConfig = DEFAULT_CATALOG_FIELD_CONFIG;
  return DEFAULT_CATALOG_FIELD_CONFIG;
}

export async function saveCatalogFieldConfig(config: CatalogFieldConfig): Promise<void> {
  const normalized = normalizeConfig(config);
  cachedConfig = normalized;
  saveToLocalStorage(normalized);

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

/** Persiste el prompt IA de un campo Esp* (compartido en todas las ediciones del catálogo). */
export async function saveCatalogFieldAiPrompt(
  field: string,
  value: string
): Promise<CatalogFieldConfig> {
  const base = getCatalogFieldConfigSync();
  const trimmed = value.trim();
  const aiPrompts = { ...base.aiPrompts };
  if (trimmed) {
    aiPrompts[field] = trimmed;
  } else {
    delete aiPrompts[field];
  }
  const next = normalizeConfig({ ...base, aiPrompts });
  await saveCatalogFieldConfig(next);
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
  config: CatalogFieldConfig = getCatalogFieldConfigSync()
): { missing: string[]; missingColumns: VulnsCatalogEditableColumn[]; percent: number } {
  const missing: string[] = [];
  const missingColumns: VulnsCatalogEditableColumn[] = [];

  for (const col of config.mandatoryCatalogColumns) {
    const minLen = config.minLengthsCatalog[col] ?? DEFAULT_MIN_CATALOG[col] ?? 3;
    const val = String(row[col] ?? '').trim();
    if (val.length < minLen) {
      missing.push(catalogColumnLabel(col));
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
    const fk = CATALOG_COLUMN_TO_FINDING[col];
    if (fk) keys.add(fk);
  }

  if (keys.size === 0) return [...REVIEW_FIELDS];

  return REVIEW_FIELDS.filter((r) => keys.has(r.key)).map((r) => ({
    ...r,
    minLen: config.minLengthsFinding[r.key] ?? r.minLen,
  }));
}

export function getAiPromptForField(
  field: string,
  config: CatalogFieldConfig = getCatalogFieldConfigSync()
): string {
  const custom = config.aiPrompts[field]?.trim();
  if (custom) return custom;
  if ((CATALOG_SPANISH_AI_FIELDS as readonly string[]).includes(field)) {
    return DEFAULT_CATALOG_AI_HINTS[field as CatalogSpanishAiField];
  }
  return `Redacta el campo "${catalogColumnLabel(field)}" en español profesional para informes de ciberseguridad en México/LATAM.`;
}

export function mandatorySpanishAiFields(
  config: CatalogFieldConfig = getCatalogFieldConfigSync()
): CatalogSpanishAiField[] {
  return CATALOG_SPANISH_AI_FIELDS.filter((f) =>
    config.mandatoryCatalogColumns.includes(f)
  );
}
