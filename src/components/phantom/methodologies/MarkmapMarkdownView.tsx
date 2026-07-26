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
} from 'lucide-react';
import type { POLNode, Methodology } from './types';
import { STATUS_SYMBOLS } from './types';

interface MarkmapMarkdownViewProps {
  methodology: Methodology;
  nodes: POLNode[];
}

export function MarkmapMarkdownView({
  methodology,
  nodes,
}: MarkmapMarkdownViewProps) {
  const [copied, setCopied] = useState(false);

  // Generate markmap compatible markdown from tree structure
  const generatedMarkdown = useMemo(() => {
    let md = `---
markmap:
  colorFreezeLevel: 3
  maxWidth: 300
---

# ${methodology.title}
> ${methodology.description}

`;

    const processNode = (node: POLNode, currentMd: string): string => {
      const symbol = STATUS_SYMBOLS[node.status]?.symbol || '○';
      const headingPrefix = '#'.repeat(Math.min(node.depth + 1, 6));

      if (node.kind === 'command') {
        return `${currentMd}- \`${node.title}\` (${symbol})\n`;
      }

      if (node.depth === 0) {
        return currentMd;
      }

      let line = `${headingPrefix} ${symbol} ${node.title}\n`;
      if (node.description) {
        line += `> ${node.description}\n`;
      }
      return currentMd + line + '\n';
    };

    let result = md;
    for (const node of nodes) {
      result = processNode(node, result);
    }

    return result;
  }, [methodology, nodes]);

  const [markdownText, setMarkdownText] = useState(generatedMarkdown);

  useEffect(() => {
    setMarkdownText(generatedMarkdown);
  }, [generatedMarkdown]);

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
    <div className="w-full flex-1 flex flex-col overflow-hidden border border-border/50 rounded-2xl bg-card shadow-lg">
      {/* Action Toolbar */}
      <div className="p-3 border-b border-border/40 bg-muted/20 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-400 flex items-center justify-center">
            <FileText className="size-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
              Vista Markdown Markmap
              <span className="text-[10px] font-mono font-normal px-2 py-0.2 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                https://markmap.js.org/repl
              </span>
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Sintaxis Markdown pura para copiar y usar en Markmap REPL.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyMarkdown}
            className="px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
            <span>{copied ? '¡Copiado!' : 'Copiar Markdown'}</span>
          </button>

          <button
            onClick={handleDownloadMd}
            title="Descargar .md"
            className="p-1.5 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <Download className="size-4" />
          </button>

          <button
            onClick={handleOpenMarkmapRepl}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md flex items-center gap-1.5 transition-all hover:scale-[1.02]"
          >
            <span>Abrir en Markmap REPL</span>
            <ExternalLink className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Full Width Markdown Source Code Textarea */}
      <div className="flex-1 flex flex-col min-h-0 bg-background/50">
        <div className="px-3 py-1.5 bg-muted/40 border-b border-border/30 text-[11px] font-mono text-muted-foreground flex items-center gap-1.5">
          <Code2 className="size-3.5 text-violet-400" />
          <span>Markmap Syntax Source Code (.md)</span>
        </div>
        <textarea
          value={markdownText}
          onChange={(e) => setMarkdownText(e.target.value)}
          className="flex-1 w-full p-4 bg-transparent font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none resize-none leading-relaxed custom-scrollbar"
        />
      </div>
    </div>
  );
}
