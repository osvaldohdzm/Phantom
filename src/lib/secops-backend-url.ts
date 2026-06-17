/** URL del API FastAPI usado por route handlers server-side (no expuesto al navegador). */
export function getBackendRootUrl(): string {
  return (process.env.API_PROXY_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
}

export function getBackendApiV1Url(): string {
  return `${getBackendRootUrl()}/api/v1`;
}
