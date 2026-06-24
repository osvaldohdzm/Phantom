import { NextResponse } from 'next/server';
import { getAiClient } from '@/lib/gemini';
import { getAiPromptForField } from '@/lib/catalog-field-config';
import { catalogColumnLabel } from '@/lib/vulns-catalog-columns';
import { isCatalogAiColumn } from '@/lib/catalog-ai-fields';
import { aiLanguageLabel, type TenantLanguage } from '@/lib/tenant-locale';
import { Type } from '@google/genai';
import {
  applyFieldLengthRules,
  hintRequestsBrevity,
  parseMaxLengthFromFieldHint,
  textExceedsFieldHintMax,
} from '@/lib/ai-field-length';
import { AI_PLAIN_TEXT_PROMPT_RULES, sanitizeAiPlainText } from '@/lib/plain-report-text';
import type { GoogleGenAI } from '@google/genai';

const VALUE_SCHEMA = {
  type: Type.OBJECT,
  properties: { value: { type: Type.STRING } },
  required: ['value'],
} as const;

async function generateFieldValue(ai: GoogleGenAI, prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: VALUE_SCHEMA,
    },
  });
  const parsed = JSON.parse(response.text || '{}') as { value?: string };
  return sanitizeAiPlainText((parsed.value || '').trim());
}

async function condenseToMaxLength(
  ai: GoogleGenAI,
  text: string,
  maxLen: number,
  label: string,
  hint: string,
  language: TenantLanguage
): Promise<string> {
  const lang = aiLanguageLabel(language);
  const condensed = await generateFieldValue(
    ai,
    `Condense the "${label}" field text to a STRICT MAXIMUM of ${maxLen} characters (spaces included).
Current text has ${text.length} characters — output MUST be ${maxLen} or fewer.
Keep essential root cause and technical details; remove redundancy.

Field instructions:
${hint}

${AI_PLAIN_TEXT_PROMPT_RULES}

Text to condense:
"""
${text.slice(0, 14000)}
"""

Respond only JSON { "value": "condensed text in ${lang}" }.`
  );
  return condensed || text;
}

function localeCoherenceRules(
  language: TenantLanguage,
  label: string,
  hasFilledLocale: boolean,
  brevity: boolean
): string {
  if (!hasFilledLocale) return '';
  const lang = language === 'en' ? 'locale' : 'español';
  if (brevity) {
    return `- Other ${lang} fields are in context: keep coherence (same vulnerability, severity, style).
- If "${label}" already has text, CONDENSE and rewrite per field instructions; do not repeat other fields.
- Do not copy paragraphs from other fields; write specific, brief content for "${label}".`;
  }
  return `- Other ${lang} fields are in context: keep coherence (same vulnerability, severity, style).
- If "${label}" already has text, IMPROVE or replace with a clearer, more complete version.
- Do not copy paragraphs from other fields; write specific content for "${label}".`;
}

function localeGeneralRules(language: TenantLanguage): string {
  if (language === 'en') {
    return `- Professional English for security reports.
- Read and use ALL non-empty context fields, especially Description, Danger, Solution, Severity, CVE, CWE.
- Do not invent CVEs, versions or data not in context.
- If information is missing, write conservatively without hallucinating.
- Output must be entirely in English.`;
  }
  return `- Español profesional para informes de seguridad en México/LATAM.
- Debes leer y usar TODOS los campos del contexto que no estén vacíos, especialmente Description, Danger, Solution, Severity, CVE, CWE y nombres en inglés.
- Traduce/adapta al español; no dejes información relevante del inglés sin reflejar en el campo destino.
- No inventes CVE, versiones ni datos que no estén en el contexto.
- Si falta información para un apartado, redacta de forma conservadora sin alucinar.
- El resultado debe ser únicamente en español.`;
}

