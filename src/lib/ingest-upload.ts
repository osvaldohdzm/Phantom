import { resolveIngestApiUrl } from '@/lib/api-base';
import { authHeaders } from '@/lib/auth-storage';

/** CSV Nessus muy grandes: no parsear en el navegador para el mapa (usa Network Exposure). */
export const NESSUS_MAP_CACHE_MAX_BYTES = 12 * 1024 * 1024;

/** Umbral para mensaje de procesamiento largo en servidor. */
export const LARGE_INGEST_BYTES = 5 * 1024 * 1024;

export function shouldCacheNessusForMap(file: File): boolean {
  return file.size <= NESSUS_MAP_CACHE_MAX_BYTES;
}

export async function postIngestMultipart(apiPath: string, form: FormData): Promise<Response> {
  const url = resolveIngestApiUrl(apiPath);
  return fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
}
