'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { filterUserEngagements } from '@/lib/default-engagement';
import { listEngagements, type Engagement } from '@/lib/secops-api';

/** Carga servicios del tenant (sin el espacio interno) para selectores opcionales. */
export function useProjectSelection(initialId = '') {
  const { activeTenant, ready } = useAuth();
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [engagementId, setEngagementId] = useState(initialId);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listEngagements();
      const userEngagements = filterUserEngagements(list);
      setEngagements(userEngagements);
      setEngagementId((current) => {
        if (current && userEngagements.some((e) => e.id === current)) return current;
        if (initialId && userEngagements.some((e) => e.id === initialId)) return initialId;
        // Sin auto-selección: inventario global o el usuario elige un servicio real.
        return '';
      });
    } catch {
      setEngagements([]);
      setEngagementId('');
    } finally {
      setLoading(false);
    }
  }, [initialId]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready, activeTenant?.id]);

  return { engagements, engagementId, setEngagementId, loading, reload: load };
}
