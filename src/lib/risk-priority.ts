import type { Finding } from '@/lib/secops-api';

const EPSS_HIGH_THRESHOLD = 0.5;

/** Combina CVSS, EPSS y KEV en un score contextual (mayor = más urgente). */
export function contextualRiskScore(finding: Finding): number {
  const cvss = finding.cvss_score ?? 0;
  const epss = finding.epss_score ?? 0;
  const kevBoost = finding.kev_listed ? 2.5 : 0;
  return cvss * (1 + epss) + kevBoost;
}

export function isHighEpss(finding: Finding): boolean {
  return (finding.epss_score ?? 0) >= EPSS_HIGH_THRESHOLD;
}

export function sortByContextualRisk(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => contextualRiskScore(b) - contextualRiskScore(a));
}

export { EPSS_HIGH_THRESHOLD };
