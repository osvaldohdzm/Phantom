import { NextRequest, NextResponse } from 'next/server';
import { getAiClient } from '@/lib/gemini';
import { applyAnalystRulesToFinding } from '@/lib/gemini-context';
import { parseStructuredFinding } from '@/lib/parse-structured-finding';
import { structureFindingWithGemini } from '@/lib/gemini-structure-finding';

export type SuggestedFindingFields = {
  titulo: string;
  severidad: 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';
  descripcion: string;
  amenaza_ampliada: string;
  propuesta_remediacion: string;
  referencias: string;
  componente_afectado: string;
  metodo_deteccion: string;
  explicacion_tecnica: string;
  cve?: string;
  cwe?: string;
  cvss_score?: number;
};

function normalizeSuggestion(
  parsed: SuggestedFindingFields,
  context?: string
): SuggestedFindingFields {
  const sev = ['Critical', 'High', 'Medium', 'Low', 'Info'].includes(parsed.severidad)
    ? parsed.severidad
    : 'Medium';
  const base = { ...parsed, severidad: sev };
  return applyAnalystRulesToFinding(base, context) as SuggestedFindingFields;
}

function heuristicSuggest(raw: string): SuggestedFindingFields {
  const structured = parseStructuredFinding(raw);
  if (structured && structured.confidence >= 0.35) {
    return structured.suggestion;
  }

  const cveMatch = raw.match(/CVE-\d{4}-\d+/i);
  const cweMatch = raw.match(/CWE-?\d+/i);
  const firstLine = raw.split('\n').find((l) => l.trim())?.trim() || 'Hallazgo detectado';
  return {
    titulo: firstLine.slice(0, 200),
    severidad: /critical|crítico|high|alto/i.test(raw) ? 'High' : 'Medium',
    descripcion: raw.slice(0, 1500),
    amenaza_ampliada:
      'Un atacante podría explotar esta debilidad para comprometer la confidencialidad, integridad o disponibilidad del sistema afectado.',
    propuesta_remediacion:
      '- Aplicar parches de seguridad vigentes.\n- Restringir exposición del servicio.\n- Validar configuración endurecida.',
    referencias: [cveMatch?.[0], cweMatch?.[0]].filter(Boolean).join('\n'),
    componente_afectado: 'Por determinar según alcance del proyecto',
    metodo_deteccion: 'Análisis automatizado / revisión de salida de herramienta',
    explicacion_tecnica: raw.slice(0, 4000),
    cve: cveMatch?.[0],
    cwe: cweMatch?.[0],
  };
}

function geminiQuotaMessage(msg: string): boolean {
  return /429|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(msg);
}

export async function POST(req: NextRequest) {
  try {
    const { rawOutput, context, mode } = await req.json();
    const raw = String(rawOutput || '').trim();
    const ctx = String(context || '').trim();
    if (!raw) {
      return NextResponse.json({ error: 'rawOutput vacío' }, { status: 400 });
    }

    // Modo solo parser local (sin llamar a Gemini)
    if (mode === 'structured') {
      const parsed = parseStructuredFinding(raw);
      if (!parsed) {
        return NextResponse.json(
          {
            error:
              'No se detectaron secciones estructuradas. Usa encabezados como DESCRIPCIÓN, AMENAZA, PROPUESTA DE REMEDIACIÓN…',
          },
          { status: 422 }
        );
      }
      return NextResponse.json({
        suggestion: normalizeSuggestion(parsed.suggestion),
        source: 'structured',
        filledFields: parsed.filledFields,
        confidence: parsed.confidence,
      });
    }

    // Si el texto ya trae secciones de informe, parsear localmente (rápido, sin cuota)
    const structured = parseStructuredFinding(raw);
    if (structured && structured.confidence >= 0.5) {
      return NextResponse.json({
        suggestion: normalizeSuggestion(structured.suggestion),
        source: 'structured',
        filledFields: structured.filledFields,
        confidence: structured.confidence,
        warning: 'Informe estructurado detectado — campos extraídos sin usar Gemini.',
      });
    }

    const ai = getAiClient();
    if (!ai) {
      const fallback = structured ?? { suggestion: heuristicSuggest(raw), filledFields: [], confidence: 0 };
      return NextResponse.json({
        suggestion: normalizeSuggestion(fallback.suggestion),
        source: structured ? 'structured' : 'heuristic',
        filledFields: structured?.filledFields,
        warning: 'GEMINI_API_KEY no configurada — usando análisis local.',
      });
    }

    try {
      const { finding, source } = await structureFindingWithGemini(ai, raw, ctx);
      const { titulo, severidad, descripcion, amenaza_ampliada, propuesta_remediacion, referencias, componente_afectado, metodo_deteccion, explicacion_tecnica, cve, cwe, cvss_score } = finding;
      const suggestion = normalizeSuggestion(
        {
          titulo,
          severidad,
          descripcion,
          amenaza_ampliada,
          propuesta_remediacion,
          referencias,
          componente_afectado,
          metodo_deteccion,
          explicacion_tecnica,
          cve,
          cwe,
          cvss_score,
        },
        ctx
      );
      return NextResponse.json({
        suggestion,
        source,
        filledFields: [
          'titulo',
          'severidad',
          'descripcion',
          'amenaza_ampliada',
          'propuesta_remediacion',
          'referencias',
          'componente_afectado',
          'metodo_deteccion',
          'explicacion_tecnica',
        ].filter((k) => suggestion[k as keyof SuggestedFindingFields]),
      });
    } catch (geminiError: unknown) {
      const msg = geminiError instanceof Error ? geminiError.message : String(geminiError);
      console.error('Gemini suggest-finding:', msg);

      const fallback = structured ?? parseStructuredFinding(raw);
      if (fallback) {
        return NextResponse.json({
          suggestion: normalizeSuggestion(fallback.suggestion),
          source: 'structured',
          filledFields: fallback.filledFields,
          confidence: fallback.confidence,
          warning: geminiQuotaMessage(msg)
            ? 'Cuota de Gemini agotada — campos extraídos del texto estructurado.'
            : `Gemini no disponible — usando análisis local.`,
        });
      }

      return NextResponse.json({
        suggestion: normalizeSuggestion(heuristicSuggest(raw)),
        source: 'heuristic',
        warning: geminiQuotaMessage(msg)
          ? 'Cuota de Gemini agotada — relleno básico aplicado. Revisa cada campo.'
          : 'Gemini falló — relleno básico aplicado.',
      });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('suggest-finding:', msg);
    return NextResponse.json({ error: `No se pudo sugerir campos: ${msg}` }, { status: 500 });
  }
}
