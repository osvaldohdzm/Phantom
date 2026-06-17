import type { TipoServicio } from '@/lib/engagement-profile';
import { AV_INFRA_REPORT_FLOW } from '@/lib/reports-flows/av-infra-flow';
import { DAST_REPORT_FLOW } from '@/lib/reports-flows/dast-flow';
import { PENTEST_REPORT_FLOW } from '@/lib/reports-flows/pentest-flow';
import { SAST_REPORT_FLOW } from '@/lib/reports-flows/sast-flow';
import type { ReportFlow, ReportFlowId, ReportsStepDef } from '@/lib/reports-flows/types';

export type { ReportFlow, ReportFlowId, ReportsStepDef, ReportsStepKey } from '@/lib/reports-flows/types';
export { AV_INFRA_REPORT_FLOW } from '@/lib/reports-flows/av-infra-flow';
export { PENTEST_REPORT_FLOW } from '@/lib/reports-flows/pentest-flow';
export { DAST_REPORT_FLOW } from '@/lib/reports-flows/dast-flow';
export { SAST_REPORT_FLOW } from '@/lib/reports-flows/sast-flow';

const ALL_FLOWS: ReportFlow[] = [PENTEST_REPORT_FLOW, DAST_REPORT_FLOW, SAST_REPORT_FLOW, AV_INFRA_REPORT_FLOW];

const SERVICE_TO_FLOW: Record<TipoServicio, ReportFlow> = {
  Pentest: PENTEST_REPORT_FLOW,
  DAST: DAST_REPORT_FLOW,
  SAST: SAST_REPORT_FLOW,
  API: DAST_REPORT_FLOW,
  Mobile: DAST_REPORT_FLOW,
  Infraestructura: PENTEST_REPORT_FLOW,
  'AV Infraestructura': AV_INFRA_REPORT_FLOW,
  'AV Cloud': AV_INFRA_REPORT_FLOW,
  Cloud: PENTEST_REPORT_FLOW,
};

export function getReportFlow(tipoServicio?: string | null): ReportFlow {
  if (!tipoServicio) return PENTEST_REPORT_FLOW;
  return SERVICE_TO_FLOW[tipoServicio as TipoServicio] ?? PENTEST_REPORT_FLOW;
}

export function getReportFlowById(id: ReportFlowId): ReportFlow {
  return ALL_FLOWS.find((f) => f.id === id) ?? PENTEST_REPORT_FLOW;
}

export function getFlowStep(flow: ReportFlow, n: number): ReportsStepDef {
  return flow.steps.find((s) => s.n === n) ?? flow.steps[0]!;
}

export function clampFlowStep(flow: ReportFlow, step: number): number {
  const max = flow.steps.length;
  return Math.min(Math.max(step, 1), max);
}

/**
 * v3 = Tipos·4, Desglosada·5, Overview·6, Word·7.
 * v2 = Manuales·3, Revisión·4. v1 intercambia 3↔4.
 */
export function migrateReportsStep(
  step: number,
  stepOrderVersion = 0,
  flow: ReportFlow = PENTEST_REPORT_FLOW
): number {
  let clamped = clampFlowStep(flow, step);
  if (stepOrderVersion >= 3) return clamped;

  if (stepOrderVersion === 2 && flow.steps.length >= 7) {
    if (clamped >= 4) clamped += 1;
  }

  if (stepOrderVersion <= 1) {
    if (stepOrderVersion === 1) {
      if (clamped === 3) clamped = 4;
      else if (clamped === 4) clamped = 3;
    }
    if (flow.steps.length >= 7 && clamped >= 4) clamped += 1;
  }

  return clampFlowStep(flow, clamped);
}
