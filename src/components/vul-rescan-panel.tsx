'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileSpreadsheet, Loader2, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { resolveIngestApiUrl } from '@/lib/api-base';
import { authHeaders } from '@/lib/auth-storage';
import { engagementLabel } from '@/lib/default-engagement';
import { useProjectSelection } from '@/lib/use-project-selection';
import { appendNessusFileToCache } from '@/lib/exposure-report';
import Link from 'next/link';

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
}: {
  onComplete?: () => void;
  engagementId?: string;
  hideProjectPicker?: boolean;
}) {
  const { engagements, engagementId: selectedId, setEngagementId, loading: loadingProjects } =
    useProjectSelection();
  const engagementId = engagementIdProp?.trim() || selectedId;
  const [scope, setScope] = useState<'tenant' | 'engagement'>('tenant');
  const [absentPolicy, setAbsentPolicy] = useState<'atendido' | 'remediado'>('atendido');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<RescanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      const form = new FormData();
      form.append('file', file);
      form.append('engagement_id', engagementId);
      form.append('scope', scope);
      form.append('absent_policy', absentPolicy);
      form.append('label', file.name);
      try {
        const res = await fetch(resolveIngestApiUrl('/api/v1/ingest/nessus-csv/rescan'), {
          method: 'POST',
          headers: authHeaders(),
          body: form,
        });
        const data = (await res.json()) as RescanResult & { detail?: string };
        if (!res.ok) throw new Error(data.detail ?? res.statusText);
        try {
          await appendNessusFileToCache(file, { engagementId, title: file.name });
        } catch {
          /* mapa opcional */
        }
        setResult(data);
        setStatus('done');
        onComplete?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al procesar re-escaneo');
        setStatus('error');
      }
    },
    [engagementId, scope, absentPolicy, onComplete]
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
      <CardContent className="space-y-3">
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
            <Loader2 className="size-8 mx-auto animate-spin text-muted-foreground" />
          ) : (
            <FileSpreadsheet className="size-8 mx-auto text-emerald-600/80" />
          )}
          <p className="text-sm mt-2 font-medium">Soltar CSV Nessus de re-escaneo</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            No duplica hallazgos: usa huella plugin+activo / CVE+activo · hasta 150 MB
          </p>
        </div>

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
      </CardContent>
    </Card>
  );
}