export async function handleSuggestCatalogLocale(body: Record<string, unknown>) {
  const {
    field,
    language: rawLanguage,
    sourceContext,
    englishContext,
    currentValue,
    currentSpanish,
    fieldHint,
    hasFilledLocale,
    hasFilledSpanish,
    hasCurrentFieldValue,
    sourceHint,
    nonEmptyCount,
  } = body;

  const language: TenantLanguage = rawLanguage === 'en' ? 'en' : 'es';
  const fieldKey = String(field || '');

  if (!isCatalogAiColumn(fieldKey, language)) {
    return NextResponse.json({ error: 'Campo no válido' }, { status: 400 });
  }

  const context = String(sourceContext || englishContext || '').trim();
  if (!context) {
    return NextResponse.json({ error: 'Sin contexto para generar sugerencia' }, { status: 400 });
  }

  const ai = getAiClient();
  if (!ai) {
    return NextResponse.json(
      {
        error: 'GEMINI_API_KEY no configurada. Configura la clave para sugerencias con IA.',
      },
      { status: 503 }
    );
  }

  const label = catalogColumnLabel(fieldKey, language);
  const hint = String(fieldHint || '').trim() || getAiPromptForField(fieldKey, undefined, language);
  const current = String(currentValue || currentSpanish || '').trim();
  const brevity = hintRequestsBrevity(hint);
  const maxLen = parseMaxLengthFromFieldHint(hint);
  const filledLocale = Boolean(hasFilledLocale ?? hasFilledSpanish);

  const coherenceRule = localeCoherenceRules(language, label, filledLocale, brevity);

  const currentFieldRule = hasCurrentFieldValue
    ? brevity
      ? `- El valor actual de "${label}" está en el contexto: úsalo solo como referencia y entrégame una versión MÁS BREVE y clara. Sobrescribe el texto anterior; no lo amplíes.`
      : `- El valor actual de "${label}" está en el contexto: úsalo solo como referencia y entrégame una versión MEJORADA (más clara, completa y profesional). Sobrescribe el texto anterior.`
    : '';

  const currentLen = current.length;
  const lengthRule =
    maxLen != null
      ? `- LÍMITE ESTRICTO DE LONGITUD: la respuesta final debe tener COMO MÁXIMO ${maxLen} caracteres (espacios incluidos).${
          currentLen > 0
            ? ` El texto actual tiene ${currentLen} caracteres${
                currentLen > maxLen
                  ? ` — DEBES acortarlo por debajo de ${maxLen}; no devuelvas un texto igual de largo.`
                  : '.'
              }`
            : ''
        } Si el texto actual es más largo, resúmelo sin perder lo esencial técnico.`
      : brevity
        ? '- Prioriza brevedad: evita párrafos largos y detalles que ya figuren en otros campos del informe.'
        : '';

  const sourcePriority = String(sourceHint || '').trim();
  const langLabel = aiLanguageLabel(language);
  const analystRole =
    language === 'en' ? 'You are a cybersecurity analyst.' : 'Eres analista de ciberseguridad.';

  const prompt = `${analystRole} Generate or IMPROVE (overwriting if needed) the ${langLabel} content for the "${label}" field in the vulnerability catalog.

## Full record context (${nonEmptyCount ?? 'various'} non-empty fields)
"""
${context.slice(0, 18000)}
"""

${current && !hasCurrentFieldValue ? `Current value of "${label}" (you may improve or replace): """${current.slice(0, 4000)}"""` : ''}

General rules:
${localeGeneralRules(language)}
${sourcePriority ? `- Priority for this field: ${sourcePriority}` : ''}
${currentFieldRule}
${coherenceRule}
${lengthRule}

Field-specific instructions:
${hint}

${AI_PLAIN_TEXT_PROMPT_RULES}

Respond only with plain text for "${label}", no markdown.`;

  let value = await generateFieldValue(ai, prompt);
  if (!value) {
    return NextResponse.json({ error: 'La IA no devolvió contenido' }, { status: 502 });
  }

  if (maxLen != null && textExceedsFieldHintMax(value, hint)) {
    value = await condenseToMaxLength(ai, value, maxLen, label, hint, language);
  }
  value = applyFieldLengthRules(value, hint);

  return NextResponse.json({ value, source: 'gemini' });
}
