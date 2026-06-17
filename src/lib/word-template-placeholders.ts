/**
 * Marcadores «…» para plantillas Word (macro CYB001).
 * El usuario copia el texto exacto, incluyendo « y ».
 */

import { catalogColumnLabel, VULNS_CATALOG_SELECT_COLUMNS } from '@/lib/vulns-catalog-columns';
import { REVIEW_FIELDS } from '@/lib/finding-completeness';
import { VULNERABILITY_SELECT_COLUMNS } from '@/lib/vulnerability-columns';

export type WordPlaceholderCategory =
  | 'plantilla'
  | 'detalle'
  | 'hallazgo'
  | 'catalogo'
  | 'legacy'
  | 'metadato'
  | 'activo'
  | 'alias';

export type WordPlaceholderDef = {
  marker: string;
  label: string;
  category: WordPlaceholderCategory;
  /** Sustituido hoy por el generador Word al exportar. */
  wired: boolean;
  hint?: string;
  /** Agrupa alias bajo el marcador canónico de plantilla. */
  group?: string;
};

export function toWordMarker(name: string): string {
  const inner = name.replace(/^«|»$/g, '').trim();
  return `«${inner}»`;
}

const PLANTILLA_PRINCIPAL: WordPlaceholderDef[] = [
  {
    marker: '«Nombre de la vulnerabilidad»',
    label: 'Título del hallazgo',
    category: 'plantilla',
    wired: true,
  },
  {
    marker: '«Descripción»',
    label: 'Descripción / impacto técnico breve',
    category: 'plantilla',
    wired: true,
  },
  {
    marker: '«AMENAZA»',
    label: 'Amenaza ampliada',
    category: 'plantilla',
    wired: true,
    group: 'amenaza',
  },
  {
    marker: '«PROPUESTA DE REMEDIACIÓN»',
    label: 'Propuesta de remediación',
    category: 'plantilla',
    wired: true,
    group: 'remediacion',
  },
  {
    marker: '«Nivel de riesgo»',
    label: 'Severidad INAI (Crítica, Alta, Media…)',
    category: 'plantilla',
    wired: true,
    group: 'severidad',
  },
  {
    marker: '«CVE»',
    label: 'Identificador CVE',
    category: 'plantilla',
    wired: true,
  },
  {
    marker: '«REFERENCIAS»',
    label: 'Referencias (CVE, CWE, enlaces)',
    category: 'plantilla',
    wired: true,
    group: 'referencias',
  },
  {
    marker: '«Componente afectado»',
    label: 'Activo, host, URL o ruta afectada',
    category: 'plantilla',
    wired: true,
    group: 'componente',
  },
];

/** Bloque DETALLE: el encabezado es texto fijo de plantilla, no un marcador sustituible. */
export const DETALLE_PRUEBAS_SECCION = {
  headerLabel: 'DETALLE DE PRUEBAS DE SEGURIDAD',
  description:
    'Es el título de una fila/sección en la tabla Word (negrita blanca sobre fondo azul). No existe «DETALLE DE PRUEBAS DE SEGURIDAD» como marcador reemplazable. El contenido sustituido en «Método de detección», «Salidas de herramienta» y «Explicación técnica» se exporta en texto normal, sin negrita — igual que «Amenaza», «Descripción» y «Propuesta de remediación» en la columna derecha.',
  fields: [
    '«Método de detección»',
    '«Salidas de herramienta»',
    '«Explicación técnica»',
  ] as const,
};

const DETALLE_FIELDS: WordPlaceholderDef[] = [
  {
    marker: '«Método de detección»',
    label: 'Cómo se detectó (escáner, prueba manual…)',
    category: 'detalle',
    wired: true,
    hint: 'Soporta markdown e imágenes si el tipo es markdown.',
  },
  {
    marker: '«Salidas de herramienta»',
    label: 'Plugin output / salida cruda (CYB009)',
    category: 'detalle',
    wired: true,
    hint: 'Se limpia siempre antes de Word. Markdown opcional.',
  },
  {
    marker: '«Explicación técnica»',
    label: 'Detalle técnico ampliado',
    category: 'detalle',
    wired: true,
    hint: 'Markdown con imágenes si «Tipo de texto de explicación técnica» = markdown.',
  },
];

