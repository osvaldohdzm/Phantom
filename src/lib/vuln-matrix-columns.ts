import type { EvidenceAttachment, Finding } from '@/lib/secops-api';
import type { SecopsAsset } from '@/lib/secops-api';
import { detectionSourceLabels, sourceBadgeLabel } from '@/lib/finding-master-catalog';
import { resolveFindingComponente } from '@/lib/finding-grouping';
import { classifyMatrixRow } from '@/lib/vuln-matrix-classify';

export type VulnMatrixColumnId = string;

export type VulnMatrixColumn = {
  id: VulnMatrixColumnId;
  label: string;
  width: number;
  sticky?: boolean;
  primary?: boolean;
};

const EVIDENCE_MATRIX_COLUMNS: VulnMatrixColumn[] = Array.from({ length: 6 }, (_, i) => {
  const n = i + 1;
  return [
    { id: `evidencia_${n}_imagen`, label: `Evidencia ${n} Imagen`, width: 150, primary: true },
    { id: `evidencia_${n}_descripcion`, label: `Evidencia ${n} Descripción`, width: 170, primary: true },
  ];
}).flat();

/** Columnas CYB001 completas (catálogo). */
const CYB001_EXTENDED_COLUMNS: VulnMatrixColumn[] = [
  { id: 'folio', label: 'Folio', width: 72, sticky: true },
  { id: 'fecha_deteccion', label: 'Fecha de detección', width: 110, sticky: true },
  { id: 'nombre_activo', label: 'Nombre de activo tecnológico', width: 160, sticky: true },
  { id: 'nombre_hallazgo', label: 'Nombre de hallazgo', width: 200 },
  { id: 'descripcion', label: 'Descripción del hallazgo', width: 200 },
  { id: 'evidencia_principal', label: 'Evidencia principal de hallazgo', width: 140 },
  { id: 'categoria_hallazgo', label: 'Categoría de hallazgo', width: 120 },
  { id: 'cve', label: 'CVE', width: 110 },
  { id: 'explicacion_tecnica', label: 'Explicación técnica', width: 160 },
  { id: 'cwe', label: 'CWE', width: 80 },
  { id: 'cvss_vector', label: 'CVSSVector', width: 120 },
  { id: 'cvss_score', label: 'CVSSScore', width: 72 },
  { id: 'tipo_exposicion', label: 'Tipo de Exposición', width: 110 },
  { id: 'ipv6_publica', label: 'IPv6 Pública', width: 110 },
  { id: 'ipv4_publica', label: 'IPv4 Pública', width: 110 },
  { id: 'fqdn', label: 'FQDN', width: 140 },
  { id: 'hostname', label: 'Hostname', width: 120 },
  { id: 'ipv6_interna', label: 'IPv6 Interna', width: 110 },
  { id: 'ipv4_interna', label: 'IPv4 Interna', width: 110 },
  { id: 'puerto', label: 'Puerto', width: 72 },
  { id: 'servicio', label: 'Servicio', width: 90 },
  { id: 'protocolo', label: 'Protocolo de transporte', width: 100 },
  { id: 'ruta', label: 'Ruta', width: 120 },
  { id: 'linea_codigo', label: 'Linea de Codigo', width: 100 },
  { id: 'tipo_activo', label: 'Tipo de Activo', width: 110 },
  { id: 'grupo_activos', label: 'Grupo de activos', width: 140 },
  { id: 'subgrupo_activos', label: 'Subgrupo de activos', width: 140 },
  { id: 'inventario', label: 'Inventario', width: 100 },
  { id: 'ambiente', label: 'Ambiente', width: 90 },
  { id: 'critico', label: 'Crítico', width: 72 },
  { id: 'regulacion', label: 'Regulacion', width: 90 },
  { id: 'tipo_vulnerabilidad', label: 'Tipo de vulnerabilidad', width: 120 },
  { id: 'tipo_remediacion', label: 'Tipo de remediación sugerida', width: 130 },
  { id: 'identificador_deteccion', label: 'Identificador de detección usado', width: 140 },
  { id: 'nombre_original', label: 'Nombre original de la vulnerabilidad', width: 160 },
  { id: 'tipo_origen', label: 'Tipo de origen', width: 100 },
  { id: 'identificador_original', label: 'Identificador original de la vulnerabilidad', width: 150 },
  { id: 'severidad_original', label: 'Severidad Original', width: 100 },
  { id: 'identificador_vulnerabilidad', label: 'Identificador de vulnerabilidad', width: 130 },
  { id: 'nombre_estandar', label: 'Nombre estandar de la vulnerabilidad', width: 160 },
  { id: 'explotabilidad', label: 'Explotabilidad', width: 100 },
  { id: 'referencias_exploits', label: 'Referencias de Exploits', width: 120 },
  { id: 'conteo_deteccion', label: 'Conteo de detección', width: 100 },
  { id: 'ultima_deteccion', label: 'Última fecha de detección', width: 120 },
  { id: 'severidad_modificada', label: 'Severidad modificada', width: 110 },
  { id: 'nombre_modificado', label: 'Nombre modificado', width: 140 },
  { id: 'conjunto_nombres', label: 'Conjunto de nombres', width: 120 },
  { id: 'tipo_redaccion_descripcion', label: 'Tipo de redacción de descripción', width: 140 },
  { id: 'tipo_redaccion_amenaza', label: 'Tipo de redacción de amenaza', width: 130 },
  { id: 'tipo_redaccion_remediacion', label: 'Tipo de redacción de propuesta de remediación', width: 150 },
  { id: 'tipo_redaccion_explicacion', label: 'Tipo de texto de explicación técnica', width: 150 },
  { id: 'origen_integracion', label: 'Integración / Fuente', width: 100 },
  { id: 'sync_status', label: 'Sync catálogo', width: 88 },
];

