import type { CatalogSpanishAiField } from '@/lib/catalog-ai-fields';
import type { Finding } from '@/lib/secops-api';
import { getActiveReviewFields } from '@/lib/catalog-field-config';
import { findingCompleteness, type ReviewFieldKey } from '@/lib/finding-completeness';
import { resolveFindingComponente } from '@/lib/finding-grouping';
import {
  detectionSourceLabels,
  resolveSyncStatusVisual,
  SYNC_STATUS_DOT,
} from '@/lib/finding-master-catalog';
import {
  spreadsheetColumnToCatalogColumn,
  type TenantLanguage,
} from '@/lib/tenant-locale';
import { syncStatusLabel, uiYes } from '@/lib/ui-locale';

export type SpreadsheetColumnId =
  | 'completeness'
  | 'severidad'
  | 'titulo'
  | 'componente_afectado'
  | ReviewFieldKey
  | 'cve'
  | 'cwe'
  | 'cvss_score'
  | 'epss_score'
  | 'kev_listed'
  | 'sync_status'
  | 'detection_source'
  | 'status'
  | 'created_at';

/** Columna de revisión → columna catálogo según idioma del tenant. */
export function catalogAiFieldForSpreadsheetColumn(
  columnId: SpreadsheetColumnId,
  language: TenantLanguage = 'es'
): string | null {
  return spreadsheetColumnToCatalogColumn(columnId, language);
}

/** @deprecated Usar catalogAiFieldForSpreadsheetColumn */
export const SPREADSHEET_COLUMN_CATALOG_AI: Partial<
  Record<SpreadsheetColumnId, CatalogSpanishAiField>
> = {
  severidad: 'EspSeveridadUnificada',
  descripcion: 'EspDescripcionUnificada',
  amenaza_ampliada: 'EspAmenazaUnificadaGeneral',
  propuesta_remediacion: 'EspPropuestaRemediacionUnificada',
  metodo_deteccion: 'EspMetodoDeteccion',
  explicacion_tecnica: 'EspExplicacionTecnica',
};

export function spreadsheetColumnSupportsCatalogGemini(
  columnId: SpreadsheetColumnId,
  language: TenantLanguage = 'es'
): boolean {
  return catalogAiFieldForSpreadsheetColumn(columnId, language) !== null;
}

export type SpreadsheetColumn = {
  id: SpreadsheetColumnId;
  label: string;
  shortLabel: string;
  width: number;
  sticky?: boolean;
  reportField?: boolean;
};

export const SPREADSHEET_COLUMNS: SpreadsheetColumn[] = [
  { id: 'completeness', label: '% Completo', shortLabel: '%', width: 52, sticky: true },
  { id: 'severidad', label: 'Severidad', shortLabel: 'Sev.', width: 88, sticky: true, reportField: true },
  { id: 'titulo', label: 'Título / Nombre', shortLabel: 'Título', width: 220, sticky: true, reportField: true },
  { id: 'componente_afectado', label: 'Componente afectado', shortLabel: 'Componente', width: 140, reportField: true },
  { id: 'descripcion', label: 'Descripción', shortLabel: 'Desc.', width: 200, reportField: true },
  { id: 'amenaza_ampliada', label: 'Amenaza ampliada', shortLabel: 'Amenaza', width: 180, reportField: true },
  { id: 'propuesta_remediacion', label: 'Propuesta remediación', shortLabel: 'Remed.', width: 180, reportField: true },
  { id: 'explicacion_tecnica', label: 'Explicación técnica', shortLabel: 'Expl. téc.', width: 160, reportField: true },
  { id: 'metodo_deteccion', label: 'Método detección', shortLabel: 'Método', width: 120, reportField: true },
  { id: 'referencias', label: 'Referencias', shortLabel: 'Refs.', width: 120, reportField: true },
  { id: 'cve', label: 'CVE', shortLabel: 'CVE', width: 110 },
  { id: 'cwe', label: 'CWE', shortLabel: 'CWE', width: 90 },
  { id: 'cvss_score', label: 'CVSS', shortLabel: 'CVSS', width: 56 },
  { id: 'epss_score', label: 'EPSS', shortLabel: 'EPSS', width: 56 },
  { id: 'kev_listed', label: 'KEV', shortLabel: 'KEV', width: 48 },
  { id: 'sync_status', label: 'Estado Sync', shortLabel: 'Sync', width: 88 },
  { id: 'detection_source', label: 'Origen', shortLabel: 'Origen', width: 100 },
  { id: 'status', label: 'Estado', shortLabel: 'Estado', width: 100 },
  { id: 'raw_tool_output', label: 'Salida herramienta', shortLabel: 'Salida', width: 140, reportField: true },
  { id: 'created_at', label: 'Creado', shortLabel: 'Creado', width: 100 },
];

