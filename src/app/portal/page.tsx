'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  listEngagements,
  listFindings,
  listReportJobs,
  type Engagement,
  type Finding,
  type ReportJobHistoryItem,
} from '@/lib/secops-api';
import { SeverityBadge } from '@/components/severity-badge';

export default function PortalPage() {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [jobs, setJobs] = useState<ReportJobHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const list = await listEngagements();
        setEngagements(list);
        if (list.length === 1) setSelectedId(list[0].id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudieron cargar proyectos');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setFindings([]);
      setJobs([]);
      return;
    }
    void (async () => {
      setLoadingDetail(true);
      try {
        const [f, j] = await Promise.all([
          listFindings({ engagement_id: selectedId, limit: 500 }),
          listReportJobs(selectedId),
        ]);
        setFindings(f);
        setJobs(j);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar datos del proyecto');
      } finally {
        setLoadingDetail(false);
      }
    })();
  }, [selectedId]);

  const selected = engagements.find((e) => e.id === selectedId);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Vista de solo lectura</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Hallazgos y reportes del proyecto seleccionado. Sin edición ni datos internos de pentest.
        </p>
      </div>

      {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Proyecto</CardTitle>
          <CardDescription>Selecciona un engagement para ver su resumen.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full max-w-md h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">— Elegir proyecto —</option>
              {engagements.map((eg) => (
                <option key={eg.id} value={eg.id}>
                  {eg.cliente}
                  {eg.nombre_proyecto ? ` · ${eg.nombre_proyecto}` : ''}
                </option>
              ))}
            </select>
          )}
          {selected ? (
            <p className="text-xs text-muted-foreground mt-2">
              {selected.tipo}
              {selected.fecha_inicio ? ` · inicio ${selected.fecha_inicio}` : ''}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {selectedId ? (
        loadingDetail ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hallazgos ({findings.length})</CardTitle>
                <CardDescription>Título, severidad, estado y componente afectado.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm border-collapse min-w-[520px]">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Título</th>
                      <th className="py-2 pr-3 font-medium">Severidad</th>
                      <th className="py-2 pr-3 font-medium">Estado</th>
                      <th className="py-2 font-medium">Componente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {findings.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-muted-foreground text-xs">
                          Sin hallazgos en este proyecto.
                        </td>
                      </tr>
                    ) : (
                      findings.map((f) => (
                        <tr key={f.id} className="border-b border-border/60">
                          <td className="py-2 pr-3 max-w-[240px] truncate">{f.titulo}</td>
                          <td className="py-2 pr-3">
                            <SeverityBadge severity={f.severidad} />
                          </td>
                          <td className="py-2 pr-3 text-xs text-muted-foreground">{f.status}</td>
                          <td className="py-2 text-xs text-muted-foreground max-w-[180px] truncate">
                            {f.componente_afectado ?? '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Historial de reportes</CardTitle>
                <CardDescription>Generaciones Word asociadas al proyecto.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm border-collapse min-w-[480px]">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Plantilla</th>
                      <th className="py-2 pr-3 font-medium">Estado</th>
                      <th className="py-2 pr-3 font-medium">Hallazgos</th>
                      <th className="py-2 font-medium">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-muted-foreground text-xs">
                          Sin reportes generados.
                        </td>
                      </tr>
                    ) : (
                      jobs.map((job) => (
                        <tr key={job.id} className="border-b border-border/60">
                          <td className="py-2 pr-3">{job.template_name}</td>
                          <td className="py-2 pr-3 text-xs">{job.status}</td>
                          <td className="py-2 pr-3 font-mono text-xs">{job.findings_count}</td>
                          <td className="py-2 text-xs text-muted-foreground">
                            {new Date(job.created_at).toLocaleString('es-MX')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )
      ) : null}
    </div>
  );
}
