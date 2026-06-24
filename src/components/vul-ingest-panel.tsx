'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { postIngestMultipart, shouldCacheNessusForMap, LARGE_INGEST_BYTES } from '@/lib/ingest-upload';
import { estimateIngestSeconds } from '@/lib/eta-progress';
import { LongTaskProgress } from '@/components/long-task-progress';
import { engagementLabel } from '@/lib/default-engagement';
import { useProjectSelection } from '@/lib/use-project-selection';
import { UniversalCsvIngestPanel } from '@/components/universal-csv-ingest-panel';
import { appendNessusFileToCache } from '@/lib/exposure-report';
import Link from 'next/link';
import {
  appendAssetScopeToFormData,
  IngestAssetScopeFields,
  type IngestAssetScope,
} from '@/components/ingest-asset-scope-fields';

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
  importScope,
  onComplete,
}: {
  source: SourceKey;
  icon: React.ComponentType<{ className?: string }>;
  engagementId: string;
  importScope: IngestAssetScope;
  onComplete?: (result: IngestResult) => void;
}) {
  const cfg = endpoints[source];
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<IngestResult | null>(null);
  const [fileOutcomes, setFileOutcomes] = useState<FileIngestOutcome[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [uploadStartedAt, setUploadStartedAt] = useState<number | null>(null);
  const [uploadElapsedSec, setUploadElapsedSec] = useState(0);
  const [largeUpload, setLargeUpload] = useState(false);
  const [activeFile, setActiveFile] = useState<{ name: string; size: number } | null>(null);
  const [ingestEstimateSec, setIngestEstimateSec] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (status !== 'uploading' || uploadStartedAt === null) return;
    const tick = () => setUploadElapsedSec(Math.floor((Date.now() - uploadStartedAt) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [status, uploadStartedAt]);

  const upload = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setStatus('uploading');
      setMsg(null);
      setLastResult(null);
      setFileOutcomes([]);
      setUploadStartedAt(Date.now());
      setUploadElapsedSec(0);
      const isLarge = files.some((f) => f.size >= LARGE_INGEST_BYTES);
      setLargeUpload(isLarge);
      setIngestEstimateSec(
        isLarge ? Math.max(...files.map((f) => estimateIngestSeconds(f.size))) : undefined
      );
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
        setActiveFile({ name: file.name, size: file.size });
        setUploadProgress({ current: i + 1, total: files.length });

        const fd = new FormData();
        fd.append('file', file);
        fd.append('engagement_id', eg);
        appendAssetScopeToFormData(fd, importScope);

        try {
          const res = await postIngestMultipart(cfg.path, fd);
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
          if (source === 'nessus-csv' && shouldCacheNessusForMap(file)) {
            try {
              void appendNessusFileToCache(file, { engagementId: eg, title: file.name });
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
      setUploadStartedAt(null);
      setActiveFile(null);
      setIngestEstimateSec(undefined);

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
    [cfg.path, engagementId, importScope, onComplete, source]
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
            status === 'uploading' && 'pointer-events-none border-violet-500/40'
          )}
        >
          <input {...getInputProps()} />
          {status === 'uploading' ? (
            <span className="text-muted-foreground">Procesando en servidor…</span>
          ) : (
            <span className="text-muted-foreground">
              Arrastra uno o varios archivos, o haz clic para elegir.
            </span>
          )}
        </div>
        {status === 'uploading' ? (
          <LongTaskProgress
            title={largeUpload ? 'Ingesta CSV grande' : 'Importando archivo'}
            phase={
              activeFile
                ? `${activeFile.name}${uploadProgress && uploadProgress.total > 1 ? ` (${uploadProgress.current}/${uploadProgress.total})` : ''}`
                : cfg.label
            }
            loaded={uploadProgress?.current}
            total={uploadProgress && uploadProgress.total > 1 ? uploadProgress.total : 0}
            elapsedSec={uploadElapsedSec}
            estimatedTotalSec={ingestEstimateSec}
            hint={
              largeUpload
                ? 'Parseo, catálogo y persistencia en backend (:8000). CSV 50k+ filas puede tardar varios minutos.'
                : 'Subida y procesamiento en el servidor FastAPI.'
            }
          />
        ) : null}
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
  onlySource,
  importScope: externalImportScope,
}: {
  engagementId?: string;
  onIngestComplete?: (result: IngestResult) => void;
  /** Solo muestra un tipo de ingesta (p. ej. AV Infra primer escaneo). */
  onlySource?: SourceKey;
  importScope?: IngestAssetScope;
} = {}) {
  const {
    engagements,
    engagementId: selectedId,
    setEngagementId,
    loading: loadingProjects,
  } = useProjectSelection(externalEngagementId ?? '');
  const engagementId = externalEngagementId ?? selectedId;
  const activeProject = engagements.find((e) => e.id === engagementId);
  const [localImportScope, setLocalImportScope] = useState<IngestAssetScope>({
    assetGroup: '',
    assetSubgroup: '',
  });
  const importScope = externalImportScope ?? localImportScope;

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
      {!externalImportScope ? (
        <IngestAssetScopeFields value={localImportScope} onChange={setLocalImportScope} compact />
      ) : null}
      <p className="text-[10px] text-muted-foreground -mt-2">
        Los hallazgos quedan en borrador del servicio hasta confirmar en{' '}
        <strong className="font-medium text-foreground">Revisión por tipo → Cargar a gestión</strong>.
      </p>
      <div
        className={cn(
          'grid gap-4',
          onlySource ? 'max-w-xl' : 'md:grid-cols-2 lg:grid-cols-4'
        )}
      >
        {(!onlySource || onlySource === 'nessus-csv') && (
        <IngestDropCard
          source="nessus-csv"
          icon={FileSpreadsheet}
          engagementId={engagementId}
          importScope={importScope}
          onComplete={onIngestComplete}
        />
        )}
        {(!onlySource || onlySource === 'acunetix-html') && (
        <IngestDropCard
          source="acunetix-html"
          icon={FileCode2}
          engagementId={engagementId}
          importScope={importScope}
          onComplete={onIngestComplete}
        />
        )}
        {(!onlySource || onlySource === 'nmap') && (
        <IngestDropCard
          source="nmap"
          icon={Network}
          engagementId={engagementId}
          importScope={importScope}
          onComplete={onIngestComplete}
        />
        )}
        {!onlySource && (
        <UniversalCsvIngestPanel
          engagementId={engagementId}
          importScope={importScope}
          onComplete={onIngestComplete}
        />
        )}
      </div>
    </div>
  );
}
