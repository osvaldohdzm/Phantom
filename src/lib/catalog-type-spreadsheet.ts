import type { Finding } from '@/lib/secops-api';
import type { VulnerabilityTypeGroup } from '@/lib/finding-grouping';
import type { SpreadsheetColumnId } from '@/lib/finding-spreadsheet-columns';

/** Columnas ocultas en revisión por tipo (sin IP/puerto/URL ni metadatos por instancia). */
export const CATALOG_TYPE_EXCLUDE_COLUMNS: SpreadsheetColumnId[] = [
  'componente_afectado',
  'raw_tool_output',
  'cve',
  'cwe',
  'cvss_score',
  'status',
  'created_at',
];

export type CatalogTypeRowMeta = {
  instanceCount: number;
  toolLabel: string;
  groupKey: string;
};

export function buildCatalogTypeRowMeta(
  groups: VulnerabilityTypeGroup[]
): Record<string, CatalogTypeRowMeta> {
  const out: Record<string, CatalogTypeRowMeta> = {};
  for (const group of groups) {
    const rep = group.members[0];
    if (!rep) continue;
    out[rep.id] = {
      instanceCount: group.instanceCount,
      toolLabel: group.toolLabel,
      groupKey: group.key,
    };
  }
  return out;
}

export function representativesFromGroups(groups: VulnerabilityTypeGroup[]): Finding[] {
  return groups.map((g) => g.members[0]).filter(Boolean);
}
