import {
  getAiPromptForField,
  type CatalogFieldConfig,
} from '@/lib/catalog-field-config';
import {
  CATALOG_SPANISH_AI_FIELDS,
  CATALOG_SPANISH_CONTEXT_FIELDS,
  type CatalogSpanishAiField,
} from '@/lib/catalog-spanish-field-ids';
import { VULNS_CATALOG_TOOL_ID_COLUMNS } from '@/lib/catalog-tool-index';
import { applyFieldLengthRules } from '@/lib/ai-field-length';
import { sanitizeAiPlainText } from '@/lib/plain-report-text';
import {
  catalogColumnLabel,
  VULNS_CATALOG_EDITABLE_COLUMNS,
  VULNS_CATALOG_SELECT_COLUMNS,
  type VulnsCatalogEditableColumn,
} from '@/lib/vulns-catalog-columns';

export {
  CATALOG_SPANISH_AI_FIELDS,
  CATALOG_SPANISH_CONTEXT_FIELDS,
  type CatalogSpanishAiField,
} from '@/lib/catalog-spanish-field-ids';

/** Columnas fuente en inglés/técnico que alimentan la redacción Español. */
const ENGLISH_SOURCE_COLUMNS = [
  'StandardVulnerabilityName',
  'Vulnerability',
  'Severity',
  'SourceDetection',
  'Description',
  'Danger',
  'Solution',
  'CVE',
  'CWE',
  'CVSSOverallScore3_1',
  'References',
  'NessusPluginId',
  ...VULNS_CATALOG_TOOL_ID_COLUMNS.filter((c) => c !== 'NessusPluginId'),
] as const;

/** Qué columnas fuente priorizar por cada campo Español. */
export const SPANISH_FIELD_SOURCE_HINTS: Record<CatalogSpanishAiField, string> = {
  EspSeveridadUnificada: 'Prioriza Severity y el impacto descrito en Description/Danger.',
  EspDescripcionUnificada: 'Prioriza Description y el contexto de Vulnerability/CVE.',
  EspAmenazaUnificadaGeneral:
    'Prioriza Danger, Description y CVE; describe impacto y escenarios.',
  EspAmenazaUnificadaDesdeInternet:
    'Prioriza Danger/Description asumiendo exposición a Internet.',
  EspPropuestaRemediacionUnificada: 'Prioriza Solution y cualquier workaround indicado.',
  EspPropuestaRemediacionUnificadaEnRedPrivada:
    'Prioriza Solution adaptado a red privada/interna.',
  EspMetodoDeteccion:
    'Prioriza SourceDetection, NessusPluginId y Description (cómo se detectó).',
  EspExplicacionTecnica:
    'Prioriza Description, CVE, CWE y detalles técnicos del registro.',
};

function cellText(row: Record<string, unknown>, col: string): string | null {
  const raw = row[col];
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  return text || null;
}

function formatContextBlock(label: string, value: string): string {
  return `${label}:\n${value}`;
}

/**
 * Construye contexto para Gemini: todos los campos NO vacíos del registro.
 * - Español ya completados (coherencia)
 * - Inglés / técnico / IDs de herramienta (fuente principal)
 * - Cualquier otro dato presente en la fila
 */
