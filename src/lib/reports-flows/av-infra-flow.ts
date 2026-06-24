import {
  FileOutput,
  Layers,
  LayoutDashboard,
  Pencil,
  ScanSearch,
  Table2,
  FolderKanban,
} from 'lucide-react';
import type { ReportFlow } from '@/lib/reports-flows/types';

/** Servicio AV / infraestructura recurrente (Nessus trimestral, etc.). */
export const AV_INFRA_REPORT_FLOW: ReportFlow = {
  id: 'av-infra',
  label: 'AV Infraestructura',
  subtitle:
    'Servicio de análisis de vulnerabilidades en infraestructura — primer escaneo o re-escaneos Nessus periódicos.',
  serviceTypes: ['AV Infraestructura'],
  ingest: {
    cardTitle: 'Ingesta Nessus (CSV)',
    cardDescription:
      'Primer escaneo: carga inicial al repositorio. Re-escaneo: compara con hallazgos existentes (atendido / remediado / reaparecido). Hasta 150 MB por archivo.',
    optionalBadge: false,
    onCompleteGotoStep: 4,
  },
  steps: [
    {
      n: 1,
      key: 'project',
      label: 'Campaña',
      shortLabel: 'Campaña',
      description: 'Alcance, periodicidad y grupos de activos del servicio AV.',
      icon: FolderKanban,
    },
    {
      n: 2,
      key: 'import',
      label: 'Ingesta Nessus',
      shortLabel: 'Ingesta',
      description: 'CSV Nessus — primer escaneo o re-escaneo con comparación al repositorio.',
      icon: ScanSearch,
    },
    {
      n: 3,
      key: 'manual',
      label: 'Excepciones',
      shortLabel: 'Manual',
      description: 'Falsos positivos y hallazgos fuera de scanner.',
      icon: Pencil,
    },
    {
      n: 4,
      key: 'vuln-review',
      label: 'Revisión por tipo',
      shortLabel: 'Tipos',
      description: 'Consolidado por tipo de vulnerabilidad.',
      icon: Layers,
    },
    {
      n: 5,
      key: 'review',
      label: 'Matriz desglosada',
      shortLabel: 'Desglosada',
      description: 'Instancias por activo con estados AV.',
      icon: Table2,
    },
    {
      n: 6,
      key: 'overview',
      label: 'Overview',
      shortLabel: 'Overview',
      description: 'KPIs: nuevas, ausentes, reaparecidas.',
      icon: LayoutDashboard,
    },
    {
      n: 7,
      key: 'word',
      label: 'Word',
      shortLabel: 'Word',
      description: 'Informe CYB001 del periodo.',
      icon: FileOutput,
    },
  ],
};
