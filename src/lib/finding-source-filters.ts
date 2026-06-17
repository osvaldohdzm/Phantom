/** Filtros por integración / herramienta de origen. */

import type { Finding } from '@/lib/secops-api';
import { sourceBadgeLabel } from '@/lib/finding-master-catalog';

export type ToolSourceFilterId = 'all' | string;

export const TOOL_SOURCE_FILTER_OPTIONS: { id: ToolSourceFilterId; label: string; match: string | null }[] =
  [
    { id: 'all', label: 'Todas las fuentes', match: null },
    { id: 'nessus', label: 'Nessus', match: 'nessus' },
    { id: 'acunetix', label: 'Acunetix', match: 'acunetix' },
    { id: 'nmap', label: 'Nmap', match: 'nmap' },
    { id: 'universal-csv', label: 'CSV', match: 'universal-csv' },
    { id: 'manual', label: 'Manual', match: 'manual' },
  ];

export function normalizeToolSourceKey(toolSource?: string | null): string {
  const raw = (toolSource || 'manual').trim().toLowerCase();
  if (raw.includes('nessus')) return 'nessus';
  if (raw.includes('acunetix')) return 'acunetix';
  if (raw.includes('nmap')) return 'nmap';
  if (raw.includes('csv') || raw.includes('universal')) return 'universal-csv';
  if (raw === 'pentest' || raw === 'manual') return 'manual';
  return raw || 'manual';
}

export function findingMatchesToolSourceFilter(
  finding: Finding,
  filterId: ToolSourceFilterId
): boolean {
  if (filterId === 'all') return true;
  const opt = TOOL_SOURCE_FILTER_OPTIONS.find((o) => o.id === filterId);
  if (!opt?.match) return true;
  return normalizeToolSourceKey(finding.tool_source) === opt.match;
}

export function countFindingsByToolSource(findings: Finding[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of findings) {
    const key = normalizeToolSourceKey(f.tool_source);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function toolSourceFilterApiValue(filterId: ToolSourceFilterId): string | undefined {
  if (filterId === 'all') return undefined;
  const opt = TOOL_SOURCE_FILTER_OPTIONS.find((o) => o.id === filterId);
  return opt?.match ?? undefined;
}

export function toolSourceChipLabel(filterId: ToolSourceFilterId): string {
  const opt = TOOL_SOURCE_FILTER_OPTIONS.find((o) => o.id === filterId);
  return opt?.label ?? sourceBadgeLabel(filterId);
}
