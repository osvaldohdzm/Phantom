import { NextRequest, NextResponse } from 'next/server';
import { getAiClient } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const { command, tool, description, target, attackerIp } = await req.json();

    const ai = getAiClient();
    if (!ai) {
      // Elegant offline fallback
      return NextResponse.json({
        explanation: `📚 **[OFFLINE MODE] Tool Explanation**\n\n**Tool:** \`${tool || 'Unknown'}\`    \n**Command:** \`${command || 'n/a'}\`    \n\n**Quick Guide:**\nThis utility performs active penetration operations against \`${target || '$TARGET'}\`. Set your listener host variables using attacker IP (\`${attackerIp || '$ATTACKER_IP'}\`) to capture reverse callbacks safely.\n\n*Configure the GEMINI_API_KEY in Secrets for detailed AI-powered threat descriptions and script breakdowns.*`,
      });
    }

    const prompt = `You are an elite offensive security expert (OSCP/OSCE). 
Explain the following pentest command in detail, formatting your output in clean Markdown.
Tool: ${tool}
Target Variable ($TARGET): ${target || '10.10.10.5'}
Attacker IP Variable ($ATTACKER_IP): ${attackerIp || '10.10.14.2'}
Dynamic Command: ${command}
Brief tool description: ${description || 'Offensive discovery/web-testing tool'}

Include:
1. What the command actually does under the hood.
2. An explanation of each flag used in the command.
3. Crucial offensive context (e.g. stealth, noise level, common defenses, next steps after successful execution).
Ensure your tone is professional, technical, and educational. Keep it concise.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
    });

    return NextResponse.json({ explanation: response.text || 'No explanation generated.' });
  } catch (error: any) {
    console.error('Gemini Explain Error:', error);
    return NextResponse.json({ error: 'Failed to generate AI explanation: ' + error.message }, { status: 500 });
  }
}