/** Vista principal consolidada (CYB001 operativa). */
const CYB001_PRIMARY_COLUMNS: VulnMatrixColumn[] = [
  { id: 'nombre_vulnerabilidad', label: 'Nombre de vulnerabilidad', width: 200, primary: true },
  { id: 'componente_afectado', label: 'Componente afectado', width: 150, primary: true },
  { id: 'severidad', label: 'Severidad', width: 88, primary: true },
  { id: 'estado', label: 'Estado', width: 100, primary: true },
  { id: 'fecha_carga', label: 'Fecha de carga', width: 110, primary: true },
  { id: 'fecha_deteccion', label: 'Fecha de detección', width: 110, primary: true },
  { id: 'ultima_deteccion', label: 'Última fecha de detección', width: 120, primary: true },
  { id: 'fecha_ultima_actualizacion', label: 'Fecha de última actualización', width: 130, primary: true },
  { id: 'metodo_deteccion', label: 'Método de detección', width: 130, primary: true },
  { id: 'salidas_herramienta', label: 'Salidas de herramienta', width: 180, primary: true },
  { id: 'explotabilidad_comun', label: 'Explotabilidad Común', width: 120, primary: true },
  ...EVIDENCE_MATRIX_COLUMNS,
  { id: 'descripcion_ampliada', label: 'Descripción ampliada', width: 200, primary: true },
  { id: 'amenaza_ampliada', label: 'Amenaza ampliada', width: 180, primary: true },
  { id: 'propuesta_remediacion', label: 'Propuesta de remediación ampliada', width: 200, primary: true },
  { id: 'referencias', label: 'Referencias', width: 140, primary: true },
  { id: 'tipo_analisis', label: 'Tipo de análisis', width: 110, primary: true },
];

function mergeColumnCatalog(): VulnMatrixColumn[] {
  const byId = new Map<string, VulnMatrixColumn>();
  for (const col of [...CYB001_PRIMARY_COLUMNS, ...CYB001_EXTENDED_COLUMNS]) {
    if (!byId.has(col.id)) byId.set(col.id, col);
  }
  return [...byId.values()];
}

