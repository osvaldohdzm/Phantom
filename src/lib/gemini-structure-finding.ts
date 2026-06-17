import type { GoogleGenAI } from '@google/genai';
import { formatGeminiContextPromptBlock, analystForbidsHar } from '@/lib/gemini-context';
import { mergeSuggestionWithStructured, parseStructuredFinding } from '@/lib/parse-structured-finding';
import {
  coerceFindingFields,
  GEMINI_BOUNDARY_SCHEMA,
  GEMINI_FINDING_SCHEMA,
  validateStructuredFinding,
  type StructuredFindingFields,
} from '@/lib/gemini-finding-schema';
import { AI_PLAIN_TEXT_PROMPT_RULES } from '@/lib/plain-report-text';

const MODEL = 'gemini-2.5-flash';

function parseJsonResponse<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '');
  return JSON.parse(cleaned || '{}') as T;
}

function buildStructurePrompt(chunk: string, ctx: string, retryErrors?: string[]): string {
  const harNote = analystForbidsHar(ctx)
    ? '\n- NO escribas "HAR"; describe tráfico/peticiones HTTP.\n'
    : '';

  const retryBlock = retryErrors?.length
    ? `\n## CORRECCIÓN OBLIGATORIA (intento anterior inválido)\n${retryErrors.map((e) => `- ${e}`).join('\n')}\n`
    : '';

  return `Eres analista senior de ciberseguridad. Extrae UN hallazgo del texto y devuelve JSON ESTRICTO con todos los campos.

${formatGeminiContextPromptBlock(ctx)}
${retryBlock}
## Texto del hallazgo (un solo hallazgo)
"""
${chunk.slice(0, 20000)}
"""

Reglas OBLIGATORIAS:
- Responde ÚNICAMENTE JSON válido según el schema. Sin markdown ni texto extra.
- Si hay tabla | DESCRIPCIÓN | texto | o líneas DESCRIPCIÓN / AMENAZA / PROPUESTA DE REMEDIACIÓN, copia el contenido al campo correspondiente (descripcion, amenaza_ampliada, propuesta_remediacion, referencias, componente_afectado).
- descripcion y amenaza_ampliada: NUNCA vacíos; mínimo 2 oraciones cada uno en español formal.
- propuesta_remediacion: pasos concretos, no genéricos.
- explicacion_tecnica: puede usar markdown ligero si aporta claridad técnica.
${AI_PLAIN_TEXT_PROMPT_RULES}
- Aplica el formato anterior a descripcion, amenaza_ampliada, propuesta_remediacion, metodo_deteccion, referencias y componente_afectado.
- raw_snippet: SOLO peticiones HTTP, respuestas o salida de herramienta (máx 2000 chars). NO incluyas tablas de secciones ni el informe completo.
- severidad: Critical | High | Medium | Low | Info.${harNote}`;
}

async function callGeminiStructure(
  ai: GoogleGenAI,
  chunk: string,
  ctx: string,
  retryErrors?: string[]
): Promise<StructuredFindingFields> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: buildStructurePrompt(chunk, ctx, retryErrors),
    config: {
      responseMimeType: 'application/json',
      responseSchema: GEMINI_FINDING_SCHEMA,
      temperature: 0.1,
    },
  });

  const parsed = parseJsonResponse<Record<string, unknown>>(response.text || '{}');
  return coerceFindingFields(parsed);
}

/**
 * Estructura un bloque de texto en campos de hallazgo vía Gemini JSON + validación + reintentos.
 */
export async function structureFindingWithGemini(
  ai: GoogleGenAI,
  chunk: string,
  ctx: string,
  maxRetries = 2
): Promise<{ finding: StructuredFindingFields; source: 'gemini' | 'structured' }> {
  const local = parseStructuredFinding(chunk);
  if (local && local.confidence >= 0.5) {
    const { suggestion, raw_tool_output } = mergeSuggestionWithStructured(local.suggestion, chunk);
    return {
      source: 'structured',
      finding: {
        ...suggestion,
        raw_snippet: raw_tool_output || suggestion.explicacion_tecnica?.slice(0, 2000) || '',
      },
    };
  }

  let lastErrors: string[] = [];
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const finding = await callGeminiStructure(
        ai,
        chunk,
        ctx,
        attempt > 0 ? lastErrors : undefined
      );
      const errors = validateStructuredFinding(finding);
      if (!errors.length) {
        const { suggestion, raw_tool_output } = mergeSuggestionWithStructured(finding, chunk);
        return {
          source: 'gemini',
          finding: {
            ...suggestion,
            raw_snippet:
              raw_tool_output ||
              finding.raw_snippet ||
              suggestion.explicacion_tecnica?.slice(0, 2000) ||
              '',
          },
        };
      }
      lastErrors = errors;
    } catch (e) {
      lastErrors = [e instanceof Error ? e.message : 'Error de parseo JSON'];
    }
  }

  if (local) {
    const { suggestion, raw_tool_output } = mergeSuggestionWithStructured(local.suggestion, chunk);
    return {
      source: 'structured',
      finding: {
        ...suggestion,
        raw_snippet: raw_tool_output || '',
      },
    };
  }

  throw new Error(
    `Gemini no devolvió un hallazgo válido: ${lastErrors.join('; ')}`
  );
}

