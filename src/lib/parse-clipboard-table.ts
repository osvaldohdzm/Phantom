/**
 * Parsea portapapeles de Excel/Sheets: HTML table (preferido) o TSV/CSV
 * con comillas, "" escapadas y saltos de línea dentro de celdas.
 */

import { detectCsvDelimiter, parseDelimitedTable } from '@/lib/csv-delimited-parse';

export { detectCsvDelimiter, csvDelimiterLabel } from '@/lib/csv-delimited-parse';

export function parseClipboardTable(text: string): string[][] {
  if (!text) return [];
  const delimiter = detectCsvDelimiter(text);
  return normalizeMatrixWidth(parseDelimitedTable(text, delimiter));
}

/** Google Sheets / Excel suelen incluir tabla HTML más fiable que text/plain. */
export function parseClipboardHtml(html: string): string[][] | null {
  if (!html || !html.includes('<table')) return null;
  try {
    if (typeof DOMParser === 'undefined') return null;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const table = doc.querySelector('table');
    if (!table) return null;

    const rows: string[][] = [];
    table.querySelectorAll('tr').forEach((tr) => {
      const cells = [...tr.querySelectorAll('td, th')].map((cell) =>
        (cell.textContent ?? '').replace(/\u00a0/g, ' ').trim()
      );
      if (cells.some((c) => c.length > 0)) rows.push(cells);
    });

    return rows.length ? normalizeMatrixWidth(rows) : null;
  } catch {
    return null;
  }
}

export function parseClipboardFromDataTransfer(data: DataTransfer | null): string[][] {
  if (!data) return [];
  const html = data.getData('text/html');
  const plain = data.getData('text/plain');

  const fromHtml = html ? parseClipboardHtml(html) : null;
  const fromText = plain ? parseClipboardTable(plain) : [];

  if (fromHtml?.length && fromText.length) {
    const htmlCols = maxCols(fromHtml);
    const textCols = maxCols(fromText);
    if (htmlCols > textCols) return fromHtml;
    if (textCols > htmlCols) return fromText;
    return fromHtml.length >= fromText.length ? fromHtml : fromText;
  }

  return fromHtml ?? fromText;
}

function maxCols(matrix: string[][]) {
  return Math.max(0, ...matrix.map((r) => r.length));
}

export function normalizeMatrixWidth(matrix: string[][]): string[][] {
  if (!matrix.length) return matrix;
  const w = maxCols(matrix);
  return matrix.map((r) => {
    const row = [...r];
    while (row.length < w) row.push('');
    return row;
  });
}

function normHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Detecta si la fila parece datos (no cabeceras de hoja). */
function looksLikeDataRow(cells: string[]): boolean {
  const filled = cells.filter((c) => c.trim());
  if (filled.length === 0) return false;

  let score = 0;
  for (const cell of filled) {
    const lower = cell.toLowerCase().trim();
    if (/\.(com|net|org|io|mx|local)\b/i.test(cell)) score += 2;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(cell)) score += 2;
    if (/^\d{4}-\d{2}-\d{2}/.test(cell)) score += 1;
    if (lower === 'socradar') score += 2;
    if (lower === 'domain') score += 1;
    if (/subdomain/i.test(cell)) score += 1;
    if (lower === 'active subdomain' || lower === 'dormant subdomain') score += 2;
  }
  return score >= 2;
}

/**
 * Solo usa cabeceras si la primera fila coincide EXACTAMENTE con etiquetas de columna
 * (Fuente, Tipo, FQDN…), no por alias sobre valores de datos.
 */
export function alignPasteByHeaders(
  matrix: string[][],
  columns: { key: string; label: string }[]
): { rows: string[][]; usedHeaders: boolean } {
  if (matrix.length < 2) return { rows: matrix, usedHeaders: false };

  const headerRow = matrix[0];
  if (looksLikeDataRow(headerRow)) {
    return { rows: matrix, usedHeaders: false };
  }

  const mapping: (number | null)[] = headerRow.map((h) => {
    const n = normHeader(h);
    if (!n) return null;
    const idx = columns.findIndex(
      (col) => normHeader(col.label) === n || normHeader(col.key) === n
    );
    return idx >= 0 ? idx : null;
  });

  const matched = mapping.filter((m) => m !== null).length;
  if (matched < 2) return { rows: matrix, usedHeaders: false };

  const aligned = matrix.slice(1).map((line) => {
    const out = columns.map(() => '');
    line.forEach((cell, ci) => {
      const target = mapping[ci];
      if (target !== null && target !== undefined) out[target] = cell;
    });
    return out;
  });

  return { rows: aligned, usedHeaders: true };
}

/** Pega posicional: cada celda del portapapeles → columna editable desde startCol. */
export function pasteMatrixToRows(
  matrix: string[][],
  columns: { key: string; label: string; type?: string }[],
  startRow: number,
  startCol: number,
  isEditable: (colIdx: number) => boolean
): { keys: string[]; values: string[][]; region: { r1: number; r2: number; c1: number; c2: number } } {
  const normalized = normalizeMatrixWidth(matrix);
  let pasteCol = startCol;
  if (!isEditable(pasteCol)) {
    const first = columns.findIndex((c, i) => isEditable(i) && i >= startCol);
    pasteCol = first >= 0 ? first : columns.findIndex((_, i) => isEditable(i));
  }

  const targetCols: number[] = [];
  let c = pasteCol;
  const maxW = maxCols(normalized);
  for (let i = 0; i < maxW && c < columns.length; i += 1) {
    while (c < columns.length && !isEditable(c)) c += 1;
    if (c < columns.length) {
      targetCols.push(c);
      c += 1;
    }
  }

  const keys = targetCols.map((i) => columns[i].key);
  const values = normalized.map((line) => targetCols.map((_, ci) => line[ci] ?? ''));

  return {
    keys,
    values,
    region: {
      r1: startRow,
      r2: startRow + normalized.length - 1,
      c1: targetCols[0] ?? pasteCol,
      c2: targetCols[targetCols.length - 1] ?? pasteCol,
    },
  };
}
