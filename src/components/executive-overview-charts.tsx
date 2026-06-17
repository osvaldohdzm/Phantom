'use client';

import { cn } from '@/lib/utils';
import {
  EXEC_CHART_SEVERITIES,
  EXEC_SEVERITY_COLORS,
  EXEC_SEVERITY_LABELS,
  EXEC_TABLE_SEVERITIES,
  type ExecTableSeverity,
  type SeverityCountRow,
  type SeverityMatrixRow,
} from '@/lib/executive-overview';

function formatCell(value: number): string {
  return value > 0 ? String(value) : '';
}

export function ExecutiveSeverityChart({ rows, total }: { rows: SeverityCountRow[]; total: number }) {
  const chartRows = [...rows].reverse();
  const max = Math.max(...chartRows.map((r) => r.count), 1);

  return (
    <div className="space-y-2.5">
      {chartRows.map((row) => {
        const width = max > 0 ? Math.max((row.count / max) * 100, row.count > 0 ? 3 : 0) : 0;
        return (
          <div key={row.severity} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-foreground/80 text-right">
              {row.label}
            </span>
            <div className="flex-1 h-5 rounded-sm bg-muted/40 dark:bg-muted/60 overflow-hidden border border-border">
              <div
                className={cn('h-full transition-all', EXEC_SEVERITY_COLORS[row.severity])}
                style={{ width: `${width}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-xs font-mono tabular-nums text-muted-foreground">
              {row.count}
            </span>
          </div>
        );
      })}
      <p className="text-[10px] text-muted-foreground text-right pt-1">
        Total: {total.toLocaleString()} vulnerabilidades (sin informativas)
      </p>
    </div>
  );
}

export function ExecutiveVulnerabilityChart({ rows }: { rows: SeverityMatrixRow[] }) {
  const max = Math.max(...rows.map((r) => r.total), 1);

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const color = row.peakSeverity ? EXEC_SEVERITY_COLORS[row.peakSeverity] : 'bg-muted';
        const width = max > 0 ? Math.max((row.total / max) * 100, row.total > 0 ? 2 : 0) : 0;
        return (
          <div key={row.titulo} className="flex items-center gap-2 min-h-[22px]">
            <span
              className="w-[42%] shrink-0 text-[10px] leading-tight text-foreground/90 line-clamp-2"
              title={row.titulo}
            >
              {row.titulo}
            </span>
            <div className="flex-1 h-4 rounded-sm bg-muted/40 dark:bg-muted/60 overflow-hidden border border-border">
              <div className={cn('h-full', color)} style={{ width: `${width}%` }} />
            </div>
            <span className="w-8 shrink-0 text-right text-[10px] font-mono tabular-nums text-muted-foreground">
              {row.total}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ExecutiveSeveritySummaryTable() {
  return (
    <thead>
      <tr className="border-b border-border">
        <th className="py-2 px-3 text-left font-medium text-muted-foreground w-32" />
        <th className="py-2 px-3 text-left font-medium text-muted-foreground">Número</th>
      </tr>
    </thead>
  );
}

export function ExecutiveSeveritySummaryBody({ rows }: { rows: SeverityCountRow[] }) {
  return (
    <tbody>
      {rows.map((row) => (
        <tr key={row.severity} className="border-b border-border/60">
          <td className="py-2 px-3 font-semibold text-foreground">{row.label}</td>
          <td className="py-2 px-3 font-mono tabular-nums text-foreground">{row.count}</td>
        </tr>
      ))}
    </tbody>
  );
}

export function ExecutiveMatrixTableHead() {
  return (
    <thead>
      <tr className="border-b border-border bg-muted/30">
        <th className="py-2 px-3 text-left font-medium text-muted-foreground min-w-[200px]">
          Nombre de Vulnerabilidad
        </th>
        {EXEC_TABLE_SEVERITIES.map((sev) => (
          <th key={sev} className="py-2 px-3 text-center font-medium text-muted-foreground w-16">
            {EXEC_SEVERITY_LABELS[sev as ExecTableSeverity]}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function ExecutiveMatrixTableBody({ rows }: { rows: SeverityMatrixRow[] }) {
  return (
    <tbody>
      {rows.map((row) => (
        <tr key={row.titulo} className="border-b border-border/60 hover:bg-muted/20">
          <td className="py-2 px-3 text-foreground max-w-xs" title={row.titulo}>
            {row.titulo}
          </td>
          {EXEC_TABLE_SEVERITIES.map((sev) => (
            <td key={sev} className="py-2 px-3 text-center font-mono tabular-nums text-foreground">
              {formatCell(row.counts[sev as ExecTableSeverity])}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
