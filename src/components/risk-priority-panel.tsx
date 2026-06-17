'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { listFindings, type Finding } from '@/lib/secops-api';
import {
  contextualRiskScore,
  EPSS_HIGH_THRESHOLD,
  isHighEpss,
  sortByContextualRisk,
} from '@/lib/risk-priority';
import { SeverityBadge } from '@/components/severity-badge';

export function RiskPriorityPanel({ engagementId }: { engagementId?: string } = {}) {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const data = await listFindings({
          engagement_id: engagementId,
          limit: 500,
        });
        setFindings(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudieron cargar hallazgos');
      } finally {
        setLoading(false);
      }
    })();
  }, [engagementId]);

  const stats = useMemo(() => {
    const open = findings.filter((f) => f.status !== 'Cerrado' && f.status !== 'Falso Positivo');
    const kevCount = open.filter((f) => f.kev_listed).length;
    const highEpssCount = open.filter((f) => isHighEpss(f)).length;
    const top = sortByContextualRisk(open).slice(0, 5);
    return { kevCount, highEpssCount, top, openTotal: open.length };
  }, [findings]);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="size-4 text-amber-500" />
          Priorización contextual (CVSS · EPSS · KEV)
        </CardTitle>
        <CardDescription>
          EPSS alto ≥ {(EPSS_HIGH_THRESHOLD * 100).toFixed(0)}% · KEV = catálogo CISA
          {engagementId ? ' · proyecto activo' : ' · todos los proyectos'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border px-3 py-2">
                <p className="text-xs text-muted-foreground">En KEV (abiertos)</p>
                <p className="text-xl font-mono font-semibold">{stats.kevCount}</p>
              </div>
              <div className="rounded-lg border px-3 py-2">
                <p className="text-xs text-muted-foreground">EPSS alto</p>
                <p className="text-xl font-mono font-semibold">{stats.highEpssCount}</p>
              </div>
            </div>

            {stats.top.length > 0 ? (
              <ul className="space-y-2 text-xs">
                {stats.top.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-start gap-2 rounded-md border border-border/80 px-2.5 py-2"
                  >
                    <AlertTriangle
                      className={`size-3.5 shrink-0 mt-0.5 ${f.kev_listed ? 'text-rose-500' : 'text-amber-500'}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-foreground">{f.titulo}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-muted-foreground">
                        <SeverityBadge severity={f.severidad} />
                        {f.cvss_score != null ? (
                          <span className="font-mono">CVSS {f.cvss_score.toFixed(1)}</span>
                        ) : null}
                        {f.epss_score != null ? (
                          <span className="font-mono">EPSS {(f.epss_score * 100).toFixed(1)}%</span>
                        ) : null}
                        {f.kev_listed ? (
                          <span className="text-rose-600 dark:text-rose-400 font-medium">KEV</span>
                        ) : null}
                        <span className="font-mono text-[10px] opacity-70">
                          score {contextualRiskScore(f).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sin hallazgos abiertos con datos EPSS/KEV. Importa CSV universal o enriquece desde catálogo.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
