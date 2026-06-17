import type { Engagement } from '@/lib/secops-api';

export const DEFAULT_SERVICE_NAME = 'Servicio Default';

/** @deprecated use DEFAULT_SERVICE_NAME */
export const DEFAULT_PROJECT_NAME = DEFAULT_SERVICE_NAME;

export function isDefaultEngagement(eg: Engagement): boolean {
  const profile = eg.profile as { is_default?: boolean } | undefined;
  if (profile?.is_default) return true;
  const name = (eg.nombre_proyecto || '').trim();
  return name === DEFAULT_SERVICE_NAME || name === 'Proyecto Default';
}

export function pickDefaultEngagement(engagements: Engagement[]): Engagement | null {
  if (!engagements.length) return null;
  const marked = engagements.find(isDefaultEngagement);
  if (marked) return marked;
  return engagements[0] ?? null;
}

export function engagementLabel(eg: Engagement): string {
  const name = eg.nombre_proyecto || eg.cliente;
  return isDefaultEngagement(eg) ? `${name} (predeterminado)` : name;
}

export function serviceTypeLabel(eg: Engagement): string {
  return eg.tipo_servicio?.trim() || 'Sin tipo';
}
