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

/** Rutas de ingesta multipart (usan route handler server-side, no rewrite). */
const INGEST_PATHS = new Set([
  '/api/v1/ingest/nessus-csv',
  '/api/v1/ingest/acunetix-html',
  '/api/v1/ingest/nmap',
  '/api/v1/ingest/universal-csv',
]);

/**
 * Resuelve URL de ingesta: mismo origen vía `/api/secops/ingest/*` (route handler sin límite 10 MB).
 */
export function resolveIngestApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined' && INGEST_PATHS.has(normalized)) {
    const suffix = normalized.slice(API_V1.length + '/ingest'.length);
    return `${window.location.origin}/api/secops/ingest${suffix}`;
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
