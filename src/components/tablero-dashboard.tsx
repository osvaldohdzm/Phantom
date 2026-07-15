'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Loader2, Shield, Workflow, Code, ShieldCheck, Server, KeyRound, ArrowUpRight } from 'lucide-react';
import { LastExcelIngestHint } from '@/components/last-excel-ingest-hint';
import { RiskPriorityPanel } from '@/components/risk-priority-panel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { getPlatformStats, type PlatformStats } from '@/lib/secops-api';
import { useUiT } from '@/lib/use-ui-locale';
import { cn } from '@/lib/utils';

export function TableroDashboard() {
  const { t, format } = useUiT();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const severityOrder = useMemo(
    () => [
      { key: 'Critical', label: t('dashSeverityCritical'), className: 'bg-rose-500' },
      { key: 'High', label: t('dashSeverityHigh'), className: 'bg-orange-500' },
      { key: 'Medium', label: t('dashSeverityMedium'), className: 'bg-amber-400' },
      { key: 'Low', label: t('dashSeverityLow'), className: 'bg-slate-500' },
      { key: 'Info', label: t('dashSeverityInfo'), className: 'bg-sky-500' },
    ],
    [t]
  );

  useEffect(() => {
    void (async () => {
      try {
        setStats(await getPlatformStats());
      } catch (e) {
        setError(e instanceof Error ? e.message : t('dashErrorMetrics'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const severityBars = useMemo(() => {
    if (!stats) return [];
    const total = Object.values(stats.by_severity).reduce((a, b) => a + b, 0) || 1;
    return severityOrder.map((s) => ({
      ...s,
      count: stats.by_severity[s.key] ?? 0,
      pct: Math.round(((stats.by_severity[s.key] ?? 0) / total) * 100),
    }));
  }, [stats, severityOrder]);

  const kpis = stats
    ? [
        {
          label: t('dashKpiOpenFindings'),
          value: String(stats.findings_open),
          hint: t('dashKpiAllProjects'),
        },
        {
          label: t('dashKpiProjects'),
          value: String(stats.engagements_total),
          hint: t('dashKpiEngagements'),
        },
        {
          label: t('dashKpiAssets'),
          value: String(stats.assets_total),
          hint: t('dashKpiInventoryM2'),
        },
        {
          label: t('dashKpiCriticalOpen'),
          value: String(stats.findings_critical_open),
          hint: t('dashKpiImmediatePriority'),
        },
      ]
    : [];

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
        <div className="space-y-4">
          <LastExcelIngestHint />
          <h1 className="type-h1">{t('dashTitle')}</h1>
          <p className="type-body text-muted-foreground max-w-2xl">{t('dashSubtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link href="/reports" className={buttonVariants({ variant: 'default' })}>
            {t('dashPentestBtn')}
          </Link>
          <Link href="/vul-mgmt" className={buttonVariants({ variant: 'outline' })}>
            {t('navVulnerabilities')}
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
              <CardTitle>{t('dashSeverityTitle')}</CardTitle>
              <CardDescription>
                {stats
                  ? format('dashFindingsInDb', { count: stats.findings_total })
                  : t('loading')}
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
              {t('dashQuickAccess')}
            </CardTitle>
            <CardDescription>{t('dashQuickAccessDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Link href="/reports" className="block rounded-lg border px-3 py-2 hover:bg-muted/50">
              {t('dashLinkPentest7')}
            </Link>
            <Link href="/assets" className="block rounded-lg border px-3 py-2 hover:bg-muted/50">
              {t('dashLinkAssets')}
            </Link>
            <Link href="/compliance" className="block rounded-lg border px-3 py-2 hover:bg-muted/50">
              {t('dashLinkCompliance')}
            </Link>
            <Link href="/portal" className="block rounded-lg border px-3 py-2 hover:bg-muted/50">
              {t('dashLinkPortal')}
            </Link>
            <Link href="/reports" className="block rounded-lg border px-3 py-2 hover:bg-muted/50">
              Servicios de Pentest
            </Link>
          </CardContent>
        </Card>
      </div>

      <RiskPriorityPanel />

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">Servicios Operativos de la Plataforma</h2>
            <p className="text-xs text-muted-foreground">
              Accede directamente a los servicios implementados y configurados en Spectre.
            </p>
          </div>
          <Link
            href="/reports"
            className="inline-flex items-center text-xs font-semibold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400"
          >
            Ver todos los servicios
            <ArrowUpRight className="size-4 ml-1" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              name: 'Pentest de Infraestructura & Aplicación',
              desc: 'Flujo completo en 7 pasos, administración de hallazgos y generación de entregables Word.',
              icon: Workflow,
              href: '/reports',
            },
            {
              name: 'Análisis de Vulnerabilidades (SAST/DAST)',
              desc: 'Detección dinámica y estática integrada de código fuente y red.',
              icon: Code,
              href: '/reports',
            },
            {
              name: 'Auditorías de Cumplimiento (Compliance)',
              desc: 'Controles y mapeo de vulnerabilidades a normativas PCI, ISO 27001 y NIST.',
              icon: ShieldCheck,
              href: '/compliance',
            },
            {
              name: 'Gestión e Inventario de Activos',
              desc: 'Inventario inteligente de hosts, apps y cola de aprobación automatizada.',
              icon: Server,
              href: '/assets',
            },
            {
              name: 'Caja Fuerte de Credenciales (Vault)',
              desc: 'Minivault de contraseñas SSH, RDP y web encriptadas con hashing y auditoría.',
              icon: KeyRound,
              href: '/assets',
            },
          ].map((service) => {
            const IconComponent = service.icon;
            return (
              <Link
                key={service.name}
                href={service.href}
                className="group flex flex-col justify-between p-4 rounded-xl border border-border/50 bg-card hover:border-cyan-500/50 hover:bg-muted/10 transition-all duration-300 shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 group-hover:bg-cyan-500/20 transition-colors">
                      <IconComponent className="size-4.5" />
                    </div>
                    <ArrowUpRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-foreground leading-snug">{service.name}</h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{service.desc}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
