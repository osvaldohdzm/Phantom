'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TenantsCrudPanel } from '@/components/tenants-crud-panel';
import { UsersMembershipPanel } from '@/components/users-membership-panel';
import { useAuth } from '@/contexts/auth-context';
import {
  canAdminTenant,
  canManageTenants,
  listAuditEvents,
  type AdminAuditEvent,
} from '@/lib/auth-api';

import { TenantBrandingPanel } from '@/components/tenant-branding-panel';
import { DatabaseConfigPanel } from '@/components/database-config-panel';

type AdminTab = 'tenants' | 'users' | 'audit' | 'branding' | 'database';

export function AdminPanel() {
  const { role, activeTenant } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>(role === 'platform_admin' ? 'users' : 'users');
  const [audit, setAudit] = useState<AdminAuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    setError(null);
    try {
      setAudit(await listAuditEvents(30));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar auditoría');
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (role && !canAdminTenant(role)) {
      router.replace('/');
      return;
    }
    if (tab === 'audit') void loadAudit();
  }, [role, router, tab, loadAudit]);

  if (!role || !canAdminTenant(role)) {
    return null;
  }

  const tabs: { id: AdminTab; label: string; show: boolean }[] = [
    { id: 'users', label: 'Usuarios', show: true },
    { id: 'branding', label: 'Apariencia', show: true },
    { id: 'database', label: 'Base de datos', show: canManageTenants(role) },
    { id: 'tenants', label: 'Tenants', show: canManageTenants(role) },
    { id: 'audit', label: 'Auditoría', show: true },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Administración</h1>
        <p className="text-muted-foreground mt-2">
          {tab === 'tenants'
            ? 'Organizaciones (tenants) de la plataforma'
            : tab === 'branding'
              ? 'White-label: logo, colores, login, informes y dominio'
            : tab === 'database'
              ? 'Configuración avanzada de base de datos (solo lectura en esta instancia)'
              : tab === 'users'
              ? (
                <>
                  Usuarios y asignación multi-tenant
                  {activeTenant ? (
                    <>
                      {' '}
                      · tenant activo:{' '}
                      <span className="font-medium text-foreground">{activeTenant.nombre}</span>
                    </>
                  ) : null}
                </>
              )
              : 'Registro de acciones de administración'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <Button
              key={t.id}
              type="button"
              variant={tab === t.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </Button>
          ))}
      </div>

      {error ? (
        <p className="text-sm text-rose-600 border border-rose-500/30 bg-rose-500/10 rounded-lg px-3 py-2">
          {error}
        </p>
      ) : null}

      {tab === 'users' ? <UsersMembershipPanel /> : null}
      {tab === 'branding' ? <TenantBrandingPanel /> : null}
      {tab === 'database' && canManageTenants(role) ? <DatabaseConfigPanel /> : null}
      {tab === 'tenants' && canManageTenants(role) ? <TenantsCrudPanel /> : null}

      {tab === 'audit' ? (
        <Card>
          <CardHeader>
            <CardTitle>Auditoría reciente</CardTitle>
            <CardDescription>Login, tenants, usuarios y membresías.</CardDescription>
          </CardHeader>
          <CardContent>
            {auditLoading ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : audit.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin eventos aún.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {audit.map((ev) => (
                  <li key={ev.id} className="rounded-md border border-border px-3 py-2">
                    <span className="font-mono text-muted-foreground">
                      {new Date(ev.created_at).toLocaleString('es')}
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