const SPREADSHEET_COLUMNS_EN: SpreadsheetColumn[] = [
  { id: 'completeness', label: '% Complete', shortLabel: '%', width: 52, sticky: true },
  { id: 'severidad', label: 'Severity', shortLabel: 'Sev.', width: 88, sticky: true, reportField: true },
  { id: 'titulo', label: 'Title / Name', shortLabel: 'Title', width: 220, sticky: true, reportField: true },
  { id: 'componente_afectado', label: 'Affected component', shortLabel: 'Component', width: 140, reportField: true },
  { id: 'descripcion', label: 'Description', shortLabel: 'Desc.', width: 200, reportField: true },
  { id: 'amenaza_ampliada', label: 'Threat / impact', shortLabel: 'Threat', width: 180, reportField: true },
  { id: 'propuesta_remediacion', label: 'Remediation', shortLabel: 'Remed.', width: 180, reportField: true },
  { id: 'explicacion_tecnica', label: 'Technical explanation', shortLabel: 'Tech.', width: 160, reportField: true },
  { id: 'metodo_deteccion', label: 'Detection method', shortLabel: 'Method', width: 120, reportField: true },
  { id: 'referencias', label: 'References', shortLabel: 'Refs.', width: 120, reportField: true },
  { id: 'cve', label: 'CVE', shortLabel: 'CVE', width: 110 },
  { id: 'cwe', label: 'CWE', shortLabel: 'CWE', width: 90 },
  { id: 'cvss_score', label: 'CVSS', shortLabel: 'CVSS', width: 56 },
  { id: 'epss_score', label: 'EPSS', shortLabel: 'EPSS', width: 56 },
  { id: 'kev_listed', label: 'KEV', shortLabel: 'KEV', width: 48 },
  { id: 'sync_status', label: 'Sync status', shortLabel: 'Sync', width: 88 },
  { id: 'detection_source', label: 'Source', shortLabel: 'Source', width: 100 },
  { id: 'status', label: 'Status', shortLabel: 'Status', width: 100 },
  { id: 'raw_tool_output', label: 'Tool output', shortLabel: 'Output', width: 140, reportField: true },
  { id: 'created_at', label: 'Created', shortLabel: 'Created', width: 100 },
];

export function spreadsheetColumnsForLanguage(language: TenantLanguage = 'es'): SpreadsheetColumn[] {
  return language === 'en' ? SPREADSHEET_COLUMNS_EN : SPREADSHEET_COLUMNS;
}

const TITULO_MIN = 5;

export type CellState = 'ok' | 'missing' | 'empty' | 'na';

export function getSpreadsheetCellValue(
  finding: Finding,
  columnId: SpreadsheetColumnId,
  language: TenantLanguage = 'es'
): string {
  if (columnId === 'completeness') {
    return `${findingCompleteness(finding).percent}%`;
  }
  if (columnId === 'componente_afectado') {
    return resolveFindingComponente(finding) || String(finding.componente_afectado ?? '').trim();
  }
  if (columnId === 'created_at') {
    const d = finding.created_at;
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString(language === 'en' ? 'en-US' : 'es-MX', {
        day: '2-digit',
        month: 'short',
      });
    } catch {
      return d.slice(0, 10);
    }
  }
  if (columnId === 'epss_score') {
    const v = finding.epss_score;
    return v != null ? `${(v * 100).toFixed(1)}%` : '';
  }
  if (columnId === 'kev_listed') {
    return finding.kev_listed ? uiYes(language) : '';
  }
  if (columnId === 'sync_status') {
    const v = resolveSyncStatusVisual(finding);
    return `${SYNC_STATUS_DOT[v]} ${syncStatusLabel(v, language)}`;
  }
  if (columnId === 'detection_source') {
    return detectionSourceLabels(finding).join(', ');
  }
  const raw = finding[columnId as keyof Finding];
  if (raw === null || raw === undefined) return '';
  return String(raw).trim();
}

