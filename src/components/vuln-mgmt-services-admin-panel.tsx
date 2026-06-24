'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Loader2, Upload, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import {
  bulkDeleteFindingsByQuery,
  countFindings,
  listEngagements,
  publishFindingsToRepository,
  type Engagement,
} from '@/lib/secops-api';

type ServiceRow = {
  engagement: Engagement;
  totalFindings: number;
  draftEstimate: number;
};

export function VulnMgmtServicesAdminPanel() {
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const engagements = await listEngagements();
      const enriched: ServiceRow[] = [];
      for (const eg of engagements) {
        const totalFindings = await countFindings({ engagement_id: eg.id });
        enriched.push({ engagement: eg, totalFindings, draftEstimate: totalFindings });
      }
      setRows(enriched);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar servicios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const publish = async (engagementId: string, nombre: string) => {
    if (!window.confirm(`¿Publicar borradores de «${nombre}» en el repositorio global?`)) return;
    setBusyId(engagementId);
    setError(null);
    setNotice(null);
    try {
      const r = await publishFindingsToRepository(engagementId);
      setNotice(r.message ?? `Publicados ${r.published_count} hallazgo(s).`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo publicar');
    } finally {
      setBusyId(null);
    }
  };

  const clearService = async (engagementId: string, nombre: string) => {
    if (
      !window.confirm(
        `¿Eliminar TODOS los hallazgos del servicio «${nombre}»?\n\nIncluye borradores y publicados. Permanente.`
      )
    )
      return;
    setBusyId(engagementId);
    setError(null);
    setNotice(null);
    try {
      const r = await bulkDeleteFindingsByQuery({ engagement_id: engagementId });
      setNotice(`Eliminados ${r.deleted_count} hallazgo(s) del servicio.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo limpiar el servicio');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="size-4 text-sky-500" />
            Borradores → repositorio
          </CardTitle>
          <CardDescription className="text-xs">
            Tras importar en un servicio, los hallazgos quedan en{' '}
            <code className="rounded bg-muted px-1">BORRADOR_SERVICIO</code>. Publica aquí o desde el
            flujo del servicio con «Cargar a gestión».
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/reports" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <ExternalLink className="size-3.5 mr-1" />
            Abrir flujos de servicio
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Servicios del tenant</CardTitle>
          <CardDescription className="text-xs">
            Publicar borradores, limpiar tabla del servicio o abrir el flujo de revisión.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Cargando…
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay servicios. Créalos en Servicios.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4">Servicio</th>
                    <th className="py-2 pr-4">Tipo</th>
                    <th className="py-2 pr-4 text-right">Hallazgos</th>
                    <th className="py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ engagement, totalFindings }) => (
                    <tr key={engagement.id} className="border-b border-border/60">
                      <td className="py-2.5 pr-4 font-medium">{engagement.nombre_proyecto || engagement.cliente}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground text-xs">
                        {engagement.tipo_servicio ?? '—'}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono tabular-nums">{totalFindings}</td>
                      <td className="py-2.5 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            className="h-7 text-xs"
                            disabled={busyId !== null}
                            onClick={() => void publish(engagement.id, engagement.nombre_proyecto || engagement.cliente)}
                          >
                            {busyId === engagement.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              'Publicar'
                            )}
                          </Button>
                          <Link
                            href={`/reports?engagement=${engagement.id}`}
                            className={buttonVariants({ variant: 'outline', size: 'sm', className: 'h-7 text-xs' })}
                          >
                            Flujo
                          </Link>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-destructive border-destructive/40"
                            disabled={busyId !== null || totalFindings === 0}
                            onClick={() => void clearService(engagement.id, engagement.nombre_proyecto || engagement.cliente)}
                          >
                            <Trash2 className="size-3 mr-0.5" />
                            Limpiar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
