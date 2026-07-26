/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  Copy,
  Check,
  ExternalLink,
  Download,
  Code2,
  RefreshCw,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import type { POLNode, Methodology, NodeKind, NodeStatus } from './types';
import { STATUS_SYMBOLS } from './types';

interface MarkmapMarkdownViewProps {
  methodology: Methodology;
  nodes: POLNode[];
  onUpdateNodes?: (nodes: POLNode[]) => void;
}

// Bi-directional parser: converts Markdown text with 3-level nomenclature back into POLNode[] tree
export function parseMarkdownToPOLNodes(md: string): POLNode[] {
  const lines = md.split('\n');
  const nodes: POLNode[] = [];
  const depthStack: { depth: number; id: string }[] = [];
  let lastNode: POLNode | null = null;

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (
      !line ||
      line.startsWith('---') ||
      line.startsWith('markmap:') ||
      line.startsWith('colorFreeze') ||
      line.startsWith('maxWidth')
    ) {
      continue;
    }

    // Quote lines (> Description) -> append to last node's description
    if (line.startsWith('>') && lastNode) {
      const desc = line.substring(1).trim();
      if (!desc.toLowerCase().startsWith('metodología estructurada') && !desc.toLowerCase().startsWith('marco')) {
        lastNode.description = lastNode.description ? `${lastNode.description}\n${desc}` : desc;
      }
      continue;
    }

    // Heading lines (# Heading, ## Heading, ### Heading...)
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const hashCount = headingMatch[1].length;
      const depth = hashCount - 1;
      let rawTitle = headingMatch[2].trim();

      // Skip root document title if it matches methodology title
      if (depth === 0 && rawTitle.toLowerCase().includes('assessment') && nodes.length === 0) {
        continue;
      }

      // Detect status if present
      let status: NodeStatus = 'todo';
      if (rawTitle.includes('✔') || rawTitle.includes('(✓)')) status = 'done';
      else if (rawTitle.includes('◐')) status = 'in-progress';
      else if (rawTitle.includes('✖')) status = 'failed';
      else if (rawTitle.includes('⊘')) status = 'na';

      // Clean title from status symbols & Emojis
      let title = rawTitle
        .replace(/^[○◐✔✖⊘\s]+/, '')
        .replace(/\s*\([✓○◐✔✖⊘]\)/, '')
        .trim();

      // Detect kind from Nomenclature Keywords & Emojis
      let kind: NodeKind = 'phase';
      const upper = title.toUpperCase();

      if (upper.includes('TARGET:') || title.includes('🎯')) {
        kind = 'target';
        title = title.replace(/^🎯\s*/, '').replace(/^TARGET:\s*/i, '').trim();
      } else if (upper.includes('ATTACKER:') || title.includes('⚔️')) {
        kind = 'attacker';
        title = title.replace(/^⚔️\s*/, '').replace(/^ATTACKER:\s*/i, '').trim();
      } else if (upper.includes('DOMAIN:') || title.includes('🌐')) {
        kind = 'domain';
        title = title.replace(/^🌐\s*/, '').replace(/^DOMAIN:\s*/i, '').trim();
      } else if (upper.includes('ASSET:') || title.includes('🖥️')) {
        kind = 'asset';
        title = title.replace(/^🖥️\s*/, '').replace(/^ASSET:\s*/i, '').trim();
      } else if (upper.includes('NODE:') || title.includes('🥷') || title.includes('💻')) {
        kind = 'node';
        title = title.replace(/^[🥷💻]\s*/, '').replace(/^NODE:\s*/i, '').trim();
      } else if (upper.includes('METHODOLOGY:') || title.includes('📋')) {
        kind = 'methodology';
        title = title.replace(/^📋\s*/, '').replace(/^METHODOLOGY:\s*/i, '').trim();
      } else if (upper.includes('PHASE:') || title.includes('🟣')) {
        kind = 'phase';
        title = title.replace(/^🟣\s*/, '').replace(/^PHASE:\s*/i, '').trim();
      } else if (upper.includes('TACTIC:') || title.includes('🛠️')) {
        kind = 'tactic';
        title = title.replace(/^🛠️\s*/, '').replace(/^TACTIC:\s*/i, '').trim();
      } else if (depth === 0) kind = 'target';
      else if (depth === 1) kind = 'methodology';
      else if (depth === 2) kind = 'phase';

      // Clean title once more
      title = title.replace(/\s*\([✓○◐✔✖⊘]\)$/, '').trim();

      // Maintain depth stack
      while (depthStack.length > 0 && depthStack[depthStack.length - 1].depth >= depth) {
        depthStack.pop();
      }

      const parentId = depthStack.length > 0 ? depthStack[depthStack.length - 1].id : null;
      const id = `node-md-${Date.now()}-${nodes.length}`;

      const newNode: POLNode = {
        id,
        parentId,
        title,
        kind,
        status,
        expanded: true,
        depth: Math.min(depth, 6),
        variables: {},
      };

      nodes.push(newNode);
      depthStack.push({ depth, id });
      lastNode = newNode;
      continue;
    }

    // List item lines (- `command` or - list item)
    if (line.startsWith('-')) {
      let content = line.substring(1).trim();
      let status: NodeStatus = 'todo';
      if (content.includes('✔') || content.includes('(✓)')) status = 'done';
      else if (content.includes('◐')) status = 'in-progress';
      else if (content.includes('✖')) status = 'failed';

      content = content
        .replace(/^[○◐✔✖⊘\s]+/, '')
        .replace(/\s*\([✓○◐✔✖⊘]\)/, '')
        .trim();

      if (content.startsWith('`') && content.endsWith('`')) {
        content = content.slice(1, -1);
      }
      content = content.replace(/^\[COMMAND\]\s*/i, '').trim();

      const depth = depthStack.length > 0 ? depthStack[depthStack.length - 1].depth + 1 : 1;
      const parentId = depthStack.length > 0 ? depthStack[depthStack.length - 1].id : null;
      const id = `node-md-${Date.now()}-${nodes.length}`;

      const newNode: POLNode = {
        id,
        parentId,
        title: content,
        kind: 'command',
        status,
        expanded: true,
        depth: Math.min(depth, 6),
        variables: {},
      };

      nodes.push(newNode);
      lastNode = newNode;
    }
  }

  return nodes;
}

