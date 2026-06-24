'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import {
  createTenant,
  deleteTenant,
  listTenants,
  updateTenant,
  type AdminTenant,
} from '@/lib/auth-api';
import { useUiT } from '@/lib/use-ui-locale';
import { uiFormat } from '@/lib/ui-locale';
import type { TenantLanguage } from '@/lib/tenant-locale';

function slugifyPreview(nombre: string) {
  return nombre
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

export function TenantsCrudPanel() {
  const { refresh } = useAuth();
  const { t } = useUiT();
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [slug, setSlug] = useState('');
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [defaultLanguage, setDefaultLanguage] = useState<TenantLanguage>('es');
  const [slugTouched, setSlugTouched] = useState(false);

  const [editSlug, setEditSlug] = useState('');
  const [editNombre, setEditNombre] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<AdminTenant | null>(null);
  const [confirmSlugInput, setConfirmSlugInput] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTenants(await listTenants(showInactive));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar tenants');
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await createTenant({
        slug: slug || slugifyPreview(nombre),
        nombre,
        descripcion: descripcion || undefined,
        default_language: defaultLanguage,
        add_me_as_admin: true,
      });
      setSlug('');
      setNombre('');
      setDescripcion('');
      setSlugTouched(false);
      await load();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el tenant');
    }
  }

  function startEdit(tenant: AdminTenant) {
    setEditingId(tenant.id);
    setEditSlug(tenant.slug);
    setEditNombre(tenant.nombre);
    setEditDescripcion(tenant.descripcion ?? '');
    setEditActive(tenant.is_active);
    setNotice(null);
    setError(null);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setError(null);
    setNotice(null);
    try {
      await updateTenant(editingId, {
        slug: editSlug,
        nombre: editNombre,
        descripcion: editDescripcion || null,
        is_active: editActive,
      });
      setEditingId(null);
      await load();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar');
    }
  }

  async function onSetActive(tenant: AdminTenant, active: boolean) {
    const message = active
      ? uiFormat(t('tenantsConfirmReactivate'), { name: tenant.nombre })
      : uiFormat(t('tenantsConfirmDeactivate'), { name: tenant.nombre });
    if (!window.confirm(message)) return;

    setBusyId(tenant.id);
    setError(null);
    setNotice(null);
    try {
      await updateTenant(tenant.id, { is_active: active });
      setNotice(active ? t('tenantsReactivated') : t('tenantsDeactivated'));
      if (editingId === tenant.id) setEditActive(active);
      await load();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setBusyId(null);
    }
  }

  function openDelete(tenant: AdminTenant) {
    setError(null);
    setNotice(null);
    if (tenant.engagements_count === 0) {
      if (!window.confirm(uiFormat(t('tenantsConfirmDelete'), { name: tenant.nombre }))) {
        return;
      }
      void executeDelete(tenant, false);
      return;
    }
    setConfirmSlugInput('');
    setDeleteTarget(tenant);
  }

  async function executeDelete(tenant: AdminTenant, purge: boolean, confirmSlug?: string) {
    setBusyId(tenant.id);
    setError(null);
    setNotice(null);
    try {
      const result = await deleteTenant(tenant.id, {
        purge,
        confirmSlug,
      });
      if (purge && tenant.engagements_count > 0) {
        setNotice(
          uiFormat(t('tenantsDeletedWithData'), {
            projects: String(result.purge_stats?.engagements ?? tenant.engagements_count),
          })
        );
      } else {
        setNotice(t('tenantsDeleted'));
      }
      setDeleteTarget(null);
      setConfirmSlugInput('');
      if (editingId === tenant.id) setEditingId(null);
      await load();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
    } finally {
      setBusyId(null);
    }
  }

  function confirmDeleteWithData() {
    if (!deleteTarget) return;
    if (confirmSlugInput.trim().toLowerCase() !== deleteTarget.slug.toLowerCase()) {
      setError(t('tenantsConfirmSlugMismatch'));
      return;
    }
    void executeDelete(deleteTarget, true, confirmSlugInput.trim());
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-5" aria-hidden />
          {t('tenantsTitle')}
        </CardTitle>
        <CardDescription>{t('tenantsDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          {t('tenantsShowInactive')}
        </label>

        <p className="text-xs text-muted-foreground rounded-md border border-border/80 bg-muted/30 px-3 py-2">
          {t('tenantsHelpDelete')}
        </p>

        {notice ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 rounded-md px-3 py-2">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-rose-600 border border-rose-500/30 bg-rose-500/10 rounded-md px-3 py-2">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">{t('tenantsLoading')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-3">{t('tenantsColName')}</th>
                  <th className="py-2 pr-3">{t('tenantsColSlug')}</th>
                  <th className="py-2 pr-3">{t('tenantsColUsers')}</th>
                  <th className="py-2 pr-3">{t('tenantsColProjects')}</th>
                  <th className="py-2 pr-3">{t('tenantsColStatus')}</th>
                  <th className="py-2 pr-3 text-right">{t('tenantsColActions')}</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => {
                  const needsPurge = tenant.engagements_count > 0;
                  const isBusy = busyId === tenant.id;
                  return (
                    <tr key={tenant.id} className="border-b border-border/60 align-top">
                      <td className="py-2 pr-3 font-medium">{tenant.nombre}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{tenant.slug}</td>
                      <td className="py-2 pr-3">{tenant.users_count}</td>
                      <td className="py-2 pr-3">{tenant.engagements_count}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={
                            tenant.is_active
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-muted-foreground'
                          }
                        >
                          {tenant.is_active ? t('tenantsStatusActive') : t('tenantsStatusInactive')}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2"
                            disabled={isBusy}
                            onClick={() => startEdit(tenant)}
                            title={t('tenantsEdit')}
                          >
                            <Pencil className="size-3.5" aria-hidden />
                            <span className="sr-only">{t('tenantsEdit')}</span>
                          </Button>
                          {tenant.is_active ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 px-2 text-amber-700 dark:text-amber-300"
                              disabled={isBusy}
                              onClick={() => void onSetActive(tenant, false)}
                              title={t('tenantsDeactivate')}
                            >
                              <Power className="size-3.5" aria-hidden />
                              <span className="hidden sm:inline text-xs">{t('tenantsDeactivate')}</span>
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 px-2 text-emerald-700 dark:text-emerald-300"
                              disabled={isBusy}
                              onClick={() => void onSetActive(tenant, true)}
                              title={t('tenantsReactivate')}
                            >
                              <Power className="size-3.5" aria-hidden />
                              <span className="hidden sm:inline text-xs">{t('tenantsReactivate')}</span>
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 px-2 text-rose-600"
                            disabled={isBusy}
                            onClick={() => openDelete(tenant)}
                            title={
                              needsPurge ? t('tenantsDeleteBlocked') : t('tenantsDelete')
                            }
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                            <span className="hidden sm:inline text-xs">{t('tenantsDelete')}</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {deleteTarget ? (
          <div
            className="rounded-lg border border-rose-500/40 bg-rose-500/5 p-4 space-y-3"
            role="dialog"
            aria-labelledby="tenant-delete-title"
          >
            <p id="tenant-delete-title" className="text-sm font-medium text-rose-700 dark:text-rose-300">
              {uiFormat(t('tenantsConfirmDeleteWithData'), { name: deleteTarget.nombre })}
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              {deleteTarget.slug} · {deleteTarget.engagements_count} {t('tenantsColProjects').toLowerCase()}
            </p>
            <label className="block space-y-1.5 text-sm">
              <span>{t('tenantsConfirmSlugLabel')}</span>
              <Input
                value={confirmSlugInput}
                onChange={(e) => setConfirmSlugInput(e.target.value)}
                placeholder={t('tenantsConfirmSlugPlaceholder')}
                className="font-mono"
                autoComplete="off"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="destructive"
                disabled={busyId === deleteTarget.id}
                onClick={confirmDeleteWithData}
              >
                {t('tenantsDelete')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busyId === deleteTarget.id}
                onClick={() => {
                  setDeleteTarget(null);
                  setConfirmSlugInput('');
                }}
              >
                {t('tenantsCancel')}
              </Button>
            </div>
          </div>
        ) : null}

        {editingId ? (
          <form onSubmit={saveEdit} className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-sm font-medium">{t('tenantsEditTitle')}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} required />
              <Input
                value={editSlug}
                onChange={(e) => setEditSlug(e.target.value)}
                className="font-mono text-sm"
                required
              />
            </div>
            <Input
              placeholder={t('tenantsDescOptional')}
              value={editDescripcion}
              onChange={(e) => setEditDescripcion(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
              />
              {t('tenantsEditActive')}
            </label>
            <div className="flex gap-2">
              <Button type="submit">{t('tenantsSave')}</Button>
              <Button type="button" variant="outline" onClick={() => setEditingId(null)}>
                {t('tenantsCancel')}
              </Button>
            </div>
          </form>
        ) : null}

        <form onSubmit={onCreate} className="grid sm:grid-cols-2 gap-3 pt-4 border-t border-border">
          <p className="sm:col-span-2 text-sm font-medium flex items-center gap-2">
            <Plus className="size-4" aria-hidden />
            {t('tenantsNew')}
          </p>
          <Input
            placeholder="Nombre de la organización"
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              if (!slugTouched) setSlug(slugifyPreview(e.target.value));
            }}
            required
          />
          <Input
            placeholder="slug-url"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            className="font-mono text-sm"
            required
          />
          <Input
            placeholder={t('tenantsDescOptional')}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="sm:col-span-2"
          />
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2 max-w-xs">
            <span className="text-xs text-muted-foreground">{t('tenantCreateDefaultLang')}</span>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={defaultLanguage}
              onChange={(e) => setDefaultLanguage(e.target.value as TenantLanguage)}
            >
              <option value="es">{t('languageSpanish')}</option>
              <option value="en">{t('languageEnglish')}</option>
            </select>
          </label>
          <div className="sm:col-span-2">
            <Button type="submit">{t('tenantsCreate')}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
