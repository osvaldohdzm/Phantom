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

/** Activa cola async en el servidor para archivos grandes (Nessus / Nmap). */
export function appendAsyncIngestIfLarge(form: FormData, file: File): boolean {
  if (file.size >= LARGE_INGEST_BYTES) {
    form.append('async_mode', 'true');
    return true;
  }
  return false;
}

export async function postMultipartUpload(apiPath: string, form: FormData): Promise<Response> {
  const { resolveMultipartUploadUrl } = await import('@/lib/api-base');
  const url = resolveMultipartUploadUrl(apiPath);
  return fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
}
