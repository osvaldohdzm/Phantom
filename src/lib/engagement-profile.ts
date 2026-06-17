export const TIPOS_ANALISIS = ['Caja Negra', 'Caja Gris', 'Caja Blanca'] as const;
export type TipoAnalisis = (typeof TIPOS_ANALISIS)[number];

export const PRIMARY_SERVICE_TYPES = [
  'Pentest',
  'AV Infraestructura',
  'DAST',
  'SAST',
  'AV Cloud',
] as const;

export type PrimaryServiceType = (typeof PRIMARY_SERVICE_TYPES)[number];

export const TIPOS_SERVICIO = [
  ...PRIMARY_SERVICE_TYPES,
  'API',
  'Infraestructura',
  'Cloud',
  'Mobile',
] as const;
export type TipoServicio = (typeof TIPOS_SERVICIO)[number];

export const ESTADOS_SERVICIO = [
  'Planificado',
  'En curso',
  'En pausa',
  'Completado',
  'Cancelado',
] as const;

/** @deprecated use ESTADOS_SERVICIO */
export const ESTADOS_PROYECTO = ESTADOS_SERVICIO;

export const METODOS_ANALISIS = ['Manual', 'Automático', 'Híbrido'] as const;
export const ALCANCE_RED = ['Interno', 'Externo'] as const;
export const INTRUSIVIDAD = ['Intrusivo', 'No intrusivo'] as const;
export const SCM_OPTIONS = ['GitHub', 'GitLab'] as const;

export const HERRAMIENTAS = [
  { key: 'nmap', label: 'Nmap' },
  { key: 'burp_suite', label: 'Burp Suite' },
  { key: 'owasp_zap', label: 'OWASP ZAP' },
  { key: 'nessus', label: 'Nessus' },
  { key: 'metasploit', label: 'Metasploit' },
  { key: 'nuclei', label: 'Nuclei' },
] as const;

export const REPORTING_OPTIONS = [
  { key: 'severidad', label: 'Severidad' },
  { key: 'cvss', label: 'CVSS' },
  { key: 'cwe', label: 'CWE' },
  { key: 'owasp', label: 'OWASP' },
  { key: 'mitre', label: 'MITRE' },
  { key: 'evidencia', label: 'Evidencia' },
  { key: 'remediacion', label: 'Remediación' },
  { key: 'estado', label: 'Estado' },
] as const;

export interface EngagementProfileAlcance {
  ips: string;
  dominios: string;
  urls: string;
  ambientes: string;
  activos_incluidos: string;
  activos_excluidos: string;
}

export interface EngagementProfileTipoAnalisis {
  metodo: string;
  alcance_red: string;
  intrusivo: string;
}

export interface EngagementProfileAccesos {
  credenciales_entregadas: boolean;
  credenciales_notas?: string | null;
  vpn_requerida: boolean;
  vpn_notas?: string | null;
  usuarios_prueba: boolean;
  usuarios_prueba_notas?: string | null;
  codigo_fuente_entregado: boolean;
  codigo_fuente_notas?: string | null;
  documentacion_entregada: boolean;
  documentacion_notas?: string | null;
}

export interface EngagementProfileReglas {
  horarios_permitidos: string;
  dos_permitido: boolean;
  explotacion_permitida: boolean;
  ingenieria_social_permitida: boolean;
  contacto_emergencia: string;
}

export interface EngagementProfileHerramientas {
  nmap: boolean;
  burp_suite: boolean;
  owasp_zap: boolean;
  nessus: boolean;
  metasploit: boolean;
  nuclei: boolean;
}

export interface EngagementProfileDast {
  url_objetivo: string;
  login_url: string;
  auth_requerida: boolean;
  headers_custom: string;
}

export interface EngagementProfileSast {
  repositorio: string;
  branch: string;
  lenguaje: string;
  scm: string;
}

export interface EngagementProfilePentestInfra {
  ip_objetivo: string;
  segmento_red: string;
  firewall_waf: string;
  servicios_criticos: string;
}

export interface EngagementProfileReporting {
  severidad: boolean;
  cvss: boolean;
  cwe: boolean;
  owasp: boolean;
  mitre: boolean;
  evidencia: boolean;
  remediacion: boolean;
  estado: boolean;
}

export interface EngagementProfile {
  is_default?: boolean;
  alcance: EngagementProfileAlcance;
  tipo_analisis: EngagementProfileTipoAnalisis;
  accesos: EngagementProfileAccesos;
  reglas: EngagementProfileReglas;
  herramientas: EngagementProfileHerramientas;
  dast: EngagementProfileDast;
  sast: EngagementProfileSast;
  pentest_infra: EngagementProfilePentestInfra;
  reporting: EngagementProfileReporting;
}

export interface EngagementFormState {
  cliente: string;
  nombre_proyecto: string;
  tipo_servicio: string;
  estado: string;
  responsable: string;
  fecha_inicio: string;
  fecha_fin: string;
  tipo: TipoAnalisis;
  profile: EngagementProfile;
}

