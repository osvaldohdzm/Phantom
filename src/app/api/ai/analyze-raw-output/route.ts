import { NextRequest, NextResponse } from 'next/server';
import { getAiClient } from '@/lib/gemini';
import { Type } from '@google/genai';

export async function POST(req: NextRequest) {
  try {
    const { rawOutput } = await req.json();

    const ai = getAiClient();
    if (!ai) {
      // Safe heuristic local extractor if Gemini is offline
      const ports: number[] = [];
      const services: string[] = [];
      
      // Quick local regex fallback
      const portMatches = [...(rawOutput || '').matchAll(/(\d+)\/(tcp|udp)\s+open\s+(\S+)/gi)];
      portMatches.forEach(m => {
        ports.push(parseInt(m[1], 10));
        services.push(m[3].toLowerCase());
      });

      return NextResponse.json({
        evidence: {
          open_ports: ports.length ? ports : [80],
          services: services.length ? services : ['http'],
          findings: `[LOCAL EXTRACTOR] Identified ${ports.length} open ports from raw dump.`,
          credentials: [],
          notes: `Extracted ports: ${ports.join(', ')}. (Enable GEMINI_API_KEY for comprehensive cognitive parsing).`,
          raw_output: (rawOutput || '').slice(0, 1000),
        },
      });
    }

    const prompt = `You are a cognitive parsing module for an offensive pentest graph workspace. 
Analyze the following raw console shell output from an offensive security tool.
Parse the text and extract structured findings.

Raw Console Output:
"""
${rawOutput}
"""

You MUST select only one JSON response matching the following schema structure:
{
  "open_ports": [number],
  "services": ["string"],
  "findings": "string (summarized list of exploits, discoveries, Web-Dirs, or vulnerabilities seen)",
  "credentials": [{"username": "string", "password": "or hash", "service": "string"}],
  "notes": "string (additional technical annotations or recommended pivoting targets)"
}
Return ONLY valid JSON format.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['open_ports', 'services', 'findings', 'credentials', 'notes'],
          properties: {
            open_ports: { type: Type.ARRAY, items: { type: Type.INTEGER } },
            services: { type: Type.ARRAY, items: { type: Type.STRING } },
            findings: { type: Type.STRING },
            credentials: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ['username'],
                properties: {
                  username: { type: Type.STRING },
                  password: { type: Type.STRING },
                  service: { type: Type.STRING },
                },
              },
            },
            notes: { type: Type.STRING },
          },
        },
      },
    });

    const parsedJson = JSON.parse(response.text || '{}');
    return NextResponse.json({ evidence: parsedJson });
  } catch (error: any) {
    console.error('Gemini Analyze Evidence Error:', error);
    return NextResponse.json({ error: 'Failed to analyze raw console output: ' + error.message }, { status: 500 });
  }
}
