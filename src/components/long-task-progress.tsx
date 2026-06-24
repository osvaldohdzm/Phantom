'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { estimateEtaSeconds, formatDuration } from '@/lib/eta-progress';

export type LongTaskProgressProps = {
  /** Título corto, p. ej. «Cargando hallazgos» */
  title: string;
  /** Subtítulo / fase actual */
  phase?: string;
  /** Registros procesados (opcional) */
  loaded?: number;
  /** Total estimado (0 = barra indeterminada) */
  total?: number;
  /** Segundos transcurridos (si no se pasa, se cuenta desde mount) */
  elapsedSec?: number;
  /** ETA fijo en segundos (heurística) cuando no hay progreso determinista */
  estimatedTotalSec?: number;
  hint?: string;
  className?: string;
  /** Si true, inicia contador interno de tiempo */
  autoElapsed?: boolean;
};

export function LongTaskProgress({
  title,
  phase,
  loaded = 0,
  total = 0,
  elapsedSec: elapsedProp,
  estimatedTotalSec,
  hint,
  className,
  autoElapsed = true,
}: LongTaskProgressProps) {
  const [internalElapsed, setInternalElapsed] = useState(0);
  const elapsed = elapsedProp ?? internalElapsed;

  useEffect(() => {
    if (!autoElapsed || elapsedProp != null) return;
    const id = window.setInterval(() => setInternalElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [autoElapsed, elapsedProp]);

  const determinate = total > 0;
  const pct = determinate ? Math.min(100, Math.round((loaded / total) * 100)) : undefined;
  const etaFromProgress =
    determinate && loaded > 0 ? estimateEtaSeconds(elapsed, loaded, total) : null;
  const etaSec =
    etaFromProgress ??
    (estimatedTotalSec != null && estimatedTotalSec > elapsed
      ? estimatedTotalSec - elapsed
      : null);

  return (
    <div
      className={cn(
        'rounded-lg border border-violet-500/30 bg-violet-500/5 px-4 py-3 space-y-2',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <Loader2 className="size-4 shrink-0 mt-0.5 animate-spin text-violet-600 dark:text-violet-400" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {phase ? <p className="text-xs text-muted-foreground">{phase}</p> : null}
        </div>
        <div className="text-right text-xs tabular-nums text-muted-foreground shrink-0">
          <div>{formatDuration(elapsed)}</div>
          {etaSec != null && etaSec > 0 ? (
            <div className="text-[10px]">~{formatDuration(etaSec)} rest.</div>
          ) : null}
        </div>
      </div>

      <div className="h-2 rounded-full bg-muted overflow-hidden">
        {determinate ? (
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        ) : (
          <div className="h-full w-full rounded-full bg-violet-500/50 animate-pulse" />
        )}
      </div>

      <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        {determinate ? (
          <span className="tabular-nums">
            <span className="font-medium text-foreground">{loaded.toLocaleString()}</span>
            {' / '}
            {total.toLocaleString()} registros
            {pct != null ? ` · ${pct}%` : ''}
          </span>
        ) : (
          <span>Procesando en servidor…</span>
        )}
        {hint ? <span className="text-[10px] italic max-w-[18rem]">{hint}</span> : null}
      </div>
    </div>
  );
}
