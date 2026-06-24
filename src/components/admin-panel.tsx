'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { TenantsCrudPanel } from '@/components/tenants-crud-panel';
import { UsersMembershipPanel } from '@/components/users-membership-panel';
import { AuditEventsPanel } from '@/components/audit-events-panel';
import { useAuth } from '@/contexts/auth-context';
import { canAdminTenant, hasPlatformAdminAccess } from '@/lib/auth-api';
import { canViewPlatformAudit, canViewTenantAudit } from '@/lib/rbac-permissions';

import { TenantBrandingPanel } from '@/components/tenant-branding-panel';
import { DatabaseConfigPanel } from '@/components/database-config-panel';
import { useUiT } from '@/lib/use-ui-locale';
import type { UiMessageKey } from '@/lib/ui-locale';

type TenantAdminTab = 'tenant-settings' | 'users' | 'tenant-audit';
type PlatformAdminTab = 'tenants' | 'database' | 'audit';
type AdminTab = TenantAdminTab | PlatformAdminTab;

export function AdminPanel() {
  const { role, tenants, activeTenant } = useAuth();
  const { t } = useUiT();
  const isPlatformAdmin = role ? hasPlatformAdminAccess(role, tenants) : false;
  const showTenantAudit = canViewTenantAudit(role);
  const showPlatformAudit = canViewPlatformAudit(role, tenants);
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>('tenant-settings');
  const [error] = useState<string | null>(null);

  useEffect(() => {
    if (role && !canAdminTenant(role)) {
      router.replace('/');
    }
  }, [role, router]);

  if (!role || !canAdminTenant(role)) {
    return null;
  }

  const tenantTabs: { id: TenantAdminTab; labelKey: UiMessageKey; show: boolean }[] = [
    { id: 'tenant-settings', labelKey: 'platformTabTenantSettings', show: true },
    { id: 'users', labelKey: 'platformTabUsers', show: true },
    { id: 'tenant-audit', labelKey: 'platformTabTenantAudit', show: showTenantAudit },
  ];

  const platformTabs: { id: PlatformAdminTab; labelKey: UiMessageKey; show: boolean }[] = [
    { id: 'tenants', labelKey: 'platformTabTenants', show: isPlatformAdmin },
    { id: 'database', labelKey: 'platformTabDatabase', show: isPlatformAdmin },
    { id: 'audit', labelKey: 'platformTabAudit', show: showPlatformAudit },
  ];

  const tabDescriptions: Record<AdminTab, UiMessageKey> = {
    'tenant-settings': 'platformDescTenantSettings',
    users: 'usersAdminSubtitle',
    'tenant-audit': 'auditTenantDescription',
    tenants: 'platformDescTenants',
    database: 'platformDescDatabase',
    audit: 'platformDescAudit',
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t('platformAdminTitle')}</h1>
        <p className="text-muted-foreground mt-2">
          {tab === 'users' && activeTenant ? (
            <>
              {t('usersAdminSubtitle')}
              {' · '}
              {t('usersActiveTenant')}:{' '}
              <span className="font-medium text-foreground">{activeTenant.nombre}</span>
            </>
          ) : (
            t(tabDescriptions[tab])
          )}
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
            {t('platformTabTenantSection')}
            {activeTenant ? (
              <span className="normal-case tracking-normal font-normal">
                {' '}
                · <span className="text-foreground">{activeTenant.nombre}</span>
              </span>
            ) : null}
          </p>
          <div className="flex flex-wrap gap-2">
            {tenantTabs
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
          <p className="text-xs text-muted-foreground mt-2 max-w-3xl">{t('adminScopeTenantHint')}</p>
        </div>

        {isPlatformAdmin ? (
          <div className="pt-2 border-t border-border">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
              {t('platformTabPlatformSection')}
            </p>
            <div className="flex flex-wrap gap-2">
              {platformTabs
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
            <p className="text-xs text-muted-foreground mt-2 max-w-3xl">{t('adminScopePlatformHint')}</p>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-rose-600 border border-rose-500/30 bg-rose-500/10 rounded-lg px-3 py-2">
          {error}
        </p>
      ) : null}

      {tab === 'tenant-settings' ? <TenantBrandingPanel /> : null}
      {tab === 'users' ? <UsersMembershipPanel /> : null}
      {tab === 'tenant-audit' ? <AuditEventsPanel scope="tenant" /> : null}
      {tab === 'database' && isPlatformAdmin ? <DatabaseConfigPanel /> : null}
      {tab === 'tenants' && isPlatformAdmin ? <TenantsCrudPanel /> : null}
      {tab === 'audit' ? <AuditEventsPanel scope="platform" /> : null}
    </div>
  );
}
