import { NextRequest, NextResponse } from 'next/server';
import { getAiClient } from '@/lib/gemini';
import { Type } from '@google/genai';

export async function POST(req: NextRequest) {
  try {
    const { walkthroughText } = await req.json();

    if (!walkthroughText || typeof walkthroughText !== 'string' || !walkthroughText.trim()) {
      return NextResponse.json({ error: 'Missing walkthrough ingestion payload.' }, { status: 400 });
    }

    const ai = getAiClient();
    if (!ai) {
      // Elegant Offline Extraction Engine
      const globalVars: Record<string, string> = {
        '$TARGET': '10.10.53.217',
        '$ATTACKER_IP': '10.10.14.53',
        '$PORT': '80',
        '$DOMAIN': 'corp.local',
        '$USER': 'admin',
        '$PASSWORD': 'admin',
      };

      const lines = walkthroughText.split('\n');
      const nodes: any[] = [];
      const connections: any[] = [];
      let stepCount = 0;

      const commonOffensiveCmdPrefixes = [
        'nmap', 'ffuf', 'wpscan', 'gobuster', 'dirbuster', 'nikto', 'curl', 'subfinder', 'sqlmap',
        'nc', 'hydra', 'crackmapexec', 'netcat', 'su', 'sudo', 'powershell', 'msfconsole', 'ncat',
        'ping', 'whoami', 'ssh', 'mimikatz', 'smbclient', 'enum4linux',
      ];

      const ipRegex = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g;
      const foundIps = [...walkthroughText.matchAll(ipRegex)].map(m => m[0]);
      if (foundIps.length > 0) {
        globalVars['$TARGET'] = foundIps[0];
        if (foundIps.length > 1) {
          globalVars['$ATTACKER_IP'] = foundIps[1];
        }
      }

      const varAssignRegex = /\b([a-zA-Z_0-9]+)\s*=\s*["']([^"']+)["']/g;
      let varMatch;
      while ((varMatch = varAssignRegex.exec(walkthroughText)) !== null) {
        const k = '$' + varMatch[1].toUpperCase();
        globalVars[k] = varMatch[2];
      }

      for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i].trim();
        if (!rawLine) continue;

        const isCmd = rawLine.startsWith('$ ') || rawLine.startsWith('# ') || 
                      commonOffensiveCmdPrefixes.some(prefix => rawLine.toLowerCase().startsWith(prefix));

        if (isCmd) {
          let cleanCmd = rawLine;
          if (cleanCmd.startsWith('$ ') || cleanCmd.startsWith('# ')) {
            cleanCmd = cleanCmd.slice(2).trim();
          }

          const firstWord = cleanCmd.split(' ')[0].split('/').pop() || 'Bash';
          const toolName = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);

          let type = 'custom';
          const lowerCmd = cleanCmd.toLowerCase();
          if (lowerCmd.includes('nmap') || lowerCmd.includes('ping') || lowerCmd.includes('subfinder')) {
            type = 'discovery';
          } else if (lowerCmd.includes('ffuf') || lowerCmd.includes('wpscan') || lowerCmd.includes('gobuster') || lowerCmd.includes('curl') || lowerCmd.includes('nikto')) {
            type = 'web';
          } else if (lowerCmd.includes('crackmapexec') || lowerCmd.includes('smb') || lowerCmd.includes('enum4linux')) {
            type = 'ad';
          } else if (lowerCmd.includes('exploit') || lowerCmd.includes('sqlmap') || lowerCmd.includes('nc') || lowerCmd.includes('reverse') || lowerCmd.includes('payload')) {
            type = 'exploitation';
          } else if (lowerCmd.includes('linpeas') || lowerCmd.includes('winpeas') || lowerCmd.includes('mimikatz') || lowerCmd.includes('privilege') || lowerCmd.includes('whoami')) {
            type = 'post-exploitation';
          }

          let cmdWithTemplateVars = cleanCmd;
          Object.entries(globalVars).forEach(([varKey, varVal]) => {
            if (varVal && varVal.length > 3) {
              cmdWithTemplateVars = cmdWithTemplateVars.replaceAll(varVal, varKey);
            }
          });

          const nodeId = `parsed-offline-node-${stepCount}`;
          const finalX = 80 + stepCount * 400;
          const finalY = 150 + (stepCount % 2) * 60;

          nodes.push({
            id: nodeId,
            title: `Step ${stepCount + 1}: ${toolName} Execution`,
            description: `Extracted step conducting offensive utility actions with: ${toolName}.`,
            type: type as any,
            tool: toolName,
            state: 'pending',
            commandTemplate: cmdWithTemplateVars,
            customParams: {},
            evidenceProduced: {},
            tags: [toolName.toLowerCase(), type],
            position: { x: finalX, y: finalY },
            updatedAt: new Date().toISOString(),
          });

          if (stepCount > 0) {
            connections.push({
              id: `parsed-offline-conn-${stepCount}`,
              sourceNodeId: `parsed-offline-node-${stepCount - 1}`,
              targetNodeId: nodeId,
              type: 'default',
            });
          }

          stepCount++;
        }
      }

      if (nodes.length === 0) {
        nodes.push({
          id: 'parsed-offline-node-0',
          title: 'Walkthrough Landing Node',
          description: 'We analyzed your writeup but did not find clear terminal command triggers. Use this blank canvas to build your own play-deck!',
          type: 'discovery',
          tool: 'Diagnostics',
          state: 'pending',
          commandTemplate: 'ping -c 4 $TARGET',
          customParams: {},
          evidenceProduced: {},
          tags: ['diagnostics'],
          position: { x: 100, y: 150 },
          updatedAt: new Date().toISOString(),
        });
      }

      return NextResponse.json({
        globalVars,
        nodes,
        connections,
      });
    }

    const prompt = `You are an elite cyber tactical operations parser. 
A user has pasted a walkthrough writeup of a CTF or pentest target.
Your job is to read this writeup, analyze the attack vector, identify all hardcoded parameters, and structure it into a reusable play-deck dynamic graph of connected steps.

Walkthrough Ingestion Text:
"""
${walkthroughText}
"""

Please perform the following operations:
1. **Identify Hardcoded Variables**: Parse the entire text to find infrastructure details (IP addresses, victim URLs, domain names, target ports), credentials (usernames, passwords, hashes, keys), listener configurations (local reverse shell IP or callback ports), directories, file names, etc.
   Replace these hardcoded values in all command templates with reusable variables (keys starting with '$', e.g. '$TARGET', '$ATTACKER_IP', '$LPORT', '$USER_1', '$PASS_1', '$DOMAIN').
   Map these variables into a 'globalVars' key-value registry: keys must start with '$' and match the exact variables used in the commands, values must be the actual hardcoded values you found.
   By default, always keep '$TARGET' as the primary victim target host/IP and '$ATTACKER_IP' as your attack listener/callback IP, if any.

2. **Reconstruct Sequential Attack Tree (Nodes)**:
   Extract all important command executions or active reconnaissance steps into a sequential array of nodes.
   For each node, construct:
   - 'id': e.g. "parsed-node-0", "parsed-node-1", etc. Make them distinct and clean.
   - 'title': high-fidelity descriptive heading of the step (e.g. "Recursive Subdirectory Fuzzing", "Privilege Escalation via SUID binary")
   - 'description': brief overview of what this node does and why it was executed in the writeup.
   - 'type': categorise into one of the exact strings: "discovery", "web", "ad", "exploitation", "post-exploitation", "custom"
   - 'tool': tool name (e.g. "Nmap", "FFUF", "WPScan", "LinPEAS", "Metasploit", "Mimikatz", "Custom Bash", "SQLMap")
   - 'commandTemplate': the absolute exact bash/shell command found in the writeup, but with hardcoded variables replaced by their globalVars key (e.g. "ffuf -u http://$TARGET/FUZZ -w $WORDLIST"). Keep commands valid and functional.
   - 'customParams': an empty object {}
   - 'evidenceProduced': an empty object {}
   - 'tags': list of tags (e.g. ["scan", "web", "sqli"])
   - 'position': dynamic layout coordinates: space them progressively in columns horizontally to prevent vertical piling (e.g. step i has x: 80 + i * 400, y: 150 + (i % 2) * 60).

3. **Link steps with Connections**:
   Create directional connection objects from each step in the chain to the next (e.g., node-0 to node-1, node-1 to node-2).

Provide ONLY the valid JSON matching this schema:
{
  "globalVars": {
    "key_starting_with_dollar": "value"
  },
  "nodes": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "type": "discovery" | "web" | "ad" | "exploitation" | "post-exploitation" | "custom",
      "tool": "string",
      "commandTemplate": "string",
      "customParams": {},
      "evidenceProduced": {},
      "tags": ["string"],
      "position": { "x": "number", "y": "number" }
    }
  ],
  "connections": [
    {
      "id": "string",
      "sourceNodeId": "string",
      "targetNodeId": "string",
      "type": "default"
    }
  ]
}
Return ONLY a valid JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['globalVars', 'nodes', 'connections'],
          properties: {
            globalVars: {
              type: Type.OBJECT,
              additionalProperties: { type: Type.STRING },
            },
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ['id', 'title', 'description', 'type', 'tool', 'commandTemplate', 'tags', 'position'],
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  type: { type: Type.STRING },
                  tool: { type: Type.STRING },
                  commandTemplate: { type: Type.STRING },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  position: {
                    type: Type.OBJECT,
                    required: ['x', 'y'],
                    properties: {
                      x: { type: Type.NUMBER },
                      y: { type: Type.NUMBER },
                    },
                  },
                },
              },
            },
            connections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ['id', 'sourceNodeId', 'targetNodeId', 'type'],
                properties: {
                  id: { type: Type.STRING },
                  sourceNodeId: { type: Type.STRING },
                  targetNodeId: { type: Type.STRING },
                  type: { type: Type.STRING },
                },
              },
            },
          },
        },
      },
    });

    const parsedJson = JSON.parse(response.text || '{"globalVars": {}, "nodes": [], "connections": []}');
    return NextResponse.json(parsedJson);
  } catch (error: any) {
    console.error('Gemini Walkthrough Parsing Error:', error);
    return NextResponse.json({ error: 'Failed to analyze writeup with Gemini: ' + error.message }, { status: 500 });
  }
}
