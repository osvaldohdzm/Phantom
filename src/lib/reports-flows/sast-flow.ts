import {
  Code2,
  FileOutput,
  Layers,
  LayoutDashboard,
  Pencil,
  ScanSearch,
  Table2,
  FolderKanban,
} from 'lucide-react';
import type { ReportFlow } from '@/lib/reports-flows/types';

/** Servicio SAST — análisis estático de código. */
export const SAST_REPORT_FLOW: ReportFlow = {
  id: 'sast',
  label: 'SAST',
  subtitle: 'Servicio SAST en código fuente y repositorios — análisis estático y revisión de hallazgos.',
  serviceTypes: ['SAST'],
  ingest: {
    cardTitle: 'Ingesta SAST',
    cardDescription:
      'Exportaciones del analizador estático (CSV u otros formatos tabulares). Revisa repo, branch y lenguaje en el paso Servicio antes de consolidar.',
    optionalBadge: true,
    onCompleteGotoStep: 4,
  },
  steps: [
    {
      n: 1,
      key: 'project',
      label: 'Servicio',
      shortLabel: 'Servicio',
      description: 'Repositorio, branch, SCM y acceso al código del engagement SAST.',
      icon: FolderKanban,
    },
    {
      n: 2,
      key: 'import',
      label: 'Importación SAST',
      shortLabel: 'Importar',
      description: 'Carga findings del scanner estático o del pipeline CI.',
      icon: ScanSearch,
    },
    {
      n: 3,
      key: 'manual',
      label: 'Hallazgos código',
      shortLabel: 'Manuales',
      description: 'Issues de revisión manual de código o hallazgos no detectados por el SAST.',
      icon: Pencil,
    },
    {
      n: 4,
      key: 'vuln-review',
      label: 'Revisión de vulnerabilidades',
      shortLabel: 'Tipos',
      description: 'Edita cada regla CWE/tipo en catálogo antes del desglose por archivo.',
      icon: Layers,
    },
    {
      n: 5,
      key: 'review',
      label: 'Revisión desglosada',
      shortLabel: 'Desglosada',
      description: 'Triage por archivo/línea, CWE y propuesta de remediación en código.',
      icon: Table2,
    },
    {
      n: 6,
      key: 'overview',
      label: 'Overview',
      shortLabel: 'Overview',
      description: 'Métricas del análisis estático antes de exportar.',
      icon: LayoutDashboard,
    },
    {
      n: 7,
      key: 'word',
      label: 'Informe Word',
      shortLabel: 'Word',
      description: 'Informe SAST con plantilla CYB001.',
      icon: FileOutput,
    },
  ],
};

export const SAST_FLOW_ACCENT_ICON = Code2;
