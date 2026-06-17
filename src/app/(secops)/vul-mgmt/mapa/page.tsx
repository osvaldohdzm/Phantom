import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExposureMapPanel } from '@/components/exposure-map-panel';

export default function VulnMgmtMapaPage() {
  return (
    <Card className="overflow-hidden border-violet-500/15 shadow-md">
      <CardHeader className="px-4 py-3 border-b border-border/60 bg-muted/10">
        <CardTitle className="text-base">Mapa de red y vulnerabilidades</CardTitle>
        <CardDescription className="text-xs">
          Visualización en vivo del último Nessus o del inventario + hallazgos del servicio. Ideal
          para AV Infraestructura tras el re-escaneo.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <ExposureMapPanel />
      </CardContent>
    </Card>
  );
}
