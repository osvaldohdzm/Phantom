'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileSpreadsheet, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { postIngestMultipart, shouldCacheNessusForMap, LARGE_INGEST_BYTES } from '@/lib/ingest-upload';
import { estimateIngestSeconds } from '@/lib/eta-progress';
import { LongTaskProgress } from '@/components/long-task-progress';
import { engagementLabel } from '@/lib/default-engagement';
import { useProjectSelection } from '@/lib/use-project-selection';
import { appendNessusFileToCache } from '@/lib/exposure-report';
import Link from 'next/link';
import { appendAssetScopeToFormData, type IngestAssetScope } from '@/components/ingest-asset-scope-fields';

type RescanResult = {
  scan_run_id: string;
  new_count: number;
  updated_count: number;
  reaparecido_count: number;
  absent_count: number;
  total_in_scan: number;
  scope: string;
  absent_policy: string;
  message?: string | null;
};

export function VulRescanPanel({
  onComplete,
  engagementId: engagementIdProp,
  hideProjectPicker,
  embedded,
  importScope,
}: {
  onComplete?: () => void;
  engagementId?: string;
  hideProjectPicker?: boolean;
  /** Sin Card exterior (dentro de AvInfraIngestPanel). */
  embedded?: boolean;
  importScope?: IngestAssetScope;
}) {
  const { engagements, engagementId: selectedId, setEngagementId, loading: loadingProjects } =
    useProjectSelection();
  const engagementId = engagementIdProp?.trim() || selectedId;
  const [scope, setScope] = useState<'tenant' | 'engagement'>('tenant');
  const [absentPolicy, setAbsentPolicy] = useState<'atendido' | 'remediado'>('atendido');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<RescanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [estimateSec, setEstimateSec] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (status !== 'uploading') return;
    const id = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  const upload = useCallback(
    async (file: File) => {
      if (!engagementId) {
        setError('Selecciona un proyecto/campaña de escaneo.');
        setStatus('error');
        return;
      }
      setStatus('uploading');
      setError(null);
      setResult(null);
      setActiveFile(file);
      setElapsedSec(0);
      setEstimateSec(file.size >= LARGE_INGEST_BYTES ? estimateIngestSeconds(file.size) : 180);
      const form = new FormData();
      form.append('file', file);
      form.append('engagement_id', engagementId);
      form.append('scope', scope);
      form.append('absent_policy', absentPolicy);
      form.append('label', file.name);
      if (importScope) appendAssetScopeToFormData(form, importScope);
      try {
        const res = await postIngestMultipart('/api/v1/ingest/nessus-csv/rescan', form);
        const data = (await res.json()) as RescanResult & { detail?: string };
        if (!res.ok) throw new Error(data.detail ?? res.statusText);
        if (shouldCacheNessusForMap(file)) {
          try {
            void appendNessusFileToCache(file, { engagementId, title: file.name });
          } catch {
            /* mapa opcional */
          }
        }
        setResult(data);
        setStatus('done');
        onComplete?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al procesar re-escaneo');
        setStatus('error');
      } finally {
        setActiveFile(null);
        setEstimateSec(undefined);
      }
    },
    [engagementId, scope, absentPolicy, importScope, onComplete]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
    disabled: status === 'uploading' || !engagementId,
    onDrop: (files) => {
      const f = files[0];
      if (f) void upload(f);
    },
  });

  const inner = (
    <>
      <div className="flex flex-wrap gap-2 items-end">
          {!hideProjectPicker && !engagementIdProp ? (
          <label className="text-xs space-y-1">
            <span className="text-muted-foreground">Proyecto / campaña</span>
            <select
              className="block h-8 min-w-[12rem] rounded-md border border-input bg-background px-2 text-xs"
              value={engagementId ?? ''}
              disabled={loadingProjects}
              onChange={(e) => setEngagementId(e.target.value)}
            >
              <option value="">— Seleccionar —</option>
              {engagements.map((e) => (
                <option key={e.id} value={e.id}>
                  {engagementLabel(e)}
                  {e.tipo_servicio ? ` · ${e.tipo_servicio}` : ''}
                </option>
              ))}
            </select>
          </label>
          ) : null}

          <label className="text-xs space-y-1">
            <span className="text-muted-foreground">Alcance comparación</span>
            <select
              className="block h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={scope}
              onChange={(e) => setScope(e.target.value as 'tenant' | 'engagement')}
            >
              <option value="tenant">Todo el tenant (repositorio)</option>
              <option value="engagement">Solo este proyecto</option>
            </select>
          </label>

          <label className="text-xs space-y-1">
            <span className="text-muted-foreground">Si no aparece en el scan</span>
            <select
              className="block h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={absentPolicy}
              onChange={(e) => setAbsentPolicy(e.target.value as 'atendido' | 'remediado')}
            >
              <option value="atendido">Atendido (mitigado / en revisión)</option>
              <option value="remediado">Remediado (corregido)</option>
            </select>
          </label>
        </div>

        <div
          {...getRootProps()}
          className={cn(
            'rounded-lg border border-dashed p-6 text-center cursor-pointer transition-colors',
            isDragActive ? 'border-emerald-500 bg-emerald-500/5' : 'border-border hover:bg-muted/30',
            (status === 'uploading' || !engagementId) && 'opacity-60 pointer-events-none'
          )}
        >
          <input {...getInputProps()} />
          {status === 'uploading' ? (
            <span className="text-sm text-muted-foreground">Comparando con repositorio…</span>
          ) : (
            <FileSpreadsheet className="size-8 mx-auto text-emerald-600/80" />
          )}
          <p className="text-sm mt-2 font-medium">Soltar CSV Nessus</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Comparación por huella plugin+activo / CVE+activo · hasta 150 MB
          </p>
        </div>

        {status === 'uploading' ? (
          <LongTaskProgress
            title="Re-escaneo AV (Nessus)"
            phase={activeFile?.name ?? 'Procesando CSV'}
            elapsedSec={elapsedSec}
            estimatedTotalSec={estimateSec}
            hint="Compara filas del CSV con el repositorio: nuevas, actualizadas, reaparecidas y ausentes."
          />
        ) : null}

        {status === 'done' && result ? (
          <div className="flex items-start gap-2 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
            <div>
              <p>{result.message}</p>
              <p className="text-muted-foreground mt-1 tabular-nums">
                Scan: {result.total_in_scan} filas · nuevas {result.new_count} · actualizadas{' '}
                {result.updated_count} · reaparecidas {result.reaparecido_count} · ausentes{' '}
                {result.absent_count}
              </p>
              <p className="mt-1">
                <Link href="/vul-mgmt/mapa" className="underline font-medium">
                  Ver mapa de exposición
                </Link>
              </p>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="size-4" />
            {error}
          </div>
        ) : null}

        {status === 'done' ? (
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setStatus('idle')}>
            Subir otro archivo
          </Button>
        ) : null}
    </>
  );

  if (embedded) {
    return <div className="space-y-3">{inner}</div>;
  }

  return (
    <Card className="border-emerald-500/20">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <RefreshCw className="size-4 text-emerald-600" />
          Re-escaneo AV (Nessus)
        </CardTitle>
        <CardDescription className="text-xs">
          Compara el CSV con el repositorio de vulnerabilidades: actualiza{' '}
          <span className="text-foreground">last_seen</span>, marca ausentes como Atendido o
          Remediado, y reaparecidas sin crear fila nueva.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">{inner}</CardContent>
    </Card>
  );
}
