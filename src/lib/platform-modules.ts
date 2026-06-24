/** Mapa M1–M17 del sistema Spectre (estado vs. especificación). */

import type { TenantLanguage } from '@/lib/tenant-locale';

export type ModuleStatus = 'live' | 'partial' | 'planned';

export type PlatformModule = {
  id: string;
  name: string;
  purpose: string;
  status: ModuleStatus;
  href?: string;
  phase?: string;
};

type LocalizedModule = {
  id: string;
  name: Record<TenantLanguage, string>;
  purpose: Record<TenantLanguage, string>;
  status: ModuleStatus;
  href?: string;
  phase?: Record<TenantLanguage, string>;
};

const MODULE_CATALOG: LocalizedModule[] = [
  {
    id: 'M1',
    name: { es: 'Core / Plataforma', en: 'Core / Platform' },
    purpose: {
      es: 'Multi-tenant, RBAC, API REST, auditoría',
      en: 'Multi-tenant, RBAC, REST API, audit',
    },
    status: 'partial',
    href: '/admin',
    phase: { es: 'Fase 1', en: 'Phase 1' },
  },
  {
    id: 'M2',
    name: { es: 'Gestión de activos', en: 'Asset management' },
    purpose: {
      es: 'Inventario IP, dominios, URLs, cloud',
      en: 'IP inventory, domains, URLs, cloud',
    },
    status: 'partial',
    href: '/assets',
    phase: { es: 'Fase 1', en: 'Phase 1' },
  },
  {
    id: 'M3',
    name: { es: 'Ingesta y normalización', en: 'Ingest & normalization' },
    purpose: {
      es: 'Escáneres, parser universal, deduplicación',
      en: 'Scanners, universal parser, deduplication',
    },
    status: 'partial',
    href: '/vul-mgmt',
    phase: { es: 'Fase 1', en: 'Phase 1' },
  },
  {
    id: 'M4',
    name: { es: 'SAST', en: 'SAST' },
    purpose: { es: 'Análisis estático de código', en: 'Static code analysis' },
    status: 'partial',
    href: '/reports',
    phase: { es: 'Fase 3', en: 'Phase 3' },
  },
  {
    id: 'M5',
    name: { es: 'DAST', en: 'DAST' },
    purpose: { es: 'Escaneo dinámico web', en: 'Dynamic web scanning' },
    status: 'partial',
    href: '/reports',
    phase: { es: 'Fase 3', en: 'Phase 3' },
  },
  {
    id: 'M6',
    name: { es: 'SCA', en: 'SCA' },
    purpose: { es: 'Composición de software', en: 'Software composition' },
    status: 'planned',
    phase: { es: 'Fase 3', en: 'Phase 3' },
  },
  {
    id: 'M7',
    name: { es: 'Container / Trivy', en: 'Container / Trivy' },
    purpose: { es: 'Imágenes e IaC', en: 'Images and IaC' },
    status: 'planned',
    phase: { es: 'Fase 3', en: 'Phase 3' },
  },
  {
    id: 'M8',
    name: { es: 'Cloud / CSPM', en: 'Cloud / CSPM' },
    purpose: { es: 'AWS, GCP, Azure', en: 'AWS, GCP, Azure' },
    status: 'planned',
    phase: { es: 'Fase 5', en: 'Phase 5' },
  },
  {
    id: 'M9',
    name: { es: 'Network', en: 'Network' },
    purpose: { es: 'Nessus, Nmap, red', en: 'Nessus, Nmap, network' },
    status: 'partial',
    href: '/tools/nmap',
    phase: { es: 'Fase 1', en: 'Phase 1' },
  },
  {
    id: 'M10',
    name: { es: 'Pentest lifecycle', en: 'Pentest lifecycle' },
    purpose: {
      es: 'Servicio, 7 pasos, hallazgos, entregable Word',
      en: 'Service, 7 steps, findings, Word deliverable',
    },
    status: 'live',
    href: '/reports',
    phase: { es: 'Fase 2', en: 'Phase 2' },
  },
  {
    id: 'M11',
    name: { es: 'Risk scoring', en: 'Risk scoring' },
    purpose: {
      es: 'CVSS, EPSS, KEV, priorización',
      en: 'CVSS, EPSS, KEV, prioritization',
    },
    status: 'partial',
    href: '/tablero',
    phase: { es: 'Fase 5', en: 'Phase 5' },
  },
  {
    id: 'M12',
    name: { es: 'IA / Triage', en: 'AI / Triage' },
    purpose: {
      es: 'Gemini, catálogo, revisión asistida',
      en: 'Gemini, catalog, assisted review',
    },
    status: 'partial',
    href: '/vulns-catalog',
    phase: { es: 'Fase 4', en: 'Phase 4' },
  },
  {
    id: 'M13',
    name: { es: 'Portal cliente', en: 'Client portal' },
    purpose: { es: 'Vista filtrada read-only', en: 'Filtered read-only view' },
    status: 'partial',
    href: '/portal',
    phase: { es: 'Fase 4', en: 'Phase 4' },
  },
  {
    id: 'M14',
    name: { es: 'Reporting', en: 'Reporting' },
    purpose: {
      es: 'Exportación Word CYB001 (paso final del servicio)',
      en: 'CYB001 Word export (final service step)',
    },
    status: 'partial',
    href: '/reports',
    phase: { es: 'Fase 2', en: 'Phase 2' },
  },
  {
    id: 'M15',
    name: { es: 'Remediación', en: 'Remediation' },
    purpose: { es: 'Estados, retest, SLAs', en: 'Statuses, retest, SLAs' },
    status: 'partial',
    href: '/vul-mgmt',
    phase: { es: 'Fase 6', en: 'Phase 6' },
  },
  {
    id: 'M16',
    name: { es: 'Métricas', en: 'Metrics' },
    purpose: { es: 'KPIs, tendencias, dashboards', en: 'KPIs, trends, dashboards' },
    status: 'partial',
    href: '/',
    phase: { es: 'Fase 6', en: 'Phase 6' },
  },
  {
    id: 'M17',
    name: { es: 'Compliance', en: 'Compliance' },
    purpose: { es: 'PCI, ISO, NIST, OWASP', en: 'PCI, ISO, NIST, OWASP' },
    status: 'partial',
    href: '/compliance',
    phase: { es: 'Fase 6', en: 'Phase 6' },
  },
];

const STATUS_LABELS: Record<TenantLanguage, Record<ModuleStatus, string>> = {
  es: { live: 'Operativo', partial: 'Parcial', planned: 'Planificado' },
  en: { live: 'Live', partial: 'Partial', planned: 'Planned' },
};

/** @deprecated Use moduleStatusLabel(status, lang) */
export const MODULE_STATUS_LABEL: Record<ModuleStatus, string> = STATUS_LABELS.es;

export function moduleStatusLabel(status: ModuleStatus, lang: TenantLanguage): string {
  return STATUS_LABELS[lang][status];
}

export function platformModules(lang: TenantLanguage): PlatformModule[] {
  return MODULE_CATALOG.map((m) => ({
    id: m.id,
    name: m.name[lang],
    purpose: m.purpose[lang],
    status: m.status,
    href: m.href,
    phase: m.phase?.[lang],
  }));
}

/** @deprecated Use platformModules(lang) */
export const PLATFORM_MODULES: PlatformModule[] = platformModules('es');
