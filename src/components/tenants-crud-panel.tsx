'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react';
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
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [slug, setSlug] = useState('');
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);

  const [editSlug, setEditSlug] = useState('');
  const [editNombre, setEditNombre] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editActive, setEditActive] = useState(true);

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
    try {
      await createTenant({
        slug: slug || slugifyPreview(nombre),
        nombre,
        descripcion: descripcion || undefined,
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

  function startEdit(t: AdminTenant) {
    setEditingId(t.id);
    setEditSlug(t.slug);
    setEditNombre(t.nombre);
    setEditDescripcion(t.descripcion ?? '');
    setEditActive(t.is_active);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setError(null);
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

  async function onDelete(t: AdminTenant) {
    if (
      !window.confirm(
        `¿Eliminar tenant «${t.nombre}»? Solo es posible si no tiene proyectos.`
      )
    ) {
      return;
    }
    setError(null);
    try {
      await deleteTenant(t.id);
      await load();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-5" aria-hidden />
          Organizaciones (tenants)
        </CardTitle>
        <CardDescription>
          Crear, editar y desactivar tenants. Solo administradores de plataforma.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Mostrar inactivos
        </label>

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-3">Nombre</th>
                  <th className="py-2 pr-3">Slug</th>
                  <th className="py-2 pr-3">Usuarios</th>
                  <th className="py-2 pr-3">Proyectos</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-3 font-medium">{t.nombre}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{t.slug}</td>
                    <td className="py-2 pr-3">{t.users_count}</td>
                    <td className="py-2 pr-3">{t.engagements_count}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={
                          t.is_active
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-muted-foreground'
                        }
                      >
                        {t.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => startEdit(t)}
                        >
                          <Pencil className="size-3.5" aria-hidden />
                          <span className="sr-only">Editar</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-rose-600"
                          onClick={() => void onDelete(t)}
                          disabled={t.engagements_count > 0}
                          title={
                            t.engagements_count > 0
                              ? 'Tiene proyectos: desactívalo en lugar de borrar'
                              : 'Eliminar tenant'
                          }
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {editingId ? (
          <form onSubmit={saveEdit} className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-sm font-medium">Editar tenant</p>
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
              placeholder="Descripción"
              value={editDescripcion}
              onChange={(e) => setEditDescripcion(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
              />
              Tenant activo
            </label>
            <div className="flex gap-2">
              <Button type="submit">Guardar cambios</Button>
              <Button type="button" variant="outline" onClick={() => setEditingId(null)}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : null}

        <form onSubmit={onCreate} className="grid sm:grid-cols-2 gap-3 pt-4 border-t border-border">
          <p className="sm:col-span-2 text-sm font-medium flex items-center gap-2">
            <Plus className="size-4" aria-hidden />
            Nuevo tenant
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
            placeholder="Descripción (opcional)"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="sm:col-span-2"
          />
          <div className="sm:col-span-2">
            <Button type="submit">Crear tenant</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
