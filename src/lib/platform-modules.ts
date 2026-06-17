/** Mapa M1–M17 del sistema Spectre (estado vs. especificación). */

export type ModuleStatus = 'live' | 'partial' | 'planned';

export type PlatformModule = {
  id: string;
  name: string;
  purpose: string;
  status: ModuleStatus;
  href?: string;
  phase?: string;
};

export const MODULE_STATUS_LABEL: Record<ModuleStatus, string> = {
  live: 'Operativo',
  partial: 'Parcial',
  planned: 'Planificado',
};

export const PLATFORM_MODULES: PlatformModule[] = [
  {
    id: 'M1',
    name: 'Core / Plataforma',
    purpose: 'Multi-tenant, RBAC, API REST, auditoría',
    status: 'partial',
    href: '/admin',
    phase: 'Fase 1',
  },
  {
    id: 'M2',
    name: 'Gestión de activos',
    purpose: 'Inventario IP, dominios, URLs, cloud',
    status: 'partial',
    href: '/assets',
    phase: 'Fase 1',
  },
  {
    id: 'M3',
    name: 'Ingesta y normalización',
    purpose: 'Escáneres, parser universal, deduplicación',
    status: 'partial',
    href: '/vul-mgmt',
    phase: 'Fase 1',
  },
  {
    id: 'M4',
    name: 'SAST',
    purpose: 'Análisis estático de código',
    status: 'partial',
    href: '/reports',
    phase: 'Fase 3',
  },
  {
    id: 'M5',
    name: 'DAST',
    purpose: 'Escaneo dinámico web',
    status: 'partial',
    href: '/reports',
    phase: 'Fase 3',
  },
  { id: 'M6', name: 'SCA', purpose: 'Composición de software', status: 'planned', phase: 'Fase 3' },
  { id: 'M7', name: 'Container / Trivy', purpose: 'Imágenes e IaC', status: 'planned', phase: 'Fase 3' },
  { id: 'M8', name: 'Cloud / CSPM', purpose: 'AWS, GCP, Azure', status: 'planned', phase: 'Fase 5' },
  {
    id: 'M9',
    name: 'Network',
    purpose: 'Nessus, Nmap, red',
    status: 'partial',
    href: '/tools/nmap',
    phase: 'Fase 1',
  },
  {
    id: 'M10',
    name: 'Pentest lifecycle',
    purpose: 'Proyecto, 7 pasos, hallazgos, reportes',
    status: 'live',
    href: '/reports',
    phase: 'Fase 2',
  },
  { id: 'M11', name: 'Risk scoring', purpose: 'CVSS, EPSS, KEV, priorización', status: 'partial', href: '/tablero', phase: 'Fase 5' },
  {
    id: 'M12',
    name: 'IA / Triage',
    purpose: 'Gemini, catálogo, revisión asistida',
    status: 'partial',
    href: '/vulns-catalog',
    phase: 'Fase 4',
  },
  { id: 'M13', name: 'Portal cliente', purpose: 'Vista filtrada read-only', status: 'partial', href: '/portal', phase: 'Fase 4' },
  {
    id: 'M14',
    name: 'Reporting',
    purpose: 'Word, plantillas, historial',
    status: 'partial',
    href: '/reports',
    phase: 'Fase 2',
  },
  {
    id: 'M15',
    name: 'Remediación',
    purpose: 'Estados, retest, SLAs',
    status: 'partial',
    href: '/vul-mgmt',
    phase: 'Fase 6',
  },
  {
    id: 'M16',
    name: 'Métricas',
    purpose: 'KPIs, tendencias, dashboards',
    status: 'partial',
    href: '/',
    phase: 'Fase 6',
  },
  {
    id: 'M17',
    name: 'Compliance',
    purpose: 'PCI, ISO, NIST, OWASP',
    status: 'partial',
    href: '/compliance',
    phase: 'Fase 6',
  },
];
