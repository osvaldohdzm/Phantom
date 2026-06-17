/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type NodeClass = 'discovery' | 'web' | 'ad' | 'exploitation' | 'post-exploitation' | 'custom';

export type NodeState = 'pending' | 'running' | 'success' | 'failed' | 'discarded';

export interface NodeEvidence {
  open_ports?: number[];
  services?: string[];
  findings?: string;
  credentials?: { username: string; password?: string; hash?: string; service?: string }[];
  extracted_urls?: string[];
  notes?: string;
  raw_output?: string;
}

export interface PentestNode {
  id: string;
  title: string;
  description: string;
  type: NodeClass;
  tool: string;
  state: NodeState;
  commandTemplate: string;
  customParams: Record<string, string>; // Local overrides e.g. PORT, WORDLIST, PROTO
  evidenceProduced: NodeEvidence;
  position: { x: number; y: number };
  tags: string[];
  isSuggested?: boolean;
  suggestedReason?: string;
  updatedAt: string;
}

export interface NodeConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  type?: 'default' | 'credential_flow' | 'pivoting';
  label?: string;
}

export interface TerminalLog {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'command_copied' | 'state_change' | 'ai';
  message: string;
}

export interface SuggestionRule {
  id: string;
  name: string;
  condition: {
    service?: string; // e.g. "http", "smb", "ssh"
    port?: number;    // e.g. 80, 445, 22
    tool?: string;    // e.g. "nmap"
    findings?: string; // e.g. "wordpress", "http-title"
  };
  suggestNode: {
    title: string;
    description: string;
    type: NodeClass;
    tool: string;
    commandTemplate: string;
    tags: string[];
  };
}

export interface WorkflowTemplate {
  name: string;
  description: string;
  category: string;
  nodes: PentestNode[];
  connections: NodeConnection[];
}

export interface SavedWorkspace {
  id: string;
  name: string;
  description: string;
  category: 'HackTheBox' | 'TryHackMe' | 'VulnHub' | 'Real Pentest' | 'Personal Writeup';
  target: string;
  attackerIp: string;
  globalVars: Record<string, string>;
  nodes: PentestNode[];
  connections: NodeConnection[];
  createdAt: string;
  updatedAt: string;
}

