import * as XLSX from 'xlsx';
import type { Finding, SecopsAsset } from '@/lib/secops-api';
import {
  VULN_MATRIX_ALL_COLUMNS,
  VULN_MATRIX_OPTIONAL_COLUMN_IDS,
  VULN_MATRIX_PRIMARY_COLUMN_IDS,
  findingToMatrixGridRow,
} from '@/lib/vuln-matrix-columns';

export type VulnMatrixExportScope = 'visible' | 'full';

function exportColumns(scope: VulnMatrixExportScope) {
  const visibleIds = new Set([
    ...VULN_MATRIX_PRIMARY_COLUMN_IDS,
    ...VULN_MATRIX_OPTIONAL_COLUMN_IDS,
  ]);
  if (scope === 'full') return VULN_MATRIX_ALL_COLUMNS;
  return VULN_MATRIX_ALL_COLUMNS.filter((c) => visibleIds.has(c.id));
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildVulnMatrixExportRows(
  rows: { finding: Finding; asset?: SecopsAsset | null; sourceIndex: number }[],
  scope: VulnMatrixExportScope = 'visible'
): { headers: string[]; data: string[][] } {
  const cols = exportColumns(scope);
  const headers = cols.map((c) => c.label);
  const data = rows.map(({ finding, asset, sourceIndex }) => {
    const grid = findingToMatrixGridRow(finding, asset, sourceIndex);
    return cols.map((c) => grid[c.id] ?? '');
  });
  return { headers, data };
}

export function downloadVulnMatrixCsv(
  rows: { finding: Finding; asset?: SecopsAsset | null; sourceIndex: number }[],
  filename = 'vulnerabilidades.csv',
  scope: VulnMatrixExportScope = 'visible'
): void {
  const { headers, data } = buildVulnMatrixExportRows(rows, scope);
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...data.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadVulnMatrixExcel(
  rows: { finding: Finding; asset?: SecopsAsset | null; sourceIndex: number }[],
  filename = 'vulnerabilidades.xlsx',
  scope: VulnMatrixExportScope = 'visible'
): void {
  const { headers, data } = buildVulnMatrixExportRows(rows, scope);
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Vulnerabilidades');
  XLSX.writeFile(wb, filename);
}
