/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { TerminalLog } from '@/components/phantom/types';
import { Terminal, Shield, Sparkles, AlertCircle, Copy, Search, Play, Trash } from 'lucide-react';

interface TerminalLogPanelProps {
  logs: TerminalLog[];
  onClearLogs: () => void;
  onAddSimulatedLog: (type: 'info' | 'success' | 'error' | 'command_copied' | 'state_change' | 'ai', message: string) => void;
}

export default function TerminalLogPanel({ logs, onClearLogs, onAddSimulatedLog }: TerminalLogPanelProps) {
  const [filter, setFilter] = useState<'all' | 'commands' | 'ai' | 'errors'>('all');
  const [simCmd, setSimCmd] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll terminal log cleanly on new entries
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, filter]);

  const filteredLogs = logs.filter(log => {
    if (filter === 'commands') return log.type === 'command_copied';
    if (filter === 'ai') return log.type === 'ai';
    if (filter === 'errors') return log.type === 'error' || log.type === 'failed' as any;
    return true;
  });

  const getLogSymbol = (type: string) => {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✗';
      case 'command_copied': return '➜';
      case 'state_change': return '⇄';
      case 'ai': return '✦';
      default: return 'i';
    }
  };

  const getLogStyle = (type: string) => {
    switch (type) {
      case 'success': return 'text-emerald-400 font-semibold';
      case 'error': return 'text-rose-500 font-semibold';
      case 'command_copied': return 'text-sky-400 font-semibold';
      case 'state_change': return 'text-amber-400';
      case 'ai': return 'text-purple-400 font-bold';
      default: return 'text-zinc-400';
    }
  };

  const handleSimulateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simCmd.trim()) return;
    
    // Simulate interactive commands on the board log
    const cmd = simCmd.trim().toLowerCase();
    if (cmd === 'clear' || cmd === 'cls') {
      onClearLogs();
    } else if (cmd.startsWith('help')) {
      onAddSimulatedLog('info', 'Available pseudo shell commands: help | clear | mock_exploit | target_check | ping_gateway');
    } else if (cmd.includes('exploit') || cmd.includes('pwn')) {
      onAddSimulatedLog('ai', 'SIMULATING SHELL ACCESS INJECTION: Exploit Metasploit handler active! Session 1 opened on victim target.');
    } else if (cmd.includes('ping') || cmd.includes('gateway')) {
      onAddSimulatedLog('success', 'SIMULATING PING ROUTE: ICMP Echo requests transmitted to target. Host active (0.01ms loss).');
    } else {
      onAddSimulatedLog('info', `SHELL INPUT: "${simCmd}" logs recorded in trace context.`);
    }
    setSimCmd('');
  };

  return (
    <div id="hacker-terminal" className="bg-[#08090d] border-t border-zinc-900 text-zinc-300 flex flex-col h-64 font-mono select-none">
      {/* Terminal Title Bar */}
      <div className="bg-[#0c0d12] border-b border-zinc-900 px-4 py-2 flex items-center justify-between text-xs font-semibold select-none">
        <div className="flex items-center space-x-2 text-zinc-400">
          <Terminal className="h-4 w-4 text-purple-500" />
          <span className="tracking-wide">CYBER_TRACE_TIMELINE_HISTORY.LOG</span>
        </div>
        
        {/* Terminal Filters */}
        <div className="flex items-center space-x-1.5">
          <button
            id="filter-all"
            onClick={() => setFilter('all')}
            className={`px-2 py-1 rounded text-[10px] uppercase transition cursor-pointer ${
              filter === 'all' ? 'bg-zinc-800 text-purple-400 font-bold border border-purple-900/30' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            All Traces
          </button>
          <button
            id="filter-commands"
            onClick={() => setFilter('commands')}
            className={`px-2 py-1 rounded text-[10px] uppercase transition cursor-pointer ${
              filter === 'commands' ? 'bg-sky-950/20 text-sky-400 border border-sky-900/30 font-bold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Commands Copied
          </button>
          <button
            id="filter-ai"
            onClick={() => setFilter('ai')}
            className={`px-2 py-1 rounded text-[10px] uppercase transition cursor-pointer ${
              filter === 'ai' ? 'bg-purple-950/20 text-purple-400 border border-purple-900/20 font-bold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            AI Detections
          </button>
          <button
            id="filter-errors"
            onClick={() => setFilter('errors')}
            className={`px-2 py-1 rounded text-[10px] uppercase transition cursor-pointer ${
              filter === 'errors' ? 'bg-rose-950/20 text-rose-400 border border-rose-900/20 font-bold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Failures/Errors
          </button>
          <div className="w-[1px] h-3.5 bg-zinc-800 mx-2" />
          <button
            id="btn-clear-terminal"
            onClick={onClearLogs}
            className="p-1 rounded text-zinc-600 hover:text-zinc-400 transition hover:bg-zinc-900 cursor-pointer"
            title="Clear Log History"
          >
            <Trash className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Logs Grid */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1.5 text-xs select-text selection:bg-purple-500/20 selection:text-zinc-100">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 space-y-2 text-zinc-600 text-center select-none">
            <Shield className="h-7 w-7 text-zinc-700 animate-pulse" />
            <p className="text-[11px] font-mono tracking-wider">NO AUDIT LOG ENTRIES MATCHING SELECTION RECORDED YET</p>
            <p className="text-[10px] text-zinc-700">All command copying, node additions, state transitions, and cognitive parses will reflect here.</p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="flex items-start space-x-2.5 leading-relaxed group hover:bg-zinc-950/40 px-1 py-0.5 rounded transition">
              <span className="text-[10px] text-zinc-600 select-none">[{log.timestamp}]</span>
              <span className={`text-[11px] select-none ${getLogStyle(log.type)}`}>
                [{getLogSymbol(log.type)}]
              </span>
              <span className="text-zinc-300 flex-1 whitespace-pre-wrap selection:text-white">
                {log.message}
              </span>
              <button
                id={`btn-copy-log-${log.id}`}
                onClick={() => {
                  navigator.clipboard.writeText(log.message);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-700 hover:text-zinc-400 transition select-none cursor-pointer"
                title="Copy log text"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Terminal Prompt Bar */}
      <form onSubmit={handleSimulateSubmit} className="bg-[#06070a] border-t border-zinc-900 px-4 py-2 flex items-center space-x-2 text-xs text-zinc-500">
        <span className="text-emerald-500 font-bold select-none">root@kali-pentest-graph:/#</span>
        <input
          type="text"
          value={simCmd}
          onChange={(e) => setSimCmd(e.target.value)}
          placeholder="Simulate shell inputs... (e.g. 'help', 'mock_exploit', 'clear')"
          className="bg-transparent text-zinc-200 outline-none flex-1 border-none focus:ring-0 font-mono text-xs placeholder:text-zinc-700 text-zinc-300"
        />
        <span className="text-[10px] text-zinc-700 font-mono select-none justify-self-end">PRESS ENTER</span>
      </form>
    </div>
  );
}
