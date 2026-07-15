/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { PentestNode, NodeState, NodeClass } from '@/components/phantom/types';
import { X, Copy, Check, Terminal, Cpu, Info, ShieldAlert, Trash2, ListFilter } from 'lucide-react';

interface NodeDetailDrawerProps {
  node: PentestNode;
  target: string;
  attackerIp: string;
  globalVars: Record<string, string>;
  setGlobalVars: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onClose: () => void;
  onUpdateNode: (updatedNode: PentestNode) => void;
  onDeleteNode: (id: string) => void;
  onLogMessage: (type: 'info' | 'success' | 'error' | 'command_copied' | 'state_change' | 'ai', msg: string) => void;
}

export default function NodeDetailDrawer({
  node,
  target,
  attackerIp,
  globalVars,
  setGlobalVars,
  onClose,
  onUpdateNode,
  onDeleteNode,
  onLogMessage
}: NodeDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<'command' | 'evidence' | 'ai'>('command');
  const [copied, setCopied] = useState(false);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [rawText, setRawText] = useState('');
  const [parseLoading, setParseLoading] = useState(false);

  // Reset tab and AI results on node swap
  useEffect(() => {
    setActiveTab('command');
    setExplanation(null);
    setRawText(node.evidenceProduced.raw_output || '');
  }, [node.id]);

  // Substitute variables reactively
  const getRenderedCommand = (): string => {
    let cmd = node.commandTemplate;

    const defaults: Record<string, string> = {
      '$PORT': '80',
      '$DOMAIN': 'corp.local',
      '$USER': 'admin',
      '$PASSWORD': 'admin',
      '$PROTO': 'http',
      '$EXT': '.php,.html',
      '$WORDLIST': '/usr/share/seclists/Discovery/Web-Content/common.txt'
    };

    // Combine defaults, globals, and node local overrides
    const combined = { ...defaults, ...globalVars, ...node.customParams };

    // Sort to prevent partial replacements
    const keys = Object.keys(combined).sort((a, b) => b.length - a.length);
    keys.forEach(key => {
      cmd = cmd.replaceAll(key, combined[key]);
    });

    return cmd;
  };

  const renderedCommand = getRenderedCommand();

  const handleCopy = () => {
    navigator.clipboard.writeText(renderedCommand);
    setCopied(true);
    onLogMessage('command_copied', `${node.tool} command copied: ${renderedCommand}`);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateState = (newState: NodeState) => {
    onUpdateNode({ ...node, state: newState, updatedAt: new Date().toISOString() });
    onLogMessage('state_change', `Node "${node.title}" changed status to "${newState.toUpperCase()}"`);
  };

  const updateField = (field: keyof PentestNode, value: any) => {
    onUpdateNode({ ...node, [field]: value, updatedAt: new Date().toISOString() });
  };

  const updateEvidenceField = (field: string, value: any) => {
    onUpdateNode({
      ...node,
      evidenceProduced: {
        ...node.evidenceProduced,
        [field]: value
      },
      updatedAt: new Date().toISOString()
    });
  };

  // Call server-side API to explain the command
  const explainCommand = async () => {
    setExplainLoading(true);
    setExplanation(null);
    try {
      const response = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: renderedCommand,
          tool: node.tool,
          description: node.description,
          target: target,
          attackerIp: attackerIp
        })
      });
      const data = await response.json();
      if (data.explanation) {
        setExplanation(data.explanation);
        onLogMessage('ai', `AI generated explanation for ${node.tool} command.`);
      } else if (data.error) {
        setExplanation(`❌ Error: ${data.error}`);
      }
    } catch (e: any) {
      setExplanation(`❌ API Connection Failed: ${e.message}`);
    } finally {
      setExplainLoading(false);
    }
  };

  // Call server-side API to cognitively parse raw tool output
  const parseRawOutput = async () => {
    if (!rawText.trim()) return;
    setParseLoading(true);
    try {
      const response = await fetch('/api/ai/analyze-raw-output', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawOutput: rawText })
      });
      const data = await response.json();
      if (data.evidence) {
        const ev = data.evidence;
        onUpdateNode({
          ...node,
          state: 'success',
          evidenceProduced: {
            ...node.evidenceProduced,
            open_ports: ev.open_ports || [],
            services: ev.services || [],
            findings: ev.findings || '',
            credentials: ev.credentials || [],
            notes: ev.notes || '',
            raw_output: rawText
          },
          updatedAt: new Date().toISOString()
        });
        onLogMessage('ai', `Parsed terminal dump for ${node.tool} successfully. Extracted findings.`);
        setActiveTab('evidence');
      }
    } catch (e: any) {
      onLogMessage('error', `Failed to parse output with AI: ${e.message}`);
    } finally {
      setParseLoading(false);
    }
  };

  const getStyleForType = (type: NodeClass) => {
    switch (type) {
      case 'discovery': return 'border-cyan-500/35 text-cyan-700 bg-cyan-500/10 dark:text-cyan-400 dark:bg-cyan-950/20';
      case 'web': return 'border-emerald-500/35 text-emerald-700 bg-emerald-500/10 dark:text-emerald-400 dark:bg-emerald-950/20';
      case 'custom': return 'border-purple-500/35 text-purple-700 bg-purple-500/10 dark:text-purple-400 dark:bg-purple-950/20';
      case 'ad': return 'border-amber-500/35 text-amber-700 bg-amber-500/10 dark:text-amber-500 dark:bg-amber-950/20';
      case 'exploitation': return 'border-rose-500/35 text-rose-700 bg-rose-500/10 dark:text-rose-400 dark:bg-rose-950/20';
      case 'post-exploitation': return 'border-fuchsia-500/35 text-fuchsia-700 bg-fuchsia-500/10 dark:text-fuchsia-400 dark:bg-fuchsia-950/20';
      default: return 'border-border text-muted-foreground bg-muted/50';
    }
  };

  const getStateColor = (state: NodeState) => {
    switch (state) {
      case 'pending': return 'bg-muted text-foreground dark:bg-zinc-700 dark:text-zinc-300';
      case 'running': return 'bg-blue-600 text-white animate-pulse';
      case 'success': return 'bg-emerald-600 text-white';
      case 'failed': return 'bg-rose-600 text-white';
      case 'discarded': return 'bg-muted text-muted-foreground line-through dark:bg-zinc-800 dark:text-zinc-500';
    }
  };

  return (
    <div id={`drawer-${node.id}`} className="phantom-drawer animate-in slide-in-from-right duration-300">
      <div className="phantom-drawer-header">
        <div className="flex items-center space-x-3">
          <div className="rounded border border-border bg-muted/50 p-2">
            <Terminal className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${getStyleForType(node.type)}`}>
                {node.type}
              </span>
              <span className="text-[10px] font-mono uppercase text-muted-foreground">ID: {node.id}</span>
            </div>
            <input
              type="text"
              value={node.title}
              onChange={(e) => updateField('title', e.target.value)}
              className="mt-0.5 w-full border-b border-transparent bg-transparent py-0.5 font-sans text-base font-bold text-foreground transition hover:border-border focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
        <button
          id={`btn-close-drawer`}
          onClick={onClose}
          className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Pentesting Phase Selector */}
      <div className="phantom-drawer-section select-none">
        <div className="flex items-center justify-between">
          <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Fase Pentesting / CTF</label>
          <span className="text-[9px] font-mono uppercase text-purple-600 dark:text-purple-400">Organiza la alineación</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {([
            { id: 'discovery', label: 'Recon & OSINT', num: '01', style: 'border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/40', activeStyle: 'border-cyan-500 bg-cyan-950/40 text-cyan-300 ring-1 ring-cyan-500/30 font-bold shadow-[0_0_8px_rgba(6,182,212,0.15)]' },
            { id: 'web', label: 'Enumeración', num: '02', style: 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/40', activeStyle: 'border-emerald-500 bg-emerald-950/40 text-emerald-300 ring-1 ring-emerald-500/30 font-bold shadow-[0_0_8px_rgba(16,185,129,0.15)]' },
            { id: 'custom', label: 'Análisis Vuln', num: '03', style: 'border-purple-500/20 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/40', activeStyle: 'border-purple-500 bg-purple-950/40 text-purple-300 ring-1 ring-purple-500/30 font-bold shadow-[0_0_8px_rgba(168,85,247,0.15)]' },
            { id: 'exploitation', label: 'Explotación', num: '04', style: 'border-rose-500/20 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/40', activeStyle: 'border-rose-500 bg-rose-950/40 text-rose-300 ring-1 ring-rose-500/30 font-bold shadow-[0_0_8px_rgba(244,63,94,0.15)]' },
            { id: 'ad', label: 'Mov. Lateral', num: '05', style: 'border-amber-500/20 text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/40', activeStyle: 'border-amber-500 bg-amber-950/40 text-amber-300 ring-1 ring-amber-500/30 font-bold shadow-[0_0_8px_rgba(245,158,11,0.15)]' },
            { id: 'post-exploitation', label: 'Post-Exploit', num: '06', style: 'border-fuchsia-500/20 text-fuchsia-400 hover:bg-fuchsia-500/10 hover:border-fuchsia-500/40', activeStyle: 'border-fuchsia-500 bg-fuchsia-950/40 text-fuchsia-300 ring-1 ring-fuchsia-500/30 font-bold shadow-[0_0_8px_rgba(217,70,239,0.15)]' },
          ] as const).map((phase) => (
            <button
              id={`btn-phase-selector-${phase.id}`}
              key={phase.id}
              onClick={() => {
                updateField('type', phase.id);
                onLogMessage('info', `Nodo "${node.title}" clasificado a la fase: ${phase.label}`);
              }}
              className={`phantom-phase-btn space-y-0.5 ${
                node.type === phase.id ? phase.activeStyle : phase.style
              }`}
              title={`Asignar nodo a la fase ${phase.label}`}
            >
              <span className="opacity-40 text-[7.5px] font-mono">{phase.num}</span>
              <span className="truncate w-full font-sans tracking-tight">{phase.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Node Status Selector */}
      <div className="phantom-drawer-section">
        <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Node State Machine</label>
        <div className="flex flex-wrap gap-1">
          {(['pending', 'running', 'success', 'failed', 'discarded'] as NodeState[]).map((st) => (
            <button
              id={`btn-state-${st}`}
              key={st}
              onClick={() => updateState(st)}
              className={
                node.state === st ? getStateColor(st) : 'phantom-state-btn'
              }
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="phantom-drawer-tabs">
        {(['command', 'evidence', 'ai'] as const).map((tab) => (
          <button
            id={`tab-drawer-${tab}`}
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`phantom-drawer-tab ${activeTab === tab ? 'phantom-drawer-tab--active' : ''}`}
          >
            {tab === 'command' && 'Command Engine'}
            {tab === 'evidence' && 'Structured Evidence'}
            {tab === 'ai' && 'Cognitive Helper'}
          </button>
        ))}
      </div>

      {/* Tab Contents Scrollable container */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* ================= COMMANDS TAB ================= */}
        {activeTab === 'command' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-purple-400 uppercase mb-1.5">Description</label>
              <textarea
                value={node.description}
                onChange={(e) => updateField('description', e.target.value)}
                className="phantom-field min-h-16 resize-y"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-mono text-purple-400 uppercase">Command Template</label>
                <span className="text-[10px] font-mono text-muted-foreground">Accepts variables</span>
              </div>
              <textarea
                value={node.commandTemplate}
                onChange={(e) => updateField('commandTemplate', e.target.value)}
                className="phantom-field min-h-20 font-mono text-pink-600 dark:text-pink-400"
              />
            </div>

            {/* Local custom parameters overrides */}
            <div>
              <label className="block text-xs font-mono text-purple-400 uppercase mb-2">Local Overrides</label>
              <div className="phantom-panel-card space-y-2">
                {Object.keys(node.customParams).length === 0 ? (
                  <p className="text-[11px] italic font-mono text-muted-foreground">No specific parameters overridden. Using targets.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(node.customParams).map(([paramName, paramVal]) => (
                      <div key={paramName} className="flex flex-col">
                        <span className="mb-1 text-[10px] font-mono text-muted-foreground">{paramName}</span>
                        <input
                          type="text"
                          value={paramVal}
                          onChange={(e) => {
                            const newParams = { ...node.customParams, [paramName]: e.target.value };
                            updateField('customParams', newParams);
                          }}
                          className="phantom-field font-mono"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {/* Simple parameter adder */}
                <div className="mt-3 flex items-center space-x-2 border-t border-border pt-3">
                  <select
                    id="param-adder"
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const newParams = { ...node.customParams, [e.target.value]: '' };
                      updateField('customParams', newParams);
                      e.target.value = '';
                    }}
                    className="phantom-field font-mono text-[11px]"
                  >
                    <option value="">+ Add variable overrides</option>
                    <option value="$PORT">$PORT (Port)</option>
                    <option value="$DOMAIN">$DOMAIN (FQDN)</option>
                    <option value="$SUBDOMAIN">$SUBDOMAIN (Subdomain)</option>
                    <option value="$PROTO">$PROTO (http/https)</option>
                    <option value="$WORDLIST">$WORDLIST (List path)</option>
                    <option value="$USER">$USER (Username)</option>
                    <option value="$PASSWORD">$PASSWORD (Credentials)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Compiled Command Preview */}
            <div className="border-t border-border pt-3">
              <label className="mb-2 block text-xs font-mono uppercase text-purple-600 dark:text-purple-400">Substituted Preview (Ready to copy)</label>
              <div className="phantom-code-block group flex flex-col">
                <span className="whitespace-pre-wrap pr-10 text-slate-200 select-all">{renderedCommand}</span>
                <button
                  id={`btn-copy-command`}
                  onClick={handleCopy}
                  className="absolute right-2 top-2 flex cursor-pointer items-center space-x-1 rounded border border-border bg-card/90 p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  title="Copy command to clipboard"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-[9px] text-emerald-400 px-1 font-sans">Copied</span>
                    </>
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Quick explanatory agent triggering button */}
            <button
              id={`btn-explain-ai`}
              onClick={explainCommand}
              disabled={explainLoading}
              className="w-full py-2.5 rounded border border-purple-500/30 bg-purple-950/15 text-purple-300 text-xs font-mono flex items-center justify-center space-x-2 hover:bg-purple-950/30 active:scale-95 transition cursor-pointer"
            >
              <Cpu className="h-4 w-4 text-purple-400" />
              <span>{explainLoading ? 'Generating AI explanation...' : 'Explain with Gemini Assistant'}</span>
            </button>

            {explanation && (
              <div className="phantom-panel-card mt-2 max-h-60 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed">
                {explanation}
              </div>
            )}
          </div>
        )}

        {/* ================= EVIDENCE TAB ================= */}
        {activeTab === 'evidence' && (
          <div className="space-y-4">
            <div className="bg-emerald-950/10 border border-emerald-900/40 p-4 rounded-md space-y-2">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-mono text-emerald-400 uppercase font-semibold">Active Evidence Cabinet</span>
              </div>
              <p className="text-[10px] font-sans text-muted-foreground">
                Gather structural context. Discovered information propagates to rules and subsequent recommendations.
              </p>
            </div>

            {/* Discovered open ports list */}
            <div>
              <label className="block text-xs font-mono text-purple-400 uppercase mb-1.5">Discovered Ports</label>
              <input
                type="text"
                placeholder="Comma separated: 80, 443, 8080"
                value={node.evidenceProduced.open_ports?.join(', ') || ''}
                onChange={(e) => {
                  const ports = e.target.value.split(',').map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p));
                  updateEvidenceField('open_ports', ports);
                }}
                className="phantom-field font-mono"
              />
            </div>

            {/* Discovered services */}
            <div>
              <label className="block text-xs font-mono text-purple-400 uppercase mb-1.5">Active Services</label>
              <input
                type="text"
                placeholder="Comma separated: http, smb, ssh, mysql"
                value={node.evidenceProduced.services?.join(', ') || ''}
                onChange={(e) => {
                  const services = e.target.value.split(',').map(s => s.trim().toLowerCase()).filter(s => s !== '');
                  updateEvidenceField('services', services);
                }}
                className="phantom-field font-mono"
              />
            </div>

            {/* Key Findings */}
            <div>
              <label className="block text-xs font-mono text-purple-400 uppercase mb-1.5">Key Findings Summary</label>
              <textarea
                placeholder="Detail technical findings... e.g. Apache server version 2.4 discovered"
                value={node.evidenceProduced.findings || ''}
                onChange={(e) => updateEvidenceField('findings', e.target.value)}
                className="phantom-field min-h-24 resize-y"
              />
            </div>

            {/* Credentials / Hashes found */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-mono text-purple-400 uppercase">Harvested Credentials</label>
                <button
                  id="btn-add-credential"
                  onClick={() => {
                    const currentCreds = node.evidenceProduced.credentials || [];
                    const newCreds = [...currentCreds, { username: 'NewUser', password: '', service: '' }];
                    updateEvidenceField('credentials', newCreds);
                  }}
                  className="text-[10px] font-mono text-emerald-400 uppercase hover:underline cursor-pointer"
                >
                  + Add row
                </button>
              </div>
              <div className="phantom-panel-card max-h-40 space-y-2 overflow-y-auto p-2.5">
                {(node.evidenceProduced.credentials || []).length === 0 ? (
                  <p className="py-2 text-center text-[10px] italic font-mono text-muted-foreground">No credentials harvested on this node yet.</p>
                ) : (
                  (node.evidenceProduced.credentials || []).map((cred, idx) => (
                    <div key={idx} className="flex gap-1.5 items-center">
                      <input
                        type="text"
                        placeholder="User"
                        value={cred.username}
                        onChange={(e) => {
                          const updated = [...(node.evidenceProduced.credentials || [])];
                          updated[idx] = { ...updated[idx], username: e.target.value };
                          updateEvidenceField('credentials', updated);
                        }}
                        className="phantom-field w-1/3 py-0.5 text-[11px] font-mono"
                      />
                      <input
                        type="text"
                        placeholder="Pass/Hash"
                        value={cred.password || ''}
                        onChange={(e) => {
                          const updated = [...(node.evidenceProduced.credentials || [])];
                          updated[idx] = { ...updated[idx], password: e.target.value };
                          updateEvidenceField('credentials', updated);
                        }}
                        className="phantom-field w-1/3 py-0.5 text-[11px] font-mono"
                      />
                      <input
                        type="text"
                        placeholder="Service"
                        value={cred.service || ''}
                        onChange={(e) => {
                          const updated = [...(node.evidenceProduced.credentials || [])];
                          updated[idx] = { ...updated[idx], service: e.target.value };
                          updateEvidenceField('credentials', updated);
                        }}
                        className="phantom-field w-1/4 py-0.5 text-[11px] font-mono"
                      />
                      <button
                        id={`btn-del-cred-${idx}`}
                        onClick={() => {
                          const updated = [...(node.evidenceProduced.credentials || [])].filter((_, i) => i !== idx);
                          updateEvidenceField('credentials', updated);
                        }}
                        className="text-rose-500 hover:text-rose-400 p-0.5 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Extracted URLs */}
            <div>
              <label className="block text-xs font-mono text-purple-400 uppercase mb-1.5">Extracted URLs / Domains</label>
              <textarea
                placeholder="One URL per line"
                value={node.evidenceProduced.extracted_urls?.join('\n') || ''}
                onChange={(e) => {
                  const urls = e.target.value.split('\n').map(u => u.trim()).filter(u => u !== '');
                  updateEvidenceField('extracted_urls', urls);
                }}
                className="phantom-field min-h-16 font-mono"
              />
            </div>
          </div>
        )}

        {/* ================= COGNITIVE PARSER TAB ================= */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            <div className="bg-purple-950/5 border border-purple-900/30 p-4 rounded-md space-y-2">
              <div className="flex items-center space-x-2">
                <Cpu className="h-4 w-4 text-purple-400 animate-pulse" />
                <span className="text-xs font-mono text-purple-300 uppercase font-semibold">Terminal Dump AI Cognitive Parser</span>
              </div>
              <p className="text-[10px] font-sans text-muted-foreground">
                Paste any raw offensive terminal scan, directory dump, or tool output. The Gemini AI engine will parse this log, automatically structure open ports, services, credentials, and notes, and update your node state directly with high fidelity!
              </p>
            </div>

            <div>
              <label className="block text-xs font-mono text-purple-400 uppercase mb-1.5">Raw Log Output Dump</label>
              <textarea
                placeholder="Example: Paste raw 'nmap -sV $TARGET' console output or active shell outputs..."
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="phantom-field min-h-64 resize-y font-mono text-[10px] text-purple-700 dark:text-purple-200"
              />
            </div>

            <button
              id={`btn-parse-output`}
              onClick={parseRawOutput}
              disabled={parseLoading || !rawText.trim()}
              className="w-full py-2.5 rounded bg-purple-600/90 text-white hover:bg-purple-600 font-mono text-xs flex items-center justify-center space-x-2 transition disabled:opacity-50 cursor-pointer"
            >
              <Cpu className={`h-4 w-4 ${parseLoading ? 'animate-spin' : ''}`} />
              <span>{parseLoading ? 'Gemini Parsing Terminal Dump...' : 'Extract Evidence with AI'}</span>
            </button>
          </div>
        )}

      </div>

      {/* Drawer Footer Actions */}
      <div className="phantom-drawer-footer">
        <button
          id={`btn-delete-node`}
          onClick={() => {
            onDeleteNode(node.id);
          }}
          className="flex cursor-pointer items-center space-x-1 rounded border border-rose-500/30 px-3 py-1.5 text-[11px] font-mono text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Delete Node</span>
        </button>

        <span className="text-[9px] font-mono text-muted-foreground">
          Last updated: {node.updatedAt ? new Date(node.updatedAt).toLocaleTimeString() : 'n/a'}
        </span>
      </div>
    </div>
  );
}
