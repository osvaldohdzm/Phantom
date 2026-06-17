/** IDs de columnas Español del catálogo (sin dependencias de config/IA). */

export const CATALOG_SPANISH_CONTEXT_FIELDS = [
  'EspNombreVulnerabilidadUnificado',
  'EspSeveridadUnificada',
  'EspDescripcionUnificada',
  'EspAmenazaUnificadaGeneral',
  'EspAmenazaUnificadaDesdeInternet',
  'EspPropuestaRemediacionUnificada',
  'EspPropuestaRemediacionUnificadaEnRedPrivada',
  'EspMetodoDeteccion',
  'EspExplicacionTecnica',
] as const;

export const CATALOG_SPANISH_AI_FIELDS = [
  'EspSeveridadUnificada',
  'EspDescripcionUnificada',
  'EspAmenazaUnificadaGeneral',
  'EspAmenazaUnificadaDesdeInternet',
  'EspPropuestaRemediacionUnificada',
  'EspPropuestaRemediacionUnificadaEnRedPrivada',
  'EspMetodoDeteccion',
  'EspExplicacionTecnica',
] as const;

export type CatalogSpanishAiField = (typeof CATALOG_SPANISH_AI_FIELDS)[number];
