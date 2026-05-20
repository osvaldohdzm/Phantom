/** Base URL del API FastAPI (sin barra final). */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (fromEnv?.trim()) return fromEnv.replace(/\/$/, '');
  return 'http://127.0.0.1:8000';
}
