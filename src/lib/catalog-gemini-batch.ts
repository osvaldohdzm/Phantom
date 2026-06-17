import {
  suggestCatalogSpanishField,
  type CatalogSpanishAiField,
} from '@/lib/catalog-ai-fields';
import {
  findingToCatalogInput,
  resolveCatalogFromFinding,
} from '@/lib/catalog-from-finding';
import { applyFieldLengthRules } from '@/lib/ai-field-length';
import {
  getAiPromptForField,
  getCatalogFieldConfigSync,
  mandatorySpanishAiFields,
  type CatalogFieldConfig,
} from '@/lib/catalog-field-config';
import { groupFindingsForGeminiBatch } from '@/lib/finding-gemini-batch';
import {
  syncFindingsFromCatalogApi,
  type Finding,
  type SyncFromCatalogResult,
} from '@/lib/secops-api';
import {
  EXPLICACION_TECNICA_MAX_PARAGRAPHS,
  truncateToParagraphs,
} from '@/lib/truncate-paragraphs';

export type CatalogGeminiBatchResult = {
  catalogGroups: number;
  fieldsFilled: number;
  findingsPropagated: number;
  errors: string[];
};

async function fetchCatalogRow(catalogId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`/api/vulns-catalog/${encodeURIComponent(catalogId)}`);
  const data = (await res.json()) as { row?: Record<string, unknown>; error?: string };
  if (!res.ok || !data.row) {
    throw new Error(data.error ?? 'No se pudo cargar el registro de catálogo');
  }
  return data.row;
}

