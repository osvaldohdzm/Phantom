'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  clearReportsWorkflowSession,
  loadReportsSession,
  REPORTS_STEP_ORDER_VERSION,
  saveReportsSession,
} from '@/lib/reports-session';
import { isReportsReentry } from '@/lib/reports-reentry';
import { Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FindingsManager } from '@/components/findings-manager';
import { DocxReportsPanel } from '@/components/docx-reports-panel';
import { VulIngestPanel } from '@/components/vul-ingest-panel';
import { AvInfraIngestPanel } from '@/components/av-infra-ingest-panel';
import { EngagementsManager } from '@/components/engagements-manager';
import { AutomatedFindingsReviewPanel } from '@/components/automated-findings-review-panel';
import { VulnerabilityTypesReviewPanel } from '@/components/vulnerability-types-review-panel';
import { ApiUrlBadge } from '@/components/api-url-badge';
import { ReportsOverviewPanel } from '@/components/reports-overview-panel';
import { ReportsStepper } from '@/components/reports-stepper';
import { ReportsStepShell } from '@/components/reports-step-shell';
import { AvInfraQuickNav } from '@/components/av-infra-quick-nav';
import { getEngagement } from '@/lib/secops-api';
import { isDefaultEngagement } from '@/lib/default-engagement';
import {
  clampFlowStep,
  getReportFlow,
  migrateReportsStep,
  type ReportFlow,
} from '@/lib/reports-flows';
import { localizeReportFlow } from '@/lib/reports-flow-i18n';
import { labelServiceType } from '@/lib/engagement-i18n';
import { useUiT } from '@/lib/use-ui-locale';
import { cn } from '@/lib/utils';

function FlowBadge({ flow, stepsLabel }: { flow: ReportFlow; stepsLabel: string }) {
  const tone =
    flow.id === 'dast'
      ? 'border-sky-500/35 bg-sky-500/10 text-sky-800 dark:text-sky-200'
      : flow.id === 'sast'
        ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
        : flow.id === 'av-infra'
          ? 'border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-200'
          : 'border-violet-500/35 bg-violet-500/10 text-violet-800 dark:text-violet-200';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 type-small font-medium',
        tone
      )}
    >
      {flow.steps.length} {stepsLabel}
    </span>
  );
}

