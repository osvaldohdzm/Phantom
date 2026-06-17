/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/phantom/Sidebar';
import GraphCanvas from '@/components/phantom/GraphCanvas';
import NodeDetailDrawer from '@/components/phantom/NodeDetailDrawer';
import TerminalLogPanel from '@/components/phantom/TerminalLogPanel';
import ConfirmModal from '@/components/phantom/ConfirmModal';
import RepertoireDashboard from '@/components/phantom/RepertoireDashboard';
import { PentestNode, NodeConnection, TerminalLog, NodeState, SuggestionRule, NodeClass } from '@/components/phantom/types';
import { BUILT_IN_RULES } from '@/components/phantom/data/rules';
import { WORKFLOW_TEMPLATES } from '@/components/phantom/data/templates';
import { Terminal, ShieldCheck, Activity, Key, Network, HelpCircle, FolderHeart, CloudUpload } from 'lucide-react';
import { saveWorkspace, updateWorkspace } from '@/lib/phantom-api';

export default function App() {
  const [globalVars, setGlobalVars] = useState<Record<string, string>>({
    '$TARGET': '10.10.53.217',
    '$ATTACKER_IP': '10.10.14.53',
    '$PORT': '80',
    '$DOMAIN': 'corp.local',
    '$USER': 'admin',
    '$PASSWORD': 'admin'
  });
  const [nodes, setNodes] = useState<PentestNode[]>([]);
  const [connections, setConnections] = useState<NodeConnection[]>([]);
  const [customRules, setCustomRules] = useState<SuggestionRule[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [logs, setLogs] = useState<TerminalLog[]>([]);
  const [showTerminal, setShowTerminal] = useState<boolean>(true);
  const [isRepertoireOpen, setIsRepertoireOpen] = useState<boolean>(false);
  const [cloudWorkspaceId, setCloudWorkspaceId] = useState<string | null>(null);
  const [cloudSaving, setCloudSaving] = useState(false);

  // High-fidelity custom dialog confirmation states
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {}
  });

  const openConfirm = (config: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel?: () => void;
  }) => {
    setConfirmState({
      isOpen: true,
      title: config.title,
      message: config.message,
      confirmText: config.confirmText,
      cancelText: config.cancelText,
      type: config.type || 'danger',
      onConfirm: () => {
        config.onConfirm();
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      },
      onCancel: () => {
        if (config.onCancel) config.onCancel();
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Derived target state dynamically for backwards compatibility
  const target = globalVars['$TARGET'] || '10.10.53.217';
  const attackerIp = globalVars['$ATTACKER_IP'] || '10.10.14.53';

  const setTarget = (val: string) => {
    setGlobalVars(prev => ({ ...prev, '$TARGET': val }));
  };

  const setAttackerIp = (val: string) => {
    setGlobalVars(prev => ({ ...prev, '$ATTACKER_IP': val }));
  };

  // Initialize: Load from localStorage or default to Playbook template
  useEffect(() => {
    const saved = localStorage.getItem('kronos_pentest_wf_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.nodes && parsed.connections) {
          setNodes(parsed.nodes);
          setConnections(parsed.connections);
          if (parsed.globalVars) {
            setGlobalVars(parsed.globalVars);
          } else {
            const initialVars: Record<string, string> = {
              '$PORT': '80',
              '$DOMAIN': 'corp.local',
              '$USER': 'admin',
              '$PASSWORD': 'admin'
            };
            if (parsed.target) initialVars['$TARGET'] = parsed.target;
            if (parsed.attackerIp) initialVars['$ATTACKER_IP'] = parsed.attackerIp;
            setGlobalVars(prev => ({ ...prev, ...initialVars }));
          }
          
          addLogMessage('info', 'Loaded previous active diagram state from local persistence.');
          return;
        }
      } catch (err) {
        console.error('Failed to parse previous state', err);
      }
    }

    // Default to External Playbook on first-ever load so application is lively and beautiful
    const defaultPlaybook = WORKFLOW_TEMPLATES[0];
    setNodes(defaultPlaybook.nodes);
    setConnections(defaultPlaybook.connections);
    addLogMessage('success', 'Workspace initialized. Loaded External Pentest tactical template playbooks.');
  }, []);

  // Auto-save state
  useEffect(() => {
    const stateToSave = { globalVars, nodes, connections };
    localStorage.setItem('kronos_pentest_wf_state', JSON.stringify(stateToSave));
  }, [globalVars, nodes, connections]);

  // Handler: Add general trace action messages to the bottom terminal logs
  const addLogMessage = (
    type: 'info' | 'success' | 'error' | 'command_copied' | 'state_change' | 'ai',
    message: string
  ) => {
    const newLog: TerminalLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toLocaleTimeString(),
      type,
      message
    };
    setLogs((prev) => [...prev, newLog]);
  };

  const handleClearLogs = () => {
    setLogs([]);
    addLogMessage('info', 'Console traces timeline cleared.');
  };

  // Node operations
  const handleAddNode = (newNode: PentestNode) => {
    setNodes((prev) => [...prev, newNode]);
    addLogMessage('info', `Added node: ${newNode.title}`);
  };

  const handleUpdateNode = (updatedNode: PentestNode) => {
    setNodes((prev) => prev.map((n) => (n.id === updatedNode.id ? updatedNode : n)));
  };

  const handleDeleteNode = (id: string) => {
    const nodeToDelete = nodes.find((n) => n.id === id);
    if (!nodeToDelete) {
      addLogMessage('error', `Attempt failed: Node with ID "${id}" was not found in active graph layout.`);
      return;
    }

    openConfirm({
      title: 'Delete Tactical Node',
      message: `Are you sure you want to delete Node "${nodeToDelete.title}"? This will also disconnect all associated workflow connections permanently.`,
      confirmText: 'Delete Node',
      cancelText: 'Keep Node',
      type: 'danger',
      onConfirm: () => {
        const linkedConnections = connections.filter((c) => c.sourceNodeId === id || c.targetNodeId === id);
        const severedCount = linkedConnections.length;

        setNodes((prev) => prev.filter((n) => n.id !== id));
        setConnections((prev) => prev.filter((c) => c.sourceNodeId !== id && c.targetNodeId !== id));
        if (selectedNodeId === id) setSelectedNodeId(null);

        addLogMessage(
          'error',
          `DELETION TRANSACTION SUCCESSFUL: Removed Node "${nodeToDelete.title}". ${
            severedCount > 0
              ? `Automatically severed ${severedCount} active connectively-linked tactical graph path(s) to isolate diagram integrity.`
              : 'No associated flow linkages were affected.'
          }`
        );
      },
      onCancel: () => {
        addLogMessage('info', `Operator cancelled deletion of Node: "${nodeToDelete.title}". Context preserved.`);
      }
    });
  };

  const handleDeleteConnection = (id: string) => {
    const conn = connections.find((c) => c.id === id);
    if (!conn) return;

    const sourceNode = nodes.find((n) => n.id === conn.sourceNodeId);
    const targetNode = nodes.find((n) => n.id === conn.targetNodeId);
    const sourceTitle = sourceNode?.title || 'Source';
    const targetTitle = targetNode?.title || 'Target';

    openConfirm({
      title: 'Sever Connection Path',
      message: `Are you sure you want to sever and remove the workflow link connecting [ ${sourceTitle} ] and [ ${targetTitle} ]?`,
      confirmText: 'Sever Link',
      cancelText: 'Keep Link',
      type: 'danger',
      onConfirm: () => {
        setConnections((prev) => prev.filter((c) => c.id !== id));
        addLogMessage('error', `SEVERATION COMPLETED: Burned workflow connection path between [ ${sourceTitle} ] and [ ${targetTitle} ].`);
      },
      onCancel: () => {
        addLogMessage('info', `Operator cancelled severance of linkage: ${sourceTitle} ➜ ${targetTitle}. Link preserved.`);
      }
    });
  };

  const handleReplaceGraph = (newNodes: PentestNode[], newConnections: NodeConnection[], tplName?: string) => {
    const applyReplace = () => {
      setNodes(newNodes);
      setConnections(newConnections);
      setSelectedNodeId(null);
      addLogMessage('success', `Initialized workspace layout template: "${tplName || 'Playbook'}". Fully loaded.`);
    };

    if (nodes.length === 0) {
      applyReplace();
    } else {
      openConfirm({
        title: 'Overwriting Active Canvas',
        message: `Are you sure you want to load template "${tplName || 'Playbook'}"? Doing so will replace your current active canvas workspace.`,
        confirmText: 'Overwrite Canvas',
        cancelText: 'Keep Current',
        type: 'warning',
        onConfirm: applyReplace,
        onCancel: () => {
          addLogMessage('info', `Operator preserved current canvas. Loading workspace template "${tplName || 'Playbook'}" was cancelled.`);
        }
      });
    }
  };

  const handleLoadWorkspace = (newNodes: PentestNode[], newConnections: NodeConnection[], newGlobalVars: Record<string, string>, name: string) => {
    setNodes(newNodes);
    setConnections(newConnections);
    setGlobalVars(newGlobalVars);
    setSelectedNodeId(null);
    addLogMessage('success', `Cargado Pentest "${name}" en el espacio de trabajo. Variables actualizadas.`);
  };

  // Inferences and suggestion evaluation logic matches active node evidence to appropriate rules
  const getSuggestionsMap = (): Record<string, any[]> => {
    const suggestionsMap: Record<string, any[]> = {};

    nodes.forEach((node) => {
      const activeEvidence = node.evidenceProduced;
      const suggestions: any[] = [];

      // Skip evaluating rules on non-success nodes to avoid visual clutter
      if (node.state !== 'success') return;

      // Check both built-in recommendation rules and custom JSON base plan rules
      const allRules = [...BUILT_IN_RULES, ...customRules];
      allRules.forEach((rule) => {
        let conditionMatched = false;

        // Verify tool condition match if defined
        const toolMatches = !rule.condition.tool || node.tool.toLowerCase() === rule.condition.tool.toLowerCase();

        if (toolMatches) {
          // 1. Check if rule specifies and matches port
          if (rule.condition.port && activeEvidence.open_ports?.includes(rule.condition.port)) {
            conditionMatched = true;
          }

          // 2. Check if rule specifies and matches service (e.g., http)
          if (rule.condition.service && activeEvidence.services?.some(s => s.toLowerCase() === rule.condition.service?.toLowerCase())) {
            conditionMatched = true;
          }

          // 3. Check if rule specifies substring matching against findings or notes
          if (rule.condition.findings) {
            const query = rule.condition.findings.toLowerCase();
            const findingsMatch = activeEvidence.findings?.toLowerCase().includes(query);
            const notesMatch = activeEvidence.notes?.toLowerCase().includes(query);
            const rawOutputMatch = activeEvidence.raw_output?.toLowerCase().includes(query);
            const servicesMatch = activeEvidence.services?.some(s => s.toLowerCase().includes(query));
            
            if (findingsMatch || notesMatch || rawOutputMatch || servicesMatch) {
              conditionMatched = true;
            }
          }

          // 4. Default fallback: if only tool matches and no other checks are defined, trigger suggestion
          if (!rule.condition.port && !rule.condition.service && !rule.condition.findings && rule.condition.tool) {
            conditionMatched = true;
          }
        }

        // If matched, verify recommended target node does not already exist as downstream linked target to avoid infinite duplicates
        if (conditionMatched) {
          const alreadySuggestedNodeExists = nodes.some(n => n.tool.toLowerCase() === rule.suggestNode.tool.toLowerCase());
          const alreadyLinkedTargetExists = connections.some(c => c.sourceNodeId === node.id && nodes.find(n => n.id === c.targetNodeId)?.tool === rule.suggestNode.tool);

          if (!alreadyLinkedTargetExists && !alreadySuggestedNodeExists) {
            suggestions.push(rule);
          }
        }
      });

      if (suggestions.length > 0) {
        suggestionsMap[node.id] = suggestions;
      }
    });

    return suggestionsMap;
  };

  const activeSuggestions = getSuggestionsMap();

  // Spawns a suggested action node on canvas connected to parent
  const handleSpawnSuggestedNode = (parent: PentestNode, suggestion: any) => {
    const sugNode = suggestion.suggestNode;
    
    // Position offset situated to the right of parent node in graph
    const finalX = parent.position.x + 300;
    const finalY = parent.position.y + Math.round((Math.random() - 0.5) * 80);

    const newNode: PentestNode = {
      id: `node-${Date.now()}`,
      title: sugNode.title,
      description: sugNode.description,
      type: sugNode.type,
      tool: sugNode.tool,
      state: 'pending',
      commandTemplate: sugNode.commandTemplate,
      customParams: {},
      evidenceProduced: {},
      position: { x: finalX, y: finalY },
      tags: sugNode.tags,
      isSuggested: false,      // Now deployed
      updatedAt: new Date().toISOString()
    };

    const newConn: NodeConnection = {
      id: `conn-${Date.now()}`,
      sourceNodeId: parent.id,
      targetNodeId: newNode.id,
      type: 'default'
    };

    setNodes((prev) => [...prev, newNode]);
    setConnections((prev) => [...prev, newConn]);
    setSelectedNodeId(newNode.id); // Open drawer instantly
    
    addLogMessage('ai', `Automated inference rules triggered: Spawned connected command successor: ${sugNode.tool}`);
  };

  // Auto-Align Nodes layout algorithm arranging stages logically into non-overlapping horizontal columns, vertical rows, or dependency tree
  const handleAutoAlignNodes = (mode: 'columns' | 'rows' | 'tree' = 'columns') => {
    if (nodes.length === 0) {
      addLogMessage('info', 'There are no active nodes on the canvas to organize.');
      return;
    }

    const alignedNodes = [...nodes];
    const PHASE_ORDER: NodeClass[] = ['discovery', 'web', 'custom', 'exploitation', 'ad', 'post-exploitation'];

    // Secure fallback and synonym normalizer for node phases
    const getNormalizedType = (t: string): NodeClass => {
      if (!t) return 'custom';
      const clean = t.toLowerCase().trim();
      
      // 1. Direct match check
      if (['discovery', 'web', 'custom', 'exploitation', 'ad', 'post-exploitation'].includes(clean)) {
        return clean as NodeClass;
      }
      
      // 2. Specific synonyms and partial matches - check most specific first
      if (clean.includes('post-exploitation') || clean.includes('post') || clean.includes('loot') || clean.includes('privilege') || clean.includes('persistence') || clean.includes('credential_flow')) {
        return 'post-exploitation';
      }
      if (clean.includes('exploitation') || clean.includes('exploit') || clean.includes('weaponize') || clean.includes('shell') || clean.includes('rce') || clean.includes('msf') || clean.includes('metasploit')) {
        return 'exploitation';
      }
      if (clean.includes('recon') || clean.includes('discovery') || clean.includes('scan') || clean.includes('osint') || clean.includes('naabu') || clean.includes('rustscan')) {
        return 'discovery';
      }
      if (clean.includes('web') || clean.includes('enum') || clean.includes('fuzz') || clean.includes('dirsearch') || clean.includes('gobuster') || clean.includes('directory')) {
        return 'web';
      }
      if (clean.includes('ad') || clean.includes('active') || clean.includes('lateral') || clean.includes('pivot') || clean.includes('smb') || clean.includes('bloodhound')) {
        return 'ad';
      }
      
      return 'custom';
    };

    if (mode === 'columns') {
      // Group nodes by their structural pen test phases
      const groups: Record<NodeClass, PentestNode[]> = {
        'discovery': [],
        'web': [],
        'custom': [],
        'exploitation': [],
        'ad': [],
        'post-exploitation': []
      };

      nodes.forEach(node => {
        const cls = getNormalizedType(node.type);
        if (groups[cls]) {
          groups[cls].push(node);
        } else {
          groups['custom'].push(node);
        }
      });

      const canvasCenterY = 320;
      const colWidth = 340;
      const rowHeight = 350;

      PHASE_ORDER.forEach((phase, colIdx) => {
        const phaseNodes = groups[phase];
        if (phaseNodes.length === 0) return;

        // Sort nodes in this phase column to minimize overlapping edges or line crossovers.
        phaseNodes.sort((a, b) => {
          const parentA = connections.find(c => c.targetNodeId === a.id);
          const parentB = connections.find(c => c.targetNodeId === b.id);
          const parentNodeA = parentA ? nodes.find(n => n.id === parentA.sourceNodeId) : null;
          const parentNodeB = parentB ? nodes.find(n => n.id === parentB.sourceNodeId) : null;

          if (parentNodeA && parentNodeB) {
            return parentNodeA.position.y - parentNodeB.position.y;
          }
          if (parentNodeA) return -1;
          if (parentNodeB) return 1;
          return a.title.localeCompare(b.title);
        });

        const count = phaseNodes.length;
        const totalHeight = (count - 1) * rowHeight;
        const startY = Math.max(120, canvasCenterY - (totalHeight / 2));

        phaseNodes.forEach((node, rowIdx) => {
          const targetX = 90 + colIdx * colWidth;
          const targetY = startY + (rowIdx * rowHeight);

          const index = alignedNodes.findIndex(n => n.id === node.id);
          if (index !== -1) {
            alignedNodes[index] = {
              ...alignedNodes[index],
              type: phase, // Persist aligned, normalized phase
              position: { x: targetX, y: targetY },
              updatedAt: new Date().toISOString()
            };
          }
        });
      });

      setNodes(alignedNodes);
      addLogMessage('success', 'Alineación de Fases en Columnas completada con éxito.');

    } else if (mode === 'rows') {
      // Group nodes by their structural pen test phases for vertical swimlanes layout
      const groups: Record<NodeClass, PentestNode[]> = {
        'discovery': [],
        'web': [],
        'custom': [],
        'exploitation': [],
        'ad': [],
        'post-exploitation': []
      };

      nodes.forEach(node => {
        const cls = getNormalizedType(node.type);
        if (groups[cls]) {
          groups[cls].push(node);
        } else {
          groups['custom'].push(node);
        }
      });

      const canvasCenterX = 450;
      const rowHeight = 380;
      const colWidth = 340;

      PHASE_ORDER.forEach((phase, rowIdx) => {
        const phaseNodes = groups[phase];
        if (phaseNodes.length === 0) return;

        // Sort horizontally within row
        phaseNodes.sort((a, b) => {
          const parentA = connections.find(c => c.targetNodeId === a.id);
          const parentB = connections.find(c => c.targetNodeId === b.id);
          const parentNodeA = parentA ? nodes.find(n => n.id === parentA.sourceNodeId) : null;
          const parentNodeB = parentB ? nodes.find(n => n.id === parentB.sourceNodeId) : null;

          if (parentNodeA && parentNodeB) {
            return parentNodeA.position.x - parentNodeB.position.x;
          }
          if (parentNodeA) return -1;
          if (parentNodeB) return 1;
          return a.title.localeCompare(b.title);
        });

        const count = phaseNodes.length;
        const totalWidth = (count - 1) * colWidth;
        const startX = Math.max(120, canvasCenterX - (totalWidth / 2));

        phaseNodes.forEach((node, colIdx) => {
          const targetX = startX + (colIdx * colWidth);
          const targetY = 120 + rowIdx * rowHeight;

          const index = alignedNodes.findIndex(n => n.id === node.id);
          if (index !== -1) {
            alignedNodes[index] = {
              ...alignedNodes[index],
              type: phase, // Persist aligned, normalized phase
              position: { x: targetX, y: targetY },
              updatedAt: new Date().toISOString()
            };
          }
        });
      });

      setNodes(alignedNodes);
      addLogMessage('success', 'Alineación de Fases en Filas (Checklist Vertical) completada con éxito.');

    } else if (mode === 'tree') {
      // Connective topological hierarchy algorithm
      const levels: Record<string, number> = {};
      const visited = new Set<string>();

      // Compute in degrees
      const inDegrees: Record<string, number> = {};
      nodes.forEach(n => { inDegrees[n.id] = 0; });
      connections.forEach(c => {
        if (inDegrees[c.targetNodeId] !== undefined) {
          inDegrees[c.targetNodeId]++;
        }
      });

      const roots = nodes.filter(n => inDegrees[n.id] === 0);
      if (roots.length === 0 && nodes.length > 0) {
        roots.push(nodes[0]);
      }

      // BFS Queue
      const queue: { nodeId: string; level: number }[] = [];
      roots.forEach(r => {
        queue.push({ nodeId: r.id, level: 0 });
        levels[r.id] = 0;
        visited.add(r.id);
      });

      while (queue.length > 0) {
        const { nodeId, level } = queue.shift()!;
        const childrenConns = connections.filter(c => c.sourceNodeId === nodeId);
        childrenConns.forEach(c => {
          const childId = c.targetNodeId;
          if (!visited.has(childId)) {
            visited.add(childId);
            levels[childId] = level + 1;
            queue.push({ nodeId: childId, level: level + 1 });
          } else {
            levels[childId] = Math.max(levels[childId] || 0, level + 1);
          }
        });
      }

      // Fill in remaining unlinked nodes (placed in root level 0)
      nodes.forEach(n => {
        if (levels[n.id] === undefined) {
          levels[n.id] = 0;
        }
      });

      // Group by levels
      const levelGroups: Record<number, PentestNode[]> = {};
      nodes.forEach(node => {
        const lvl = levels[node.id];
        if (!levelGroups[lvl]) levelGroups[lvl] = [];
        levelGroups[lvl].push(node);
      });

      const maxLvl = Math.max(...Object.keys(levelGroups).map(Number), 0);
      const treeColWidth = 360;
      const treeRowHeight = 350;
      const canvasCenterY = 320;

      for (let l = 0; l <= maxLvl; l++) {
        const levelNodes = levelGroups[l];
        if (!levelNodes || levelNodes.length === 0) continue;

        const count = levelNodes.length;
        const totalHeight = (count - 1) * treeRowHeight;
        const levelStartY = Math.max(80, canvasCenterY - (totalHeight / 2));

        levelNodes.forEach((node, rowIdx) => {
          const targetX = 80 + l * treeColWidth;
          const targetY = levelStartY + rowIdx * treeRowHeight;

          const index = alignedNodes.findIndex(n => n.id === node.id);
          if (index !== -1) {
            alignedNodes[index] = {
              ...alignedNodes[index],
              position: { x: targetX, y: targetY },
              updatedAt: new Date().toISOString()
            };
          }
        });
      }

      setNodes(alignedNodes);
      addLogMessage('success', 'Alineación de Árbol Jerárquico por Pivotajes completada con éxito.');
    }
  };

  // Derived metrics for Top status bar
  const totalNodesCount = nodes.length;
  const pwndNodesCount = nodes.filter(n => n.state === 'success').length;
  const activeAttackingCount = nodes.filter(n => n.state === 'running').length;

  const currentSelectedNode = nodes.find(n => n.id === selectedNodeId);

  const handleCloudSave = async () => {
    setCloudSaving(true);
    try {
      const payload = {
        name: `Phantom ${target || 'workspace'}`,
        description: `Kronos workspace — ${nodes.length} nodos`,
        category: 'Real Pentest',
        global_vars: globalVars,
        nodes,
        connections,
        custom_rules: customRules,
      };
      if (cloudWorkspaceId) {
        await updateWorkspace(cloudWorkspaceId, payload);
        addLogMessage('success', `Workspace sincronizado en servidor (id: ${cloudWorkspaceId.slice(0, 8)}…).`);
      } else {
        const created = await saveWorkspace(payload);
        setCloudWorkspaceId(created.id);
        addLogMessage('success', `Workspace guardado en PostgreSQL (id: ${created.id.slice(0, 8)}…).`);
      }
    } catch (err) {
      addLogMessage('error', `Cloud sync falló: ${err instanceof Error ? err.message : 'API no disponible'}`);
    } finally {
      setCloudSaving(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-[#0A0B0E] flex flex-col text-slate-200 font-sans">
      
      {/* Top Banner Status Bar - Sophisticated Dark styling */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-[#0F1116] shrink-0 z-[60] select-none shadow-xl">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="font-mono text-sm font-bold tracking-tighter uppercase text-emerald-400">Kronos_Engine v2.0</span>
          </div>
          <div className="h-4 w-px bg-white/10 mx-2"></div>
          
          {/* Target displays */}
          <div className="flex gap-4">
            <div className="flex items-center gap-2 text-xs bg-white/5 border border-white/10 px-3 py-1.5 rounded-md" title="Target IP address variable">
              <span className="text-white/40 font-mono select-none">$TARGET</span>
              <input 
                type="text" 
                value={target} 
                onChange={(e) => setTarget(e.target.value)}
                placeholder="10.10.11.242"
                className="bg-transparent border-none outline-none focus:ring-0 w-28 text-emerald-300 font-mono text-xs"
              />
            </div>
            <div className="flex items-center gap-2 text-xs bg-white/5 border border-white/10 px-3 py-1.5 rounded-md" title="Attacker VPN callback vector">
              <span className="text-white/40 font-mono select-none">$ATTACKER_IP</span>
              <input 
                type="text" 
                value={attackerIp} 
                onChange={(e) => setAttackerIp(e.target.value)}
                placeholder="10.10.14.15"
                className="bg-transparent border-none outline-none focus:ring-0 w-28 text-orange-400 font-mono text-xs"
              />
            </div>
          </div>

          <div className="h-4 w-px bg-white/10 mx-2 hidden lg:block"></div>

          {/* Quick Metrics */}
          <div className="hidden lg:flex items-center space-x-5 text-xs font-mono select-none">
            <div className="flex items-center space-x-1.5" title="Attack actions mapped in whiteboard">
              <Network className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-slate-400 text-[11px]">NODES:</span>
              <span className="text-white font-bold">{totalNodesCount}</span>
            </div>
            <div className="flex items-center space-x-1.5" title="Compromised target successes in state machine">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-slate-400 text-[11px]">PWND:</span>
              <span className="text-emerald-400 font-bold">{pwndNodesCount}</span>
            </div>
            <div className="flex items-center space-x-1.5" title="Active background scanning jobs">
              <Activity className="h-3.5 w-3.5 text-blue-500 animate-pulse" />
              <span className="text-slate-400 text-[11px]">ACTIVE:</span>
              <span className="text-blue-400 font-bold">{activeAttackingCount}</span>
            </div>
          </div>
        </div>

        {/* Global actions and terminal indicators */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => void handleCloudSave()}
            disabled={cloudSaving}
            className="px-4 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs rounded transition-all font-sans cursor-pointer font-bold flex items-center gap-1.5 disabled:opacity-50"
            title="Persistir grafo en PostgreSQL (FastAPI)"
          >
            <CloudUpload className={`h-3.5 w-3.5 ${cloudSaving ? 'animate-pulse' : ''}`} />
            <span>{cloudSaving ? 'Guardando…' : cloudWorkspaceId ? 'Sync Cloud' : 'Guardar Cloud'}</span>
          </button>
          <button
            id="btn-open-repertoire"
            onClick={() => setIsRepertoireOpen(true)}
            className="px-4 py-1.5 bg-purple-600/25 hover:bg-purple-600/35 border border-purple-500/40 text-purple-300 text-xs rounded transition-all font-sans cursor-pointer font-bold flex items-center gap-1.5 hover:border-purple-400 hover:text-purple-200"
            title="Abrir Archivador / Repertorio de Pentest y CTFs"
          >
            <FolderHeart className="h-3.5 w-3.5 text-purple-400 animate-pulse" />
            <span>Repertorio Pentests & CTFs</span>
          </button>
          <button
            onClick={() => {
              const exportState = {
                target,
                attackerIp,
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
              addLogMessage('success', 'Tactical workflow schema exported successfully as JSON file.');
            }}
            className="px-4 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/50 text-emerald-400 text-xs rounded transition-all font-sans cursor-pointer font-bold"
          >
            Export Flow (.json)
          </button>
          <button
            onClick={() => setShowTerminal(prev => !prev)}
            className="px-4 py-1.5 bg-white/5 border border-white/10 text-white/70 text-xs rounded hover:bg-white/10 transition-all font-sans cursor-pointer font-medium"
          >
            {showTerminal ? 'Hide Terminal' : 'Show Terminal'}
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Control Panel Sidebar */}
        <Sidebar
          target={target}
          onChangeTarget={setTarget}
          attackerIp={attackerIp}
          onChangeAttackerIp={setAttackerIp}
          globalVars={globalVars}
          setGlobalVars={setGlobalVars}
          nodes={nodes}
          connections={connections}
          customRules={customRules}
          onUpdateCustomRules={setCustomRules}
          onAddNode={handleAddNode}
          onReplaceGraph={handleReplaceGraph}
          onLogMessage={addLogMessage}
        />

        {/* Center Canvas Grid */}
        <GraphCanvas
          nodes={nodes}
          connections={connections}
          selectedNodeId={selectedNodeId}
          target={target}
          attackerIp={attackerIp}
          globalVars={globalVars}
          onSelectNode={setSelectedNodeId}
          onUpdateNodes={setNodes}
          onUpdateConnections={setConnections}
          onLogMessage={addLogMessage}
          onSpawnSuggestedNode={handleSpawnSuggestedNode}
          ruleSuggestions={activeSuggestions}
          onDeleteNode={handleDeleteNode}
          onDeleteConnection={handleDeleteConnection}
          onReplaceGraph={handleReplaceGraph}
          onAutoAlign={handleAutoAlignNodes}
        />

        {/* Slide-out details drawer overlays on the right panel */}
        {currentSelectedNode && (
          <NodeDetailDrawer
            node={currentSelectedNode}
            target={target}
            attackerIp={attackerIp}
            globalVars={globalVars}
            setGlobalVars={setGlobalVars}
            onClose={() => setSelectedNodeId(null)}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
            onLogMessage={addLogMessage}
          />
        )}
      </div>

      {/* Terminal Log Panel collapsible footers */}
      {showTerminal && (
        <TerminalLogPanel
          logs={logs}
          onClearLogs={handleClearLogs}
          onAddSimulatedLog={addLogMessage}
        />
      )}

      {/* Reusable full-screen rich overlay confirmation popup */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        type={confirmState.type}
        onConfirm={confirmState.onConfirm}
        onCancel={confirmState.onCancel}
      />

      {/* Catalog repertoire storage cabinets component overlay */}
      <RepertoireDashboard
        isOpen={isRepertoireOpen}
        onClose={() => setIsRepertoireOpen(false)}
        activeNodes={nodes}
        activeConnections={connections}
        activeGlobalVars={globalVars}
        target={target}
        onChangeTarget={setTarget}
        attackerIp={attackerIp}
        onChangeAttackerIp={setAttackerIp}
        onLoadWorkspace={handleLoadWorkspace}
        onLogMessage={addLogMessage}
      />

    </div>
  );
}
