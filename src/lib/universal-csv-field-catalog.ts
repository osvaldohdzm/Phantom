/**
 * Catálogo oficial de campos CSV universal.
 * Core = prioritarios (claves fijas). Opcionales = complementarios.
 * El usuario puede agregar alias extra (localStorage) sin cambiar las claves.
 */

export type FieldTier = 'core' | 'optional';

export type OfficialFieldKey =
  | 'title'
  | 'description'
  | 'severity'
  | 'component'
  | 'cve'
  | 'cwe'
  | 'cvss'
  | 'impact'
  | 'remediation'
  | 'evidence'
  | 'method'
  | 'epss'
  | 'kev'
  | 'hosts'
  | 'asset_group'
  | 'asset_subgroup'
  | 'asset_type'
  | 'recommendation'
  | 'remediation_time'
  | 'mitigation_type'
  | 'detected_date'
  | 'registered_date'
  | 'status'
  | 'project'
  | 'comments'
  | 'security_comments';

export type OfficialFieldDef = {
  key: OfficialFieldKey;
  label: string;
  tier: FieldTier;
  required?: boolean;
  hint: string;
  aliases: readonly string[];
  /** Penaliza match si el encabezado CSV contiene estos tokens */
  negativeTokens?: readonly string[];
};

const STORAGE_KEY = 'phantom-universal-csv-user-aliases';

export const CORE_FIELD_KEYS: OfficialFieldKey[] = [
  'title',
  'description',
  'severity',
  'component',
  'cve',
  'cwe',
  'cvss',
  'impact',
  'remediation',
  'evidence',
  'method',
  'epss',
  'kev',
];

export const OPTIONAL_FIELD_KEYS: OfficialFieldKey[] = [
  'hosts',
  'asset_group',
  'asset_subgroup',
  'asset_type',
  'recommendation',
  'remediation_time',
  'mitigation_type',
  'detected_date',
  'registered_date',
  'status',
  'project',
  'comments',
  'security_comments',
];

