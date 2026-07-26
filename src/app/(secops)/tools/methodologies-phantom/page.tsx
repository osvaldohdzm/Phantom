/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  FileCode,
  FolderTree,
  FileText,
  GitBranch,
  Download,
  Copy,
  Sparkles,
  Layers,
  Save,
  CheckCircle2,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  Methodology,
  POLNode,
  ViewMode,
  PhantomAiContext,
  MethodologyCategory,
} from '@/components/phantom/methodologies/types';
import { MethodologyCatalog } from '@/components/phantom/methodologies/MethodologyCatalog';
import { OutlinePentestView } from '@/components/phantom/methodologies/OutlinePentestView';
import { MarkmapMarkdownView } from '@/components/phantom/methodologies/MarkmapMarkdownView';
import { MarkmapMindmapView } from '@/components/phantom/methodologies/MarkmapMindmapView';
import { PhantomAiBubble } from '@/components/phantom/methodologies/PhantomAiBubble';

const SEED_METHODOLOGIES: Methodology[] = [
  {
    id: 'meth-owasp-web',
    title: 'OWASP Web Application Security Assessment',
    code: 'WEB-OWASP-02',
    description: 'Metodología estructurada de evaluación de seguridad web basada en el estándar OWASP WSTG v4.2.',
    category: 'Web Applications (OWASP)',
    tags: ['target', 'attacker', 'methodology', 'web', 'owasp'],
    createdAt: '2026-07-05',
    updatedAt: '2026-07-20',
    nodes: [
      {
        id: 'web-tgt-1',
        parentId: null,
        title: 'Entorno Cliente (Infraestructura Objetivo)',
        kind: 'target',
        status: 'in-progress',
        expanded: true,
        depth: 0,
        description: 'Superficie de ataque y activos expuestos del cliente.',
      },
      {
        id: 'web-dom-1',
        parentId: 'web-tgt-1',
        title: 'empresa.com',
        kind: 'domain',
        status: 'in-progress',
        expanded: true,
        depth: 1,
        variables: { DOMAIN: 'empresa.com' },
      },
      {
        id: 'web-asset-1',
        parentId: 'web-dom-1',
        title: 'Portal Web HTTPS (app.empresa.com)',
        kind: 'asset',
        status: 'in-progress',
        expanded: true,
        depth: 2,
        variables: { TARGET_URL: 'https://app.empresa.com' },
      },
      {
        id: 'web-att-1',
        parentId: null,
        title: 'Infraestructura Ofensiva (Red Team / Auditor)',
        kind: 'attacker',
        status: 'in-progress',
        expanded: true,
        depth: 0,
        description: 'Ecosistema de herramientas e IPs ofensivas del auditor.',
      },
      {
        id: 'web-node-1',
        parentId: 'web-att-1',
        title: 'BurpSuite Proxy & Kali Linux (VPN: 10.10.0.55)',
        kind: 'node',
        status: 'in-progress',
        expanded: true,
        depth: 1,
        variables: { ATTACKER_IP: '10.10.0.55', PROXY: '127.0.0.1:8080' },
      },
      {
        id: 'web-me-1',
        parentId: null,
        title: 'OWASP Testing Guide v4.2 Framework',
        kind: 'methodology',
        status: 'in-progress',
        expanded: true,
        depth: 0,
        description: 'Marco sistemático de fases, tácticas y comandos de auditoría.',
      },
      {
        id: 'web-ph-1',
        parentId: 'web-me-1',
        title: 'Fase 1: Reconocimiento y Descubrimiento de Contenido',
        kind: 'phase',
        status: 'done',
        expanded: true,
        depth: 1,
      },
      {
        id: 'web-tac-1',
        parentId: 'web-ph-1',
        title: 'Content Discovery & Endpoint Fuzzing',
        kind: 'tactic',
        status: 'done',
        expanded: true,
        depth: 2,
      },
      {
        id: 'web-co-1',
        parentId: 'web-tac-1',
        title: 'ffuf -u https://{TARGET_URL}/FUZZ -w /usr/share/wordlists/dirb/common.txt',
        kind: 'command',
        status: 'done',
        expanded: true,
        depth: 3,
      },
    ],
  },
  {
    id: 'meth-ad-2026',
    title: 'Active Directory & Internal Infrastructure Pentest',
    code: 'AD-POL-01',
    description: 'Metodología estructurada para auditorías internas de infraestructura y Active Directory (Recon, Kerberos, SMB, Pivoting).',
    category: 'Infrastructure & AD',
    tags: ['target', 'attacker', 'methodology', 'ad', 'smb'],
    createdAt: '2026-07-01',
    updatedAt: '2026-07-25',
    nodes: [
      {
        id: 'node-tgt-1',
        parentId: null,
        title: 'Dominio Interno Corporativo',
        kind: 'target',
        status: 'in-progress',
        expanded: true,
        depth: 0,
      },
      {
        id: 'node-dom-1',
        parentId: 'node-tgt-1',
        title: 'baxter.local',
        kind: 'domain',
        status: 'in-progress',
        expanded: true,
        depth: 1,
        variables: { DOMAIN: 'baxter.local' },
      },
      {
        id: 'node-asset-1',
        parentId: 'node-dom-1',
        title: 'Domain Controller DC-01 (192.168.0.112)',
        kind: 'asset',
        status: 'in-progress',
        expanded: true,
        depth: 2,
        variables: { RHOST: '192.168.0.112' },
      },
      {
        id: 'node-att-1',
        parentId: null,
        title: 'Kali Workstation (LHOST: 10.10.14.5)',
        kind: 'attacker',
        status: 'in-progress',
        expanded: true,
        depth: 0,
        variables: { LHOST: '10.10.14.5', LPORT: '4444' },
      },
      {
        id: 'node-me-1',
        parentId: null,
        title: 'AD & Internal Security Methodology',
        kind: 'methodology',
        status: 'in-progress',
        expanded: true,
        depth: 0,
      },
      {
        id: 'node-ph-1',
        parentId: 'node-me-1',
        title: 'Fase 1: Reconocimiento SMB & Null Session',
        kind: 'phase',
        status: 'done',
        expanded: true,
        depth: 1,
      },
      {
        id: 'node-co-1',
        parentId: 'node-ph-1',
        title: "crackmapexec smb {RHOST} -u '' -p ''",
        kind: 'command',
        status: 'done',
        expanded: true,
        depth: 2,
      },
    ],
  },
];

