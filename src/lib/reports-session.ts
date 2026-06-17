import type { DraftFinding } from '@/components/bulk-findings-ingest-panel';

const SESSION_KEY = 'Phantom-reports-session';
const DRAFTS_PREFIX = 'Phantom-reports-drafts:';

/** 3 = Tipos·4, Desglosada·5. 2 = Revisión·4. 1 = Revisión·3, Manuales·4. */
export const REPORTS_STEP_ORDER_VERSION = 3;

export type ReportsSession = {
  engagementId: string;
  projectName: string;
  tipoServicio: string;
  activeStep: number;
  analystContext: string;
  stepOrderVersion?: number;
};

export function loadReportsSession(): Partial<ReportsSession> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Partial<ReportsSession>;
    return {
      engagementId: typeof data.engagementId === 'string' ? data.engagementId : '',
      projectName: typeof data.projectName === 'string' ? data.projectName : '',
      tipoServicio: typeof data.tipoServicio === 'string' ? data.tipoServicio : '',
      activeStep: typeof data.activeStep === 'number' ? data.activeStep : 1,
      analystContext: typeof data.analystContext === 'string' ? data.analystContext : '',
      stepOrderVersion:
        typeof data.stepOrderVersion === 'number' ? data.stepOrderVersion : 0,
    };
  } catch {
    return {};
  }
}

export function saveReportsSession(session: Partial<ReportsSession>): void {
  if (typeof window === 'undefined') return;
  try {
    const prev = loadReportsSession();
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        engagementId: session.engagementId ?? prev.engagementId ?? '',
        projectName: session.projectName ?? prev.projectName ?? '',
        tipoServicio: session.tipoServicio ?? prev.tipoServicio ?? '',
        activeStep: session.activeStep ?? prev.activeStep ?? 1,
        analystContext: session.analystContext ?? prev.analystContext ?? '',
        stepOrderVersion:
          session.stepOrderVersion ?? prev.stepOrderVersion ?? REPORTS_STEP_ORDER_VERSION,
      })
    );
  } catch {
    /* quota / private mode */
  }
}

export function loadDraftFindings(engagementId: string): DraftFinding[] {
  if (!engagementId || typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${DRAFTS_PREFIX}${engagementId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DraftFinding[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDraftFindings(engagementId: string, drafts: DraftFinding[]): void {
  if (!engagementId || typeof window === 'undefined') return;
  try {
    if (!drafts.length) {
      localStorage.removeItem(`${DRAFTS_PREFIX}${engagementId}`);
      return;
    }
    localStorage.setItem(`${DRAFTS_PREFIX}${engagementId}`, JSON.stringify(drafts));
  } catch {
    /* ignore */
  }
}
