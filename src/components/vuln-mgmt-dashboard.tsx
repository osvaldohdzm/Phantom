'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Bug,
  CheckCircle2,
  Flame,
  Loader2,
  ShieldAlert,
  Target,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getPlatformStats, listEngagements, type PlatformStats } from '@/lib/secops-api';
import { PRIMARY_SERVICE_TYPES } from '@/lib/engagement-profile';

const SEVERITY_ORDER = [
  { key: 'Critical', label: 'Crítico', className: 'bg-rose-500' },
  { key: 'High', label: 'Alto', className: 'bg-orange-500' },
  { key: 'Medium', label: 'Medio', className: 'bg-amber-400' },
  { key: 'Low', label: 'Bajo', className: 'bg-sky-500' },
  { key: 'Info', label: 'Info', className: 'bg-slate-400' },
] as const;

export function VulnMgmtDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [servicesByType, setServicesByType] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [s, engagements] = await Promise.all([getPlatformStats(), listEngagements()]);
        setStats(s);
        const counts: Record<string, number> = {};
        for (const eg of engagements) {
          const t = eg.tipo_servicio?.trim() || 'Sin tipo';
          counts[t] = (counts[t] ?? 0) + 1;
        }
        setServicesByType(counts);
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
        {
          label: 'Servicios activos',
          value: String(stats.engagements_total),
          hint: 'Engagements / servicios de vulnes',
          icon: Target,
          tone: 'bg-slate-600',
          href: '/reports',
        },
        {
          label: 'Hallazgos nuevos (abiertos)',
          value: String(stats.findings_open),
          hint: 'Repositorio global',
          icon: Bug,
          tone: 'bg-rose-600',
          href: '/vul-mgmt/hallazgos',
        },
        {
          label: 'Críticos abiertos',
          value: String(stats.findings_critical_open),
          hint: 'Prioridad inmediata',
          icon: Flame,
          tone: 'bg-orange-600',
          href: '/vul-mgmt/hallazgos',
        },
        {
          label: 'Total en repositorio',
          value: String(stats.findings_total),
          hint: 'Todas las severidades',
          icon: ShieldAlert,
          tone: 'bg-violet-600',
          href: '/vul-mgmt/hallazgos',
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="py-10 flex justify-center">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            ))
          : kpis.map((item) => (
              <Link key={item.label} href={item.href} className="block group">
                <Card className="overflow-hidden h-full transition-shadow group-hover:shadow-md">
                  <div className={cn('h-1', item.tone)} />
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardDescription>{item.hint}</CardDescription>
                      <item.icon className="size-4 text-muted-foreground" />
                    </div>
                    <CardTitle className="text-3xl font-mono">{item.value}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-[11px] text-primary mt-1">Ver detalle →</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center gap-2">
            <BarChart3 className="size-5 text-violet-500" />
            <div>
              <CardTitle>Severidad histórica</CardTitle>
              <CardDescription>
                {stats ? `${stats.findings_total} hallazgos en repositorio` : 'Cargando…'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {severityBars.map((s) => (
              <div key={s.key} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>{s.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {s.count} ({s.pct}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={cn('h-full rounded-full', s.className)} style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Servicios por tipo</CardTitle>
            <CardDescription>Tipos de servicio de vulnerabilidades</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {PRIMARY_SERVICE_TYPES.map((tipo) => (
              <div key={tipo} className="flex justify-between text-sm border-b border-border/50 pb-1.5">
                <span>{tipo}</span>
                <span className="font-mono text-muted-foreground">{servicesByType[tipo] ?? 0}</span>
              </div>
            ))}
            {Object.entries(servicesByType)
              .filter(([k]) => !PRIMARY_SERVICE_TYPES.includes(k as (typeof PRIMARY_SERVICE_TYPES)[number]))
              .map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm text-muted-foreground">
                  <span>{k}</span>
                  <span className="font-mono">{v}</span>
                </div>
              ))}
            <Link href="/reports" className={buttonVariants({ variant: 'outline', size: 'sm', className: 'w-full mt-3' })}>
              Gestionar servicios
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-500" />
            Accesos rápidos
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/vul-mgmt/hallazgos" className={buttonVariants({ variant: 'default', size: 'sm' })}>
            Matriz CYB001 + exportar
          </Link>
          <Link href="/vul-mgmt/ingesta" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Importar scanners
          </Link>
          <Link href="/assets" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Inventario de activos
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
