import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const phases = [
  {
    title: 'Pre-engagement',
    body: 'SoW, alcance (IPs, FQDNs), reglas de compromiso. Tablas: engagements, assets vinculados.',
  },
  {
    title: 'Reconocimiento',
    body: 'OSINT y superficie de ataque (hoja homónima). Integración con salidas Nmap y otros scanners.',
  },
  {
    title: 'Ejecución',
    body: 'Checklists WSTG, MASTG, OSSTMM. Registro de pruebas por objetivo y metodología.',
  },
  {
    title: 'Explotación y post-explotación',
    body: 'PoC, evidencia multimedia, narrativa técnica. IA asiste en redacción; el pentester valida.',
  },
  {
    title: 'Reporteo',
    body: 'Reporte técnico + ejecutivo + export Excel de seguimiento para el cliente.',
  },
] as const;

export default function PentLifecyclePage() {
  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-50">PENT-Lifecycle</h1>
        <p className="text-slate-400 mt-2">
          Inspirado en <span className="text-slate-300">Evaluaciones Seleccionadas</span> y{' '}
          <span className="text-slate-300">Acciones Ofensivas</span>: un solo engagement con fases auditables.
        </p>
      </div>

      <div className="space-y-4">
        {phases.map((p, i) => (
          <Card key={p.title} className="bg-slate-900/80 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100 flex items-baseline gap-2">
                <span className="text-slate-600 font-mono text-sm">{String(i + 1).padStart(2, '0')}</span>
                {p.title}
              </CardTitle>
              <CardDescription className="text-slate-400 leading-relaxed">{p.body}</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-slate-600 border-t border-slate-800/80 pt-4">
              Modelo: <code className="text-slate-500">engagements</code> + entidades de evidencia / checklist (extensión
              futura del esquema).
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
