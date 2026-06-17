import type { Finding } from '@/lib/secops-api';
import { findingCompleteness } from '@/lib/finding-completeness';
import { normalizeGroupingTitle, resolveFindingComponente } from '@/lib/finding-grouping';

export type DuplicateGroup = {
  key: string;
  titulo: string;
  componente: string;
  keep: Finding;
  remove: Finding[];
  /** Copias totales en este grupo (incluye la que se conserva). */
  totalInGroup: number;
};

/** Texto corto para la UI de confirmación. */
export function formatDuplicateGroupLabel(group: DuplicateGroup): string {
  return `${group.remove.length} copia(s) extra · queda 1 de ${group.totalInGroup} en «${group.componente}» — ${group.titulo.slice(0, 55)}${group.titulo.length > 55 ? '…' : ''}`;
}

/** Vista previa devuelta por el API de resumen / deduplicar. */
export function formatDuplicatePreviewLabel(group: {
  titulo: string;
  componente: string;
  remove_ids: string[];
  total_in_group: number;
}): string {
  return `${group.remove_ids.length} copia(s) extra · queda 1 de ${group.total_in_group} en «${group.componente}» — ${group.titulo.slice(0, 55)}${group.titulo.length > 55 ? '…' : ''}`;
}

/** Normaliza IP:puerto, host o URL para comparar duplicados. */
export function normalizeAffectedComponent(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';

  let s = trimmed.toLowerCase();

  if (s.includes('://')) {
    try {
      const u = new URL(s);
      const host = u.hostname.toLowerCase();
      const port =
        u.port ||
        (u.protocol === 'https:' ? '443' : u.protocol === 'http:' ? '80' : '');
      const path = u.pathname && u.pathname !== '/' ? u.pathname.replace(/\/$/, '') : '';
      if (port && port !== '80' && port !== '443') return `${host}:${port}${path}`;
      if (port === '443' || port === '80') return path ? `${host}${path}` : host;
      return `${host}${path}`;
    } catch {
      /* seguir con texto plano */
    }
  }

  return s.replace(/\s+/g, '').replace(/\/$/, '');
}

export function findingDuplicateKey(finding: Finding): string {
  const title = normalizeGroupingTitle(finding.titulo);
  const component = normalizeAffectedComponent(resolveFindingComponente(finding));
  return `${title}\u0000${component}`;
}

function keeperScore(finding: Finding): number {
  const c = findingCompleteness(finding);
  let score = c.percent * 100 + c.filled * 10;
  if (finding.catalog_id) score += 5;
  if (finding.cve) score += 2;
  return score;
}

function pickKeeper(members: Finding[]): Finding {
  return [...members].sort((a, b) => {
    const scoreDiff = keeperScore(b) - keeperScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return a.created_at.localeCompare(b.created_at);
  })[0];
}

export function findDuplicateGroups(findings: Finding[]): DuplicateGroup[] {
  const buckets = new Map<string, Finding[]>();

  for (const f of findings) {
    const title = normalizeGroupingTitle(f.titulo);
    if (!title) continue;
    const component = normalizeAffectedComponent(resolveFindingComponente(f));
    if (!component) continue;

    const key = findingDuplicateKey(f);
    const list = buckets.get(key) ?? [];
    list.push(f);
    buckets.set(key, list);
  }

  const groups: DuplicateGroup[] = [];
  for (const [key, members] of buckets) {
    if (members.length < 2) continue;
    const keep = pickKeeper(members);
    const remove = members.filter((m) => m.id !== keep.id);
    const componente =
      resolveFindingComponente(keep) || normalizeAffectedComponent(resolveFindingComponente(keep));
    groups.push({
      key,
      titulo: keep.titulo,
      componente,
      keep,
      remove,
      totalInGroup: members.length,
    });
  }

  groups.sort((a, b) => b.remove.length - a.remove.length);
  return groups;
}

export function collectDuplicateIdsToRemove(findings: Finding[]): string[] {
  const ids: string[] = [];
  for (const group of findDuplicateGroups(findings)) {
    for (const f of group.remove) ids.push(f.id);
  }
  return ids;
}

export function duplicateStats(findings: Finding[]) {
  const groups = findDuplicateGroups(findings);
  const removeCount = groups.reduce((n, g) => n + g.remove.length, 0);
  return { groups, groupCount: groups.length, removeCount };
}
