/** Extrae un máximo de caracteres declarado en el prompt personalizado del campo. */
export function parseMaxLengthFromFieldHint(hint: string): number | null {
  const text = hint.trim();
  if (!text) return null;

  const patterns = [
    /menos\s+de\s+(\d{1,6})\s*(?:car[aá]cteres?|chars?)?/i,
    /menor\s+(?:a|que)\s+(\d{1,6})\s*(?:car[aá]cteres?|chars?)?/i,
    /por\s+debajo\s+de\s+(\d{1,6})\s*(?:car[aá]cteres?|chars?)?/i,
    /m[aá]ximo\s+(?:de\s+)?(\d{1,6})\s*(?:car[aá]cteres?|chars?)?/i,
    /max(?:imo|imum)?\s*:?\s*(\d{1,6})\s*(?:car[aá]cteres?|chars?)?/i,
    /no\s+(?:debe\s+)?exced(?:a|er)\s+(?:de\s+)?(\d{1,6})\s*(?:car[aá]cteres?|chars?)?/i,
    /<\s*(\d{1,6})\s*(?:car[aá]cteres?|chars?)?/i,
    /(\d{1,6})\s*(?:car[aá]cteres?|chars?)\s+m[aá]ximo/i,
    /hasta\s+(\d{1,6})\s*(?:car[aá]cteres?|chars?)?/i,
    /l[ií]mite\s+(?:estricto\s+)?(?:de\s+)?(\d{1,6})\s*(?:car[aá]cteres?|chars?)?/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const n = Number.parseInt(m[1], 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

/** El prompt pide texto breve o acotado (no expandir). */
export function hintRequestsBrevity(hint: string): boolean {
  const text = hint.trim();
  if (!text) return false;
  if (parseMaxLengthFromFieldHint(text) !== null) return true;
  return /\b(concis|breve|resumid|acotad|cort[oa]|sint[eé]tic|condens|compact)\w*/i.test(text);
}

/** Recorta al máximo permitido, preferiblemente en un espacio. */
export function enforceMaxFieldLength(text: string, maxLen: number): string {
  if (!text || text.length <= maxLen) return text;
  const slice = text.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > Math.floor(maxLen * 0.55)) {
    return slice.slice(0, lastSpace).trimEnd();
  }
  return slice.trimEnd();
}

export function applyFieldLengthRules(text: string, hint: string): string {
  const maxLen = parseMaxLengthFromFieldHint(hint);
  if (maxLen == null) return text;
  return enforceMaxFieldLength(text, maxLen);
}

/** Indica si el texto supera el máximo declarado en el prompt del campo. */
export function textExceedsFieldHintMax(text: string, hint: string): boolean {
  const maxLen = parseMaxLengthFromFieldHint(hint);
  if (maxLen == null) return false;
  return text.length > maxLen;
}
