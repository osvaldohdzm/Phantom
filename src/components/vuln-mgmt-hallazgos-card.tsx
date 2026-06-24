'use client';

import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUiT } from '@/lib/use-ui-locale';

const VulnConsolidatedMatrixPanel = dynamic(
  () =>
    import('@/components/vuln-consolidated-matrix-panel').then((m) => m.VulnConsolidatedMatrixPanel),
  { ssr: false }
);

export function VulnMgmtHallazgosCard() {
  const { t } = useUiT();

  return (
    <Card className="overflow-hidden p-0 gap-0 border-violet-500/15 shadow-md">
      <CardHeader className="px-4 py-3 border-b border-border/60 bg-muted/10">
        <CardTitle className="text-base">{t('matrixTitle')}</CardTitle>
        <CardDescription className="text-xs">{t('matrixDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <VulnConsolidatedMatrixPanel />
      </CardContent>
    </Card>
  );
}
