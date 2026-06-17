import {
  getFinding,
  syncFindingsFromCatalogApi,
  type Finding,
  type Severity,
} from '@/lib/secops-api';
import { catalogColumnForSource, normalizeToolSource } from '@/lib/catalog-tool-index';
import { extractNessusPluginId } from '@/lib/finding-grouping';

const SEVERITY_EN: Record<Severity, string> = {
  Critical: 'Critical',
  High: 'High',
  Medium: 'Medium',
  Low: 'Low',
  Info: 'Info',
};

const SEVERITY_ES: Record<Severity, string> = {
  Critical: 'Crítica',
  High: 'Alta',
  Medium: 'Media',
  Low: 'Baja',
  Info: 'Informativa',
};

export type CatalogFromFindingInput = {
  titulo: string;
  descripcion?: string | null;
  severidad?: Severity | string | null;
  amenaza_ampliada?: string | null;
  propuesta_remediacion?: string | null;
  metodo_deteccion?: string | null;
  explicacion_tecnica?: string | null;
  raw_tool_output?: string | null;
  cve?: string | null;
  cwe?: string | null;
  cvss_score?: number | null;
  catalog_id?: number | null;
  finding_id?: string | null;
  tool_source?: string | null;
  tool_vuln_id?: string | null;
  /** Solo buscar en catálogo; no crear entrada nueva. */
  lookup_only?: boolean;
};

export type CatalogRowPayload = Record<string, string | null>;

function normalizeSeverity(raw: string | null | undefined): Severity {
  const t = (raw || '').trim();
  if (/crit/i.test(t)) return 'Critical';
  if (/high|alta/i.test(t)) return 'High';
  if (/med/i.test(t)) return 'Medium';
  if (/low|baja/i.test(t)) return 'Low';
  if (/info/i.test(t)) return 'Info';
  return 'Medium';
}

/** Maps finding fields → core.vulns_catalog columns (English + Spanish). */
export function findingToCatalogRow(input: CatalogFromFindingInput): CatalogRowPayload {
  const pluginId = extractNessusPluginId(input.raw_tool_output ?? null);
  const sev = normalizeSeverity(String(input.severidad || 'Medium'));

  const titulo = (input.titulo || '').trim().slice(0, 512);
  const descripcion = (input.descripcion || '').trim().slice(0, 32000) || null;
  const amenaza = (input.amenaza_ampliada || '').trim().slice(0, 32000) || null;
  const remediacion = (input.propuesta_remediacion || '').trim().slice(0, 32000) || null;
  const metodo = (input.metodo_deteccion || '').trim().slice(0, 32000) || null;
  const tecnica = (input.explicacion_tecnica || '').trim().slice(0, 32000) || null;

  const toolSource = normalizeToolSource(input.tool_source ?? (pluginId ? 'Nessus' : 'Manual'));
  const toolCol = catalogColumnForSource(toolSource);
  const toolId = (input.tool_vuln_id || '').trim() || (toolSource === 'nessus' && pluginId ? pluginId : '');

  const row: CatalogRowPayload = {
    StandardVulnerabilityName: titulo || null,
    Vulnerability: titulo || null,
    Severity: SEVERITY_EN[sev],
    SourceDetection:
      toolSource === 'nessus'
        ? 'Nessus'
        : toolSource === 'acunetix'
          ? 'Acunetix'
          : toolSource === 'nmap'
            ? 'Nmap'
            : 'Manual',
    Description: descripcion,
    Danger: amenaza,
    Solution: remediacion,
    NessusPluginId: pluginId,
    CVE: input.cve?.trim().slice(0, 64) || null,
    CWE: input.cwe?.trim().slice(0, 64) || null,
    CVSSOverallScore3_1:
      input.cvss_score != null && Number.isFinite(input.cvss_score)
        ? String(input.cvss_score)
        : null,
    EspNombreVulnerabilidadUnificado: titulo || null,
    EspSeveridadUnificada: SEVERITY_ES[sev],
    EspDescripcionUnificada: descripcion,
    EspAmenazaUnificadaGeneral: amenaza,
    EspPropuestaRemediacionUnificada: remediacion,
    EspPropuestaRemediacionUnificadaEnRedPrivada: remediacion,
    EspMetodoDeteccion: metodo,
    EspExplicacionTecnica: tecnica,
  };

  if (toolCol && toolId && toolCol !== 'NessusPluginId') {
    row[toolCol] = toolId.slice(0, 255);
  }

  return row;
}

export function findingToCatalogInput(finding: Finding): CatalogFromFindingInput {
  return {
    titulo: finding.titulo,
    descripcion: finding.descripcion,
    severidad: finding.severidad,
    amenaza_ampliada: finding.amenaza_ampliada,
    propuesta_remediacion: finding.propuesta_remediacion,
    metodo_deteccion: finding.metodo_deteccion,
    explicacion_tecnica: finding.explicacion_tecnica,
    raw_tool_output: finding.raw_tool_output,
    cve: finding.cve,
    cwe: finding.cwe,
    cvss_score: finding.cvss_score,
    catalog_id: finding.catalog_id,
    finding_id: finding.id,
    tool_source: finding.tool_source,
    tool_vuln_id: finding.tool_vuln_id,
  };
}

