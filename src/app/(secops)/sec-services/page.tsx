import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const catalog = [
  { name: 'Análisis de código estático / SAST', note: 'Integración CI (Jenkins, GitLab).' },
  { name: 'Hardening e infraestructura', note: 'Runbooks y evidencias en plataforma.' },
  { name: 'Auditoría de cumplimiento', note: 'Controles mapeados a hallazgos y planes.' },
  { name: 'Red team / purple team', note: 'Engagement tipo extendido en PENT-Lifecycle.' },
] as const;

export default function SecServicesPage() {
  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-50">SEC-Services</h1>
        <p className="text-slate-400 mt-2">
          Catálogo de servicios de ciberseguridad, asignación de consultores y seguimiento de tiempos alineado a la hoja{' '}
          <span className="text-slate-300">Reportes</span>.
        </p>
      </div>

      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-100">Catálogo (plantilla)</CardTitle>
          <CardDescription className="text-slate-500">
            En implementación completa: tabla <code className="text-slate-400">security_services</code> + asignaciones y
            partes de horas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {catalog.map((c) => (
            <div
              key={c.name}
              className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
            >
              <span className="text-slate-200 text-sm font-medium">{c.name}</span>
              <span className="text-xs text-slate-500">{c.note}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
