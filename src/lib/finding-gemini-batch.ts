import {
  findingToFormValues,
  type FindingFormValues,
} from '@/components/finding-form-editor';
import { AI_FILL_ORDER, fieldHasValue, type AiFormFieldKey } from '@/lib/ai-form-fields';
import { findingCompleteness } from '@/lib/finding-completeness';
import {
  findingGroupKey,
  personalizedSalida,
  resolveFindingComponente,
} from '@/lib/finding-grouping';
import { suggestionToFormValues } from '@/lib/finding-suggest';
import type { Finding, SuggestedFinding } from '@/lib/secops-api';

const INSTANCE_ONLY: ReadonlySet<AiFormFieldKey> = new Set([
  'componentes_afectados',
  'raw_tool_output',
]);

const SHARED_MIN_LEN: Partial<Record<AiFormFieldKey, number>> = {
  titulo: 3,
  descripcion: 30,
  amenaza_ampliada: 30,
  propuesta_remediacion: 15,
  referencias: 3,
  metodo_deteccion: 5,
  explicacion_tecnica: 10,
};

function sharedFieldNeedsFill(values: FindingFormValues, key: AiFormFieldKey): boolean {
  if (INSTANCE_ONLY.has(key)) return false;
  const min = SHARED_MIN_LEN[key] ?? 1;
  const v = values[key];
  if (Array.isArray(v)) return !v.some((s) => s.trim().length >= min);
  if (key === 'severidad') return false;
  if (key === 'cvss_score') return !String(v ?? '').trim();
  if (key === 'cve' || key === 'cwe') return !String(v ?? '').trim();
  return String(v ?? '').trim().length < min;
}

export function hasMissingSharedFields(values: FindingFormValues): boolean {
  return AI_FILL_ORDER.some((key) => sharedFieldNeedsFill(values, key));
}

/** Agrupa hallazgos seleccionados por plugin/identificador (misma vulnerabilidad). */
export function groupFindingsForGeminiBatch(findings: Finding[]): Finding[][] {
  const buckets = new Map<string, Finding[]>();
  const order: string[] = [];

  for (const f of findings) {
    const key = findingGroupKey(f);
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(f);
  }

  return order.map((key) => buckets.get(key)!);
}

export function findingHasGeminiRaw(finding: Finding): boolean {
  return String(finding.raw_tool_output ?? '').trim().length >= 20;
}

/** Grupos elegibles: al menos un miembro con salida de herramienta suficiente. */
export function buildGeminiBatchPlan(selectedFindings: Finding[]): {
  groups: Finding[][];
  totalFindings: number;
} {
  const groups = groupFindingsForGeminiBatch(selectedFindings).filter((members) =>
    members.some(findingHasGeminiRaw)
  );
  const totalFindings = groups.reduce((sum, g) => sum + g.length, 0);
  return { groups, totalFindings };
}

/** Raw más largo del grupo — mejor contexto para una sola llamada Gemini. */
export function pickRepresentativeForGemini(members: Finding[]): Finding | null {
  let best: Finding | null = null;
  let bestLen = 0;
  for (const f of members) {
    const len = String(f.raw_tool_output ?? '').trim().length;
    if (len >= 20 && len > bestLen) {
      bestLen = len;
      best = f;
    }
  }
  return best;
}

/** Registro ya completo en campos compartidos (nombre, narrativa, IDs). */
export function pickCanonicalTemplate(
  members: Finding[],
  editForms: Record<string, FindingFormValues>
): { finding: Finding; values: FindingFormValues } | null {
  let best: { finding: Finding; values: FindingFormValues; percent: number } | null = null;

  for (const f of members) {
    const values = editForms[f.id] ?? findingToFormValues(f);
    if (hasMissingSharedFields(values)) continue;
    const percent = findingCompleteness(f).percent;
    if (!best || percent > best.percent) {
      best = { finding: f, values, percent };
    }
  }

  return best ? { finding: best.finding, values: best.values } : null;
}

function copySharedField(
  next: FindingFormValues,
  source: FindingFormValues,
  key: AiFormFieldKey
): void {
  switch (key) {
    case 'severidad':
      next.severidad = source.severidad;
      break;
    case 'cvss_score':
      next.cvss_score = source.cvss_score;
      break;
    case 'componentes_afectados':
      next.componentes_afectados = [...source.componentes_afectados];
      break;
    default:
      next[key] = source[key] as string;
  }
}

/** Solo rellena huecos; no pisa texto ya válido del registro base. */
export function mergeMissingSharedFields(
  base: FindingFormValues,
  incoming: FindingFormValues
): FindingFormValues {
  const next: FindingFormValues = { ...base };

  for (const key of AI_FILL_ORDER) {
    if (INSTANCE_ONLY.has(key)) continue;
    if (!sharedFieldNeedsFill(next, key)) continue;
    if (!fieldHasValue(incoming, key)) continue;
    copySharedField(next, incoming, key);
  }

  return next;
}

/** Sincroniza campos compartidos del canónico; conserva activo y salida por instancia. */
export function applyCanonicalToSibling(
  canonical: FindingFormValues,
  target: Finding
): FindingFormValues {
  const next: FindingFormValues = { ...findingToFormValues(target) };

  for (const key of AI_FILL_ORDER) {
    if (INSTANCE_ONLY.has(key)) continue;
    if (!fieldHasValue(canonical, key)) continue;
    copySharedField(next, canonical, key);
  }

  const comp = resolveFindingComponente(target);
  if (comp) {
    next.componentes_afectados = [comp];
  }

  const raw = String(target.raw_tool_output ?? '').trim();
  if (raw) {
    next.raw_tool_output = personalizedSalida(comp, raw) || raw;
  }

  return next;
}

export function buildCanonicalFromSuggestion(
  suggestion: SuggestedFinding,
  representative: Finding,
  base?: FindingFormValues
): FindingFormValues {
  const current = base ?? findingToFormValues(representative);
  const raw = representative.raw_tool_output || '';
  const suggested = suggestionToFormValues(suggestion, raw, current);
  return mergeMissingSharedFields(current, suggested);
}

export type GeminiBatchStats = {
  geminiCalls: number;
  siblingUpdates: number;
  updated: number;
};
