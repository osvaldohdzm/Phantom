/**
 * Reglas de mapeo CSV universal → campos oficiales de hallazgos.
 */

import {
  type CsvDelimiter,
  csvDelimiterLabel,
  detectCsvDelimiter,
  parseDelimitedTable,
} from '@/lib/csv-delimited-parse';
import {
  CORE_FIELD_KEYS,
  OPTIONAL_FIELD_KEYS,
  OFFICIAL_FIELD_CATALOG,
  type OfficialFieldKey,
  getAliasesForField,
  loadUserAliases,
  type UserAliasMap,
} from '@/lib/universal-csv-field-catalog';

export const STANDARD_FIELDS = [...CORE_FIELD_KEYS, ...OPTIONAL_FIELD_KEYS] as const;
export type StandardField = OfficialFieldKey;

export type FieldMeta = {
  label: string;
  tier: 'core' | 'optional';
  required?: boolean;
  hint: string;
};

export const FIELD_META: Record<StandardField, FieldMeta> = Object.fromEntries(
  OFFICIAL_FIELD_CATALOG.map((f) => [
    f.key,
    { label: f.label, tier: f.tier, required: f.required, hint: f.hint },
  ])
) as Record<StandardField, FieldMeta>;

export function normalizeHeader(h: string): string {
  return (h || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-./:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactAlphaNum(s: string): string {
  return normalizeHeader(s).replace(/[^a-z0-9]/g, '');
}

function headerHasNegativeToken(header: string, tokens: readonly string[] | undefined): boolean {
  if (!tokens?.length) return false;
  const h = normalizeHeader(header);
  return tokens.some((t) => h.includes(normalizeHeader(t)));
}

/**
 * Puntuación 0–100 entre encabezado CSV y alias/campo oficial.
 */
export function scoreHeaderMatch(
  header: string,
  alias: string,
  negativeTokens?: readonly string[]
): number {
  const h = normalizeHeader(header);
  const a = normalizeHeader(alias);
  if (!h || !a) return 0;

  let score = 0;
  if (h === a) score = 100;
  else {
    const hc = compactAlphaNum(header);
    const ac = compactAlphaNum(alias);
    if (hc && ac && hc === ac) score = 95;
    else if (a.length >= 4 && h.includes(a)) score = 78;
    else if (h.length >= 4 && a.includes(h)) score = 68;
    else {
      const hTokens = new Set(h.split(' ').filter((t) => t.length > 1));
      const aTokens = a.split(' ').filter((t) => t.length > 1);
      if (aTokens.length > 0) {
        const overlap = aTokens.filter((t) => hTokens.has(t)).length;
        if (overlap > 0) {
          const ratio = overlap / Math.max(hTokens.size, aTokens.length);
          score = Math.round(45 + ratio * 40);
        }
      }
    }
  }

  if (score > 0 && headerHasNegativeToken(header, negativeTokens)) {
    score = Math.max(0, score - 45);
  }

  return score;
}

const MIN_AUTO_SCORE = 52;

const SHARED_HEADER_PAIRS: readonly [StandardField, StandardField][] = [
  ['recommendation', 'remediation'],
];

function canShareCsvHeader(field: StandardField, header: string, map: Partial<Record<StandardField, string>>): boolean {
  for (const [a, b] of SHARED_HEADER_PAIRS) {
    if (field !== a && field !== b) continue;
    const partner = field === a ? b : a;
    if (map[partner] === header) return true;
  }
  return false;
}

function headerMatchesAny(headers: string[], aliases: string[]): boolean {
  const normHeaders = headers.map(normalizeHeader);
  return aliases.some((alias) => {
    const na = normalizeHeader(alias);
    return normHeaders.some((h) => h === na || h.includes(na) || na.includes(h));
  });
}

/** Export Seguimiento de vulnerabilidades (Vulnerabilidad + Estatus + Proyecto). */
export function isSeguimientoExport(headers: string[], filename?: string): boolean {
  const fn = (filename ?? '').toLowerCase();
  if (fn.includes('seguimiento') && fn.includes('vulnerabilidad')) return true;
  return (
    headerMatchesAny(headers, ['vulnerabilidad', 'vulnerability']) &&
    headerMatchesAny(headers, ['estatus', 'status', 'estado']) &&
    headerMatchesAny(headers, ['proyecto', 'project'])
  );
}

export type SuggestResult = {
  map: Partial<Record<StandardField, string>>;
  scores: Partial<Record<StandardField, number>>;
};

/** Asigna cada campo oficial al mejor encabezado CSV (sin duplicar columnas). */
export function suggestColumnMap(
  headers: string[],
  userAliases?: UserAliasMap,
  options?: { filename?: string }
): SuggestResult {
  const aliasesMap = userAliases ?? loadUserAliases();
  const clean = headers.filter((h) => h.trim());
  const candidates: { field: StandardField; header: string; score: number }[] = [];

  for (const def of OFFICIAL_FIELD_CATALOG) {
    const aliases = getAliasesForField(def.key, aliasesMap);
    for (const header of clean) {
      let best = 0;
      for (const alias of aliases) {
        best = Math.max(best, scoreHeaderMatch(header, alias, def.negativeTokens));
      }
      if (best >= MIN_AUTO_SCORE) {
        candidates.push({ field: def.key, header, score: best });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const map: Partial<Record<StandardField, string>> = {};
  const scores: Partial<Record<StandardField, number>> = {};
  const usedHeaders = new Set<string>();

  for (const c of candidates) {
    if (map[c.field]) continue;
    if (usedHeaders.has(c.header) && !canShareCsvHeader(c.field, c.header, map)) continue;
    map[c.field] = c.header;
    scores[c.field] = c.score;
    if (!canShareCsvHeader(c.field, c.header, map)) {
      usedHeaders.add(c.header);
    }
  }

  if (map.recommendation && !map.remediation) {
    map.remediation = map.recommendation;
    scores.remediation = scores.recommendation;
  }

  if (isSeguimientoExport(clean, options?.filename)) {
    const pick = (field: StandardField, aliases: string[]) => {
      if (map[field]) return;
      const hit = clean.find((h) =>
        aliases.some((a) => scoreHeaderMatch(h, a) >= MIN_AUTO_SCORE)
      );
      if (hit && (!usedHeaders.has(hit) || canShareCsvHeader(field, hit, map))) {
        map[field] = hit;
        scores[field] = Math.max(scores[field] ?? 0, 90);
        if (!canShareCsvHeader(field, hit, map)) usedHeaders.add(hit);
      }
    };
    pick('title', ['vulnerabilidad', 'vulnerability']);
    pick('description', ['descripcion', 'descripción', 'description']);
    pick('severity', ['severidad', 'severity', 'riesgo']);
    pick('component', ['componentes afectados', 'componente', 'component']);
    pick('recommendation', ['recomendacion', 'recomendación', 'recommendation']);
    pick('status', ['estatus', 'status']);
    pick('project', ['proyecto', 'project']);
    pick('hosts', ['hosts afectados', 'hosts']);
    pick('asset_group', ['grupo de activos', 'grupos de activos']);
    pick('asset_subgroup', ['subgrupo de activos', 'sub grupo de activos', 'subgrupos de activos']);
    pick('asset_type', ['tipo de activo']);
    pick('method', ['herramienta de deteccion', 'herramienta de detección']);
    pick('detected_date', ['fecha de deteccion', 'fecha de detección']);
    pick('registered_date', ['fecha de registro']);
    pick('remediation_time', ['tiempo de remediacion', 'tiempo de remediación']);
    pick('mitigation_type', ['tipo de mitigacion', 'tipo de mitigación']);
    pick('comments', ['comentarios']);
    pick('security_comments', ['comentarios de seguridad']);
    if (map.recommendation && !map.remediation) {
      map.remediation = map.recommendation;
      scores.remediation = scores.recommendation;
    }
  }

  return { map, scores };
}

export function parseUniversalCsvPreview(text: string): {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  delimiter: CsvDelimiter;
} {
  const delimiter = detectCsvDelimiter(text);
  const matrix = parseDelimitedTable(text, delimiter);
  if (!matrix.length) return { headers: [], rows: [], totalRows: 0, delimiter };

  const width = Math.max(...matrix.map((r) => r.length));
  const normalized = matrix.map((r) => {
    const row = [...r];
    while (row.length < width) row.push('');
    return row;
  });

  const headers = normalized[0].map((h) => h.trim());
  const dataRows = normalized.slice(1).filter((r) => r.some((c) => c.trim()));
  const rows = dataRows.slice(0, 5).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (row[i] ?? '').trim();
    });
    return obj;
  });

  return { headers, rows, totalRows: dataRows.length, delimiter };
}

export { csvDelimiterLabel, detectCsvDelimiter, type CsvDelimiter };

export function confidenceLabel(score: number | undefined): 'alta' | 'media' | 'baja' | null {
  if (score == null) return null;
  if (score >= 90) return 'alta';
  if (score >= 70) return 'media';
  return 'baja';
}

export function mapToApiPayload(map: Partial<Record<StandardField, string>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, header] of Object.entries(map)) {
    if (header?.trim()) out[field] = header.trim();
  }
  return out;
}