export async function resolveCatalogFromFinding(
  input: CatalogFromFindingInput
): Promise<{ row: Record<string, unknown>; created: boolean }> {
  const res = await fetch('/api/vulns-catalog/from-finding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as {
    row?: Record<string, unknown>;
    created?: boolean;
    error?: string;
    details?: string;
  };
  if (!res.ok) {
    throw new Error(data.details || data.error || 'No se pudo resolver el catálogo');
  }
  if (!data.row) {
    throw new Error('Respuesta inválida del catálogo');
  }
  return { row: data.row, created: Boolean(data.created) };
}

export function catalogEditUrl(
  catalogId: string | number,
  fromFinding?: string,
  engagementId?: string
): string {
  const params = new URLSearchParams({ editId: String(catalogId) });
  if (fromFinding) params.set('fromFinding', fromFinding);
  if (engagementId) params.set('engagementId', engagementId);
  return `/vulns-catalog?${params.toString()}#catalog-editor`;
}

function catalogCell(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/** Mapea fila de core.vulns_catalog → campos actualizables del hallazgo. */
export function catalogRowToFindingUpdate(
  row: Record<string, unknown>
): Partial<{
  titulo: string;
  descripcion: string;
  severidad: Severity;
  amenaza_ampliada: string;
  propuesta_remediacion: string;
  metodo_deteccion: string;
  explicacion_tecnica: string;
  referencias: string;
  cve: string;
  cwe: string;
  cvss_score: number;
}> {
  const update: ReturnType<typeof catalogRowToFindingUpdate> = {};

  const titulo =
    catalogCell(row, 'EspNombreVulnerabilidadUnificado') ||
    catalogCell(row, 'StandardVulnerabilityName') ||
    catalogCell(row, 'Vulnerability');
  if (titulo) update.titulo = titulo.slice(0, 500);

  const sev = catalogCell(row, 'EspSeveridadUnificada') || catalogCell(row, 'Severity');
  if (sev) update.severidad = normalizeSeverity(sev);

  const descripcion =
    catalogCell(row, 'EspDescripcionUnificada') || catalogCell(row, 'Description');
  if (descripcion) update.descripcion = descripcion.slice(0, 32000);

  const amenaza =
    catalogCell(row, 'EspAmenazaUnificadaGeneral') || catalogCell(row, 'Danger');
  if (amenaza) update.amenaza_ampliada = amenaza.slice(0, 32000);

  const rem =
    catalogCell(row, 'EspPropuestaRemediacionUnificadaEnRedPrivada') ||
    catalogCell(row, 'EspPropuestaRemediacionUnificada') ||
    catalogCell(row, 'Solution');
  if (rem) update.propuesta_remediacion = rem.slice(0, 32000);

  const metodo = catalogCell(row, 'EspMetodoDeteccion');
  if (metodo) update.metodo_deteccion = metodo.slice(0, 32000);

  const tecnica = catalogCell(row, 'EspExplicacionTecnica');
  if (tecnica) update.explicacion_tecnica = tecnica.slice(0, 32000);

  const refs = catalogCell(row, 'References');
  if (refs) update.referencias = refs.slice(0, 32000);

  const cve = catalogCell(row, 'CVE');
  if (cve) update.cve = cve.slice(0, 64);

  const cwe = catalogCell(row, 'CWE');
  if (cwe) update.cwe = cwe.slice(0, 64);

  const cvssRaw = catalogCell(row, 'CVSSOverallScore3_1');
  if (cvssRaw) {
    const n = Number.parseFloat(cvssRaw);
    if (Number.isFinite(n)) update.cvss_score = n;
  }

  return update;
}

/** Busca en catálogo sin crear registro nuevo. */
export async function lookupCatalogForFinding(
  input: CatalogFromFindingInput
): Promise<Record<string, unknown> | null> {
  const res = await fetch('/api/vulns-catalog/from-finding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, lookup_only: true }),
  });
  if (res.status === 404) return null;
  const data = (await res.json()) as {
    row?: Record<string, unknown>;
    error?: string;
    details?: string;
  };
  if (!res.ok) {
    throw new Error(data.details || data.error || 'No se pudo consultar el catálogo');
  }
  return data.row ?? null;
}

/** Trae datos del catálogo operativo al hallazgo (tras editar en otra pestaña). */
export async function syncFindingFromCatalog(finding: Finding): Promise<Finding> {
  const result = await syncFindingsFromCatalogApi({ finding_ids: [finding.id] });
  if (result.synced === 0) {
    throw new Error(
      result.errors[0] ??
        'No hay entrada en el catálogo operativo para este hallazgo (vinculado por Plugin ID Nessus).'
    );
  }
  return getFinding(finding.id);
}

export async function syncFindingsFromCatalog(
  findings: Finding[],
  onProgress?: (done: number, total: number) => void
): Promise<{
  updated: Finding[];
  errors: string[];
  synced: number;
  skipped: number;
}> {
  if (findings.length === 0) {
    return { updated: [], errors: [], synced: 0, skipped: 0 };
  }
  onProgress?.(0, findings.length);
  const result = await syncFindingsFromCatalogApi({
    finding_ids: findings.map((f) => f.id),
  });
  onProgress?.(findings.length, findings.length);
  return {
    updated: [],
    errors: result.errors,
    synced: result.synced,
    skipped: result.skipped,
  };
}