export const VULN_MATRIX_ALL_COLUMNS: VulnMatrixColumn[] = mergeColumnCatalog();

export const VULN_MATRIX_PRIMARY_COLUMN_IDS: VulnMatrixColumnId[] =
  CYB001_PRIMARY_COLUMNS.map((c) => c.id);

export const VULN_MATRIX_OPTIONAL_COLUMN_IDS: VulnMatrixColumnId[] =
  CYB001_EXTENDED_COLUMNS.map((c) => c.id).filter(
    (id) => !VULN_MATRIX_PRIMARY_COLUMN_IDS.includes(id)
  );

/** @deprecated use VULN_MATRIX_ALL_COLUMNS */
export const VULN_MATRIX_COLUMNS: VulnMatrixColumn[] = VULN_MATRIX_ALL_COLUMNS;

/** Columnas editables → campo en `findings` (API PATCH). */
export const MATRIX_COLUMN_TO_FINDING: Partial<
  Record<VulnMatrixColumnId, keyof import('@/lib/secops-api').Finding>
> = {
  nombre_hallazgo: 'titulo',
  nombre_vulnerabilidad: 'titulo',
  nombre_estandar: 'titulo',
  descripcion: 'descripcion',
  descripcion_ampliada: 'descripcion',
  amenaza_ampliada: 'amenaza_ampliada',
  propuesta_remediacion: 'propuesta_remediacion',
  explicacion_tecnica: 'explicacion_tecnica',
  metodo_deteccion: 'metodo_deteccion',
  referencias: 'referencias',
  componente_afectado: 'componente_afectado',
  salidas_herramienta: 'raw_tool_output',
  severidad: 'severidad',
  severidad_modificada: 'severidad',
  estado: 'status',
  cve: 'cve',
  cwe: 'cwe',
  cvss_score: 'cvss_score',
  cvss_vector: 'cvss_vector',
};

const READONLY_MATRIX_COLS = new Set([
  'folio',
  'fecha_carga',
  'fecha_deteccion',
  'ultima_deteccion',
  'fecha_ultima_actualizacion',
  'nombre_activo',
  'evidencia_principal',
  'categoria_hallazgo',
  'explotabilidad',
  'explotabilidad_comun',
  'tipo_analisis',
  'tipo_exposicion',
  'origen_integracion',
  'sync_status',
  'conteo_deteccion',
  'ultima_deteccion',
  'identificador_vulnerabilidad',
  'identificador_deteccion',
  'identificador_original',
  'tipo_origen',
  'severidad_original',
  'severidad_modificada',
  'nombre_modificado',
  'conjunto_nombres',
  'referencias_exploits',
  'nombre_original',
  'tipo_redaccion_descripcion',
  'tipo_redaccion_amenaza',
  'tipo_redaccion_remediacion',
  'tipo_redaccion_explicacion',
  'evidencia_1_imagen',
  'evidencia_1_descripcion',
  'evidencia_2_imagen',
  'evidencia_2_descripcion',
  'evidencia_3_imagen',
  'evidencia_3_descripcion',
  'evidencia_4_imagen',
  'evidencia_4_descripcion',
  'evidencia_5_imagen',
  'evidencia_5_descripcion',
  'evidencia_6_imagen',
  'evidencia_6_descripcion',
]);

export function isMatrixColumnEditable(columnId: VulnMatrixColumnId): boolean {
  return Boolean(MATRIX_COLUMN_TO_FINDING[columnId]) && !READONLY_MATRIX_COLS.has(columnId);
}