export function buildContextForSpanishField(
  field: CatalogSpanishAiField,
  row: Record<string, unknown>
): {
  full: string;
  filledSpanish: string;
  currentField: string;
  sourceData: string;
  sourceHint: string;
  nonEmptyCount: number;
} {
  const currentFieldValue = cellText(row, field);
  const currentFieldLabel = catalogColumnLabel(field);
  const currentField = currentFieldValue
    ? `## Valor actual del campo a generar/mejorar: ${currentFieldLabel}\n${formatContextBlock(currentFieldLabel, currentFieldValue)}`
    : '';

  const filledSpanishParts: string[] = [];
  for (const col of CATALOG_SPANISH_CONTEXT_FIELDS) {
    if (col === field) continue;
    const val = cellText(row, col);
    if (val) {
      filledSpanishParts.push(formatContextBlock(catalogColumnLabel(col), val));
    }
  }

  const seen = new Set<string>([field, 'Id', ...CATALOG_SPANISH_CONTEXT_FIELDS]);
  const englishParts: string[] = [];

  for (const col of ENGLISH_SOURCE_COLUMNS) {
    const val = cellText(row, col);
    if (!val) continue;
    englishParts.push(formatContextBlock(catalogColumnLabel(col), val));
    seen.add(col);
  }

  const otherParts: string[] = [];

  for (const col of VULNS_CATALOG_SELECT_COLUMNS) {
    if (seen.has(col)) continue;
    const val = cellText(row, col);
    if (!val) continue;
    otherParts.push(formatContextBlock(catalogColumnLabel(col), val));
    seen.add(col);
  }

  for (const col of VULNS_CATALOG_EDITABLE_COLUMNS) {
    if (seen.has(col)) continue;
    const val = cellText(row, col);
    if (!val) continue;
    otherParts.push(formatContextBlock(catalogColumnLabel(col), val));
    seen.add(col);
  }

  for (const key of Object.keys(row)) {
    if (seen.has(key) || key === 'Id') continue;
    const val = cellText(row, key);
    if (!val) continue;
    otherParts.push(formatContextBlock(catalogColumnLabel(key), val));
    seen.add(key);
  }

  const filledSpanish = filledSpanishParts.length
    ? `## Campos ya completados en español (mantén coherencia)\n${filledSpanishParts.join('\n\n')}`
    : '';

  const sourceData = englishParts.length
    ? `## Datos fuente en inglés / técnico (traduce y adapta; NO omitas)\n${englishParts.join('\n\n')}`
    : '';

  const complement = otherParts.length
    ? `## Otros datos del registro\n${otherParts.join('\n\n')}`
    : '';

  const sections = [currentField, filledSpanish, sourceData, complement].filter(Boolean);
  const nonEmptyCount =
    (currentFieldValue ? 1 : 0) +
    filledSpanishParts.length +
    englishParts.length +
    otherParts.length;

  return {
    full: sections.join('\n\n'),
    filledSpanish,
    currentField,
    sourceData,
    sourceHint: SPANISH_FIELD_SOURCE_HINTS[field],
    nonEmptyCount,
  };
}

export function englishContextForSpanishField(
  field: CatalogSpanishAiField,
  row: Record<string, unknown>
): string {
  return buildContextForSpanishField(field, row).full;
}

/** @deprecated Usar buildContextForSpanishField */
export function contextForSpanishField(
  field: CatalogSpanishAiField,
  row: Record<string, unknown>
): string {
  return buildContextForSpanishField(field, row).full;
}

export async function suggestCatalogSpanishField(
  field: CatalogSpanishAiField,
  row: Record<string, unknown>,
  options?: { fieldHint?: string; config?: CatalogFieldConfig }
): Promise<string> {
  const {
    full: sourceContext,
    filledSpanish,
    currentField,
    sourceHint,
    nonEmptyCount,
  } = buildContextForSpanishField(field, row);

  if (!sourceContext.trim() || nonEmptyCount === 0) {
    throw new Error(
      'No hay contexto en el registro. Completa al menos nombre, descripción, solución o CVE en inglés antes de usar IA.'
    );
  }

  const fieldHint =
    options?.fieldHint?.trim() ||
    getAiPromptForField(field, options?.config);

  const res = await fetch('/api/ai/suggest-catalog-spanish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      field,
      englishContext: sourceContext,
      hasFilledSpanish: filledSpanish.length > 0 || currentField.length > 0,
      hasCurrentFieldValue: currentField.length > 0,
      currentSpanish: row[field] != null ? String(row[field]) : '',
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
