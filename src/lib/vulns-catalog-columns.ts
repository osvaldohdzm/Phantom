export const VULNS_CATALOG_SELECT_COLUMNS = [
  "Id",
  "StandardVulnerabilityName",
  "Vulnerability",
  "Severity",
  "SourceDetection",
  "CVE",
  "CWE",
  "CVSSOverallScore3_1",
  "Description",
  "Danger",
  "Solution",
  "EspNombreVulnerabilidadUnificado",
  "EspSeveridadUnificada",
  "EspDescripcionUnificada",
  "EspAmenazaUnificadaGeneral",
  "EspPropuestaRemediacionUnificada",
] as const;

export const VULNS_CATALOG_EDITABLE_COLUMNS = [
  "StandardVulnerabilityName",
  "Vulnerability",
  "Severity",
  "SourceDetection",
  "Description",
  "Danger",
  "Solution",
  "EspNombreVulnerabilidadUnificado",
  "EspSeveridadUnificada",
  "EspDescripcionUnificada",
  "EspAmenazaUnificadaGeneral",
  "EspPropuestaRemediacionUnificada",
  "CVE",
  "CWE",
] as const;

export type VulnsCatalogEditableColumn = (typeof VULNS_CATALOG_EDITABLE_COLUMNS)[number];
