/**
 * Detección de separador y parseo RFC-style (comillas, saltos de línea en celdas).
 */

export type CsvDelimiter = ',' | ';' | '\t';

const DELIMITERS: CsvDelimiter[] = [',', ';', '\t'];

function countFieldsQuoteAware(line: string, delimiter: string): number {
  let count = 1;
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') i += 1;
        else inQuotes = false;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delimiter) count += 1;
  }

  return count;
}

function modeColumnCount(counts: number[]): { mode: number; matches: number } {
  if (!counts.length) return { mode: 0, matches: 0 };
  const freq = new Map<number, number>();
  for (const c of counts) {
    freq.set(c, (freq.get(c) ?? 0) + 1);
  }
  let bestMode = 0;
  let bestMatches = 0;
  for (const [mode, matches] of freq) {
    if (matches > bestMatches || (matches === bestMatches && mode > bestMode)) {
      bestMode = mode;
      bestMatches = matches;
    }
  }
  return { mode: bestMode, matches: bestMatches };
}

/** Prefiere `;` en empate (Excel EU/LATAM). */
export function detectCsvDelimiter(text: string): CsvDelimiter {
  if (!text.trim()) return ',';

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter((l) => l.trim()).slice(0, 20);
  if (!lines.length) return ',';

  let best: CsvDelimiter = ',';
  let bestScore = -1;

  for (const d of DELIMITERS) {
    const counts = lines.map((line) => countFieldsQuoteAware(line, d));
    const { mode, matches } = modeColumnCount(counts);
    if (mode <= 1) continue;
    const score = matches * 1000 + mode;
    if (score > bestScore) {
      bestScore = score;
      best = d;
      continue;
    }
    if (score === bestScore && d === ';') best = ';';
  }

  if (bestScore < 0) {
    const tabCount = (normalized.slice(0, 8000).match(/\t/g) ?? []).length;
    const semiCount = (normalized.slice(0, 8000).match(/;/g) ?? []).length;
    const commaCount = (normalized.slice(0, 8000).match(/,/g) ?? []).length;
    if (tabCount > 0 && tabCount >= semiCount && tabCount >= commaCount) return '\t';
    if (semiCount > commaCount) return ';';
    return ',';
  }

  return best;
}

export function csvDelimiterLabel(d: CsvDelimiter): string {
  switch (d) {
    case ',':
      return 'coma';
    case ';':
      return 'punto y coma';
    case '\t':
      return 'tabulador';
    default:
      return 'coma';
  }
}

export function parseDelimitedTable(
  text: string,
  delimiter?: string,
  maxRows?: number
): string[][] {
  if (!text) return [];

  const delim = delimiter ?? detectCsvDelimiter(text);
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i];

    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === delim) {
      row.push(field);
      field = '';
      continue;
    }

    if (ch === '\n') {
      row.push(field);
      if (row.some((c) => c.length > 0)) rows.push(row);
      if (maxRows != null && rows.length >= maxRows) break;
      row = [];
      field = '';
      continue;
    }

    field += ch;
  }

  if (maxRows == null || rows.length < maxRows) {
    row.push(field);
    if (row.some((c) => c.length > 0)) rows.push(row);
  }

  return rows.map((r) => r.map((c) => c.replace(/\u00a0/g, ' ').trim()));
}
