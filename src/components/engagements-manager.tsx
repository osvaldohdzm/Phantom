'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  Trash2,
  AlertCircle,
  FilePlus2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { pickDefaultEngagement } from '@/lib/default-engagement';
import {
  createEngagement,
  deleteEngagement,
  getEngagement,
  listEngagements,
  updateEngagement,
  type Engagement,
  type EngagementCreateBody,
} from '@/lib/secops-api';
import {
  ALCANCE_RED,
  ESTADOS_PROYECTO,
  HERRAMIENTAS,
  INTRUSIVIDAD,
  METODOS_ANALISIS,
  REPORTING_OPTIONS,
  SCM_OPTIONS,
  TIPOS_ANALISIS,
  TIPOS_SERVICIO,
  defaultEngagementForm,
  mergeEngagementProfile,
  resolveClienteForSave,
  sectionsForTipoServicio,
  validateEngagementForm,
  type EngagementFormState,
  type EngagementProfile,
  type EngagementSectionId,
  type TipoAnalisis,
} from '@/lib/engagement-profile';

const selectClass =
  'h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 scheme-light dark:scheme-dark';

const labelClass = 'text-[11px] font-medium text-muted-foreground';
const sectionClass =
  'rounded-md border border-border bg-muted/20 [&>summary]:cursor-pointer [&>summary]:px-3 [&>summary]:py-2 [&>summary]:text-xs [&>summary]:font-medium [&>summary]:text-foreground [&>summary]:select-none';

function FormSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className={sectionClass} open={defaultOpen}>
      <summary>{title}</summary>
      <div className="space-y-2 border-t border-border px-3 py-2">{children}</div>
    </details>
  );
}

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className={labelClass}>
      {children}
      {required ? <span className="text-destructive"> *</span> : null}
    </label>
  );
}

function BoolField({
  label,
  checked,
  onChange,
  note,
  onNoteChange,
  notePlaceholder,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  note?: string;
  onNoteChange?: (v: string) => void;
  notePlaceholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-xs text-foreground">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="rounded border-input"
        />
        {label}
      </label>
      {onNoteChange && checked && (
        <Input
          placeholder={notePlaceholder}
          value={note ?? ''}
          onChange={(e) => onNoteChange(e.target.value)}
          className="text-xs h-8 bg-background"
        />
      )}
    </div>
  );
}

function engagementToForm(eg: Engagement): EngagementFormState {
  return {
    cliente: eg.cliente,
    nombre_proyecto: eg.nombre_proyecto ?? '',
    tipo_servicio: eg.tipo_servicio ?? '',
    estado: eg.estado ?? 'Planificado',
    responsable: eg.responsable ?? '',
    fecha_inicio: eg.fecha_inicio?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    fecha_fin: eg.fecha_fin?.slice(0, 10) ?? '',
    tipo: (TIPOS_ANALISIS.includes(eg.tipo as TipoAnalisis) ? eg.tipo : 'Caja Negra') as TipoAnalisis,
    profile: mergeEngagementProfile(eg.profile),
  };
}

function formToBody(form: EngagementFormState): EngagementCreateBody {
  const cliente = resolveClienteForSave(form);
  return {
    cliente,
    nombre_proyecto: form.nombre_proyecto.trim() || cliente,
    estado: form.estado || undefined,
    responsable: form.responsable.trim() || undefined,
    tipo_servicio: form.tipo_servicio || undefined,
    fecha_inicio: form.fecha_inicio,
    fecha_fin: form.fecha_fin || undefined,
    tipo: form.tipo,
    profile: form.profile,
  };
}

function fieldErrorClass(invalid: boolean) {
  return cn(invalid && 'border-destructive ring-1 ring-destructive/40');
}

