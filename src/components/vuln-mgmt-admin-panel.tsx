'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UsersMembershipPanel } from '@/components/users-membership-panel';
import { VulnMgmtCatalogMaintenancePanel } from '@/components/vuln-mgmt-catalog-maintenance-panel';
import { VulnMgmtRepositoryAdminPanel } from '@/components/vuln-mgmt-repository-admin-panel';
import { VulnMgmtServicesAdminPanel } from '@/components/vuln-mgmt-services-admin-panel';
import { useAuth } from '@/contexts/auth-context';
import {
  canAdminTenant,
  hasPlatformAdminAccess,
  listAuditEvents,
  type AdminAuditEvent,
} from '@/lib/auth-api';

const VulnsCatalog = dynamic(
  () => import('@/components/vulns-catalog').then((m) => m.VulnsCatalog),
  { ssr: false }
);

import { useUiT } from '@/lib/use-ui-locale';
import type { UiMessageKey } from '@/lib/ui-locale';

type VulnAdminTab =
  | 'repositorio'
  | 'servicios'
  | 'catalogo'
  | 'campos'
  | 'mantenimiento'
  | 'usuarios'
  | 'auditoria';

const VUL_AUDIT_PREFIXES = [
  'admin.',
  'finding',
  'catalog',
  'ingest',
  'publish',
  'consolidate',
  'sync',
  'bulk',
];

export function VulnMgmtAdminPanel() {
  const { role, tenants: sessionTenants, activeTenant, uiLanguage } = useAuth();
  const { t } = useUiT();
  const isPlatformAdmin = role ? hasPlatformAdminAccess(role, sessionTenants) : false;
  const router = useRouter();
  const [tab, setTab] = useState<VulnAdminTab>('repositorio');
  const [audit, setAudit] = useState<AdminAuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    setError(null);
    try {
      const events = await listAuditEvents(80);
      setAudit(
        events.filter((ev) =>
          VUL_AUDIT_PREFIXES.some((p) => ev.action.toLowerCase().includes(p))
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auditErrorLoad'));
    } finally {
      setAuditLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (role && !canAdminTenant(role)) {
      router.replace('/vul-mgmt/dashboard');
      return;
    }
    if (tab === 'auditoria') void loadAudit();
  }, [role, router, tab, loadAudit]);

  if (!role || !canAdminTenant(role)) {
    return null;
  }

  const tabs: { id: VulnAdminTab; labelKey: UiMessageKey; show: boolean }[] = [
    { id: 'repositorio', labelKey: 'tabRepository', show: true },
    { id: 'servicios', labelKey: 'tabServices', show: true },
    { id: 'catalogo', labelKey: 'tabCatalog', show: true },
    { id: 'campos', labelKey: 'tabFields', show: true },
    { id: 'mantenimiento', labelKey: 'tabMaintenance', show: true },
    { id: 'usuarios', labelKey: 'tabUsers', show: true },
    { id: 'auditoria', labelKey: 'tabAudit', show: true },
  ];

  const tabDescriptions: Record<VulnAdminTab, UiMessageKey> = {
    repositorio: 'tabDescRepository',
    servicios: 'tabDescServices',
    catalogo: 'tabDescCatalog',
    campos: 'tabDescFields',
    mantenimiento: 'tabDescMaintenance',
    usuarios: 'tabDescUsers',
    auditoria: 'tabDescAudit',
  };

  const dateLocale = uiLanguage === 'en' ? 'en-US' : 'es';

  return (
    <div className="space-y-6">
      <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-transparent">
        <CardHeader>
          <CardTitle>{t('adminTitle')}</CardTitle>
          <CardDescription className="max-w-3xl text-sm">
            {t('adminSubtitlePrefix')}{' '}
            <span className="font-medium text-foreground">{activeTenant?.nombre ?? '—'}</span>
            {isPlatformAdmin ? ` · ${t('platformAdminBadge')}` : ` · ${t('tenantAdminBadge')}`}.{' '}
            {t('adminSubtitleSuffix')}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="flex flex-wrap gap-2">
        {tabs
          .filter((tabItem) => tabItem.show)
          .map((tabItem) => (
            <Button
              key={tabItem.id}
              type="button"
              variant={tab === tabItem.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab(tabItem.id)}
            >
              {t(tabItem.labelKey)}
            </Button>
          ))}
      </div>

      <p className="text-sm text-muted-foreground -mt-2">{t(tabDescriptions[tab])}</p>

      {error ? (
        <p className="text-sm text-rose-600 border border-rose-500/30 bg-rose-500/10 rounded-lg px-3 py-2">
          {error}
        </p>
      ) : null}

      {tab === 'repositorio' ? <VulnMgmtRepositoryAdminPanel /> : null}
      {tab === 'servicios' ? <VulnMgmtServicesAdminPanel /> : null}
      {tab === 'catalogo' ? (
        <div className="-mx-2">
          <Suspense fallback={<p className="text-sm text-muted-foreground py-8 text-center">{t('loadingCatalog')}</p>}>
            <VulnsCatalog />
          </Suspense>
        </div>
      ) : null}
      {tab === 'campos' ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">{t('officialFieldsTitle')}</CardTitle>
            <CardDescription className="text-sm">{t('officialFieldsMovedHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="outline" size="sm" onClick={() => router.push('/admin')}>
              {t('officialFieldsGoAdmin')}
            </Button>
          </CardContent>
        </Card>
      ) : null}
      {tab === 'mantenimiento' ? <VulnMgmtCatalogMaintenancePanel /> : null}
      {tab === 'usuarios' ? <UsersMembershipPanel /> : null}

      {tab === 'auditoria' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('auditVulnTitle')}</CardTitle>
            <CardDescription className="text-xs">{t('auditVulnDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {auditLoading ? (
              <p className="text-sm text-muted-foreground">{t('loading')}</p>
            ) : audit.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('auditVulnEmpty')}</p>
            ) : (
              <ul className="space-y-2 text-xs max-h-[28rem] overflow-y-auto">
                {audit.map((ev) => (
                  <li key={ev.id} className="rounded-md border border-border px-3 py-2">
                    <span className="font-mono text-muted-foreground">
                      {new Date(ev.created_at).toLocaleString(dateLocale)}
                    </span>
                    <span className="ml-2 font-medium">{ev.action}</span>
                    {ev.details ? (
                      <span className="block mt-1 text-muted-foreground truncate">
                        {JSON.stringify(ev.details)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