const METADATO_TIPO: WordPlaceholderDef[] = [
  {
    marker: '«Tipo de texto de explicación técnica»',
    label: 'markdown | texto plano',
    category: 'metadato',
    wired: true,
    hint: 'Controla formato rich en Word para explicación.',
  },
  {
    marker: '«Tipo de texto de método de detección»',
    label: 'markdown | texto plano',
    category: 'metadato',
    wired: true,
  },
  {
    marker: '«Tipo de texto de salidas»',
    label: 'markdown | texto plano',
    category: 'metadato',
    wired: true,
  },
];

const FINDING_EXTRA: WordPlaceholderDef[] = [
  { marker: '«CWE»', label: 'CWE', category: 'hallazgo', wired: true },
  { marker: '«CVSS»', label: 'Puntuación CVSS', category: 'hallazgo', wired: true },
  { marker: '«Vector CVSS»', label: 'Vector CVSS', category: 'hallazgo', wired: true },
  { marker: '«Estado»', label: 'Estado del hallazgo', category: 'hallazgo', wired: true },
  { marker: '«OWASP»', label: 'Categoría OWASP', category: 'hallazgo', wired: true },
  { marker: '«MITRE»', label: 'Técnica MITRE', category: 'hallazgo', wired: true },
  { marker: '«Fecha»', label: 'Fecha de creación', category: 'hallazgo', wired: true },
  { marker: '«Id»', label: 'UUID del hallazgo', category: 'hallazgo', wired: true },
];

const ACTIVO_ENGAGEMENT: WordPlaceholderDef[] = [
  { marker: '«Activo»', label: 'Nombre del activo', category: 'activo', wired: true },
  { marker: '«IP»', label: 'IP pública o privada', category: 'activo', wired: true },
  { marker: '«FQDN»', label: 'FQDN del activo', category: 'activo', wired: true },
  { marker: '«Cliente»', label: 'Cliente del engagement', category: 'activo', wired: true },
];

const LEGACY_CATALOG: WordPlaceholderDef[] = [
  {
    marker: '«Catálogo»',
    label: 'Nombre en catálogo legacy (DefaultVulnerabilityName)',
    category: 'legacy',
    wired: true,
  },
  {
    marker: '«BANOBRAS Categoría»',
    label: 'Categoría BANOBRAS',
    category: 'legacy',
    wired: true,
  },
  {
    marker: '«BANOBRAS Tipo»',
    label: 'Tipo vulnerabilidad BANOBRAS',
    category: 'legacy',
    wired: true,
  },
];

const ALIASES: WordPlaceholderDef[] = [
  { marker: '«Nombre de vulnerabilidad»', label: 'Alias de título', category: 'alias', wired: true, group: 'titulo' },
  { marker: '«Título»', label: 'Alias de título', category: 'alias', wired: true, group: 'titulo' },
  { marker: '«Vulnerabilidad»', label: 'Alias de título', category: 'alias', wired: true, group: 'titulo' },
  { marker: '«DESCRIPCIÓN»', label: 'Alias mayúsculas', category: 'alias', wired: true, group: 'descripcion' },
  { marker: '«Amenaza»', label: 'Alias minúsculas', category: 'alias', wired: true, group: 'amenaza' },
  { marker: '«Amenaza ampliada»', label: 'Alias largo', category: 'alias', wired: true, group: 'amenaza' },
  { marker: '«Propuesta de remediación»', label: 'Alias título case', category: 'alias', wired: true, group: 'remediacion' },
  { marker: '«Remediación»', label: 'Alias corto', category: 'alias', wired: true, group: 'remediacion' },
  { marker: '«Solución»', label: 'Alias catálogo EN', category: 'alias', wired: true, group: 'remediacion' },
  { marker: '«Severidad»', label: 'Alias severidad', category: 'alias', wired: true, group: 'severidad' },
  { marker: '«NIVEL DE RIESGO»', label: 'Alias mayúsculas', category: 'alias', wired: true, group: 'severidad' },
  { marker: '«Severidad (español)»', label: 'Critical / High… en inglés', category: 'alias', wired: true, group: 'severidad' },
  { marker: '«CVSS Score»', label: 'Alias CVSS', category: 'alias', wired: true, group: 'cvss' },
  { marker: '«Salida de herramienta»', label: 'Singular', category: 'alias', wired: true, group: 'salidas' },
  { marker: '«Referencias»', label: 'Alias título case', category: 'alias', wired: true, group: 'referencias' },
  {
    marker: '«SISTEMA(S) O RUTA(S) AFECTADOS»',
    label: 'Alias plantilla INAI',
    category: 'alias',
    wired: true,
    group: 'componente',
  },
];

