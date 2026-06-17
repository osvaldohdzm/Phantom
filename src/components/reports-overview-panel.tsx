'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Loader2,
  Network,
  RefreshCw,
  Layers,
  FileStack,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fetchProjectSummary, type ProjectSummary } from '@/lib/secops-api';
import type { Severity } from '@/lib/secops-api';
import {
  isInformativeSeverity,
  OVERVIEW_SEVERITY_COLORS,
  OVERVIEW_SEVERITY_LABELS,
} from '@/lib/finding-overview-stats';
import { CopyableDataTable } from '@/components/copyable-data-table';
import {
  ExecutiveMatrixTableBody,
  ExecutiveMatrixTableHead,
  ExecutiveSeverityChart,
  ExecutiveSeveritySummaryBody,
  ExecutiveSeveritySummaryTable,
  ExecutiveVulnerabilityChart,
} from '@/components/executive-overview-charts';
import {
  aggregateVulnerabilityMatrix,
  buildSeverityCountRows,
  severitySummaryTsv,
  sortMostCommon,
  sortTopByImpact,
  vulnerabilityMatrixTsv,
} from '@/lib/executive-overview';

const OVERVIEW_CARD = 'border-border bg-card shadow-sm';

function KpiCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-1 shadow-sm">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('text-2xl font-bold tabular-nums text-foreground', accent)}>{value}</p>
      {hint ? <p className="text-[11px] text-muted-foreground leading-snug">{hint}</p> : null}
    </div>
  );
}

function summaryToDisplay(summary: ProjectSummary) {
  return {
    totalFindings: summary.total_findings,
    totalExcludingInfo: summary.total_excluding_info,
    uniqueComponents: summary.unique_components,
    uniqueHosts: summary.unique_hosts,
    componentOccurrences: summary.component_occurrences,
    groupedVulnerabilityCount: summary.grouped_vulnerability_count,
    groupedVulnerabilityCountExcludingInfo: summary.grouped_vulnerability_count_excluding_info,
    groupedComponentTotal: summary.grouped_component_total,
    bySeverity: summary.by_severity,
    bySeverityExcludingInfo: summary.by_severity_excluding_info,
    compressionRatio: summary.compression_ratio,
    vulnerabilityBreakdown: summary.vulnerability_breakdown.map((v) => ({
      titulo: v.titulo,
      severidad: v.severidad,
      memberCount: v.member_count,
      componentCount: v.component_count,
    })),
  };
}

