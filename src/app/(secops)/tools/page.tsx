'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  GitBranch,
  Activity,
  Wrench,
  Radio,
  Map,
  FileCode,
  ChevronRight,
  Search,
  Sparkles,
  Terminal,
  ScanLine,
  NetworkIcon,
  Layers,
  BarChart3,
  Layout,
  FileSpreadsheet,
} from 'lucide-react';

type ToolCategory = 'all' | 'recon' | 'mapping' | 'reporting' | 'analysis';

interface Tool {
  id: string;
  href: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: ToolCategory;
  color: string;
  textColor: string;
  badge?: string;
  isNew?: boolean;
}

const TOOLS: Tool[] = [
  {
    id: 'methodologies-phantom',
    href: '/tools/methodologies-phantom',
    name: 'Methodologies Phantom',
    description: 'Hierarchical tree editor (POL Editor Core) for pentest methodologies, command templates, and checklist cascade propagation.',
    icon: FileCode,
    category: 'mapping',
    color: 'bg-violet-500/10',
    textColor: 'text-violet-400',
    badge: 'New',
    isNew: true,
  },
  {
    id: 'phantom',
    href: '/tools/phantom',
    name: 'Phantom Modeling',
    description: 'Infrastructure modeling, attack chains, MITRE playbooks, and interactive engagement diagrams.',
    icon: GitBranch,
    category: 'mapping',
    color: 'bg-violet-500/10',
    textColor: 'text-violet-400',
    badge: 'Advanced',
  },
  {
    id: 'exposure',
    href: '/tools/exposure',
    name: 'Network Exposure Report',
    description: 'Generate interactive standalone HTML reports from Nmap and Nessus results. Export with one click.',
    icon: Activity,
    category: 'reporting',
    color: 'bg-cyan-500/10',
    textColor: 'text-cyan-400',
  },
  {
    id: 'nmap',
    href: '/tools/nmap',
    name: 'Nmap Scanner',
    description: 'Port scanning and service detection tool. Visualize results and export to XML or Grepable formats.',
    icon: ScanLine,
    category: 'recon',
    color: 'bg-emerald-500/10',
    textColor: 'text-emerald-400',
  },
  {
    id: 'topology',
    href: '/tools/phantom',
    name: 'Topology Mapper',
    description: 'Visualize network topology from asset data. Generate zone maps, subnets, and critical nodes.',
    icon: NetworkIcon,
    category: 'mapping',
    color: 'bg-blue-500/10',
    textColor: 'text-blue-400',
    badge: 'Beta',
    isNew: true,
  },
  {
    id: 'vuln-surface',
    href: '/vul-mgmt',
    name: 'Vulnerability Surface',
    description: 'Consolidated exposure view by host, severity, and affected service. Filter by engagement or inventory.',
    icon: Layers,
    category: 'analysis',
    color: 'bg-rose-500/10',
    textColor: 'text-rose-400',
  },
  {
    id: 'exposure-live',
    href: '/tools/exposure',
    name: 'Live Exposure Dashboard',
    description: 'Metrics for exposed ports, active services, and tenant risk level. Real-time executive dashboard.',
    icon: BarChart3,
    category: 'reporting',
    color: 'bg-amber-500/10',
    textColor: 'text-amber-400',
    isNew: true,
  },
  {
    id: 'canvas',
    href: '/canvas',
    name: 'Evidence Hacker Canvas',
    description: 'Paste screenshots (Ctrl+V), mark findings with arrows and rectangles, redact sensitive data, and export to PNG or clipboard.',
    icon: Layout,
    category: 'reporting',
    color: 'bg-emerald-500/10',
    textColor: 'text-emerald-400',
  },
  {
    id: 'excel-ingest',
    href: '/ingesta-excel',
    name: 'Excel Ingest Inspector',
    description: 'Excel Workbook Inspector. Equivalent to the Google Apps Script flow: analyzes all sheets (Dashboard, SoW, Evaluations, Vulnerabilities Catalog, Follow-up, etc.), displays columns and row samples, and maintains an auditable execution log. Everything runs locally in the browser.',
    icon: FileSpreadsheet,
    category: 'reporting',
    color: 'bg-cyan-500/10',
    textColor: 'text-cyan-400',
  },
];

const CATEGORIES: { id: ToolCategory; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'all', label: 'All', icon: Sparkles },
  { id: 'recon', label: 'Recon', icon: Radio },
  { id: 'mapping', label: 'Mapping', icon: Map },
  { id: 'reporting', label: 'Reporting', icon: FileCode },
  { id: 'analysis', label: 'Analysis', icon: BarChart3 },
];

export default function ToolsHubPage() {
  const [activeCategory, setActiveCategory] = useState<ToolCategory>('all');
  const [query, setQuery] = useState('');

  const filtered = TOOLS.filter((t) => {
    const matchesCat = activeCategory === 'all' || t.category === activeCategory;
    const matchesQ =
      !query ||
      t.name.toLowerCase().includes(query.toLowerCase()) ||
      t.description.toLowerCase().includes(query.toLowerCase());
    return matchesCat && matchesQ;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header hero */}
      <div className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-background via-primary/[0.03] to-background px-6 py-12">
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/5 blur-3xl" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-semibold mb-4 select-none">
            <Wrench className="size-3" />
            SecOps Toolset
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-3">
            Security Tools
          </h1>
          <p className="text-muted-foreground text-base max-w-xl mx-auto leading-relaxed">
            Scanning, mapping, reporting, and offensive analysis — all in one place.
            Tools tailored for the SOC team workflow.
          </p>
          <div className="mt-7 max-w-md mx-auto relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search tools..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-11 rounded-xl border border-border bg-card pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-md px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-2 overflow-x-auto scrollbar-none select-none">
          {CATEGORIES.map(({ id, label, icon: CatIcon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveCategory(id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${activeCategory === id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'border border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
                }`}
            >
              <CatIcon className="size-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tools grid */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No tools match your search.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.id}
                  href={tool.href}
                  className="group relative flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
                >
                  <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-primary/[0.03] to-transparent" />
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl ${tool.color}`}>
                      <Icon className={`size-6 ${tool.textColor}`} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      {tool.isNew && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wide">
                          New
                        </span>
                      )}
                      {tool.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border uppercase tracking-wide">
                          {tool.badge}
                        </span>
                      )}
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-foreground mb-1.5 leading-snug group-hover:text-primary transition-colors">
                    {tool.name}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                    {tool.description}
                  </p>
                  <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                    Open tool
                    <ChevronRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Bottom info strip */}
        <div className="mt-10 p-4 rounded-xl border border-border/60 bg-card/40 flex items-center gap-3 text-xs text-muted-foreground">
          <Terminal className="size-4 shrink-0 text-primary" />
          <span>
            Active scanning tools require a{' '}
            <Link href="/agents" className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors font-medium">
              configured SSH agent
            </Link>{' '}
            in <strong className="text-foreground">ACTIVE</strong> status to run over client infrastructure.
          </span>
        </div>
      </div>
    </div>
  );
}