const FINDING_FIELD_MARKERS: Record<string, string> = {
  descripcion: '«Descripción»',
  amenaza_ampliada: '«AMENAZA»',
  propuesta_remediacion: '«PROPUESTA DE REMEDIACIÓN»',
  referencias: '«REFERENCIAS»',
  componente_afectado: '«Componente afectado»',
  metodo_deteccion: '«Método de detección»',
  explicacion_tecnica: '«Explicación técnica»',
  raw_tool_output: '«Salidas de herramienta»',
};

const HALLAZGO_FROM_REVIEW: WordPlaceholderDef[] = REVIEW_FIELDS.map((f) => ({
  marker: FINDING_FIELD_MARKERS[f.key] ?? toWordMarker(f.label),
  label: `Campo hallazgo: ${f.label}`,
  category: 'hallazgo' as const,
  wired: true,
  hint: `Columna en BD: ${f.key}`,
}));

function catalogColumnPlaceholders(): WordPlaceholderDef[] {
  return VULNS_CATALOG_SELECT_COLUMNS.filter((c) => c !== 'Id').map((col) => ({
    marker: toWordMarker(col),
    label: catalogColumnLabel(col),
    category: 'catalogo' as const,
    wired: false,
    hint: `Tabla core.vulns_catalog · columna ${col}`,
  }));
}

function legacyVulnerabilityPlaceholders(): WordPlaceholderDef[] {
  return VULNERABILITY_SELECT_COLUMNS.filter((c) => c !== 'Id').map((col) => ({
    marker: toWordMarker(col),
    label: col.replace(/([A-Z])/g, ' $1').trim(),
    category: 'legacy' as const,
    wired: ['DefaultVulnerabilityName', 'BANOBRASCategoryName', 'BANOBRASTipoVulnerabilidad'].includes(
      col
    ),
    hint: `Tabla core.vulnerabilities · ${col}`,
  }));
}

function dedupeByMarker(items: WordPlaceholderDef[]): WordPlaceholderDef[] {
  const seen = new Set<string>();
  const out: WordPlaceholderDef[] = [];
  for (const item of items) {
    if (seen.has(item.marker)) continue;
    seen.add(item.marker);
    out.push(item);
  }
  return out;
}

/** Marcadores principales (plantilla CYB001 típica + bloque detalle). */
export function getPrincipalWordPlaceholders(): WordPlaceholderDef[] {
  return dedupeByMarker([...PLANTILLA_PRINCIPAL, ...DETALLE_FIELDS]);
}

/** Todos los marcadores documentados, sin duplicar por marker. */
export function getAllWordPlaceholders(): WordPlaceholderDef[] {
  return dedupeByMarker([
    ...PLANTILLA_PRINCIPAL,
    ...DETALLE_FIELDS,
    ...METADATO_TIPO,
    ...HALLAZGO_FROM_REVIEW,
    ...FINDING_EXTRA,
    ...ACTIVO_ENGAGEMENT,
    ...LEGACY_CATALOG,
    ...catalogColumnPlaceholders(),
    ...legacyVulnerabilityPlaceholders(),
    ...ALIASES,
  ]);
}

export const WORD_PLACEHOLDER_CATEGORY_LABELS: Record<WordPlaceholderCategory, string> = {
  plantilla: 'Plantilla INAI / CYB001',
  detalle: 'Detalle de pruebas de seguridad',
  hallazgo: 'Campos del hallazgo (BD)',
  catalogo: 'Columnas catálogo operativo',
  legacy: 'Catálogo legacy / BANOBRAS',
  metadato: 'Metadatos de formato',
  activo: 'Activo y proyecto',
  alias: 'Alias y variantes',
};

export const WORD_PLACEHOLDER_CATEGORY_ORDER: WordPlaceholderCategory[] = [
  'plantilla',
  'detalle',
  'hallazgo',
  'catalogo',
  'legacy',
  'metadato',
  'activo',
  'alias',
];
