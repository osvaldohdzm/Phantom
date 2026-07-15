import { NextRequest, NextResponse } from 'next/server';
import { getAiClient } from '@/lib/gemini';
import {
  buildMapFromToolOutputLocal,
  extractJsonObject,
  normalizeGeminiMapPayload,
  type GenerateTargetMapHints,
} from '@/lib/pentest-map-from-tool-output';
import { PENTEST_MAP_SCHEMA_REFERENCE } from '@/lib/pentest-target-map-schema';

function quotaMessage(msg: string): boolean {
  return /429|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(msg);
}

const MAP_PROMPT = `You convert offensive security tool output into a pentest TARGET MAP JSON.
Return ONLY one JSON object. No markdown fences, no commentary.

Schema (semantic only — never include x, y, viewport, layoutSpacing):
${PENTEST_MAP_SCHEMA_REFERENCE}

Rules:
- Build a logical attack enumeration chain when evidence exists in the log
- Typical flow: attacker (optional) → target/host → command (tool used) → ports → services → technologies → vulnerabilities → exploits → sessions/credentials when mentioned
- Use stable snake-case ids (target-1, port-80, cmd-nmap)
- edge.label must use: finds, runs, hosts, contains, executes, vulnerable_to, exploits, leads_to, obtains, reuses, extracts
- Put raw interesting stdout snippets in node.output or note nodes
- Infer targetIps and attackerIps in meta when visible
- platform: htb | oscp | vulnlab | ctf | real | custom
- attackStatus on nodes when stage is clear: not_started | enumerating | exploitable | exploited | escalated | owned
- Do NOT invent flags or shells unless the log mentions them`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawOutput = String(body.rawOutput ?? '').trim();
    if (!rawOutput) {
      return NextResponse.json({ error: 'rawOutput vacío' }, { status: 400 });
    }

    const hints: GenerateTargetMapHints = {
      diagramName: body.diagramName ? String(body.diagramName) : undefined,
      platform: body.platform,
      targetIp: body.targetIp ? String(body.targetIp) : undefined,
      attackerIp: body.attackerIp ? String(body.attackerIp) : undefined,
    };

    const ai = getAiClient();
    if (!ai) {
      const doc = buildMapFromToolOutputLocal(rawOutput, hints);
      return NextResponse.json({
        doc,
        source: 'local',
        warning: 'GEMINI_API_KEY no configurada — mapa heurístico desde nmap/texto.',
      });
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${MAP_PROMPT}

Context hints (optional):
- diagramName: ${hints.diagramName ?? '(infer from scan)'}
- platform: ${hints.platform ?? 'custom'}
- targetIp: ${hints.targetIp ?? '(infer)'}
- attackerIp: ${hints.attackerIp ?? '(optional)'}

Tool output to map:
---
${rawOutput.slice(0, 120_000)}
---`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const text = response.text ?? '';
      const payload = extractJsonObject(text);
      const doc = normalizeGeminiMapPayload(payload, hints);
      return NextResponse.json({ doc, source: 'gemini' });
    } catch (geminiError: unknown) {
      const msg = geminiError instanceof Error ? geminiError.message : String(geminiError);
      console.error('generate-target-map gemini:', msg);
      const doc = buildMapFromToolOutputLocal(rawOutput, hints);
      return NextResponse.json({
        doc,
        source: 'local',
        warning: quotaMessage(msg)
          ? 'Cuota Gemini agotada — mapa heurístico aplicado.'
          : 'Gemini no disponible — mapa heurístico aplicado.',
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error generando mapa';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