export default function ReportsPage() {
  const pathname = usePathname();
  const { t, format, uiLanguage } = useUiT();
  const [engagementId, setEngagementId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [tipoServicio, setTipoServicio] = useState('');
  const [activeStep, setActiveStep] = useState(1);
  const [sessionReady, setSessionReady] = useState(false);
  const [findingsRefresh, setFindingsRefresh] = useState(0);

  const flow = useMemo(
    () => localizeReportFlow(getReportFlow(tipoServicio), uiLanguage),
    [tipoServicio, uiLanguage]
  );

  useEffect(() => {
    if (pathname !== '/reports') return;

    const reentered = isReportsReentry(pathname);

    if (reentered) {
      clearReportsWorkflowSession();
      setEngagementId('');
      setProjectName('');
      setTipoServicio('');
      setActiveStep(1);
      setSessionReady(true);
      return;
    }

    const saved = loadReportsSession();
    if (saved.engagementId) setEngagementId(saved.engagementId);
    if (saved.projectName) setProjectName(saved.projectName);
    if (saved.tipoServicio) setTipoServicio(saved.tipoServicio);
    if (saved.activeStep) {
      setActiveStep(
        migrateReportsStep(saved.activeStep, saved.stepOrderVersion, getReportFlow(saved.tipoServicio))
      );
    }
    setSessionReady(true);
  }, [pathname]);

  useEffect(() => {
    if (!sessionReady || !engagementId) return;
    void getEngagement(engagementId)
      .then((eg) => {
        if (isDefaultEngagement(eg)) {
          setEngagementId('');
          setProjectName('');
          setTipoServicio('');
          return;
        }
        if (eg.tipo_servicio) setTipoServicio(eg.tipo_servicio);
        if (!projectName) setProjectName(eg.nombre_proyecto || eg.cliente);
      })
      .catch(() => {
        /* engagement borrado o API caído */
      });
  }, [engagementId, sessionReady, projectName]);

  useEffect(() => {
    if (!sessionReady) return;
    setActiveStep((s) => clampFlowStep(flow, s));
  }, [flow.id, sessionReady, flow]);

  useEffect(() => {
    if (!sessionReady) return;
    saveReportsSession({
      engagementId,
      projectName,
      tipoServicio,
      activeStep,
      stepOrderVersion: REPORTS_STEP_ORDER_VERSION,
    });
  }, [engagementId, projectName, tipoServicio, activeStep, sessionReady]);

  const applyProjectMeta = (meta?: { cliente?: string; tipo_servicio?: string }) => {
    if (meta?.cliente) setProjectName(meta.cliente);
    if (meta?.tipo_servicio) setTipoServicio(meta.tipo_servicio);
  };

  const goToStep = (n: number) => {
    const clamped = clampFlowStep(flow, n);
    setActiveStep(clamped);
    requestAnimationFrame(() =>
      document.getElementById(`step-${clamped}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    );
  };

  const onIngestComplete = () => {
    setFindingsRefresh((n) => n + 1);
    goToStep(flow.ingest.onCompleteGotoStep);
  };

  const needsProject = activeStep > 1 && !engagementId;
  const stepper = (
    <ReportsStepper flow={flow} activeStep={activeStep} onStep={goToStep} />
  );

  const shellProps = {
    flow,
    projectName: projectName || undefined,
    onStep: goToStep,
    stepper,
  };

  return (
    <div className="max-w-[1440px] mx-auto space-y-5 pb-28">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="type-small font-medium uppercase tracking-widest text-muted-foreground">
              {t('servicesSection')}
            </p>
            <FlowBadge flow={flow} stepsLabel={t('servicesSteps')} />
          </div>
          <h1 className="type-h2">{format('servicesFlowTitle', { flow: flow.label })}</h1>
          <p className="type-small text-muted-foreground max-w-xl">{flow.subtitle}</p>
          {projectName ? (
            <p className="type-small text-muted-foreground">
              {t('servicesActiveProject')}: <span className="text-foreground">{projectName}</span>
              {tipoServicio ? (
                <>
                  {' '}
                  · <span className="text-foreground/80">{labelServiceType(tipoServicio, uiLanguage)}</span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        <ApiUrlBadge className="type-small text-muted-foreground font-mono shrink-0" />
      </header>

      {flow.id === 'av-infra' ? <AvInfraQuickNav /> : null}

      {needsProject ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/8 px-4 py-2.5 type-small text-amber-800 dark:text-amber-200">
          {t('servicesSelectProjectWarn')}
        </p>
      ) : null}

      {(activeStep === 1 || !engagementId) && (
        <ReportsStepShell
          {...shellProps}
          step={1}
          nextDisabled={!engagementId}
          nextDisabledHint={t('servicesSaveBeforeContinue')}
        >
          <EngagementsManager
            selectedId={engagementId}
            onSelect={(id, meta) => {
              setEngagementId(id);
              applyProjectMeta(meta);
            }}
            onSaved={(id, meta) => {
              setEngagementId(id);
              applyProjectMeta(meta);
            }}
          />
        </ReportsStepShell>
      )}

      {activeStep === 2 && (
        <ReportsStepShell {...shellProps} step={2}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="size-4 text-sky-500" />
                {flow.ingest.cardTitle}
                {flow.ingest.optionalBadge ? (
                  <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                    {t('reportsOptional')}
                  </span>
                ) : null}
              </CardTitle>
              <CardDescription>{flow.ingest.cardDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              {!engagementId ? (
                <p className="type-small text-amber-600 dark:text-amber-400">
                  {t('servicesSelectProjectStep')}
                </p>
              ) : flow.id === 'av-infra' ? (
                <AvInfraIngestPanel engagementId={engagementId} onComplete={onIngestComplete} />
              ) : (
                <VulIngestPanel engagementId={engagementId} onIngestComplete={onIngestComplete} />
              )}
            </CardContent>
          </Card>
        </ReportsStepShell>
      )}

      {activeStep === 3 && (
        <ReportsStepShell {...shellProps} step={3}>
          <Card>
            <CardContent className="pt-6">
              <FindingsManager
                engagementId={engagementId || undefined}
                projectName={projectName || undefined}
                refreshToken={findingsRefresh}
              />
            </CardContent>
          </Card>
        </ReportsStepShell>
      )}

      {activeStep === 4 && (
        <ReportsStepShell {...shellProps} step={4}>
          <VulnerabilityTypesReviewPanel
            engagementId={engagementId || undefined}
            projectName={projectName || undefined}
            refreshToken={findingsRefresh}
          />
        </ReportsStepShell>
      )}

      {activeStep === 5 && (
        <ReportsStepShell {...shellProps} step={5}>
          <AutomatedFindingsReviewPanel
            engagementId={engagementId || undefined}
            projectName={projectName || undefined}
            refreshToken={findingsRefresh}
          />
        </ReportsStepShell>
      )}

      {activeStep === 6 && (
        <ReportsStepShell {...shellProps} step={6}>
          <Card>
            <CardContent className="pt-6">
              <ReportsOverviewPanel
                engagementId={engagementId || undefined}
                refreshToken={findingsRefresh}
              />
            </CardContent>
          </Card>
        </ReportsStepShell>
      )}

      {activeStep === 7 && (
        <ReportsStepShell {...shellProps} step={7}>
          <Card>
            <CardContent className="pt-6">
              <DocxReportsPanel engagementId={engagementId || undefined} />
            </CardContent>
          </Card>
        </ReportsStepShell>
      )}
    </div>
  );
}
