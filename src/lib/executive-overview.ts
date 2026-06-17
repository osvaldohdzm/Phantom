import type { Severity } from '@/lib/secops-api';
import { compareBySeverity } from '@/lib/severity-sort';
import { isInformativeSeverity } from '@/lib/finding-overview-stats';

/** Orden de columnas Excel / tablas ejecutivas: BAJAS → CRÍTICAS */
export const EXEC_TABLE_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export type ExecTableSeverity = (typeof EXEC_TABLE_SEVERITIES)[number];

/** Orden visual del gráfico (críticas arriba, como informe INAI) */
export const EXEC_CHART_SEVERITIES = ['Critical', 'High', 'Medium', 'Low'] as const;

export const EXEC_SEVERITY_LABELS: Record<ExecTableSeverity, string> = {
  Low: 'BAJAS',
  Medium: 'MEDIAS',
  High: 'ALTAS',
  Critical: 'CRÍTICAS',
};

export const EXEC_SEVERITY_COLORS: Record<ExecTableSeverity, string> = {
  Low: 'bg-emerald-500',
  Medium: 'bg-amber-400',
  High: 'bg-rose-500',
  Critical: 'bg-violet-600',
};

export type VulnBreakdownItem = {
  titulo: string;
  severidad: string;
  memberCount: number;
  componentCount: number;
};

export type SeverityCountRow = {
  severity: ExecTableSeverity;
  label: string;
  count: number;
};

export type SeverityMatrixRow = {
  titulo: string;
  counts: Record<ExecTableSeverity, number>;
  total: number;
  peakSeverity: ExecTableSeverity | null;
};

function emptyCounts(): Record<ExecTableSeverity, number> {
  return { Low: 0, Medium: 0, High: 0, Critical: 0 };
}

export function buildSeverityCountRows(bySeverity: Record<string, number>): SeverityCountRow[] {
  return EXEC_TABLE_SEVERITIES.map((severity) => ({
    severity,
    label: EXEC_SEVERITY_LABELS[severity],
    count: bySeverity[severity] ?? 0,
  }));
}

export function aggregateVulnerabilityMatrix(breakdown: VulnBreakdownItem[]): SeverityMatrixRow[] {
  const map = new Map<string, Record<ExecTableSeverity, number>>();

  for (const row of breakdown) {
    if (isInformativeSeverity(row.severidad)) continue;
    if (!EXEC_TABLE_SEVERITIES.includes(row.severidad as ExecTableSeverity)) continue;
    const sev = row.severidad as ExecTableSeverity;
    const counts = map.get(row.titulo) ?? emptyCounts();
    counts[sev] += row.componentCount;
    map.set(row.titulo, counts);
  }

  return Array.from(map.entries()).map(([titulo, counts]) => {
    const total = EXEC_TABLE_SEVERITIES.reduce((sum, key) => sum + counts[key], 0);
    let peakSeverity: ExecTableSeverity | null = null;
    for (const sev of EXEC_CHART_SEVERITIES) {
      const key = sev as ExecTableSeverity;
      if (counts[key] > 0) {
        peakSeverity = key;
        break;
      }
    }
    return { titulo, counts, total, peakSeverity };
  });
}

export function sortTopByImpact(matrix: SeverityMatrixRow[]): SeverityMatrixRow[] {
  return [...matrix]
    .sort((a, b) => {
      const sa = (a.peakSeverity ?? 'Low') as Severity;
      const sb = (b.peakSeverity ?? 'Low') as Severity;
      const cmp = compareBySeverity(sa, sb);
      if (cmp !== 0) return cmp;
      const ca = sa ? a.counts[sa as ExecTableSeverity] : 0;
      const cb = sb ? b.counts[sb as ExecTableSeverity] : 0;
      if (cb !== ca) return cb - ca;
      return b.total - a.total;
    })
    .slice(0, 12);
}

export function sortMostCommon(matrix: SeverityMatrixRow[]): SeverityMatrixRow[] {
  return [...matrix].sort((a, b) => b.total - a.total).slice(0, 12);
}

export function severitySummaryTsv(rows: SeverityCountRow[]): (string | number)[][] {
  return [['', 'Número'], ...rows.map((r) => [r.label, r.count])];
}

export function vulnerabilityMatrixTsv(rows: SeverityMatrixRow[]): (string | number)[][] {
  const header = ['Nombre de Vulnerabilidad', ...EXEC_TABLE_SEVERITIES.map((s) => EXEC_SEVERITY_LABELS[s])];
  const body = rows.map((row) => [
    row.titulo,
    ...EXEC_TABLE_SEVERITIES.map((s) => (row.counts[s] > 0 ? row.counts[s] : '')),
  ]);
  return [header, ...body];
}
