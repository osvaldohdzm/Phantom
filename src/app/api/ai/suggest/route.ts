import { NextRequest, NextResponse } from 'next/server';
import { getAiClient } from '@/lib/gemini';
import { Type } from '@google/genai';

export async function POST(req: NextRequest) {
  try {
    const { currentNodes, target, evidenceSummary } = await req.json();

    const ai = getAiClient();
    if (!ai) {
      // Safe fallback returning empty array (the client will use local heuristic rules instead)
      return NextResponse.json({ suggestions: [] });
    }

    const prompt = `You are a smart cyber pentesting inference engine. 
Based on the target system "${target || 'Unknown target'}" and current discovered evidence summaries:
"""
${evidenceSummary || 'Nmap scan initiated, HTTP or SMB services detected.'}
"""

Already existing tools/nodes in workflow: ${(currentNodes || []).map((n: any) => n.tool).join(', ')}

Please suggest 2 to 3 next-step logical nodes (actions, tools, script execution) that build upon this evidence.
Choose from standard tools (like FFUF, CrackMapExec, Nikto, Nuclei, SQLMap, LinPEAS, WinPEAS, Metasploit, Mimikatz, enum4linux, subfinder, nmap, etc.) OR craft custom exploitation scripts if applicable.

You MUST follow this schema in JSON:
{
  "suggestions": [
    {
      "title": "string (Node tool and objective)",
      "description": "string (Why this node is recommended)",
      "type": "discovery" | "web" | "ad" | "exploitation" | "post-exploitation" | "custom",
      "tool": "string (Tool name)",
      "commandTemplate": "string (The bash command using $TARGET, $PORT, $ATTACKER_IP etc.)",
      "tags": ["string"],
      "reason": "string (Specific reason based on findings)"
    }
  ]
}
Return ONLY valid JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['suggestions'],
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ['title', 'description', 'type', 'tool', 'commandTemplate', 'tags', 'reason'],
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  type: { type: Type.STRING },
                  tool: { type: Type.STRING },
                  commandTemplate: { type: Type.STRING },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  reason: { type: Type.STRING },
                },
              },
            },
          },
        },
      },
    });

    const parsedJson = JSON.parse(response.text || '{"suggestions":[]}');
    return NextResponse.json(parsedJson);
  } catch (error: any) {
    console.error('Gemini Suggest Error:', error);
    return NextResponse.json({ error: 'Failed to suggest smart nodes: ' + error.message }, { status: 500 });
  }
}
