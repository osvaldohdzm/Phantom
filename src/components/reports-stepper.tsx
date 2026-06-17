'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PENTEST_REPORT_FLOW, type ReportFlow } from '@/lib/reports-flows';

type ReportsStepperProps = {
  flow?: ReportFlow;
  activeStep: number;
  onStep: (n: number) => void;
  className?: string;
};

export function ReportsStepper({
  flow = PENTEST_REPORT_FLOW,
  activeStep,
  onStep,
  className,
}: ReportsStepperProps) {
  const resolvedFlow = flow ?? PENTEST_REPORT_FLOW;
  const steps = resolvedFlow.steps;

  return (
    <nav
      className={cn(
        'w-full overflow-x-auto rounded-xl border border-border bg-card px-3 py-2.5 sm:px-4',
        className
      )}
      aria-label={`Pasos del reporte — ${resolvedFlow.label}`}
    >
      <ol className="flex items-center min-w-max sm:min-w-0">
        {steps.map((step, i) => {
          const done = activeStep > step.n;
          const active = activeStep === step.n;
          const last = i === steps.length - 1;
          const Icon = step.icon;

          return (
            <li key={step.n} className={cn('flex items-center', !last && 'flex-1 min-w-0')}>
              <button
                type="button"
                onClick={() => onStep(step.n)}
                title={step.description}
                className={cn(
                  'group flex items-center gap-1.5 shrink-0 rounded-lg px-1.5 py-1 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                  active
                    ? 'text-primary'
                    : done
                      ? 'text-muted-foreground hover:text-foreground'
                      : 'text-muted-foreground/60 hover:text-muted-foreground'
                )}
              >
                <span
                  className={cn(
                    'size-7 rounded-full flex items-center justify-center text-[10px] font-semibold transition-colors',
                    active && 'bg-primary text-primary-foreground shadow-sm',
                    done && !active && 'bg-primary/15 text-primary',
                    !active && !done && 'bg-muted text-muted-foreground group-hover:bg-muted/80'
                  )}
                >
                  {done && !active ? (
                    <Check className="size-3.5" strokeWidth={3} />
                  ) : (
                    <Icon className="size-3.5" />
                  )}
                </span>
                <span
                  className={cn(
                    'text-xs font-medium whitespace-nowrap hidden md:inline',
                    active && 'text-foreground'
                  )}
                >
                  {step.label}
                </span>
              </button>
              {!last ? (
                <div
                  className={cn(
                    'h-px flex-1 mx-2 min-w-[8px] max-w-[48px] sm:max-w-none transition-colors',
                    done ? 'bg-primary/40' : 'bg-border'
                  )}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
