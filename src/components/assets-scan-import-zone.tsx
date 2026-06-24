'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileSpreadsheet, Loader2, Network, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { importAssetScanTargets } from '@/lib/secops-api';
import { LARGE_INGEST_BYTES } from '@/lib/ingest-upload';
import { LongTaskProgress } from '@/components/long-task-progress';
import { estimateIngestSeconds } from '@/lib/eta-progress';

const ACCEPT = {
  'text/csv': ['.csv'],
  'application/vnd.ms-excel': ['.csv'],
  'text/xml': ['.xml'],
  'application/xml': ['.xml'],
  'text/plain': ['.nmap', '.gnmap', '.txt'],
};

type AssetsScanImportZoneProps = {
  engagementId: string | null;
  onImported: () => void;
};

export function AssetsScanImportZone({ engagementId, onImported }: AssetsScanImportZoneProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [estimateSec, setEstimateSec] = useState(30);

  useEffect(() => {
    if (!busy) return;
    const t = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [busy]);

  const onDrop = useCallback(
    async (files: File[]) => {
      if (!files.length || busy) return;
      setBusy(true);
      setError(null);
      setNotice(null);
      setElapsedSec(0);
      let lastMsg: string | null = null;
      try {
        for (const file of files) {
          setActiveFile(file);
          setEstimateSec(
            estimateIngestSeconds(Math.max(file.size, LARGE_INGEST_BYTES / 10))
          );
          const result = await importAssetScanTargets(file, engagementId ?? undefined);
          lastMsg =
            result.message ??
            `${result.created_count} hallazgos · ${result.discovered} objetivos nuevos`;
        }
        setNotice(lastMsg);
        onImported();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo importar el escaneo');
      } finally {
        setBusy(false);
        setActiveFile(null);
      }
    },
    [busy, engagementId, onImported]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => void onDrop(files),
    accept: ACCEPT,
    disabled: busy,
    multiple: true,
  });

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={cn(
          'rounded-lg border border-dashed px-4 py-5 text-center cursor-pointer transition-colors',
          isDragActive ? 'border-cyan-500/60 bg-cyan-500/10' : 'border-border hover:bg-muted/30',
          busy && 'pointer-events-none opacity-70'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-wrap items-center justify-center gap-3 text-muted-foreground">
          {busy ? (
            <Loader2 className="size-5 animate-spin text-cyan-600" />
          ) : (
            <Upload className="size-5" />
          )}
          <span className="text-xs">
            <strong className="text-foreground">Importar escaneo aquí</strong> — arrastra o haz clic
          </span>
          <span className="inline-flex items-center gap-1 text-[10px]">
            <FileSpreadsheet className="size-3.5" /> Nessus CSV
          </span>
          <span className="inline-flex items-center gap-1 text-[10px]">
            <Network className="size-3.5" /> Nmap XML · GNMAP · TXT
          </span>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground max-w-xl mx-auto leading-snug">
          {engagementId
            ? 'Los hallazgos se asocian al proyecto seleccionado y los hosts aparecen abajo como objetivos pendientes.'
            : 'Sin proyecto: se usa el espacio interno del tenant. Los objetivos se listan en toda la vista global.'}
        </p>
      </div>

      {busy ? (
        <LongTaskProgress
          title="Importando escaneo"
          phase={activeFile?.name ?? 'Procesando archivo'}
          elapsedSec={elapsedSec}
          estimatedTotalSec={estimateSec}
          hint="Procesando en servidor y actualizando objetivos…"
        />
      ) : null}

      {notice ? <p className="text-xs text-emerald-700 dark:text-emerald-400">{notice}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