async function patchCatalogFields(
  catalogId: string,
  updates: Partial<Record<CatalogSpanishAiField, string>>
): Promise<Record<string, unknown>> {
  const res = await fetch(`/api/vulns-catalog/${encodeURIComponent(catalogId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const data = (await res.json()) as { row?: Record<string, unknown>; error?: string };
  if (!res.ok || !data.row) {
    throw new Error(data.error ?? 'No se pudo guardar el catálogo');
  }
  return data.row;
}

async function ensureCatalogForGroup(
  members: Finding[]
): Promise<{ catalogId: string; row: Record<string, unknown> }> {
  for (const f of members) {
    if (f.catalog_id != null) {
      const id = String(f.catalog_id);
      const row = await fetchCatalogRow(id);
      return { catalogId: id, row };
    }
  }
  const rep = members[0];
  const { row } = await resolveCatalogFromFinding(findingToCatalogInput(rep));
  const id = String(row.Id ?? '');
  if (!id) throw new Error('El catálogo no devolvió un Id válido');
  return { catalogId: id, row };
}

function groupHasContext(members: Finding[]): boolean {
  return members.some((f) => {
    const title = String(f.titulo ?? '').trim();
    const raw = String(f.raw_tool_output ?? '').trim();
    const desc = String(f.descripcion ?? '').trim();
    return title.length >= 3 || raw.length >= 10 || desc.length >= 20;
  });
}

/** Propaga catálogo al proyecto; si el índice no enlaza, sincroniza los hallazgos del grupo visible. */
async function syncAfterCatalogPatch(
  members: Finding[],
  catalogId: string,
  engagementId: string
): Promise<SyncFromCatalogResult> {
  try {
    return await syncFindingsFromCatalogApi({
      catalog_id: catalogId,
      engagement_id: engagementId,
    });
  } catch {
    return syncFindingsFromCatalogApi({ finding_ids: members.map((f) => f.id) });
  }
}

async function runCatalogFieldGroups(
  findings: Finding[],
  engagementId: string,
  fields: CatalogSpanishAiField[],
  options?: {
    fieldConfig?: CatalogFieldConfig;
    onProgress?: (done: number, total: number) => void;
  }
): Promise<CatalogGeminiBatchResult> {
  const config = options?.fieldConfig ?? getCatalogFieldConfigSync();
  const groups = groupFindingsForGeminiBatch(findings).filter(groupHasContext);
  if (!groups.length) {
    throw new Error(
      'No hay hallazgos con contexto suficiente (título, descripción o salida de herramienta).'
    );
  }

  const totalSteps = groups.length * (fields.length + 1);
  let done = 0;
  let fieldsFilled = 0;
  let findingsPropagated = 0;
  const errors: string[] = [];

  for (const members of groups) {
    try {
      let { catalogId, row } = await ensureCatalogForGroup(members);
      const batchUpdates: Partial<Record<CatalogSpanishAiField, string>> = {};

      for (const field of fields) {
        const hint = getAiPromptForField(field, config);
        const suggested = await suggestCatalogSpanishField(field, row, { fieldHint: hint, config });
        const value = applyFieldLengthRules(suggested, hint);
        row = { ...row, [field]: value };
        batchUpdates[field] = value;
        fieldsFilled += 1;
        done += 1;
        options?.onProgress?.(done, totalSteps);
      }

      if (Object.keys(batchUpdates).length > 0) {
        await patchCatalogFields(catalogId, batchUpdates);
      }

      const sync = await syncAfterCatalogPatch(members, catalogId, engagementId);
      findingsPropagated += sync.synced;
      if (sync.errors.length) errors.push(...sync.errors.slice(0, 3));
      done += 1;
      options?.onProgress?.(done, totalSteps);
    } catch (e) {
      const label = members[0]?.titulo?.slice(0, 48) || members[0]?.id || 'grupo';
      errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    catalogGroups: groups.length,
    fieldsFilled,
    findingsPropagated,
    errors,
  };
}

/**
 * Rellena/mejorar campos Español obligatorios en catálogo (sobrescribe texto existente)
 * y propaga a todos los hallazgos del proyecto con el mismo plugin/identificador.
 */
export async function fillCatalogSpanishAndPropagate(
  findings: Finding[],
  engagementId: string,
  options?: {
    fieldConfig?: CatalogFieldConfig;
    onProgress?: (done: number, total: number) => void;
  }
): Promise<CatalogGeminiBatchResult> {
  const config = options?.fieldConfig ?? getCatalogFieldConfigSync();
  const fields = mandatorySpanishAiFields(config);
  if (!fields.length) {
    throw new Error('No hay campos Español obligatorios configurados para IA en el catálogo.');
  }
  return runCatalogFieldGroups(findings, engagementId, fields, options);
}

/** Una columna / un campo Español: 1 llamada Gemini por tipo de vulnerabilidad en el filtro. */
export async function fillCatalogFieldAndPropagate(
  findings: Finding[],
  engagementId: string,
  field: CatalogSpanishAiField,
  options?: {
    fieldConfig?: CatalogFieldConfig;
    onProgress?: (done: number, total: number) => void;
  }
): Promise<CatalogGeminiBatchResult> {
  return runCatalogFieldGroups(findings, engagementId, [field], options);
}

/**
 * Acota EspExplicacionTecnica en catálogo (máx. N párrafos) y sincroniza hallazgos del proyecto.
 * Sin selección, usa el mismo alcance que Gemini (filtro/página visible).
 */
export async function truncateCatalogExplicacionAndPropagate(
  findings: Finding[],
  engagementId: string,
  options?: {
    maxParagraphs?: number;
    onProgress?: (done: number, total: number) => void;
  }
): Promise<CatalogGeminiBatchResult> {
  const maxParagraphs = options?.maxParagraphs ?? EXPLICACION_TECNICA_MAX_PARAGRAPHS;
  const groups = groupFindingsForGeminiBatch(findings);
  if (!groups.length) {
    throw new Error('No hay hallazgos en el alcance seleccionado.');
  }

  const totalSteps = groups.length;
  let done = 0;
  let fieldsFilled = 0;
  let findingsPropagated = 0;
  const errors: string[] = [];

  for (const members of groups) {
    try {
      const { catalogId, row } = await ensureCatalogForGroup(members);
      const raw = String(row.EspExplicacionTecnica ?? '').trim();
      if (raw) {
        const truncated = truncateToParagraphs(raw, maxParagraphs);
        if (truncated !== raw) {
          await patchCatalogFields(catalogId, { EspExplicacionTecnica: truncated });
          fieldsFilled += 1;
        }
        const sync = await syncAfterCatalogPatch(members, catalogId, engagementId);
        findingsPropagated += sync.synced;
        if (sync.errors.length) errors.push(...sync.errors.slice(0, 3));
      }
    } catch (e) {
      const label = members[0]?.titulo?.slice(0, 48) || members[0]?.id || 'grupo';
      errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
    }
    done += 1;
    options?.onProgress?.(done, totalSteps);
  }

  return {
    catalogGroups: groups.length,
    fieldsFilled,
    findingsPropagated,
    errors,
  };
}
