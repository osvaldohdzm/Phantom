import type { Engagement } from '@/lib/secops-api';

/** Nombre interno del espacio técnico del tenant (no es un servicio listable). */
export const DEFAULT_SERVICE_NAME = 'Espacio del tenant';

/** @deprecated use DEFAULT_SERVICE_NAME */
export const DEFAULT_PROJECT_NAME = DEFAULT_SERVICE_NAME;

const LEGACY_DEFAULT_NAMES = new Set([
  DEFAULT_SERVICE_NAME,
  'Proyecto Default',
  'Servicio Default',
]);

/** Espacio interno del tenant — existe en BD pero no debe mostrarse como servicio/proyecto. */
export function isDefaultEngagement(eg: Engagement): boolean {
  const profile = eg.profile as { is_default?: boolean } | undefined;
  if (profile?.is_default) return true;
  const name = (eg.nombre_proyecto || '').trim();
  return LEGACY_DEFAULT_NAMES.has(name);
}

/** Servicios/proyectos visibles para el usuario (excluye el espacio interno). */
export function filterUserEngagements(engagements: Engagement[]): Engagement[] {
  return engagements.filter((eg) => !isDefaultEngagement(eg));
}

/** Primer servicio real del tenant, si existe. */
export function pickFirstUserEngagement(engagements: Engagement[]): Engagement | null {
  return filterUserEngagements(engagements)[0] ?? null;
}

/**
 * @deprecated El espacio interno ya no se preselecciona. Usa pickFirstUserEngagement.
 */
export function pickDefaultEngagement(engagements: Engagement[]): Engagement | null {
  return pickFirstUserEngagement(engagements);
}

export function engagementLabel(eg: Engagement): string {
  return eg.nombre_proyecto || eg.cliente;
}

export function serviceTypeLabel(eg: Engagement): string {
  return eg.tipo_servicio?.trim() || 'Sin tipo';
}