export function MarkmapMarkdownView({
  methodology,
  nodes,
  onUpdateNodes,
}: MarkmapMarkdownViewProps) {
  const [copied, setCopied] = useState(false);
  const [synced, setSynced] = useState(false);
  const [isUserEditing, setIsUserEditing] = useState(false);

  // Generate clean 3-level Markmap Markdown with Emojis + Keywords
  const generatedMarkdown = useMemo(() => {
    let md = `---
markmap:
  colorFreezeLevel: 3
  maxWidth: 300
---

# ${methodology.title}
> ${methodology.description}

`;

    for (const node of nodes) {
      const symbol = STATUS_SYMBOLS[node.status]?.symbol || '○';

      // Clean title from any existing status symbol or duplicate prefixes
      let cleanTitle = node.title
        .replace(/\s*\([✓○◐✔✖⊘]\)$/, '')
        .replace(/^[🎯⚔️🌐🖥️🥷💻📋🟣🛠️]\s*/, '')
        .replace(/^(TARGET|ATTACKER|DOMAIN|ASSET|NODE|METHODOLOGY|PHASE|TACTIC):\s*/i, '')
        .trim();

      const hashCount = Math.min(node.depth + 2, 6);
      const headingPrefix = '#'.repeat(hashCount);

      if (node.kind === 'command') {
        md += `- \`[COMMAND] ${cleanTitle}\` (${symbol})\n`;
      } else {
        let prefix = '';
        switch (node.kind) {
          case 'target':
            prefix = '🎯 TARGET: ';
            break;
          case 'attacker':
            prefix = '⚔️ ATTACKER: ';
            break;
          case 'domain':
            prefix = '🌐 DOMAIN: ';
            break;
          case 'asset':
            prefix = '🖥️ ASSET: ';
            break;
          case 'node':
            prefix = '🥷 NODE: ';
            break;
          case 'methodology':
            prefix = '📋 METHODOLOGY: ';
            break;
          case 'phase':
            prefix = '🟣 PHASE: ';
            break;
          case 'tactic':
            prefix = '🛠️ TACTIC: ';
            break;
          default:
            prefix = '';
        }

        md += `${headingPrefix} ${prefix}${cleanTitle} (${symbol})\n`;
        if (node.description) {
          md += `> ${node.description}\n`;
        }
        md += '\n';
      }
    }

    return md;
  }, [methodology, nodes]);

  const [markdownText, setMarkdownText] = useState(generatedMarkdown);

  // Update markdownText ONLY when the user is NOT actively typing to prevent feedback loops
  useEffect(() => {
    if (!isUserEditing) {
      setMarkdownText(generatedMarkdown);
    }
  }, [generatedMarkdown, isUserEditing]);

  const handleApplyMarkdownToNodes = () => {
    if (!onUpdateNodes) return;
    const parsed = parseMarkdownToPOLNodes(markdownText);
    if (parsed.length > 0) {
      onUpdateNodes(parsed);
      setSynced(true);
      setTimeout(() => setSynced(false), 2000);
    }
  };

  const handleResetToTree = () => {
    setMarkdownText(generatedMarkdown);
    setIsUserEditing(false);
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdownText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleOpenMarkmapRepl = () => {
    navigator.clipboard.writeText(markdownText);
    window.open('https://markmap.js.org/repl', '_blank');
  };

  const handleDownloadMd = () => {
    const blob = new Blob([markdownText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${methodology.code.toLowerCase()}_markmap.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full flex-1 flex flex-col overflow-hidden border border-border/60 rounded-2xl bg-card shadow-lg p-6 space-y-4">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 border border-border/50 rounded-xl p-3">
        <div className="flex items-center gap-2">
          <Code2 className="size-4 text-violet-500" />
          <h3 className="text-xs font-bold text-foreground">Editor Markdown Source</h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500 border border-violet-500/30 font-bold">
            Sincronización Bidireccional
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onUpdateNodes && (
            <button
              onClick={handleApplyMarkdownToNodes}
              className="px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
              title="Aplicar cambios de Markdown al árbol de la metodología"
            >
              <RefreshCw className="size-3.5" />
              <span>{synced ? '¡Sincronizado!' : 'Aplicar Cambios a Metodología'}</span>
            </button>
          )}

          <button
            onClick={handleResetToTree}
            className="px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            title="Restablecer código Markdown desde el árbol actual"
          >
            <RotateCcw className="size-3.5" />
            <span>Regenerar</span>
          </button>

          <button
            onClick={handleCopyMarkdown}
            className="px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>

          <button
            onClick={handleDownloadMd}
            className="p-1.5 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            title="Descargar archivo .md"
          >
            <Download className="size-4" />
          </button>

          <button
            onClick={handleOpenMarkmapRepl}
            className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
          >
            <span>Abrir en Markmap REPL</span>
            <ExternalLink className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Responsive Theme-Aware Editor Area (Full Light & Dark Mode Compatibility) */}
      <div className="flex-1 flex flex-col min-h-0 bg-background text-foreground border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-3 py-2 bg-muted/60 border-b border-border text-[11px] font-mono text-muted-foreground flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-semibold text-foreground">
            <FileText className="size-3.5 text-violet-500" />
            Markmap Syntax Source Code (.md) — Edita libremente, borra o agrega contenido
          </span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
            {isUserEditing ? 'Editando...' : '100% Sincronizado'}
          </span>
        </div>

        <textarea
          value={markdownText}
          onFocus={() => setIsUserEditing(true)}
          onChange={(e) => {
            setIsUserEditing(true);
            setMarkdownText(e.target.value);
          }}
          onBlur={() => {
            setIsUserEditing(false);
            handleApplyMarkdownToNodes();
          }}
          className="flex-1 w-full bg-card text-foreground font-mono text-xs focus:outline-none custom-scrollbar resize-none leading-relaxed p-4 selection:bg-violet-500/30"
          placeholder="Escribe o pega sintaxis Markdown Markmap aquí..."
        />
      </div>
    </div>
  );
}
