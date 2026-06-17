import { NextRequest, NextResponse } from 'next/server';
import { getAiClient } from '@/lib/gemini';
import { applyAnalystRulesToFinding } from '@/lib/gemini-context';
import { type StructuredFindingFields } from '@/lib/gemini-finding-schema';
import {
  detectFindingBoundariesWithGemini,
  structureManyFindingsWithGemini,
} from '@/lib/gemini-structure-finding';
import { mergeSuggestionWithStructured } from '@/lib/parse-structured-finding';
import {
  countLikelyFindings,
  heuristicSplitFindings,
  parseMultipleStructuredFindings,
  splitRawIntoChunks,
} from '@/lib/split-structured-findings';

export type SplitFindingItem = StructuredFindingFields & { raw_snippet: string };

function normalizeFinding(f: SplitFindingItem, context?: string): SplitFindingItem {
  const base = applyAnalystRulesToFinding(
    { ...f, titulo: (f.titulo || 'Hallazgo sin título').slice(0, 300) },
    context
  ) as SplitFindingItem;
  return {
    ...base,
    raw_snippet: (f.raw_snippet || '').slice(0, 2000),
  };
}

function enrichFromRawSnippet(f: SplitFindingItem): SplitFindingItem {
  const raw = (f.raw_snippet || '').trim();
  if (!raw) return f;
  const { suggestion, raw_tool_output } = mergeSuggestionWithStructured(f, raw);
  return {
    ...f,
    ...suggestion,
    raw_snippet: raw_tool_output || f.raw_snippet || '',
  };
}

function toSplitItem(f: StructuredFindingFields, chunk: string): SplitFindingItem {
  return enrichFromRawSnippet({
    ...f,
    raw_snippet: f.raw_snippet || chunk.slice(0, 2000),
  });
}

function allChunksWellParsed(raw: string): boolean {
  const { chunks, findings } = parseMultipleStructuredFindings(raw);
  if (chunks.length < 2 || findings.length !== chunks.length) return false;
  return findings.every(
    (f) =>
      (f.descripcion?.trim().length ?? 0) >= 30 &&
      (f.amenaza_ampliada?.trim().length ?? 0) >= 30
  );
}

function geminiQuotaMessage(msg: string): boolean {
  return /429|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(msg);
}

function localFallback(raw: string, ctx: string) {
  const structured = parseMultipleStructuredFindings(raw);
  const items =
    structured.findings.length > 0
      ? structured.findings.map((s, i) =>
          normalizeFinding(
            enrichFromRawSnippet({
              ...s,
              raw_snippet: structured.chunks[i] || raw.slice(0, 2000),
            } as SplitFindingItem),
            ctx
          )
        )
      : heuristicSplitFindings(raw).map((s, i) =>
          normalizeFinding(
            enrichFromRawSnippet({
              ...s,
              raw_snippet: splitRawIntoChunks(raw)[i] || raw.slice(0, 2000),
            } as SplitFindingItem),
            ctx
          )
        );

  return {
    findings: items,
    source: structured.findings.length ? 'structured' : 'heuristic',
    count: items.length,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { rawOutput, context } = await req.json();
    const raw = String(rawOutput || '').trim();
    const ctx = String(context || '').trim();
    if (!raw) {
      return NextResponse.json({ error: 'rawOutput vacío' }, { status: 400 });
    }

    // Parser local completo — sin Gemini si cada bloque tiene descripción y amenaza
    if (allChunksWellParsed(raw)) {
      const { findings, chunks } = parseMultipleStructuredFindings(raw);
      return NextResponse.json({
        findings: findings.map((s, i) =>
          normalizeFinding(
            enrichFromRawSnippet({
              ...s,
              raw_snippet: chunks[i] || raw.slice(0, 2000),
            } as SplitFindingItem),
            ctx
          )
        ),
        source: 'structured',
        count: findings.length,
        warning: 'Informe estructurado — separado y distribuido localmente.',
      });
    }

    const ai = getAiClient();
    if (!ai) {
      const fb = localFallback(raw, ctx);
      return NextResponse.json({
        ...fb,
        warning: 'GEMINI_API_KEY no configurada — separación local.',
      });
    }

    try {
      let chunks = splitRawIntoChunks(raw);
      const likely = countLikelyFindings(raw);

      // Fase 1: si un solo bloque pero hay varios hallazgos → Gemini detecta límites (JSON)
      if (chunks.length === 1 && likely > 1) {
        const boundaryChunks = await detectFindingBoundariesWithGemini(ai, raw, ctx);
        if (boundaryChunks.length >= 2) chunks = boundaryChunks;
      }

      // Fase 2: estructurar CADA hallazgo con JSON estricto + validación
      const { findings, sources } = await structureManyFindingsWithGemini(ai, chunks, ctx);
      const normalized = findings.map((f, i) =>
        normalizeFinding(toSplitItem(f, chunks[i] || raw), ctx)
      );

      const geminiCount = sources.filter((s) => s === 'gemini').length;
      const structuredCount = sources.filter((s) => s === 'structured').length;

      return NextResponse.json({
        findings: normalized,
        source: geminiCount >= structuredCount ? 'gemini' : 'structured',
        count: normalized.length,
        warning:
          chunks.length > 1
            ? `${normalized.length} hallazgos — ${geminiCount} vía Gemini JSON, ${structuredCount} vía parser local.`
            : undefined,
      });
    } catch (geminiError: unknown) {
      const msg = geminiError instanceof Error ? geminiError.message : String(geminiError);
      console.error('split-findings gemini:', msg);

      const fb = localFallback(raw, ctx);
      return NextResponse.json({
        ...fb,
        warning: geminiQuotaMessage(msg)
          ? 'Cuota Gemini agotada — separación local aplicada.'
          : `Gemini falló (${msg.slice(0, 120)}) — separación local aplicada.`,
      });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: `No se pudo separar hallazgos: ${msg}` }, { status: 500 });
  }
}
