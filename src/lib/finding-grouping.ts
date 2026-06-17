import { normalizeToolSource } from '@/lib/catalog-tool-index';
import type { Finding, Severity } from '@/lib/secops-api';
import { fixTextEncoding } from '@/lib/text-encoding';

const PLUGIN_ID_RE = /Plugin ID:\s*(\d+)/i;
const HOST_RE = /^Host:\s*(.+)$/im;
const PORT_RE = /^Puerto:\s*(.+)$/im;

export const SALIDA_PREFIX_TEMPLATE = '-----[Salida correspondiente a: {componente} ]-----';

export function normalizeGroupingTitle(titulo: string): string {
  return (titulo || '').trim().toLowerCase();
}

export function extractNessusPluginId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(PLUGIN_ID_RE);
  return m?.[1] ?? null;
}

export function resolveFindingComponente(finding: Finding): string {
  const direct = (finding.componente_afectado || '').trim();
  if (direct) return direct;
  const raw = finding.raw_tool_output || '';
  const host = raw.match(HOST_RE)?.[1]?.trim();
  if (!host) return '';
  const port = raw.match(PORT_RE)?.[1]?.trim();
  if (port && port !== '0' && port.toLowerCase() !== 'none') {
    return `${host}:${port}`;
  }
  return host;
}

function resolveFindingToolIdentity(finding: Finding): { source: string; id: string } {
  const id = (finding.tool_vuln_id || '').trim();
  if (id) {
    return { source: normalizeToolSource(finding.tool_source), id };
  }
  const plugin = extractNessusPluginId(finding.raw_tool_output);
  if (plugin) return { source: 'nessus', id: plugin };
  const title = (finding.titulo || '').trim();
  return { source: 'manual', id: title };
}

/** Clave de tipo de vulnerabilidad (sin severidad ni activo) — una fila en revisión de catálogo. */
export function findingTypeKey(finding: Finding): string {
  const { source, id } = resolveFindingToolIdentity(finding);
  if (id && source !== 'manual') return `tool:${source}:${id}`;
  const plugin = extractNessusPluginId(finding.raw_tool_output);
  if (plugin) return `plugin:${plugin}`;
  return `title:${normalizeGroupingTitle(finding.titulo)}`;
}

/** Clave de agrupación (mismo plugin/identificador + severidad). */
export function findingGroupKey(finding: Finding): string {
  const { source, id } = resolveFindingToolIdentity(finding);
  if (id && source !== 'manual') return `tool:${source}:${id}:${finding.severidad}`;
  const plugin = extractNessusPluginId(finding.raw_tool_output);
  if (plugin) return `plugin:${plugin}:${finding.severidad}`;
  return `title:${normalizeGroupingTitle(finding.titulo)}:${finding.severidad}`;
}

