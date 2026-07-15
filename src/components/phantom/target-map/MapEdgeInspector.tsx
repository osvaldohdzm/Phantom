'use client';

import React, { useState, useEffect } from 'react';
import { ArrowRight, Trash2, X, Link, HelpCircle, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UiMessageKey } from '@/lib/ui-locale';
import {
  MAP_EDGE_RELATIONS,
  type PentestMapEdge,
  type PentestMapNode,
  type PentestTargetMapDocument,
} from '@/lib/pentest-target-map-schema';
import { getMapNodeIconDataUri } from '@/lib/pentest-target-map-icons';
import { resolveCommandTemplate } from '@/lib/pentest-map-command-vars';

type Props = {
  edge: PentestMapEdge;
  nodes: PentestMapNode[];
  doc: PentestTargetMapDocument;
  isDark: boolean;
  uiLanguage: 'es' | 'en';
  isTouchDevice?: boolean;
  t: (key: UiMessageKey) => string;
  onChangeLabel: (label: string) => void;
  onPatchEdge?: (updates: Partial<PentestMapEdge>) => void;
  onDelete: () => void;
  onClose: () => void;
};

export function MapEdgeInspector({
  edge,
  nodes,
  doc,
  isDark,
  uiLanguage,
  isTouchDevice,
  t,
  onChangeLabel,
  onPatchEdge,
  onDelete,
  onClose,
}: Props) {
  const fromNode = nodes.find((n) => n.id === edge.from);
  const toNode = nodes.find((n) => n.id === edge.to);

  const [customLabel, setCustomLabel] = useState(edge.label || '');
  const [copiedNodeId, setCopiedNodeId] = useState<string | null>(null);

  useEffect(() => {
    setCustomLabel(edge.label || '');
  }, [edge.label]);

  const handleCustomLabelChange = (val: string) => {
    setCustomLabel(val);
    onChangeLabel(val);
  };

  const handleCopy = (text: string, nodeId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNodeId(nodeId);
    setTimeout(() => setCopiedNodeId(null), 2000);
  };

  const fromNodeHasCommand = fromNode && fromNode.kind === 'command' && fromNode.command;
  const toNodeHasCommand = toNode && toNode.kind === 'command' && toNode.command;

  const edgeInspectorContent = (
    <>
      <div className="phantom-map-inspector-header">
        <div className="flex min-w-0 items-center gap-2">
          <Link className="size-5 shrink-0 text-primary animate-pulse" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {uiLanguage === 'es' ? 'Detalles de Conexión' : 'Connection Details'}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {uiLanguage === 'es' ? 'Relación e interacciones' : 'Relation and interactions'}
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="phantom-map-inspector-close" aria-label="Close">
          ×
        </button>
      </div>

      <div className="phantom-map-inspector-body space-y-4">
        {/* Visual flow illustration */}
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/15 p-3.5 shadow-sm">
          {/* From Node */}
          <div className="flex flex-1 flex-col items-center gap-1 text-center min-w-0">
            {fromNode ? (
              <>
                <img
                  src={getMapNodeIconDataUri(fromNode.kind, isDark)}
                  alt=""
                  className="size-9 drop-shadow-md"
                />
                <span className="truncate text-[10px] font-bold text-foreground w-full">
                  {fromNode.label}
                </span>
                <span className="text-[8px] uppercase tracking-wider text-muted-foreground/80 font-mono">
                  {fromNode.kind}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground font-mono">unknown</span>
            )}
          </div>

          {/* Connection Line */}
          <div className="flex flex-col items-center gap-1 shrink-0 px-1 min-w-[3rem]">
            <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 font-mono text-[9px] font-bold text-primary truncate max-w-[5rem]">
              {edge.label || 'leads_to'}
            </span>
            <ArrowRight className="size-4 text-primary animate-pulse" />
          </div>

          {/* To Node */}
          <div className="flex flex-1 flex-col items-center gap-1 text-center min-w-0">
            {toNode ? (
              <>
                <img
                  src={getMapNodeIconDataUri(toNode.kind, isDark)}
                  alt=""
                  className="size-9 drop-shadow-md"
                />
                <span className="truncate text-[10px] font-bold text-foreground w-full">
                  {toNode.label}
                </span>
                <span className="text-[8px] uppercase tracking-wider text-muted-foreground/80 font-mono">
                  {toNode.kind}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground font-mono">unknown</span>
            )}
          </div>
        </div>

        {/* Copy command associated with connection */}
        {(fromNodeHasCommand || toNodeHasCommand) && (
          <div className="space-y-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 shadow-inner animate-in fade-in duration-200">
            <span className="phantom-map-field-label font-bold text-emerald-600 dark:text-emerald-400 block">
              {uiLanguage === 'es' ? 'Comandos de Conexión' : 'Connection Commands'}
            </span>
            {fromNodeHasCommand && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-semibold truncate flex items-center gap-1.5">
                  <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                  {fromNode.label}
                </p>
                <div className="flex gap-1.5 items-center relative">
                  <pre className="max-h-20 overflow-auto flex-1 rounded border border-emerald-500/20 bg-black/10 p-2 font-mono text-[9px] leading-relaxed text-foreground break-all whitespace-pre-wrap">
                    {resolveCommandTemplate(fromNode.command!, doc, fromNode)}
                  </pre>
                  <button
                    type="button"
                    onClick={() => {
                      if (fromNode.command) {
                        const resolved = resolveCommandTemplate(fromNode.command, doc, fromNode);
                        handleCopy(resolved, fromNode.id);
                      }
                    }}
                    className="phantom-btn px-2 py-2 text-[10px] hover:bg-emerald-500/10 border-emerald-500/20 flex items-center justify-center shrink-0"
                    title={uiLanguage === 'es' ? 'Copiar comando' : 'Copy command'}
                  >
                    {copiedNodeId === fromNode.id ? (
                      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">✓</span>
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}
            {toNodeHasCommand && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-semibold truncate flex items-center gap-1.5">
                  <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                  {toNode.label}
                </p>
                <div className="flex gap-1.5 items-center relative">
                  <pre className="max-h-20 overflow-auto flex-1 rounded border border-emerald-500/20 bg-black/10 p-2 font-mono text-[9px] leading-relaxed text-foreground break-all whitespace-pre-wrap">
                    {resolveCommandTemplate(toNode.command!, doc, toNode)}
                  </pre>
                  <button
                    type="button"
                    onClick={() => {
                      if (toNode.command) {
                        const resolved = resolveCommandTemplate(toNode.command, doc, toNode);
                        handleCopy(resolved, toNode.id);
                      }
                    }}
                    className="phantom-btn px-2 py-2 text-[10px] hover:bg-emerald-500/10 border-emerald-500/20 flex items-center justify-center shrink-0"
                    title={uiLanguage === 'es' ? 'Copiar comando' : 'Copy command'}
                  >
                    {copiedNodeId === toNode.id ? (
                      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">✓</span>
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Attack Chain Builder */}
        <div className="space-y-2 border-t border-border/40 pt-3">
          <span className="phantom-map-field-label">
            {uiLanguage === 'es' ? 'Cadena de Ataque (Attack Chain)' : 'Attack Chain'}
          </span>
          <p className="text-[10px] text-muted-foreground/80 leading-snug">
            {uiLanguage === 'es'
              ? 'Agrega comandos específicos para ejecutarse a través de este enlace.'
              : 'Add specific commands to execute across this link.'}
          </p>
          
          <div className="space-y-2">
            {(edge.commands || []).map((cmd, idx) => (
              <div key={cmd.id} className="rounded-lg border border-border/50 bg-muted/10 p-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-foreground opacity-60">#{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!onPatchEdge) return;
                      const nextCmds = [...(edge.commands || [])];
                      nextCmds.splice(idx, 1);
                      onPatchEdge({ commands: nextCmds.length ? nextCmds : undefined });
                    }}
                    className="text-muted-foreground hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
                
                <div className="flex gap-2">
                  <label className="flex-1 space-y-1">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Tool</span>
                    <input
                      value={cmd.tool || ''}
                      onChange={(e) => {
                        if (!onPatchEdge) return;
                        const nextCmds = [...(edge.commands || [])];
                        nextCmds[idx] = { ...cmd, tool: e.target.value };
                        onPatchEdge({ commands: nextCmds });
                      }}
                      className="phantom-field font-mono text-[10px] h-6 px-1.5"
                      placeholder="e.g. nmap"
                    />
                  </label>
                  <label className="w-16 space-y-1">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Port</span>
                    <input
                      type="number"
                      value={cmd.targetPort || ''}
                      onChange={(e) => {
                        if (!onPatchEdge) return;
                        const nextCmds = [...(edge.commands || [])];
                        nextCmds[idx] = { ...cmd, targetPort: e.target.value ? parseInt(e.target.value, 10) : undefined };
                        onPatchEdge({ commands: nextCmds });
                      }}
                      className="phantom-field font-mono text-[10px] h-6 px-1.5"
                      placeholder="80"
                    />
                  </label>
                </div>
                <label className="block space-y-1">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Command Template</span>
                  <textarea
                    value={cmd.command}
                    onChange={(e) => {
                      if (!onPatchEdge) return;
                      const nextCmds = [...(edge.commands || [])];
                      nextCmds[idx] = { ...cmd, command: e.target.value };
                      onPatchEdge({ commands: nextCmds });
                    }}
                    className="phantom-field font-mono text-[10px] min-h-[40px] p-1.5 leading-relaxed"
                    placeholder="ffuf -u http://{{target}}"
                  />
                </label>

                {cmd.command && (
                  <div className="flex gap-1.5 items-center relative mt-1">
                    <pre className="max-h-20 overflow-auto flex-1 rounded border border-emerald-500/20 bg-black/10 p-2 font-mono text-[9px] leading-relaxed text-foreground break-all whitespace-pre-wrap">
                      {resolveCommandTemplate(cmd.command, doc, toNode || fromNode || { id: 'dummy', kind: 'target', label: '' }, { targetPort: cmd.targetPort })}
                    </pre>
                    <button
                      type="button"
                      onClick={() => {
                        const targetNode = toNode || fromNode;
                        if (targetNode) {
                          const resolved = resolveCommandTemplate(cmd.command, doc, targetNode, { targetPort: cmd.targetPort });
                          handleCopy(resolved, cmd.id);
                        }
                      }}
                      className="phantom-btn px-2 py-2 text-[10px] hover:bg-emerald-500/10 border-emerald-500/20 flex items-center justify-center shrink-0"
                      title={uiLanguage === 'es' ? 'Copiar comando' : 'Copy command'}
                    >
                      {copiedNodeId === cmd.id ? (
                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">✓</span>
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
            
            <button
              type="button"
              onClick={() => {
                if (!onPatchEdge) return;
                const newCmd = { id: crypto.randomUUID(), command: '' };
                onPatchEdge({ commands: [...(edge.commands || []), newCmd] });
              }}
              className="phantom-btn border-dashed border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/50 flex w-full items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors"
            >
              + {uiLanguage === 'es' ? 'Añadir Comando' : 'Add Command'}
            </button>
          </div>
        </div>

        {/* Preset Relationship options */}
        <div className="space-y-1.5">
          <span className="phantom-map-field-label">
            {uiLanguage === 'es' ? 'Tipo de Relación' : 'Relationship Type'}
          </span>
          <div className="grid grid-cols-2 gap-1.5 max-h-[240px] overflow-y-auto pr-1 p-0.5 rounded-lg border border-border/30 bg-muted/5">
            {MAP_EDGE_RELATIONS.map((rel) => {
              const isActive = edge.label === rel || (!edge.label && rel === 'leads_to');
              return (
                <button
                  key={rel}
                  type="button"
                  onClick={() => {
                    onChangeLabel(rel);
                    setCustomLabel(rel);
                  }}
                  className={cn(
                    'flex items-center justify-center rounded-lg border px-2 py-2 text-left font-mono text-[10px] font-bold tracking-wide transition-all select-none',
                    isActive
                      ? 'border-primary/40 bg-primary/10 text-primary shadow-sm'
                      : 'border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                  )}
                  style={{ minHeight: isTouchDevice ? '44px' : '36px' }}
                >
                  {rel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom text label input */}
        <label className="block space-y-1">
          <span className="phantom-map-field-label">
            {uiLanguage === 'es' ? 'Etiqueta Personalizada' : 'Custom Label'}
          </span>
          <input
            value={customLabel}
            onChange={(e) => handleCustomLabelChange(e.target.value)}
            className="phantom-field font-mono text-xs"
            placeholder="custom_relation_name"
            style={{ minHeight: isTouchDevice ? '44px' : 'auto' }}
          />
        </label>

        {/* Danger zone delete button */}
        <button
          type="button"
          onClick={onDelete}
          className="phantom-btn border-rose-500/25 bg-rose-500/10 text-rose-500 hover:bg-rose-500/15 flex w-full items-center justify-center gap-1.5 py-2.5 font-bold uppercase tracking-wider shadow-sm mt-3"
          style={{ minHeight: isTouchDevice ? '44px' : 'auto' }}
        >
          <Trash2 className="size-4" />
          {uiLanguage === 'es' ? 'Eliminar Conexión' : 'Delete Connection'}
        </button>
      </div>
    </>
  );

  if (isTouchDevice) {
    return (
      <>
        <div className="phantom-map-inspector-backdrop" onClick={onClose} />
        <aside className="phantom-map-inspector phantom-map-inspector--touch">
          <div className="phantom-map-inspector-drag-handle" />
          {edgeInspectorContent}
        </aside>
      </>
    );
  }

  return <aside className="phantom-map-inspector">{edgeInspectorContent}</aside>;
}
