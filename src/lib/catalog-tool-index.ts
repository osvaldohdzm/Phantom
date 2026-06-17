/** Índice catálogo por herramienta — equivalente CHOOSE/SWITCH de Excel CFR. */

export const TOOL_SOURCE_CATALOG_COLUMNS: Record<string, string> = {
  nessus: 'NessusPluginId',
  invicti: 'InvictiName',
  vulnerabilitymanagerplus: 'VulnerabilityManagerPlusName',
  sonarqube: 'SonarRuleId',
  derscanner: 'DerScannerName',
  roslynator: 'RoslynatorId',
  owaspzap: 'OWASPZAPScanRuleId',
  acunetix: 'AcunetixName',
  openvas: 'OpenVasNVTId',
  nexpose: 'NexposeName',
  insightappsec: 'InsightAppSecInsightAppSec',
  nmap: 'NmapScriptName',
  fortify: 'FortifyName',
  manual: 'StandardVulnerabilityName',
};

export const TOOL_SOURCE_LABELS: Record<string, string> = {
  Nessus: 'Nessus',
  Invicti: 'Invicti',
  VulnerabilityManagerPlus: 'Vulnerability Manager Plus',
  SonarQube: 'SonarQube',
  DerScanner: 'DerScanner',
  Roslynator: 'Roslynator',
  OWASPZAP: 'OWASP ZAP',
  Acunetix: 'Acunetix',
  OpenVas: 'OpenVAS',
  Nexpose: 'Nexpose',
  InsightAppSec: 'InsightAppSec',
  Nmap: 'Nmap',
  Fortify: 'Fortify',
  Manual: 'Manual',
};

export const TOOL_SOURCE_OPTIONS = Object.keys(TOOL_SOURCE_LABELS);

export function normalizeToolSource(raw: string | null | undefined): string {
  const key = (raw || 'Manual')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, '');
  const aliases: Record<string, string> = {
    owasp: 'owaspzap',
    zap: 'owaspzap',
    vmplus: 'vulnerabilitymanagerplus',
    vmp: 'vulnerabilitymanagerplus',
    sonar: 'sonarqube',
    tenable: 'nessus',
  };
  return aliases[key] ?? (key || 'manual');
}

export function catalogColumnForSource(sourceType: string | null | undefined): string | undefined {
  return TOOL_SOURCE_CATALOG_COLUMNS[normalizeToolSource(sourceType)];
}

export const VULNS_CATALOG_TOOL_ID_COLUMNS = [
  'NessusPluginId',
  'InvictiName',
  'VulnerabilityManagerPlusName',
  'SonarRuleId',
  'DerScannerName',
  'RoslynatorId',
  'OWASPZAPScanRuleId',
  'AcunetixName',
  'OpenVasNVTId',
  'NexposeName',
  'InsightAppSecInsightAppSec',
  'NmapScriptName',
  'FortifyName',
] as const;