export function getSpreadsheetCellState(finding: Finding, columnId: SpreadsheetColumnId): CellState {
  if (columnId === 'completeness' || columnId === 'created_at') return 'na';
  if (columnId === 'severidad') {
    return finding.severidad ? 'ok' : 'missing';
  }
  if (columnId === 'titulo') {
    const len = String(finding.titulo ?? '').trim().length;
    return len >= TITULO_MIN ? 'ok' : len > 0 ? 'missing' : 'empty';
  }
  if (columnId === 'cve' || columnId === 'cwe' || columnId === 'cvss_score' || columnId === 'epss_score' || columnId === 'kev_listed' || columnId === 'status' || columnId === 'sync_status' || columnId === 'detection_source') {
    const v = getSpreadsheetCellValue(finding, columnId);
    return v ? 'ok' : 'na';
  }
  if (columnId === 'componente_afectado') {
    const v = getSpreadsheetCellValue(finding, columnId);
    return v.length >= 3 ? 'ok' : v.length > 0 ? 'missing' : 'empty';
  }

  const review = getActiveReviewFields().find((r) => r.key === columnId);
  if (review) {
    const c = findingCompleteness(finding);
    if (!c.missingKeys.includes(review.key)) return 'ok';
    const v = String(finding[review.key] ?? '').trim();
    return v.length === 0 ? 'empty' : 'missing';
  }

  return 'na';
}

export function findingMatchesSpreadsheetSearch(
  finding: Finding,
  query: string,
  language: TenantLanguage = 'es'
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const cols = spreadsheetColumnsForLanguage(language);
  const haystack = cols.map((col) => getSpreadsheetCellValue(finding, col.id, language))
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

const CHAR_COUNT_SKIP_COLUMNS = new Set<SpreadsheetColumnId>([
  'completeness',
  'severidad',
  'created_at',
  'cvss_score',
  'epss_score',
  'kev_listed',
]);

export type SpreadsheetCharCountColumnId = `count:${SpreadsheetColumnId}`;

export type SpreadsheetSortableColumnId = SpreadsheetColumnId | SpreadsheetCharCountColumnId;

export function columnSupportsCharCount(columnId: SpreadsheetColumnId): boolean {
  return !CHAR_COUNT_SKIP_COLUMNS.has(columnId);
}

export function toCharCountColumnId(columnId: SpreadsheetColumnId): SpreadsheetCharCountColumnId {
  return `count:${columnId}`;
}

export function isCharCountColumn(
  columnId: SpreadsheetSortableColumnId
): columnId is SpreadsheetCharCountColumnId {
  return String(columnId).startsWith('count:');
}

export function sourceFromCharCountColumn(
  columnId: SpreadsheetCharCountColumnId
): SpreadsheetColumnId {
  return columnId.slice(6) as SpreadsheetColumnId;
}

export function getSpreadsheetCellCharCount(
  finding: Finding,
  columnId: SpreadsheetColumnId,
  language: TenantLanguage = 'es'
): number {
  return getSpreadsheetCellValue(finding, columnId, language).length;
}

/** Color de alerta según longitud (vista detalles). */
export function charCountTone(length: number): 'muted' | 'warn' | 'alert' | 'critical' {
  if (length >= 2000) return 'critical';
  if (length >= 1000) return 'alert';
  if (length >= 500) return 'warn';
  return 'muted';
}
