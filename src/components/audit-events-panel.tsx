'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { listAuditEvents, type AdminAuditEvent } from '@/lib/auth-api';
import { useAuth } from '@/contexts/auth-context';
import { useUiT } from '@/lib/use-ui-locale';

type AuditEventsPanelProps = {
  scope: 'tenant' | 'platform';
  limit?: number;
};

export function AuditEventsPanel({ scope, limit = 40 }: AuditEventsPanelProps) {
  const { uiLanguage } = useAuth();
  const { t } = useUiT();
  const [audit, setAudit] = useState<AdminAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAudit(await listAuditEvents(limit));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auditErrorLoad'));
    } finally {
      setLoading(false);
    }
  }, [limit, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const dateLocale = uiLanguage === 'en' ? 'en-US' : 'es';
  const title = scope === 'platform' ? t('auditTitle') : t('auditTenantTitle');
  const description = scope === 'platform' ? t('auditDescription') : t('auditTenantDescription');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : audit.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('auditEmpty')}</p>
        ) : (
          <ul className="space-y-2 text-xs max-h-[32rem] overflow-y-auto">
            {audit.map((ev) => (
              <li key={ev.id} className="rounded-md border border-border px-3 py-2">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-mono text-muted-foreground">
                    {new Date(ev.created_at).toLocaleString(dateLocale)}
                  </span>
                  <span className="font-medium">{ev.action}</span>
                  {scope === 'platform' && ev.tenant_nombre ? (
                    <span className="text-muted-foreground">· {ev.tenant_nombre}</span>
                  ) : null}
                </div>
                {ev.actor_email ? (
                  <p className="text-muted-foreground mt-0.5 font-mono">{ev.actor_email}</p>
                ) : null}
                {ev.details ? (
                  <p className="mt-1 text-muted-foreground break-all">{JSON.stringify(ev.details)}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
