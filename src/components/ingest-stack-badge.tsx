'use client';

import { useEffect, useState } from 'react';
import { Cpu, Loader2 } from 'lucide-react';
import { fetchIngestStack, type IngestStackStatus } from '@/lib/ingest-jobs';
import { cn } from '@/lib/utils';

export function IngestStackBadge({ className }: { className?: string }) {
  const [stack, setStack] = useState<IngestStackStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchIngestStack()
      .then((data) => {
        if (!cancelled) setStack(data);
      })
      .catch(() => {
        if (!cancelled) setStack(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <p className={cn('text-[10px] text-muted-foreground flex items-center gap-1.5', className)}>
        <Loader2 className="size-3 animate-spin" />
        Parser stack…
      </p>
    );
  }

  if (!stack) return null;

  const goOk = stack.ingest_go_healthy === true;
  const rustOk = stack.parse_rust_healthy === true;
  const goConfigured = Boolean(stack.ingest_go_url);
  const rustConfigured = Boolean(stack.parse_rust_url);

  return (
    <p
      className={cn(
        'text-[10px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5',
        className
      )}
    >
      <Cpu className="size-3 shrink-0" />
      <span>
        Parse:{' '}
        {goConfigured ? (
          <span className={goOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}>
            Go{goOk ? ' ✓' : ' (fallback)'}
          </span>
        ) : (
          <span>Python</span>
        )}
        {rustConfigured ? (
          <>
            {' · '}
            <span className={rustOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}>
              Rust{rustOk ? ' ✓' : ' (fallback)'}
            </span>
          </>
        ) : null}
        {!goConfigured && !rustConfigured ? ' (modo nativo)' : null}
      </span>
    </p>
  );
}
