'use client';

import { useState } from 'react';
import Link from 'next/link';
import { VulIngestPanel } from '@/components/vul-ingest-panel';
import { VulRescanPanel } from '@/components/vul-rescan-panel';
import { IngestAssetScopeFields, type IngestAssetScope } from '@/components/ingest-asset-scope-fields';
import { cn } from '@/lib/utils';

type AvIngestMode = 'first' | 'rescan';

export function AvInfraIngestPanel({
  engagementId,
  onComplete,
}: {
  engagementId: string;
  onComplete?: () => void;
}) {
  const [mode, setMode] = useState<AvIngestMode>('first');
  const [importScope, setImportScope] = useState<IngestAssetScope>({
    assetGroup: '',
    assetSubgroup: '',
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode('first')}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
            mode === 'first'
              ? 'border-emerald-600 bg-emerald-600/10 text-emerald-800 dark:text-emerald-200'
              : 'border-border text-muted-foreground hover:bg-muted/50'
          )}
        >
          Primer escaneo
        </button>
        <button
          type="button"
          onClick={() => setMode('rescan')}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
            mode === 'rescan'
              ? 'border-emerald-600 bg-emerald-600/10 text-emerald-800 dark:text-emerald-200'
              : 'border-border text-muted-foreground hover:bg-muted/50'
          )}
        >
          Re-escaneo (comparación)
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed rounded-md border border-border/60 bg-muted/30 px-3 py-2">
        {mode === 'first' ? (
          <>
            Carga inicial del CSV Nessus al repositorio del servicio. Usa este modo en la primera
            importación de la campaña.
          </>
        ) : (
          <>
            Compara el CSV con hallazgos ya registrados: actualiza <span className="text-foreground">last_seen</span>
            , marca ausentes y reaparecidas sin duplicar filas.
          </>
        )}
      </p>

      <p className="text-[10px] text-muted-foreground/90 italic">
        Tip: archivos muy pesados (&gt;50 MB) — para el mapa de exposición sin esperar al servidor,
        usa{' '}
        <Link href="/tools/exposure" className="underline text-foreground/80">
          Network Exposure Live Report
        </Link>{' '}
        (procesa en el navegador).
      </p>

      <IngestAssetScopeFields value={importScope} onChange={setImportScope} />

      {mode === 'first' ? (
        <VulIngestPanel
          engagementId={engagementId}
          onlySource="nessus-csv"
          importScope={importScope}
          onIngestComplete={() => onComplete?.()}
        />
      ) : (
        <VulRescanPanel
          engagementId={engagementId}
          hideProjectPicker
          embedded
          importScope={importScope}
          onComplete={onComplete}
        />
      )}
    </div>
  );
}
