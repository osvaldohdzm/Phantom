/** Detección UTF-8 vs Windows-1252 / ISO-8859-1 para CSV en español. */

const SPANISH = /[áéíóúñÁÉÍÓÚÑüÜ]/g;
const MOJIBAKE = /[\uFFFD]|Ã./g;

export type CsvEncoding = 'auto' | 'utf-8' | 'cp1252' | 'latin-1';

export function spanishCharCount(text: string): number {
  return (text.match(SPANISH) || []).length;
}

function scoreText(text: string): number {
  let score = (text.match(/\uFFFD/g) || []).length * 200;
  score += (text.match(MOJIBAKE) || []).length * 8;
  score -= spanishCharCount(text) * 3;
  return score;
}

const DECODER_LABEL: Record<Exclude<CsvEncoding, 'auto'>, string> = {
  'utf-8': 'utf-8',
  cp1252: 'windows-1252',
  'latin-1': 'iso-8859-1',
};

export function decodeCsvBytes(data: Uint8Array, encoding: CsvEncoding = 'auto'): string {
  if (encoding !== 'auto') {
    const label = DECODER_LABEL[encoding];
    try {
      return new TextDecoder(label, { fatal: true }).decode(data);
    } catch {
      return new TextDecoder(label).decode(data);
    }
  }

  const tryEncodings = ['utf-8', 'windows-1252', 'iso-8859-1'] as const;
  let best: { score: number; text: string } | null = null;

  for (const enc of tryEncodings) {
    try {
      const text = new TextDecoder(enc, { fatal: true }).decode(data);
      const s = scoreText(text);
      if (!best || s < best.score) best = { score: s, text };
    } catch {
      /* esta codificación no aplica a estos bytes */
    }
  }

  if (best && !best.text.includes('\uFFFD')) return best.text;

  const cp1252 = new TextDecoder('windows-1252').decode(data);
  if (!best || scoreText(cp1252) < best.score) return cp1252;
  return best.text;
}

export function fixTextEncoding(text: string | null | undefined): string {
  if (!text) return text ?? '';
  const trimmed = text.trim();
  if (!trimmed) return text;

  const candidates = [text];

  if (text.includes('Ã') || text.includes('\uFFFD')) {
    for (const enc of ['iso-8859-1', 'windows-1252'] as const) {
      try {
        const bytes = new Uint8Array([...text].map((c) => c.charCodeAt(0) & 0xff));
        const fixed = new TextDecoder('utf-8').decode(bytes);
        if (fixed && fixed !== text) candidates.push(fixed);
      } catch {
        /* ignore */
      }
    }
  }

  for (const enc of ['iso-8859-1', 'windows-1252'] as const) {
    try {
      const fixed = new TextDecoder('utf-8').decode(
        new TextEncoder().encode([...text].map((c) => String.fromCharCode(c.charCodeAt(0) & 0xff)).join(''))
      );
      if (fixed !== text) candidates.push(fixed);
    } catch {
      try {
        const latin = [...text].map((c) => c.charCodeAt(0) & 0xff);
        const fixed = new TextDecoder('utf-8').decode(new Uint8Array(latin));
        if (fixed !== text) candidates.push(fixed);
      } catch {
        /* ignore */
      }
    }
  }

  try {
    const mojibakeFix = new TextDecoder('utf-8').decode(
      new Uint8Array([...text].map((c) => c.charCodeAt(0) & 0xff))
    );
    if (mojibakeFix !== text) candidates.push(mojibakeFix);
  } catch {
    /* ignore */
  }

  return candidates.reduce((a, b) => (scoreText(a) <= scoreText(b) ? a : b));
}

export function repairFindingDisplayText<T extends { titulo?: string | null; descripcion?: string | null }>(
  finding: T
): T {
  return {
    ...finding,
    titulo: fixTextEncoding(finding.titulo),
    descripcion: finding.descripcion ? fixTextEncoding(finding.descripcion) : finding.descripcion,
  };
}
