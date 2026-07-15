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
      default: return 'text-muted-foreground';
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
    <div id="hacker-terminal" className="phantom-terminal flex flex-col h-52 shrink-0 select-none">
      <div className="border-b border-border bg-muted/40 px-4 py-2 flex items-center justify-between text-xs font-semibold select-none">
        <div className="flex items-center space-x-2 text-muted-foreground">
          <Terminal className="h-4 w-4 text-primary" />
          <span className="tracking-wide">Activity log</span>
        </div>
        
        {/* Terminal Filters */}
        <div className="flex items-center space-x-1.5">
          <button
            id="filter-all"
            onClick={() => setFilter('all')}
            className={`px-2 py-1 rounded text-[10px] uppercase transition cursor-pointer ${
              filter === 'all' ? 'bg-primary/10 text-primary font-bold border border-primary/20' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All Traces
          </button>
          <button
            id="filter-commands"
            onClick={() => setFilter('commands')}
            className={`px-2 py-1 rounded text-[10px] uppercase transition cursor-pointer ${
              filter === 'commands' ? 'bg-sky-500/10 text-sky-600 border border-sky-500/20 font-bold dark:text-sky-400' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Commands Copied
          </button>
          <button
            id="filter-ai"
            onClick={() => setFilter('ai')}
            className={`px-2 py-1 rounded text-[10px] uppercase transition cursor-pointer ${
              filter === 'ai' ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20 font-bold dark:text-purple-400' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            AI Detections
          </button>
          <button
            id="filter-errors"
            onClick={() => setFilter('errors')}
            className={`px-2 py-1 rounded text-[10px] uppercase transition cursor-pointer ${
              filter === 'errors' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20 font-bold dark:text-rose-400' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Failures/Errors
          </button>
          <div className="w-px h-3.5 bg-border mx-2" />
          <button
            id="btn-clear-terminal"
            onClick={onClearLogs}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition hover:bg-muted cursor-pointer"
            title="Clear Log History"
          >
            <Trash className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Logs Grid */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1.5 text-xs select-text">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 space-y-2 text-muted-foreground text-center select-none">
            <Shield className="h-7 w-7 opacity-40 animate-pulse" />
            <p className="text-[11px] font-mono tracking-wider">No log entries for this filter</p>
            <p className="text-[10px]">Commands, state changes, and ingest events appear here.</p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="flex items-start space-x-2.5 leading-relaxed group hover:bg-muted/50 px-1 py-0.5 rounded transition">
              <span className="text-[10px] text-muted-foreground select-none">[{log.timestamp}]</span>
              <span className={`text-[11px] select-none ${getLogStyle(log.type)}`}>
                [{getLogSymbol(log.type)}]
              </span>
              <span className="text-foreground flex-1 whitespace-pre-wrap">
                {log.message}
              </span>
              <button
                id={`btn-copy-log-${log.id}`}
                onClick={() => {
                  navigator.clipboard.writeText(log.message);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-foreground transition select-none cursor-pointer"
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
      <form onSubmit={handleSimulateSubmit} className="border-t border-border bg-muted/30 px-4 py-2 flex items-center space-x-2 text-xs text-muted-foreground">
        <span className="text-emerald-600 dark:text-emerald-400 font-bold select-none">phantom@workflow:/#</span>
        <input
          type="text"
          value={simCmd}
          onChange={(e) => setSimCmd(e.target.value)}
          placeholder="Simulate shell inputs… (help, clear, mock_exploit)"
          className="bg-transparent text-foreground outline-none flex-1 border-none focus:ring-0 font-mono text-xs placeholder:text-muted-foreground/60"
        />
        <span className="text-[10px] font-mono select-none">ENTER</span>
      </form>
    </div>
  );
}
