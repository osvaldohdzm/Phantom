import { NextRequest, NextResponse } from 'next/server';
import { getAiClient } from '@/lib/gemini';
import { getAiPromptForField } from '@/lib/catalog-field-config';
import { catalogColumnLabel } from '@/lib/vulns-catalog-columns';
import {
  CATALOG_SPANISH_AI_FIELDS,
  type CatalogSpanishAiField,
} from '@/lib/catalog-ai-fields';
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

async function generateFieldValue(
  ai: GoogleGenAI,
  prompt: string
): Promise<string> {
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
  hint: string
): Promise<string> {
  const condensed = await generateFieldValue(
    ai,
    `Condensa el texto del campo "${label}" a un MÁXIMO ESTRICTO de ${maxLen} caracteres (espacios incluidos).
El texto actual tiene ${text.length} caracteres — la salida DEBE quedar en ${maxLen} o menos.
Conserva causa raíz y detalles técnicos esenciales; elimina redundancia y repeticiones de otros campos del informe.

Instrucciones del campo:
${hint}

${AI_PLAIN_TEXT_PROMPT_RULES}

Texto a condensar:
"""
${text.slice(0, 14000)}
"""

Responde solo JSON { "value": "texto condensado en español" }.`
  );
  return condensed || text;
}

export async function POST(req: NextRequest) {
  try {
    const {
      field,
      englishContext,
      currentSpanish,
      fieldHint,
      hasFilledSpanish,
      hasCurrentFieldValue,
      sourceHint,
      nonEmptyCount,
    } = await req.json();
    const fieldKey = String(field || '') as CatalogSpanishAiField;

    if (!CATALOG_SPANISH_AI_FIELDS.includes(fieldKey)) {
      return NextResponse.json({ error: 'Campo no válido' }, { status: 400 });
    }

    const context = String(englishContext || '').trim();
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

    const label = catalogColumnLabel(fieldKey);
    const hint = String(fieldHint || '').trim() || getAiPromptForField(fieldKey);
    const current = String(currentSpanish || '').trim();
    const brevity = hintRequestsBrevity(hint);
    const maxLen = parseMaxLengthFromFieldHint(hint);

    const coherenceRule = hasFilledSpanish
      ? brevity
        ? `- Hay campos Español en el contexto: mantén coherencia (misma vulnerabilidad, severidad, estilo).
- Si "${label}" ya tiene texto, CONDÉNSALO y reescríbelo según las instrucciones específicas; elimina redundancia y no repitas otros campos.
- No copies literalmente párrafos de otros campos; redacta contenido específico y breve para "${label}".`
        : `- Hay campos Español en el contexto: mantén coherencia (misma vulnerabilidad, severidad, estilo).
- Si "${label}" ya tiene texto, DEBES mejorarlo o reemplazarlo por una versión más clara y completa; nunca devuelvas el mismo texto sin cambios.
- No copies literalmente párrafos de otros campos; redacta contenido específico para "${label}".`
      : '';

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

    const prompt = `Eres analista de ciberseguridad. Genera o MEJORA (sobrescribiendo si hace falta) el contenido en ESPAÑOL para el campo "${label}" del catálogo de vulnerabilidades.

## Contexto completo del registro (${nonEmptyCount ?? 'varios'} campos no vacíos: inglés, técnico y español ya completados)
"""
${context.slice(0, 18000)}
"""

${current && !hasCurrentFieldValue ? `Valor actual de "${label}" (puedes mejorarlo o reemplazarlo): """${current.slice(0, 4000)}"""` : ''}

Reglas generales:
- Español profesional para informes de seguridad en México/LATAM.
- Debes leer y usar TODOS los campos del contexto que no estén vacíos, especialmente Description, Danger, Solution, Severity, CVE, CWE y nombres en inglés.
- Traduce/adapta al español; no dejes información relevante del inglés sin reflejar en el campo destino.
- No inventes CVE, versiones ni datos que no estén en el contexto.
- Si falta información para un apartado, redacta de forma conservadora sin alucinar.
- El resultado debe ser únicamente en español.
${sourcePriority ? `- Prioridad para este campo: ${sourcePriority}` : ''}
${currentFieldRule}
${coherenceRule}

Instrucciones específicas para este campo:
${hint}

${AI_PLAIN_TEXT_PROMPT_RULES}

Responde solo con el texto plano del campo "${label}", sin formato markdown.`;

    let value = await generateFieldValue(ai, prompt);
    if (!value) {
      return NextResponse.json({ error: 'La IA no devolvió contenido' }, { status: 502 });
    }

    if (maxLen != null && textExceedsFieldHintMax(value, hint)) {
      value = await condenseToMaxLength(ai, value, maxLen, label, hint);
    }
    value = applyFieldLengthRules(value, hint);

    return NextResponse.json({ value, source: 'gemini' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('suggest-catalog-spanish:', msg);
    return NextResponse.json({ error: `No se pudo sugerir el campo: ${msg}` }, { status: 500 });
  }
}
