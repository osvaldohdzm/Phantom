import { getApiBaseUrl, resolveApiUrl } from '@/lib/api-base';
import { authHeaders } from '@/lib/auth-storage';
import type { EngagementProfile } from '@/lib/engagement-profile';
import type { LoadProgress } from '@/lib/eta-progress';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = resolveApiUrl(path);
  const isForm = init?.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        ...authHeaders(),
        ...(init?.headers as Record<string, string> | undefined),
      },
    });
  } catch {
    throw new Error(
      `No se pudo conectar al API (${getApiBaseUrl()}). Ejecuta ./start.sh y recarga la página.`
    );
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const detail =
      typeof data.detail === 'string'
        ? data.detail
        : Array.isArray(data.detail)
          ? data.detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join('; ')
          : res.statusText;
    throw new Error(detail || `Error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export type FindingStatus =
  | 'Identificado'
  | 'Validado'
  | 'En Proceso de Remediación'
  | 'Re-test Pendiente'
  | 'Re-test En Curso'
  | 'Cerrado'
  | 'Falso Positivo'
  | 'Riesgo Aceptado'
  | 'Atendido'
  | 'Remediado'
  | 'Reaparecido';

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';

export interface Finding {
  id: string;
  titulo: string;
  descripcion?: string | null;
  severidad: Severity;
  cvss_score?: number | null;
  cvss_vector?: string | null;
  cve?: string | null;
  cwe?: string | null;
  evidencia_url?: string | null;
  status: FindingStatus;
  explicacion_tecnica?: string | null;
  amenaza_ampliada?: string | null;
  owasp_category?: string | null;
  mitre_technique_id?: string | null;
  raw_tool_output?: string | null;
  componente_afectado?: string | null;
  metodo_deteccion?: string | null;
  tool_source?: string | null;
  tool_vuln_id?: string | null;
  propuesta_remediacion?: string | null;
  referencias?: string | null;
  epss_score?: number | null;
  kev_listed?: boolean;
  asset_id?: string | null;
  engagement_id?: string | null;
  catalog_id?: number | null;
  created_at: string;
  updated_at?: string | null;
  first_seen?: string | null;
  last_seen?: string | null;
  origin_projects?: Array<{
    engagement_id?: string | null;
    name?: string;
    first_seen?: string;
    last_seen?: string;
  }> | null;
  detection_sources?: Array<{
    source?: string;
    tool?: string;
    at?: string;
    vulns_catalog_id?: string;
    host?: string;
    asset_group?: string;
    asset_groups?: string[];
    asset_subgroup?: string;
    asset_subgroups?: string[];
    asset_type?: string;
    seguimiento_estatus?: string;
    project?: string;
  }> | null;
  sync_status?: string | null;
  global_status?: string | null;
  ai_summary?: string | null;
  ai_group_id?: string | null;
  remediation_context?: string | null;
  dedup_fingerprint?: string | null;
  lifecycle_history?: Array<{
    at: string;
    type: string;
    detail?: string | Record<string, unknown> | null;
    actor?: string | null;
  }> | null;
}

export interface SuggestedFinding {
  titulo: string;
  severidad: Severity;
  descripcion: string;
  amenaza_ampliada: string;
  propuesta_remediacion: string;
  referencias: string;
  componente_afectado: string;
  metodo_deteccion: string;
  explicacion_tecnica: string;
  raw_snippet?: string;
  cve?: string;
  cwe?: string;
  cvss_score?: number;
}

export interface Engagement {
  id: string;
  cliente: string;
  nombre_proyecto?: string | null;
  estado?: string | null;
  responsable?: string | null;
  tipo_servicio?: string | null;
  fecha_inicio: string;
  fecha_fin?: string | null;
  tipo: string;
  profile?: EngagementProfile;
}

export type EngagementCreateBody = {
  cliente: string;
  nombre_proyecto?: string;
  estado?: string;
  responsable?: string;
  tipo_servicio?: string;
  fecha_inicio: string;
  fecha_fin?: string;
  tipo: string;
  profile?: EngagementProfile;
};

export type EngagementUpdateBody = Partial<EngagementCreateBody>;

export interface DocxTemplate {
  id: string;
  name: string;
  description?: string | null;
  placeholders?: string[] | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GenerateReportResult {
  job_id: string;
  status: string;
  findings_count: number;
  consolidated_download_url: string;
  individual_count: number;
  message: string;
}

export interface ReportJobHistoryItem {
  id: string;
  engagement_id?: string | null;
  template_id?: string | null;
  report_kind?: 'vulnerability_tables' | 'findings_table';
  template_name: string;
  status: string;
  findings_count: number;
  individual_count: number;
  grouped_rows?: number | null;
  created_at: string;
  completed_at?: string | null;
  consolidated_download_url?: string | null;
  error_message?: string | null;
}

export interface GenerateFindingsTableResult {
  job_id: string;
  status: string;
  findings_count: number;
  grouped_rows: number;
  download_url: string;
  message: string;
}

const STATUS_KEYS: Record<string, string> = {
  Identificado: 'abierta',
  Validado: 'validada',
  'En Proceso de Remediación': 'en_proceso',
  'Re-test Pendiente': 'retest_pendiente',
  'Re-test En Curso': 'retest_en_curso',
  Cerrado: 'cerrado',
  'Falso Positivo': 'falso_positivo',
  'Riesgo Aceptado': 'riesgo_aceptado',
  Atendido: 'atendido',
  Remediado: 'remediado',
  Reaparecido: 'reaparecido',
};

export function statusToApiKey(status: FindingStatus): string {
  return STATUS_KEYS[status] ?? 'abierta';
}

export const FINDINGS_LIST_PAGE_SIZE = 5000;
export const FINDINGS_LIST_MAX = 100_000;
export const FINDINGS_UI_PAGE_SIZES = [25, 50, 100, 250, 500] as const;
export const FINDINGS_UI_PAGE_SIZE_ALL = 'all' as const;
export type FindingsUiPageSize =
  | (typeof FINDINGS_UI_PAGE_SIZES)[number]
  | typeof FINDINGS_UI_PAGE_SIZE_ALL;

export type FindingsPageSizeOption = {
  value: FindingsUiPageSize;
  label: string;
};

export const FINDINGS_UI_PAGE_SIZE_OPTIONS: FindingsPageSizeOption[] = [
  ...FINDINGS_UI_PAGE_SIZES.map((n) => ({ value: n, label: String(n) })),
  { value: FINDINGS_UI_PAGE_SIZE_ALL, label: 'Todos' },
];

export const FINDINGS_UI_PAGE_SIZE_DEFAULT: FindingsUiPageSize = 50;
export const FINDINGS_UI_PAGE_SIZE_KEY = 'spectre.findings.ui-page-size';
/** @deprecated Usar loadFindingsPageSize() */
export const FINDINGS_UI_PAGE_SIZE = FINDINGS_UI_PAGE_SIZE_DEFAULT;

export function isAllPageSize(size: FindingsUiPageSize): size is typeof FINDINGS_UI_PAGE_SIZE_ALL {
  return size === FINDINGS_UI_PAGE_SIZE_ALL;
}

export function pageSizeLabel(size: FindingsUiPageSize): string {
  return isAllPageSize(size) ? 'Todos' : String(size);
}

export function resolveFindingsListPaging(
  page: number,
  pageSize: FindingsUiPageSize,
  total: number
): { skip: number; limit: number } {
  if (isAllPageSize(pageSize)) {
    return { skip: 0, limit: Math.max(total, 1) };
  }
  return { skip: (page - 1) * pageSize, limit: pageSize };
}

export type FindingsOrderBy =
  | 'created_at_desc'
  | 'created_at_asc'
  | 'severidad_asc'
  | 'severidad_desc';

export function loadFindingsPageSize(): FindingsUiPageSize {
  if (typeof window === 'undefined') return FINDINGS_UI_PAGE_SIZE_DEFAULT;
  const raw = localStorage.getItem(FINDINGS_UI_PAGE_SIZE_KEY);
  if (raw === FINDINGS_UI_PAGE_SIZE_ALL) return FINDINGS_UI_PAGE_SIZE_ALL;
  const n = parseInt(raw || '', 10);
  return (FINDINGS_UI_PAGE_SIZES as readonly number[]).includes(n)
    ? (n as FindingsUiPageSize)
    : FINDINGS_UI_PAGE_SIZE_DEFAULT;
}

export function saveFindingsPageSize(size: FindingsUiPageSize): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FINDINGS_UI_PAGE_SIZE_KEY, String(size));
}

export type ProjectSummary = {
  total_findings: number;
  total_excluding_info: number;
  unique_components: number;
  unique_hosts: number;
  component_occurrences: number;
  grouped_vulnerability_count: number;
  grouped_vulnerability_count_excluding_info: number;
  grouped_component_total: number;
  by_severity: Record<string, number>;
  by_severity_excluding_info: Record<string, number>;
  compression_ratio: number;
  vulnerability_breakdown: Array<{
    titulo: string;
    severidad: string;
    member_count: number;
    component_count: number;
  }>;
  duplicates: {
    group_count: number;
    remove_count: number;
    groups_preview: Array<{
      key: string;
      titulo: string;
      componente: string;
      keep_id: string;
      remove_ids: string[];
      total_in_group: number;
    }>;
  };
};

export async function fetchProjectSummary(engagementId: string): Promise<ProjectSummary> {
  return apiFetch<ProjectSummary>(
    `/api/v1/findings/project-summary?engagement_id=${encodeURIComponent(engagementId)}`
  );
}

export async function deduplicateFindingsEngagement(
  engagementId: string
): Promise<{ deleted_count: number; group_count: number }> {
  return apiFetch(
    `/api/v1/findings/deduplicate?engagement_id=${encodeURIComponent(engagementId)}`,
    { method: 'POST' }
  );
}

export async function countFindings(params?: {
  engagement_id?: string;
  status?: string;
  severidad?: Severity;
  severidades?: Severity[];
  q?: string;
  tool_source?: string;
}): Promise<number> {
  const q = new URLSearchParams();
  if (params?.engagement_id) q.set('engagement_id', params.engagement_id);
  if (params?.status) q.set('status', params.status);
  if (params?.severidad) q.set('severidad', params.severidad);
  if (params?.severidades?.length) q.set('severidades', params.severidades.join(','));
  if (params?.q?.trim()) q.set('q', params.q.trim());
  if (params?.tool_source?.trim()) q.set('tool_source', params.tool_source.trim());
  const qs = q.toString();
  const data = await apiFetch<{ total: number }>(`/api/v1/findings/count${qs ? `?${qs}` : ''}`);
  return data.total ?? 0;
}

export interface FindingsSeverityBreakdown {
  total: number;
  by_severity: Record<Severity, number>;
}

export async function fetchFindingsSeverityBreakdown(
  params?: {
    engagement_id?: string;
    status?: string;
    q?: string;
    tool_source?: string;
  },
  signal?: AbortSignal,
): Promise<FindingsSeverityBreakdown> {
  const q = new URLSearchParams();
  if (params?.engagement_id) q.set('engagement_id', params.engagement_id);
  if (params?.status) q.set('status', params.status);
  if (params?.q?.trim()) q.set('q', params.q.trim());
  if (params?.tool_source?.trim()) q.set('tool_source', params.tool_source.trim());
  const qs = q.toString();
  const data = await apiFetch<{ total: number; by_severity?: Partial<Record<Severity, number>> }>(
    `/api/v1/findings/severity-breakdown${qs ? `?${qs}` : ''}`,
    signal ? { signal } : undefined,
  );
  const empty: Record<Severity, number> = { Critical: 0, High: 0, Medium: 0, Low: 0, Info: 0 };
  return {
    total: data.total ?? 0,
    by_severity: { ...empty, ...(data.by_severity ?? {}) },
  };
}

export type FindingsListProjection = 'full' | 'matrix';

export async function listFindings(params?: {
  engagement_id?: string;
  status?: string;
  severidad?: Severity;
  severidades?: Severity[];
  limit?: number;
  skip?: number;
  q?: string;
  tool_source?: string;
  order_by?: FindingsOrderBy;
  projection?: FindingsListProjection;
  signal?: AbortSignal;
}): Promise<Finding[]> {
  const q = new URLSearchParams();
  if (params?.engagement_id) q.set('engagement_id', params.engagement_id);
  if (params?.status) q.set('status', params.status);
  if (params?.severidad) q.set('severidad', params.severidad);
  if (params?.severidades?.length) q.set('severidades', params.severidades.join(','));
  if (params?.limit != null) q.set('limit', String(params.limit));
  if (params?.skip != null) q.set('skip', String(params.skip));
  if (params?.q?.trim()) q.set('q', params.q.trim());
  if (params?.tool_source?.trim()) q.set('tool_source', params.tool_source.trim());
  if (params?.order_by) q.set('order_by', params.order_by);
  if (params?.projection === 'matrix') q.set('projection', 'matrix');
  const qs = q.toString();
  return apiFetch<Finding[]>(
    `/api/v1/findings${qs ? `?${qs}` : ''}`,
    params?.signal ? { signal: params.signal } : undefined
  );
}

/** Carga todos los hallazgos de un proyecto (paginado en el servidor). */
export async function listAllFindingsForEngagement(
  engagementId: string,
  options?: {
    severidad?: Severity;
    severidades?: Severity[];
    status?: string;
    q?: string;
    onProgress?: (p: LoadProgress) => void;
  }
): Promise<{ findings: Finding[]; totalInDb: number; truncated: boolean }> {
  options?.onProgress?.({ phase: 'counting', loaded: 0, total: 0, label: 'Contando hallazgos…' });
  const totalInDb = await countFindings({
    engagement_id: engagementId,
    severidad: options?.severidad,
    severidades: options?.severidades,
    status: options?.status,
    q: options?.q,
  });

  const cap = Math.min(totalInDb, FINDINGS_LIST_MAX);
  const findings: Finding[] = [];
  let skip = 0;

  while (skip < totalInDb && findings.length < FINDINGS_LIST_MAX) {
    const batch = await listFindings({
      engagement_id: engagementId,
      severidad: options?.severidad,
      severidades: options?.severidades,
      status: options?.status,
      q: options?.q,
      limit: FINDINGS_LIST_PAGE_SIZE,
      skip,
    });
    if (!batch.length) break;
    findings.push(...batch);
    skip += batch.length;
    options?.onProgress?.({
      phase: 'fetching',
      loaded: findings.length,
      total: cap,
      label: `Lote ${Math.ceil(skip / FINDINGS_LIST_PAGE_SIZE)} · ${FINDINGS_LIST_PAGE_SIZE.toLocaleString()} filas/página`,
    });
    if (batch.length < FINDINGS_LIST_PAGE_SIZE) break;
  }

  return {
    findings,
    totalInDb,
    truncated: findings.length < totalInDb,
  };
}

/** Carga hallazgos del repositorio global (sin filtrar por proyecto). */
export async function listAllFindingsInRepository(options?: {
  severidad?: Severity;
  severidades?: Severity[];
  status?: string;
  q?: string;
  tool_source?: string;
  onProgress?: (p: LoadProgress) => void;
}): Promise<{ findings: Finding[]; totalInDb: number; truncated: boolean }> {
  options?.onProgress?.({ phase: 'counting', loaded: 0, total: 0, label: 'Contando repositorio…' });
  const totalInDb = await countFindings({
    severidad: options?.severidad,
    severidades: options?.severidades,
    status: options?.status,
    q: options?.q,
    tool_source: options?.tool_source,
  });

  const cap = Math.min(totalInDb, FINDINGS_LIST_MAX);
  const findings: Finding[] = [];
  let skip = 0;

  while (skip < totalInDb && findings.length < FINDINGS_LIST_MAX) {
    const batch = await listFindings({
      severidad: options?.severidad,
      severidades: options?.severidades,
      status: options?.status,
      q: options?.q,
      tool_source: options?.tool_source,
      limit: FINDINGS_LIST_PAGE_SIZE,
      skip,
    });
    if (!batch.length) break;
    findings.push(...batch);
    skip += batch.length;
    options?.onProgress?.({
      phase: 'fetching',
      loaded: findings.length,
      total: cap,
      label: `Descargando ${findings.length.toLocaleString()} de ${cap.toLocaleString()} (máx. ${FINDINGS_LIST_MAX.toLocaleString()})`,
    });
    if (batch.length < FINDINGS_LIST_PAGE_SIZE) break;
  }

  return {
    findings,
    totalInDb,
    truncated: findings.length < totalInDb,
  };
}

/** Páginas en vuelo simultáneas al transmitir el repositorio. */
export const FINDINGS_STREAM_CONCURRENCY = 10;

export type FindingsStreamInfo = {
  loaded: number;
  cap: number;
  total: number;
};

export type FindingsStreamResult = {
  totalInDb: number;
  loaded: number;
  truncated: boolean;
};

/**
 * Transmite los hallazgos del repositorio en lotes paralelos, entregando cada
 * lote a `onBatch` en cuanto llega. A diferencia de `listAllFindingsInRepository`
 * (que descarga todo de forma secuencial antes de resolver), esto permite a la UI
 * renderizar las primeras filas en segundos y seguir poblando la tabla mientras
 * el resto se descarga en paralelo. Soporta cancelación vía `AbortSignal`.
 */
export async function streamAllFindingsInRepository(options: {
  severidad?: Severity;
  severidades?: Severity[];
  status?: string;
  q?: string;
  tool_source?: string;
  projection?: FindingsListProjection;
  concurrency?: number;
  signal?: AbortSignal;
  onBatch: (batch: Finding[], info: FindingsStreamInfo) => void;
  onProgress?: (p: LoadProgress) => void;
}): Promise<FindingsStreamResult> {
  const { onBatch, onProgress, signal } = options;
  const projection = options.projection ?? 'matrix';
  const throwIfAborted = () => {
    if (signal?.aborted) throw new DOMException('Carga cancelada', 'AbortError');
  };

  onProgress?.({ phase: 'counting', loaded: 0, total: 0, label: 'Contando repositorio…' });
  const totalInDb = await countFindings({
    severidad: options.severidad,
    severidades: options.severidades,
    status: options.status,
    q: options.q,
    tool_source: options.tool_source,
  });
  throwIfAborted();

  const cap = Math.min(totalInDb, FINDINGS_LIST_MAX);
  if (cap <= 0) {
    onProgress?.({ phase: 'fetching', loaded: 0, total: 0, label: 'Repositorio vacío' });
    return { totalInDb, loaded: 0, truncated: false };
  }

  const offsets: number[] = [];
  for (let skip = 0; skip < cap; skip += FINDINGS_LIST_PAGE_SIZE) offsets.push(skip);

  const concurrency = Math.max(1, Math.min(options.concurrency ?? FINDINGS_STREAM_CONCURRENCY, offsets.length));
  let nextIndex = 0;
  let loaded = 0;

  const worker = async () => {
    for (;;) {
      throwIfAborted();
      const i = nextIndex;
      nextIndex += 1;
      if (i >= offsets.length) return;
      const batch = await listFindings({
        severidad: options.severidad,
        severidades: options.severidades,
        status: options.status,
        q: options.q,
        tool_source: options.tool_source,
        projection,
        limit: FINDINGS_LIST_PAGE_SIZE,
        skip: offsets[i],
        signal,
      });
      throwIfAborted();
      loaded += batch.length;
      onBatch(batch, { loaded, cap, total: totalInDb });
      onProgress?.({
        phase: 'fetching',
        loaded,
        total: cap,
        label: `Descargando ${loaded.toLocaleString()} de ${cap.toLocaleString()} · ${concurrency} en paralelo`,
      });
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  return { totalInDb, loaded, truncated: loaded < totalInDb };
}

export type FindingTypeGroup = {
  key: string;
  titulo: string;
  severidad: Severity;
  tool_label: string;
  instance_count: number;
  member_ids: string[];
  representative: Finding;
};

export type FindingTypeGroupsResult = {
  groups: FindingTypeGroup[];
  total_findings: number;
  total_types: number;
};

/**
 * Agrega hallazgos por tipo de vulnerabilidad en el servidor (un representante por
 * tipo). Reemplaza la descarga de decenas de miles de hallazgos completos en la
 * fase "Revisión por tipo": solo viajan los representantes + conteos + ids miembro.
 */
export async function listFindingTypeGroups(params?: {
  engagement_id?: string;
  severidad?: Severity;
  severidades?: Severity[];
  status?: string;
  q?: string;
  tool_source?: string;
  include_member_ids?: boolean;
}): Promise<FindingTypeGroupsResult> {
  const qs = new URLSearchParams();
  if (params?.engagement_id) qs.set('engagement_id', params.engagement_id);
  if (params?.severidad) qs.set('severidad', params.severidad);
  if (params?.severidades?.length) qs.set('severidades', params.severidades.join(','));
  if (params?.status) qs.set('status', params.status);
  if (params?.q?.trim()) qs.set('q', params.q.trim());
  if (params?.tool_source?.trim()) qs.set('tool_source', params.tool_source.trim());
  if (params?.include_member_ids === false) qs.set('include_member_ids', 'false');
  const query = qs.toString();
  return apiFetch<FindingTypeGroupsResult>(
    `/api/v1/findings/grouped-by-type${query ? `?${query}` : ''}`
  );
}

export async function bulkDeleteFindings(
  ids: string[]
): Promise<{ deleted_count: number; finding_ids: string[] }> {
  return apiFetch('/api/v1/findings/bulk-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ finding_ids: ids }),
  });
}

export async function bulkDeleteFindingsByQuery(params: {
  engagement_id?: string;
  /** Borra a nivel repositorio (sin engagement); requerido si no hay engagement_id. */
  repository?: boolean;
  severidad?: Severity;
  severidades?: Severity[];
  q?: string;
  tool_source?: string;
}): Promise<{ deleted_count: number }> {
  return apiFetch('/api/v1/findings/bulk-delete-by-query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      engagement_id: params.engagement_id,
      repository: params.repository || undefined,
      severidad: params.severidad,
      severidades: params.severidades?.length ? params.severidades.join(',') : undefined,
      q: params.q?.trim() || undefined,
      tool_source: params.tool_source?.trim() || undefined,
    }),
  });
}

export async function publishFindingsToRepository(
  engagementId: string
): Promise<{ published_count: number; message?: string }> {
  return apiFetch('/api/v1/findings/publish-to-repository', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ engagement_id: engagementId }),
  });
}

export type AssetGroup = {
  id: string;
  nombre: string;
  descripcion?: string | null;
  color?: string | null;
  asset_ids: string[];
};

export async function listAssetGroups(): Promise<AssetGroup[]> {
  return apiFetch('/api/v1/asset-groups');
}

const BULK_DELETE_BATCH = 500;

/** Elimina muchos IDs en lotes para no saturar la petición. */
export async function bulkDeleteFindingsBatched(ids: string[]): Promise<number> {
  let deleted = 0;
  for (let i = 0; i < ids.length; i += BULK_DELETE_BATCH) {
    const chunk = ids.slice(i, i + BULK_DELETE_BATCH);
    const result = await bulkDeleteFindings(chunk);
    deleted += result.deleted_count;
  }
  return deleted;
}

/** Elimina todos los hallazgos del tenant (repositorio), respetando filtros opcionales. */
export async function deleteAllFindingsInRepository(options?: {
  tool_source?: string;
  onProgress?: (p: LoadProgress) => void;
}): Promise<number> {
  options?.onProgress?.({ phase: 'counting', loaded: 0, total: 0, label: 'Contando hallazgos a eliminar…' });
  const initialTotal = await countFindings({ tool_source: options?.tool_source });
  if (initialTotal <= 0) return 0;

  let totalDeleted = 0;
  for (;;) {
    const remaining = await countFindings({ tool_source: options?.tool_source });
    if (remaining <= 0) break;
    const batch = await listFindings({
      tool_source: options?.tool_source,
      limit: BULK_DELETE_BATCH,
      skip: 0,
    });
    if (!batch.length) break;
    const deleted = await bulkDeleteFindingsBatched(batch.map((f) => f.id));
    totalDeleted += deleted;
    options?.onProgress?.({
      phase: 'deleting',
      loaded: totalDeleted,
      total: initialTotal,
      label: `Eliminados ${totalDeleted.toLocaleString()} de ~${initialTotal.toLocaleString()}`,
    });
    if (deleted === 0) break;
  }
  return totalDeleted;
}

export async function repairFindingsText(
  engagementId: string
): Promise<{ repaired_count: number; total: number }> {
  return apiFetch(`/api/v1/findings/repair-text?engagement_id=${encodeURIComponent(engagementId)}`, {
    method: 'POST',
  });
}

export type SyncFromCatalogResult = {
  synced: number;
  skipped: number;
  total: number;
  errors: string[];
};

export async function getFinding(id: string): Promise<Finding> {
  return apiFetch<Finding>(`/api/v1/findings/${encodeURIComponent(id)}`);
}

export async function syncFindingsFromCatalogApi(body: {
  engagement_id?: string;
  finding_ids?: string[];
  catalog_id?: string;
  only_validated?: boolean;
}): Promise<SyncFromCatalogResult> {
  return apiFetch<SyncFromCatalogResult>('/api/v1/findings/sync-from-catalog', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export type ConsolidateMasterCatalogResult = {
  synced: number;
  skipped: number;
  total: number;
  groups: number;
  errors: string[];
  details?: Record<string, number>;
};

export async function consolidateMasterCatalogApi(body: {
  engagement_id?: string;
  finding_ids?: string[];
}): Promise<ConsolidateMasterCatalogResult> {
  return apiFetch<ConsolidateMasterCatalogResult>('/api/v1/findings/consolidate-master-catalog', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function assignAiGroupsEngagement(
  engagementId: string
): Promise<{ assigned: number; groups_created: number }> {
  return apiFetch<{ assigned: number; groups_created: number }>(
    `/api/v1/findings/assign-ai-groups?engagement_id=${encodeURIComponent(engagementId)}`,
    { method: 'POST' }
  );
}

export async function createFinding(body: {
  titulo: string;
  descripcion?: string;
  severidad?: Severity;
  cve?: string;
  cwe?: string;
  cvss_score?: number;
  engagement_id?: string;
  raw_tool_output?: string;
  explicacion_tecnica?: string;
  amenaza_ampliada?: string;
  componente_afectado?: string;
  metodo_deteccion?: string;
  propuesta_remediacion?: string;
  referencias?: string;
}): Promise<Finding> {
  return apiFetch<Finding>('/api/v1/findings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function updateFinding(
  id: string,
  body: Partial<{
    titulo: string;
    descripcion: string;
    severidad: Severity;
    cve: string;
    cwe: string;
    cvss_score: number;
    engagement_id: string;
    raw_tool_output: string;
    explicacion_tecnica: string;
    amenaza_ampliada: string;
    componente_afectado: string;
    metodo_deteccion: string;
    propuesta_remediacion: string;
    referencias: string;
    seguimiento_estatus?: string;
  }>
): Promise<Finding> {
  return apiFetch<Finding>(`/api/v1/findings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function updateFindingStatus(
  id: string,
  status: string,
  notes?: string
): Promise<Finding> {
  return apiFetch<Finding>(`/api/v1/findings/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, notes }),
  });
}

const BULK_STATUS_BATCH = 12;

export async function bulkUpdateFindingStatus(
  ids: string[],
  status: FindingStatus,
  notes?: string
): Promise<{ updated: number; errors: string[] }> {
  const errors: string[] = [];
  let updated = 0;
  for (let i = 0; i < ids.length; i += BULK_STATUS_BATCH) {
    const chunk = ids.slice(i, i + BULK_STATUS_BATCH);
    const results = await Promise.allSettled(
      chunk.map((id) => updateFindingStatus(id, status, notes))
    );
    for (const r of results) {
      if (r.status === 'fulfilled') updated += 1;
      else {
        errors.push(r.reason instanceof Error ? r.reason.message : 'Error al actualizar estado');
      }
    }
  }
  return { updated, errors };
}

export async function bulkValidateFindings(ids: string[], notes?: string): Promise<Finding[]> {
  return apiFetch<Finding[]>('/api/v1/findings/bulk-validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ finding_ids: ids, notes }),
  });
}

export async function enrichFinding(id: string): Promise<void> {
  await apiFetch(`/api/v1/findings/${id}/ai-enrich`, { method: 'POST' });
}

export async function listEngagements(options?: { includeInternal?: boolean }): Promise<Engagement[]> {
  const q = options?.includeInternal ? '?include_internal=true' : '';
  return apiFetch<Engagement[]>(`/api/v1/engagements${q}`);
}

export interface PlatformStats {
  findings_total: number;
  findings_open: number;
  findings_critical_open: number;
  engagements_total: number;
  assets_total: number;
  by_severity: Record<string, number>;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  return apiFetch<PlatformStats>('/api/v1/findings/stats/platform');
}

export interface SecopsAsset {
  id: string;
  nombre: string;
  ip_publica?: string | null;
  ip_privada?: string | null;
  fqdn?: string | null;
  criticidad?: string | null;
  ambiente: string;
  os?: string | null;
  asset_type?: string | null;
  owner?: string | null;
  location?: string | null;
  discovery_method?: string | null;
  is_in_scope: boolean;
  source_type?: AssetSourceType;
  engagement_id?: string | null;
  metadata?: Record<string, string>;
}

export type AssetSourceType =
  | 'inventory'
  | 'external_recon'
  | 'external_attack_surface'
  | 'internal_recon'
  | 'internal_attack_surface';

export async function listAssets(params?: {
  source_type?: AssetSourceType;
  engagement_id?: string;
  limit?: number;
}): Promise<SecopsAsset[]> {
  const q = new URLSearchParams();
  if (params?.source_type) q.set('source_type', params.source_type);
  if (params?.engagement_id) q.set('engagement_id', params.engagement_id);
  const safeLimit = Math.min(Math.max(params?.limit ?? 500, 1), 5000);
  q.set('limit', String(safeLimit));
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return apiFetch<SecopsAsset[]>(`/api/v1/assets${suffix}`);
}

/** Carga inventario completo (máx. 5000 por petición API). */
export async function listAllAssets(): Promise<SecopsAsset[]> {
  return listAssets({ limit: 5000 });
}

export async function bulkUpsertAssets(body: {
  rows: Array<{
    id?: string;
    nombre: string;
    source_type: AssetSourceType;
    engagement_id?: string | null;
    metadata?: Record<string, string>;
    ip_publica?: string;
    ip_privada?: string;
    fqdn?: string;
    criticidad?: string;
    ambiente?: string;
    os?: string;
    asset_type?: string;
    owner?: string;
    location?: string;
    discovery_method?: string;
    is_in_scope?: boolean;
  }>;
  delete_ids?: string[];
}): Promise<{ created: number; updated: number; deleted: number; rows: SecopsAsset[] }> {
  return apiFetch('/api/v1/assets/bulk-upsert', {
    method: 'POST',
    body: JSON.stringify({
      rows: body.rows,
      delete_ids: body.delete_ids ?? [],
    }),
  });
}

export async function createAsset(body: {
  nombre: string;
  ip_publica?: string;
  ip_privada?: string;
  fqdn?: string;
  criticidad?: string;
  ambiente?: string;
  os?: string;
  asset_type?: string;
  source_type?: AssetSourceType;
  engagement_id?: string;
  metadata?: Record<string, string>;
}): Promise<SecopsAsset> {
  return apiFetch<SecopsAsset>('/api/v1/assets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ambiente: 'Prod',
      is_in_scope: true,
      source_type: 'inventory',
      metadata: {},
      ...body,
    }),
  });
}

export async function deleteAsset(id: string): Promise<void> {
  await apiFetch(`/api/v1/assets/${id}`, { method: 'DELETE' });
}

export type AssetScanTarget = {
  id: string;
  target_key: string;
  display_name: string;
  componente_afectado: string;
  tool_sources: string[];
  finding_count: number;
  status: 'pending' | 'accepted' | 'passed';
  target_source_type?: string | null;
  promoted_asset_id?: string | null;
  engagement_id?: string | null;
};

export async function listAssetScanTargets(params?: {
  status?: 'pending' | 'accepted' | 'passed' | 'all';
  engagement_id?: string;
}): Promise<AssetScanTarget[]> {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.engagement_id) q.set('engagement_id', params.engagement_id);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return apiFetch<AssetScanTarget[]>(`/api/v1/assets/scan-targets${suffix}`);
}

export async function refreshAssetScanTargets(engagement_id?: string): Promise<{
  discovered: number;
  pending: number;
  message?: string;
}> {
  const q = engagement_id ? `?engagement_id=${encodeURIComponent(engagement_id)}` : '';
  return apiFetch(`/api/v1/assets/scan-targets/refresh${q}`, { method: 'POST' });
}

export async function promoteAssetScanTargets(body: {
  target_ids: string[];
  source_type: AssetSourceType;
  engagement_id?: string | null;
}): Promise<{ processed: number; asset_ids: string[]; message?: string }> {
  return apiFetch('/api/v1/assets/scan-targets/promote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function passAssetScanTargets(target_ids: string[]): Promise<{
  processed: number;
  message?: string;
}> {
  return apiFetch('/api/v1/assets/scan-targets/pass', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_ids }),
  });
}

export interface ComplianceControlRow {
  id: string;
  framework: string;
  control_id: string;
  control_name: string;
  description?: string | null;
  category?: string | null;
}

export async function listComplianceFrameworks(): Promise<string[]> {
  return apiFetch<string[]>('/api/v1/compliance/frameworks');
}

export async function listComplianceControls(params?: {
  framework?: string;
}): Promise<ComplianceControlRow[]> {
  const q = new URLSearchParams();
  if (params?.framework) q.set('framework', params.framework);
  const qs = q.toString();
  return apiFetch<ComplianceControlRow[]>(`/api/v1/compliance/controls${qs ? `?${qs}` : ''}`);
}

export async function getEngagement(id: string): Promise<Engagement> {
  return apiFetch<Engagement>(`/api/v1/engagements/${id}`);
}

export async function createEngagement(body: EngagementCreateBody): Promise<Engagement> {
  return apiFetch<Engagement>('/api/v1/engagements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function updateEngagement(
  id: string,
  body: EngagementUpdateBody
): Promise<Engagement> {
  return apiFetch<Engagement>(`/api/v1/engagements/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteEngagement(id: string): Promise<void> {
  await apiFetch(`/api/v1/engagements/${id}`, { method: 'DELETE' });
}

export async function suggestFindingField(
  field: string,
  rawOutput: string,
  context?: string,
  currentValues?: Record<string, unknown>
): Promise<{ value: string | string[]; source: string }> {
  const res = await fetch('/api/ai/suggest-finding-field', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field, rawOutput, context, currentValues }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al sugerir campo');
  return data;
}

export async function suggestFindingFields(
  rawOutput: string,
  context?: string,
  options?: { mode?: 'auto' | 'structured' | 'gemini' }
): Promise<{ suggestion: SuggestedFinding; source: string; warning?: string; filledFields?: string[] }> {
  const res = await fetch('/api/ai/suggest-finding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawOutput, context, mode: options?.mode ?? 'auto' }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al sugerir campos');
  return data;
}

export async function splitFindingsFromRaw(
  rawOutput: string,
  context?: string
): Promise<{
  findings: (SuggestedFinding & { raw_snippet?: string })[];
  source: string;
  count: number;
  warning?: string;
}> {
  const res = await fetch('/api/ai/split-findings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawOutput, context }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al separar hallazgos');
  return data;
}

export async function listDocxTemplates(): Promise<DocxTemplate[]> {
  return apiFetch<DocxTemplate[]>('/api/v1/docx-templates');
}

export async function uploadDocxTemplate(
  file: File,
  name: string,
  description?: string
): Promise<DocxTemplate> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('name', name);
  if (description) fd.append('description', description);
  let res: Response;
  try {
    res = await fetch(resolveApiUrl('/api/v1/docx-templates'), {
      method: 'POST',
      headers: authHeaders(),
      body: fd,
    });
  } catch {
    throw new Error(
      `No se pudo conectar al API (${getApiBaseUrl()}). Ejecuta ./start.sh y recarga la página.`
    );
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.detail === 'string' ? data.detail : 'Error al subir plantilla');
  }
  return res.json();
}

export async function deleteDocxTemplate(
  id: string
): Promise<{ deleted: boolean; jobs_removed?: number }> {
  return apiFetch<{ deleted: boolean; jobs_removed?: number }>(
    `/api/v1/docx-templates/${id}`,
    { method: 'DELETE' }
  );
}

export async function generateDocxReport(body: {
  template_id: string;
  engagement_id?: string;
  finding_ids?: string[];
  only_validated?: boolean;
}): Promise<GenerateReportResult> {
  return apiFetch<GenerateReportResult>('/api/v1/docx-templates/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export interface ReportJobDetail {
  id: string;
  status: string;
  findings_count: number;
  individual_paths?: string[] | null;
  error_message?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export async function getReportJob(jobId: string): Promise<ReportJobDetail> {
  return apiFetch<ReportJobDetail>(`/api/v1/docx-templates/jobs/${jobId}`);
}

export async function waitForReportJob(
  jobId: string,
  options?: { pollMs?: number; onStatus?: (job: ReportJobDetail) => void }
): Promise<ReportJobDetail> {
  const pollMs = options?.pollMs ?? 2000;
  for (;;) {
    const job = await getReportJob(jobId);
    options?.onStatus?.(job);
    if (job.status === 'completed') return job;
    if (job.status === 'failed') {
      throw new Error(job.error_message || 'Error al generar reporte');
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

export function reportDownloadUrl(path: string): string {
  return resolveApiUrl(path);
}

export async function listReportJobs(engagementId?: string): Promise<ReportJobHistoryItem[]> {
  const qs = engagementId ? `?engagement_id=${encodeURIComponent(engagementId)}` : '';
  return apiFetch<ReportJobHistoryItem[]>(`/api/v1/docx-templates/jobs${qs}`);
}

export async function deleteReportJob(jobId: string): Promise<void> {
  await apiFetch(`/api/v1/docx-templates/jobs/${jobId}`, { method: 'DELETE' });
}

export async function generateFindingsTable(body: {
  engagement_id?: string;
  finding_ids?: string[];
  only_validated?: boolean;
}): Promise<GenerateFindingsTableResult> {
  return apiFetch<GenerateFindingsTableResult>('/api/v1/reports/findings-table', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export interface EvidenceAttachment {
  id: string;
  finding_id: string;
  attachment_type: string;
  filename: string;
  mime_type: string;
  file_path: string;
  file_hash: string;
  description?: string | null;
  uploaded_by: string;
  uploaded_at: string;
}

export function evidenceFileUrl(findingId: string, evidenceId: string): string {
  return resolveApiUrl(`/api/v1/findings/${findingId}/evidence/${evidenceId}/file`);
}

export async function listEvidence(findingId: string): Promise<EvidenceAttachment[]> {
  return apiFetch<EvidenceAttachment[]>(`/api/v1/findings/${findingId}/evidence`);
}

export async function uploadEvidence(
  findingId: string,
  file: File,
  attachmentType: 'screenshot' | 'console_log' | 'file' = 'screenshot',
  description?: string
): Promise<EvidenceAttachment> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('attachment_type', attachmentType);
  if (description) fd.append('description', description);
  const res = await fetch(resolveApiUrl(`/api/v1/findings/${findingId}/evidence`), {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.detail === 'string' ? data.detail : 'Error al subir evidencia');
  }
  return res.json();
}

export async function deleteEvidence(findingId: string, evidenceId: string): Promise<void> {
  await apiFetch(`/api/v1/findings/${findingId}/evidence/${evidenceId}`, { method: 'DELETE' });
}
