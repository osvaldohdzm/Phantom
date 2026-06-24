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
  Search,
  FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { isDefaultEngagement, filterUserEngagements, engagementLabel } from '@/lib/default-engagement';
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
  HERRAMIENTAS,
  SCM_OPTIONS,
  TIPOS_ANALISIS,
  defaultEngagementForm,
  mergeEngagementProfile,
  resolveClienteForSave,
  sectionsForTipoServicio,
  type EngagementFormState,
  type EngagementProfile,
  type EngagementSectionId,
  type TipoAnalisis,
} from '@/lib/engagement-profile';
import { useUiT } from '@/lib/use-ui-locale';
import {
  analysisMethodOptions,
  analysisTypeOptions,
  formatEngagementDate,
  intrusivenessOptions,
  labelEngagementStatus,
  labelPentestInfraField,
  labelScopeField,
  labelServiceType,
  networkScopeOptions,
  reportingOptions,
  serviceTypeOptions,
  statusOptions,
  validateEngagementFormI18n,
} from '@/lib/engagement-i18n';

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

function estadoTone(estado?: string | null) {
  const e = (estado ?? '').toLowerCase();
  if (e.includes('curso') || e.includes('activo')) {
    return 'border-sky-500/35 bg-sky-500/10 text-sky-800 dark:text-sky-200';
  }
  if (e.includes('complet') || e.includes('cerrad') || e.includes('finaliz')) {
    return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200';
  }
  if (e.includes('paus') || e.includes('hold')) {
    return 'border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-200';
  }
  return 'border-border bg-muted/40 text-muted-foreground';
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
  const { t, format, uiLanguage } = useUiT();
  const [items, setItems] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EngagementFormState>(defaultEngagementForm);
  const [showValidation, setShowValidation] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const userItems = useMemo(() => filterUserEngagements(items), [items]);
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return userItems;
    return userItems.filter((eg) => {
      const haystack = [
        eg.nombre_proyecto,
        eg.cliente,
        eg.tipo_servicio,
        eg.estado,
        eg.responsable,
        eg.tipo,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [userItems, searchQuery]);

  const showForm = isCreating || Boolean(editingId);

  const validation = useMemo(() => validateEngagementFormI18n(form, uiLanguage), [form, uiLanguage]);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : t('engErrLoadProjects'));
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
    setIsCreating(false);
    setForm(defaultEngagementForm());
    setShowValidation(false);
    setSuccess(null);
    onSelect('');
  };

  const startCreate = () => {
    setEditingId(null);
    setIsCreating(true);
    setForm(defaultEngagementForm());
    setShowValidation(false);
    setSuccess(null);
    setError(null);
    onSelect('');
  };

  const loadIntoForm = async (id: string) => {
    setBusy(true);
    setError(null);
    setShowValidation(false);
    try {
      const eg = await getEngagement(id);
      setEditingId(id);
      setIsCreating(false);
      setForm(engagementToForm(eg));
      onSelect(id, {
        cliente: eg.nombre_proyecto || eg.cliente,
        tipo_servicio: eg.tipo_servicio ?? undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('engErrLoadProject'));
    } finally {
      setBusy(false);
    }
  };

  const afterSave = (eg: Engagement) => {
    const label = eg.nombre_proyecto || eg.cliente;
    setEditingId(eg.id);
    setIsCreating(false);
    setForm(engagementToForm(eg));
    setSuccess(format('engSaved', { name: label }));
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
      setError(e instanceof Error ? e.message : t('engErrSave'));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    const target = items.find((eg) => eg.id === id);
    if (target && isDefaultEngagement(target)) {
      setError(t('engErrDeleteDefault'));
      return;
    }
    if (!confirm(t('engConfirmDelete'))) return;
    setBusy(true);
    try {
      await deleteEngagement(id);
      if (selectedId === id) onSelect('');
      if (editingId === id) resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('engErrDelete'));
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
          {t('engTitle')}
        </CardTitle>
        <CardDescription className="text-xs">
          {t('engDesc')}{' '}
          <span className="text-foreground/90">{t('engDescRequired')}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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

        <div className="rounded-lg border border-border bg-muted/15 overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border bg-card/80 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-0 flex-1 max-w-md">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('engSearch')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-8 text-sm bg-background"
              />
            </div>
            <Button type="button" size="sm" onClick={startCreate} disabled={busy}>
              <Plus className="size-3.5 mr-1.5" />
              {t('engNewProject')}
            </Button>
          </div>

          {loading ? (
            <p className="text-xs text-muted-foreground flex items-center gap-2 px-4 py-8">
              <Loader2 className="size-3.5 animate-spin" />
              {t('engLoadingProjects')}
            </p>
          ) : filteredItems.length === 0 ? (
            <div className="px-4 py-10 text-center space-y-3">
              <FolderOpen className="size-8 mx-auto text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">
                {userItems.length === 0 ? t('engEmptyProjects') : t('engNoSearchResults')}
              </p>
              {userItems.length === 0 ? (
                <Button type="button" size="sm" onClick={startCreate}>
                  <Plus className="size-3.5 mr-1.5" />
                  {t('engCreateProject')}
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2.5 font-medium">{t('engColProject')}</th>
                    <th className="px-3 py-2.5 font-medium hidden md:table-cell">{t('engColServiceType')}</th>
                    <th className="px-3 py-2.5 font-medium hidden lg:table-cell">{t('engColStart')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('engColStatus')}</th>
                    <th className="px-3 py-2.5 font-medium text-right">{t('engColActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((eg) => {
                    const selected = selectedId === eg.id || editingId === eg.id;
                    return (
                      <tr
                        key={eg.id}
                        className={cn(
                          'border-b border-border/60 transition-colors',
                          selected
                            ? 'bg-violet-500/10 shadow-[inset_3px_0_0_0] shadow-violet-500'
                            : 'hover:bg-muted/40'
                        )}
                      >
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            className="text-left min-w-0 w-full"
                            onClick={() => void loadIntoForm(eg.id)}
                          >
                            <span className="font-medium text-foreground block truncate">
                              {engagementLabel(eg)}
                            </span>
                            <span className="text-[11px] text-muted-foreground block truncate md:hidden">
                              {labelServiceType(eg.tipo_servicio, uiLanguage)}
                            </span>
                            {eg.cliente && eg.nombre_proyecto ? (
                              <span className="text-[11px] text-muted-foreground block truncate">
                                {eg.cliente}
                              </span>
                            ) : null}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 hidden md:table-cell">
                          <span className="text-xs text-foreground/90">
                            {labelServiceType(eg.tipo_servicio, uiLanguage)}
                          </span>
                          {eg.tipo ? (
                            <span className="block text-[10px] text-muted-foreground">{eg.tipo}</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-muted-foreground whitespace-nowrap">
                          {formatEngagementDate(eg.fecha_inicio, uiLanguage)}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={cn(
                              'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap',
                              estadoTone(eg.estado)
                            )}
                          >
                            {labelEngagementStatus(eg.estado, uiLanguage)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => void loadIntoForm(eg.id)}
                              disabled={busy}
                            >
                              {t('engOpen')}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              onClick={() => void handleDelete(eg.id)}
                              disabled={busy}
                              title={t('engDeleteProject')}
                            >
                              <Trash2 className="size-3.5" />
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
        </div>

        {!showForm ? (
          <p className="text-xs text-muted-foreground text-center py-1">{t('engSelectHint')}</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-foreground">
                {editingId ? t('engFormConfig') : t('engFormNew')}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={resetForm} disabled={busy}>
                {t('engCloseForm')}
              </Button>
            </div>

            {showValidation && !validation.valid && (
              <ul className="text-xs text-destructive space-y-0.5 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 list-disc pl-5">
                {validation.errors.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            )}

            <div className="max-h-[26rem] overflow-y-auto space-y-2 pr-1">
          <FormSection title={t('engSectionProject')} defaultOpen>
            <div className="grid sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <FieldLabel required={!form.nombre_proyecto.trim()}>{t('engFieldClient')}</FieldLabel>
                <Input
                  placeholder={t('engFieldClientPh')}
                  value={form.cliente}
                  onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value }))}
                  className={cn('text-sm bg-background', fieldErrorClass(invalid('cliente')))}
                />
              </div>
              <div className="space-y-1">
                <FieldLabel required={!form.cliente.trim()}>{t('engFieldProjectName')}</FieldLabel>
                <Input
                  placeholder={t('engFieldProjectNamePh')}
                  value={form.nombre_proyecto}
                  onChange={(e) => setForm((f) => ({ ...f, nombre_proyecto: e.target.value }))}
                  className={cn('text-sm bg-background', fieldErrorClass(invalid('nombre_proyecto')))}
                />
              </div>
              <div className="space-y-1">
                <FieldLabel required>{t('engFieldServiceType')}</FieldLabel>
                <select
                  value={form.tipo_servicio}
                  onChange={(e) => setForm((f) => ({ ...f, tipo_servicio: e.target.value }))}
                  className={cn(selectClass, fieldErrorClass(invalid('tipo_servicio')))}
                >
                  <option value="">{t('engSelectOption')}</option>
                  {serviceTypeOptions(uiLanguage).map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <FieldLabel>{t('engFieldStatus')}</FieldLabel>
                <select
                  value={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}
                  className={selectClass}
                >
                  {statusOptions(uiLanguage).map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <FieldLabel>{t('engFieldOwner')}</FieldLabel>
                <Input
                  placeholder={t('engFieldOwnerPh')}
                  value={form.responsable}
                  onChange={(e) => setForm((f) => ({ ...f, responsable: e.target.value }))}
                  className="text-sm bg-background"
                />
              </div>
              <div className="space-y-1">
                <FieldLabel required>{t('engFieldStartDate')}</FieldLabel>
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
                <FieldLabel>{t('engFieldEndDate')}</FieldLabel>
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
              {t('engPickServiceTypeHint')}
            </p>
          ) : null}

          {showSection('alcance') && form.tipo_servicio ? (
            <FormSection title={t('engSectionScope')}>
              <div className="grid sm:grid-cols-2 gap-2">
                {(
                  [
                    'ips',
                    'dominios',
                    'urls',
                    'ambientes',
                    'activos_incluidos',
                    'activos_excluidos',
                  ] as const
                ).map((key) => (
                  <div key={key} className="space-y-1">
                    <FieldLabel>{labelScopeField(key, uiLanguage)}</FieldLabel>
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
            <FormSection title={t('engSectionAnalysis')}>
              <div className="grid sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <FieldLabel>{t('engFieldAnalysisBox')}</FieldLabel>
                  <select
                    value={form.tipo}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tipo: e.target.value as TipoAnalisis }))
                    }
                    className={selectClass}
                  >
                    {analysisTypeOptions(uiLanguage).map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <FieldLabel>{t('engFieldMethod')}</FieldLabel>
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
                    {analysisMethodOptions(uiLanguage).map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <FieldLabel>{t('engFieldNetworkScope')}</FieldLabel>
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
                    {networkScopeOptions(uiLanguage).map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <FieldLabel>{t('engFieldIntrusiveness')}</FieldLabel>
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
                    {intrusivenessOptions(uiLanguage).map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </FormSection>
          ) : null}

          {showSection('accesos') && form.tipo_servicio ? (
            <FormSection title={t('engSectionAccess')}>
              <div className="grid sm:grid-cols-2 gap-3">
                <BoolField
                  label={t('engAccessCredentials')}
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
                  notePlaceholder={t('engAccessCredentialsPh')}
                />
                <BoolField
                  label={t('engAccessVpn')}
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
                  notePlaceholder={t('engAccessVpnPh')}
                />
                <BoolField
                  label={t('engAccessTestUsers')}
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
                  notePlaceholder={t('engAccessTestUsersPh')}
                />
                <BoolField
                  label={t('engAccessSourceCode')}
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
                  notePlaceholder={t('engAccessSourceCodePh')}
                />
                <BoolField
                  label={t('engAccessDocs')}
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
                  notePlaceholder={t('engAccessDocsPh')}
                />
              </div>
            </FormSection>
          ) : null}

          {showSection('reglas') && form.tipo_servicio ? (
            <FormSection title={t('engSectionRules')}>
              <div className="grid sm:grid-cols-2 gap-2">
                <div className="space-y-1 sm:col-span-2">
                  <FieldLabel>{t('engFieldAllowedHours')}</FieldLabel>
                  <Input
                    placeholder={t('engFieldAllowedHoursPh')}
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
                  label={t('engRuleDosAllowed')}
                  checked={p.reglas.dos_permitido}
                  onChange={(v) =>
                    setProfile((pr) => ({
                      ...pr,
                      reglas: { ...pr.reglas, dos_permitido: v },
                    }))
                  }
                />
                <BoolField
                  label={t('engRuleExploitAllowed')}
                  checked={p.reglas.explotacion_permitida}
                  onChange={(v) =>
                    setProfile((pr) => ({
                      ...pr,
                      reglas: { ...pr.reglas, explotacion_permitida: v },
                    }))
                  }
                />
                <BoolField
                  label={t('engRuleSocialAllowed')}
                  checked={p.reglas.ingenieria_social_permitida}
                  onChange={(v) =>
                    setProfile((pr) => ({
                      ...pr,
                      reglas: { ...pr.reglas, ingenieria_social_permitida: v },
                    }))
                  }
                />
                <div className="space-y-1 sm:col-span-2">
                  <FieldLabel>{t('engFieldEmergencyContact')}</FieldLabel>
                  <Input
                    placeholder={t('engFieldEmergencyContactPh')}
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
            <FormSection title={t('engSectionTools')}>
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
            <FormSection title={t('engSectionDast')}>
              <div className="grid sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <FieldLabel>{t('engFieldTargetUrl')}</FieldLabel>
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
                  <FieldLabel>{t('engFieldLoginUrl')}</FieldLabel>
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
                  label={t('engFieldAuthRequired')}
                  checked={p.dast.auth_requerida}
                  onChange={(v) =>
                    setProfile((pr) => ({
                      ...pr,
                      dast: { ...pr.dast, auth_requerida: v },
                    }))
                  }
                />
                <div className="space-y-1 sm:col-span-2">
                  <FieldLabel>{t('engFieldCustomHeaders')}</FieldLabel>
                  <Input
                    placeholder={t('engFieldCustomHeadersPh')}
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
            <FormSection title={t('engSectionSast')}>
              <div className="grid sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <FieldLabel>{t('engFieldRepository')}</FieldLabel>
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
                  <FieldLabel>{t('engFieldBranch')}</FieldLabel>
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
                  <FieldLabel>{t('engFieldLanguage')}</FieldLabel>
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
                  <FieldLabel>{t('engFieldScm')}</FieldLabel>
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
            <FormSection title={t('engSectionPentestInfra')}>
              <div className="grid sm:grid-cols-2 gap-2">
                {(
                  [
                    'ip_objetivo',
                    'segmento_red',
                    'firewall_waf',
                    'servicios_criticos',
                  ] as const
                ).map((key) => (
                  <div key={key} className="space-y-1">
                    <FieldLabel>{labelPentestInfraField(key, uiLanguage)}</FieldLabel>
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
            <FormSection title={t('engSectionReporting')}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {reportingOptions(uiLanguage).map(({ key, label }) => (
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
            {t('engSaveProject')}
          </Button>
          {!canSave && showValidation ? (
            <span className="text-[11px] text-destructive">{t('engCompleteRequired')}</span>
          ) : (
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              {t('engSaveHint')}
            </span>
          )}
        </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
