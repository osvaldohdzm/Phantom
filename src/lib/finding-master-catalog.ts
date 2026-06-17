/** Estado de sincronización con el catálogo maestro y badges de origen. */

import type { Finding } from '@/lib/secops-api';

export type SyncStatusVisual = 'synced' | 'pending' | 'error' | 'mitigated';

export const SYNC_STATUS_LABEL: Record<SyncStatusVisual, string> = {
  synced: 'Sincronizado',
  pending: 'Pendiente',
  error: 'Error',
  mitigated: 'Mitigado',
};

export const SYNC_STATUS_DOT: Record<SyncStatusVisual, string> = {
  synced: '🟢',
  pending: '🟡',
  error: '🔴',
  mitigated: '⚪',
};

export function resolveSyncStatusVisual(finding: Finding): SyncStatusVisual {
  const raw = (finding.sync_status || 'pending').toLowerCase();
  if (raw === 'synced' || finding.global_status === 'SINCRONIZADO') return 'synced';
  if (raw === 'error') return 'error';
  if (finding.global_status === 'MITIGADO') return 'mitigated';
  return 'pending';
}

const SOURCE_BADGE: Record<string, string> = {
  nessus: 'Nessus',
  'nessus-csv': 'Nessus',
  nmap: 'Nmap',
  acunetix: 'Acunetix',
  'acunetix-html': 'Acunetix',
  manual: 'Manual',
  pentest: 'Pentest',
  'universal-csv': 'CSV',
  csv: 'CSV',
  import: 'Importación',
};

export function sourceBadgeLabel(toolSource?: string | null): string {
  const key = (toolSource || 'manual').trim().toLowerCase();
  return SOURCE_BADGE[key] || toolSource || 'Manual';
}

export function detectionSourceLabels(finding: Finding): string[] {
  const fromJson = (finding.detection_sources ?? [])
    .map((s) => sourceBadgeLabel(String(s.source || s.tool || '')))
    .filter(Boolean);
  const primary = sourceBadgeLabel(finding.tool_source);
  return [...new Set([primary, ...fromJson])];
}

const GLOBAL_STATUS_LABEL: Record<string, string> = {
  LOCAL: 'Local',
  SINCRONIZADO: 'Sincronizado',
  MITIGADO: 'Mitigado',
};

export function globalStatusLabel(status?: string | null): string {
  if (!status) return 'Local';
  return GLOBAL_STATUS_LABEL[status.toUpperCase()] || status;
}

export function formatCatalogDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function hasMasterCatalogMeta(finding: Finding): boolean {
  return Boolean(
    finding.first_seen ||
      finding.last_seen ||
      (finding.origin_projects?.length ?? 0) > 0 ||
      finding.global_status ||
      finding.ai_summary ||
      (finding.detection_sources?.length ?? 0) > 0
  );
}
