import type { Finding, Severity } from '@/lib/secops-api';
import { groupFindingsForDisplay, resolveFindingComponente } from '@/lib/finding-grouping';
import { compareBySeverity } from '@/lib/severity-sort';

export const OVERVIEW_SEVERITIES: Severity[] = ['Critical', 'High', 'Medium', 'Low', 'Info'];

export const OVERVIEW_SEVERITY_LABELS: Record<Severity, string> = {
  Critical: 'Crítica',
  High: 'Alta',
  Medium: 'Media',
  Low: 'Baja',
  Info: 'Informativa',
};

export const OVERVIEW_SEVERITY_COLORS: Record<Severity, string> = {
  Critical: 'bg-violet-600',
  High: 'bg-rose-500',
  Medium: 'bg-amber-500',
  Low: 'bg-sky-500',
  Info: 'bg-slate-500',
};

export function isInformativeSeverity(severity: string): boolean {
  const s = severity.toLowerCase();
  return s === 'info' || s === 'informativa' || s === 'informational';
}

export type VulnerabilityBreakdownRow = {
  titulo: string;
  severidad: Severity;
  memberCount: number;
  componentCount: number;
};

export type FindingOverviewStats = {
  totalFindings: number;
  totalExcludingInfo: number;
  /** Cada registro de hallazgo (sin informativas) = una incidencia en BD */
  incidentRecordsExcludingInfo: number;
  /** IP:puerto distintos en todo el proyecto */
  uniqueComponents: number;
  uniqueHosts: number;
  /** Total de filas IP:puerto contando duplicados entre hallazgos */
  componentOccurrences: number;
  groupedVulnerabilityCount: number;
  groupedVulnerabilityCountExcludingInfo: number;
  groupedComponentTotal: number;
  bySeverity: Record<Severity, number>;
  bySeverityExcludingInfo: Record<Severity, number>;
  vulnerabilityBreakdown: VulnerabilityBreakdownRow[];
  compressionRatio: number;
};

export function computeFindingOverviewStats(findings: Finding[]): FindingOverviewStats {
  const bySeverity = Object.fromEntries(OVERVIEW_SEVERITIES.map((s) => [s, 0])) as Record<
    Severity,
    number
  >;
  const bySeverityExcludingInfo = Object.fromEntries(OVERVIEW_SEVERITIES.map((s) => [s, 0])) as Record<
    Severity,
    number
  >;

  const allComponents: string[] = [];
  const hosts = new Set<string>();
  let totalExcludingInfo = 0;

  for (const f of findings) {
    bySeverity[f.severidad] = (bySeverity[f.severidad] ?? 0) + 1;
    if (!isInformativeSeverity(f.severidad)) {
      totalExcludingInfo += 1;
      bySeverityExcludingInfo[f.severidad] = (bySeverityExcludingInfo[f.severidad] ?? 0) + 1;
    }
    const comp = resolveFindingComponente(f);
    if (comp) {
      allComponents.push(comp);
      hosts.add(comp.split(':')[0].trim());
    }
  }

  const groups = groupFindingsForDisplay(findings);
  const groupsExcludingInfo = groups.filter((g) => !isInformativeSeverity(g.severidad));

  let groupedComponentTotal = 0;
  const vulnerabilityBreakdown: VulnerabilityBreakdownRow[] = groups.map((g) => {
    groupedComponentTotal += g.componentes.length;
    return {
      titulo: g.titulo,
      severidad: g.severidad,
      memberCount: g.members.length,
      componentCount: g.componentes.length,
    };
  });

  vulnerabilityBreakdown.sort((a, b) => {
    const sev = compareBySeverity(a.severidad, b.severidad);
    if (sev !== 0) return sev;
    return b.componentCount - a.componentCount;
  });

  const uniqueComponentSet = new Set(allComponents.filter(Boolean));

  return {
    totalFindings: findings.length,
    totalExcludingInfo,
    incidentRecordsExcludingInfo: totalExcludingInfo,
    uniqueComponents: uniqueComponentSet.size,
    uniqueHosts: hosts.size,
    componentOccurrences: allComponents.length,
    groupedVulnerabilityCount: groups.length,
    groupedVulnerabilityCountExcludingInfo: groupsExcludingInfo.length,
    groupedComponentTotal,
    bySeverity,
    bySeverityExcludingInfo,
    vulnerabilityBreakdown,
    compressionRatio:
      groups.length > 0 ? Math.round((findings.length / groups.length) * 10) / 10 : findings.length,
  };
}