export function defaultEngagementProfile(): EngagementProfile {
  return {
    alcance: {
      ips: '',
      dominios: '',
      urls: '',
      ambientes: '',
      activos_incluidos: '',
      activos_excluidos: '',
    },
    tipo_analisis: { metodo: '', alcance_red: '', intrusivo: '' },
    accesos: {
      credenciales_entregadas: false,
      credenciales_notas: '',
      vpn_requerida: false,
      vpn_notas: '',
      usuarios_prueba: false,
      usuarios_prueba_notas: '',
      codigo_fuente_entregado: false,
      codigo_fuente_notas: '',
      documentacion_entregada: false,
      documentacion_notas: '',
    },
    reglas: {
      horarios_permitidos: '',
      dos_permitido: false,
      explotacion_permitida: false,
      ingenieria_social_permitida: false,
      contacto_emergencia: '',
    },
    herramientas: {
      nmap: false,
      burp_suite: false,
      owasp_zap: false,
      nessus: false,
      metasploit: false,
      nuclei: false,
    },
    dast: {
      url_objetivo: '',
      login_url: '',
      auth_requerida: false,
      headers_custom: '',
    },
    sast: { repositorio: '', branch: '', lenguaje: '', scm: '' },
    pentest_infra: {
      ip_objetivo: '',
      segmento_red: '',
      firewall_waf: '',
      servicios_criticos: '',
    },
    reporting: {
      severidad: true,
      cvss: true,
      cwe: true,
      owasp: true,
      mitre: true,
      evidencia: true,
      remediacion: true,
      estado: true,
    },
  };
}

export function defaultEngagementForm(): EngagementFormState {
  return {
    cliente: '',
    nombre_proyecto: '',
    tipo_servicio: '',
    estado: 'Planificado',
    responsable: '',
    fecha_inicio: new Date().toISOString().slice(0, 10),
    fecha_fin: '',
    tipo: 'Caja Negra',
    profile: defaultEngagementProfile(),
  };
}

export type EngagementSectionId =
  | 'alcance'
  | 'tipo_analisis'
  | 'accesos'
  | 'reglas'
  | 'herramientas'
  | 'dast'
  | 'sast'
  | 'pentest_infra'
  | 'reporting';

/** Secciones visibles según tipo de servicio (el bloque «Proyecto» siempre se muestra). */
export function sectionsForTipoServicio(tipo: string): EngagementSectionId[] {
  const common: EngagementSectionId[] = [
    'alcance',
    'tipo_analisis',
    'accesos',
    'reglas',
    'reporting',
  ];
  switch (tipo) {
    case 'DAST':
    case 'API':
    case 'Mobile':
      return [...common, 'herramientas', 'dast'];
    case 'SAST':
      return ['accesos', 'reglas', 'sast', 'reporting'];
    case 'AV Infraestructura':
    case 'Infraestructura':
    case 'Cloud':
    case 'AV Cloud':
      return [...common, 'herramientas', 'pentest_infra'];
    case 'Pentest':
      return [...common, 'herramientas', 'pentest_infra'];
    default:
      return common;
  }
}

export type EngagementValidation = {
  valid: boolean;
  errors: string[];
  missingKeys: Set<string>;
};

export function validateEngagementForm(form: EngagementFormState): EngagementValidation {
  const errors: string[] = [];
  const missingKeys = new Set<string>();
  const hasCliente = form.cliente.trim().length > 0;
  const hasNombre = form.nombre_proyecto.trim().length > 0;

  if (!hasCliente && !hasNombre) {
    errors.push('Indica el cliente o el nombre del proyecto (mínimo uno de los dos).');
    missingKeys.add('cliente');
    missingKeys.add('nombre_proyecto');
  }
  if (!form.tipo_servicio) {
    errors.push('Selecciona el tipo de servicio.');
    missingKeys.add('tipo_servicio');
  }
  if (!form.fecha_inicio) {
    errors.push('Indica la fecha de inicio.');
    missingKeys.add('fecha_inicio');
  }

  return { valid: errors.length === 0, errors, missingKeys };
}

/** Cliente guardado en BD: cliente explícito o nombre de proyecto como respaldo. */
export function resolveClienteForSave(form: EngagementFormState): string {
  return form.cliente.trim() || form.nombre_proyecto.trim();
}

export function mergeEngagementProfile(
  partial?: Partial<EngagementProfile> | null
): EngagementProfile {
  const base = defaultEngagementProfile();
  if (!partial) return base;
  return {
    alcance: { ...base.alcance, ...partial.alcance },
    tipo_analisis: { ...base.tipo_analisis, ...partial.tipo_analisis },
    accesos: { ...base.accesos, ...partial.accesos },
    reglas: { ...base.reglas, ...partial.reglas },
    herramientas: { ...base.herramientas, ...partial.herramientas },
    dast: { ...base.dast, ...partial.dast },
    sast: { ...base.sast, ...partial.sast },
    pentest_infra: { ...base.pentest_infra, ...partial.pentest_infra },
    reporting: { ...base.reporting, ...partial.reporting },
  };
}
