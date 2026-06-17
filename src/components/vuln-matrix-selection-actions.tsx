'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Loader2,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  bulkDeleteFindings,
  bulkUpdateFindingStatus,
  consolidateMasterCatalogApi,
  type FindingStatus,
} from '@/lib/secops-api';

type ActionKind = 'false_positive' | 'risk_accepted' | 'mitigation' | null;

type Props = {
  findingIds: string[];
  rowCount: number;
  onDone: (message: string) => void;
  onError: (message: string) => void;
  onReload: () => void;
};

function defaultReviewDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toISOString().slice(0, 10);
}

export function VulnMatrixSelectionActions({
  findingIds,
  rowCount,
  onDone,
  onError,
  onReload,
}: Props) {
  const [pending, setPending] = useState<ActionKind>(null);
  const [notes, setNotes] = useState('');
  const [reviewDate, setReviewDate] = useState(defaultReviewDate);
  const [busy, setBusy] = useState<
    'false_positive' | 'risk_accepted' | 'mitigation' | 'consolidate' | 'delete' | null
  >(null);

  if (!findingIds.length) return null;

  const resetForm = () => {
    setPending(null);
    setNotes('');
    setReviewDate(defaultReviewDate());
  };

  const runStatusUpdate = async (
    status: FindingStatus,
    label: string,
    busyKey: typeof busy,
    buildNotes: () => string
  ) => {
    const detail = buildNotes().trim();
    if (pending && !detail && busyKey !== 'false_positive') {
      onError('Indica una justificación o medida compensatoria.');
      return;
    }
    if (
      !window.confirm(
        `¿Marcar ${findingIds.length} hallazgo(s) como «${label}»?` +
          (detail ? `\n\nNotas: ${detail.slice(0, 200)}${detail.length > 200 ? '…' : ''}` : '')
      )
    ) {
      return;
    }
    setBusy(busyKey);
    try {
      const { updated, errors } = await bulkUpdateFindingStatus(
        findingIds,
        status,
        detail || undefined
      );
      onDone(`${updated} hallazgo(s) → ${label}.`);
      if (errors.length) onError(errors[0]);
      resetForm();
      onReload();
    } catch (e) {
      onError(e instanceof Error ? e.message : `Error al marcar ${label}`);
    } finally {
      setBusy(null);
    }
  };

  const runConsolidate = async () => {
    setBusy('consolidate');
    try {
      const result = await consolidateMasterCatalogApi({ finding_ids: findingIds });
      onDone(
        `Consolidado: ${result.synced} en catálogo · ${result.groups} grupo(s)` +
          (result.skipped > 0 ? ` · ${result.skipped} omitidos` : '') +
          '.'
      );
      if (result.errors.length) onError(`${result.errors.length} error(es) al consolidar.`);
      onReload();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Error al consolidar');
    } finally {
      setBusy(null);
    }
  };

  const runDelete = async () => {
    if (
      !window.confirm(
        `¿Eliminar ${findingIds.length} hallazgo(s) del repositorio?\n\nÚsalo solo si son errores de escaneo o duplicados irreales. Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    setBusy('delete');
    try {
      const result = await bulkDeleteFindings(findingIds);
      onDone(`${result.deleted_count} hallazgo(s) eliminados.`);
      onReload();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Error al eliminar');
    } finally {
      setBusy(null);
    }
  };

  const disabled = busy !== null;

  return (
    <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 px-3 py-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium text-foreground tabular-nums">
          {rowCount} fila(s) · {findingIds.length} hallazgo(s)
        </span>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[11px]"
          disabled={disabled}
          onClick={() => void runConsolidate()}
        >
          {busy === 'consolidate' ? (
            <Loader2 className="size-3.5 mr-1 animate-spin" />
          ) : (
            <Wrench className="size-3.5 mr-1" />
          )}
          Consolidar
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('h-7 text-[11px]', pending === 'false_positive' && 'ring-2 ring-violet-500/40')}
          disabled={disabled}
          onClick={() => setPending((p) => (p === 'false_positive' ? null : 'false_positive'))}
        >
          <Ban className="size-3.5 mr-1" />
          Falso positivo
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('h-7 text-[11px]', pending === 'risk_accepted' && 'ring-2 ring-violet-500/40')}
          disabled={disabled}
          onClick={() => setPending((p) => (p === 'risk_accepted' ? null : 'risk_accepted'))}
        >
          <ShieldOff className="size-3.5 mr-1" />
          Riesgo aceptado
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('h-7 text-[11px]', pending === 'mitigation' && 'ring-2 ring-violet-500/40')}
          disabled={disabled}
          onClick={() => setPending((p) => (p === 'mitigation' ? null : 'mitigation'))}
        >
          <ShieldCheck className="size-3.5 mr-1" />
          Mitigación
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[11px] text-rose-700 border-rose-500/40 hover:bg-rose-500/10 dark:text-rose-400 ml-auto"
          disabled={disabled}
          onClick={() => void runDelete()}
        >
          {busy === 'delete' ? (
            <Loader2 className="size-3.5 mr-1 animate-spin" />
          ) : (
            <Trash2 className="size-3.5 mr-1" />
          )}
          Eliminar
        </Button>
      </div>

      {pending === 'false_positive' ? (
        <div className="space-y-2 border-t border-border/60 pt-2">
          <p className="text-[10px] text-muted-foreground leading-snug flex gap-1.5">
            <AlertTriangle className="size-3.5 shrink-0 text-amber-600 mt-0.5" />
            Solo si el escáner se equivocó técnicamente. Si el certificado o host están mal
            configurados, no es falso positivo: valida o mitiga.
          </p>
          <textarea
            className="w-full min-h-[56px] rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            placeholder="Motivo técnico (opcional)…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="h-7 text-[11px]"
              disabled={disabled}
              onClick={() =>
                void runStatusUpdate('Falso Positivo', 'Falso Positivo', 'false_positive', () =>
                  notes.trim() ? `Falso positivo: ${notes.trim()}` : 'Marcado como falso positivo'
                )
              }
            >
              {busy === 'false_positive' ? (
                <Loader2 className="size-3.5 mr-1 animate-spin" />
              ) : null}
              Confirmar falso positivo
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7" onClick={resetForm}>
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}

      {pending === 'risk_accepted' ? (
        <div className="space-y-2 border-t border-border/60 pt-2">
          <p className="text-[10px] text-muted-foreground">
            El negocio acepta el riesgo sin remediar ahora. Indica fecha de revisión y
            justificación.
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <label className="text-[10px] text-muted-foreground">
              Revisar el
              <Input
                type="date"
                className="ml-2 h-8 w-auto text-xs inline-block"
                value={reviewDate}
                onChange={(e) => setReviewDate(e.target.value)}
              />
            </label>
          </div>
          <textarea
            className="w-full min-h-[56px] rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            placeholder="Justificación de negocio…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="h-7 text-[11px]"
              disabled={disabled}
              onClick={() =>
                void runStatusUpdate('Riesgo Aceptado', 'Riesgo Aceptado', 'risk_accepted', () =>
                  `Revisión: ${reviewDate || 'sin fecha'}. ${notes.trim()}`.trim()
                )
              }
            >
              {busy === 'risk_accepted' ? (
                <Loader2 className="size-3.5 mr-1 animate-spin" />
              ) : null}
              Confirmar riesgo aceptado
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7" onClick={resetForm}>
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}

      {pending === 'mitigation' ? (
        <div className="space-y-2 border-t border-border/60 pt-2">
          <p className="text-[10px] text-muted-foreground">
            Medida compensatoria mientras no se corrige la causa raíz (ej. acceso solo por VPN).
            El hallazgo pasa a «En Proceso de Remediación».
          </p>
          <textarea
            className="w-full min-h-[56px] rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            placeholder="Describe la mitigación aplicada…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="h-7 text-[11px]"
              disabled={disabled}
              onClick={() =>
                void runStatusUpdate(
                  'En Proceso de Remediación',
                  'Mitigación',
                  'mitigation',
                  () => `Mitigación: ${notes.trim()}`
                )
              }
            >
              {busy === 'mitigation' ? (
                <Loader2 className="size-3.5 mr-1 animate-spin" />
              ) : null}
              Registrar mitigación
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7" onClick={resetForm}>
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
