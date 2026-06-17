import type { AssetGridColumn, AssetCellType } from '@/lib/asset-spreadsheet-columns';
import {
  clampColumnWidth,
  fitColumnsToHeaderLabels,
} from '@/lib/asset-grid-column-layout';
import {
  loadMatrixSeverityOptions,
  loadMatrixStatusOptions,
} from '@/lib/matrix-field-options';
import {
  VULN_MATRIX_ALL_COLUMNS,
  VULN_MATRIX_OPTIONAL_COLUMN_IDS,
  VULN_MATRIX_PRIMARY_COLUMN_IDS,
  type VulnMatrixColumnId,
} from '@/lib/vuln-matrix-columns';

export { fitColumnsToHeaderLabels };

const STORAGE_KEY_V2 = 'spectre.vuln-matrix.layout.v2';
const STORAGE_KEY_V1 = 'spectre.vuln-matrix.layout.v1';

export type VulnMatrixColumnLayout = {
  /** Columnas visibles en orden (siempre incluye las principales). */
  order: string[];
  widths: Record<string, number>;
};

const allById = () => new Map(VULN_MATRIX_ALL_COLUMNS.map((c) => [c.id, c]));

function primarySet() {
  return new Set<string>(VULN_MATRIX_PRIMARY_COLUMN_IDS);
}

function optionalSet() {
  return new Set<string>(VULN_MATRIX_OPTIONAL_COLUMN_IDS);
}

export function defaultVisibleColumnIds(): VulnMatrixColumnId[] {
  return [...VULN_MATRIX_PRIMARY_COLUMN_IDS];
}

function columnTypeForId(id: string): AssetCellType {
  if (id === 'severidad' || id === 'severidad_modificada') return 'severity';
  if (id === 'estado') return 'status';
  return 'text';
}

function columnOptionsForId(id: string): string[] | undefined {
  if (id === 'severidad' || id === 'severidad_modificada') {
    return loadMatrixSeverityOptions().map((o) => o.value);
  }
  if (id === 'estado') return loadMatrixStatusOptions().map((o) => o.value);
  return undefined;
}

function gridColumnFromDef(id: string, width: number | undefined): AssetGridColumn | null {
  const def = allById().get(id);
  if (!def) return null;
  const type = columnTypeForId(id);
  return {
    key: def.id,
    label: def.label,
    width: width !== undefined ? clampColumnWidth(width) : def.width,
    type,
    options: columnOptionsForId(id),
  };
}

export function buildGridColumnsFromIds(
  visibleIds: string[],
  widths: Record<string, number> = {}
): AssetGridColumn[] {
  const primary = primarySet();
  const seen = new Set<string>();
  const result: AssetGridColumn[] = [];

  for (const id of VULN_MATRIX_PRIMARY_COLUMN_IDS) {
    const col = gridColumnFromDef(id, widths[id]);
    if (!col) continue;
    result.push(col);
    seen.add(id);
  }

  for (const id of visibleIds) {
    if (seen.has(id) || primary.has(id)) continue;
    const col = gridColumnFromDef(id, widths[id]);
    if (!col) continue;
    result.push(col);
    seen.add(id);
  }

  return result;
}

function normalizeOrder(order: string[] | undefined): string[] {
  const primary = primarySet();
  const optional = optionalSet();
  const byId = allById();
  const extras: string[] = [];
  const seen = new Set<string>();

  for (const id of order ?? []) {
    if (primary.has(id) || seen.has(id) || !optional.has(id) || !byId.has(id)) continue;
    extras.push(id);
    seen.add(id);
  }
  return [...VULN_MATRIX_PRIMARY_COLUMN_IDS, ...extras];
}

export function loadVulnMatrixColumnLayout(): VulnMatrixColumnLayout {
  const fallback: VulnMatrixColumnLayout = {
    order: defaultVisibleColumnIds(),
    widths: {},
  };
  if (typeof window === 'undefined') return fallback;

  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY_V2);
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as VulnMatrixColumnLayout;
      const widths =
        parsed.widths && typeof parsed.widths === 'object' && !Array.isArray(parsed.widths)
          ? parsed.widths
          : {};
      return { order: normalizeOrder(parsed.order), widths };
    }

    const rawV1 = localStorage.getItem(STORAGE_KEY_V1);
    if (rawV1) {
      const parsed = JSON.parse(rawV1) as { widths?: Record<string, number> };
      const widths = parsed.widths ?? {};
      return { order: defaultVisibleColumnIds(), widths };
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export function loadVulnMatrixGridColumns(
  isEditable: (id: string) => boolean
): AssetGridColumn[] {
  const layout = loadVulnMatrixColumnLayout();
  return buildGridColumnsFromIds(layout.order, layout.widths).map((col) => {
    if (col.type === 'severity' || col.type === 'status') return col;
    if (!isEditable(col.key)) return { ...col, type: 'readonly' as const };
    if (col.type === 'readonly') return { ...col, type: 'text' as const };
    return col;
  });
}

export function saveVulnMatrixColumnLayout(layout: VulnMatrixColumnLayout) {
  if (typeof window === 'undefined') return;
  const normalized: VulnMatrixColumnLayout = {
    order: normalizeOrder(layout.order),
    widths: layout.widths,
  };
  localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(normalized));
}

export function saveVulnMatrixGridColumns(columns: AssetGridColumn[]) {
  const primary = primarySet();
  const optionalExtras = columns.map((c) => c.key).filter((k) => !primary.has(k));
  saveVulnMatrixColumnLayout({
    order: [...VULN_MATRIX_PRIMARY_COLUMN_IDS, ...optionalExtras],
    widths: Object.fromEntries(columns.map((c) => [c.key, c.width ?? 120])),
  });
}

/** @deprecated use saveVulnMatrixGridColumns */
export function saveVulnMatrixColumns(columns: AssetGridColumn[]) {
  saveVulnMatrixGridColumns(columns);
}

/** @deprecated use loadVulnMatrixGridColumns */
export function loadVulnMatrixColumns(base: AssetGridColumn[]): AssetGridColumn[] {
  void base;
  return loadVulnMatrixGridColumns(() => false);
}

export function addOptionalMatrixColumns(
  current: AssetGridColumn[],
  columnIds: string[],
  isEditable: (id: string) => boolean
): AssetGridColumn[] {
  const layout = loadVulnMatrixColumnLayout();
  const currentExtras = current.map((c) => c.key).filter((k) => !primarySet().has(k));
  const nextOrder = normalizeOrder([
    ...layout.order,
    ...currentExtras,
    ...columnIds,
  ]);
  const byId = allById();
  const widths = Object.fromEntries(current.map((c) => [c.key, c.width ?? 120]));
  for (const id of columnIds) {
    const def = byId.get(id);
    if (def && widths[id] === undefined) widths[id] = def.width;
  }
  return buildGridColumnsFromIds(nextOrder, widths).map((col) => ({
    ...col,
    type: isEditable(col.key) ? 'text' : 'readonly',
  }));
}

export function optionalColumnsNotVisible(visibleKeys: string[]) {
  const visible = new Set(visibleKeys);
  const byId = allById();
  return VULN_MATRIX_OPTIONAL_COLUMN_IDS.filter((id) => !visible.has(id)).map(
    (id) => byId.get(id)!
  );
}

export function isPrimaryMatrixColumn(columnId: string): boolean {
  return primarySet().has(columnId);
}
