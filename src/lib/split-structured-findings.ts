import { parseStructuredFinding } from '@/lib/parse-structured-finding';
import type { SuggestedFinding } from '@/lib/secops-api';

const SKIP_CHUNK =
  /^(?:##\s+)?(?:Resumen|RESUMEN|Conclusi|CONCLUSI|Tabla de severidades|Estos hallazgos)/i;

/** Divide texto largo en bloques candidatos a hallazgos individuales */
export function splitRawIntoChunks(raw: string): string[] {
  const text = raw.trim();
  if (!text) return [];

  const filterChunks = (chunks: string[]) =>
    chunks
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((c) => !SKIP_CHUNK.test(c))
      .filter((c) => c.length > 80)
      .filter((c) =>
        /vulnerabilidad|DESCRIPCI|AMENAZA|severidad|##\s+\d|\|\s*DESCRIPCI|\|\s*AMENAZA/i.test(c)
      );

  // Tabla markdown por hallazgo: | Título | Severidad |
  const byMdTable = filterChunks(
    text.split(
      /(?=^\|[^|\n]+\|\s*(?:Critical|High|Medium|Low|Info|Informativo|Cr[ií]tic[ao]?|Alta|Media|Baja)\s*\|)/im
    )
  );
  if (byMdTable.length > 1) return byMdTable;

  // Numerado + tabla: 1.1.4. Título … | DESCRIPCIÓN |
  const byNumberedTable = filterChunks(
    text.split(/(?=^\d+(?:\.\d+)+\.\s+\S[^\n]*(?:\n\n|\n)\|)/m)
  );
  if (byNumberedTable.length > 1) return byNumberedTable;

  // Encabezados numerados solos: 1.1.4. Título (sin requerir tabla en la misma línea)
  const byNumberedHeader = filterChunks(
    text.split(/(?=^\d+(?:\.\d+)+\.\s+[A-ZÁÉÍÓÚÑa-z])/m)
  );
  if (byNumberedHeader.length > 1) return byNumberedHeader;

  // ## 1.1.1. Título (informes markdown numerados)
  const byMdNumbered = filterChunks(text.split(/(?=^##\s+\d+(?:\.\d+)+\.\s+\S)/m));
  if (byMdNumbered.length > 1) return byMdNumbered;

  // Separador --- entre hallazgos (con contenido de vulnerabilidad)
  const bySep = filterChunks(
    text.split(/\n---+\n/).filter((c) => /vulnerabilidad|DESCRIPCI|AMENAZA|severidad/i.test(c))
  );
  if (bySep.length > 1) return bySep;

  // **Nombre de vulnerabilidad:**
  const byBoldName = filterChunks(
    text.split(/(?=\*\*Nombre de (?:la )?vulnerabilidad:\*\*)/i)
  );
  if (byBoldName.length > 1) return byBoldName;

  // Nombre de vulnerabilidad: sin bold
  const byName = filterChunks(
    text.split(/(?=^Nombre de (?:la )?vulnerabilidad\s*:)/im)
  );
  if (byName.length > 1) return byName;

  // Informes numerados: .1.1. / 1.1.
  const numbered = filterChunks(text.split(/(?=^(?:\d+(?:\.\d+)+\.|\d+\))\s+\S)/m));
  if (numbered.length > 1) return numbered;

  // Nessus Plugin ID
  const nessusBlocks = filterChunks(text.split(/(?=^Plugin (?:ID|Name)\s*:)/im));
  if (nessusBlocks.length > 1) return nessusBlocks;

  return [text];
}

/** Estima cuántos hallazgos independientes hay en el texto. */
export function countLikelyFindings(raw: string): number {
  const text = raw.trim();
  if (!text) return 0;

  const tableTitles =
    text.match(
      /^\|[^|\n]+\|\s*(?:Critical|High|Medium|Low|Info|Informativo|Cr[ií]tic[ao]?|Alta|Media|Baja)\s*\|/gim
    )?.length ?? 0;
  const numbered = text.match(/^\d+(?:\.\d+)+\.\s+[A-ZÁÉÍÓÚÑ]/gm)?.length ?? 0;
  const mdHeadings = text.match(/^##\s+\d+(?:\.\d+)+\./gm)?.length ?? 0;
  const nessus = text.match(/^Plugin (?:ID|Name)\s*:/gim)?.length ?? 0;

  return Math.max(tableTitles, numbered, mdHeadings, nessus, 1);
}

export function parseMultipleStructuredFindings(raw: string): {
  findings: SuggestedFinding[];
  filledFields: string[][];
  chunks: string[];
} {
  const chunks = splitRawIntoChunks(raw);
  const findings: SuggestedFinding[] = [];
  const filledFields: string[][] = [];

  for (const chunk of chunks) {
    const parsed = parseStructuredFinding(chunk);
    if (parsed && parsed.confidence >= 0.2) {
      findings.push(parsed.suggestion);
      filledFields.push(parsed.filledFields);
    }
  }

  return { findings, filledFields, chunks };
}

export function heuristicSplitFindings(raw: string): SuggestedFinding[] {
  const { findings, chunks } = parseMultipleStructuredFindings(raw);
  if (findings.length) return findings;

  return chunks.map((chunk, i) => {
    const firstLine = chunk.split('\n').find((l) => l.trim())?.trim() || `Hallazgo ${i + 1}`;
    const cve = chunk.match(/CVE-\d{4}-\d+/i)?.[0];
    const cwe = chunk.match(/CWE-?\d+/i)?.[0];
    return {
      titulo: firstLine.replace(/^\#+\s*/, '').replace(/^\d+(?:\.\d+)*\.?\s*/, '').replace(/^\*\*|\*\*$/g, '').slice(0, 200),
      severidad: /critical|crítico|high|alto/i.test(chunk) ? 'High' : /info|informativo/i.test(chunk) ? 'Info' : /baj|low/i.test(chunk) ? 'Low' : 'Medium',
      descripcion: chunk.slice(0, 1500),
      amenaza_ampliada:
        'Un atacante podría explotar esta debilidad para comprometer la confidencialidad, integridad o disponibilidad del sistema.',
      propuesta_remediacion: '• Aplicar controles de mitigación recomendados.\n• Validar configuración endurecida.',
      referencias: [cve, cwe].filter(Boolean).join('\n'),
      componente_afectado: '',
      metodo_deteccion: 'Análisis automatizado / revisión de salida de herramienta',
      explicacion_tecnica: '',
      cve,
      cwe,
    } as SuggestedFinding;
  });
}
