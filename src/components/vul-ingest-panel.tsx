'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  FileSpreadsheet,
  FileCode2,
  Network,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getApiBaseUrl } from '@/lib/api-base';

type SourceKey = 'nessus-csv' | 'acunetix-html' | 'nmap';

type IngestResult = {
  source: string;
  created_count: number;
  finding_ids: string[];
  message?: string | null;
};

const endpoints: Record<
  SourceKey,
  { path: string; accept: Record<string, string[]>; label: string; hint: string }
> = {
  'nessus-csv': {
    path: '/api/v1/ingest/nessus-csv',
    accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.csv'] },
    label: 'Nessus / Tenable (CSV)',
    hint: 'Export CSV desde Nessus (plugin results).',
  },
  'acunetix-html': {
    path: '/api/v1/ingest/acunetix-html',
    accept: { 'text/html': ['.html', '.htm'] },
    label: 'Acunetix (HTML)',
    hint: 'Informe HTML con tabla de alertas (vulnerabilidad, severidad, URL…).',
  },
  nmap: {
    path: '/api/v1/ingest/nmap',
    accept: {
      'text/xml': ['.xml'],
      'application/xml': ['.xml'],
      'text/plain': ['.nmap', '.gnmap', '.txt'],
    },
    label: 'Nmap (XML / GNMAP / texto)',
    hint: 'Salida -oX (.xml), .gnmap o resultado en consola guardado en archivo.',
  },
};

function IngestDropCard({
  source,
  icon: Icon,
  engagementId,
}: {
  source: SourceKey;
  icon: React.ComponentType<{ className?: string }>;
  engagementId: string;
}) {
  const cfg = endpoints[source];
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<IngestResult | null>(null);

  const upload = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      setStatus('uploading');
      setMsg(null);
      setLastResult(null);
      const fd = new FormData();
      fd.append('file', file);
      const eg = engagementId.trim();
      if (eg) fd.append('engagement_id', eg);
      try {
        const res = await fetch(`${getApiBaseUrl()}${cfg.path}`, {
          method: 'POST',
          body: fd,
        });
        const data = (await res.json().catch(() => ({}))) as IngestResult & { detail?: unknown };
        if (!res.ok) {
          const detail =
            typeof data.detail === 'string'
              ? data.detail
              : Array.isArray(data.detail)
                ? data.detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join('; ')
                : res.statusText;
          setStatus('error');
          setMsg(detail || 'Error en ingesta');
          return;
        }
        setStatus('done');
        setLastResult(data);
        setMsg(data.message ?? null);
      } catch (e) {
        setStatus('error');
        setMsg(e instanceof Error ? e.message : 'No se pudo conectar al API. ¿Está FastAPI en 8000?');
      }
    },
    [cfg.path, engagementId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => void upload(files),
    accept: cfg.accept,
    maxFiles: 1,
    multiple: false,
    disabled: status === 'uploading',
  });

  return (
    <Card className="bg-slate-950/50 border-slate-800 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-100 flex items-center gap-2">
          <Icon className="size-4 text-violet-300 shrink-0" />
          {cfg.label}
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">{cfg.hint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          {...getRootProps()}
          className={cn(
            'rounded-lg border border-dashed px-4 py-8 text-center text-xs cursor-pointer transition-colors',
            isDragActive ? 'border-violet-400 bg-violet-500/10' : 'border-slate-700 hover:border-slate-500',
            status === 'uploading' && 'opacity-60 pointer-events-none'
          )}
        >
          <input {...getInputProps()} />
          {status === 'uploading' ? (
            <span className="inline-flex items-center gap-2 text-slate-400">
              <Loader2 className="size-4 animate-spin" />
              Subiendo…
            </span>
          ) : (
            <span className="text-slate-400">Arrastra un archivo o haz clic para elegir.</span>
          )}
        </div>
        {status === 'done' && lastResult && (
          <p className="text-xs text-emerald-400/90 flex items-start gap-1.5">
            <CheckCircle2 className="size-3.5 shrink-0 mt-0.5" />
            <span>
              Creados: <strong>{lastResult.created_count}</strong> hallazgos
              {lastResult.finding_ids?.length ? ` (ids en respuesta API).` : ''}
              {msg ? ` — ${msg}` : ''}
            </span>
          </p>
        )}
        {status === 'error' && msg && (
          <p className="text-xs text-rose-400 flex items-start gap-1.5">
            <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
            {msg}
          </p>
        )}
        {status !== 'idle' && (
          <Button type="button" variant="ghost" size="sm" className="text-xs h-8" onClick={() => setStatus('idle')}>
            Limpiar estado
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function VulIngestPanel() {
  const [engagementId, setEngagementId] = useState('');

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs text-slate-500">Engagement (opcional)</label>
          <Input
            placeholder="UUID de engagement en PostgreSQL"
            value={engagementId}
            onChange={(e) => setEngagementId(e.target.value)}
            className="bg-slate-950 border-slate-800 text-slate-200 text-sm font-mono h-9"
          />
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <IngestDropCard source="nessus-csv" icon={FileSpreadsheet} engagementId={engagementId} />
        <IngestDropCard source="acunetix-html" icon={FileCode2} engagementId={engagementId} />
        <IngestDropCard source="nmap" icon={Network} engagementId={engagementId} />
      </div>
    </div>
  );
}
