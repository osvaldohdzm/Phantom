/**
 * @deprecated Importa desde `@/lib/reports-flows` — mantiene compatibilidad con pentest.
 */
import {
  PENTEST_REPORT_FLOW,
  getFlowStep,
  migrateReportsStep as migrateFlowStep,
} from '@/lib/reports-flows';

export type { ReportsStepDef, ReportsStepKey } from '@/lib/reports-flows/types';

export const REPORTS_STEPS = PENTEST_REPORT_FLOW.steps;

export function migrateReportsStep(step: number, stepOrderVersion = 0): number {
  return migrateFlowStep(step, stepOrderVersion, PENTEST_REPORT_FLOW);
}

export function getReportsStep(n: number) {
  return getFlowStep(PENTEST_REPORT_FLOW, n);
}
