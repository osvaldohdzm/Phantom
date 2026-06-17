import type { FindingFormValues } from '@/components/finding-form-editor';

export type AiFormFieldKey = keyof FindingFormValues;

/** Orden visual del relleno animado */
export const AI_FILL_ORDER: AiFormFieldKey[] = [
  'titulo',
  'severidad',
  'descripcion',
  'amenaza_ampliada',
  'propuesta_remediacion',
  'referencias',
  'metodo_deteccion',
  'componentes_afectados',
  'cve',
  'cwe',
  'cvss_score',
  'explicacion_tecnica',
  'raw_tool_output',
];

export const AI_FIELD_LABELS: Record<AiFormFieldKey, string> = {
  titulo: 'Nombre de la vulnerabilidad',
  severidad: 'Severidad',
  descripcion: 'Descripción',
  amenaza_ampliada: 'Amenaza (Impacto)',
  propuesta_remediacion: 'Propuesta de remediación',
  referencias: 'Referencias',
  metodo_deteccion: 'Método de detección',
  componentes_afectados: 'Sistemas / rutas afectadas',
  explicacion_tecnica: 'Explicación técnica',
  raw_tool_output: 'Salidas de herramienta',
  cve: 'CVE',
  cwe: 'CWE',
  cvss_score: 'CVSS',
};

export function fieldHasValue(values: FindingFormValues, key: AiFormFieldKey): boolean {
  const v = values[key];
  if (Array.isArray(v)) return v.some((s) => s.trim());
  if (key === 'severidad') return !!v;
  return typeof v === 'string' && v.trim().length > 0;
}

export function getFilledFieldKeys(
  target: FindingFormValues,
  only?: string[]
): AiFormFieldKey[] {
  const order = only
    ? AI_FILL_ORDER.filter((k) => only.includes(k))
    : AI_FILL_ORDER;
  return order.filter((k) => fieldHasValue(target, k));
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Typewriter rápido — acelera en textos largos */
export async function typewriterReveal(
  full: string,
  onTick: (partial: string) => void,
  maxMs = 1200
): Promise<void> {
  if (!full) return;
  const chars = full.length;
  const step = Math.max(1, Math.ceil(chars / (maxMs / 16)));
  for (let i = step; i < chars; i += step) {
    onTick(full.slice(0, i));
    await sleep(16);
  }
  onTick(full);
}
