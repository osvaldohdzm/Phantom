import Link from 'next/link';
import { LastExcelIngestHint } from '@/components/last-excel-ingest-hint';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Bug, Crosshair, Briefcase, BarChart3, FileSpreadsheet, Shield, Wrench, Database } from 'lucide-react';

const kpi = [
  { label: 'Hallazgos abiertos', value: '—', hint: 'API / ingestión' },
  { label: 'Engagements activos', value: '—', hint: 'PENT-Lifecycle' },
  { label: 'Servicios en curso', value: '—', hint: 'SEC-Services' },
  { label: 'Críticos sin SLA', value: '—', hint: 'Remediation_Plan' },
];

const severityBars = [
  { label: 'Crítico', pct: 12, className: 'bg-rose-500' },
  { label: 'Alto', pct: 24, className: 'bg-orange-500' },
  { label: 'Medio', pct: 38, className: 'bg-amber-400' },
  { label: 'Bajo / Info', pct: 26, className: 'bg-slate-500' },
];

export default function TableroPage() {
  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-3">
          <LastExcelIngestHint />
          <h1 className="text-3xl font-bold tracking-tight text-slate-50">Tablero</h1>
          <p className="text-slate-400 mt-2 max-w-2xl">
            Vista ejecutiva alineada a <span className="text-slate-300">Vulns Internas Overview</span>: severidad,
            avance de remediación y riesgo residual. Conecta el frontend al API Gateway cuando el backend esté en
            ejecución.
          </p>
        </div>
        <Link
          href="/vul-mgmt"
          className={buttonVariants({
            variant: 'outline',
            className: 'border-slate-700 bg-slate-900 text-slate-200 shrink-0',
          })}
        >
          Ir a VUL-Mgmt
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpi.map((item) => (
          <Card key={item.label} className="bg-slate-900/80 border-slate-800">
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-500">{item.hint}</CardDescription>
              <CardTitle className="text-2xl font-mono text-slate-100">{item.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 bg-slate-900/80 border-slate-800">
          <CardHeader className="flex flex-row items-center gap-2">
            <BarChart3 className="size-5 text-violet-400" />
            <div>
              <CardTitle className="text-slate-100">Distribución por severidad</CardTitle>
              <CardDescription className="text-slate-500">
                Plantilla para gráficas del resumen ejecutivo (datos desde <code className="text-slate-400">findings</code>).
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {severityBars.map((s) => (
              <div key={s.label} className="space-y-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{s.label}</span>
                  <span className="font-mono text-slate-500">{s.pct}% demo</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className={`h-full rounded-full ${s.className}`} style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <Shield className="size-5 text-emerald-400" />
              Módulos core
            </CardTitle>
            <CardDescription className="text-slate-500">Accesos rápidos al ciclo operativo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/vul-catalog"
              className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3 text-sm hover:border-cyan-500/40 transition-colors"
            >
              <Database className="size-4 text-cyan-400 shrink-0" />
              <span>Catálogo de vulnerabilidades (CRUD)</span>
            </Link>
            <Link
              href="/vul-mgmt"
              className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3 text-sm hover:border-violet-500/40 transition-colors"
            >
              <Bug className="size-4 text-violet-400 shrink-0" />
              <span>Gestión de vulnerabilidades e ingestión</span>
            </Link>
            <Link
              href="/pent-lifecycle"
              className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3 text-sm hover:border-cyan-500/40 transition-colors"
            >
              <Crosshair className="size-4 text-cyan-400 shrink-0" />
              <span>Ciclo de pentest y reporteo</span>
            </Link>
            <Link
              href="/sec-services"
              className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3 text-sm hover:border-amber-500/40 transition-colors"
            >
              <Briefcase className="size-4 text-amber-400 shrink-0" />
              <span>Catálogo de servicios de ciberseguridad</span>
            </Link>
            <Link
              href="/ingesta-excel"
              className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3 text-sm hover:border-violet-500/40 transition-colors"
            >
              <FileSpreadsheet className="size-4 text-violet-400 shrink-0" />
              <span>Inspector de libro Excel (hojas, columnas, registro)</span>
            </Link>
            <Link
              href="/tools/nmap"
              className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3 text-sm hover:border-emerald-500/40 transition-colors"
            >
              <Wrench className="size-4 text-emerald-400 shrink-0" />
              <span>Parser Nmap → Excel (reconocimiento)</span>
            </Link>
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-[11px] text-slate-600">
        Documentación de arquitectura y API en <code className="text-slate-500">docs/</code>
      </p>
    </div>
  );
}
