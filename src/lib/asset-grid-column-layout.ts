import type { AssetGridColumn, AssetSourceType } from '@/lib/asset-spreadsheet-columns';

export interface AssetGridColumnLayout {
  order: string[];
  custom: AssetGridColumn[];
  widths?: Record<string, number>;
}

const DEFAULT_COL_WIDTH = 120;
const MIN_COL_WIDTH = 48;
const MAX_COL_WIDTH = 640;

export function clampColumnWidth(width: number): number {
  return Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, Math.round(width)));
}

let headerMeasureCanvas: HTMLCanvasElement | null = null;

function measureHeaderLabelPx(label: string): number {
  if (typeof document === 'undefined') {
    return label.length * 6.2;
  }
  if (!headerMeasureCanvas) headerMeasureCanvas = document.createElement('canvas');
  const ctx = headerMeasureCanvas.getContext('2d');
  if (!ctx) return label.length * 6.2;
  ctx.font = '600 10px ui-sans-serif, system-ui, -apple-system, sans-serif';
  return ctx.measureText(label.toUpperCase()).width;
}

/** Ancho mínimo para que el título de cabecera (+ iconos) no se solape. */
export function widthForColumnHeaderLabel(
  label: string,
  extraChrome = 56
): number {
  return clampColumnWidth(Math.ceil(measureHeaderLabelPx(label) + extraChrome));
}

export function fitColumnsToHeaderLabels(
  columns: AssetGridColumn[],
  options?: { extraChrome?: number }
): AssetGridColumn[] {
  const chrome = options?.extraChrome ?? 56;
  return columns.map((col) => ({
    ...col,
    width: widthForColumnHeaderLabel(col.label, chrome),
  }));
}

function applyWidths(columns: AssetGridColumn[], widths: Record<string, number>): AssetGridColumn[] {
  if (!Object.keys(widths).length) return columns;
  return columns.map((col) => {
    const w = widths[col.key];
    return w !== undefined ? { ...col, width: clampColumnWidth(w) } : col;
  });
}

const STORAGE_PREFIX = 'spectre.asset-grid.layout.v1';

function storageKey(source: AssetSourceType) {
  return `${STORAGE_PREFIX}.${source}`;
}

export function loadColumnLayout(
  source: AssetSourceType,
  baseColumns: AssetGridColumn[]
): AssetGridColumn[] {
  if (typeof window === 'undefined') return [...baseColumns];

  try {
    const raw = localStorage.getItem(storageKey(source));
    if (!raw) return [...baseColumns];
    const parsed = JSON.parse(raw) as AssetGridColumnLayout;
    const custom = Array.isArray(parsed.custom) ? parsed.custom : [];
    const allByKey = new Map(baseColumns.map((c) => [c.key, c]));
    for (const c of custom) {
      if (c?.key) allByKey.set(c.key, { ...c, type: c.type ?? 'text' });
    }

    const order = Array.isArray(parsed.order) ? parsed.order : baseColumns.map((c) => c.key);
    const result: AssetGridColumn[] = [];
    const seen = new Set<string>();

    for (const key of order) {
      const col = allByKey.get(key);
      if (col && !seen.has(key)) {
        result.push(col);
        seen.add(key);
      }
    }
    for (const col of baseColumns) {
      if (!seen.has(col.key)) result.push(col);
    }
    for (const col of custom) {
      if (col.key && !seen.has(col.key)) result.push(col);
    }
    const widths =
      parsed.widths && typeof parsed.widths === 'object' && !Array.isArray(parsed.widths)
        ? parsed.widths
        : {};
    return applyWidths(result, widths);
  } catch {
    return [...baseColumns];
  }
}

export function saveColumnLayout(source: AssetSourceType, columns: AssetGridColumn[]) {
  if (typeof window === 'undefined') return;
  const layout: AssetGridColumnLayout = {
    order: columns.map((c) => c.key),
    custom: columns.filter((c) => c.key.startsWith('custom_')),
    widths: Object.fromEntries(columns.map((c) => [c.key, c.width ?? DEFAULT_COL_WIDTH])),
  };
  localStorage.setItem(storageKey(source), JSON.stringify(layout));
}

export function createCustomColumn(label?: string): AssetGridColumn {
  const key = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    key,
    label: label?.trim() || 'Columna extra',
    type: 'text',
    width: 130,
  };
}

export function setColumnWidth(
  columns: AssetGridColumn[],
  colKey: string,
  width: number
): AssetGridColumn[] {
  const w = clampColumnWidth(width);
  return columns.map((c) => (c.key === colKey ? { ...c, width: w } : c));
}

export function moveColumn(columns: AssetGridColumn[], from: number, to: number): AssetGridColumn[] {
  if (from === to || from < 0 || to < 0 || from >= columns.length || to >= columns.length) {
    return columns;
  }
  const next = [...columns];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Primera posición a la que se puede mover una columna (bloquea `id` fija). */
export function minMovableColumnIndex(columns: AssetGridColumn[]): number {
  return columns[0]?.key === 'id' ? 1 : 0;
}

export function canReorderColumn(col: AssetGridColumn): boolean {
  return col.key !== 'id';
}

export function moveColumnByStep(
  columns: AssetGridColumn[],
  from: number,
  delta: -1 | 1
): AssetGridColumn[] {
  const to = from + delta;
  const min = minMovableColumnIndex(columns);
  if (from < min || to < min || to >= columns.length) return columns;
  return moveColumn(columns, from, to);
}

export function moveColumnToEdge(
  columns: AssetGridColumn[],
  from: number,
  edge: 'start' | 'end'
): AssetGridColumn[] {
  const min = minMovableColumnIndex(columns);
  const to = edge === 'start' ? min : columns.length - 1;
  return moveColumn(columns, from, to);
}

export const RECON_PRESET_COLUMNS: AssetGridColumn[] = [
  { key: 'custom_fuente', label: 'Fuente', type: 'text', width: 110, topLevel: 'discovery_method' },
  { key: 'custom_tipo', label: 'Tipo', type: 'text', width: 100, topLevel: 'asset_type' },
  { key: 'custom_subtipo', label: 'SubTipo', type: 'text', width: 130 },
  { key: 'custom_fqdn_host', label: 'FQDN / Host', type: 'text', width: 170, topLevel: 'fqdn' },
  { key: 'custom_ip_host', label: 'IP', type: 'text', width: 120, topLevel: 'ip_publica' },
  { key: 'custom_fecha_det', label: 'Fecha detección', type: 'date', width: 120 },
];

export function prependReconPreset(columns: AssetGridColumn[]): AssetGridColumn[] {
  const keys = new Set(columns.map((c) => c.key));
  const extras = RECON_PRESET_COLUMNS.filter((c) => !keys.has(c.key));
  if (!extras.length) return columns;
  const idCol = columns.find((c) => c.key === 'id');
  const rest = columns.filter((c) => c.key !== 'id');
  return idCol ? [idCol, ...extras, ...rest] : [...extras, ...columns];
}
