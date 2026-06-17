import {
  FileOutput,
  Globe,
  Layers,
  LayoutDashboard,
  Pencil,
  ScanSearch,
  Table2,
  FolderKanban,
} from 'lucide-react';
import type { ReportFlow } from '@/lib/reports-flows/types';

/** Flujo DAST / aplicación web — variante propia (evoluciona aparte de pentest). */
export const DAST_REPORT_FLOW: ReportFlow = {
  id: 'dast',
  label: 'DAST',
  subtitle: 'Aplicación web y API expuesta — URLs, auth y scanners dinámicos.',
  serviceTypes: ['DAST', 'API', 'Mobile'],
  ingest: {
    cardTitle: 'Importar hallazgos DAST',
    cardDescription:
      'Acunetix HTML o exportaciones compatibles. Tras importar revisa tipos en catálogo y luego el desglose por URL.',
    optionalBadge: true,
    onCompleteGotoStep: 4,
  },
  steps: [
    {
      n: 1,
      key: 'project',
      label: 'Proyecto',
      shortLabel: 'Proyecto',
      description: 'URLs objetivo, login, headers y reglas del escaneo dinámico.',
      icon: FolderKanban,
    },
    {
      n: 2,
      key: 'import',
      label: 'Importación DAST',
      shortLabel: 'Importar',
      description: 'Carga resultados del scanner web (Acunetix u otros).',
      icon: ScanSearch,
    },
    {
      n: 3,
      key: 'manual',
      label: 'Hallazgos web',
      shortLabel: 'Manuales',
      description: 'Vulnerabilidades validadas a mano en la aplicación (PoC, capturas).',
      icon: Pencil,
    },
    {
      n: 4,
      key: 'vuln-review',
      label: 'Revisión de vulnerabilidades',
      shortLabel: 'Tipos',
      description: 'Edita cada tipo de hallazgo en catálogo (sin repetir por URL).',
      icon: Layers,
    },
    {
      n: 5,
      key: 'review',
      label: 'Revisión desglosada',
      shortLabel: 'Desglosada',
      description: 'Alinea hallazgos con URLs/rutas, quita falsos positivos y completa remediación.',
      icon: Table2,
    },
    {
      n: 6,
      key: 'overview',
      label: 'Overview',
      shortLabel: 'Overview',
      description: 'Resumen por severidad y superficie web antes del Word.',
      icon: LayoutDashboard,
    },
    {
      n: 7,
      key: 'word',
      label: 'Informe Word',
      shortLabel: 'Word',
      description: 'Genera el informe DAST con plantilla CYB001.',
      icon: FileOutput,
    },
  ],
};

/** Icono distintivo en UI (opcional futuro). */
export const DAST_FLOW_ACCENT_ICON = Globe;
