/**
 * Opciones configurables de severidad y estado para la matriz (localStorage).
 */

import type { FindingStatus, Severity } from '@/lib/secops-api';

export type MatrixFieldOption = {
  value: string;
  label: string;
};

const SEVERITY_STORAGE = 'spectre.matrix.severity-options';
const STATUS_STORAGE = 'spectre.matrix.status-options';

export const DEFAULT_SEVERITY_OPTIONS: MatrixFieldOption[] = (
  ['Critical', 'High', 'Medium', 'Low', 'Info'] as Severity[]
).map((s) => ({ value: s, label: s }));

export const DEFAULT_STATUS_OPTIONS: MatrixFieldOption[] = [
  { value: 'Nueva', label: 'Nueva' },
  { value: 'Mitigada', label: 'Mitigada' },
  { value: 'Identificado', label: 'Identificado' },
  { value: 'Validado', label: 'Validado' },
  { value: 'En Proceso de Remediación', label: 'En Proceso de Remediación' },
  { value: 'Remediado', label: 'Remediado' },
  { value: 'Cerrado', label: 'Cerrado' },
  { value: 'Falso Positivo', label: 'Falso Positivo' },
  { value: 'Riesgo Aceptado', label: 'Riesgo Aceptado' },
  { value: 'Atendido', label: 'Atendido' },
  { value: 'Reaparecido', label: 'Reaparecido' },
];

const SEGUIMIENTO_TO_WORKFLOW: Record<string, FindingStatus> = {
  Nueva: 'Identificado',
  Mitigada: 'Remediado',
  Remediada: 'Remediado',
};

const WORKFLOW_ALIASES: Record<string, FindingStatus> = {
  ...Object.fromEntries(
    DEFAULT_STATUS_OPTIONS.map((o) => [o.value.toLowerCase(), o.value as FindingStatus])
  ),
  nueva: 'Identificado',
  mitigada: 'Remediado',
  remediada: 'Remediado',
};

function loadOptions(key: string, defaults: MatrixFieldOption[]): MatrixFieldOption[] {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as MatrixFieldOption[];
    if (!Array.isArray(parsed) || !parsed.length) return defaults;
    return parsed.filter((o) => o?.value?.trim() && o?.label?.trim());
  } catch {
    return defaults;
  }
}

export function loadMatrixSeverityOptions(): MatrixFieldOption[] {
  return loadOptions(SEVERITY_STORAGE, DEFAULT_SEVERITY_OPTIONS);
}

export function saveMatrixSeverityOptions(options: MatrixFieldOption[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SEVERITY_STORAGE, JSON.stringify(options));
}

export function loadMatrixStatusOptions(): MatrixFieldOption[] {
  return loadOptions(STATUS_STORAGE, DEFAULT_STATUS_OPTIONS);
}

export function saveMatrixStatusOptions(options: MatrixFieldOption[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STATUS_STORAGE, JSON.stringify(options));
}

export function normalizeSeverityValue(raw: string): Severity | null {
  const t = raw.trim();
  if (!t) return null;
  const hit = (['Critical', 'High', 'Medium', 'Low', 'Info'] as Severity[]).find(
    (s) => s.toLowerCase() === t.toLowerCase()
  );
  return hit ?? null;
}

export function resolveEstadoSave(label: string): {
  workflowStatus: FindingStatus | null;
  seguimientoLabel: string | null;
} {
  const trimmed = label.trim();
  if (!trimmed) return { workflowStatus: null, seguimientoLabel: null };

  const seg = SEGUIMIENTO_TO_WORKFLOW[trimmed];
  if (seg) {
    return { workflowStatus: seg, seguimientoLabel: trimmed };
  }

  const byAlias = WORKFLOW_ALIASES[trimmed.toLowerCase()];
  if (byAlias) {
    return { workflowStatus: byAlias, seguimientoLabel: null };
  }

  return { workflowStatus: null, seguimientoLabel: trimmed };
}