function uniqueLines(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = v.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

const PLUGIN_OUTPUT_RE = /plugin\s+output\s*:\s*/i;
const NESSUS_HEADER_LINE_RE =
  /^(?:\[Nessus CSV\]|Plugin ID:|Host:|Puerto:|Protocol:|CVE:|Synopsis:)/i;

/** Solo Plugin Output (sin metadatos Nessus de auto-ingesta). */
export function extractPluginOutputText(raw: string | null | undefined): string {
  const t = (raw || '').trim();
  if (!t) return '';
  const match = PLUGIN_OUTPUT_RE.exec(t);
  if (match) return t.slice(match.index + match[0].length).trim();
  if (t.toLowerCase().includes('[nessus csv]')) {
    const body: string[] = [];
    let pastHeaders = false;
    for (const line of t.split('\n')) {
      const stripped = line.trim();
      if (!stripped) {
        if (body.length) pastHeaders = true;
        continue;
      }
      if (!pastHeaders && NESSUS_HEADER_LINE_RE.test(stripped)) continue;
      pastHeaders = true;
      body.push(line);
    }
    return body.join('\n').trim();
  }
  return t;
}

export function personalizedSalida(componente: string, toolOutput: string): string {
  const cleaned = extractPluginOutputText(toolOutput);
  if (!cleaned) return '';
  const label = componente || 'N/A';
  return `${SALIDA_PREFIX_TEMPLATE.replace('{componente}', label)}\n${cleaned}`;
}

export type FindingGroup = {
  key: string;
  titulo: string;
  severidad: Severity;
  members: Finding[];
  componentes: string[];
  mergedComponentes: string;
  mergedSalidas: string;
};

export type VulnerabilityTypeGroup = {
  key: string;
  titulo: string;
  severidad: Severity;
  members: Finding[];
  instanceCount: number;
  toolLabel: string;
};

function maxSeverity(findings: Finding[]): Severity {
  const order: Severity[] = ['Critical', 'High', 'Medium', 'Low', 'Info'];
  let best = 99;
  let pick: Severity = 'Info';
  for (const f of findings) {
    const idx = order.indexOf(f.severidad);
    if (idx >= 0 && idx < best) {
      best = idx;
      pick = f.severidad;
    }
  }
  return pick;
}

function toolLabelForFinding(finding: Finding): string {
  const { source, id } = resolveFindingToolIdentity(finding);
  if (id) return `${source}:${id}`;
  const plugin = extractNessusPluginId(finding.raw_tool_output);
  if (plugin) return `nessus:${plugin}`;
  return 'manual';
}

/** Agrupa por tipo de vulnerabilidad (sin IP/puerto); una entrada por plugin/identificador. */
export function groupFindingsByVulnerabilityType(findings: Finding[]): VulnerabilityTypeGroup[] {
  const buckets = new Map<string, Finding[]>();
  const order: string[] = [];

  for (const f of findings) {
    const key = findingTypeKey(f);
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(f);
  }

  return order.map((key) => {
    const members = buckets.get(key)!;
    const rep = members[0];
    return {
      key,
      titulo: (rep.titulo || '').trim() || 'Sin título',
      severidad: maxSeverity(members),
      members,
      instanceCount: members.length,
      toolLabel: toolLabelForFinding(rep),
    };
  });
}

export function groupFindingsForDisplay(findings: Finding[]): FindingGroup[] {
  const buckets = new Map<string, Finding[]>();
  const order: string[] = [];

  for (const f of findings) {
    const key = findingGroupKey(f);
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(f);
  }

  return order.map((key) => {
    const members = buckets.get(key)!;
    const componentes = uniqueLines(members.map(resolveFindingComponente));
    const salidas = members
      .map((m) => personalizedSalida(resolveFindingComponente(m), m.raw_tool_output || ''))
      .filter(Boolean);
    return {
      key,
      titulo: fixTextEncoding(members[0].titulo),
      severidad: members[0].severidad,
      members,
      componentes,
      mergedComponentes: componentes.join('\n'),
      mergedSalidas: salidas.join('\n'),
    };
  });
}

/** Agrupa por ai_group_id; sin ID usa título normalizado como clave de respaldo. */
export function groupFindingsByAiGroup(findings: Finding[]): FindingGroup[] {
  const buckets = new Map<string, Finding[]>();
  const order: string[] = [];

  for (const f of findings) {
    const key = f.ai_group_id
      ? `ai:${f.ai_group_id}`
      : `title:${normalizeGroupingTitle(f.titulo)}`;
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(f);
  }

  return order
    .map((key) => {
      const members = buckets.get(key)!;
      if (members.length < 2 && key.startsWith('title:')) return null;
      const componentes = uniqueLines(members.map(resolveFindingComponente));
      const salidas = members
        .map((m) => personalizedSalida(resolveFindingComponente(m), m.raw_tool_output || ''))
        .filter(Boolean);
      const rep = members[0];
      const label = rep.ai_group_id
        ? fixTextEncoding(rep.titulo)
        : `${fixTextEncoding(rep.titulo)} (título)`;
      return {
        key,
        titulo: label,
        severidad: maxSeverity(members),
        members,
        componentes,
        mergedComponentes: componentes.join('\n'),
        mergedSalidas: salidas.join('\n'),
      };
    })
    .filter((g): g is FindingGroup => g !== null && g.members.length > 0);
}

export function countAiGroups(findings: Finding[]): number {
  const keys = new Set<string>();
  for (const f of findings) {
    if (f.ai_group_id) keys.add(f.ai_group_id);
    else keys.add(`title:${normalizeGroupingTitle(f.titulo)}`);
  }
  return keys.size;
}
