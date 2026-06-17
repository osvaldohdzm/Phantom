import {
  FileOutput,
  Layers,
  LayoutDashboard,
  Pencil,
  RefreshCw,
  Table2,
  FolderKanban,
} from 'lucide-react';
import type { ReportFlow } from '@/lib/reports-flows/types';

/** Flujo para tenants AV / infraestructura recurrente (Nessus trimestral, etc.). */
export const AV_INFRA_REPORT_FLOW: ReportFlow = {
  id: 'av-infra',
  label: 'AV Infraestructura',
  subtitle: 'Re-escaneos Nessus — actualiza estados sin duplicar hallazgos.',
  serviceTypes: ['AV Infraestructura'],
  ingest: {
    cardTitle: 'Re-escaneo Nessus (modo comparación)',
    cardDescription:
      'CSV Nessus en modo diff (atendido / remediado / reaparecido). Tras importar, abre el mapa en Repositorio → Mapa.',
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
      label: 'Re-escaneo',
      shortLabel: 'Re-scan',
      description: 'CSV Nessus en modo diff (atendido / remediado / reaparecido).',
      icon: RefreshCw,
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
