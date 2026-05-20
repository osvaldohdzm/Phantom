import { FileSpreadsheet, FileCode2, Network, Code2, PenLine } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { VulIngestPanel } from '@/components/vul-ingest-panel';

const lifecycle = [
  'Abierta',
  'En proceso',
  'Remediada',
  'Validada',
  'Falso positivo',
  'Riesgo aceptado',
] as const;

const formats = [
  { icon: FileSpreadsheet, title: 'Nessus', subtitle: 'CSV (Tenable)', active: true },
  { icon: FileCode2, title: 'Acunetix', subtitle: 'HTML (tabla de alertas)', active: true },
  { icon: Network, title: 'Nmap', subtitle: 'XML / GNMAP / texto → hallazgos Info', active: true },
  { icon: Code2, title: 'SonarQube', subtitle: 'Próximo', active: false },
  { icon: PenLine, title: 'Manual / pentest', subtitle: 'POST /findings', active: false },
] as const;

export default function VulMgmtPage() {
  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-50">VUL-Mgmt</h1>
        <p className="text-slate-400 mt-2">
          Centraliza hallazgos automáticos y manuales. Normaliza al estándar de hojas{' '}
          <span className="text-slate-300">Vulnerabilidades Internas/Externas</span> y enlaza con{' '}
          <span className="text-slate-300">Catálogo vulnerabilidades</span> vía IA (LangChain).
        </p>
      </div>

      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-100">Carga al repositorio de hallazgos</CardTitle>
          <CardDescription className="text-slate-500">
            Sube archivos; FastAPI parsea y persiste en PostgreSQL. Opcional: vincular a un engagement por UUID.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VulIngestPanel />
        </CardContent>
      </Card>

      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-100">Ingesta y normalización</CardTitle>
          <CardDescription className="text-slate-500">
            Parsers en backend (FastAPI); jobs masivos vía Redis en evolución.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm text-slate-300">
            {formats.map(({ icon: Icon, title, subtitle, active }) => (
              <li
                key={title}
                className="rounded-md border border-slate-800 px-3 py-2.5 bg-slate-950/40 flex items-start gap-2.5"
              >
                <Icon
                  className={`size-4 shrink-0 mt-0.5 ${active ? 'text-violet-300' : 'text-slate-600'}`}
                  aria-hidden
                />
                <span>
                  <span className="text-slate-200 font-medium">{title}</span>
                  <span className="block text-xs text-slate-500 mt-0.5">{subtitle}</span>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-100">Ciclo de vida del hallazgo</CardTitle>
          <CardDescription className="text-slate-500">
            Estados persistidos en <code className="text-slate-400">findings</code> y{' '}
            <code className="text-slate-400">remediation_plan</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-wrap gap-2">
            {lifecycle.map((s, i) => (
              <li
                key={s}
                className="flex items-center gap-2 text-xs text-slate-300 rounded-full border border-slate-700 px-3 py-1 bg-slate-950/50"
              >
                <span className="font-mono text-slate-500">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-100">IA (LangChain)</CardTitle>
          <CardDescription className="text-slate-500">
            CVSS asistido, deduplicación entre herramientas y enriquecimiento desde catálogo.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-slate-400 space-y-2">
          <p>
            Enriquecimiento:{' '}
            <code className="text-violet-300">POST /api/v1/findings/{'{id}'}/ai-enrich</code>. Deduplicación batch: en
            roadmap. Ver <code className="text-slate-500">docs/API.md</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
