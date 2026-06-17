import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { VulIngestPanel } from '@/components/vul-ingest-panel';
import { VulRescanPanel } from '@/components/vul-rescan-panel';
import { FileCode2, FileSpreadsheet, Network, PenLine, Table2 } from 'lucide-react';

const formats = [
  { icon: FileSpreadsheet, title: 'Nessus', subtitle: 'CSV (Tenable)' },
  { icon: Table2, title: 'CSV universal', subtitle: 'Seguimiento y mapeo de columnas' },
  { icon: FileCode2, title: 'Acunetix', subtitle: 'HTML' },
  { icon: Network, title: 'Nmap', subtitle: 'XML / GNMAP' },
  { icon: PenLine, title: 'Manual', subtitle: 'Formulario en hallazgos' },
] as const;

export default function VulnMgmtIngestaPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Carga al repositorio de hallazgos</CardTitle>
          <CardDescription>
            Primera importación vinculada al servicio activo. Para re-escaneos AV usa el panel de
            re-scan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VulIngestPanel />
        </CardContent>
      </Card>

      <VulRescanPanel />

      <Card>
        <CardHeader>
          <CardTitle>Fuentes soportadas</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
            {formats.map(({ icon: Icon, title, subtitle }) => (
              <li
                key={title}
                className="rounded-md border border-border px-3 py-2.5 bg-muted/40 flex items-start gap-2.5"
              >
                <Icon className="size-4 shrink-0 mt-0.5 text-violet-600 dark:text-violet-300" />
                <span>
                  <span className="font-medium">{title}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">{subtitle}</span>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