const PREVIEW_MAX_LEN = 100;

export type FieldPreviewEntry = {
  value: string | null;
  source?: 'column' | 'extracted' | 'empty';
};

export function firstNonEmptyRowValue(
  rows: Record<string, string>[],
  header: string
): string | null {
  for (const row of rows) {
    const v = row[header]?.trim();
    if (v) return v;
  }
  return null;
}

function truncatePreview(text: string, max = PREVIEW_MAX_LEN): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

function extractionSourceText(
  fieldMap: Partial<Record<StandardField, string>>,
  rows: Record<string, string>[]
): string {
  const descHeader = fieldMap.description;
  const titleHeader = fieldMap.title;
  const desc = descHeader ? firstNonEmptyRowValue(rows, descHeader) : null;
  const title = titleHeader ? firstNonEmptyRowValue(rows, titleHeader) : null;
  return desc || title || '';
}

function extractPreviewFromText(field: StandardField, text: string): string | null {
  if (field === 'cve') return text.match(/CVE-\d{4}-\d+/i)?.[0]?.toUpperCase() ?? null;
  if (field === 'cwe') {
    const m = text.match(/CWE-?\d+/i)?.[0];
    return m ? m.replace(/CWE(\d+)/i, 'CWE-$1').toUpperCase() : null;
  }
  if (field === 'cvss') {
    const m = text.match(/CVSS(?:\s*score)?\s*:?\s*(\d+(?:\.\d+)?)/i);
    return m ? m[1] : null;
  }
  return null;
}

/** Primer valor no vacío por campo oficial (incluye extracción CVE/CWE/CVSS desde Descripción/Título). */
export function buildFieldPreviewMap(
  fieldMap: Partial<Record<StandardField, string>>,
  rows: Record<string, string>[]
): Partial<Record<StandardField, FieldPreviewEntry>> {
  const out: Partial<Record<StandardField, FieldPreviewEntry>> = {};
  const allFields = [...CORE_FIELD_KEYS, ...OPTIONAL_FIELD_KEYS] as StandardField[];

  for (const field of allFields) {
    const header = fieldMap[field];
    if (header) {
      const raw = firstNonEmptyRowValue(rows, header);
      out[field] = raw
        ? { value: truncatePreview(raw), source: 'column' }
        : { value: null, source: 'empty' };
      continue;
    }
    if (field === 'cve' || field === 'cwe' || field === 'cvss') {
      const text = extractionSourceText(fieldMap, rows);
      const extracted = text ? extractPreviewFromText(field, text) : null;
      if (extracted) {
        out[field] = { value: extracted, source: 'extracted' };
      }
    }
  }
  return out;
}

export { CORE_FIELD_KEYS, OPTIONAL_FIELD_KEYS, OFFICIAL_FIELD_CATALOG };
