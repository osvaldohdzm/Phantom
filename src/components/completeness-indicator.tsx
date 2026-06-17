'use client';

import { cn } from '@/lib/utils';

export function CompletenessIndicator({
  percent,
  className,
}: {
  percent: number;
  className?: string;
}) {
  const bars = 8;
  const filled = Math.round((percent / 100) * bars);
  const color =
    percent >= 80 ? 'bg-emerald-500' : percent >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  const textColor =
    percent >= 80 ? 'text-emerald-400' : percent >= 50 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className={cn('flex items-center gap-1.5 min-w-[4.5rem]', className)} title={`${percent}% completo`}>
      <div className="flex gap-px flex-1 max-w-[3.5rem]">
        {Array.from({ length: bars }, (_, i) => (
          <div
            key={i}
            className={cn('h-1.5 flex-1 rounded-[1px]', i < filled ? color : 'bg-slate-800')}
          />
        ))}
      </div>
      <span className={cn('text-[10px] font-mono tabular-nums w-7 text-right', textColor)}>
        {percent}%
      </span>
    </div>
  );
}
