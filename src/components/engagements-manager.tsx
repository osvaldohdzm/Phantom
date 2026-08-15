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
  Sparkles,
  Zap,
  Sliders,
  ShieldCheck,
  ShieldAlert,
  Terminal,
  Layers,
  X,
  Check,
  Copy,
  ExternalLink,
  Share2,
  Download,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { classifyTargetScope } from '@/lib/classify-target-scope';
import { ProjectDetailsFullView } from '@/components/phantom/services/ProjectDetailsFullView';
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
  listFindings,
  updateEngagement,
  createSharedMission,
  listResponsableUsers,
  type Engagement,
  type EngagementCreateBody,
  type Finding,
  type ResponsableUser,
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
  const [rawScopeInput, setRawScopeInput] = useState('');
  const [responsables, setResponsables] = useState<ResponsableUser[]>([]);

  // Full Results View State
  const [activeFullResultsEngagement, setActiveFullResultsEngagement] = useState<Engagement | null>(null);

  // Share Mission State
  const [sharedMission, setSharedMission] = useState<{ share_hash: string; access_code: string; share_url: string } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleShareMission = async (id: string) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await createSharedMission(id);
      setSharedMission(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al compartir la misión');
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadSOW = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const eg = await getEngagement(id);

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter',
      });

      const startX = 20;
      const col1Width = 55;
      const col2Width = 120.9;
      let pageCount = 1;
      let y = 40;

      const projName = eg.nombre_proyecto || eg.cliente || 'Misión Secreta';

      const drawPageHeader = (pageNumber: number) => {
        // Logo Area Placeholder box
        doc.setDrawColor(180);
        doc.setLineWidth(0.2);
        doc.rect(startX, 15, 35, 12, 'D');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text('PHANTOM SECURITY', startX + 17.5, 21.5, { align: 'center', baseline: 'middle' });

        // Title & Project
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(30, 41, 59);
        doc.text('REPORTE EJECUTIVO DE SERVICIO', startX + 45, 20);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`Proyecto: ${projName}`, startX + 45, 25);

        // Export Date on the right
        const dateStr = new Date().toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        doc.text(`Fecha: ${dateStr}`, 195.9, 25, { align: 'right' });

        // Header Divider Line
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(startX, 32, 195.9, 32);
      };

      const drawPageFooter = (pageNumber: number) => {
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(startX, 260, 195.9, 260);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('CONFIDENCIAL - REPORTES DE SEGURIDAD', startX, 265);
        doc.text(`Página ${pageNumber}`, 195.9, 265, { align: 'right' });
      };

      const drawSectionHeader = (title: string, yPos: number) => {
        doc.setFillColor(241, 245, 249);
        doc.rect(startX, yPos, 175.9, 8, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.rect(startX, yPos, 175.9, 8, 'D');

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        doc.text(title.toUpperCase(), startX + 3, yPos + 4.5, { baseline: 'middle' });
      };

      const checkPageSpace = (heightNeeded: number) => {
        if (y + heightNeeded > 255) {
          drawPageFooter(pageCount);
          doc.addPage();
          pageCount++;
          drawPageHeader(pageCount);
          y = 40;
        }
      };

      const drawCenteredCellText = (
        text: string,
        cellX: number,
        cellY: number,
        cellWidth: number,
        cellHeight: number,
        isBold: boolean = false
      ) => {
        if (isBold) {
          doc.setFont('Helvetica', 'bold');
          doc.setTextColor(71, 85, 105);
        } else {
          doc.setFont('Helvetica', 'normal');
          doc.setTextColor(15, 23, 42);
        }
        doc.setFontSize(8.5);

        const padding = 6;
        const wrapped = doc.splitTextToSize(text, cellWidth - padding);
        const N = wrapped.length;
        const lh = 4.2;

        for (let i = 0; i < N; i++) {
          const lineY = cellY + (cellHeight / 2) - ((N - 1) * lh) / 2 + i * lh;
          doc.text(wrapped[i], cellX + (cellWidth / 2), lineY, { align: 'center', baseline: 'middle' });
        }
      };

      // Draw page 1 header
      drawPageHeader(1);

      // Build key-value rows
      const dataRows: [string, string][] = [];
      dataRows.push(['ID Engagement', eg.id.toUpperCase()]); // Renamed ID de Misión -> ID Engagement
      dataRows.push(['Cliente / Organización', eg.cliente]);
      if (eg.nombre_proyecto) dataRows.push(['Proyecto', eg.nombre_proyecto]);
      if (eg.estado) dataRows.push(['Estado de Servicio', eg.estado]);
      if (eg.responsable) dataRows.push(['Responsable', eg.responsable]);
      if (eg.tipo_servicio) dataRows.push(['Tipo de Servicio', eg.tipo_servicio]);
      if (eg.fecha_inicio) dataRows.push(['Fecha Inicio', eg.fecha_inicio]);
      if (eg.fecha_fin) dataRows.push(['Fecha Fin', eg.fecha_fin]);
      if (eg.tipo) dataRows.push(['Tipo de Proyecto', eg.tipo]);

      const p = eg.profile;
      if (p) {
        if (p.alcance && (p.alcance.ips || p.alcance.dominios || p.alcance.urls)) {
          dataRows.push(['[SECCIÓN]', 'PARÁMETROS DE ALCANCE (SCOPE)']);
          if (p.alcance.ips) dataRows.push(['IPs Objetivo', p.alcance.ips]);
          if (p.alcance.dominios) dataRows.push(['Dominios', p.alcance.dominios]);
          if (p.alcance.urls) dataRows.push(['URLs', p.alcance.urls]);
          if (p.alcance.ambientes) dataRows.push(['Ambientes', p.alcance.ambientes]);
          if (p.alcance.activos_incluidos) dataRows.push(['Activos Incluidos', p.alcance.activos_incluidos]);
          if (p.alcance.activos_excluidos) dataRows.push(['Activos Excluidos', p.alcance.activos_excluidos]);
        }

        if (p.tipo_analisis && (p.tipo_analisis.metodo || p.tipo_analisis.alcance_red)) {
          dataRows.push(['[SECCIÓN]', 'CONFIGURACIÓN DEL ANÁLISIS']);
          if (p.tipo_analisis.metodo) dataRows.push(['Método de Análisis', p.tipo_analisis.metodo]);
          if (p.tipo_analisis.alcance_red) dataRows.push(['Alcance de Red', p.tipo_analisis.alcance_red]);
          if (p.tipo_analisis.intrusivo) dataRows.push(['Intrusividad', p.tipo_analisis.intrusivo]);
        }

        if (p.accesos) {
          dataRows.push(['[SECCIÓN]', 'REQUISITOS DE ACCESO']);
          dataRows.push(['Credenciales Entregadas', p.accesos.credenciales_entregadas ? 'Sí' : 'No']);
          if (p.accesos.credenciales_notas) dataRows.push(['Notas de Credenciales', p.accesos.credenciales_notas]);
          dataRows.push(['VPN Requerida', p.accesos.vpn_requerida ? 'Sí' : 'No']);
          if (p.accesos.vpn_notas) dataRows.push(['Notas de VPN', p.accesos.vpn_notas]);
          dataRows.push(['Usuarios de Prueba', p.accesos.usuarios_prueba ? 'Sí' : 'No']);
          if (p.accesos.usuarios_prueba_notas) dataRows.push(['Notas de Usuarios', p.accesos.usuarios_prueba_notas]);
          dataRows.push(['Código Fuente Entregado', p.accesos.codigo_fuente_entregado ? 'Sí' : 'No']);
          if (p.accesos.codigo_fuente_notas) dataRows.push(['Notas de Código Fuente', p.accesos.codigo_fuente_notas]);
          dataRows.push(['Documentación Entregada', p.accesos.documentacion_entregada ? 'Sí' : 'No']);
          if (p.accesos.documentacion_notas) dataRows.push(['Notas de Documentación', p.accesos.documentacion_notas]);
        }

        if (p.reglas) {
          dataRows.push(['[SECCIÓN]', 'REGLAS DE COMPROMISO']);
          if (p.reglas.horarios_permitidos) dataRows.push(['Horarios Permitidos', p.reglas.horarios_permitidos]);
          dataRows.push(['DoS Permitido', p.reglas.dos_permitido ? 'Sí' : 'No']);
          dataRows.push(['Explotación Permitida', p.reglas.explotacion_permitida ? 'Sí' : 'No']);
          dataRows.push(['Ingeniería Social Permitida', p.reglas.ingenieria_social_permitida ? 'Sí' : 'No']);
          if (p.reglas.contacto_emergencia) dataRows.push(['Contacto Emergencia', p.reglas.contacto_emergencia]);
        }
      }

      // Draw main executive details section header
      drawSectionHeader('INFORMACIÓN GENERAL DEL SERVICIO', y);
      y += 10;

      for (const [label, val] of dataRows) {
        if (label === '[SECCIÓN]') {
          const rowHeight = 8;
          checkPageSpace(rowHeight + 4);
          drawSectionHeader(val, y);
          y += rowHeight + 2;
          continue;
        }

        const cleanVal = val === null || val === undefined ? '-' : String(val);
        const wrappedVal = doc.splitTextToSize(cleanVal, col2Width - 6);
        const rowHeight = Math.max(8, wrappedVal.length * 5 + 4);

        checkPageSpace(rowHeight);

        // Label column box
        doc.setFillColor(248, 250, 252); // slate-50
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.setLineWidth(0.2);
        doc.rect(startX, y, col1Width, rowHeight, 'FD');

        // Value column box
        doc.setFillColor(255, 255, 255);
        doc.rect(startX + col1Width, y, col2Width, rowHeight, 'FD');

        // Draw centered text
        drawCenteredCellText(label, startX, y, col1Width, rowHeight, true);
        drawCenteredCellText(cleanVal, startX + col1Width, y, col2Width, rowHeight, false);

        y += rowHeight;
      }

      // Draw page footer
      drawPageFooter(pageCount);

      doc.save(`Reporte_Ejecutivo_${projName.replace(/\s+/g, '_')}.pdf`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al descargar el SOW');
    } finally {
      setBusy(false);
    }
  };

  const openResultsModal = (eg: Engagement) => {
    setActiveFullResultsEngagement(eg);
  };

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
    const fetchResponsables = async () => {
      try {
        const list = await listResponsableUsers();
        setResponsables(list);
      } catch (err) {
        console.error('Error fetching responsable users:', err);
      }
    };
    void fetchResponsables();
  }, []);

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

  if (activeFullResultsEngagement) {
    return (
      <ProjectDetailsFullView
        engagement={activeFullResultsEngagement}
        onBack={() => setActiveFullResultsEngagement(null)}
      />
    );
  }

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
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs font-semibold flex items-center gap-1 border-border/80 hover:border-violet-500/50 hover:bg-violet-500/10 hover:text-violet-400 transition-all cursor-pointer"
                              onClick={() => void handleShareMission(eg.id)}
                              disabled={busy}
                              title="Generar enlace seguro para compartir los detalles del servicio"
                            >
                              <Share2 className="size-3.5 text-violet-400" />
                              <span>Share mission</span>
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs font-semibold flex items-center gap-1 border-border/80 hover:border-violet-500/50 hover:bg-violet-500/10 hover:text-violet-400 transition-all cursor-pointer"
                              onClick={() => void handleDownloadSOW(eg.id)}
                              disabled={busy}
                              title="Descargar los detalles del servicio en formato PDF (SOW)"
                            >
                              <Download className="size-3.5 text-violet-400" />
                              <span>Descargar SOW</span>
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs font-semibold flex items-center gap-1 border-border/80 hover:border-violet-500/50 hover:bg-violet-500/10 hover:text-violet-400 transition-all cursor-pointer"
                              onClick={() => void loadIntoForm(eg.id)}
                              disabled={busy}
                              title="Ver y editar alcance, targets y fechas del servicio"
                            >
                              <Sliders className="size-3.5 text-violet-400" />
                              <span>Open Details</span>
                            </Button>

                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              className="h-8 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                              onClick={() => void openResultsModal(eg)}
                              disabled={busy}
                              title="Ver vulnerabilidades cargadas, metodología y set de pruebas realizadas"
                            >
                              <ShieldCheck className="size-3.5 text-amber-300 fill-current" />
                              <span>Open Results</span>
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
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

            {editingId && (
              <div className="p-3.5 rounded-xl bg-violet-500/10 border border-violet-500/30 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-400" />
                    <span className="text-xs font-bold text-foreground">
                      Servicio Cargado: {form.nombre_proyecto || form.cliente}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    {form.estado || 'Activo'}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Servicio listo. Puedes modificar su alcance o hacer clic en &quot;Siguiente&quot; para ingresar a la gestión de hallazgos y set de pruebas.
                </p>
              </div>
            )}

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
                <select
                  value={form.responsable}
                  onChange={(e) => setForm((f) => ({ ...f, responsable: e.target.value }))}
                  className={selectClass}
                >
                  <option value="">{t('engSelectOption')}</option>
                  {responsables.map((u) => (
                    <option key={u.id} value={u.nombre}>
                      {u.nombre} ({u.email})
                    </option>
                  ))}
                  {form.responsable && !responsables.some((u) => u.nombre === form.responsable) && (
                    <option value={form.responsable}>
                      {form.responsable}
                    </option>
                  )}
                </select>
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
              <div className="space-y-4">
                {/* Target Scope Raw Textarea (Bulk Paste & Regex Auto-Classification) */}
                <div className="space-y-2 bg-muted/20 border border-border/70 rounded-xl p-3.5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-violet-400 font-bold flex items-center gap-1.5 text-xs">
                      <Sparkles className="size-3.5 text-amber-400" />
                      Target Scope Raw (Pegado Masivo de Targets)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const classified = classifyTargetScope(rawScopeInput);
                        setProfile((pr) => ({
                          ...pr,
                          alcance: {
                            ...pr.alcance,
                            ips: classified.ips.join(', '),
                            dominios: classified.domains.join(', '),
                            urls: classified.urls.join(', '),
                            ambientes: classified.environments.join(', '),
                            activos_incluidos: classified.includedAssets.join(', '),
                          },
                        }));
                      }}
                      className="px-3 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      <Zap className="size-3.5 text-amber-300 fill-current" />
                      <span>Auto-clasificar Scope con Regex</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Pega cualquier listado de targets separados por comas, espacios o saltos de línea. Se clasificarán automáticamente mediante expresiones regulares en IPs, Dominios, URLs y Entornos.
                  </p>
                  <textarea
                    rows={3}
                    value={rawScopeInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRawScopeInput(val);
                      const classified = classifyTargetScope(val);
                      setProfile((pr) => ({
                        ...pr,
                        alcance: {
                          ...pr.alcance,
                          ips: classified.ips.join(', '),
                          dominios: classified.domains.join(', '),
                          urls: classified.urls.join(', '),
                          ambientes: classified.environments.join(', '),
                          activos_incluidos: classified.includedAssets.join(', '),
                        },
                      }));
                    }}
                    placeholder={"Ejemplo de pegado masivo:\n192.168.100.193\n10.0.0.0/24\nhttps://192.168.100.193:3000/api/secops\nportal.empresa.com, ambiente_prod"}
                    className="w-full bg-background border border-border/70 rounded-xl px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:border-violet-500 resize-none custom-scrollbar shadow-inner"
                  />

                  {/* Live Breakdown Badges */}
                  {rawScopeInput.trim() && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-mono">
                      <span className="px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/30 font-bold">
                        IPs/CIDRs: {classifyTargetScope(rawScopeInput).ips.length}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-bold">
                        Dominios: {classifyTargetScope(rawScopeInput).domains.length}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                        URLs: {classifyTargetScope(rawScopeInput).urls.length}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold">
                        Entornos: {classifyTargetScope(rawScopeInput).environments.length}
                      </span>
                    </div>
                  )}
                </div>

                {/* Classified Scope Inputs Grid */}
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
                        className="text-sm bg-background font-mono text-xs"
                      />
                    </div>
                  ))}
                </div>
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

      {sharedMission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-violet-500/20 bg-background p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 text-left">
            <button
              onClick={() => setSharedMission(null)}
              className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="size-4" />
            </button>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="rounded-full bg-violet-500/10 p-3 text-violet-400">
                <Share2 className="size-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Mission Shared</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Se ha creado una instantánea segura del servicio. Comparte este enlace y clave de acceso con el destinatario.
                </p>
              </div>
            </div>

            <div className="space-y-4 mt-6">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  URL de la Misión
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== 'undefined' ? `${window.location.origin}${sharedMission.share_url}` : ''}
                    className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs font-mono text-foreground focus:outline-none"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        navigator.clipboard.writeText(`${window.location.origin}${sharedMission.share_url}`);
                        setCopiedUrl(true);
                        setTimeout(() => setCopiedUrl(false), 2000);
                      }
                    }}
                    className="h-9 px-3 flex items-center gap-1 hover:border-violet-500/50 hover:bg-violet-500/10"
                  >
                    {copiedUrl ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                    <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Clave de Acceso (Access Code)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={sharedMission.access_code}
                    className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm font-mono font-bold tracking-widest text-violet-400 focus:outline-none"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        navigator.clipboard.writeText(sharedMission.access_code);
                        setCopiedCode(true);
                        setTimeout(() => setCopiedCode(false), 2000);
                      }
                    }}
                    className="h-9 px-3 flex items-center gap-1 hover:border-violet-500/50 hover:bg-violet-500/10"
                  >
                    {copiedCode ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                    <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                onClick={() => setSharedMission(null)}
                className="bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs py-2 px-4 rounded-lg shadow-sm"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