export function ReportsOverviewPanel({
  engagementId,
  refreshToken = 0,
}: {
  engagementId?: string;
  refreshToken?: number;
}) {
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!engagementId) {
      setSummary(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProjectSummary(engagementId);
      setSummary(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar indicadores');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [engagementId]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const stats = useMemo(
    () => (summary ? summaryToDisplay(summary) : null),
    [summary],
  );

  const topVulns = useMemo(
    () =>
      stats?.vulnerabilityBreakdown.filter((v) => !isInformativeSeverity(v.severidad)).slice(0, 12) ??
      [],
    [stats],
  );

  const severityCountRows = useMemo(
    () => (stats ? buildSeverityCountRows(stats.bySeverityExcludingInfo) : []),
    [stats],
  );

  const vulnerabilityMatrix = useMemo(
    () => (stats ? aggregateVulnerabilityMatrix(stats.vulnerabilityBreakdown) : []),
    [stats],
  );

  const topByImpact = useMemo(() => sortTopByImpact(vulnerabilityMatrix), [vulnerabilityMatrix]);
  const mostCommon = useMemo(() => sortMostCommon(vulnerabilityMatrix), [vulnerabilityMatrix]);

  if (!engagementId) {
    return (
      <p className="text-sm text-amber-700 dark:text-amber-400">
        Selecciona un proyecto en el paso 1 para ver el overview.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
        <Loader2 className="size-4 animate-spin" />
        Calculando indicadores…
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (!stats || stats.totalFindings === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        No hay hallazgos en este proyecto. Importa o registra hallazgos en los pasos anteriores.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Resumen antes de generar reportes. Cada IP:puerto distinto cuenta como componente afectado.
          <span className="text-foreground/70">
            {' '}
            · {stats.totalFindings.toLocaleString()} registros en BD (cálculo en servidor)
          </span>
        </p>
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => void load()}>
          <RefreshCw className="size-3.5" />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Vulnerabilidades (sin Info)"
          value={stats.totalExcludingInfo}
          hint="Registros de hallazgo excluyendo informativas"
          accent="text-violet-700 dark:text-violet-300"
        />
        <KpiCard
          label="Grupos para Word"
          value={stats.groupedVulnerabilityCountExcludingInfo}
          hint="Agrupado por nombre + severidad (o Plugin ID)"
          accent="text-emerald-700 dark:text-emerald-300"
        />
        <KpiCard
          label="Componentes (IP:puerto)"
          value={stats.componentOccurrences}
          hint={`${stats.uniqueComponents} únicos · ${stats.uniqueHosts} hosts distintos`}
          accent="text-sky-700 dark:text-sky-300"
        />
        <KpiCard
          label="Registros totales"
          value={stats.totalFindings}
          hint={`Incluye ${stats.bySeverity.Info ?? 0} informativas · ratio ${stats.compressionRatio}×`}
        />
      </div>

      <Card className={OVERVIEW_CARD}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="size-4 text-violet-600 dark:text-violet-400" />
            Resumen ejecutivo — por severidad
          </CardTitle>
          <CardDescription className="text-xs">
            Gráfica y tabla para el capítulo 4 del informe. Orden de columnas: BAJAS → CRÍTICAS. Los conteos
            son registros de hallazgo (sin informativas).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <ExecutiveSeverityChart rows={severityCountRows} total={stats.totalExcludingInfo} />
          </div>
          <CopyableDataTable
            caption="Selecciona la tabla o usa «Copiar tabla» para pegar en Excel."
            tsvRows={severitySummaryTsv(severityCountRows)}
          >
            <ExecutiveSeveritySummaryTable />
            <ExecutiveSeveritySummaryBody rows={severityCountRows} />
          </CopyableDataTable>
        </CardContent>
      </Card>

      <Card className={OVERVIEW_CARD}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="size-4 text-rose-600 dark:text-rose-400" />
            Vulnerabilidades de mayor impacto
          </CardTitle>
          <CardDescription className="text-xs">
            Ordenadas por severidad (críticas primero) y por componentes afectados (IP:puerto). Matriz con
            columnas BAJAS → CRÍTICAS.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/20 p-4 max-h-[420px] overflow-y-auto">
            <ExecutiveVulnerabilityChart rows={topByImpact} />
          </div>
          <CopyableDataTable
            caption="Copia la matriz y pégala en Excel conservando columnas."
            tsvRows={vulnerabilityMatrixTsv(topByImpact)}
          >
            <ExecutiveMatrixTableHead />
            <ExecutiveMatrixTableBody rows={topByImpact} />
          </CopyableDataTable>
        </CardContent>
      </Card>

      <Card className={OVERVIEW_CARD}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="size-4 text-emerald-600 dark:text-emerald-400" />
            Vulnerabilidades más comunes
          </CardTitle>
          <CardDescription className="text-xs">
            Frecuencia por componentes afectados (IP:puerto). Si el mismo nombre aparece en varias
            severidades, se suma en cada columna.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/20 p-4 max-h-[420px] overflow-y-auto">
            <ExecutiveVulnerabilityChart rows={mostCommon} />
          </div>
          <CopyableDataTable
            caption="Copia la matriz y pégala en Excel conservando columnas."
            tsvRows={vulnerabilityMatrixTsv(mostCommon)}
          >
            <ExecutiveMatrixTableHead />
            <ExecutiveMatrixTableBody rows={mostCommon} />
          </CopyableDataTable>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={OVERVIEW_CARD}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="size-4 text-emerald-600 dark:text-emerald-400" />
              Agrupado vs sin agrupar
            </CardTitle>
            <CardDescription className="text-xs">
              Comparación entre registros en BD y filas del reporte Word / Tabla
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <FileStack className="size-3.5" />
                Registros en BD
              </span>
              <span className="font-mono text-foreground">{stats.totalFindings}</span>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">Sin informativas</span>
              <span className="font-mono text-violet-700 dark:text-violet-300">{stats.totalExcludingInfo}</span>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">Grupos Word (todas)</span>
              <span className="font-mono text-emerald-700 dark:text-emerald-300">
                {stats.groupedVulnerabilityCount}
              </span>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">Grupos Word (sin Info)</span>
              <span className="font-mono text-emerald-700 dark:text-emerald-300">
                {stats.groupedVulnerabilityCountExcludingInfo}
              </span>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Network className="size-3.5" />
                Componentes en grupos
              </span>
              <span className="font-mono text-sky-700 dark:text-sky-300">{stats.groupedComponentTotal}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IP:puerto únicos</span>
              <span className="font-mono text-sky-700 dark:text-sky-300">{stats.uniqueComponents}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className={OVERVIEW_CARD}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            Conteo por vulnerabilidad (agrupado)
          </CardTitle>
          <CardDescription className="text-xs">
            Cada fila es un grupo Word. «Registros» = hallazgos sin agrupar; «Componentes» = IP:puerto
            distintos en ese grupo.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-muted-foreground border-b border-border bg-muted/30">
                <th className="text-left py-2 pr-3 font-medium">Severidad</th>
                <th className="text-left py-2 pr-3 font-medium">Vulnerabilidad</th>
                <th className="text-right py-2 px-2 font-medium">Registros</th>
                <th className="text-right py-2 pl-2 font-medium">Componentes</th>
              </tr>
            </thead>
            <tbody>
              {topVulns.map((row) => (
                <tr
                  key={`${row.titulo}-${row.severidad}`}
                  className="border-b border-border/60 hover:bg-muted/30"
                >
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase text-white',
                        OVERVIEW_SEVERITY_COLORS[row.severidad as Severity],
                      )}
                    >
                      {OVERVIEW_SEVERITY_LABELS[row.severidad as Severity]}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-foreground max-w-md truncate" title={row.titulo}>
                    {row.titulo}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-muted-foreground">{row.memberCount}</td>
                  <td className="py-2 pl-2 text-right font-mono text-sky-700 dark:text-sky-300">
                    {row.componentCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {stats.vulnerabilityBreakdown.length > topVulns.length ? (
            <p className="text-[10px] text-muted-foreground mt-2">
              Mostrando {topVulns.length} de {stats.vulnerabilityBreakdown.length} grupos (sin
              informativas).
            </p>
          ) : null}
        </CardContent>
      </Card>

      {(stats.bySeverity.Info ?? 0) > 0 ? (
        <p className="text-[11px] text-muted-foreground text-center">
          {stats.bySeverity.Info} hallazgo(s) informativo(s) excluidos del total principal y de la tabla
          anterior.
        </p>
      ) : null}
    </div>
  );
}
