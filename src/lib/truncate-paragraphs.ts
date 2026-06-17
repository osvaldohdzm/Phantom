/** Máximo de párrafos para EspExplicacionTecnica en acciones correctivas. */
export const EXPLICACION_TECNICA_MAX_PARAGRAPHS = 2;

/**
 * Divide por líneas en blanco y conserva los primeros `maxParagraphs` párrafos.
 */
export function splitParagraphs(text: string): string[] {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Recorta texto a como máximo N párrafos (separados por línea en blanco). */
export function truncateToParagraphs(text: string, maxParagraphs: number): string {
  const trimmed = text.trim();
  if (!trimmed || maxParagraphs < 1) return trimmed;

  const paragraphs = splitParagraphs(trimmed);
  if (paragraphs.length <= maxParagraphs) return trimmed;

  return paragraphs.slice(0, maxParagraphs).join('\n\n');
}
