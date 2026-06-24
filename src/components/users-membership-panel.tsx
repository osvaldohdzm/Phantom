'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { useUiT } from '@/lib/use-ui-locale';
import {
  createTenantUser,
  hasPlatformAdminAccess,
  listTenants,
  listUsersWithMemberships,
  removeUserMembership,
  setUserMemberships,
  updateTenantUserRole,
  type AdminTenant,
  type AdminUserWithMemberships,
  type UserRole,
} from '@/lib/auth-api';

const ASSIGNABLE_ROLES: UserRole[] = ['tenant_admin', 'analyst', 'client_viewer'];

type EditRow = { tenant_id: string; role: UserRole };

export function UsersMembershipPanel() {
  const { role, tenants: sessionTenants, activeTenant, refresh } = useAuth();
  const { t, role: roleLabel } = useUiT();
  const isPlatformAdmin = role ? hasPlatformAdminAccess(role, sessionTenants) : false;

  const [users, setUsers] = useState<AdminUserWithMemberships[]>([]);
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('analyst');
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editRows, setEditRows] = useState<EditRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const userList = await listUsersWithMemberships();
      setUsers(userList);
      if (isPlatformAdmin) {
        const t = await listTenants(false);
        setTenants(t);
        if (selectedTenantIds.length === 0 && activeTenant?.id) {
          setSelectedTenantIds([activeTenant.id]);
        }
      } else if (activeTenant?.id) {
        setSelectedTenantIds([activeTenant.id]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('usersErrorLoad'));
    } finally {
      setLoading(false);
    }
  }, [isPlatformAdmin, activeTenant?.id, selectedTenantIds.length, t]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleTenant(id: string) {
    setSelectedTenantIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function onCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTenantIds.length) {
      setError(t('usersErrorSelectTenant'));
      return;
    }
    setError(null);
    try {
      await createTenantUser({
        email,
        nombre,
        password,
        role: newRole,
        tenant_ids: selectedTenantIds,
      });
      setEmail('');
      setNombre('');
      setPassword('');
      await load();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('usersErrorCreate'));
    }
  }

  function openEdit(user: AdminUserWithMemberships) {
    setEditingUserId(user.id);
    setEditRows(
      user.memberships.map((m) => ({
        tenant_id: m.tenant_id,
        role: m.role as UserRole,
      }))
    );
  }

  function addEditRow() {
    const available = tenants.find((t) => !editRows.some((r) => r.tenant_id === t.id));
    if (!available) return;
    setEditRows((rows) => [...rows, { tenant_id: available.id, role: 'analyst' }]);
  }

  async function saveEdit() {
    if (!editingUserId || !editRows.length) return;
    setError(null);
    try {
      await setUserMemberships(
        editingUserId,
        editRows.map((r) => ({ tenant_id: r.tenant_id, role: r.role }))
      );
      setEditingUserId(null);
      await load();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('usersErrorSaveAssignments'));
    }
  }

  async function onRoleChangeInTenant(
    userId: string,
    tenantId: string,
    newUserRole: UserRole
  ) {
    setError(null);
    try {
      await updateTenantUserRole(userId, newUserRole, tenantId);
      await load();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('usersErrorUpdateRole'));
    }
  }

  const tenantOptions = isPlatformAdmin
    ? tenants
    : activeTenant
      ? [{ id: activeTenant.id, nombre: activeTenant.nombre, slug: activeTenant.slug } as AdminTenant]
      : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-5" aria-hidden />
          {t('usersTitle')}
        </CardTitle>
        <CardDescription>
          {isPlatformAdmin
            ? t('usersDescription')
            : `${t('usersTenantOnly')} ${activeTenant?.nombre ?? ''}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4">{t('usersColUser')}</th>
                  <th className="py-2 pr-4">{t('usersColTenants')}</th>
                  {isPlatformAdmin ? <th className="py-2 pr-4 text-right">{t('usersColActions')}</th> : null}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/60 align-top">
                    <td className="py-3 pr-4">
                      <p className="font-medium">{u.nombre}</p>
                      <p className="font-mono text-xs text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <ul className="space-y-1.5">
                        {u.memberships.map((m) => (
                          <li
                            key={m.membership_id}
                            className="flex flex-wrap items-center gap-2 text-xs"
                          >
                            <span className="rounded-md border border-border px-2 py-0.5 font-medium">
                              {m.tenant_nombre}
                            </span>
                            {isPlatformAdmin ? (
                              <select
                                className="h-7 rounded-md border border-border bg-background px-1.5"
                                value={m.role}
                                onChange={(e) =>
                                  void onRoleChangeInTenant(
                                    u.id,
                                    m.tenant_id,
                                    e.target.value as UserRole
                                  )
                                }
                              >
                                {ASSIGNABLE_ROLES.map((r) => (
                                  <option key={r} value={r}>
                                    {roleLabel(r)}
                                  </option>
                                ))}
                                <option value="platform_admin">{roleLabel('platform_admin')}</option>
                              </select>
                            ) : m.tenant_id === activeTenant?.id ? (
                              <select
                                className="h-7 rounded-md border border-border bg-background px-1.5"
                                value={m.role}
                                onChange={(e) =>
                                  void onRoleChangeInTenant(
                                    u.id,
                                    m.tenant_id,
                                    e.target.value as UserRole
                                  )
                                }
                              >
                                {ASSIGNABLE_ROLES.map((r) => (
                                  <option key={r} value={r}>
                                    {roleLabel(r)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-muted-foreground">{roleLabel(m.role as UserRole) ?? m.role}</span>
                            )}
                            {isPlatformAdmin && u.memberships.length > 1 ? (
                              <button
                                type="button"
                                className="text-rose-600 hover:underline"
                                onClick={() =>
                                  void removeUserMembership(u.id, m.tenant_id)
                                    .then(() => load())
                                    .then(() => refresh())
                                }
                              >
                                {t('usersRemove')}
                              </button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </td>
                    {isPlatformAdmin ? (
                      <td className="py-3 pr-4 text-right">
                        <Button type="button" variant="outline" size="sm" onClick={() => openEdit(u)}>
                          {t('usersEditTenants')}
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {editingUserId && isPlatformAdmin ? (
          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-sm font-medium">{t('usersTenantAssignment')}</p>
            {editRows.map((row, idx) => (
              <div key={`${row.tenant_id}-${idx}`} className="flex flex-wrap gap-2 items-center">
                <select
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm min-w-[10rem]"
                  value={row.tenant_id}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEditRows((rows) =>
                      rows.map((r, i) => (i === idx ? { ...r, tenant_id: v } : r))
                    );
                  }}
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
                <select
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                  value={row.role}
                  onChange={(e) => {
                    const v = e.target.value as UserRole;
                    setEditRows((rows) =>
                      rows.map((r, i) => (i === idx ? { ...r, role: v } : r))
                    );
                  }}
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                  <option value="platform_admin">{roleLabel('platform_admin')}</option>
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditRows((rows) => rows.filter((_, i) => i !== idx))}
                  disabled={editRows.length <= 1}
                >
                  {t('usersRemove')}
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={addEditRow}>
                <Plus className="size-3.5 mr-1" aria-hidden />
                {t('usersAddTenant')}
              </Button>
              <Button type="button" size="sm" onClick={() => void saveEdit()}>
                {t('usersSaveAssignments')}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingUserId(null)}>
                {t('usersCancel')}
              </Button>
            </div>
          </div>
        ) : null}

        <form onSubmit={onCreateUser} className="space-y-4 pt-4 border-t border-border">
          <p className="text-sm font-medium">{t('usersNewTitle')}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input
              placeholder={t('usersEmail')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              placeholder={t('usersName')}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
            <Input
              placeholder={t('usersPassword')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
              {isPlatformAdmin ? (
                <option value="platform_admin">{roleLabel('platform_admin')}</option>
              ) : null}
            </select>
          </div>

          {tenantOptions.length > 0 ? (
            <fieldset className="space-y-2">
              <legend className="text-xs text-muted-foreground">{t('usersAssignTenants')}</legend>
              <div className="flex flex-wrap gap-3">
                {tenantOptions.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-2 text-sm rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTenantIds.includes(t.id)}
                      onChange={() => toggleTenant(t.id)}
                      disabled={!isPlatformAdmin && t.id !== activeTenant?.id}
                    />
                    {t.nombre}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <Button type="submit">{t('usersCreateAssign')}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
