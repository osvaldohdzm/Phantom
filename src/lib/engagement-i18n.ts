import type { EngagementFormState } from '@/lib/engagement-profile';
import {
  ALCANCE_RED,
  ESTADOS_SERVICIO,
  INTRUSIVIDAD,
  METODOS_ANALISIS,
  REPORTING_OPTIONS,
  TIPOS_ANALISIS,
  TIPOS_SERVICIO,
  type TipoAnalisis,
} from '@/lib/engagement-profile';
import type { TenantLanguage } from '@/lib/tenant-locale';
import { uiT, type UiMessageKey } from '@/lib/ui-locale';

const SERVICE_TYPE_KEYS: Record<string, UiMessageKey> = {
  Pentest: 'engSvcPentest',
  'AV Infraestructura': 'engSvcAvInfra',
  DAST: 'engSvcDast',
  SAST: 'engSvcSast',
  'AV Cloud': 'engSvcAvCloud',
  API: 'engSvcApi',
  Infraestructura: 'engSvcInfra',
  Cloud: 'engSvcCloud',
  Mobile: 'engSvcMobile',
};

const STATUS_KEYS: Record<string, UiMessageKey> = {
  Planificado: 'engStatusPlanned',
  'En curso': 'engStatusInProgress',
  'En pausa': 'engStatusPaused',
  Completado: 'engStatusCompleted',
  Cancelado: 'engStatusCancelled',
};

const ANALYSIS_KEYS: Record<TipoAnalisis, UiMessageKey> = {
  'Caja Negra': 'engAnalysisBlack',
  'Caja Gris': 'engAnalysisGrey',
  'Caja Blanca': 'engAnalysisWhite',
};

const METHOD_KEYS: Record<string, UiMessageKey> = {
  Manual: 'engMethodManual',
  Automático: 'engMethodAuto',
  Híbrido: 'engMethodHybrid',
};

const NETWORK_SCOPE_KEYS: Record<string, UiMessageKey> = {
  Interno: 'engNetInternal',
  Externo: 'engNetExternal',
};

const INTRUSION_KEYS: Record<string, UiMessageKey> = {
  Intrusivo: 'engIntrusionYes',
  'No intrusivo': 'engIntrusionNo',
};

const SCOPE_FIELD_KEYS: Record<string, UiMessageKey> = {
  ips: 'engScopeIps',
  dominios: 'engScopeDomains',
  urls: 'engScopeUrls',
  ambientes: 'engScopeEnvironments',
  activos_incluidos: 'engScopeIncluded',
  activos_excluidos: 'engScopeExcluded',
};

const PENTEST_INFRA_KEYS: Record<string, UiMessageKey> = {
  ip_objetivo: 'engInfraTargetIp',
  segmento_red: 'engInfraNetworkSegment',
  firewall_waf: 'engInfraFirewallWaf',
  servicios_criticos: 'engInfraCriticalServices',
};

const REPORTING_KEYS: Record<string, UiMessageKey> = {
  severidad: 'engReportingSeverity',
  cvss: 'engReportingCvss',
  cwe: 'engReportingCwe',
  owasp: 'engReportingOwasp',
  mitre: 'engReportingMitre',
  evidencia: 'engReportingEvidence',
  remediacion: 'engReportingRemediation',
  estado: 'engReportingStatus',
};

export function labelServiceType(value: string | null | undefined, lang: TenantLanguage): string {
  if (!value) return uiT('engNoType', lang);
  const key = SERVICE_TYPE_KEYS[value];
  return key ? uiT(key, lang) : value;
}

export function labelEngagementStatus(value: string | null | undefined, lang: TenantLanguage): string {
  if (!value) return uiT('engStatusPlanned', lang);
  const key = STATUS_KEYS[value];
  return key ? uiT(key, lang) : value;
}

export function labelAnalysisType(value: string, lang: TenantLanguage): string {
  const key = ANALYSIS_KEYS[value as TipoAnalisis];
  return key ? uiT(key, lang) : value;
}

export function labelAnalysisMethod(value: string, lang: TenantLanguage): string {
  if (!value) return '—';
  const key = METHOD_KEYS[value];
  return key ? uiT(key, lang) : value;
}

export function labelNetworkScope(value: string, lang: TenantLanguage): string {
  if (!value) return '—';
  const key = NETWORK_SCOPE_KEYS[value];
  return key ? uiT(key, lang) : value;
}

export function labelIntrusiveness(value: string, lang: TenantLanguage): string {
  if (!value) return '—';
  const key = INTRUSION_KEYS[value];
  return key ? uiT(key, lang) : value;
}

export function labelScopeField(key: string, lang: TenantLanguage): string {
  const msg = SCOPE_FIELD_KEYS[key];
  return msg ? uiT(msg, lang) : key;
}

export function labelPentestInfraField(key: string, lang: TenantLanguage): string {
  const msg = PENTEST_INFRA_KEYS[key];
  return msg ? uiT(msg, lang) : key;
}

export function labelReportingOption(key: string, lang: TenantLanguage): string {
  const msg = REPORTING_KEYS[key];
  return msg ? uiT(msg, lang) : key;
}

export function serviceTypeOptions(lang: TenantLanguage) {
  return TIPOS_SERVICIO.map((value) => ({ value, label: labelServiceType(value, lang) }));
}

export function statusOptions(lang: TenantLanguage) {
  return ESTADOS_SERVICIO.map((value) => ({ value, label: labelEngagementStatus(value, lang) }));
}

export function analysisTypeOptions(lang: TenantLanguage) {
  return TIPOS_ANALISIS.map((value) => ({ value, label: labelAnalysisType(value, lang) }));
}

export function analysisMethodOptions(lang: TenantLanguage) {
  return METODOS_ANALISIS.map((value) => ({ value, label: labelAnalysisMethod(value, lang) }));
}

export function networkScopeOptions(lang: TenantLanguage) {
  return ALCANCE_RED.map((value) => ({ value, label: labelNetworkScope(value, lang) }));
}

export function intrusivenessOptions(lang: TenantLanguage) {
  return INTRUSIVIDAD.map((value) => ({ value, label: labelIntrusiveness(value, lang) }));
}

export function reportingOptions(lang: TenantLanguage) {
  return REPORTING_OPTIONS.map(({ key }) => ({
    key,
    label: labelReportingOption(key, lang),
  }));
}

export function validateEngagementFormI18n(
  form: EngagementFormState,
  lang: TenantLanguage
): { valid: boolean; errors: string[]; missingKeys: Set<string> } {
  const errors: string[] = [];
  const missingKeys = new Set<string>();
  const hasCliente = Boolean(form.cliente.trim());
  const hasNombre = Boolean(form.nombre_proyecto.trim());
  if (!hasCliente && !hasNombre) {
    errors.push(uiT('engValClientOrName', lang));
    missingKeys.add('cliente');
    missingKeys.add('nombre_proyecto');
  }
  if (!form.tipo_servicio) {
    errors.push(uiT('engValServiceType', lang));
    missingKeys.add('tipo_servicio');
  }
  if (!form.fecha_inicio) {
    errors.push(uiT('engValStartDate', lang));
    missingKeys.add('fecha_inicio');
  }
  return { valid: errors.length === 0, errors, missingKeys };
}

export function formatEngagementDate(iso: string | null | undefined, lang: TenantLanguage): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}
