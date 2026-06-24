/** Rastrea navegación SecOps para reiniciar el flujo de servicios al reentrar. */

const LAST_PATH_KEY = 'spectre-secops-last-path';

export function markSecOpsPath(pathname: string): void {
  if (typeof window === 'undefined' || !pathname) return;
  sessionStorage.setItem(LAST_PATH_KEY, pathname);
}

/** true si el usuario venía de otra sección (no /reports). */
export function isReportsReentry(pathname: string): boolean {
  if (typeof window === 'undefined' || pathname !== '/reports') return false;
  const last = sessionStorage.getItem(LAST_PATH_KEY) ?? '';
  return last !== '' && !last.startsWith('/reports');
}