export function EngagementsManager({
  selectedId,
  onSelect,
  onSaved,
}: {
  selectedId?: string;
  onSelect: (id: string, meta?: { cliente?: string; tipo_servicio?: string }) => void;
  onSaved?: (id: string, meta?: { cliente?: string; tipo_servicio?: string }) => void;
}) {
  const [items, setItems] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EngagementFormState>(defaultEngagementForm);
  const [showValidation, setShowValidation] = useState(false);

  const validation = useMemo(() => validateEngagementForm(form), [form]);
  const visibleSections = useMemo(
    () => new Set(sectionsForTipoServicio(form.tipo_servicio)),
    [form.tipo_servicio]
  );

  const showSection = (id: EngagementSectionId) => visibleSections.has(id);

  const setProfile = (updater: (p: EngagementProfile) => EngagementProfile) => {
    setForm((f) => ({ ...f, profile: updater(f.profile) }));
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listEngagements();
      setItems(data);
      if (!selectedId) {
        const def = pickDefaultEngagement(data);
        if (def) {
          onSelect(def.id, {
            cliente: def.nombre_proyecto || def.cliente,
            tipo_servicio: def.tipo_servicio ?? undefined,
          });
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar proyectos');
    } finally {
      setLoading(false);
    }
  }, [selectedId, onSelect]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => setSuccess(null), 5000);
    return () => window.clearTimeout(t);
  }, [success]);

  const resetForm = () => {
    setEditingId(null);
    setForm(defaultEngagementForm());
    setShowValidation(false);
    setSuccess(null);
    onSelect('');
  };

  const loadIntoForm = async (id: string) => {
    setBusy(true);
    setError(null);
    setShowValidation(false);
    try {
      const eg = await getEngagement(id);
      setEditingId(id);
      setForm(engagementToForm(eg));
      onSelect(id, {
        cliente: eg.nombre_proyecto || eg.cliente,
        tipo_servicio: eg.tipo_servicio ?? undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar proyecto');
    } finally {
      setBusy(false);
    }
  };

  const afterSave = (eg: Engagement) => {
    const label = eg.nombre_proyecto || eg.cliente;
    setEditingId(eg.id);
    setForm(engagementToForm(eg));
    setSuccess(`Proyecto guardado: ${label}`);
    setShowValidation(false);
    onSelect(eg.id, { cliente: label, tipo_servicio: eg.tipo_servicio ?? undefined });
    onSaved?.(eg.id, { cliente: label, tipo_servicio: eg.tipo_servicio ?? undefined });
  };

  const handleSaveProject = async () => {
    setShowValidation(true);
    if (!validation.valid) return;

    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const body = formToBody(form);
      if (editingId) {
        const updated = await updateEngagement(editingId, body);
        afterSave(updated);
      } else {
        const created = await createEngagement(body);
        afterSave(created);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar proyecto');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este proyecto/engagement? Los hallazgos quedarán sin agrupar.')) return;
    setBusy(true);
    try {
      await deleteEngagement(id);
      if (selectedId === id) onSelect('');
      if (editingId === id) resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
    } finally {
      setBusy(false);
    }
  };

  const invalid = (key: string) => showValidation && validation.missingKeys.has(key);
  const p = form.profile;
  const canSave = validation.valid;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Briefcase className="size-4 text-violet-500 dark:text-violet-400" />
          Proyectos / Engagements / Servicios
        </CardTitle>
        <CardDescription className="text-xs">
          Define alcance, accesos y reglas del engagement.{' '}
          <span className="text-foreground/90">
            Obligatorio para guardar: cliente o nombre de proyecto, tipo de servicio y fecha de
            inicio.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <p className="text-xs text-destructive flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2">
            <AlertCircle className="size-3.5 shrink-0" />
            {error}
          </p>
        )}

        {success && (
          <p className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2">
            <CheckCircle2 className="size-3.5 shrink-0" />
            {success}
          </p>
        )}

        {showValidation && !validation.valid && (
          <ul className="text-xs text-destructive space-y-0.5 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 list-disc pl-5">
            {validation.errors.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {editingId ? 'Editando proyecto guardado' : 'Nuevo proyecto (sin guardar)'}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={resetForm} disabled={busy}>
            <FilePlus2 className="size-3.5 mr-1" />
            Nuevo
          </Button>
        </div>

        <div className="max-h-[26rem] overflow-y-auto space-y-2 pr-1">
          <FormSection title="Engagement / Proyecto" defaultOpen>
            <div className="grid sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <FieldLabel required={!form.nombre_proyecto.trim()}>Cliente</FieldLabel>
                <Input
                  placeholder="Nombre del cliente"
                  value={form.cliente}
                  onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value }))}
                  className={cn('text-sm bg-background', fieldErrorClass(invalid('cliente')))}
                />
              </div>
              <div className="space-y-1">
                <FieldLabel required={!form.cliente.trim()}>Nombre proyecto</FieldLabel>
                <Input
                  placeholder="Nombre del proyecto"
                  value={form.nombre_proyecto}
                  onChange={(e) => setForm((f) => ({ ...f, nombre_proyecto: e.target.value }))}
                  className={cn('text-sm bg-background', fieldErrorClass(invalid('nombre_proyecto')))}
                />
              </div>
              <div className="space-y-1">
                <FieldLabel required>Tipo servicio</FieldLabel>
                <select
                  value={form.tipo_servicio}
                  onChange={(e) => setForm((f) => ({ ...f, tipo_servicio: e.target.value }))}
                  className={cn(selectClass, fieldErrorClass(invalid('tipo_servicio')))}
                >
                  <option value="">— Seleccionar —</option>
                  {TIPOS_SERVICIO.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <FieldLabel>Estado</FieldLabel>
                <select
                  value={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}
                  className={selectClass}
                >
                  {ESTADOS_PROYECTO.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <FieldLabel>Responsable</FieldLabel>
                <Input
                  placeholder="Analista responsable"
                  value={form.responsable}
                  onChange={(e) => setForm((f) => ({ ...f, responsable: e.target.value }))}
                  className="text-sm bg-background"
                />
              </div>
              <div className="space-y-1">
                <FieldLabel required>Fecha inicio</FieldLabel>
                <Input
                  type="date"
                  value={form.fecha_inicio}
                  onChange={(e) => setForm((f) => ({ ...f, fecha_inicio: e.target.value }))}
                  className={cn(
                    'text-sm bg-background scheme-light dark:scheme-dark',
                    fieldErrorClass(invalid('fecha_inicio'))
                  )}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <FieldLabel>Fecha fin</FieldLabel>
                <Input
                  type="date"
                  value={form.fecha_fin}
                  onChange={(e) => setForm((f) => ({ ...f, fecha_fin: e.target.value }))}
                  className="text-sm bg-background scheme-light dark:scheme-dark"
                />
              </div>
            </div>
          </FormSection>

          {!form.tipo_servicio ? (
            <p className="text-xs text-muted-foreground rounded-md border border-dashed border-border px-3 py-2">
              Selecciona el <strong className="font-medium text-foreground">tipo de servicio</strong>{' '}
              para mostrar alcance, accesos y campos específicos (DAST, SAST, infra, etc.).
            </p>
          ) : null}

          {showSection('alcance') && form.tipo_servicio ? (
            <FormSection title="Alcance">
              <div className="grid sm:grid-cols-2 gap-2">
                {(
                  [
                    ['ips', 'IPs'],
                    ['dominios', 'Dominios'],
                    ['urls', 'URLs'],
                    ['ambientes', 'Ambientes'],
                    ['activos_incluidos', 'Activos incluidos'],
                    ['activos_excluidos', 'Activos excluidos'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <FieldLabel>{label}</FieldLabel>
                    <Input
                      value={p.alcance[key]}
                      onChange={(e) =>
                        setProfile((pr) => ({
                          ...pr,
                          alcance: { ...pr.alcance, [key]: e.target.value },
                        }))
                      }
                      className="text-sm bg-background"
                    />
                  </div>
                ))}
              </div>
            </FormSection>
          ) : null}

          {showSection('tipo_analisis') && form.tipo_servicio ? (
            <FormSection title="Tipo de análisis">
              <div className="grid sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <FieldLabel>Caja Negra / Gris / Blanca</FieldLabel>
                  <select
                    value={form.tipo}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tipo: e.target.value as TipoAnalisis }))
                    }
                    className={selectClass}
                  >
                    {TIPOS_ANALISIS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <FieldLabel>Método</FieldLabel>
                  <select
                    value={p.tipo_analisis.metodo}
                    onChange={(e) =>
                      setProfile((pr) => ({
                        ...pr,
                        tipo_analisis: { ...pr.tipo_analisis, metodo: e.target.value },
                      }))
                    }
                    className={selectClass}
                  >
                    <option value="">—</option>
                    {METODOS_ANALISIS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <FieldLabel>Alcance red</FieldLabel>
                  <select
                    value={p.tipo_analisis.alcance_red}
                    onChange={(e) =>
                      setProfile((pr) => ({
                        ...pr,
                        tipo_analisis: { ...pr.tipo_analisis, alcance_red: e.target.value },
                      }))
                    }
                    className={selectClass}
                  >
                    <option value="">—</option>
                    {ALCANCE_RED.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <FieldLabel>Intrusividad</FieldLabel>
                  <select
                    value={p.tipo_analisis.intrusivo}
                    onChange={(e) =>
                      setProfile((pr) => ({
                        ...pr,
                        tipo_analisis: { ...pr.tipo_analisis, intrusivo: e.target.value },
                      }))
                    }
                    className={selectClass}
                  >
                    <option value="">—</option>
                    {INTRUSIVIDAD.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </FormSection>
          ) : null}

          {showSection('accesos') && form.tipo_servicio ? (
            <FormSection title="Accesos">
              <div className="grid sm:grid-cols-2 gap-3">
                <BoolField
                  label="Credenciales entregadas"
                  checked={p.accesos.credenciales_entregadas}
                  onChange={(v) =>
                    setProfile((pr) => ({
                      ...pr,
                      accesos: { ...pr.accesos, credenciales_entregadas: v },
                    }))
                  }
                  note={p.accesos.credenciales_notas ?? ''}
                  onNoteChange={(v) =>
                    setProfile((pr) => ({
                      ...pr,
                      accesos: { ...pr.accesos, credenciales_notas: v },
                    }))
                  }
                  notePlaceholder="Detalle de credenciales"
                />
                <BoolField
                  label="VPN requerida"
                  checked={p.accesos.vpn_requerida}
                  onChange={(v) =>
                    setProfile((pr) => ({
                      ...pr,
                      accesos: { ...pr.accesos, vpn_requerida: v },
                    }))
                  }
                  note={p.accesos.vpn_notas ?? ''}
                  onNoteChange={(v) =>
                    setProfile((pr) => ({
                      ...pr,
                      accesos: { ...pr.accesos, vpn_notas: v },
                    }))
                  }
                  notePlaceholder="Detalle VPN"
                />
                <BoolField
                  label="Usuarios de prueba"
                  checked={p.accesos.usuarios_prueba}
                  onChange={(v) =>
                    setProfile((pr) => ({
                      ...pr,
                      accesos: { ...pr.accesos, usuarios_prueba: v },
                    }))
                  }
                  note={p.accesos.usuarios_prueba_notas ?? ''}
                  onNoteChange={(v) =>
                    setProfile((pr) => ({
                      ...pr,
                      accesos: { ...pr.accesos, usuarios_prueba_notas: v },
                    }))
                  }
                  notePlaceholder="Usuarios / roles"
                />
                <BoolField
                  label="Código fuente entregado"
                  checked={p.accesos.codigo_fuente_entregado}
                  onChange={(v) =>
                    setProfile((pr) => ({
                      ...pr,
                      accesos: { ...pr.accesos, codigo_fuente_entregado: v },
                    }))
                  }
                  note={p.accesos.codigo_fuente_notas ?? ''}
                  onNoteChange={(v) =>
                    setProfile((pr) => ({
                      ...pr,
                      accesos: { ...pr.accesos, codigo_fuente_notas: v },
                    }))
                  }
                  notePlaceholder="Repositorio / acceso"
                />
                <BoolField
                  label="Documentación entregada"
                  checked={p.accesos.documentacion_entregada}
                  onChange={(v) =>
                    setProfile((pr) => ({
                      ...pr,
                      accesos: { ...pr.accesos, documentacion_entregada: v },
                    }))
                  }
                  note={p.accesos.documentacion_notas ?? ''}
                  onNoteChange={(v) =>
                    setProfile((pr) => ({
                      ...pr,
                      accesos: { ...pr.accesos, documentacion_notas: v },
                    }))
                  }
                  notePlaceholder="Enlaces / descripción"
                />
              </div>
            </FormSection>
          ) : null}

          {showSection('reglas') && form.tipo_servicio ? (
            <FormSection title="Reglas de engagement">
              <div className="grid sm:grid-cols-2 gap-2">
                <div className="space-y-1 sm:col-span-2">
                  <FieldLabel>Horarios permitidos</FieldLabel>
                  <Input
                    placeholder="Ej. Lun–Vie 09:00–18:00"
                    value={p.reglas.horarios_permitidos}
                    onChange={(e) =>
                      setProfile((pr) => ({
                        ...pr,
                        reglas: { ...pr.reglas, horarios_permitidos: e.target.value },
                      }))
                    }
                    className="text-sm bg-background"
                  />
                </div>
                <BoolField
                  label="DoS permitido"
                  checked={p.reglas.dos_permitido}
                  onChange={(v) =>
                    setProfile((pr) => ({
                      ...pr,
                      reglas: { ...pr.reglas, dos_permitido: v },
                    }))
                  }
                />
                <BoolField
                  label="Explotación permitida"
                  checked={p.reglas.explotacion_permitida}
                  onChange={(v) =>
                    setProfile((pr) => ({
                      ...pr,
                      reglas: { ...pr.reglas, explotacion_permitida: v },
                    }))
                  }
                />
                <BoolField
                  label="Ingeniería social permitida"
                  checked={p.reglas.ingenieria_social_permitida}
                  onChange={(v) =>
                    setProfile((pr) => ({
                      ...pr,
                      reglas: { ...pr.reglas, ingenieria_social_permitida: v },
                    }))
                  }
                />
                <div className="space-y-1 sm:col-span-2">
                  <FieldLabel>Contacto emergencia</FieldLabel>
                  <Input
                    placeholder="Nombre, teléfono, email"
                    value={p.reglas.contacto_emergencia}
                    onChange={(e) =>
                      setProfile((pr) => ({
                        ...pr,
                        reglas: { ...pr.reglas, contacto_emergencia: e.target.value },
                      }))
                    }
                    className="text-sm bg-background"
                  />
                </div>
              </div>
            </FormSection>
          ) : null}

          {showSection('herramientas') && form.tipo_servicio ? (
            <FormSection title="Herramientas">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {HERRAMIENTAS.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-xs text-foreground">
                    <input
                      type="checkbox"
                      checked={p.herramientas[key]}
                      onChange={(e) =>
                        setProfile((pr) => ({
                          ...pr,
                          herramientas: { ...pr.herramientas, [key]: e.target.checked },
                        }))
                      }
                      className="rounded border-input"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </FormSection>
          ) : null}

          {showSection('dast') && form.tipo_servicio ? (
            <FormSection title="DAST / aplicación">
              <div className="grid sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <FieldLabel>URL objetivo</FieldLabel>
                  <Input
                    value={p.dast.url_objetivo}
                    onChange={(e) =>
                      setProfile((pr) => ({
                        ...pr,
                        dast: { ...pr.dast, url_objetivo: e.target.value },
                      }))
                    }
                    className="text-sm bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Login URL</FieldLabel>
                  <Input
                    value={p.dast.login_url}
                    onChange={(e) =>
                      setProfile((pr) => ({
                        ...pr,
                        dast: { ...pr.dast, login_url: e.target.value },
                      }))
                    }
                    className="text-sm bg-background"
                  />
                </div>
                <BoolField
                  label="Auth requerida"
                  checked={p.dast.auth_requerida}
                  onChange={(v) =>
                    setProfile((pr) => ({
                      ...pr,
                      dast: { ...pr.dast, auth_requerida: v },
                    }))
                  }
                />
                <div className="space-y-1 sm:col-span-2">
                  <FieldLabel>Headers custom</FieldLabel>
                  <Input
                    placeholder="Authorization: Bearer …"
                    value={p.dast.headers_custom}
                    onChange={(e) =>
                      setProfile((pr) => ({
                        ...pr,
                        dast: { ...pr.dast, headers_custom: e.target.value },
                      }))
                    }
                    className="text-sm bg-background"
                  />
                </div>
              </div>
            </FormSection>
          ) : null}

          {showSection('sast') && form.tipo_servicio ? (
            <FormSection title="SAST">
              <div className="grid sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <FieldLabel>Repositorio</FieldLabel>
                  <Input
                    value={p.sast.repositorio}
                    onChange={(e) =>
                      setProfile((pr) => ({
                        ...pr,
                        sast: { ...pr.sast, repositorio: e.target.value },
                      }))
                    }
                    className="text-sm bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Branch</FieldLabel>
                  <Input
                    value={p.sast.branch}
                    onChange={(e) =>
                      setProfile((pr) => ({
                        ...pr,
                        sast: { ...pr.sast, branch: e.target.value },
                      }))
                    }
                    className="text-sm bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Lenguaje</FieldLabel>
                  <Input
                    value={p.sast.lenguaje}
                    onChange={(e) =>
                      setProfile((pr) => ({
                        ...pr,
                        sast: { ...pr.sast, lenguaje: e.target.value },
                      }))
                    }
                    className="text-sm bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <FieldLabel>SCM</FieldLabel>
                  <select
                    value={p.sast.scm}
                    onChange={(e) =>
                      setProfile((pr) => ({
                        ...pr,
                        sast: { ...pr.sast, scm: e.target.value },
                      }))
                    }
                    className={selectClass}
                  >
                    <option value="">—</option>
                    {SCM_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </FormSection>
          ) : null}

          {showSection('pentest_infra') && form.tipo_servicio ? (
            <FormSection title="Pentest infraestructura">
              <div className="grid sm:grid-cols-2 gap-2">
                {(
                  [
                    ['ip_objetivo', 'IP objetivo'],
                    ['segmento_red', 'Segmento red'],
                    ['firewall_waf', 'Firewall / WAF'],
                    ['servicios_criticos', 'Servicios críticos'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <FieldLabel>{label}</FieldLabel>
                    <Input
                      value={p.pentest_infra[key]}
                      onChange={(e) =>
                        setProfile((pr) => ({
                          ...pr,
                          pentest_infra: { ...pr.pentest_infra, [key]: e.target.value },
                        }))
                      }
                      className="text-sm bg-background"
                    />
                  </div>
                ))}
              </div>
            </FormSection>
          ) : null}

          {showSection('reporting') && form.tipo_servicio ? (
            <FormSection title="Reporting">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {REPORTING_OPTIONS.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-xs text-foreground">
                    <input
                      type="checkbox"
                      checked={p.reporting[key]}
                      onChange={(e) =>
                        setProfile((pr) => ({
                          ...pr,
                          reporting: { ...pr.reporting, [key]: e.target.checked },
                        }))
                      }
                      className="rounded border-input"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </FormSection>
          ) : null}
        </div>

        <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/95 px-2 py-2 backdrop-blur-sm">
          <Button
            type="button"
            size="sm"
            className="min-w-[10rem]"
            onClick={() => void handleSaveProject()}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            ) : editingId ? (
              <Save className="size-3.5 mr-1.5" />
            ) : (
              <Plus className="size-3.5 mr-1.5" />
            )}
            {editingId ? 'Guardar proyecto' : 'Guardar proyecto'}
          </Button>
          {!canSave && showValidation ? (
            <span className="text-[11px] text-destructive">Completa los campos obligatorios</span>
          ) : (
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              Cliente o nombre · tipo servicio · fecha inicio
            </span>
          )}
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-3 animate-spin" />
            Cargando…
          </p>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Sin proyectos guardados. Usa «Guardar proyecto» para crear el primero.
          </p>
        ) : (
          <ul className="space-y-1.5 max-h-48 overflow-y-auto">
            {items.map((eg) => (
              <li
                key={eg.id}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs cursor-pointer transition-colors',
                  selectedId === eg.id || editingId === eg.id
                    ? 'border-violet-500/40 bg-violet-500/15'
                    : 'border-border bg-muted/30 hover:border-border hover:bg-muted/50'
                )}
              >
                <button
                  type="button"
                  className="flex-1 text-left min-w-0"
                  onClick={() => void loadIntoForm(eg.id)}
                >
                  <span className="text-foreground font-medium block truncate">
                    {eg.nombre_proyecto || eg.cliente}
                  </span>
                  <span className="text-muted-foreground font-mono text-[10px] block truncate">
                    {[eg.tipo_servicio, eg.tipo].filter(Boolean).join(' · ') || eg.cliente}
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => void handleDelete(eg.id)}
                  disabled={busy}
                >
                  <Trash2 className="size-3" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