/** Extrae trozos de texto usando marcadores literales devueltos por Gemini. */
export function extractChunksByMarkers(raw: string, markers: string[]): string[] {
  const unique = [...new Set(markers.map((m) => m.trim()).filter((m) => m.length >= 10))];
  const hits: { pos: number; marker: string }[] = [];

  for (const marker of unique) {
    const pos = raw.indexOf(marker);
    if (pos >= 0) hits.push({ pos, marker });
  }

  if (hits.length < 2) {
    for (const marker of unique) {
      const short = marker.slice(0, 40);
      const pos = raw.indexOf(short);
      if (pos >= 0 && !hits.some((h) => h.pos === pos)) hits.push({ pos, marker: short });
    }
  }

  hits.sort((a, b) => a.pos - b.pos);
  const deduped = hits.filter((h, i) => i === 0 || h.pos > hits[i - 1].pos);
  if (deduped.length < 2) return [];

  return deduped.map((h, i) => {
    const end = i + 1 < deduped.length ? deduped[i + 1].pos : raw.length;
    return raw.slice(h.pos, end).trim();
  });
}

/**
 * Fase 1: Gemini devuelve JSON con marcadores literales para separar hallazgos.
 */
export async function detectFindingBoundariesWithGemini(
  ai: GoogleGenAI,
  raw: string,
  ctx: string
): Promise<string[]> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `Identifica hallazgos de vulnerabilidad DISTINTOS en el texto. Devuelve JSON con array "findings".

${formatGeminiContextPromptBlock(ctx)}

## Texto completo
"""
${raw.slice(0, 48000)}
"""

Reglas:
- Cada hallazgo es una vulnerabilidad o mala práctica independiente (secciones numeradas, tablas | Título | Severidad |, plugins Nessus, etc.).
- marcador_inicio: copia LITERAL de la primera línea o encabezado de ese hallazgo tal como aparece en el texto (mínimo 15 caracteres).
- NO dupliques hallazgos.
- Entre 2 y 40 hallazgos según el contenido real.
- Responde SOLO JSON.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: GEMINI_BOUNDARY_SCHEMA,
      temperature: 0.1,
    },
  });

  const parsed = parseJsonResponse<{ findings?: { titulo?: string; marcador_inicio?: string }[] }>(
    response.text || '{}'
  );
  const markers = (parsed.findings || [])
    .map((f) => f.marcador_inicio || f.titulo || '')
    .filter(Boolean);

  const chunks = extractChunksByMarkers(raw, markers);
  return chunks.length >= 2 ? chunks : [];
}

/** Procesa varios bloques en paralelo con límite de concurrencia. */
export async function structureManyFindingsWithGemini(
  ai: GoogleGenAI,
  chunks: string[],
  ctx: string
): Promise<{ findings: StructuredFindingFields[]; sources: ('gemini' | 'structured')[] }> {
  const concurrency = 4;
  const findings: StructuredFindingFields[] = [];
  const sources: ('gemini' | 'structured')[] = [];

  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (chunk) => {
        try {
          return await structureFindingWithGemini(ai, chunk, ctx);
        } catch (err) {
          const local = parseStructuredFinding(chunk);
          if (local) {
            const { suggestion, raw_tool_output } = mergeSuggestionWithStructured(
              local.suggestion,
              chunk
            );
            return {
              source: 'structured' as const,
              finding: {
                ...suggestion,
                raw_snippet: raw_tool_output || '',
              },
            };
          }
          throw err;
        }
      })
    );
    for (const r of results) {
      findings.push(r.finding);
      sources.push(r.source);
    }
  }

  return { findings, sources };
}
