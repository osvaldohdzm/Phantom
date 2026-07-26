/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  X,
  Send,
  Copy,
  Check,
  Zap,
  Shield,
  Terminal,
  FileText,
  ChevronDown,
  Minimize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PhantomAiContext, POLNode } from './types';

interface PhantomAiBubbleProps {
  context: PhantomAiContext;
  onApplyCommandToActiveNode?: (command: string) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  commandSnippet?: string;
}

export function PhantomAiBubble({
  context,
  onApplyCommandToActiveNode,
}: PhantomAiBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: '¡Hola! Soy **Phantom AI Assistant**. Tengo el contexto de tu metodología activa y nodos seleccionados. ¿Qué deseas consultar o generar?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Context summary token footprint calculator
  const contextSummaryText = React.useMemo(() => {
    const parts = [];
    if (context.activeMethodologyTitle) {
      parts.push(`Metodología: ${context.activeMethodologyTitle}`);
    }
    if (context.activeNode) {
      parts.push(`Nodo: [${context.activeNode.kind.toUpperCase()}] ${context.activeNode.title}`);
    }
    parts.push(`Vista: ${context.activeViewMode}`);
    return parts.join(' | ');
  }, [context]);

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || inputQuery;
    if (!query.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputQuery('');
    setIsLoading(true);

    // Build efficient system context prompt (< 200 tokens)
    const contextPrompt = `
[CONTEXTO PHANTOM SECOPS]
- Metodología: ${context.activeMethodologyTitle || 'General'}
- Nodos Totales: ${context.totalNodesCount}
- Vista Activa: ${context.activeViewMode}
- Nodo Seleccionado: ${context.activeNode ? `${context.activeNode.title} (${context.activeNode.kind}, Estado: ${context.activeNode.status})` : 'Ninguno'}
${context.activeNode?.command ? `- Comando Actual: ${context.activeNode.command}` : ''}
${context.activeNode?.inheritedVars ? `- Variables Heredadas: ${JSON.stringify(context.activeNode.inheritedVars)}` : ''}
`;

    // Simulated / API stream generation
    setTimeout(() => {
      let replyText = '';
      let snippet: string | undefined = undefined;

      const lower = query.toLowerCase();
      if (lower.includes('nmap') || lower.includes('comando') || lower.includes('sugerir')) {
        replyText = `Basado en la fase **${context.activeNode?.title || 'Reconocimiento'}**, te sugiero ejecutar un escaneo agresivo de servicios y vulnerabilidades Nmap con salida estructurada:`;
        snippet = `nmap -sV -sC -A -T4 -p- {RHOST} -oA nmap_${context.activeMethodologyTitle?.toLowerCase().replace(/\s+/g, '_') || 'scan'}`;
      } else if (lower.includes('payload') || lower.includes('exploit') || lower.includes('check')) {
        replyText = `Para verificar la vulnerabilidad en el check **${context.activeNode?.title || 'Check Activo'}**, puedes utilizar el siguiente vector de prueba:`;
        snippet = `impacket-GetNPUsers {DOMAIN}/ -no-pass -usersfile users.txt -dc-ip {RHOST}`;
      } else if (lower.includes('markmap') || lower.includes('markdown')) {
        replyText = `La estructura actual de la metodología se encuentra optimizada para Markmap. Puedes copiar el código Markdown generado desde la vista **Vista Markdown Markmap** y abrirlo directamente en [markmap.js.org/repl](https://markmap.js.org/repl).`;
      } else {
        replyText = `Analizando contexto de **${context.activeMethodologyTitle || 'Phantom'}** (${context.totalNodesCount} nodos):\n\nRecomiendo proceder validando los vectores de autenticación y registrando las evidencias en las notas del nodo.`;
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        commandSnippet: snippet,
      };

      setMessages((prev) => [...prev, botMsg]);
      setIsLoading(false);
    }, 800);
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <>
      {/* Floating Trigger Bubble Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'group relative size-14 rounded-full bg-gradient-to-tr from-violet-600 via-purple-600 to-indigo-500 text-white shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 border border-white/20',
            isOpen && 'scale-90 rotate-90 opacity-90'
          )}
          title="Phantom AI Assistant"
        >
          {/* Animated Glow Halo */}
          <span className="absolute -inset-1 rounded-full bg-violet-500/40 blur-md group-hover:bg-violet-500/70 transition-all pointer-events-none animate-pulse" />

          {isOpen ? (
            <X className="size-6 text-white relative z-10" />
          ) : (
            <div className="relative z-10 flex items-center justify-center">
              <Sparkles className="size-6 text-white" />
              {/* Online Dot */}
              <span className="absolute -top-1 -right-1 size-3 rounded-full bg-emerald-400 border-2 border-background" />
            </div>
          )}
        </button>
      </div>

      {/* Expandable Assistant Drawer Modal */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[92vw] sm:w-[420px] h-[580px] bg-card/95 border border-border/80 rounded-3xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Drawer Header */}
          <div className="px-5 py-4 border-b border-border/50 bg-gradient-to-r from-violet-950/40 via-purple-950/20 to-transparent flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 shadow-inner">
                <Bot className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  Phantom AI Assistant
                  <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                    Live Context
                  </span>
                </h3>
                <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[240px]">
                  {contextSummaryText}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors"
            >
              <Minimize2 className="size-4" />
            </button>
          </div>

          {/* Efficient Context Pill Header */}
          <div className="px-4 py-2 bg-violet-500/10 border-b border-violet-500/20 flex items-center justify-between text-[11px] text-violet-300 font-mono">
            <span className="flex items-center gap-1.5 truncate">
              <Zap className="size-3.5 text-amber-400 shrink-0" />
              Contexto inyectado (~180 tokens)
            </span>
            <span className="text-[10px] opacity-80 shrink-0">Gemini 3.6 Flash</span>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar text-xs">
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={cn('flex flex-col', isUser ? 'items-end' : 'items-start')}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-4 py-2.5 space-y-2 leading-relaxed shadow-sm',
                      isUser
                        ? 'bg-violet-600 text-white rounded-br-none'
                        : 'bg-muted/60 border border-border/50 text-foreground rounded-bl-none'
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>

                    {/* Command Snippet Card */}
                    {msg.commandSnippet && (
                      <div className="mt-2 p-2.5 rounded-xl bg-black/60 border border-amber-500/30 font-mono text-[11px] text-amber-300 space-y-2">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Terminal className="size-3 text-amber-400" />
                            Comando Sugerido
                          </span>
                          <button
                            onClick={() => handleCopyText(msg.id, msg.commandSnippet!)}
                            className="text-amber-400 hover:underline flex items-center gap-1"
                          >
                            {copiedId === msg.id ? <Check className="size-3" /> : <Copy className="size-3" />}
                            <span>{copiedId === msg.id ? 'Copiado' : 'Copiar'}</span>
                          </button>
                        </div>
                        <code className="block break-all">{msg.commandSnippet}</code>

                        {context.activeNode && onApplyCommandToActiveNode && (
                          <button
                            onClick={() => onApplyCommandToActiveNode(msg.commandSnippet!)}
                            className="w-full mt-1 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
                          >
                            <span>Aplicar al nodo actual</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-muted-foreground mt-1 px-1">{msg.timestamp}</span>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                <Sparkles className="size-3.5 text-violet-400 animate-spin" />
                <span>Phantom AI procesando contextualmente...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Chips */}
          <div className="px-4 py-2 border-t border-border/40 bg-muted/20 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => handleSend('Sugerir comandos para esta fase')}
              className="px-2.5 py-1 rounded-xl bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 text-violet-300 text-[10px] whitespace-nowrap font-medium transition-colors"
            >
              ⚡ Sugerir comandos
            </button>
            <button
              onClick={() => handleSend('Recomendar payloads para este check')}
              className="px-2.5 py-1 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 text-purple-300 text-[10px] whitespace-nowrap font-medium transition-colors"
            >
              🛡️ Payloads check
            </button>
            <button
              onClick={() => handleSend('Optimizar estructura para Markmap')}
              className="px-2.5 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 text-cyan-300 text-[10px] whitespace-nowrap font-medium transition-colors"
            >
              🗺️ Formato Markmap
            </button>
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 border-t border-border/50 bg-background/80 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Pregunta a Phantom AI..."
              className="flex-1 bg-muted/40 border border-border/60 rounded-xl px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500"
            />
            <button
              type="submit"
              disabled={!inputQuery.trim() || isLoading}
              className="p-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-all"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
