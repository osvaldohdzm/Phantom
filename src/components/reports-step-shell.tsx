'use client';

import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getFlowStep, PENTEST_REPORT_FLOW, type ReportFlow } from '@/lib/reports-flows';
import { useUiT } from '@/lib/use-ui-locale';

type ReportsStepShellProps = {
  flow?: ReportFlow;
  step: number;
  projectName?: string;
  onStep: (n: number) => void;
  children: React.ReactNode;
  className?: string;
  footerExtra?: React.ReactNode;
  nextDisabled?: boolean;
  nextDisabledHint?: string;
  stepper?: React.ReactNode;
};

export function ReportsStepShell({
  flow = PENTEST_REPORT_FLOW,
  step,
  projectName,
  onStep,
  children,
  className,
  footerExtra,
  nextDisabled = false,
  nextDisabledHint,
  stepper,
}: ReportsStepShellProps) {
  const { t, format } = useUiT();
  const resolvedFlow = flow ?? PENTEST_REPORT_FLOW;
  const def = getFlowStep(resolvedFlow, step);
  const Icon = def.icon;
  const prev = step > 1 ? step - 1 : null;
  const next = step < resolvedFlow.steps.length ? step + 1 : null;
  const nextDef = next ? getFlowStep(resolvedFlow, next) : null;

  return (
    <section id={`step-${step}`} className={cn('space-y-4', className)}>
      <header className="rounded-xl border border-border bg-card px-4 py-3 sm:px-5 sm:py-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="type-small text-muted-foreground">
                {format('reportsFlowStep', {
                  flow: resolvedFlow.label,
                  step: String(step),
                  total: String(resolvedFlow.steps.length),
                })}
                {projectName ? (
                  <>
                    {' '}
                    · <span className="text-foreground/80">{projectName}</span>
                  </>
                ) : null}
              </p>
              <h2 className="type-h3 text-foreground">{def.label}</h2>
              <p className="type-small text-muted-foreground max-w-2xl">{def.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {prev ? (
              <Button type="button" variant="outline" size="sm" onClick={() => onStep(prev)}>
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline ml-1">
                  {getFlowStep(resolvedFlow, prev).shortLabel}
                </span>
              </Button>
            ) : null}
            {next && nextDef ? (
              <Button
                type="button"
                size="sm"
                disabled={nextDisabled}
                title={nextDisabled ? nextDisabledHint : undefined}
                onClick={() => onStep(next)}
              >
                <span className="hidden sm:inline mr-1">{nextDef.shortLabel}</span>
                <ArrowRight className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      {stepper ? <div className="-mt-1">{stepper}</div> : null}

      <div>{children}</div>

      <footer className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/60">
        <div className="flex flex-wrap items-center gap-2">{footerExtra}</div>
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {prev ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onStep(prev)}>
              <ArrowLeft className="size-4 mr-1" />
              {t('reportsPrevious')}
            </Button>
          ) : null}
          {nextDisabledHint && nextDisabled ? (
            <p className="type-small text-amber-700 dark:text-amber-300 max-w-md">
              {nextDisabledHint}
            </p>
          ) : null}
          {next && nextDef ? (
            <Button
              type="button"
              size="sm"
              disabled={nextDisabled}
              title={nextDisabled ? nextDisabledHint : undefined}
              onClick={() => onStep(next)}
            >
              {format('reportsNext', { label: nextDef.shortLabel })}
              <ArrowRight className="size-4 ml-1.5" />
            </Button>
          ) : null}
        </div>
      </footer>
    </section>
  );
}
