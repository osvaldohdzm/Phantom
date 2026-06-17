import type { SuggestedFinding } from '@/lib/secops-api';
import type { Severity } from '@/lib/secops-api';
import { cleanFindingTitle, toPlainReportText } from '@/lib/plain-report-text';

export type ParsedFindingResult = {
  suggestion: SuggestedFinding;
  confidence: number;
  filledFields: string[];
  /** Solo salidas de herramienta (no el informe completo). */
  raw_tool_output?: string;
};

function normalizeKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\*\*/g, '')
    .toLowerCase()
    .trim();
}

function mapSeverity(raw: string): Severity {
  const s = normalizeKey(raw);
  if (/crit/i.test(s)) return 'Critical';
  if (/alt|high/i.test(s)) return 'High';
  if (/med|medium/i.test(s)) return 'Medium';
  if (/baj|low/i.test(s)) return 'Low';
  if (/info|informativo/i.test(s)) return 'Info';
  return 'Medium';
}

const SECTION_HEADERS = [
  'DESCRIPCIÓN',
  'DESCRIPCION',
  'AMENAZA',
  'PROPUESTA DE REMEDIACIÓN',
  'PROPUESTA DE REMEDIACION',
  'REFERENCIAS',
  'SISTEMA(S) O RUTA(S) AFECTADOS',
  'SISTEMAS O RUTAS AFECTADAS',
  'DETALLE DE PRUEBAS DE SEGURIDAD',
  'ACTIVOS',
] as const;

/** Línea de sección: DESCRIPCIÓN, **DESCRIPCIÓN**, ## DESCRIPCIÓN */
function isSectionHeader(line: string): string | null {
  const trimmed = line.trim();
  const stripped = trimmed.replace(/^\*\*|\*\*$/g, '').replace(/^\*\*([^*]+)\*\*:?\s*$/, '$1').replace(/^#+\s*/, '').trim();

  for (const h of SECTION_HEADERS) {
    const norm = normalizeKey(h);
    const normLine = normalizeKey(stripped.replace(/:$/, ''));
    if (normLine === norm || normLine.startsWith(norm)) return norm;
    if (/^amenaza(\s*\(impacto\))?$/i.test(stripped.replace(/:$/, ''))) return 'amenaza';
  }
  return null;
}

function splitTableCells(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return null;
  if (/^\|\s*[-:]+/.test(trimmed)) return null;
  const inner = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  const cells = inner.split('|').map((c) => c.trim());
  return cells.length >= 2 ? cells : null;
}

/** Filas tipo | DESCRIPCIÓN | texto… | (informes Word exportados a markdown). */
function parseMarkdownTableSections(raw: string): Map<string, string> | null {
  const sections = new Map<string, string>();
  let found = false;

  for (const line of raw.split('\n')) {
    const cells = splitTableCells(line);
    if (!cells) continue;
    const [label, ...valueParts] = cells;
    const value = valueParts.join(' | ').trim();
    if (!value) continue;
    const headerKey = isSectionHeader(label);
    if (headerKey) {
      found = true;
      sections.set(headerKey, value);
    }
  }

  return found ? sections : null;
}

function extractTitleFromMarkdownTable(raw: string): { titulo: string; severidad?: string } | null {
  for (const line of raw.split('\n')) {
    const cells = splitTableCells(line);
    if (!cells) continue;
    const [label, second] = cells;
    if (isSectionHeader(label)) continue;
    const sevCell = second || '';
    if (
      label &&
      sevCell &&
      /^(?:critical|high|medium|low|info|informativo|cr[ií]tic|alt|alta|med|media|baj|baja)$/i.test(
        sevCell.trim()
      )
    ) {
      return { titulo: cleanFindingTitle(label), severidad: sevCell.trim() };
    }
    if (label && !isSectionHeader(label)) break;
  }
  return null;
}

function parseLineSections(raw: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = raw.split('\n');
  let currentKey: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (currentKey && buffer.length) {
      sections.set(currentKey, buffer.join('\n').trim());
    }
    buffer = [];
  };

  for (const line of lines) {
    const headerKey = isSectionHeader(line);
    if (headerKey) {
      flush();
      currentKey = headerKey;
      continue;
    }
    if (currentKey) buffer.push(line);
  }
  flush();
  return sections;
}

function parseSections(raw: string): Map<string, string> {
  const fromTable = parseMarkdownTableSections(raw);
  const fromLines = parseLineSections(raw);
  if (!fromTable?.size) return fromLines;
  const merged = new Map(fromTable);
  for (const [k, v] of fromLines) {
    if (!merged.has(k) || !merged.get(k)?.trim()) merged.set(k, v);
  }
  return merged;
}

