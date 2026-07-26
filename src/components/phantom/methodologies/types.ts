/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type NodeKind = 
  // Root level core concepts
  | 'attacker'
  | 'domain'
  | 'target'
  // Attacker & Methodology hierarchy
  | 'methodology'
  | 'playbook'
  | 'phase'
  | 'tactic'
  | 'technique'
  | 'subtechnique'
  | 'command'
  | 'check'
  | 'payload'
  | 'exploit'
  | 'output'
  // Domain hierarchy
  | 'subdomain'
  | 'dns_record'
  | 'resource'
  // Target & Asset hierarchy
  | 'hostname'
  | 'ip'
  | 'port'
  | 'service'
  | 'technology'
  | 'version'
  | 'configuration'
  | 'endpoint'
  | 'directory'
  | 'file'
  | 'vulnerability'
  | 'mitigation'
  | 'reference'
  | 'certificate'
  | 'banner'
  | 'operating_system'
  | 'network'
  | 'note'
  // Workspace / Project wrappers
  | 'workspace'
  | 'project';

export type NodeStatus = 'todo' | 'in-progress' | 'done' | 'failed' | 'na';

export interface POLNode {
  id: string;
  parentId: string | null;
  title: string;
  kind: NodeKind;
  status: NodeStatus;
  expanded: boolean;
  depth: number; // 0 to 6
  description?: string;
  notes?: string;
  variables?: Record<string, string>;
  payloads?: string;
}

export type MethodologyCategory = 
  | 'Infrastructure & AD'
  | 'Web Applications (OWASP)'
  | 'Cloud Security (AWS/Azure)'
  | 'Mobile Penetration Testing'
  | 'Red Team & Adversary'
  | 'Compliance & Audits'
  | 'Custom';

export interface Methodology {
  id: string;
  title: string;
  code: string;
  description: string;
  category: MethodologyCategory;
  tags: string[];
  nodes: POLNode[];
  createdAt: string;
  updatedAt: string;
  isFavorite?: boolean;
}

export type ViewMode = 'outline' | 'markdown' | 'mindmap';
export type CatalogViewMode = 'grid' | 'list';

export interface PhantomAiContext {
  activeMethodologyTitle?: string;
  activeMethodologyId?: string;
  activeViewMode: ViewMode | 'catalog';
  totalNodesCount: number;
  activeNode?: {
    id: string;
    title: string;
    kind: NodeKind;
    status: NodeStatus;
    command?: string;
    variables?: Record<string, string>;
    inheritedVars?: Record<string, string>;
  };
}

export const ROOT_KINDS: NodeKind[] = ['attacker', 'domain', 'target'];

export const KINDS: NodeKind[] = [
  'attacker',
  'domain',
  'target',
  'methodology',
  'playbook',
  'phase',
  'tactic',
  'technique',
  'subtechnique',
  'command',
  'check',
  'payload',
  'exploit',
  'output',
  'subdomain',
  'dns_record',
  'resource',
  'hostname',
  'ip',
  'port',
  'service',
  'technology',
  'version',
  'configuration',
  'endpoint',
  'directory',
  'file',
  'vulnerability',
  'mitigation',
  'reference',
  'certificate',
  'banner',
  'operating_system',
  'network',
  'note',
];

export const KIND_COLORS: Record<NodeKind, { bg: string; text: string; border: string }> = {
  attacker: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  domain: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  target: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  methodology: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  playbook: { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-400', border: 'border-fuchsia-500/30' },
  phase: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30' },
  tactic: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  technique: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  subtechnique: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/30' },
  command: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  check: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
  payload: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  exploit: { bg: 'bg-rose-600/10', text: 'text-rose-300', border: 'border-rose-500/30' },
  output: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/30' },
  subdomain: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30' },
  dns_record: { bg: 'bg-blue-600/10', text: 'text-blue-300', border: 'border-blue-500/30' },
  resource: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
  hostname: { bg: 'bg-indigo-600/10', text: 'text-indigo-300', border: 'border-indigo-500/30' },
  ip: { bg: 'bg-amber-600/10', text: 'text-amber-300', border: 'border-amber-500/30' },
  port: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  service: { bg: 'bg-cyan-600/10', text: 'text-cyan-300', border: 'border-cyan-500/30' },
  technology: { bg: 'bg-emerald-600/10', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  version: { bg: 'bg-teal-600/10', text: 'text-teal-300', border: 'border-teal-500/30' },
  configuration: { bg: 'bg-slate-600/10', text: 'text-slate-300', border: 'border-slate-500/30' },
  endpoint: { bg: 'bg-violet-600/10', text: 'text-violet-300', border: 'border-violet-500/30' },
  directory: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  file: { bg: 'bg-sky-600/10', text: 'text-sky-300', border: 'border-sky-500/30' },
  vulnerability: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40' },
  mitigation: { bg: 'bg-green-600/10', text: 'text-green-300', border: 'border-green-500/30' },
  reference: { bg: 'bg-zinc-600/10', text: 'text-zinc-300', border: 'border-zinc-500/30' },
  certificate: { bg: 'bg-amber-700/10', text: 'text-amber-200', border: 'border-amber-500/30' },
  banner: { bg: 'bg-slate-700/10', text: 'text-slate-200', border: 'border-slate-500/30' },
  operating_system: { bg: 'bg-blue-700/10', text: 'text-blue-200', border: 'border-blue-500/30' },
  network: { bg: 'bg-purple-600/10', text: 'text-purple-300', border: 'border-purple-500/30' },
  note: { bg: 'bg-yellow-600/10', text: 'text-yellow-200', border: 'border-yellow-500/30' },
  workspace: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
  project: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30' },
};

export const STATUS_SYMBOLS: Record<NodeStatus, { symbol: string; label: string; color: string }> = {
  'todo': { symbol: '○', label: 'Por hacer', color: 'text-slate-400' },
  'in-progress': { symbol: '◐', label: 'En proceso', color: 'text-amber-400' },
  'done': { symbol: '✔', label: 'Completado', color: 'text-emerald-400' },
  'failed': { symbol: '✖', label: 'Falló / Vulnerable', color: 'text-red-400' },
  'na': { symbol: '⊘', label: 'No aplica', color: 'text-slate-500' },
};
