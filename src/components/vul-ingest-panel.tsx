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
import { cn } from '@/lib/utils';
import { resolveIngestApiUrl } from '@/lib/api-base';
import { authHeaders } from '@/lib/auth-storage';
import { engagementLabel } from '@/lib/default-engagement';
import { useProjectSelection } from '@/lib/use-project-selection';
import { UniversalCsvIngestPanel } from '@/components/universal-csv-ingest-panel';
import { appendNessusFileToCache } from '@/lib/exposure-report';
import Link from 'next/link';

type SourceKey = 'nessus-csv' | 'acunetix-html' | 'nmap';

type IngestResult = {
  source: string;
  created_count: number;
  finding_ids: string[];
  message?: string | null;
};

type FileIngestOutcome = {
  name: string;
  ok: boolean;
  created_count: number;
  error?: string;
};

const endpoints: Record<
  SourceKey,
  { path: string; accept: Record<string, string[]>; label: string; hint: string }
> = {
  'nessus-csv': {
    path: '/api/v1/ingest/nessus-csv',
    accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.csv'] },
    label: 'Nessus / Tenable (CSV)',
    hint: 'Export CSV Nessus (.csv). Los campos se enriquecen desde el catálogo por Plugin ID.',
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
  onComplete,
}: {
  source: SourceKey;
  icon: React.ComponentType<{ className?: string }>;
  engagementId: string;
  onComplete?: (result: IngestResult) => void;
}) {
  const cfg = endpoints[source];
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<IngestResult | null>(null);
  const [fileOutcomes, setFileOutcomes] = useState<FileIngestOutcome[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  const upload = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setStatus('uploading');
      setMsg(null);
      setLastResult(null);
      setFileOutcomes([]);
      setUploadProgress({ current: 0, total: files.length });

      const eg = engagementId.trim();
      if (!eg) {
        setStatus('error');
        setMsg(
          'Selecciona y guarda un servicio en el paso 1 antes de importar. Los CSV Nessus se cargan en el servicio activo.',
        );
        setUploadProgress(null);
        return;
      }
      const outcomes: FileIngestOutcome[] = [];
      let totalCreated = 0;
      const allFindingIds: string[] = [];

      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        setUploadProgress({ current: i + 1, total: files.length });

        const fd = new FormData();
        fd.append('file', file);
        fd.append('engagement_id', eg);

        try {
          const res = await fetch(resolveIngestApiUrl(cfg.path), {
            method: 'POST',
            headers: authHeaders(),
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
            outcomes.push({
              name: file.name,
              ok: false,
              created_count: 0,
              error: detail || 'Error en ingesta',
            });
            continue;
          }

          totalCreated += data.created_count ?? 0;
          if (data.finding_ids?.length) allFindingIds.push(...data.finding_ids);
          outcomes.push({
            name: file.name,
            ok: true,
            created_count: data.created_count ?? 0,
          });
          if (source === 'nessus-csv') {
            try {
              await appendNessusFileToCache(file, { engagementId: eg, title: file.name });
            } catch {
              /* mapa opcional */
            }
          }
        } catch (e) {
          outcomes.push({
            name: file.name,
            ok: false,
            created_count: 0,
            error:
              e instanceof Error
                ? e.message.includes('hang up') || e.message.includes('Failed to fetch')
                  ? 'No se pudo completar la ingesta. Comprueba que el backend (puerto 8000) esté en marcha y reinicia `npm run dev`.'
                  : e.message
                : 'No se pudo conectar al API',
          });
        }
      }

      setFileOutcomes(outcomes);
      setUploadProgress(null);

      const okCount = outcomes.filter((o) => o.ok).length;
      const failCount = outcomes.length - okCount;

      if (okCount === 0) {
        setStatus('error');
        setMsg(
          outcomes.length === 1
            ? outcomes[0]?.error ?? 'Error en ingesta'
            : `Fallaron los ${outcomes.length} archivos.`,
        );
        return;
      }

      const aggregated: IngestResult = {
        source: cfg.path,
        created_count: totalCreated,
        finding_ids: allFindingIds,
        message:
          files.length > 1
            ? `${okCount} archivo(s) importado(s)${failCount ? `, ${failCount} con error` : ''}.`
            : undefined,
      };

      setStatus('done');
      setLastResult(aggregated);
      setMsg(
        failCount > 0
          ? `${okCount} archivo(s) OK, ${failCount} con error. Total: ${totalCreated} hallazgos.`
          : files.length > 1
            ? `${files.length} archivos importados.`
            : null,
      );
      onComplete?.(aggregated);
    },
    [cfg.path, engagementId, onComplete]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => void upload(files),
    accept: cfg.accept,
    multiple: true,
    disabled: status === 'uploading',
  });

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-foreground flex items-center gap-2">
          <Icon className="size-4 text-primary shrink-0" />
          {cfg.label}
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          {cfg.hint} Puedes arrastrar varios archivos (hasta 150 MB cada uno).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          {...getRootProps()}
          className={cn(
            'rounded-lg border border-dashed px-4 py-8 text-center text-xs cursor-pointer transition-colors',
            isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40 bg-muted/30',
            status === 'uploading' && 'opacity-60 pointer-events-none'
          )}
        >
          <input {...getInputProps()} />
          {status === 'uploading' ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {uploadProgress && uploadProgress.total > 1
                ? `Importando ${uploadProgress.current}/${uploadProgress.total}…`
                : 'Subiendo…'}
            </span>
          ) : (
            <span className="text-muted-foreground">
              Arrastra uno o varios archivos, o haz clic para elegir.
            </span>
          )}
        </div>
        {fileOutcomes.length > 0 && (
          <ul className="text-[11px] space-y-1 max-h-32 overflow-y-auto rounded border border-border bg-muted/40 p-2">
            {fileOutcomes.map((outcome) => (
              <li
                key={outcome.name}
                className={cn(
                  'flex items-start gap-1.5',
                  outcome.ok ? 'text-emerald-700 dark:text-emerald-400/90' : 'text-rose-600 dark:text-rose-400',
                )}
              >
                {outcome.ok ? (
                  <CheckCircle2 className="size-3 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="size-3 shrink-0 mt-0.5" />
                )}
                <span className="min-w-0">
                  <span className="font-mono truncate block">{outcome.name}</span>
                  {outcome.ok ? (
                    <span>{outcome.created_count} hallazgo(s)</span>
                  ) : (
                    <span>{outcome.error}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {status === 'done' && lastResult && (
          <p className="text-xs text-emerald-700 dark:text-emerald-400/90 flex items-start gap-1.5">
            <CheckCircle2 className="size-3.5 shrink-0 mt-0.5" />
            <span>
              Total creados: <strong>{lastResult.created_count}</strong> hallazgos
              {msg ? ` — ${msg}` : ''}
              {source === 'nessus-csv' ? (
                <>
                  {' '}
                  ·{' '}
                  <Link href="/vul-mgmt/mapa" className="underline font-medium">
                    Ver mapa de exposición
                  </Link>
                </>
              ) : null}
            </span>
          </p>
        )}
        {status === 'error' && msg && (
          <p className="text-xs text-rose-600 dark:text-rose-400 flex items-start gap-1.5">
            <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
            {msg}
          </p>
        )}
        {status !== 'idle' && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs h-8"
            onClick={() => {
              setStatus('idle');
              setFileOutcomes([]);
              setUploadProgress(null);
              setMsg(null);
              setLastResult(null);
            }}
          >
            Limpiar estado
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function VulIngestPanel({
  engagementId: externalEngagementId,
  onIngestComplete,
}: {
  engagementId?: string;
  onIngestComplete?: (result: IngestResult) => void;
} = {}) {
  const {
    engagements,
    engagementId: selectedId,
    setEngagementId,
    loading: loadingProjects,
  } = useProjectSelection(externalEngagementId ?? '');
  const engagementId = externalEngagementId ?? selectedId;
  const activeProject = engagements.find((e) => e.id === engagementId);

  return (
    <div className="space-y-4">
      {externalEngagementId ? (
        <p className="text-xs rounded-md border border-sky-500/30 bg-sky-500/8 px-3 py-2 text-sky-900 dark:text-sky-100">
          Importación al servicio activo:{' '}
          <span className="font-mono text-[11px]">{engagementId}</span>
        </p>
      ) : (
        <label className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
          <span className="text-muted-foreground shrink-0">Servicio</span>
          {loadingProjects ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <select
              className="h-9 min-w-[16rem] rounded-md border border-input bg-background px-2 text-sm"
              value={engagementId}
              onChange={(e) => setEngagementId(e.target.value)}
            >
              {engagements.length === 0 ? (
                <option value="">Sin servicios</option>
              ) : null}
              {engagements.map((e) => (
                <option key={e.id} value={e.id}>
                  {engagementLabel(e)}
                  {e.tipo_servicio ? ` · ${e.tipo_servicio}` : ''}
                </option>
              ))}
            </select>
          )}
          {activeProject ? (
            <span className="text-muted-foreground">
              Los hallazgos y CSV se vinculan a este servicio.
            </span>
          ) : null}
        </label>
      )}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <IngestDropCard
          source="nessus-csv"
          icon={FileSpreadsheet}
          engagementId={engagementId}
          onComplete={onIngestComplete}
        />
        <IngestDropCard
          source="acunetix-html"
          icon={FileCode2}
          engagementId={engagementId}
          onComplete={onIngestComplete}
        />
        <IngestDropCard
          source="nmap"
          icon={Network}
          engagementId={engagementId}
          onComplete={onIngestComplete}
        />
        <UniversalCsvIngestPanel engagementId={engagementId} onComplete={onIngestComplete} />
      </div>
    </div>
  );
}