function extractBoldInline(text: string, label: string): string | undefined {
  const patterns = [
    new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+?)(?=\\n\\s*\\*\\*[A-ZÁÉÍÓÚ]|\\n##|\\n---|$)`, 'is'),
    new RegExp(`(?:^|\\n)\\s*${label}\\s*:\\s*(.+?)(?=\\n\\s*(?:\\*\\*)?[A-ZÁÉÍÓÚ]|\\n##|$)`, 'is'),
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return undefined;
}

function parseSecurityDetailBlock(block: string): {
  metodo_deteccion?: string;
  salidas?: string;
  explicacion?: string;
} {
  const metodo =
    extractBoldInline(block, 'Método de detección') ||
    extractBoldInline(block, 'Metodo de deteccion') ||
    block.match(/m[eé]todo de detecci[oó]n\s*:\s*(.+)/i)?.[1]?.trim();

  let salidas = extractBoldInline(block, 'Salidas de herramienta');
  if (!salidas) {
    const idx = block.search(/salidas?\s+de\s+herramienta\s*:/i);
    if (idx >= 0) {
      let rest = block.slice(idx).replace(/^salidas?\s+de\s+herramienta\s*:\s*/i, '');
      const endIdx = rest.search(/\n\s*explicaci[oó]n\s*t[eé]cnica\s*:/i);
      if (endIdx >= 0) rest = rest.slice(0, endIdx);
      rest = rest.replace(/^`{1,3}text\s*\n?/i, '').replace(/\n?`{1,3}\s*$/i, '');
      salidas = rest.trim();
    }
  }

  const explicacion =
    extractBoldInline(block, 'Explicación técnica') ||
    extractBoldInline(block, 'Explicacion tecnica') ||
    block.match(/explicaci[oó]n\s*t[eé]cnica\s*:\s*([\s\S]+)/i)?.[1]?.trim();

  return {
    metodo_deteccion: metodo ? toPlainReportText(metodo) : undefined,
    salidas: salidas ? toPlainReportText(salidas) : undefined,
    explicacion: explicacion?.trim(),
  };
}

function cleanComponentList(text: string): string {
  return toPlainReportText(
    text
      .split('\n')
      .map((l) => l.replace(/^[\s●•\-*]+/, '').trim())
      .filter(Boolean)
      .join('\n')
  );
}

function extractCwe(text: string): string | undefined {
  return text.match(/CWE-?\d+/i)?.[0]?.replace(/CWE(\d+)/i, 'CWE-$1');
}

function extractCve(text: string): string | undefined {
  return text.match(/CVE-\d{4}-\d+/i)?.[0];
}

function extractCvss(text: string): number | undefined {
  const m = text.match(/CVSS(?:\s*score)?\s*:?\s*(\d+(?:\.\d+)?)/i);
  return m ? parseFloat(m[1]) : undefined;
}

/** Parsea informes en español con secciones tipo Word / plantilla CFR / markdown */
export function parseStructuredFinding(raw: string): ParsedFindingResult | null {
  const text = raw.trim();
  if (!text) return null;

  const sections = parseSections(text);
  const filledFields: string[] = [];

  const tableTitle = extractTitleFromMarkdownTable(text);

  const tituloRaw =
    extractBoldInline(text, 'Nombre de vulnerabilidad') ||
    extractBoldInline(text, 'Nombre de la vulnerabilidad') ||
    tableTitle?.titulo ||
    text.match(/^##\s+\d+(?:\.\d+)+\.\s+(.+)/m)?.[1]?.trim() ||
    text.match(/^\d+(?:\.\d+)+\.\s+(.+)/m)?.[1]?.trim() ||
    text.split('\n').find((l) => l.trim() && !isSectionHeader(l) && !l.trim().startsWith('|'))?.trim() ||
    '';

  const titulo = cleanFindingTitle(tituloRaw);
  if (titulo) filledFields.push('titulo');

  const sevRaw =
    extractBoldInline(text, 'Severidad') ||
    tableTitle?.severidad ||
    text.match(/severidad\s*:\s*(.+)/i)?.[1]?.trim() ||
    '';
  const severidad = sevRaw ? mapSeverity(sevRaw) : 'Medium';
  if (sevRaw) filledFields.push('severidad');

  const getSection = (...keys: string[]) => {
    for (const k of keys) {
      const v = sections.get(normalizeKey(k));
      if (v) return toPlainReportText(v);
    }
    return '';
  };

  const descripcion = getSection('descripcion', 'descripción');
  if (descripcion) filledFields.push('descripcion');

  const amenaza_ampliada = getSection('amenaza');
  if (amenaza_ampliada) filledFields.push('amenaza_ampliada');

  const propuesta_remediacion = getSection('propuesta de remediacion', 'propuesta de remediación');
  if (propuesta_remediacion) filledFields.push('propuesta_remediacion');

  const referencias = getSection('referencias');
  if (referencias) filledFields.push('referencias');

  const componenteRaw = getSection(
    'sistema(s) o ruta(s) afectados',
    'sistemas o rutas afectadas',
    'activos'
  );
  const componente_afectado = cleanComponentList(componenteRaw);
  if (componente_afectado) filledFields.push('componente_afectado');

  const detailBlock = sections.get('detalle de pruebas de seguridad') || '';
  const detail = parseSecurityDetailBlock(detailBlock);

  let metodo_deteccion = detail.metodo_deteccion || '';
  let explicacion_tecnica = detail.explicacion || '';
  const salidas = detail.salidas || '';

  if (!metodo_deteccion) {
    metodo_deteccion = toPlainReportText(extractBoldInline(text, 'Método de detección') || '');
  }
  if (metodo_deteccion) filledFields.push('metodo_deteccion');
  if (explicacion_tecnica) filledFields.push('explicacion_tecnica');

  const cwe = extractCwe(referencias || text) || extractCwe(text);
  const cve = extractCve(referencias || text) || extractCve(text);
  const cvss_score = extractCvss(text);
  if (cwe) filledFields.push('cwe');
  if (cve) filledFields.push('cve');

  const confidence = Math.min(1, filledFields.length / 8);

  if (filledFields.length < 2) return null;

  return {
    confidence,
    filledFields,
    raw_tool_output: salidas || undefined,
    suggestion: {
      titulo: titulo.slice(0, 300),
      severidad,
      descripcion,
      amenaza_ampliada,
      propuesta_remediacion,
      referencias,
      componente_afectado,
      metodo_deteccion,
      explicacion_tecnica,
      cve,
      cwe,
      cvss_score,
    },
  };
}

const BOILERPLATE_REMEDIATION =
  /aplicar parches|restringir exposici[oó]n|validar configuraci[oó]n endurecida|pasos recomendados:/i;

function looksLikeRawDump(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return (
    /\|\s*DESCRIPCI/i.test(v) ||
    /\|\s*AMENAZA\s*\|/i.test(v) ||
    (v.includes('| --- |') && v.length > 300) ||
    /^DETALLE DE PRUEBAS DE SEGURIDAD/im.test(v)
  );
}

function pickField(ai: string | undefined, structured: string | undefined): string {
  const a = (ai || '').trim();
  const s = (structured || '').trim();
  if (!s) return a;
  if (!a) return s;
  if (looksLikeRawDump(a)) return s;
  if (BOILERPLATE_REMEDIATION.test(a) && s.length > a.length) return s;
  if (a.length < 40 && s.length > a.length) return s;
  return a;
}

/** Combina sugerencia de Gemini con campos extraídos del texto estructurado local. */
export function mergeSuggestionWithStructured(
  base: SuggestedFinding,
  raw: string
): { suggestion: SuggestedFinding; raw_tool_output?: string } {
  const parsed = parseStructuredFinding(raw);
  if (!parsed) return { suggestion: base };

  const s = parsed.suggestion;
  return {
    raw_tool_output: parsed.raw_tool_output,
    suggestion: {
      ...base,
      titulo: pickField(base.titulo, s.titulo),
      severidad: s.severidad || base.severidad,
      descripcion: pickField(base.descripcion, s.descripcion),
      amenaza_ampliada: pickField(base.amenaza_ampliada, s.amenaza_ampliada),
      propuesta_remediacion: pickField(base.propuesta_remediacion, s.propuesta_remediacion),
      referencias: pickField(base.referencias, s.referencias),
      componente_afectado: pickField(base.componente_afectado, s.componente_afectado),
      metodo_deteccion: pickField(base.metodo_deteccion, s.metodo_deteccion),
      explicacion_tecnica: pickField(base.explicacion_tecnica, s.explicacion_tecnica),
      cve: base.cve || s.cve,
      cwe: base.cwe || s.cwe,
      cvss_score: base.cvss_score ?? s.cvss_score,
    },
  };
}

export const FIELD_LABELS: Record<string, string> = {
  titulo: 'Nombre de la vulnerabilidad',
  severidad: 'Severidad',
  descripcion: 'Descripción',
  amenaza_ampliada: 'Amenaza (Impacto)',
  propuesta_remediacion: 'Propuesta de remediación',
  referencias: 'Referencias',
  componente_afectado: 'Sistemas / rutas afectadas',
  metodo_deteccion: 'Método de detección',
  explicacion_tecnica: 'Explicación técnica',
  raw_tool_output: 'Salidas de herramienta',
  cve: 'CVE',
  cwe: 'CWE',
  cvss_score: 'CVSS',
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  Critical: 'Crítica',
  High: 'Alta',
  Medium: 'Media',
  Low: 'Baja',
  Info: 'Info',
};