export const OFFICIAL_FIELD_CATALOG: OfficialFieldDef[] = [
  {
    key: 'title',
    label: 'Título',
    tier: 'core',
    required: true,
    hint: 'Vulnerabilidad, plugin o nombre del hallazgo',
    aliases: [
      'title', 'titulo', 'título', 'vulnerability', 'vulnerabilidad', 'plugin name', 'finding', 'issue',
    ],
  },
  {
    key: 'description',
    label: 'Descripción',
    tier: 'core',
    hint: 'Detalle o sinopsis del hallazgo',
    aliases: ['description', 'descripcion', 'descripción', 'synopsis', 'summary', 'detalle'],
    negativeTokens: ['comentario', 'comment', 'justificacion', 'seguridad'],
  },
  {
    key: 'severity',
    label: 'Severidad',
    tier: 'core',
    hint: 'Nivel de riesgo',
    aliases: ['severity', 'severidad', 'risk', 'riesgo', 'criticality', 'priority'],
  },
  {
    key: 'component',
    label: 'Componentes afectados',
    tier: 'core',
    hint: 'Componente, URL o activo',
    aliases: ['component', 'componente', 'componentes afectados', 'affected components'],
    negativeTokens: ['grupo', 'group', 'tipo', 'type', 'proyecto', 'host', 'hosts'],
  },
  {
    key: 'hosts',
    label: 'Hosts afectados',
    tier: 'optional',
    hint: 'IP, hostname o hosts del export',
    aliases: ['hosts afectados', 'affected hosts', 'host', 'hosts', 'hostname', 'ip address'],
    negativeTokens: ['componente', 'component', 'grupo', 'group', 'proyecto', 'project'],
  },
  {
    key: 'asset_group',
    label: 'Grupo de activos',
    tier: 'optional',
    hint: 'Agrupación de activos (varios valores: ; , |)',
    aliases: ['grupo de activos', 'asset group', 'grupo activos', 'grupos de activos'],
  },
  {
    key: 'asset_subgroup',
    label: 'Subgrupo de activos',
    tier: 'optional',
    hint: 'Sub-agrupación (varios valores: ; , |)',
    aliases: [
      'subgrupo de activos',
      'sub grupo de activos',
      'subgrupos de activos',
      'asset subgroup',
      'sub grupo',
    ],
  },
  {
    key: 'asset_type',
    label: 'Tipo de activo',
    tier: 'optional',
    hint: 'Clasificación del activo',
    aliases: ['tipo de activo', 'asset type', 'tipo activo'],
  },
  {
    key: 'cve',
    label: 'CVE',
    tier: 'core',
    hint: 'Identificador CVE',
    aliases: ['cve', 'cves', 'cve id'],
  },
  {
    key: 'cwe',
    label: 'CWE',
    tier: 'core',
    hint: 'Identificador CWE',
    aliases: ['cwe', 'cwe id'],
  },
  {
    key: 'cvss',
    label: 'CVSS',
    tier: 'core',
    hint: 'Puntuación CVSS',
    aliases: ['cvss', 'cvss score', 'cvss base score'],
  },
  {
    key: 'impact',
    label: 'Impacto',
    tier: 'core',
    hint: 'Amenaza o consecuencia',
    aliases: ['impact', 'impacto', 'threat', 'amenaza'],
  },
  {
    key: 'remediation',
    label: 'Remediación',
    tier: 'core',
    hint: 'Solución técnica (no confundir con tiempo de remediación)',
    aliases: ['remediation', 'remediacion', 'remediación', 'solution', 'solucion', 'fix'],
    negativeTokens: ['tiempo', 'time', 'duration', 'sla', 'plazo', 'fecha'],
  },
  {
    key: 'recommendation',
    label: 'Recomendación',
    tier: 'optional',
    hint: 'Recomendación de remediación del export',
    aliases: ['recomendacion', 'recomendación', 'recommendation', 'recommendations'],
  },
  {
    key: 'remediation_time',
    label: 'Tiempo de remediación',
    tier: 'optional',
    hint: 'Plazo o SLA de remediación',
    aliases: [
      'tiempo de remediacion',
      'tiempo de remediación',
      'remediation time',
      'plazo de remediacion',
      'remediation sla',
    ],
  },
  {
    key: 'mitigation_type',
    label: 'Tipo de mitigación',
    tier: 'optional',
    hint: 'Clasificación de mitigación',
    aliases: ['tipo de mitigacion', 'tipo de mitigación', 'mitigation type', 'tipo mitigacion'],
  },
  {
    key: 'detected_date',
    label: 'Fecha de detección',
    tier: 'optional',
    hint: 'Cuándo se detectó',
    aliases: ['fecha de deteccion', 'fecha de detección', 'detected date', 'detection date'],
  },
  {
    key: 'registered_date',
    label: 'Fecha de registro',
    tier: 'optional',
    hint: 'Cuándo se registró en el sistema',
    aliases: ['fecha de registro', 'registered date', 'registration date'],
  },
  {
    key: 'status',
    label: 'Estatus',
    tier: 'optional',
    hint: 'Estado del hallazgo en el export',
    aliases: ['estatus', 'status', 'estado', 'state'],
  },
  {
    key: 'project',
    label: 'Proyecto',
    tier: 'optional',
    hint: 'Nombre de proyecto (referencia; el engagement se elige arriba)',
    aliases: ['proyecto', 'project', 'engagement'],
  },
  {
    key: 'comments',
    label: 'Comentarios / justificación',
    tier: 'optional',
    hint: 'Notas o justificación',
    aliases: [
      'comentarios',
      'comentarios/justificación',
      'comentarios justificacion',
      'justificacion',
      'justificación',
      'comments',
    ],
  },
  {
    key: 'security_comments',
    label: 'Comentarios de seguridad',
    tier: 'optional',
    hint: 'Notas del equipo de seguridad',
    aliases: ['comentarios de seguridad', 'security comments', 'comentarios seguridad'],
  },
  {
    key: 'evidence',
    label: 'Evidencia',
    tier: 'core',
    hint: 'Salida del escáner o prueba',
    aliases: ['evidence', 'evidencia', 'plugin output', 'output', 'proof'],
  },
  {
    key: 'method',
    label: 'Herramienta de detección',
    tier: 'core',
    hint: 'Scanner o método',
    aliases: [
      'herramienta de deteccion',
      'herramienta de detección',
      'detection tool',
      'method',
      'metodo',
      'scanner',
    ],
    negativeTokens: ['fecha', 'date', 'registro'],
  },
  {
    key: 'epss',
    label: 'EPSS',
    tier: 'core',
    hint: 'Exploit Prediction Score',
    aliases: ['epss', 'epss score'],
  },
  {
    key: 'kev',
    label: 'KEV',
    tier: 'core',
    hint: 'Known Exploited Vulnerabilities',
    aliases: ['kev', 'kev listed', 'cisa kev', 'known exploited'],
  },
];

export function getFieldDef(key: OfficialFieldKey): OfficialFieldDef | undefined {
  return OFFICIAL_FIELD_CATALOG.find((f) => f.key === key);
}

export type UserAliasMap = Partial<Record<OfficialFieldKey, string[]>>;

export function loadUserAliases(): UserAliasMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as UserAliasMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveUserAliases(map: UserAliasMap): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getAliasesForField(key: OfficialFieldKey, userAliases?: UserAliasMap): string[] {
  const def = getFieldDef(key);
  const base = def ? [...def.aliases, key] : [key];
  const extra = userAliases?.[key] ?? loadUserAliases()[key] ?? [];
  return [...new Set([...base, ...extra.map((a) => a.trim()).filter(Boolean)])];
}

export function addUserAlias(key: OfficialFieldKey, alias: string): UserAliasMap {
  const trimmed = alias.trim();
  if (!trimmed) return loadUserAliases();
  const current = loadUserAliases();
  const list = [...(current[key] ?? [])];
  if (!list.some((a) => a.toLowerCase() === trimmed.toLowerCase())) {
    list.push(trimmed);
  }
  const next = { ...current, [key]: list };
  saveUserAliases(next);
  return next;
}

export function removeUserAlias(key: OfficialFieldKey, alias: string): UserAliasMap {
  const current = loadUserAliases();
  const list = (current[key] ?? []).filter((a) => a.toLowerCase() !== alias.toLowerCase());
  const next = { ...current };
  if (list.length) next[key] = list;
  else delete next[key];
  saveUserAliases(next);
  return next;
}
