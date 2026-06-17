import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const VulnConsolidatedMatrixPanel = dynamic(
  () =>
    import('@/components/vuln-consolidated-matrix-panel').then((m) => m.VulnConsolidatedMatrixPanel),
  {
    loading: () => (
      <p className="text-sm text-muted-foreground py-6 text-center">Cargando matriz CYB001…</p>
    ),
  }
);

export default function VulnMgmtHallazgosPage() {
  return (
    <Card className="overflow-hidden p-0 gap-0 border-violet-500/15 shadow-md">
      <CardHeader className="px-4 py-3 border-b border-border/60 bg-muted/10">
        <CardTitle className="text-base">Matriz CYB001</CardTitle>
        <CardDescription className="text-xs">
          Tabla editable · filtros por columna · exportar CSV o Excel · Gemini, consolidar y sync
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <VulnConsolidatedMatrixPanel />
      </CardContent>
    </Card>
  );
}
