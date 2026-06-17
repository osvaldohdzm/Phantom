import type { LucideIcon } from 'lucide-react';
import type { TipoServicio } from '@/lib/engagement-profile';

export type ReportsStepKey =
  | 'project'
  | 'import'
  | 'manual'
  | 'vuln-review'
  | 'review'
  | 'overview'
  | 'word';

export type ReportsStepDef = {
  n: number;
  key: ReportsStepKey;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
};

export type ReportFlowId = 'pentest' | 'dast' | 'sast' | 'av-infra';

export type ReportFlowIngest = {
  cardTitle: string;
  cardDescription: string;
  optionalBadge?: boolean;
  onCompleteGotoStep: number;
};

export type ReportFlow = {
  id: ReportFlowId;
  label: string;
  subtitle: string;
  steps: ReportsStepDef[];
  ingest: ReportFlowIngest;
  /** Mapeo tipo servicio → variante (otros tipos heredan de pentest/dast hasta tener flujo propio). */
  serviceTypes: TipoServicio[];
};
