'use client';

import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '@/lib/api-base';

/** Evita hydration mismatch: la URL solo se muestra tras montar en cliente. */
export function ApiUrlBadge({ className }: { className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(getApiBaseUrl());
  }, []);
  if (!url) return null;
  return (
    <p className={className}>
      API: <span className="text-foreground/80">{url}</span>
    </p>
  );
}
