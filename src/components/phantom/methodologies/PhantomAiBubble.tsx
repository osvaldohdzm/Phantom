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
  CheckCircle2,
  XCircle,
  ArrowRight,
  GitBranch,
  Layers,
  Trash2,
  Square,
  Pencil,
  RotateCcw,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PhantomAiContext, POLNode } from './types';

export interface ProposedChange {
  id: string;
  summary: string;
  nodes: POLNode[];
  status: 'pending' | 'approved' | 'rejected';
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  commandSnippet?: string;
  proposal?: ProposedChange;
}

interface PhantomAiBubbleProps {
  context: PhantomAiContext;
  onApplyCommandToActiveNode?: (command: string) => void;
  onMergeProposedNodes?: (nodes: POLNode[]) => void;
}

// Writeup / CTF Notes Intelligence Extractor Engine (Supports Scripts & Multiline Snippets)
export function extractMethodologyFromWriteup(rawText: string): ProposedChange | null {
  const timestamp = Date.now();
  const nodes: POLNode[] = [];

  let currentPhaseId: string | null = null;
  let currentTacticId: string | null = null;

  let phaseCount = 0;
  let tacticCount = 0;
  let commandCount = 0;
  let scriptCount = 0;

  const lines = rawText.split('\n');
  let inCodeBlock = false;
  let codeBlockBuffer: string[] = [];
  let codeBlockLang = '';

  const ensureHierarchy = () => {
    if (!currentTacticId) {
      phaseCount++;
      const phaseId = `prop-w-ph-${timestamp}-${nodes.length}`;
      nodes.push({
        id: phaseId,
        parentId: null,
        title: `Fase ${phaseCount}: Procedimientos Extraídos de CTF / Writeup`,
        kind: 'phase',
        status: 'todo',
        expanded: true,
        depth: 1,
      });
      currentPhaseId = phaseId;

      tacticCount++;
      const tacticId = `prop-w-tac-${timestamp}-${nodes.length}`;
      nodes.push({
        id: tacticId,
        parentId: phaseId,
        title: `Táctica: Scripts, Snippets & Comandos Directos`,
        kind: 'tactic',
        status: 'todo',
        expanded: true,
        depth: 2,
      });
      currentTacticId = tacticId;
    }
  };

  const commandPatterns = [
    /^(nmap|ffuf|gobuster|dirb|nikto|sqlmap|wpscan|hydra|hashcat|john|ssh2john|ssh|curl|wget|nc|netcat|socat|msfconsole|metasploit|searchsploit|impacket-\w+|smbclient|crackmapexec|enum4linux|bloodhound|chisel|certutil|powershell|bash|python|python3|perl|ruby|gcc|g\+\+|make|chmod|chown|openssl|find|grep|cat|echo|nano|vi|vim|su|sudo|id|whoami|uname)\b/i,
    /^http:\/\/[^\s]+/i,
    /^https:\/\/[^\s]+/i,
  ];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Check for fenced code block toggle ``` or ```bash
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // Closing code block
        inCodeBlock = false;
        const codeContent = codeBlockBuffer.join('\n').trim();
        codeBlockBuffer = [];

        if (codeContent) {
          ensureHierarchy();
          const isMultiLine = codeContent.includes('\n');
          const isScript =
            isMultiLine ||
            codeContent.includes('#!/bin') ||
            codeContent.includes('cat >') ||
            codeContent.includes('import ') ||
            codeContent.includes('function');

          if (isScript) {
            scriptCount++;
            nodes.push({
              id: `prop-w-scr-${timestamp}-${nodes.length}`,
              parentId: currentTacticId,
              title: codeContent,
              kind: isMultiLine ? 'script' : 'snippet',
              status: 'todo',
              expanded: true,
              depth: 3,
              description: codeBlockLang ? `Lenguaje: ${codeBlockLang}` : 'Script Multilínea CTF',
            });
          } else {
            commandCount++;
            nodes.push({
              id: `prop-w-co-${timestamp}-${nodes.length}`,
              parentId: currentTacticId,
              title: codeContent,
              kind: 'command',
              status: 'todo',
              expanded: true,
              depth: 3,
            });
          }
        }
        continue;
      } else {
        // Opening code block
        inCodeBlock = true;
        codeBlockLang = trimmed.replace(/^```/, '').trim();
        codeBlockBuffer = [];
        continue;
      }
    }

    if (inCodeBlock) {
      codeBlockBuffer.push(rawLine);
      continue;
    }

    if (!trimmed) continue;

    // Detect Step / Phase Headers
    const isStepHeader =
      /^(?:step|paso|phase|fase)\s*\d+/i.test(trimmed) ||
      /^#{1,3}\s+/i.test(trimmed) ||
      /^(reconocimiento|reconnaissance|enumeración|enumeration|explotación|exploitation|escalada|privilege escalation|post explotación|post exploitation)\b/i.test(trimmed);

    if (isStepHeader) {
      phaseCount++;
      const phaseId = `prop-w-ph-${timestamp}-${nodes.length}`;
      const title = trimmed.replace(/^(#{1,6}|\*+|🎯|\📌|\🚀|\✅)\s*/, '').trim();

      const phaseNode: POLNode = {
        id: phaseId,
        parentId: null,
        title: title,
        kind: 'phase',
        status: 'todo',
        expanded: true,
        depth: 1,
      };

      nodes.push(phaseNode);
      currentPhaseId = phaseId;

      tacticCount++;
      const tacticId = `prop-w-tac-${timestamp}-${nodes.length}`;
      const tacticNode: POLNode = {
        id: tacticId,
        parentId: phaseId,
        title: `Táctica: Procedimientos & Scripts de ${title}`,
        kind: 'tactic',
        status: 'todo',
        expanded: true,
        depth: 2,
      };

      nodes.push(tacticNode);
      currentTacticId = tacticId;
      continue;
    }

    // Detect standalone command lines outside code blocks
    const isCommand = commandPatterns.some((rgx) => rgx.test(trimmed));
    if (isCommand) {
      commandCount++;
      ensureHierarchy();

      const cmdId = `prop-w-co-${timestamp}-${nodes.length}`;
      nodes.push({
        id: cmdId,
        parentId: currentTacticId,
        title: trimmed,
        kind: 'command',
        status: 'todo',
        expanded: true,
        depth: 3,
      });
      continue;
    }

    // Detect Findings / Notes
    if (
      trimmed.toLowerCase().startsWith('findings:') ||
      trimmed.toLowerCase().startsWith('notes:') ||
      trimmed.toLowerCase().startsWith('hallazgos:')
    ) {
      ensureHierarchy();
      const checkId = `prop-w-chk-${timestamp}-${nodes.length}`;
      nodes.push({
        id: checkId,
        parentId: currentTacticId,
        title: trimmed,
        kind: 'check',
        status: 'done',
        expanded: true,
        depth: 3,
      });
    }
  }

  if (nodes.length === 0) return null;

  return {
    id: `prop-writeup-${timestamp}`,
    summary: `Propuesta CTF Writeup: +${phaseCount} Fases, +${tacticCount} Tácticas, +${commandCount} Comandos, +${scriptCount} Scripts/Snippets Multi-Línea`,
    status: 'pending',
    nodes,
  };
}

function FormattedMarkdownText({ text }: { text: string }) {
  const renderFormatted = (str: string) => {
    const lines = str.split('\n');
    return lines.map((line, lineIdx) => {
      const parts = [];
      let lastIndex = 0;
      const inlineRegex = /(\*\*(.*?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
      let match;

      while ((match = inlineRegex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          parts.push(line.substring(lastIndex, match.index));
        }

        if (match[2]) {
          parts.push(
            <strong key={`bold-${lineIdx}-${match.index}`} className="font-bold text-foreground">
              {match[2]}
            </strong>
          );
        } else if (match[3]) {
          parts.push(
            <code
              key={`code-${lineIdx}-${match.index}`}
              className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-muted border border-border/40 font-semibold text-violet-400"
            >
              {match[3]}
            </code>
          );
        } else if (match[4] && match[5]) {
          parts.push(
            <a
              key={`link-${lineIdx}-${match.index}`}
              href={match[5]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 underline font-medium hover:text-violet-300"
            >
              {match[4]}
            </a>
          );
        }

        lastIndex = inlineRegex.lastIndex;
      }

      if (lastIndex < line.length) {
        parts.push(line.substring(lastIndex));
      }

      return (
        <React.Fragment key={lineIdx}>
          {parts}
          {lineIdx < lines.length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  return <span>{renderFormatted(text)}</span>;
}

export function PhantomAiBubble({
  context,
  onApplyCommandToActiveNode,
  onMergeProposedNodes,
}: PhantomAiBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: '¡Hola! Soy **Phantom AI Assistant**. Puedo extraer metodologías completas desde notas o writeups de CTF. Pega tu texto y te propondré las fases y comandos listos para aprobar.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

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

  const handleClearHistory = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsLoading(false);
    setMessages([
      {
        id: 'welcome',
        sender: 'assistant',
        text: '¡Hola! Soy **Phantom AI Assistant**. Historial limpiado. ¿En qué puedo ayudarte con tu metodología?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleStopGeneration = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsLoading(false);
    setMessages((prev) => [
      ...prev,
      {
        id: `stop-${Date.now()}`,
        sender: 'assistant',
        text: '⚠️ Generación de respuesta cancelada a petición del usuario.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleApproveProposal = (msgId: string, proposal: ProposedChange) => {
    if (!onMergeProposedNodes || proposal.status !== 'pending') return;

    onMergeProposedNodes(proposal.nodes);

    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === msgId && msg.proposal) {
          return {
            ...msg,
            proposal: { ...msg.proposal, status: 'approved' },
          };
        }
        return msg;
      })
    );
  };

  const handleRejectProposal = (msgId: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === msgId && msg.proposal) {
          return {
            ...msg,
            proposal: { ...msg.proposal, status: 'rejected' },
          };
        }
        return msg;
      })
    );
  };

  const handleEditAndResend = (msgId: string, newQuery: string) => {
    if (!newQuery.trim()) return;
    const msgIndex = messages.findIndex((m) => m.id === msgId);
    if (msgIndex === -1) return;

    const truncated = messages.slice(0, msgIndex);
    setMessages(truncated);
    setEditingMessageId(null);
    setEditingText('');

    handleSend(newQuery, truncated);
  };

  const handleSend = async (textToSend?: string, baseMessages?: ChatMessage[]) => {
    const query = textToSend || inputQuery;
    if (!query.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const currentHistory = baseMessages || messages;
    setMessages([...currentHistory, userMsg]);
    if (!textToSend) setInputQuery('');
    setIsLoading(true);

    timeoutRef.current = setTimeout(() => {
      let replyText = '';
      let snippet: string | undefined = undefined;
      let proposal: ProposedChange | undefined = undefined;

      // Check if text is a Writeup / CTF Notes payload
      const extractedWriteupProposal = extractMethodologyFromWriteup(query);

      if (extractedWriteupProposal && extractedWriteupProposal.nodes.length >= 2) {
        replyText = `He analizado las notas / Writeup CTF ingresado. Extraje **${extractedWriteupProposal.summary}** organizados por fases, tácticas y comandos de auditoría. Puedes revisar la propuesta y presionar **Aprobar e Integrar** para añadirlos a tu metodología:`;
        proposal = extractedWriteupProposal;
      } else {
        const lower = query.toLowerCase();

        if (
          lower.includes('mejora') ||
          lower.includes('proponer') ||
          lower.includes('agregar fase') ||
          lower.includes('owasp') ||
          lower.includes('jwt') ||
          lower.includes('api')
        ) {
          replyText = `He analizado la metodología activa **"${context.activeMethodologyTitle || 'Security Assessment'}"**. Te propongo añadir una fase especializada de **Auditoría OWASP API & JWT Tokens** con tácticas y comandos optimizados:`;

          const timestamp = Date.now();
          proposal = {
            id: `prop-${timestamp}`,
            summary: 'Propuesta: +1 Fase OWASP API, +1 Táctica, +3 Comandos',
            status: 'pending',
            nodes: [
              {
                id: `prop-ph-${timestamp}`,
                parentId: null,
                title: 'Fase: Auditoría de Tokens JWT y Seguridad en APIs REST',
                kind: 'phase',
                status: 'todo',
                expanded: true,
                depth: 1,
                description: 'Evaluación de firmas, manipulación de algoritmos y ataques BOLA/IDOR.',
              },
              {
                id: `prop-tac-${timestamp}`,
                parentId: `prop-ph-${timestamp}`,
                title: 'Ataque de Algoritmo None y Forzado de Clave JWT',
                kind: 'tactic',
                status: 'todo',
                expanded: true,
                depth: 2,
              },
              {
                id: `prop-co-1-${timestamp}`,
                parentId: `prop-tac-${timestamp}`,
                title: 'jwt_tool -M at -t https://{TARGET_URL}/api/v1/user -rc "bearer {JWT_TOKEN}"',
                kind: 'command',
                status: 'todo',
                expanded: true,
                depth: 3,
              },
              {
                id: `prop-co-2-${timestamp}`,
                parentId: `prop-tac-${timestamp}`,
                title: 'jwt_tool -X a -t https://{TARGET_URL}/api/v1/user',
                kind: 'command',
                status: 'todo',
                expanded: true,
                depth: 3,
              },
              {
                id: `prop-co-3-${timestamp}`,
                parentId: `prop-tac-${timestamp}`,
                title: 'ffuf -u https://{TARGET_URL}/api/v1/FUZZ -w /usr/share/wordlists/dirb/common.txt -H "Authorization: Bearer {JWT_TOKEN}"',
                kind: 'command',
                status: 'todo',
                expanded: true,
                depth: 3,
              },
            ],
          };
        } else if (lower.includes('nmap') || lower.includes('escaneo') || lower.includes('fuzzing')) {
          replyText = `Para la fase de **${context.activeNode?.title || 'Reconocimiento'}**, te propongo este comando Nmap optimizado para descubrimiento rápido de puertos y versión de servicios:`;
          snippet = `nmap -sV -sC -A -T4 -p- {RHOST} -oA nmap_${context.activeMethodologyTitle?.toLowerCase().replace(/\s+/g, '_') || 'scan'}`;
        } else {
          replyText = `Entendido. He procesado tu solicitud sobre **${context.activeMethodologyTitle || 'Phantom'}** (${context.totalNodesCount} nodos). Puedes pedirme que proponga nuevas fases, tácticas o pegar las notas de un Writeup de CTF.`;
        }
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        commandSnippet: snippet,
        proposal,
      };

      setMessages((prev) => [...prev, botMsg]);
      setIsLoading(false);
      timeoutRef.current = null;
    }, 700);
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
        >
          <Sparkles className="size-6 animate-pulse text-amber-300" />
          <span className="absolute -top-1 -right-1 size-3.5 rounded-full bg-emerald-400 border-2 border-background animate-ping" />
          <span className="absolute -top-1 -right-1 size-3.5 rounded-full bg-emerald-500 border-2 border-background" />
        </button>
      </div>

      {/* Floating Chat Modal Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] h-[34rem] flex flex-col bg-card border border-border/70 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header Bar */}
          <div className="p-3.5 bg-gradient-to-r from-violet-600/90 via-purple-600/90 to-indigo-600/90 text-white flex items-center justify-between shadow-md shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20">
                <Bot className="size-4 text-amber-300" />
              </div>
              <div>
                <h3 className="text-xs font-bold leading-none flex items-center gap-1.5">
                  Phantom AI Assistant
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[9px] font-mono font-normal">
                    Contexto Vivo
                  </span>
                </h3>
                <p className="text-[10px] text-white/80 font-mono mt-0.5 truncate max-w-[170px]">
                  {context.activeMethodologyTitle || 'Phantom SecOps'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleClearHistory}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                title="Limpiar Historial de Chat"
              >
                <Trash2 className="size-3.5" />
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                title="Cerrar Asistente"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Context Token Footprint Bar (< 180 tokens) */}
          <div className="px-3 py-1 bg-muted/40 border-b border-border/40 text-[10px] font-mono text-muted-foreground flex items-center justify-between shrink-0">
            <span className="flex items-center gap-1 truncate">
              <Zap className="size-3 text-amber-400 shrink-0" />
              <span className="truncate">{contextSummaryText}</span>
            </span>
            <span className="text-[9px] text-violet-400 font-bold shrink-0">~180 tokens</span>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 custom-scrollbar bg-card">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'group flex flex-col space-y-1 max-w-[88%]',
                  msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                )}
              >
                {/* Inline Editing Mode for User Message */}
                {editingMessageId === msg.id ? (
                  <div className="w-full bg-violet-600/10 border border-violet-500/40 rounded-xl p-2 space-y-2">
                    <input
                      type="text"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleEditAndResend(msg.id, editingText);
                        } else if (e.key === 'Escape') {
                          setEditingMessageId(null);
                        }
                      }}
                      className="w-full bg-background border border-violet-500 rounded px-2.5 py-1 text-xs text-foreground focus:outline-none"
                      autoFocus
                    />
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setEditingMessageId(null)}
                        className="px-2 py-0.5 rounded text-[10px] text-muted-foreground hover:bg-muted font-medium"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleEditAndResend(msg.id, editingText)}
                        className="px-2.5 py-0.5 rounded bg-violet-600 text-white text-[10px] font-bold flex items-center gap-1"
                      >
                        <RotateCcw className="size-2.5" />
                        Guardar y Reenviar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative group/msg flex items-center gap-1">
                    {/* User Edit Pencil Icon (Visible on hover) */}
                    {msg.sender === 'user' && (
                      <button
                        onClick={() => {
                          setEditingMessageId(msg.id);
                          setEditingText(msg.text);
                        }}
                        className="opacity-0 group-hover/msg:opacity-100 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-all shrink-0"
                        title="Editar pregunta y reenviar (estilo Gemini)"
                      >
                        <Pencil className="size-3" />
                      </button>
                    )}

                    <div
                      className={cn(
                        'p-3 rounded-2xl text-xs leading-relaxed shadow-sm max-h-48 overflow-y-auto custom-scrollbar',
                        msg.sender === 'user'
                          ? 'bg-violet-600 text-white rounded-br-none font-medium'
                          : 'bg-muted/60 border border-border/60 text-foreground rounded-bl-none'
                      )}
                    >
                      <FormattedMarkdownText text={msg.text} />
                    </div>
                  </div>
                )}

                {/* Command Snippet */}
                {msg.commandSnippet && (
                  <div className="w-full mt-1.5 bg-black/80 border border-violet-500/30 rounded-xl p-2.5 space-y-2 text-xs font-mono shadow-inner">
                    <div className="flex items-center justify-between text-[10px] text-violet-300 font-semibold border-b border-violet-500/20 pb-1">
                      <span className="flex items-center gap-1">
                        <Terminal className="size-3 text-amber-400" />
                        Comando Sugerido
                      </span>
                      <button
                        onClick={() => handleCopyText(msg.id, msg.commandSnippet!)}
                        className="flex items-center gap-1 hover:text-white transition-colors"
                      >
                        {copiedId === msg.id ? (
                          <Check className="size-3 text-emerald-400" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        <span>{copiedId === msg.id ? 'Copiado' : 'Copiar'}</span>
                      </button>
                    </div>
                    <code className="block text-emerald-400 break-all leading-tight">
                      {msg.commandSnippet}
                    </code>

                    {onApplyCommandToActiveNode && (
                      <button
                        onClick={() => onApplyCommandToActiveNode(msg.commandSnippet!)}
                        className="w-full mt-1 px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-semibold flex items-center justify-center gap-1 transition-all shadow"
                      >
                        <Zap className="size-3" />
                        <span>Aplicar a Nodo Activo</span>
                      </button>
                    )}
                  </div>
                )}

                {/* AI Proposed Changes Card (Aprobar / Cancelar Workflow) */}
                {msg.proposal && (
                  <div className="w-full mt-2 border border-violet-500/40 rounded-xl p-3 bg-violet-500/5 space-y-2.5 shadow-md">
                    <div className="flex items-center justify-between border-b border-violet-500/20 pb-1.5">
                      <span className="text-[11px] font-bold text-violet-400 flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-amber-400" />
                        Propuesta de Mejora AI
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-bold">
                        {msg.proposal.status === 'pending'
                          ? 'Pendiente'
                          : msg.proposal.status === 'approved'
                          ? 'Aprobado'
                          : 'Rechazado'}
                      </span>
                    </div>

                    <p className="text-[11px] font-semibold text-foreground leading-tight">
                      {msg.proposal.summary}
                    </p>

                    {/* Nodes Preview List */}
                    <div className="space-y-1 max-h-44 overflow-y-auto custom-scrollbar p-1.5 bg-background/50 rounded-lg border border-border/40 text-[10px] font-mono">
                      {msg.proposal.nodes.map((n) => (
                        <div key={n.id} className="flex items-center justify-between gap-1 py-0.5 border-b border-border/20 last:border-0">
                          <span className="truncate text-foreground font-medium">• {n.title}</span>
                          <span className="text-[8px] uppercase px-1 rounded border bg-muted text-muted-foreground shrink-0 font-bold">
                            {n.kind}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Approval Action Buttons */}
                    {msg.proposal.status === 'pending' ? (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleApproveProposal(msg.id, msg.proposal!)}
                          className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-md"
                        >
                          <CheckCircle2 className="size-3.5" />
                          <span>Aprobar e Integrar</span>
                        </button>

                        <button
                          onClick={() => handleRejectProposal(msg.id)}
                          className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground text-[11px] font-semibold flex items-center justify-center gap-1 transition-all"
                        >
                          <XCircle className="size-3.5 text-rose-400" />
                          <span>Descartar</span>
                        </button>
                      </div>
                    ) : (
                      <div className="text-[10px] font-mono text-center py-1 font-bold">
                        {msg.proposal.status === 'approved' ? (
                          <span className="text-emerald-400 flex items-center justify-center gap-1">
                            <CheckCircle2 className="size-3" />
                            ¡Integrado a la Metodología!
                          </span>
                        ) : (
                          <span className="text-muted-foreground flex items-center justify-center gap-1">
                            <XCircle className="size-3 text-rose-400" />
                            Propuesta Descartada
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <span className="text-[9px] text-muted-foreground font-mono px-1">
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center justify-between text-xs text-muted-foreground p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
                <div className="flex items-center gap-2">
                  <Bot className="size-3.5 text-violet-400 animate-spin" />
                  <span className="font-mono text-[11px]">Phantom AI procesando Writeup/Notas...</span>
                </div>
                <button
                  onClick={handleStopGeneration}
                  className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30 text-[10px] font-bold flex items-center gap-1 transition-all"
                >
                  <Square className="size-2.5 fill-current" />
                  <span>Detener</span>
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Action Chips */}
          <div className="px-3 py-1.5 bg-muted/20 border-t border-border/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            <button
              onClick={() => handleSend('Sugerir mejoras a la metodología activa')}
              className="px-2 py-0.5 rounded-full bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/30 text-[10px] font-medium whitespace-nowrap transition-colors flex items-center gap-1"
            >
              <Sparkles className="size-2.5 text-amber-400" />
              Sugerir Mejoras
            </button>
            <button
              onClick={() => handleSend('Agregar fase OWASP API y JWT')}
              className="px-2 py-0.5 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[10px] font-medium whitespace-nowrap transition-colors flex items-center gap-1"
            >
              <Shield className="size-2.5 text-indigo-400" />
              OWASP API & JWT
            </button>
            <button
              onClick={() => handleSend('Optimizar comando nmap')}
              className="px-2 py-0.5 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-medium whitespace-nowrap transition-colors flex items-center gap-1"
            >
              <Terminal className="size-2.5 text-cyan-400" />
              Nmap Optimizado
            </button>
          </div>

          {/* Input Footer Area */}
          <div className="p-3 bg-muted/40 border-t border-border/50 flex items-end gap-2 shrink-0 relative z-10">
            <textarea
              rows={1}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (e.shiftKey) {
                    return;
                  }
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Pega notas de CTF, Writeups o pide mejoras a Phantom AI..."
              className="flex-1 bg-background border border-border/60 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-violet-500 shadow-sm resize-none custom-scrollbar min-h-[38px] max-h-24 leading-relaxed"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />

            {isLoading ? (
              <button
                onClick={handleStopGeneration}
                className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shrink-0 mb-0.5"
                title="Detener solicitud"
              >
                <Square className="size-3.5 fill-current" />
              </button>
            ) : (
              <button
                onClick={() => handleSend()}
                disabled={!inputQuery.trim()}
                className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white transition-all shadow-md shrink-0 mb-0.5"
              >
                <Send className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
