import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlatformModulesGrid } from '@/components/platform-modules-grid';
import { buttonVariants } from '@/components/ui/button';

const catalog = [
  {
    name: 'Pentest infra / red / aplicación',
    note: 'Servicio · 7 pasos · M10 + M14',
    href: '/reports',
  },
  {
    name: 'Análisis estático (SAST)',
    note: 'Servicio SAST · parsers en Fase 3',
    href: '/reports',
  },
  {
    name: 'DAST web (Acunetix, Burp)',
    note: 'Ingesta Acunetix + servicio DAST',
    href: '/reports',
  },
  {
    name: 'Auditoría de cumplimiento',
    note: 'M17 · controles y mapeo a hallazgos',
    href: '/compliance',
  },
  {
    name: 'Gestión de activos',
    note: 'M2 · inventario antes del alcance',
    href: '/assets',
  },
] as const;

export default function SecServicesPage() {
  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-10">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">SEC-Services · Plataforma</h1>
        <p className="text-muted-foreground max-w-3xl">
          Mapa de módulos M1–M17 según la especificación del sistema. Lo marcado como{' '}
          <span className="text-emerald-600 dark:text-emerald-400">Operativo</span> o{' '}
          <span className="text-amber-600 dark:text-amber-400">Parcial</span> ya tiene código en
          Spectre; los servicios de pentest, DAST, SAST y AV Infra usan un wizard de 7 pasos.
        </p>
        <Link href="/reports" className={buttonVariants({ variant: 'outline' })}>
          Ir a servicios (flujo pentest)
        </Link>
      </div>

      <PlatformModulesGrid />

      <Card>
        <CardHeader>
          <CardTitle>Catálogo de servicios</CardTitle>
          <CardDescription>Enlaces a los servicios implementados hoy</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {catalog.map((c) => (
            <Link
              key={c.name}
              href={c.href}
              className="rounded-lg border border-border bg-muted/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 hover:border-primary/30 transition-colors"
            >
              <span className="text-sm font-medium">{c.name}</span>
              <span className="text-xs text-muted-foreground">{c.note}</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