export default function MethodologiesPhantomPage() {
  const [methodologies, setMethodologies] = useState<Methodology[]>([]);
  const [selectedMethodologyId, setSelectedMethodologyId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('outline');
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<string>('');

  // Load methodologies on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('phantom_methodologies_catalog');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMethodologies(parsed);
          } else {
            setMethodologies(SEED_METHODOLOGIES);
          }
        } catch {
          setMethodologies(SEED_METHODOLOGIES);
        }
      } else {
        setMethodologies(SEED_METHODOLOGIES);
      }
    }
  }, []);

  // Save methodologies on update
  useEffect(() => {
    if (methodologies.length > 0) {
      localStorage.setItem('phantom_methodologies_catalog', JSON.stringify(methodologies));
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  }, [methodologies]);

  const activeMethodology = useMemo(() => {
    return methodologies.find((m) => m.id === selectedMethodologyId) || null;
  }, [methodologies, selectedMethodologyId]);

  // Set default active node when methodology opens
  useEffect(() => {
    if (activeMethodology && activeMethodology.nodes.length > 0) {
      if (!activeNodeId || !activeMethodology.nodes.some((n) => n.id === activeNodeId)) {
        setActiveNodeId(activeMethodology.nodes[0].id);
      }
    }
  }, [activeMethodology, activeNodeId]);

  // Handlers for Methodology Operations
  const handleCreateMethodology = (newMeta: Partial<Methodology>, preset: string) => {
    let baseNodes: POLNode[] = [];

    if (preset === 'ad') {
      baseNodes = SEED_METHODOLOGIES[0].nodes;
    } else if (preset === 'owasp') {
      baseNodes = SEED_METHODOLOGIES[1].nodes;
    } else {
      baseNodes = [
        {
          id: `node-root-${Date.now()}`,
          parentId: null,
          title: newMeta.title || 'Nueva Metodología',
          kind: 'workspace',
          status: 'todo',
          expanded: true,
          depth: 0,
        },
      ];
    }

    const newMeth: Methodology = {
      id: `meth-${Date.now()}`,
      title: newMeta.title || 'Nueva Metodología',
      code: newMeta.code || 'POL-NEW',
      description: newMeta.description || '',
      category: newMeta.category || 'Custom',
      tags: newMeta.tags || ['custom'],
      nodes: baseNodes,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    setMethodologies((prev) => [newMeth, ...prev]);
    setSelectedMethodologyId(newMeth.id);
  };

  const handleDuplicateMethodology = (id: string) => {
    const target = methodologies.find((m) => m.id === id);
    if (!target) return;

    const dup: Methodology = {
      ...target,
      id: `meth-${Date.now()}`,
      title: `${target.title} (Copia)`,
      code: `${target.code}-COPY`,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    setMethodologies((prev) => [dup, ...prev]);
  };

  const handleDeleteMethodology = (id: string) => {
    setMethodologies((prev) => prev.filter((m) => m.id !== id));
    if (selectedMethodologyId === id) {
      setSelectedMethodologyId(null);
    }
  };

  const handleExportMethodology = (id: string) => {
    const target = methodologies.find((m) => m.id === id);
    if (!target) return;

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(target, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${target.code.toLowerCase()}_phantom.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportMethodology = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.title && Array.isArray(parsed.nodes)) {
          const imported: Methodology = {
            ...parsed,
            id: `meth-imp-${Date.now()}`,
          };
          setMethodologies((prev) => [imported, ...prev]);
          setSelectedMethodologyId(imported.id);
        }
      } catch (err) {
        console.error('Error importing methodology JSON', err);
      }
    };
    reader.readAsText(file);
  };

  const handleUpdateNodes = (newNodes: POLNode[]) => {
    if (!selectedMethodologyId) return;
    setMethodologies((prev) =>
      prev.map((m) => (m.id === selectedMethodologyId ? { ...m, nodes: newNodes, updatedAt: new Date().toISOString() } : m))
    );
  };

  const handleApplyCommandToActiveNode = (command: string) => {
    if (!activeMethodology || !activeNodeId) return;
    const updated = activeMethodology.nodes.map((n) =>
      n.id === activeNodeId ? { ...n, title: command, kind: 'command' as const } : n
    );
    handleUpdateNodes(updated);
  };

  const handleMergeProposedNodes = (proposedNodes: POLNode[]) => {
    if (!activeMethodology) return;

    // Filter out duplicates by title
    const existingTitles = new Set(activeMethodology.nodes.map((n) => n.title.toLowerCase().trim()));
    const newUniqueNodes = proposedNodes.filter((n) => !existingTitles.has(n.title.toLowerCase().trim()));

    if (newUniqueNodes.length === 0) return;

    const mergedNodes = [...activeMethodology.nodes, ...newUniqueNodes];
    handleUpdateNodes(mergedNodes);

    // Trigger save indicator toast
    const toast = document.getElementById('save-toast-indicator');
    if (toast) {
      toast.innerText = `+${newUniqueNodes.length} Nodos Integrados`;
      toast.classList.remove('opacity-0');
      setTimeout(() => {
        toast.classList.add('opacity-0');
        toast.innerText = 'Guardado';
      }, 3000);
    }
  };

  // Build lightweight context (< 200 tokens) for Phantom AI Assistant
  const activeNodeObj = activeMethodology?.nodes.find((n) => n.id === activeNodeId);
  const aiContext: PhantomAiContext = {
    activeMethodologyTitle: activeMethodology?.title,
    activeMethodologyId: activeMethodology?.id,
    activeViewMode: activeMethodology ? viewMode : 'catalog',
    totalNodesCount: activeMethodology?.nodes.length || 0,
    activeNode: activeNodeObj
      ? {
          id: activeNodeObj.id,
          title: activeNodeObj.title,
          kind: activeNodeObj.kind,
          status: activeNodeObj.status,
          command: activeNodeObj.title,
        }
      : undefined,
  };

  return (
    <div className="phantom-workspace w-full h-[calc(100vh-4rem)] flex flex-col overflow-hidden bg-background">
      {/* If No Methodology is Selected -> Show Catalog */}
      {!activeMethodology ? (
        <MethodologyCatalog
          methodologies={methodologies}
          onSelectMethodology={(id) => setSelectedMethodologyId(id)}
          onCreateMethodology={handleCreateMethodology}
          onDuplicateMethodology={handleDuplicateMethodology}
          onDeleteMethodology={handleDeleteMethodology}
          onImportMethodology={handleImportMethodology}
          onExportMethodology={handleExportMethodology}
        />
      ) : (
        /* Detailed Methodology Screen with Multi-View Modes */
        <div className="flex-1 flex flex-col overflow-hidden p-4 gap-3">
          {/* Top Detail Header Bar */}
          <div className="bg-card border border-border/60 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedMethodologyId(null)}
                className="px-3 py-1.5 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="size-3.5" />
                <span>Volver a Metodologías</span>
              </button>

              <div className="h-5 w-px bg-border/60" />

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/30 uppercase font-bold">
                    {activeMethodology.code}
                  </span>
                  <h2 className="text-sm font-bold text-foreground truncate max-w-xs md:max-w-md">
                    {activeMethodology.title}
                  </h2>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {activeMethodology.nodes.length} nodos • Sincronización 3-Vistas
                </span>
              </div>

              {/* Explicit Save Button */}
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('phantom_methodologies_catalog', JSON.stringify(methodologies));
                    setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
                    const toast = document.getElementById('save-toast-indicator');
                    if (toast) {
                      toast.classList.remove('opacity-0');
                      toast.classList.add('opacity-100');
                      setTimeout(() => {
                        toast.classList.remove('opacity-100');
                        toast.classList.add('opacity-0');
                      }, 2500);
                    }
                  }
                }}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shrink-0 hover:scale-[1.02]"
                title="Guardar metodología inmediatamente"
              >
                <Save className="size-3.5" />
                <span>Guardar</span>
              </button>

              {/* Toast Indicator */}
              <span
                id="save-toast-indicator"
                className="opacity-0 transition-opacity duration-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1"
              >
                <Check className="size-3" />
                Guardado
              </span>
            </div>

            {/* View Mode Tabs Switcher */}
            <div className="flex items-center gap-1 border border-border/70 rounded-xl bg-background p-1 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('outline')}
                className={cn(
                  'px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all',
                  viewMode === 'outline'
                    ? 'bg-violet-500/20 text-violet-400 font-semibold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <FolderTree className="size-3.5" />
                <span>Outline Pentest</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('markdown')}
                className={cn(
                  'px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all',
                  viewMode === 'markdown'
                    ? 'bg-violet-500/20 text-violet-400 font-semibold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <FileText className="size-3.5" />
                <span>Vista Markdown Markmap</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('mindmap')}
                className={cn(
                  'px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all',
                  viewMode === 'mindmap'
                    ? 'bg-violet-500/20 text-violet-400 font-semibold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <GitBranch className="size-3.5" />
                <span>Mapa Mental Markmap</span>
              </button>
            </div>
          </div>

          {/* Render Active View Tab */}
          <div className="flex-1 flex overflow-hidden">
            {viewMode === 'outline' && (
              <OutlinePentestView
                nodes={activeMethodology.nodes}
                onUpdateNodes={handleUpdateNodes}
                activeNodeId={activeNodeId}
                onSelectNode={(id) => setActiveNodeId(id)}
              />
            )}

            {viewMode === 'markdown' && (
              <MarkmapMarkdownView
                methodology={activeMethodology}
                nodes={activeMethodology.nodes}
                onUpdateNodes={handleUpdateNodes}
              />
            )}

            {viewMode === 'mindmap' && (
              <MarkmapMindmapView
                methodology={activeMethodology}
                nodes={activeMethodology.nodes}
                activeNodeId={activeNodeId}
                onSelectNode={(id) => setActiveNodeId(id)}
              />
            )}
          </div>
        </div>
      )}

      {/* Floating AI Assistant Bubble (Always Available) */}
      <PhantomAiBubble
        context={aiContext}
        onApplyCommandToActiveNode={handleApplyCommandToActiveNode}
        onMergeProposedNodes={handleMergeProposedNodes}
      />
    </div>
  );
}
