import type { Severity } from '@/lib/secops-api';
import {
  getSpreadsheetCellCharCount,
  getSpreadsheetCellValue,
  isCharCountColumn,
  sourceFromCharCountColumn,
  type SpreadsheetColumnId,
  type SpreadsheetSortableColumnId,
} from '@/lib/finding-spreadsheet-columns';
import type { Finding } from '@/lib/secops-api';
import { compareBySeverity } from '@/lib/severity-sort';
import { findingCompleteness } from '@/lib/finding-completeness';

export type SpreadsheetColumnFilter =
  | { kind: 'contains'; text: string }
  | { kind: 'equals'; text: string }
  | { kind: 'empty' }
  | { kind: 'not_empty' }
  | { kind: 'severity_in'; values: Severity[] }
  | { kind: 'char_gte'; min: number }
  | { kind: 'char_lte'; max: number };

export type SpreadsheetColumnFilters = Partial<
  Record<SpreadsheetSortableColumnId, SpreadsheetColumnFilter>
>;

export type SpreadsheetSort = {
  column: SpreadsheetSortableColumnId;
  direction: 'asc' | 'desc';
};

const ALL_SEVERITIES: Severity[] = ['Critical', 'High', 'Medium', 'Low', 'Info'];

export function findingMatchesColumnFilter(
  finding: Finding,
  columnId: SpreadsheetSortableColumnId,
  filter: SpreadsheetColumnFilter | undefined
): boolean {
  if (!filter) return true;

  if (isCharCountColumn(columnId)) {
    const sourceId = sourceFromCharCountColumn(columnId);
    const len = getSpreadsheetCellCharCount(finding, sourceId);
    switch (filter.kind) {
      case 'char_gte':
        return len >= filter.min;
      case 'char_lte':
        return len <= filter.max;
      case 'empty':
        return len === 0;
      case 'not_empty':
        return len > 0;
      default:
        return true;
    }
  }

  const dataColumnId = columnId as SpreadsheetColumnId;
  const raw = getSpreadsheetCellValue(finding, dataColumnId);
  const value = raw.toLowerCase();

  switch (filter.kind) {
    case 'contains':
      return value.includes(filter.text.trim().toLowerCase());
    case 'equals':
      return value === filter.text.trim().toLowerCase();
    case 'empty':
      return raw.trim().length === 0;
    case 'not_empty':
      return raw.trim().length > 0;
    case 'severity_in':
      return filter.values.length === 0 || filter.values.includes(finding.severidad);
    case 'char_gte':
      return getSpreadsheetCellCharCount(finding, dataColumnId) >= filter.min;
    case 'char_lte':
      return getSpreadsheetCellCharCount(finding, dataColumnId) <= filter.max;
    default:
      return true;
  }
}

export function applySpreadsheetColumnFilters(
  findings: Finding[],
  filters: SpreadsheetColumnFilters
): Finding[] {
  const entries = Object.entries(filters) as [SpreadsheetSortableColumnId, SpreadsheetColumnFilter][];
  if (!entries.length) return findings;
  return findings.filter((f) =>
    entries.every(([col, filter]) => findingMatchesColumnFilter(f, col, filter))
  );
}

export function sortFindingsByColumn(
  findings: Finding[],
  sort: SpreadsheetSort | null
): Finding[] {
  if (!sort) return findings;
  const { column, direction } = sort;
  const list = [...findings];
  list.sort((a, b) => {
    let cmp = 0;
    if (isCharCountColumn(column)) {
      const sourceId = sourceFromCharCountColumn(column);
      cmp =
        getSpreadsheetCellCharCount(a, sourceId) - getSpreadsheetCellCharCount(b, sourceId);
    } else if (column === 'severidad') {
      cmp = compareBySeverity(a.severidad, b.severidad);
    } else if (column === 'completeness') {
      cmp = findingCompleteness(a).percent - findingCompleteness(b).percent;
    } else {
      const va = getSpreadsheetCellValue(a, column).toLowerCase();
      const vb = getSpreadsheetCellValue(b, column).toLowerCase();
      cmp = va.localeCompare(vb, 'es');
    }
    return direction === 'asc' ? cmp : -cmp;
  });
  return list;
}

export function uniqueColumnValues(
  findings: Finding[],
  columnId: SpreadsheetColumnId,
  limit = 40
): string[] {
  const set = new Set<string>();
  for (const f of findings) {
    const v = getSpreadsheetCellValue(f, columnId).trim();
    if (v) set.add(v);
    if (set.size >= limit) break;
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'es'));
}

export function severityFilterFromColumn(
  filter: SpreadsheetColumnFilter | undefined
): Severity[] | undefined {
  if (filter?.kind === 'severity_in' && filter.values.length) return filter.values;
  return undefined;
}

export { ALL_SEVERITIES as SPREADSHEET_SEVERITIES };
