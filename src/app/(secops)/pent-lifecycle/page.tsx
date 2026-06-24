import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { PENTEST_REPORT_FLOW } from '@/lib/reports-flows/pentest-flow';

const phases = [
  {
    title: 'Pre-engagement',
    body: 'SoW, alcance (IPs, FQDNs), reglas de compromiso. Tablas: engagements, assets vinculados.',
    href: '/reports',
  },
  {
    title: 'Reconocimiento',
    body: 'OSINT y superficie de ataque. Salidas Nmap y escáneres de red.',
    href: '/tools/nmap',
  },
  {
    title: 'Ejecución e importación',
    body: 'Nessus, Acunetix, Nmap — paso 2 del wizard. Normalización al modelo unificado.',
    href: '/reports',
  },
  {
    title: 'Revisión y catálogo',
    body: 'Tipos de vulnerabilidad + revisión desglosada por activo. IA Gemini en catálogo operativo.',
    href: '/reports',
  },
  {
    title: 'Reporteo Word',
    body: 'Tabla de hallazgos CYB001 + tablas de detalle por plantilla. Historial en servidor.',
    href: '/reports',
  },
] as const;

export default function PentLifecyclePage() {
  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">PENT-Lifecycle</h1>
        <p className="text-muted-foreground">
          Metodología de pentest y enlace al servicio operativo de Spectre. El wizard de{' '}
          <strong className="text-foreground font-medium">7 pasos</strong> vive en Servicios — no
          duplicamos esa UI aquí.
        </p>
        <Link href="/reports" className={buttonVariants()}>
          Abrir flujo de servicio pentest
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Wizard operativo (M10)</CardTitle>
          <CardDescription>Pasos del servicio pentest infra/red/aplicación</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {PENTEST_REPORT_FLOW.steps.map((step) => (
            <div
              key={step.key}
              className="flex gap-3 rounded-lg border border-border px-3 py-2.5 text-sm"
            >
              <span className="font-mono text-muted-foreground w-6">{step.n}</span>
              <div>
                <p className="font-medium">{step.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Fases metodológicas</h2>
        {phases.map((p, i) => (
          <Card key={p.title}>
            <CardHeader>
              <CardTitle className="flex items-baseline gap-2 text-base">
                <span className="text-muted-foreground font-mono text-sm">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {p.title}
              </CardTitle>
              <CardDescription className="leading-relaxed">{p.body}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={p.href} className="text-xs text-primary hover:underline">
                Ir al módulo →
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
