import type { TenantLanguage } from '@/lib/tenant-locale';
import { coerceTenantLanguage } from '@/lib/tenant-locale';
import type { ReportFlow, ReportFlowId } from '@/lib/reports-flows/types';

type StepCopy = { label: string; shortLabel: string; description: string };
type FlowCopy = {
  label: string;
  subtitle: string;
  ingest: { cardTitle: string; cardDescription: string };
  steps: StepCopy[];
};

const FLOW_COPY: Record<ReportFlowId, Record<TenantLanguage, FlowCopy>> = {
  pentest: {
    es: {
      label: 'Pentest',
      subtitle:
        'Servicio de pentest en infraestructura, red y aplicación — Nessus, Nmap, CSV universal y hallazgos manuales.',
      ingest: {
        cardTitle: 'Ingesta de scanners',
        cardDescription:
          'Nessus, Acunetix, Nmap o CSV universal con asistente de mapeo. Tras importar, revisa tipos en catálogo y el desglose por activo.',
      },
      steps: [
        {
          label: 'Servicio',
          shortLabel: 'Servicio',
          description: 'Define alcance, accesos y reglas del engagement de pentest.',
        },
        {
          label: 'Importación',
          shortLabel: 'Importar',
          description: 'Nessus CSV, Acunetix HTML o salida Nmap.',
        },
        {
          label: 'Manuales',
          shortLabel: 'Manuales',
          description: 'Hallazgos descubiertos manualmente (explotación, evidencia, capturas).',
        },
        {
          label: 'Revisión de vulnerabilidades',
          shortLabel: 'Tipos',
          description:
            'Una fila por tipo en catálogo: edita campos operativos sin repetir IP, puerto ni URL. Propaga a todo el servicio.',
        },
        {
          label: 'Revisión desglosada',
          shortLabel: 'Desglosada',
          description:
            'Cada instancia por activo (IP, puerto, URL). Deduplica, filtra severidad y completa CYB001.',
        },
        {
          label: 'Overview',
          shortLabel: 'Overview',
          description: 'KPIs y distribución de severidad antes del informe.',
        },
        {
          label: 'Word',
          shortLabel: 'Word',
          description: 'Plantilla CYB001 y exportación consolidada.',
        },
      ],
    },
    en: {
      label: 'Pentest',
      subtitle:
        'Infrastructure, network and application pentest — Nessus, Nmap, universal CSV and manual findings.',
      ingest: {
        cardTitle: 'Scanner import',
        cardDescription:
          'Nessus, Acunetix, Nmap or universal CSV with mapping assistant. After import, review types in catalog and per-asset breakdown.',
      },
      steps: [
        {
          label: 'Service',
          shortLabel: 'Service',
          description: 'Define scope, access and rules for the pentest engagement.',
        },
        {
          label: 'Import',
          shortLabel: 'Import',
          description: 'Nessus CSV, Acunetix HTML or Nmap output.',
        },
        {
          label: 'Manual',
          shortLabel: 'Manual',
          description: 'Manually discovered findings (exploitation, evidence, screenshots).',
        },
        {
          label: 'Vulnerability review',
          shortLabel: 'Types',
          description:
            'One row per catalog type: edit operational fields once without repeating IP, port or URL. Propagates to the whole service.',
        },
        {
          label: 'Detailed review',
          shortLabel: 'Detailed',
          description:
            'Each instance per asset (IP, port, URL). Deduplicate, filter severity and complete CYB001.',
        },
        {
          label: 'Overview',
          shortLabel: 'Overview',
          description: 'KPIs and severity distribution before the report.',
        },
        {
          label: 'Word',
          shortLabel: 'Word',
          description: 'CYB001 template and consolidated export.',
        },
      ],
    },
  },
  'av-infra': {
    es: {
      label: 'AV Infraestructura',
      subtitle:
        'Servicio de análisis de vulnerabilidades en infraestructura — primer escaneo o re-escaneos Nessus periódicos.',
      ingest: {
        cardTitle: 'Ingesta Nessus (CSV)',
        cardDescription:
          'Primer escaneo: carga inicial al repositorio. Re-escaneo: compara con hallazgos existentes (atendido / remediado / reaparecido). Hasta 150 MB por archivo.',
      },
      steps: [
        {
          label: 'Campaña',
          shortLabel: 'Campaña',
          description: 'Alcance, periodicidad y grupos de activos del servicio AV.',
        },
        {
          label: 'Ingesta Nessus',
          shortLabel: 'Ingesta',
          description: 'CSV Nessus — primer escaneo o re-escaneo con comparación al repositorio.',
        },
        {
          label: 'Excepciones',
          shortLabel: 'Manual',
          description: 'Falsos positivos y hallazgos fuera de scanner.',
        },
        {
          label: 'Revisión por tipo',
          shortLabel: 'Tipos',
          description: 'Consolidado por tipo de vulnerabilidad.',
        },
        {
          label: 'Matriz desglosada',
          shortLabel: 'Desglosada',
          description: 'Instancias por activo con estados AV.',
        },
        {
          label: 'Overview',
          shortLabel: 'Overview',
          description: 'KPIs: nuevas, ausentes, reaparecidas.',
        },
        {
          label: 'Word',
          shortLabel: 'Word',
          description: 'Informe CYB001 del periodo.',
        },
      ],
    },
    en: {
      label: 'AV Infrastructure',
      subtitle:
        'Infrastructure vulnerability analysis — initial Nessus scan or periodic re-scans.',
      ingest: {
        cardTitle: 'Nessus import (CSV)',
        cardDescription:
          'Initial scan: first load into repository. Re-scan: compares with existing findings (addressed / remediated / reappeared). Up to 150 MB per file.',
      },
      steps: [
        {
          label: 'Campaign',
          shortLabel: 'Campaign',
          description: 'Scope, cadence and asset groups for the AV service.',
        },
        {
          label: 'Nessus import',
          shortLabel: 'Import',
          description: 'Nessus CSV — initial scan or re-scan compared to repository.',
        },
        {
          label: 'Exceptions',
          shortLabel: 'Manual',
          description: 'False positives and out-of-scanner findings.',
        },
        {
          label: 'Review by type',
          shortLabel: 'Types',
          description: 'Consolidated by vulnerability type.',
        },
        {
          label: 'Detailed matrix',
          shortLabel: 'Detailed',
          description: 'Per-asset instances with AV statuses.',
        },
        {
          label: 'Overview',
          shortLabel: 'Overview',
          description: 'KPIs: new, absent, reappeared.',
        },
        {
          label: 'Word',
          shortLabel: 'Word',
          description: 'CYB001 report for the period.',
        },
      ],
    },
  },
  dast: {
    es: {
      label: 'DAST',
      subtitle:
        'Servicio DAST en aplicación web y API expuesta — URLs, autenticación y scanners dinámicos.',
      ingest: {
        cardTitle: 'Importar hallazgos DAST',
        cardDescription:
          'Acunetix HTML o exportaciones compatibles. Tras importar revisa tipos en catálogo y luego el desglose por URL.',
      },
      steps: [
        {
          label: 'Servicio',
          shortLabel: 'Servicio',
          description: 'URLs objetivo, login, headers y reglas del escaneo dinámico.',
        },
        {
          label: 'Importación DAST',
          shortLabel: 'Importar',
          description: 'Carga resultados del scanner web (Acunetix u otros).',
        },
        {
          label: 'Hallazgos web',
          shortLabel: 'Manuales',
          description: 'Vulnerabilidades validadas a mano en la aplicación (PoC, capturas).',
        },
        {
          label: 'Revisión de vulnerabilidades',
          shortLabel: 'Tipos',
          description: 'Edita cada tipo de hallazgo en catálogo (sin repetir por URL).',
        },
        {
          label: 'Revisión desglosada',
          shortLabel: 'Desglosada',
          description: 'Alinea hallazgos con URLs/rutas, quita falsos positivos y completa remediación.',
        },
        {
          label: 'Overview',
          shortLabel: 'Overview',
          description: 'Resumen por severidad y superficie web antes del Word.',
        },
        {
          label: 'Informe Word',
          shortLabel: 'Word',
          description: 'Genera el informe DAST con plantilla CYB001.',
        },
      ],
    },
    en: {
      label: 'DAST',
      subtitle: 'Web application and exposed API DAST — URLs, authentication and dynamic scanners.',
      ingest: {
        cardTitle: 'Import DAST findings',
        cardDescription:
          'Acunetix HTML or compatible exports. After import review catalog types then URL breakdown.',
      },
      steps: [
        {
          label: 'Service',
          shortLabel: 'Service',
          description: 'Target URLs, login, headers and dynamic scan rules.',
        },
        {
          label: 'DAST import',
          shortLabel: 'Import',
          description: 'Load web scanner results (Acunetix or others).',
        },
        {
          label: 'Web findings',
          shortLabel: 'Manual',
          description: 'Manually validated application vulnerabilities (PoC, screenshots).',
        },
        {
          label: 'Vulnerability review',
          shortLabel: 'Types',
          description: 'Edit each finding type in catalog (without repeating per URL).',
        },
        {
          label: 'Detailed review',
          shortLabel: 'Detailed',
          description: 'Align findings with URLs/routes, remove false positives and complete remediation.',
        },
        {
          label: 'Overview',
          shortLabel: 'Overview',
          description: 'Severity and web surface summary before Word export.',
        },
        {
          label: 'Word report',
          shortLabel: 'Word',
          description: 'Generate DAST report with CYB001 template.',
        },
      ],
    },
  },
  sast: {
    es: {
      label: 'SAST',
      subtitle:
        'Servicio SAST en código fuente y repositorios — análisis estático y revisión de hallazgos.',
      ingest: {
        cardTitle: 'Ingesta SAST',
        cardDescription:
          'Exportaciones del analizador estático (CSV u otros formatos tabulares). Revisa repo, branch y lenguaje en el paso Servicio antes de consolidar.',
      },
      steps: [
        {
          label: 'Servicio',
          shortLabel: 'Servicio',
          description: 'Repositorio, branch, SCM y acceso al código del engagement SAST.',
        },
        {
          label: 'Importación SAST',
          shortLabel: 'Importar',
          description: 'Carga findings del scanner estático o del pipeline CI.',
        },
        {
          label: 'Hallazgos código',
          shortLabel: 'Manuales',
          description: 'Issues de revisión manual de código o hallazgos no detectados por el SAST.',
        },
        {
          label: 'Revisión de vulnerabilidades',
          shortLabel: 'Tipos',
          description: 'Edita cada regla CWE/tipo en catálogo antes del desglose por archivo.',
        },
        {
          label: 'Revisión desglosada',
          shortLabel: 'Desglosada',
          description: 'Triage por archivo/línea, CWE y propuesta de remediación en código.',
        },
        {
          label: 'Overview',
          shortLabel: 'Overview',
          description: 'Métricas del análisis estático antes de exportar.',
        },
        {
          label: 'Informe Word',
          shortLabel: 'Word',
          description: 'Informe SAST con plantilla CYB001.',
        },
      ],
    },
    en: {
      label: 'SAST',
      subtitle: 'Source code and repository SAST — static analysis and findings review.',
      ingest: {
        cardTitle: 'SAST import',
        cardDescription:
          'Static analyzer exports (CSV or other tabular formats). Review repo, branch and language in Service step before consolidating.',
      },
      steps: [
        {
          label: 'Service',
          shortLabel: 'Service',
          description: 'Repository, branch, SCM and code access for the SAST engagement.',
        },
        {
          label: 'SAST import',
          shortLabel: 'Import',
          description: 'Load static scanner or CI pipeline findings.',
        },
        {
          label: 'Code findings',
          shortLabel: 'Manual',
          description: 'Manual code review issues or findings not detected by SAST.',
        },
        {
          label: 'Vulnerability review',
          shortLabel: 'Types',
          description: 'Edit each CWE/type rule in catalog before file breakdown.',
        },
        {
          label: 'Detailed review',
          shortLabel: 'Detailed',
          description: 'Triage by file/line, CWE and code remediation proposal.',
        },
        {
          label: 'Overview',
          shortLabel: 'Overview',
          description: 'Static analysis metrics before export.',
        },
        {
          label: 'Word report',
          shortLabel: 'Word',
          description: 'SAST report with CYB001 template.',
        },
      ],
    },
  },
};

export function localizeReportFlow(flow: ReportFlow, language: TenantLanguage | unknown): ReportFlow {
  const lang = coerceTenantLanguage(language);
  const copy = FLOW_COPY[flow.id][lang];
  return {
    ...flow,
    label: copy.label,
    subtitle: copy.subtitle,
    ingest: {
      ...flow.ingest,
      cardTitle: copy.ingest.cardTitle,
      cardDescription: copy.ingest.cardDescription,
    },
    steps: flow.steps.map((step, i) => ({
      ...step,
      label: copy.steps[i]?.label ?? step.label,
      shortLabel: copy.steps[i]?.shortLabel ?? step.shortLabel,
      description: copy.steps[i]?.description ?? step.description,
    })),
  };
}
