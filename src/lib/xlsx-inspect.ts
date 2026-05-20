export type SheetCategory =
  | 'Tablero'
  | 'Alcance / SoW'
  | 'Evaluaciones'
  | 'Vulnerabilidades'
  | 'Catálogos'
  | 'Superficie / Inventario'
  | 'Seguimiento / Reportes'
  | 'Explotación'
  | 'General';

/** Pista para futura ingesta normalizada (API / jobs). */
export type SheetEntityHint =
  | 'tablero'
  | 'scope_sow'
  | 'evaluations'
  | 'tests_catalog'
  | 'offensive_actions'
  | 'findings_vulns'
  | 'surface_inventory'
  | 'tracking_remediation'
  | 'reports_meta'
  | 'exploitation'
  | 'pivot_aux'
  | 'general';

export type SheetInspect = {
  name: string;
  rowCount: number;
  colCount: number;
  headers: string[];
  sampleRows: unknown[][];
  category: SheetCategory;
  entityHint: SheetEntityHint;
};

export type InspectResult = {
  fileName: string;
  sheetCount: number;
  sheets: SheetInspect[];
  durationMs: number;
};

const MAX_CELL_LEN = 180;
const SAMPLE_ROWS = 4;
const HEADER_ROW_INDEX = 0;

function truncateCell(v: unknown): unknown {
  if (v == null) return '';
  if (typeof v === 'string' && v.length > MAX_CELL_LEN) {
    return `${v.slice(0, MAX_CELL_LEN)}…`;
  }
  if (typeof v === 'object' && v instanceof Date) {
    return v.toISOString();
  }
  return v;
}

function normalizeSheetName(name: string) {
  return name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function inferCategory(name: string): SheetCategory {
  const n = normalizeSheetName(name);
  if (n.includes('tablero')) return 'Tablero';
  if (n.includes('sow') || n.includes('alcance') || n.includes('scope')) return 'Alcance / SoW';
  if (
    n.includes('evaluacion') ||
    (n.includes('prueba') && (n.includes('seleccion') || n.includes('selecion') || n.includes('resultado')))
  )
    return 'Evaluaciones';
  if (n.includes('vulnerabil') || n.includes('vuln') || n.includes('hallazgo')) return 'Vulnerabilidades';
  if (n.includes('catalogo')) return 'Catálogos';
  if (n.includes('superficie') || n.includes('inventario') || n.includes('ataque')) return 'Superficie / Inventario';
  if (n.includes('seguimiento') || n.includes('reporte')) return 'Seguimiento / Reportes';
  if (n.includes('explotacion') || n.includes('postex')) return 'Explotación';
  return 'General';
}

function inferEntityHint(name: string, category: SheetCategory): SheetEntityHint {
  const n = normalizeSheetName(name);
  if (n.includes('tablero')) return 'tablero';
  if (n.includes('sow') || (n.includes('alcance') && !n.includes(' vs '))) return 'scope_sow';
  if (n.includes('catalogo') && n.includes('vulnerabil')) return 'findings_vulns';
  if (n.includes('seguimiento') && n.includes('vulnerabil')) return 'tracking_remediation';
  if (n.includes('acciones ofensivas') || n.includes('accion ofensiva')) return 'offensive_actions';
  if (n.includes('catalogo') && n.includes('prueba')) return 'tests_catalog';
  if (n.includes('datos expuestos') || n.includes('recopilacion')) return 'surface_inventory';
  if (n.startsWith('tbl ') || n.includes('vista_vulnerabil')) return 'findings_vulns';
  if (n === 'aux' || n.includes(' vs ')) return 'pivot_aux';
  if (category === 'Evaluaciones') return 'evaluations';
  if (category === 'Vulnerabilidades') return 'findings_vulns';
  if (category === 'Catálogos') return 'tests_catalog';
  if (category === 'Superficie / Inventario') return 'surface_inventory';
  if (category === 'Seguimiento / Reportes') return n.includes('reporte') ? 'reports_meta' : 'tracking_remediation';
  if (category === 'Explotación') return 'exploitation';
  if (category === 'Alcance / SoW') return 'scope_sow';
  return 'general';
}

export async function inspectWorkbookFromBuffer(fileName: string, buffer: ArrayBuffer): Promise<InspectResult> {
  const t0 = performance.now();
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true, dense: false });
  const sheets: SheetInspect[] = [];

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: '',
      raw: false,
    }) as unknown[][];

    const rowCount = matrix.length;
    let colCount = 0;
    for (let i = 0; i < Math.min(matrix.length, 50); i++) {
      const row = matrix[i];
      if (Array.isArray(row)) colCount = Math.max(colCount, row.length);
    }

    const headerRow = (matrix[HEADER_ROW_INDEX] as unknown[]) || [];
    const headers = headerRow.map((h, i) => {
      const s = h == null || h === '' ? `Col ${i + 1}` : String(h).trim();
      return s.length > 64 ? `${s.slice(0, 64)}…` : s;
    });

    const rawSample = matrix.slice(0, SAMPLE_ROWS).map((row) =>
      (Array.isArray(row) ? row : []).map((c) => truncateCell(c))
    );
    const maxCols = Math.min(Math.max(colCount, headers.length, 12), 24);
    const sampleRows = rawSample.map((row) => {
      const r = [...row];
      while (r.length < maxCols) r.push('');
      return r.slice(0, maxCols);
    });

    const category = inferCategory(name);
    sheets.push({
      name,
      rowCount,
      colCount: Math.max(colCount, headers.length),
      headers: headers.slice(0, maxCols),
      sampleRows,
      category,
      entityHint: inferEntityHint(name, category),
    });
  }

  return {
    fileName,
    sheetCount: sheets.length,
    sheets,
    durationMs: Math.round(performance.now() - t0),
  };
}