export function gridRowToFindingPatch(
  row: Record<string, string>
): Partial<{
  titulo: string;
  descripcion: string;
  amenaza_ampliada: string;
  propuesta_remediacion: string;
  explicacion_tecnica: string;
  metodo_deteccion: string;
  referencias: string;
  componente_afectado: string;
  raw_tool_output: string;
  cve: string;
  cwe: string;
  cvss_score: number;
  cvss_vector: string;
  severidad: import('@/lib/secops-api').Severity;
  estado: string;
}> {
  const patch: Record<string, string | number | undefined> = {};
  for (const [colId, field] of Object.entries(MATRIX_COLUMN_TO_FINDING)) {
    const raw = row[colId];
    if (raw === undefined) continue;
    const value = raw.trim();
    if (field === 'cvss_score') {
      const n = parseFloat(value);
      patch.cvss_score = Number.isFinite(n) ? n : undefined;
    } else if (field === 'severidad') {
      const sev = value as import('@/lib/secops-api').Severity;
      if (['Critical', 'High', 'Medium', 'Low', 'Info'].includes(sev)) {
        patch.severidad = sev;
      }
    } else if (field === 'status') {
      patch.estado = value || undefined;
    } else if (
      field === 'titulo' ||
      field === 'descripcion' ||
      field === 'amenaza_ampliada' ||
      field === 'propuesta_remediacion' ||
      field === 'explicacion_tecnica' ||
      field === 'metodo_deteccion' ||
      field === 'referencias' ||
      field === 'componente_afectado' ||
      field === 'raw_tool_output' ||
      field === 'cve' ||
      field === 'cwe' ||
      field === 'cvss_vector'
    ) {
      patch[field] = value || undefined;
    }
  }
  return patch;
}

export function findingToMatrixGridRow(
  finding: import('@/lib/secops-api').Finding,
  asset: SecopsAsset | null | undefined,
  rowIndex: number,
  evidence?: EvidenceAttachment[]
): Record<string, string> {
  const row: Record<string, string> = { id: finding.id };
  const visibleIds = new Set([
    ...VULN_MATRIX_PRIMARY_COLUMN_IDS,
    ...VULN_MATRIX_OPTIONAL_COLUMN_IDS,
  ]);
  for (const col of VULN_MATRIX_ALL_COLUMNS) {
    if (!visibleIds.has(col.id)) continue;
    row[col.id] = getVulnMatrixCellValue(finding, asset, col.id, rowIndex, evidence);
  }
  return row;
}

function evidenceSlotValue(
  evidence: EvidenceAttachment[] | undefined,
  slot: number,
  part: 'imagen' | 'descripcion',
  finding: Finding
): string {
  const index = slot - 1;
  const item = evidence?.[index];
  if (item) {
    if (part === 'imagen') {
      return item.filename ? `Ver Imagen: ${item.filename}` : '';
    }
    return (item.description ?? '').trim();
  }
  if (slot === 1 && part === 'imagen' && finding.evidencia_url?.trim()) {
    return finding.evidencia_url.trim();
  }
  return '';
}

function parseEvidenceColumnId(
  columnId: string
): { slot: number; part: 'imagen' | 'descripcion' } | null {
  const m = columnId.match(/^evidencia_(\d)_(imagen|descripcion)$/);
  if (!m) return null;
  const slot = Number(m[1]);
  if (slot < 1 || slot > 6) return null;
  return { slot, part: m[2] as 'imagen' | 'descripcion' };
}

function meta(asset: SecopsAsset | null | undefined, key: string): string {
  return (asset?.metadata?.[key] ?? '').trim();
}

type CsvImportMeta = {
  host?: string;
  asset_group?: string;
  asset_groups?: string[];
  asset_subgroup?: string;
  asset_subgroups?: string[];
  asset_type?: string;
  seguimiento_estatus?: string;
  project?: string;
};

function formatAssetTags(primary?: string, list?: string[]): string {
  const tags = list?.length ? list : primary?.trim() ? [primary.trim()] : [];
  return tags.join(' · ');
}

