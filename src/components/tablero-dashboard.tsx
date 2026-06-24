'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Loader2, Shield } from 'lucide-react';
import { LastExcelIngestHint } from '@/components/last-excel-ingest-hint';
import { PlatformModulesGrid } from '@/components/platform-modules-grid';
import { RiskPriorityPanel } from '@/components/risk-priority-panel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { getPlatformStats, type PlatformStats } from '@/lib/secops-api';
import { cn } from '@/lib/utils';

const SEVERITY_ORDER = [
  { key: 'Critical', label: 'Crítico', className: 'bg-rose-500' },
  { key: 'High', label: 'Alto', className: 'bg-orange-500' },
  { key: 'Medium', label: 'Medio', className: 'bg-amber-400' },
  { key: 'Low', label: 'Bajo', className: 'bg-slate-500' },
  { key: 'Info', label: 'Info', className: 'bg-sky-500' },
] as const;

export function TableroDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setStats(await getPlatformStats());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudieron cargar métricas');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const severityBars = useMemo(() => {
    if (!stats) return [];
    const total = Object.values(stats.by_severity).reduce((a, b) => a + b, 0) || 1;
    return SEVERITY_ORDER.map((s) => ({
      ...s,
      count: stats.by_severity[s.key] ?? 0,
      pct: Math.round(((stats.by_severity[s.key] ?? 0) / total) * 100),
    }));
  }, [stats]);

  const kpis = stats
    ? [
        { label: 'Hallazgos abiertos', value: String(stats.findings_open), hint: 'Todos los proyectos' },
        { label: 'Proyectos', value: String(stats.engagements_total), hint: 'Engagements' },
        { label: 'Activos', value: String(stats.assets_total), hint: 'Inventario M2' },
        {
          label: 'Críticos abiertos',
          value: String(stats.findings_critical_open),
          hint: 'Prioridad inmediata',
        },
      ]
    : [];

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
        <div className="space-y-4">
          <LastExcelIngestHint />
          <h1 className="type-h1">Tablero</h1>
          <p className="type-body text-muted-foreground max-w-2xl">
            Vista ejecutiva con datos reales de hallazgos, proyectos y activos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link href="/reports" className={buttonVariants({ variant: 'default' })}>
            Pentest (7 pasos)
          </Link>
          <Link href="/vul-mgmt" className={buttonVariants({ variant: 'outline' })}>
            Vulnerabilities
          </Link>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="bg-card border-border">
                <CardContent className="py-8 flex justify-center">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            ))
          : kpis.map((item) => (
              <Card key={item.label} className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardDescription>{item.hint}</CardDescription>
                  <CardTitle className="text-2xl font-mono">{item.value}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                </CardContent>
              </Card>
            ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader className="flex flex-row items-center gap-2">
            <BarChart3 className="size-5 text-violet-500" />
            <div>
              <CardTitle>Distribución por severidad</CardTitle>
              <CardDescription>
                {stats
                  ? `${stats.findings_total} hallazgos en base de datos`
                  : 'Cargando…'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              severityBars.map((s) => (
                <div key={s.key} className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{s.label}</span>
                    <span className="font-mono">
                      {s.count} · {s.pct}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', s.className)}
                      style={{ width: `${Math.max(s.pct, s.count > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="size-5 text-emerald-500" />
              Accesos rápidos
            </CardTitle>
            <CardDescription>Ciclo operativo sin salir del tablero.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Link href="/reports" className="block rounded-lg border px-3 py-2 hover:bg-muted/50">
              Servicio pentest · 7 pasos
            </Link>
            <Link href="/assets" className="block rounded-lg border px-3 py-2 hover:bg-muted/50">
              Inventario de activos
            </Link>
            <Link href="/compliance" className="block rounded-lg border px-3 py-2 hover:bg-muted/50">
              Compliance (M17)
            </Link>
            <Link href="/portal" className="block rounded-lg border px-3 py-2 hover:bg-muted/50">
              Portal cliente (M13)
            </Link>
            <Link href="/sec-services" className="block rounded-lg border px-3 py-2 hover:bg-muted/50">
              Mapa de módulos M1–M17
            </Link>
          </CardContent>
        </Card>
      </div>

      <RiskPriorityPanel />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Módulos de la plataforma</h2>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Roadmap alineado a la especificación. El servicio de pentest (M10) en{' '}
          <Link href="/reports" className="text-primary underline-offset-2 hover:underline">
            Servicios
          </Link>{' '}
          incluye 7 pasos, revisión por tipo y desglosada, y exportación CYB001.
        </p>
        <PlatformModulesGrid compact />
      </div>
    </div>
  );
}
