/** Columnas del catálogo operativo core.vulns_catalog */

import { VULNS_CATALOG_TOOL_ID_COLUMNS } from '@/lib/catalog-tool-index';

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
  "NessusPluginId",
  ...VULNS_CATALOG_TOOL_ID_COLUMNS.filter((c) => c !== "NessusPluginId"),
  "EspNombreVulnerabilidadUnificado",
  "EspSeveridadUnificada",
  "EspDescripcionUnificada",
  "EspAmenazaUnificadaGeneral",
  "EspAmenazaUnificadaDesdeInternet",
  "EspPropuestaRemediacionUnificada",
  "EspPropuestaRemediacionUnificadaEnRedPrivada",
  "EspMetodoDeteccion",
  "EspExplicacionTecnica",
] as const;

export const VULNS_CATALOG_EDITABLE_COLUMNS = [
  "StandardVulnerabilityName",
  "Vulnerability",
  "Severity",
  "SourceDetection",
  "Description",
  "Danger",
  "Solution",
  "NessusPluginId",
  ...VULNS_CATALOG_TOOL_ID_COLUMNS.filter((c) => c !== "NessusPluginId"),
  "EspNombreVulnerabilidadUnificado",
  "EspSeveridadUnificada",
  "EspDescripcionUnificada",
  "EspAmenazaUnificadaGeneral",
  "EspAmenazaUnificadaDesdeInternet",
  "EspPropuestaRemediacionUnificada",
  "EspPropuestaRemediacionUnificadaEnRedPrivada",
  "EspMetodoDeteccion",
  "EspExplicacionTecnica",
  "CVE",
  "CWE",
] as const;

export const VULNS_CATALOG_DEFAULT_DISPLAY_COLUMNS = [
  "Id",
  "EspNombreVulnerabilidadUnificado",
  "StandardVulnerabilityName",
  "EspSeveridadUnificada",
  "SourceDetection",
  "NessusPluginId",
  "CVE",
  "CWE",
] as const;

export const VULNS_CATALOG_DISPLAY_STORAGE_KEY = "spectre.vulns-catalog.display-columns";

export type VulnsCatalogEditableColumn = (typeof VULNS_CATALOG_EDITABLE_COLUMNS)[number];
export type VulnsCatalogDisplayColumn = (typeof VULNS_CATALOG_DEFAULT_DISPLAY_COLUMNS)[number];

const LABEL_OVERRIDES: Record<string, string> = {
  Id: "Id",
  StandardVulnerabilityName: "Nombre Estándar",
  Vulnerability: "Vulnerabilidad",
  Severity: "Severidad",
  SourceDetection: "Fuente",
  Description: "Descripción",
  Danger: "Peligro/Impacto",
  Solution: "Solución",
  CVE: "CVE",
  CWE: "CWE",
  CVSSOverallScore3_1: "CVSS 3.1",
  NessusPluginId: "Plugin Nessus",
  InvictiName: "Invicti",
  VulnerabilityManagerPlusName: "VMP",
  SonarRuleId: "SonarQube Rule",
  DerScannerName: "DerScanner",
  RoslynatorId: "Roslynator",
  OWASPZAPScanRuleId: "OWASP ZAP Rule",
  AcunetixName: "Acunetix",
  OpenVasNVTId: "OpenVAS NVT",
  NexposeName: "Nexpose",
  InsightAppSecInsightAppSec: "InsightAppSec",
  NmapScriptName: "Nmap Script",
  FortifyName: "Fortify",
  EspNombreVulnerabilidadUnificado: "Nombre (ES)",
  EspSeveridadUnificada: "Severidad (ES)",
  EspDescripcionUnificada: "Descripción (ES)",
  EspAmenazaUnificadaGeneral: "Amenaza (ES)",
  EspAmenazaUnificadaDesdeInternet: "Amenaza Internet (ES)",
  EspPropuestaRemediacionUnificada: "Remediación (ES)",
  EspPropuestaRemediacionUnificadaEnRedPrivada: "Remediación red privada (ES)",
  EspMetodoDeteccion: "Método detección (ES)",
  EspExplicacionTecnica: "Explicación técnica (ES)",
};

export function catalogColumnLabel(column: string): string {
  if (LABEL_OVERRIDES[column]) return LABEL_OVERRIDES[column];
  if (column.startsWith("Esp")) {
    return column.replace(/^Esp/, "").replace(/([A-Z])/g, " $1").trim();
  }
  return column.replace(/([A-Z])/g, " $1").trim();
}

export function isLongTextCatalogColumn(column: string): boolean {
  const lower = column.toLowerCase();
  return (
    lower.includes("description") ||
    lower.includes("descripcion") ||
    lower.includes("amenaza") ||
    lower.includes("remediacion") ||
    lower.includes("solution") ||
    lower.includes("danger") ||
    lower.includes("explicacion")
  );
}
