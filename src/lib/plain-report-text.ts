/** Texto plano para campos de informe (sin markdown). Solo explicacion_tecnica admite markdown. */

const LIST_MARKER_RE = /^\s*(?:\d+[.)]\s+|[-*•●◦▪▫]\s+)/;
const HYPHEN_ITEM_RE = /^\s*-\s+/;

/** Ítem de lista en formato informe: " - texto" (espacio, guion, espacio). */
export function formatAiHyphenListLine(text: string): string {
  const body = text.trim();
  if (!body) return '';
  return ` - ${body}`;
}

const INLINE_HYPHEN_ITEM_RE = /(?<=\S)\s+-\s+(?=[A-Z0-9])/g;
const INLINE_HYPHEN_ITEM_TEST_RE = /(?<=\S)\s+-\s+(?=[A-Z0-9])/;

/** Separa ítems « - CVE…» / « - Paso…» que la IA pegó en una sola línea. */
export function expandInlineHyphenListItems(text: string): string {
  return text
    .split('\n')
    .flatMap((line) => {
      if (!INLINE_HYPHEN_ITEM_TEST_RE.test(line)) return [line];
      const segments = line.split(INLINE_HYPHEN_ITEM_RE);
      if (segments.length <= 1) return [line];

      const out: string[] = [];
      for (let i = 0; i < segments.length; i += 1) {
        const seg = segments[i]?.trim() ?? '';
        if (!seg) continue;
        if (i === 0) out.push(seg);
        else out.push(formatAiHyphenListLine(seg));
      }
      return out;
    })
    .join('\n');
}

function normalizeLineListPrefix(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return '';

  if (LIST_MARKER_RE.test(trimmed)) {
    const body = trimmed.replace(LIST_MARKER_RE, '').trim();
    return body ? formatAiHyphenListLine(body) : '';
  }

  if (HYPHEN_ITEM_RE.test(trimmed)) {
    const body = trimmed.replace(HYPHEN_ITEM_RE, '').trim();
    return body ? formatAiHyphenListLine(body) : '';
  }

  return line.trimEnd();
}

export function toPlainReportText(text: string): string {
  if (!text) return '';
  return sanitizeAiPlainText(text);
}

/**
 * Limpia salida de IA: sin markdown ni viñetas.
 * Varios ítems → una línea por ítem con prefijo " - " (guion de informe).
 */
export function sanitizeAiPlainText(text: string): string {
  if (!text) return '';

  let out = text
    .replace(/\r\n/g, '\n')
    .replace(/```[\s\S]*?```/g, (block) =>
      block.replace(/^```\w*\n?/gm, '').replace(/```$/gm, '').trim()
    )
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^---+$/gm, '')
    .replace(/^\*\*\*+$/gm, '');

  out = expandInlineHyphenListItems(out);

  out = out
    .split('\n')
    .map((line) => normalizeLineListPrefix(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return capitalizeLineStarts(out);
}

export function cleanFindingTitle(title: string): string {
  return capitalizeLineStarts(
    toPlainReportText(title)
      .replace(/^\d+(?:\.\d+)*\.?\s*/, '')
      .replace(/^[\*\s]+/, '')
      .trim()
  );
}

/** Reglas de prompt reutilizables para campos de informe en texto plano. */
export const AI_PLAIN_TEXT_PROMPT_RULES = `FORMATO DE SALIDA (OBLIGATORIO):
- Texto plano únicamente: sin Markdown, sin asteriscos, sin negritas, sin encabezados (#), sin bloques de código.
- Sin viñetas Unicode (•, ▪, ◦) ni numeración (1., 2., a., b.).
- Si hay varios ítems (CVE, fallos, actores de amenaza, pasos de remediación, controles, etc.), escribe UN ítem por línea con el prefijo exacto " - " (espacio, guion, espacio) al inicio de cada línea de ítem.
- NUNCA pongas varios ítems en la misma línea: después de cada ítem debe haber un salto de línea real (Enter). Ejemplo correcto:
Los fallos identificados incluyen:
 - CVE-2016-0702: descripción del fallo.
 - CVE-2016-0705: descripción del fallo.
- Los párrafos narrativos van sin guion; solo las líneas de ítems llevan " - " al inicio.
- Sin HTML ni etiquetas.`;

export function capitalizeLineStarts(text: string): string {
  if (!text) return '';
  return text
    .split('\n')
    .map((line) => {
      const stripped = line.trimStart();
      if (!stripped) return line;
      if (/^[#`![|]/.test(stripped)) return line;
      const leading = line.slice(0, line.length - stripped.length);
      const idx = stripped.search(/[a-zA-ZàáäâãåèéêëìíîïòóôõöùúûüñçÀ-ÿ]/);
      if (idx === -1) return line;
      return (
        leading +
        stripped.slice(0, idx) +
        stripped.charAt(idx).toUpperCase() +
        stripped.slice(idx + 1)
      );
    })
    .join('\n');
}
