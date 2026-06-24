'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Trash2, Wrench, RefreshCw, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LongTaskProgress } from '@/components/long-task-progress';
import type { LoadProgress } from '@/lib/eta-progress';
import {
  consolidateMasterCatalogApi,
  deduplicateFindingsEngagement,
  deleteAllFindingsInRepository,
  getPlatformStats,
  listEngagements,
  repairFindingsText,
  syncFindingsFromCatalogApi,
  type PlatformStats,
} from '@/lib/secops-api';
import { TOOL_SOURCE_FILTER_OPTIONS, toolSourceFilterApiValue, type ToolSourceFilterId } from '@/lib/finding-source-filters';
import { cn } from '@/lib/utils';

export function VulnMgmtRepositoryAdminPanel() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [engagements, setEngagements] = useState<{ id: string; nombre: string }[]>([]);
  const [engagementId, setEngagementId] = useState('');
  const [toolSource, setToolSource] = useState<ToolSourceFilterId>('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteProgress, setDeleteProgress] = useState<LoadProgress | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, egs] = await Promise.all([getPlatformStats(), listEngagements()]);
      setStats(s);
      setEngagements(egs.map((e) => ({ id: e.id, nombre: e.nombre_proyecto || e.cliente })));
      if (!engagementId && egs[0]) setEngagementId(egs[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [engagementId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error en la operación');
    } finally {
      setBusy(null);
    }
  };

  const handleVaciarRepositorio = async () => {
    const tool = toolSourceFilterApiValue(toolSource);
    const scope =
      toolSource === 'all'
        ? `todo el repositorio (${stats?.findings_total?.toLocaleString() ?? '?'} hallazgos)`
        : `hallazgos con fuente «${TOOL_SOURCE_FILTER_OPTIONS.find((o) => o.id === toolSource)?.label}»`;
    if (!window.confirm(`¿Eliminar ${scope}?\n\nPermanente. No afecta borradores de servicio.`)) return;
    await run('vaciar', async () => {
      setDeleteProgress({ phase: 'deleting', loaded: 0, total: stats?.findings_total ?? 0 });
      const n = await deleteAllFindingsInRepository({
        ...(tool ? { tool_source: tool } : {}),
        onProgress: (p) => setDeleteProgress(p),
      });
      setDeleteProgress(null);
      setNotice(`Eliminados ${n.toLocaleString()} hallazgo(s) del repositorio.`);
      await load();
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="size-4 text-violet-500" />
            Estado del repositorio global
          </CardTitle>
          <CardDescription className="text-xs">
            Solo hallazgos publicados (<code className="rounded bg-muted px-1">REPOSITORIO</code>). Los
            borradores de servicio no aparecen aquí hasta «Cargar a gestión».
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : stats ? (
            <dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <div className="rounded-md border border-border px-3 py-2">
                <dt className="text-xs text-muted-foreground">Total</dt>
                <dd className="font-mono text-lg">{stats.findings_total.toLocaleString()}</dd>
              </div>
              <div className="rounded-md border border-border px-3 py-2">
                <dt className="text-xs text-muted-foreground">Abiertos</dt>
                <dd className="font-mono text-lg">{stats.findings_open.toLocaleString()}</dd>
              </div>
              <div className="rounded-md border border-border px-3 py-2">
                <dt className="text-xs text-muted-foreground">Críticos abiertos</dt>
                <dd className="font-mono text-lg text-rose-600">{stats.findings_critical_open}</dd>
              </div>
              <div className="rounded-md border border-border px-3 py-2">
                <dt className="text-xs text-muted-foreground">Servicios</dt>
                <dd className="font-mono text-lg">{stats.engagements_total}</dd>
              </div>
            </dl>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trash2 className="size-4 text-destructive" />
            Vaciar repositorio
          </CardTitle>
          <CardDescription className="text-xs">
            Elimina hallazgos del tenant en gestión de vulnerabilidades. Usa filtro de fuente para
            reset parcial (p. ej. solo Nessus).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1">
            {TOOL_SOURCE_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setToolSource(opt.id)}
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[11px] border',
                  toolSource === opt.id
                    ? 'border-violet-500/60 bg-violet-500/15 font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {opt.id === 'all' ? 'Todas las fuentes' : opt.label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={busy !== null || !stats?.findings_total}
            onClick={() => void handleVaciarRepositorio()}
          >
            {busy === 'vaciar' ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Trash2 className="size-4 mr-1" />}
            Vaciar repositorio
          </Button>
          {deleteProgress ? (
            <LongTaskProgress
              title="Eliminando hallazgos"
              phase={deleteProgress.label}
              loaded={deleteProgress.loaded}
              total={deleteProgress.total}
              hint="Borrado por lotes de 500 registros."
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="size-4 text-amber-500" />
            Operaciones por servicio
          </CardTitle>
          <CardDescription className="text-xs">
            Sync catálogo → hallazgos, consolidar hallazgos → catálogo, reparar texto y deduplicar dentro
            del servicio seleccionado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex flex-col gap-1 text-sm max-w-md">
            <span className="text-xs text-muted-foreground">Servicio (engagement)</span>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={engagementId}
              onChange={(e) => setEngagementId(e.target.value)}
            >
              {engagements.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!engagementId || busy !== null}
              onClick={() =>
                void run('sync', async () => {
                  const r = await syncFindingsFromCatalogApi({ engagement_id: engagementId });
                  setNotice(`Sync catálogo: ${r.synced} actualizado(s), ${r.skipped} omitidos.`);
                })
              }
            >
              {busy === 'sync' ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : null}
              Sync desde catálogo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!engagementId || busy !== null}
              onClick={() =>
                void run('consolidate', async () => {
                  const r = await consolidateMasterCatalogApi({ engagement_id: engagementId });
                  setNotice(`Consolidado: ${r.synced} en catálogo, ${r.groups} grupos.`);
                })
              }
            >
              {busy === 'consolidate' ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : null}
              Consolidar en catálogo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!engagementId || busy !== null}
              onClick={() =>
                void run('repair', async () => {
                  const r = await repairFindingsText(engagementId);
                  setNotice(`Reparados ${r.repaired_count} de ${r.total} hallazgos.`);
                })
              }
            >
              {busy === 'repair' ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : null}
              Reparar texto
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!engagementId || busy !== null}
              onClick={() =>
                void run('dedup', async () => {
                  const r = await deduplicateFindingsEngagement(engagementId);
                  setNotice(`Deduplicado: ${r.deleted_count} eliminados en ${r.group_count} grupos.`);
                })
              }
            >
              {busy === 'dedup' ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : null}
              Deduplicar servicio
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={busy !== null} onClick={() => void load()}>
              <RefreshCw className="size-3.5 mr-1" />
              Actualizar métricas
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p className="text-sm text-destructive border border-destructive/30 rounded-lg px-3 py-2">{error}</p>
      ) : null}
      {notice ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 rounded-lg px-3 py-2">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
