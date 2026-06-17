'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { pickDefaultEngagement } from '@/lib/default-engagement';
import { listEngagements, type Engagement } from '@/lib/secops-api';

/** Carga proyectos del tenant y preselecciona el Proyecto Default. */
export function useProjectSelection(initialId = '') {
  const { activeTenant, ready } = useAuth();
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [engagementId, setEngagementId] = useState(initialId);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listEngagements();
      setEngagements(list);
      setEngagementId((current) => {
        if (current && list.some((e) => e.id === current)) return current;
        return pickDefaultEngagement(list)?.id ?? '';
      });
    } catch {
      setEngagements([]);
      setEngagementId('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready, activeTenant?.id]);

  return { engagements, engagementId, setEngagementId, loading, reload: load };
}
