const API_V1 = '/api/v1';

/** Base URL del API FastAPI (sin barra final). En el navegador usa proxy same-origin (/api/secops). */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/secops`;
  }

  const backend = (process.env.API_PROXY_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  return `${backend}${API_V1}`;
}

/** Prefijo de rutas de ingesta multipart. */
const INGEST_API_PREFIX = '/api/v1/ingest/';

const SCAN_IMPORT_PATH = '/api/v1/assets/scan-targets/import';

/**
 * Origen directo al API solo si está configurado explícitamente.
 * En Docker el API no se publica en :8000; además HTTPS→HTTP (:8000) provoca NetworkError.
 */
function explicitBackendOrigin(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.trim();
  if (!fromEnv) return null;
  return fromEnv.replace(/\/$/, '');
}

/**
 * Resuelve URL de ingesta multipart.
 * Por defecto same-origin (/api/secops) para Docker y frontend HTTPS.
 */
export function resolveIngestApiUrl(path: string, _opts?: { fileSize?: number }): string {
  return resolveMultipartUploadUrl(path);
}

/** Multipart grande: ingesta o importación de escaneos → proxy same-origin salvo BACKEND_ORIGIN explícito. */
export function resolveMultipartUploadUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const isMultipart =
    normalized.startsWith(INGEST_API_PREFIX) || normalized === SCAN_IMPORT_PATH;

  if (typeof window !== 'undefined' && isMultipart) {
    const direct = explicitBackendOrigin();
    if (direct) return `${direct}${normalized}`;

    if (normalized.startsWith(INGEST_API_PREFIX)) {
      const rest = normalized.slice(INGEST_API_PREFIX.length);
      return `${window.location.origin}/api/secops/ingest/${rest}`;
    }
    if (normalized === SCAN_IMPORT_PATH) {
      return `${window.location.origin}/api/secops/assets/scan-targets/import`;
    }
  }
  return resolveApiUrl(path);
}

/** Resuelve rutas /api/v1/... al URL final (proxy Next.js o backend directo). */
export function resolveApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const normalized = path.startsWith('/') ? path : `/${path}`;

  if (!normalized.startsWith(API_V1)) {
    return `${base}${normalized}`;
  }

  const suffix = normalized.slice(API_V1.length) || '/';
  if (base.endsWith('/api/secops')) {
    return `${base}${suffix}`;
  }

  const backendRoot = base.replace(/\/api\/v1$/, '');
  return `${backendRoot}${normalized}`;
}

export function resolveHealthUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (fromEnv) return `${fromEnv.replace(/\/$/, '')}/health`;

  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/secops-health`;
  }

  const backend = (process.env.API_PROXY_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  return `${backend}/health`;
}

/** Muestra la URL detectada (útil para depurar Failed to fetch). */
export function getApiBaseUrlLabel(): string {
  return getApiBaseUrl();
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch(resolveHealthUrl(), { cache: 'no-store' });
    if (!res.ok) return false;
    const data = (await res.json()) as { status?: string };
    return data.status === 'ok';
  } catch {
    return false;
  }
}
