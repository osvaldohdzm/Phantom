import { capitalizeLineStarts, sanitizeAiPlainText } from '@/lib/plain-report-text';

/** Contexto y restricciones del analista para prompts Gemini. */

export type GeminiContextInput = {
  projectName?: string;
  engagementId?: string;
  analystNotes?: string;
};

/** Notas del analista primero (máxima prioridad), luego metadatos del proyecto. */
export function buildGeminiContext(input: GeminiContextInput): string | undefined {
  const parts: string[] = [];
  if (input.analystNotes?.trim()) {
    parts.push(input.analystNotes.trim());
  }
  if (input.projectName?.trim()) {
    parts.push(`Proyecto/cliente: ${input.projectName.trim()}`);
  }
  if (input.engagementId?.trim()) {
    parts.push(`Engagement ID: ${input.engagementId.trim()}`);
  }
  return parts.length ? parts.join('\n') : undefined;
}

const PROHIBITION_LINE =
  /^\s*(?:no\s+mencion\w*|sin\s+mencionar|no\s+uses?\w*|evita\s+mencionar|prohibido\s+mencionar)/i;

/** Detecta si el analista pide no mencionar HAR / archivo HAR (tolera typos). */
export function analystForbidsHar(context?: string | null): boolean {
  const ctx = (context || '').trim();
  if (!ctx) return false;
  if (!/\bhar\b/i.test(ctx)) return false;
  if (PROHIBITION_LINE.test(ctx)) return true;
  if (/\bno\b[\s\S]{0,120}\bhar\b/i.test(ctx)) return true;
  if (/\bsin\b[\s\S]{0,120}\bhar\b/i.test(ctx)) return true;
  if (/\bevita\b[\s\S]{0,120}\bhar\b/i.test(ctx)) return true;
  return false;
}

/** Líneas del contexto que son instrucciones restrictivas del analista. */
export function extractAnalystConstraintLines(context?: string | null): string[] {
  const ctx = (context || '').trim();
  if (!ctx) return [];
  return ctx
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l && PROHIBITION_LINE.test(l));
}

export function formatAnalystConstraintsBlock(context?: string | null): string {
  const lines = extractAnalystConstraintLines(context);
  const harForbidden = analystForbidsHar(context);

  const bullets: string[] = [...lines];

  if (harForbidden && !bullets.some((l) => /\bhar\b/i.test(l))) {
    bullets.push('NO mencionar HAR ni archivo HAR en ningún campo del informe.');
  }

  if (!bullets.length) return '';

  const harRule = harForbidden
    ? `
Regla específica HAR (CRÍTICA):
- PROHIBIDO escribir "HAR", "archivo HAR", "export HAR" o "HTTP Archive" en título, descripción, amenaza, explicación, método de detección o cualquier campo.
- Describe la evidencia como: tráfico HTTP, peticiones HTTP, respuestas HTTP, captura de tráfico en navegador, herramientas de desarrollador (pestaña Red/Network).
- metodo_deteccion: usar "Análisis de tráfico HTTP" o "Revisión de peticiones HTTP en navegador", NUNCA "análisis de HAR".
- Aunque la salida cruda sea un JSON HAR, redacta como análisis de tráfico HTTP sin nombrar el formato HAR.`
    : '';

  return `## RESTRICCIONES DEL ANALISTA (PRIORIDAD MÁXIMA — incumplir es error)
Estas reglas prevalecen sobre el contenido del raw output y sobre tus suposiciones:
${bullets.map((l) => `- ${l}`).join('\n')}
${harRule}
`;
}

/** Bloque de prompt: contexto antes del raw output. */
export function formatGeminiContextPromptBlock(context?: string | null): string {
  const ctx = (context || '').trim();
  const constraints = formatAnalystConstraintsBlock(ctx);

  if (!ctx) {
    return `${constraints}## Contexto del proyecto
(No se proporcionó contexto adicional. Infiera solo desde la salida cruda.)`;
  }

  return `${constraints}## Contexto del proyecto (OBLIGATORIO)
Las instrucciones y restricciones del analista arriba tienen prioridad absoluta.
Usa el contexto para componente_afectado, metodo_deteccion, severidad y redacción:

${ctx}`;
}

const HAR_TEXT_REPLACEMENTS: [RegExp, string][] = [
  [/\bHTTP\s+Archive\b/gi, 'tráfico HTTP'],
  [/\barchivo\s+HAR\b/gi, 'captura de tráfico HTTP'],
  [/\bel\s+HAR\s+exportado\b/gi, 'la captura de tráfico HTTP'],
  [/\bHAR\s+exportado\b/gi, 'captura de tráfico HTTP'],
  [/\ben\s+el\s+HAR\b/gi, 'en el tráfico HTTP observado'],
  [/\bdel\s+HAR\b/gi, 'del tráfico HTTP'],
  [/\bal\s+HAR\b/gi, 'al tráfico HTTP'],
  [/\bexport(?:ar|e)?\s+(?:el\s+)?HAR\b/gi, 'capturar tráfico HTTP'],
  [/\ban[aá]lisis\s+de\s+(?:archivo\s+)?HAR\b/gi, 'análisis de tráfico HTTP'],
  [/\bHAR\b/g, 'tráfico HTTP'],
];

/** Sustituye términos prohibidos cuando el analista lo pidió (red de seguridad). */
export function applyAnalystTextRules(text: string, context?: string | null): string {
  let out = text;
  if (analystForbidsHar(context)) {
    for (const [pattern, replacement] of HAR_TEXT_REPLACEMENTS) {
      out = out.replace(pattern, replacement);
    }
    out = out.replace(/\btráfico HTTP\s+tráfico HTTP\b/gi, 'tráfico HTTP');
  }
  return out;
}

const FINDING_TEXT_KEYS = [
  'titulo',
  'descripcion',
  'amenaza_ampliada',
  'propuesta_remediacion',
  'referencias',
  'componente_afectado',
  'metodo_deteccion',
  'explicacion_tecnica',
  'raw_snippet',
] as const;

/** Reglas de redacción del informe (mayúscula inicial, restricciones del analista). */
export function applyReportTextRules(
  text: string,
  context?: string | null,
  options?: { allowMarkdown?: boolean }
): string {
  const ruled = applyAnalystTextRules(text, context);
  if (options?.allowMarkdown) {
    return capitalizeLineStarts(ruled);
  }
  return sanitizeAiPlainText(ruled);
}

/** Aplica reglas del analista y formato de informe a todos los campos de texto. */
export function applyAnalystRulesToFinding<T extends Record<string, unknown>>(
  finding: T,
  context?: string | null
): T {
  const next = { ...finding } as Record<string, unknown>;
  for (const key of FINDING_TEXT_KEYS) {
    if (key === 'raw_snippet') continue;
    if (typeof next[key] === 'string') {
      next[key] = applyReportTextRules(next[key] as string, context, {
        allowMarkdown: key === 'explicacion_tecnica',
      });
    }
  }
  return next as T;
}
