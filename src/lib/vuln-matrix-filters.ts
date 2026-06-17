import type { Severity } from '@/lib/secops-api';
import type { SecopsAsset } from '@/lib/secops-api';
import type { Finding } from '@/lib/secops-api';
import { getVulnMatrixCellValue } from '@/lib/vuln-matrix-columns';
import { compareBySeverity } from '@/lib/severity-sort';

export type MatrixColumnFilter =
  | { kind: 'contains'; text: string }
  | { kind: 'equals'; text: string }
  | { kind: 'empty' }
  | { kind: 'not_empty' }
  | { kind: 'severity_in'; values: Severity[] };

export type MatrixColumnFilters = Partial<Record<string, MatrixColumnFilter>>;

export type MatrixSort = {
  column: string;
  direction: 'asc' | 'desc';
};

export type MatrixDataRow = {
  finding: Finding;
  asset?: SecopsAsset | null;
  sourceIndex: number;
};

function cellText(row: MatrixDataRow, columnId: string): string {
  return getVulnMatrixCellValue(row.finding, row.asset, columnId, row.sourceIndex);
}

export function matrixRowMatchesColumnFilter(
  row: MatrixDataRow,
  columnId: string,
  filter: MatrixColumnFilter | undefined
): boolean {
  if (!filter) return true;
  const raw = cellText(row, columnId);
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
      return filter.values.length === 0 || filter.values.includes(row.finding.severidad);
    default:
      return true;
  }
}

export function applyMatrixColumnFilters(
  rows: MatrixDataRow[],
  filters: MatrixColumnFilters
): MatrixDataRow[] {
  const entries = Object.entries(filters).filter(([, f]) => f);
  if (!entries.length) return rows;
  return rows.filter((row) =>
    entries.every(([colId, filter]) => matrixRowMatchesColumnFilter(row, colId, filter))
  );
}

export function sortMatrixRows(rows: MatrixDataRow[], sort: MatrixSort | null): MatrixDataRow[] {
  if (!sort) return rows;
  const { column, direction } = sort;
  const mult = direction === 'asc' ? 1 : -1;

  if (column === 'severidad') {
    const sorted = [...rows].sort((a, b) => mult * compareBySeverity(a.finding.severidad, b.finding.severidad));
    return sorted;
  }

  return [...rows].sort((a, b) => {
    const av = cellText(a, column).toLowerCase();
    const bv = cellText(b, column).toLowerCase();
    if (av < bv) return -1 * mult;
    if (av > bv) return 1 * mult;
    return 0;
  });
}

export function uniqueMatrixColumnValues(rows: MatrixDataRow[], columnId: string, limit = 40): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    const v = cellText(row, columnId).trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= limit) break;
  }
  return out.sort((a, b) => a.localeCompare(b, 'es'));
}