function csvImportMeta(finding: Finding): CsvImportMeta {
  for (const src of finding.detection_sources ?? []) {
    if (
      src.host ||
      src.asset_group ||
      src.asset_groups?.length ||
      src.asset_subgroup ||
      src.asset_subgroups?.length ||
      src.seguimiento_estatus
    ) {
      return src;
    }
  }
  return {};
}

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function parseComponente(componente: string): {
  host: string;
  port: string;
  path: string;
} {
  const c = componente.trim();
  if (!c) return { host: '', port: '', path: '' };
  if (/^https?:\/\//i.test(c)) {
    try {
      const u = new URL(c);
      return {
        host: u.hostname,
        port: u.port || (u.protocol === 'https:' ? '443' : '80'),
        path: u.pathname + u.search,
      };
    } catch {
      return { host: c, port: '', path: '' };
    }
  }
  const m = c.match(/^([^:/]+)(?::(\d+))?(?:\/(.*))?$/);
  if (m) {
    return { host: m[1], port: m[2] ?? '', path: m[3] ? `/${m[3]}` : '' };
  }
  return { host: c, port: '', path: '' };
}

export function getVulnMatrixCellValue(
  finding: Finding,
  asset: SecopsAsset | null | undefined,
  columnId: VulnMatrixColumnId,
  rowIndex: number,
  evidence?: EvidenceAttachment[]
): string {
  const evidenceCol = parseEvidenceColumnId(columnId);
  if (evidenceCol) {
    return evidenceSlotValue(evidence, evidenceCol.slot, evidenceCol.part, finding);
  }

  const componente = resolveFindingComponente(finding);
  const parsed = parseComponente(componente);
  const importMeta = csvImportMeta(finding);
  const hostFromImport = importMeta.host?.trim() ?? '';
  const { exposure, kind } = classifyMatrixRow(finding, asset);
  const m = (key: string) => meta(asset, key);

  switch (columnId) {
    case 'folio':
      return String(rowIndex + 1);
    case 'fecha_carga':
      return formatDate(finding.created_at);
    case 'fecha_deteccion':
      return formatDate(finding.first_seen);
    case 'ultima_deteccion':
      return formatDate(finding.last_seen);
    case 'fecha_ultima_actualizacion':
      return formatDate(finding.updated_at ?? finding.created_at);
    case 'nombre_activo':
      return asset?.nombre?.trim() || hostFromImport || parsed.host || componente || '';
    case 'nombre_hallazgo':
    case 'nombre_vulnerabilidad':
    case 'nombre_estandar':
      return finding.titulo?.trim() ?? '';
    case 'descripcion':
    case 'descripcion_ampliada':
      return (finding.descripcion ?? '').trim();
    case 'evidencia_principal':
      return (finding.evidencia_url ?? '').trim();
    case 'categoria_hallazgo':
      return finding.owasp_category?.trim() ?? '';
    case 'componente_afectado':
      return componente;
    case 'severidad':
    case 'severidad_modificada':
      return finding.severidad;
    case 'estado':
      return importMeta.seguimiento_estatus?.trim() || finding.status;
    case 'metodo_deteccion':
      return (finding.metodo_deteccion ?? '').trim();
    case 'salidas_herramienta':
      return (finding.raw_tool_output ?? '').trim();
    case 'explotabilidad':
    case 'explotabilidad_comun':
      return finding.kev_listed ? 'KEV' : finding.epss_score != null ? `EPSS ${(finding.epss_score * 100).toFixed(1)}%` : '';
    case 'amenaza_ampliada':
      return (finding.amenaza_ampliada ?? '').trim();
    case 'propuesta_remediacion':
      return (finding.propuesta_remediacion ?? '').trim();
    case 'referencias':
      return (finding.referencias ?? '').trim();
    case 'tipo_analisis':
      return kind === 'app' ? 'Aplicación' : 'Infraestructura';
    case 'cve':
      return (finding.cve ?? '').trim();
    case 'explicacion_tecnica':
      return (finding.explicacion_tecnica ?? '').trim();
    case 'cwe':
      return (finding.cwe ?? '').trim();
    case 'cvss_vector':
      return (finding.cvss_vector ?? '').trim();
    case 'cvss_score':
      return finding.cvss_score != null ? String(finding.cvss_score) : '';
    case 'tipo_exposicion':
      return exposure === 'externa' ? 'Externa' : 'Interna';
    case 'ipv6_publica':
      return m('ipv6_publico');
    case 'ipv4_publica':
      return asset?.ip_publica?.trim() || m('ipv4_publico');
    case 'fqdn':
      return asset?.fqdn?.trim() || m('fqdn_publico') || m('fqdn_privado');
    case 'hostname':
      return m('hostname_privado') || m('hostname_desc') || hostFromImport || parsed.host;
    case 'ipv6_interna':
      return m('ipv6_privado');
    case 'ipv4_interna':
      return asset?.ip_privada?.trim() || m('ipv4_privado') || hostFromImport || parsed.host;
    case 'puerto':
      return parsed.port || m('puerto');
    case 'servicio':
      return m('servicio');
    case 'protocolo':
      return m('protocolo');
    case 'ruta':
      return parsed.path || m('ruta');
    case 'linea_codigo':
      return m('linea_codigo');
    case 'tipo_activo':
      return importMeta.asset_type?.trim() || asset?.asset_type?.trim() || m('tipo_recurso') || (kind === 'app' ? 'Aplicación' : 'Equipo');
    case 'grupo_activos':
      return (
        formatAssetTags(importMeta.asset_group, importMeta.asset_groups) ||
        m('grupos_activos')
      );
    case 'subgrupo_activos':
      return (
        formatAssetTags(importMeta.asset_subgroup, importMeta.asset_subgroups) ||
        m('subgrupos_activos') ||
        m('sub_grupos_activos')
      );
    case 'inventario':
      return m('nombre_inventario') || m('tipo_inventario');
    case 'ambiente':
      return asset?.ambiente?.trim() || m('entorno') || '';
    case 'critico':
      return asset?.criticidad?.trim() ?? '';
    case 'regulacion':
      return m('regulacion') || m('pci');
    case 'tipo_vulnerabilidad':
      return finding.owasp_category?.trim() ?? kind;
    case 'tipo_remediacion':
      return (finding.remediation_context ?? '').trim();
    case 'identificador_deteccion':
      return (finding.tool_vuln_id ?? '').trim();
    case 'nombre_original':
      return finding.titulo?.trim() ?? '';
    case 'tipo_origen':
      return sourceBadgeLabel(finding.tool_source);
    case 'identificador_original':
      return (finding.tool_vuln_id ?? finding.dedup_fingerprint ?? '').trim();
    case 'severidad_original':
      return finding.severidad;
    case 'identificador_vulnerabilidad':
      return finding.catalog_id != null ? String(finding.catalog_id) : (finding.tool_vuln_id ?? '');
    case 'referencias_exploits':
      return finding.kev_listed ? 'CISA KEV' : '';
    case 'conteo_deteccion':
      return finding.detection_sources?.length ? String(finding.detection_sources.length) : '1';
    case 'nombre_modificado':
      return finding.ai_summary?.trim() ?? '';
    case 'conjunto_nombres':
      return (
        importMeta.project?.trim() ||
        (finding.origin_projects ?? [])
          .map((p) => p.name)
          .filter(Boolean)
          .join('; ')
      );
    case 'tipo_redaccion_descripcion':
    case 'tipo_redaccion_amenaza':
    case 'tipo_redaccion_remediacion':
    case 'tipo_redaccion_explicacion':
      return 'texto';
    case 'origen_integracion':
      return detectionSourceLabels(finding).join(', ');
    case 'sync_status':
      return finding.sync_status ?? finding.global_status ?? '';
    default:
      return '';
  }
}

export function matrixRowMatchesSearch(
  finding: Finding,
  asset: SecopsAsset | null | undefined,
  query: string,
  rowIndex: number
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  for (const col of VULN_MATRIX_ALL_COLUMNS) {
    const v = getVulnMatrixCellValue(finding, asset, col.id, rowIndex).toLowerCase();
    if (v.includes(q)) return true;
  }
  return false;
}
