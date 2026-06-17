import { Type } from '@google/genai';

export type StructuredFindingFields = {
  titulo: string;
  severidad: 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';
  descripcion: string;
  amenaza_ampliada: string;
  propuesta_remediacion: string;
  referencias: string;
  componente_afectado: string;
  metodo_deteccion: string;
  explicacion_tecnica: string;
  raw_snippet?: string;
  cve?: string;
  cwe?: string;
  cvss_score?: number;
};

export const SEVERITIES = ['Critical', 'High', 'Medium', 'Low', 'Info'] as const;

/** JSON Schema estricto para Gemini — un hallazgo completo. */
export const GEMINI_FINDING_SCHEMA = {
  type: Type.OBJECT,
  required: [
    'titulo',
    'severidad',
    'descripcion',
    'amenaza_ampliada',
    'propuesta_remediacion',
    'referencias',
    'componente_afectado',
    'metodo_deteccion',
    'explicacion_tecnica',
    'raw_snippet',
  ],
  properties: {
    titulo: {
      type: Type.STRING,
      description: 'Nombre corto de la vulnerabilidad, sin severidad ni numeración.',
    },
    severidad: {
      type: Type.STRING,
      description: 'Exactamente uno de: Critical, High, Medium, Low, Info',
    },
    descripcion: {
      type: Type.STRING,
      description: 'Párrafo DESCRIPCIÓN: qué es la debilidad y dónde se observa. Mínimo 2 oraciones.',
    },
    amenaza_ampliada: {
      type: Type.STRING,
      description: 'Párrafo AMENAZA/impacto: qué podría lograr un atacante. Mínimo 2 oraciones.',
    },
    propuesta_remediacion: {
      type: Type.STRING,
      description: 'Pasos de remediación, una por línea con guión o número.',
    },
    referencias: {
      type: Type.STRING,
      description: 'CWE, CVE, OWASP, CIS — una referencia por línea.',
    },
    componente_afectado: {
      type: Type.STRING,
      description: 'Hosts, URLs, rutas o variables afectadas.',
    },
    metodo_deteccion: {
      type: Type.STRING,
      description: 'Cómo se detectó (herramienta, prueba manual, análisis de cabeceras…).',
    },
    explicacion_tecnica: {
      type: Type.STRING,
      description: 'Detalle técnico adicional; markdown ligero permitido.',
    },
    raw_snippet: {
      type: Type.STRING,
      description: 'SOLO peticiones HTTP, respuestas o salida de herramienta. Máx 2000 caracteres. Sin tablas de secciones.',
    },
    cve: { type: Type.STRING },
    cwe: { type: Type.STRING },
    cvss_score: { type: Type.NUMBER },
  },
};

/** Schema para detectar límites entre hallazgos en texto largo. */
export const GEMINI_BOUNDARY_SCHEMA = {
  type: Type.OBJECT,
  required: ['findings'],
  properties: {
    findings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ['titulo', 'marcador_inicio'],
        properties: {
          titulo: { type: Type.STRING, description: 'Título del hallazgo' },
          marcador_inicio: {
            type: Type.STRING,
            description: 'Primera línea o encabezado del hallazgo, COPIA LITERAL del texto original (mín 15 chars).',
          },
        },
      },
    },
  },
};

const BOILERPLATE =
  /un atacante podr[ií]a explotar esta debilidad|aplicar parches de seguridad|pasos recomendados:/i;

export function normalizeSeverity(raw: unknown): StructuredFindingFields['severidad'] {
  const s = String(raw || 'Medium').trim();
  if (/crit/i.test(s)) return 'Critical';
  if (/alt|high/i.test(s)) return 'High';
  if (/med|medium/i.test(s)) return 'Medium';
  if (/baj|low/i.test(s)) return 'Low';
  if (/info|informativo/i.test(s)) return 'Info';
  return SEVERITIES.includes(s as StructuredFindingFields['severidad'])
    ? (s as StructuredFindingFields['severidad'])
    : 'Medium';
}

export function validateStructuredFinding(f: Partial<StructuredFindingFields>): string[] {
  const errors: string[] = [];
  if (!f.titulo?.trim() || f.titulo.trim().length < 5) errors.push('titulo vacío o muy corto');
  if (!f.descripcion?.trim() || f.descripcion.trim().length < 30) errors.push('descripcion vacía o insuficiente');
  if (!f.amenaza_ampliada?.trim() || f.amenaza_ampliada.trim().length < 30) {
    errors.push('amenaza_ampliada vacía o insuficiente');
  }
  if (!f.propuesta_remediacion?.trim() || f.propuesta_remediacion.trim().length < 15) {
    errors.push('propuesta_remediacion vacía');
  }
  if (f.descripcion && /\|\s*DESCRIPCI/i.test(f.descripcion)) {
    errors.push('descripcion contiene tabla sin parsear');
  }
  if (f.raw_snippet && f.raw_snippet.length > 2500) errors.push('raw_snippet demasiado largo');
  if (
    f.descripcion &&
    f.amenaza_ampliada &&
    f.descripcion.trim() === f.amenaza_ampliada.trim()
  ) {
    errors.push('descripcion y amenaza son idénticas');
  }
  if (f.descripcion && BOILERPLATE.test(f.descripcion) && f.descripcion.length < 80) {
    errors.push('descripcion genérica');
  }
  return errors;
}

export function coerceFindingFields(raw: Record<string, unknown>): StructuredFindingFields {
  const str = (k: string) => String(raw[k] ?? '').trim();
  return {
    titulo: str('titulo').slice(0, 300),
    severidad: normalizeSeverity(raw.severidad),
    descripcion: str('descripcion'),
    amenaza_ampliada: str('amenaza_ampliada'),
    propuesta_remediacion: str('propuesta_remediacion'),
    referencias: str('referencias'),
    componente_afectado: str('componente_afectado'),
    metodo_deteccion: str('metodo_deteccion'),
    explicacion_tecnica: str('explicacion_tecnica'),
    raw_snippet: str('raw_snippet').slice(0, 2000),
    cve: str('cve') || undefined,
    cwe: str('cwe') || undefined,
    cvss_score:
      typeof raw.cvss_score === 'number' && !Number.isNaN(raw.cvss_score)
        ? raw.cvss_score
        : undefined,
  };
}
