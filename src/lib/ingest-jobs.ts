import { resolveApiUrl } from '@/lib/api-base';
import { authHeaders } from '@/lib/auth-storage';

export type IngestJobStatus =
  | 'queued'
  | 'parsing'
  | 'enriching'
  | 'persisting'
  | 'completed'
  | 'failed';

export type IngestJob = {
  id: string;
  kind: string;
  status: IngestJobStatus;
  tenant_id: string;
  engagement_id?: string | null;
  filename?: string | null;
  file_sha256?: string | null;
  file_size?: number | null;
  progress_pct: number;
  message?: string | null;
  error?: string | null;
  parser_engine?: string | null;
  result?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
};

export type IngestStackStatus = {
  ingest_go_url?: string | null;
  parse_rust_url?: string | null;
  ingest_go_healthy?: boolean | null;
  parse_rust_healthy?: boolean | null;
  fallback: string;
};

export type IngestBatchWithJob = {
  source: string;
  created_count: number;
  finding_ids?: string[];
  message?: string | null;
  job_id?: string | null;
  async_mode?: boolean;
};

const JOB_PHASE_ES: Record<IngestJobStatus, string> = {
  queued: 'En cola',
  parsing: 'Parseando escaneo',
  enriching: 'Enriqueciendo catálogo',
  persisting: 'Guardando hallazgos',
  completed: 'Completado',
  failed: 'Error',
};

const JOB_PHASE_EN: Record<IngestJobStatus, string> = {
  queued: 'Queued',
  parsing: 'Parsing scan',
  enriching: 'Catalog enrichment',
  persisting: 'Saving findings',
  completed: 'Completed',
  failed: 'Failed',
};

export function ingestJobPhaseLabel(
  status: IngestJobStatus,
  locale: 'es' | 'en' = 'es',
  parserEngine?: string | null
): string {
  const base = locale === 'en' ? JOB_PHASE_EN[status] : JOB_PHASE_ES[status];
  if (status === 'parsing' && parserEngine) {
    return `${base} (${parserEngine})`;
  }
  return base;
}

export async function fetchIngestJob(jobId: string): Promise<IngestJob> {
  const res = await fetch(resolveApiUrl(`/api/v1/ingest/jobs/${jobId}`), {
    headers: authHeaders(),
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as IngestJob & { detail?: unknown };
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : res.statusText;
    throw new Error(detail || `Error ${res.status}`);
  }
  return data;
}

export async function fetchIngestStack(): Promise<IngestStackStatus> {
  const res = await fetch(resolveApiUrl('/api/v1/ingest/stack'), {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('No se pudo consultar el stack de parseo');
  }
  return (await res.json()) as IngestStackStatus;
}

export async function pollIngestJobUntilDone(
  jobId: string,
  options?: {
    intervalMs?: number;
    onUpdate?: (job: IngestJob) => void;
    signal?: AbortSignal;
  }
): Promise<IngestJob> {
  const intervalMs = options?.intervalMs ?? 1500;
  while (true) {
    if (options?.signal?.aborted) {
      throw new Error('Operación cancelada');
    }
    const job = await fetchIngestJob(jobId);
    options?.onUpdate?.(job);
    if (job.status === 'completed' || job.status === 'failed') {
      if (job.status === 'failed') {
        throw new Error(job.error || job.message || 'La ingesta falló');
      }
      return job;
    }
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(resolve, intervalMs);
      options?.signal?.addEventListener(
        'abort',
        () => {
          window.clearTimeout(timer);
          reject(new Error('Operación cancelada'));
        },
        { once: true }
      );
    });
  }
}

export function isAsyncIngestResponse(
  data: IngestBatchWithJob
): data is IngestBatchWithJob & { job_id: string; async_mode: true } {
  return Boolean(data.async_mode && data.job_id);
}

export type RescanJobResult = {
  scan_run_id?: string;
  scope?: string;
  absent_policy?: string;
  new_count?: number;
  updated_count?: number;
  reaparecido_count?: number;
  absent_count?: number;
  total_in_scan?: number;
  message?: string;
};

export function rescanResultFromJob(job: IngestJob): RescanJobResult | null {
  const r = job.result;
  if (!r || typeof r !== 'object') return null;
  return r as RescanJobResult;
}
