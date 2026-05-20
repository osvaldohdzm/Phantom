import type { InspectResult } from '@/lib/xlsx-inspect';

const STORAGE_KEY = 'spectre:excel-inspect:v1';
const MAX_BYTES = 4_500_000;

export type SavedExcelInspect = {
  v: 1;
  savedAt: string;
  result: InspectResult;
};

export type SavedExcelInspectSummary = {
  v: 1;
  savedAt: string;
  summaryOnly: true;
  fileName: string;
  sheetCount: number;
  durationMs: number;
  sheets: Array<{ name: string; rowCount: number; colCount: number; category: string; entityHint?: string }>;
};

export function clearSavedExcelInspect(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function loadSavedExcelInspect(): SavedExcelInspect | SavedExcelInspectSummary | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedExcelInspect | SavedExcelInspectSummary;
    if (!parsed || parsed.v !== 1 || !parsed.savedAt) return null;
    if ('summaryOnly' in parsed && parsed.summaryOnly) return parsed;
    if (!('result' in parsed) || !parsed.result?.sheets) return null;
    return parsed as SavedExcelInspect;
  } catch {
    return null;
  }
}

export function saveExcelInspect(result: InspectResult): void {
  const payload: SavedExcelInspect = {
    v: 1,
    savedAt: new Date().toISOString(),
    result,
  };
  try {
    const str = JSON.stringify(payload);
    if (str.length > MAX_BYTES) {
      const summary: SavedExcelInspectSummary = {
        v: 1,
        savedAt: payload.savedAt,
        summaryOnly: true,
        fileName: result.fileName,
        sheetCount: result.sheetCount,
        durationMs: result.durationMs,
        sheets: result.sheets.map((s) => ({
          name: s.name,
          rowCount: s.rowCount,
          colCount: s.colCount,
          category: s.category,
          entityHint: s.entityHint,
        })),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(summary));
      return;
    }
    localStorage.setItem(STORAGE_KEY, str);
  } catch {
    try {
      const summary: SavedExcelInspectSummary = {
        v: 1,
        savedAt: new Date().toISOString(),
        summaryOnly: true,
        fileName: result.fileName,
        sheetCount: result.sheetCount,
        durationMs: result.durationMs,
        sheets: result.sheets.map((s) => ({
          name: s.name,
          rowCount: s.rowCount,
          colCount: s.colCount,
          category: s.category,
          entityHint: s.entityHint,
        })),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(summary));
    } catch {
      /* quota / private mode */
    }
  }
}
