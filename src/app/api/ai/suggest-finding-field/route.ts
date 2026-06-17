import { NextRequest, NextResponse } from 'next/server';
import { getAiClient } from '@/lib/gemini';
import {
  analystForbidsHar,
  applyReportTextRules,
  formatGeminiContextPromptBlock,
} from '@/lib/gemini-context';
import { parseStructuredFinding } from '@/lib/parse-structured-finding';
import { AI_FIELD_LABELS, type AiFormFieldKey } from '@/lib/ai-form-fields';
import { Type } from '@google/genai';
import { AI_PLAIN_TEXT_PROMPT_RULES } from '@/lib/plain-report-text';

const VALID_FIELDS: AiFormFieldKey[] = [
  'titulo',
  'severidad',
  'descripcion',
  'amenaza_ampliada',
  'propuesta_remediacion',
  'referencias',
  'metodo_deteccion',
  'componentes_afectados',
  'explicacion_tecnica',
  'cve',
  'cwe',
  'cvss_score',
];

function fromStructured(field: AiFormFieldKey, raw: string): string | string[] | undefined {
  const parsed = parseStructuredFinding(raw);
  if (!parsed) return undefined;
  const s = parsed.suggestion;
  switch (field) {
    case 'titulo':
      return s.titulo;
    case 'severidad':
      return s.severidad;
    case 'descripcion':
      return s.descripcion;
    case 'amenaza_ampliada':
      return s.amenaza_ampliada;
    case 'propuesta_remediacion':
      return s.propuesta_remediacion;
    case 'referencias':
      return s.referencias;
    case 'metodo_deteccion':
      return s.metodo_deteccion;
    case 'componentes_afectados':
      return s.componente_afectado
        .split('\n')
        .map((l) => l.replace(/^[\s●•\-*]+/, '').trim())
        .filter(Boolean);
    case 'explicacion_tecnica':
      return s.explicacion_tecnica;
    case 'cve':
      return s.cve;
    case 'cwe':
      return s.cwe;
    case 'cvss_score':
      return s.cvss_score != null ? String(s.cvss_score) : undefined;
    default:
      return undefined;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { rawOutput, context, field, currentValues } = await req.json();
    const raw = String(rawOutput || '').trim();
    const ctx = String(context || '').trim();
    const fieldKey = String(field || '') as AiFormFieldKey;

    if (!raw) {
      return NextResponse.json({ error: 'rawOutput vacío' }, { status: 400 });
    }
    if (!VALID_FIELDS.includes(fieldKey)) {
      return NextResponse.json({ error: 'Campo no válido' }, { status: 400 });
    }

    const structuredVal = fromStructured(fieldKey, raw);
    if (structuredVal !== undefined && structuredVal !== '' && !(Array.isArray(structuredVal) && !structuredVal.length)) {
      return NextResponse.json({ value: structuredVal, source: 'structured' });
    }

    const ai = getAiClient();
    if (!ai) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY no configurada y no hay valor estructurado para este campo.' },
        { status: 503 }
      );
    }

    const label = AI_FIELD_LABELS[fieldKey];
    const prompt = `Eres analista de ciberseguridad. Genera SOLO el valor para el campo "${label}" de un informe de vulnerabilidad en español.

${formatGeminiContextPromptBlock(ctx)}

Valores actuales del formulario (referencia): ${JSON.stringify(currentValues || {}).slice(0, 2000)}

## Salida cruda / evidencia
"""
${raw.slice(0, 16000)}
"""

Cumple TODAS las restricciones del analista antes que cualquier otra regla.
Aplica el contexto del proyecto al redactar este campo.
${analystForbidsHar(ctx) ? 'NO uses la palabra HAR; describe tráfico/peticiones HTTP.\n' : ''}
Responde únicamente con el contenido del campo "${label}", sin explicaciones extra.
${fieldKey === 'severidad' ? 'Valores permitidos: Critical, High, Medium, Low, Info' : ''}
${fieldKey === 'componentes_afectados' ? 'Responde como array JSON de strings, uno por activo/ruta.' : ''}
${fieldKey !== 'explicacion_tecnica' ? AI_PLAIN_TEXT_PROMPT_RULES : ''}`;

    const schema =
      fieldKey === 'severidad'
        ? { type: Type.OBJECT, properties: { value: { type: Type.STRING } }, required: ['value'] }
        : fieldKey === 'componentes_afectados'
          ? {
              type: Type.OBJECT,
              properties: { value: { type: Type.ARRAY, items: { type: Type.STRING } } },
              required: ['value'],
            }
          : fieldKey === 'cvss_score'
            ? {
                type: Type.OBJECT,
                properties: { value: { type: Type.NUMBER } },
                required: ['value'],
              }
            : {
                type: Type.OBJECT,
                properties: { value: { type: Type.STRING } },
                required: ['value'],
              };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    let value = parsed.value;
    if (fieldKey === 'cvss_score' && typeof value === 'number') {
      value = String(value);
    }

    if (typeof value === 'string') {
      return NextResponse.json({
        value: applyReportTextRules(value, ctx, {
          allowMarkdown: fieldKey === 'explicacion_tecnica',
        }),
        source: 'gemini',
      });
    }
    if (Array.isArray(value)) {
      return NextResponse.json({
        value: value.map((v) => applyReportTextRules(String(v), ctx)),
        source: 'gemini',
      });
    }
    return NextResponse.json({ value, source: 'gemini' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('suggest-finding-field:', msg);
    return NextResponse.json({ error: `No se pudo sugerir el campo: ${msg}` }, { status: 500 });
  }
}
