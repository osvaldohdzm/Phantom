'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Crosshair,
  Loader2,
  Magnet,
  Network as NetworkIcon,
  Radius,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme-provider';
import type { ExposureReportData } from '@/lib/exposure-report';
import type { NessusVuln } from '@/app/(secops)/tools/exposure/parsers';

type RiskKey = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'none';

const RISK_WEIGHT: Record<RiskKey, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
  none: 0,
};

// Vivid severity palette — high contrast on both light and dark canvases.
const SEV_NODE: Record<RiskKey, { background: string; border: string }> = {
  critical: { background: '#9333ea', border: '#7e22ce' },
  high: { background: '#ef4444', border: '#b91c1c' },
  medium: { background: '#eab308', border: '#a16207' },
  low: { background: '#22c55e', border: '#15803d' },
  info: { background: '#3b82f6', border: '#1d4ed8' },
  none: { background: '#64748b', border: '#475569' },
};

const SEV_BADGE: Record<RiskKey, string> = {
  critical: 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/40',
  high: 'bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/40',
  medium: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/40',
  low: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/40',
  info: 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/40',
  none: 'bg-muted text-muted-foreground border-border',
};

// Concentric radii per severity ring (geometric layout — no physics needed).
const RADIUS: Record<RiskKey, number> = {
  critical: 350,
  high: 650,
  medium: 950,
  low: 1250,
  info: 1550,
  none: 1550,
};

function riskKey(risk?: string | null): RiskKey {
  const r = (risk ?? '').toLowerCase();
  if (r.includes('critical')) return 'critical';
  if (r.includes('high')) return 'high';
  if (r.includes('medium')) return 'medium';
  if (r.includes('low')) return 'low';
  if (r.includes('info')) return 'info';
  return 'none';
}

type GraphNode = {
  id: string;
  label?: string;
  title?: string;
  shape: string;
  size: number;
  x?: number;
  y?: number;
  fixed?: boolean;
  color: { background: string; border: string; highlight?: { background: string; border: string } };
  borderWidth?: number;
  font?: { color?: string; size?: number; face?: string };
  group?: string;
};

type GraphEdge = {
  id?: string;
  from: string;
  to: string;
  length?: number;
  color: { color: string };
};

type Graph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  lazyPortNodes: GraphNode[];
  lazyPortEdges: GraphEdge[];
  lazyVulnNodes: GraphNode[];
  lazyVulnEdges: GraphEdge[];
};

const NEUTRAL_EDGE = 'rgba(100,116,139,0.22)';
const PORT_EDGE = 'rgba(20,184,166,0.45)';
const VULN_EDGE = 'rgba(148,163,184,0.35)';
const MAX_LIST_ITEMS = 800;

function buildGraph(data: ExposureReportData, vulnsByHost: Map<string, NessusVuln[]>): Graph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const lazyPortNodes: GraphNode[] = [];
  const lazyPortEdges: GraphEdge[] = [];
  const lazyVulnNodes: GraphNode[] = [];
  const lazyVulnEdges: GraphEdge[] = [];

  nodes.push({
    id: 'root',
    label: 'RED OBJETIVO',
    shape: 'hexagon',
    size: 40,
    x: 0,
    y: 0,
    fixed: true,
    color: { background: '#7c3aed', border: '#6d28d9' },
    font: { color: '#ffffff', size: 16 },
  });

  const byRing: Record<RiskKey, { ip: string; hostname: string; os: string; vulns: NessusVuln[] }[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
    info: [],
    none: [],
  };

  for (const h of data.hosts) {
    const ipVulns = vulnsByHost.get(h.ip) ?? [];
    const nameVulns = h.hostname ? vulnsByHost.get(h.hostname) ?? [] : [];
    const hostVulns = [...ipVulns, ...nameVulns];
    let max: RiskKey = 'none';
    for (const v of hostVulns) {
      const k = riskKey(v.risk);
      if (RISK_WEIGHT[k] > RISK_WEIGHT[max]) max = k;
    }
    const ring = max === 'none' ? 'info' : max;
    byRing[ring].push({ ip: h.ip, hostname: h.hostname, os: h.os, vulns: hostVulns });
  }

  (Object.keys(byRing) as RiskKey[]).forEach((ring) => {
    const group = byRing[ring];
    if (!group.length) return;
    const radius = RADIUS[ring];
    const step = (2 * Math.PI) / group.length;

    group.forEach((host, i) => {
      const angle = i * step;
      const r = radius + (i % 2 === 0 ? 25 : -25);
      const hx = r * Math.cos(angle);
      const hy = r * Math.sin(angle);
      const c = SEV_NODE[ring];
      const hasVulns = host.vulns.length > 0;

      nodes.push({
        id: host.ip,
        label: host.ip,
        shape: 'dot',
        size: hasVulns ? 24 : 14,
        x: hx,
        y: hy,
        fixed: true,
        borderWidth: hasVulns ? 3 : 1,
        color: { background: c.background, border: c.border, highlight: { background: c.background, border: '#ffffff' } },
        font: { size: 12, face: 'JetBrains Mono, monospace' },
      });
      edges.push({ from: 'root', to: host.ip, color: { color: NEUTRAL_EDGE } });

      const ports = new Set<number>();
      const hostMeta = data.hosts.find((x) => x.ip === host.ip);
      hostMeta?.ports.forEach((p) => ports.add(p.port));
      host.vulns.forEach((v) => {
        if (v.port && v.port !== 0) ports.add(v.port);
      });
      ports.forEach((portNum) => {
        const portId = `${host.ip}:${portNum}`;
        lazyPortNodes.push({
          id: portId,
          group: 'port',
          label: String(portNum),
          shape: 'diamond',
          size: 9,
          color: { background: '#2dd4bf', border: '#0d9488' },
          font: { size: 10 },
        });
        lazyPortEdges.push({ from: host.ip, to: portId, length: 50, color: { color: PORT_EDGE } });
      });

      const seenVuln = new Set<string>();
      host.vulns.forEach((v) => {
        const k = riskKey(v.risk);
        const p = v.port && v.port !== 0 ? v.port : 0;
        const vId = `${host.ip}:${p}:${v.pluginId}:${v.name}`;
        if (seenVuln.has(vId)) return;
        seenVuln.add(vId);
        const c2 = SEV_NODE[k];
        const vSize = k === 'critical' ? 17 : k === 'high' ? 14 : k === 'medium' ? 12 : 10;
        lazyVulnNodes.push({
          id: vId,
          group: 'vuln',
          title: v.name,
          shape: 'triangleDown',
          size: vSize,
          color: { background: c2.background, border: '#ffffff' },
        });
        lazyVulnEdges.push({ from: host.ip, to: vId, length: 60, color: { color: VULN_EDGE } });
      });
    });
  });

  return { nodes, edges, lazyPortNodes, lazyPortEdges, lazyVulnNodes, lazyVulnEdges };
}

type ExposureMapViewProps = {
  data: ExposureReportData;
  title: string;
};

export function ExposureMapView({ data, title }: ExposureMapViewProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const containerRef = useRef<HTMLDivElement>(null);
  // vis-network instances are kept in refs (no re-render churn).
  const networkRef = useRef<{ destroy: () => void; focus: (id: string, o?: unknown) => void; selectNodes: (ids: string[]) => void; fit: () => void; setOptions: (o: unknown) => void; on: (ev: string, cb: (p: { nodes: string[] }) => void) => void } | null>(null);
  const nodesRef = useRef<{ add: (n: unknown) => void; update: (n: unknown) => void } | null>(null);
  const edgesRef = useRef<{ add: (e: unknown) => void } | null>(null);
  const injected = useRef({ ports: false, vulns: false });

  const [tab, setTab] = useState<'hosts' | 'vulns'>('hosts');
  const [query, setQuery] = useState('');
  const [openHosts, setOpenHosts] = useState<Set<string>>(new Set());
  const [openVulns, setOpenVulns] = useState<Set<string>>(new Set());
  const [physics, setPhysics] = useState(false);
  const [showPorts, setShowPorts] = useState(false);
  const [showVulns, setShowVulns] = useState(false);

  const vulnsByHost = useMemo(() => {
    const map = new Map<string, NessusVuln[]>();
    for (const v of data.vulnerabilities) {
      const arr = map.get(v.host);
      if (arr) arr.push(v);
      else map.set(v.host, [v]);
    }
    return map;
  }, [data]);

  const stats = useMemo(() => {
    let ports = 0;
    for (const h of data.hosts) ports += h.ports.length;
    let crit = 0;
    for (const v of data.vulnerabilities) if (riskKey(v.risk) === 'critical') crit += 1;
    return { hosts: data.hosts.length, ports, vulns: data.vulnerabilities.length, crit };
  }, [data]);

  const graph = useMemo(() => buildGraph(data, vulnsByHost), [data, vulnsByHost]);

  // Derive the loading overlay from "which graph has finished building" so we
  // never call setState synchronously inside the effect body.
  const [builtFor, setBuiltFor] = useState<Graph | null>(null);
  const building = builtFor !== graph;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const vis = await import('vis-network/standalone');
      if (cancelled || !containerRef.current) return;
      networkRef.current?.destroy();
      const nodes = new vis.DataSet(graph.nodes as never);
      const edges = new vis.DataSet(graph.edges as never);
      const network = new vis.Network(
        containerRef.current,
        { nodes, edges } as never,
        {
          layout: { improvedLayout: false },
          physics: {
            enabled: false,
            solver: 'barnesHut',
            barnesHut: { gravitationalConstant: -2000, centralGravity: 0.3, springLength: 150, springConstant: 0.04, damping: 0.09 },
            stabilization: false,
          },
          interaction: { hover: true, hideEdgesOnDrag: true, tooltipDelay: 120 },
        } as never
      );
      networkRef.current = network as never;
      nodesRef.current = nodes as never;
      edgesRef.current = edges as never;
      injected.current = { ports: false, vulns: false };

      network.on('click', (params: { nodes: string[] }) => {
        const id = params.nodes?.[0];
        if (!id || id === 'root') return;
        const host = data.hosts.find((h) => h.ip === id || `${h.ip}:` === id);
        const ip = host ? host.ip : id.split(':')[0];
        setTab('hosts');
        setQuery(ip);
        setOpenHosts((prev) => new Set(prev).add(ip));
      });

      // setState after `await` runs in a continuation, not the effect body.
      setShowPorts(false);
      setShowVulns(false);
      setPhysics(false);
      setBuiltFor(graph);
    })();
    return () => {
      cancelled = true;
      networkRef.current?.destroy();
      networkRef.current = null;
    };
  }, [graph, data.hosts]);

  // Theme changes only recolor node labels — no costly graph rebuild.
  useEffect(() => {
    if (building) return;
    networkRef.current?.setOptions({ nodes: { font: { color: isDark ? '#e2e8f0' : '#0f172a' } } });
  }, [isDark, building]);

  const focusNode = useCallback((id: string) => {
    const net = networkRef.current;
    if (!net) return;
    net.focus(id, { scale: 1.2, animation: { duration: 500, easingFunction: 'easeInOutQuad' } });
    net.selectNodes([id]);
  }, []);

  const togglePhysics = useCallback(() => {
    setPhysics((prev) => {
      const next = !prev;
      networkRef.current?.setOptions({ physics: next });
      return next;
    });
  }, []);

  const togglePorts = useCallback(() => {
    if (!nodesRef.current || !edgesRef.current) return;
    setShowPorts((prev) => {
      const next = !prev;
      if (next && !injected.current.ports) {
        nodesRef.current!.add(graph.lazyPortNodes as never);
        edgesRef.current!.add(graph.lazyPortEdges as never);
        injected.current.ports = true;
      } else if (injected.current.ports) {
        nodesRef.current!.update(graph.lazyPortNodes.map((n) => ({ id: n.id, hidden: !next })) as never);
      }
      return next;
    });
  }, [graph]);

  const toggleVulns = useCallback(() => {
    if (!nodesRef.current || !edgesRef.current) return;
    setShowVulns((prev) => {
      const next = !prev;
      if (next && !injected.current.vulns) {
        nodesRef.current!.add(graph.lazyVulnNodes as never);
        edgesRef.current!.add(graph.lazyVulnEdges as never);
        injected.current.vulns = true;
      } else if (injected.current.vulns) {
        nodesRef.current!.update(graph.lazyVulnNodes.map((n) => ({ id: n.id, hidden: !next })) as never);
      }
      return next;
    });
  }, [graph]);

  const q = query.trim().toLowerCase();

  const hostRows = useMemo(() => {
    const rows = data.hosts
      .filter((h) => !q || h.ip.toLowerCase().includes(q) || h.hostname.toLowerCase().includes(q))
      .map((h) => {
        const ipVulns = vulnsByHost.get(h.ip) ?? [];
        const nameVulns = h.hostname ? vulnsByHost.get(h.hostname) ?? [] : [];
        const all = [...ipVulns, ...nameVulns];
        const unique = new Map<string, NessusVuln>();
        for (const v of all) if (!unique.has(v.name)) unique.set(v.name, v);
        const list = Array.from(unique.values()).sort(
          (a, b) => RISK_WEIGHT[riskKey(b.risk)] - RISK_WEIGHT[riskKey(a.risk)]
        );
        let max: RiskKey = 'none';
        for (const v of all) {
          const k = riskKey(v.risk);
          if (RISK_WEIGHT[k] > RISK_WEIGHT[max]) max = k;
        }
        return { host: h, list, max, count: list.length };
      });
    return rows.slice(0, MAX_LIST_ITEMS);
  }, [data.hosts, vulnsByHost, q]);

  const vulnRows = useMemo(() => {
    const grouped = new Map<string, { vuln: NessusVuln; hosts: Set<string> }>();
    for (const v of data.vulnerabilities) {
      if (
        q &&
        !v.name.toLowerCase().includes(q) &&
        !v.host.toLowerCase().includes(q) &&
        !(v.cve && v.cve.toLowerCase().includes(q)) &&
        !(v.pluginId && v.pluginId.toLowerCase().includes(q))
      )
        continue;
      const g = grouped.get(v.name);
      const hostKey = v.host + (v.port && v.port !== 0 ? `:${v.port}` : '');
      if (g) g.hosts.add(hostKey);
      else grouped.set(v.name, { vuln: v, hosts: new Set([hostKey]) });
    }
    return Array.from(grouped.values())
      .sort((a, b) => RISK_WEIGHT[riskKey(b.vuln.risk)] - RISK_WEIGHT[riskKey(a.vuln.risk)])
      .slice(0, MAX_LIST_ITEMS);
  }, [data.vulnerabilities, q]);

  const toggleSet = (setter: typeof setOpenHosts, key: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_1fr] gap-0 overflow-hidden rounded-xl border border-border bg-card">
      {/* Sidebar */}
      <aside className="flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r border-border bg-muted/20">
        <div className="grid grid-cols-4 gap-2 p-3 border-b border-border/60">
          <Stat label="Hosts" value={stats.hosts} />
          <Stat label="Puertos" value={stats.ports} />
          <Stat label="Vulns" value={stats.vulns} accent="text-foreground" />
          <Stat label="Críticas" value={stats.crit} accent="text-red-500" />
        </div>

        <div className="flex border-b border-border/60 text-xs font-medium">
          <TabBtn active={tab === 'hosts'} onClick={() => setTab('hosts')}>
            Hosts
          </TabBtn>
          <TabBtn active={tab === 'vulns'} onClick={() => setTab('vulns')}>
            Vulnerabilidades
          </TabBtn>
        </div>

        <div className="p-3 border-b border-border/60">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar…"
              className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-xs outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 max-h-[62vh] lg:max-h-[min(72vh,820px)]">
          {tab === 'hosts'
            ? hostRows.map(({ host, list, max, count }) => {
                const open = openHosts.has(host.ip);
                return (
                  <div key={host.ip} className="mb-2 overflow-hidden rounded-lg border border-border bg-background">
                    <button
                      type="button"
                      onClick={() => {
                        toggleSet(setOpenHosts, host.ip);
                        focusNode(host.ip);
                      }}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold">
                          {host.ip}
                          {host.hostname ? <span className="text-muted-foreground"> ({host.hostname})</span> : null}
                        </span>
                        <span className="block truncate font-mono text-[11px] text-muted-foreground">
                          {host.os || 'OS desconocido'}
                        </span>
                      </span>
                      <Badge risk={max}>{count} vulns</Badge>
                    </button>
                    {open ? (
                      <div className="border-t border-border/60 bg-muted/20 p-3 text-xs">
                        {host.ports.length ? (
                          <div className="mb-2 flex flex-wrap gap-1">
                            {host.ports.map((p) => (
                              <span
                                key={`${p.port}/${p.protocol}`}
                                className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]"
                              >
                                {p.port}/{p.protocol} {p.service}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {list.length ? (
                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-500">
                              Hallazgos ({list.length})
                            </p>
                            {list.map((v) => {
                              const fk = `${host.ip}::${v.name}`;
                              const fopen = openVulns.has(fk);
                              return (
                                <div key={fk}>
                                  <button
                                    type="button"
                                    onClick={() => toggleSet(setOpenVulns, fk)}
                                    className="flex w-full items-start gap-2 rounded px-1 py-1 text-left hover:bg-muted/60"
                                  >
                                    <Badge risk={riskKey(v.risk)}>{v.risk || 'n/d'}</Badge>
                                    <span className="flex-1 leading-snug">{v.name}</span>
                                  </button>
                                  {fopen ? (
                                    <div className="ml-2 border-l-2 border-border pl-2 py-1 text-[11px] text-muted-foreground space-y-1">
                                      {v.description ? <p>{v.description}</p> : null}
                                      {v.solution ? (
                                        <p>
                                          <span className="font-semibold text-foreground">Solución: </span>
                                          {v.solution}
                                        </p>
                                      ) : null}
                                      {v.pluginOutput ? <Terminal>{v.pluginOutput}</Terminal> : null}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })
            : vulnRows.map(({ vuln, hosts }) => {
                const open = openVulns.has(`v::${vuln.name}`);
                const hostArr = Array.from(hosts);
                return (
                  <div key={vuln.name} className="mb-2 overflow-hidden rounded-lg border border-border bg-background">
                    <button
                      type="button"
                      onClick={() => toggleSet(setOpenVulns, `v::${vuln.name}`)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">{vuln.name}</span>
                        <span className="block font-mono text-[11px] text-muted-foreground">
                          {hostArr.length} host(s) afectado(s)
                        </span>
                      </span>
                      <Badge risk={riskKey(vuln.risk)}>
                        {vuln.risk}
                        {vuln.cvss ? ` ${vuln.cvss}` : ''}
                      </Badge>
                    </button>
                    {open ? (
                      <div className="border-t border-border/60 bg-muted/20 p-3 text-xs space-y-2">
                        <p>
                          <span className="font-semibold text-violet-500">Plugin / CVE: </span>
                          {vuln.pluginId || 'n/d'}
                          {vuln.cve ? ` | ${vuln.cve}` : ''}
                        </p>
                        {vuln.synopsis ? <p>{vuln.synopsis}</p> : null}
                        {vuln.description ? (
                          <p className="text-muted-foreground">{vuln.description}</p>
                        ) : null}
                        {vuln.solution ? (
                          <p>
                            <span className="font-semibold text-foreground">Solución: </span>
                            {vuln.solution}
                          </p>
                        ) : null}
                        {vuln.pluginOutput ? <Terminal>{vuln.pluginOutput}</Terminal> : null}
                        <div className="flex flex-wrap gap-1">
                          {hostArr.map((h) => (
                            <button
                              key={h}
                              type="button"
                              onClick={() => focusNode(h.split(':')[0])}
                              className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] hover:border-violet-500/60"
                            >
                              {h}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
          {(tab === 'hosts' ? hostRows.length : vulnRows.length) === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Sin resultados.</p>
          ) : null}
        </div>
      </aside>

      {/* Graph */}
      <div className="relative min-h-[420px] h-[62vh] lg:h-[min(78vh,880px)] bg-slate-100 dark:bg-slate-950">
        <div ref={containerRef} className="absolute inset-0" />
        {building ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/60 backdrop-blur-sm">
            <Loader2 className="size-6 animate-spin text-violet-500" />
            <span className="text-xs text-muted-foreground">Renderizando red de exposición…</span>
          </div>
        ) : null}

        <div className="pointer-events-auto absolute left-1/2 bottom-5 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card/90 px-2 py-1.5 shadow-lg backdrop-blur">
          <CtrlBtn active={showPorts} onClick={togglePorts} icon={<Radius className="size-3.5" />} label="Puertos" />
          <CtrlBtn active={showVulns} onClick={toggleVulns} icon={<ShieldAlert className="size-3.5" />} label="Vulns" />
          <CtrlBtn onClick={() => networkRef.current?.fit()} icon={<Crosshair className="size-3.5" />} label="Ajustar" />
          <CtrlBtn active={physics} onClick={togglePhysics} icon={<Magnet className="size-3.5" />} label="Física" />
        </div>

        <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-lg border border-border bg-card/85 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur">
          <NetworkIcon className="size-3.5 text-violet-500" />
          <span className="max-w-[40ch] truncate">{title}</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-md border border-border bg-background px-2 py-1.5 text-center">
      <span className={cn('block font-mono text-base font-bold leading-none', accent)}>
        {value.toLocaleString()}
      </span>
      <span className="mt-1 block text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 border-b-2 px-3 py-2.5 transition-colors',
        active
          ? 'border-violet-500 text-violet-600 dark:text-violet-300 bg-violet-500/5'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
      )}
    >
      {children}
    </button>
  );
}

function Badge({ risk, children }: { risk: RiskKey; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase',
        SEV_BADGE[risk]
      )}
    >
      {children}
    </span>
  );
}

function Terminal({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-slate-800 bg-slate-900 p-2 font-mono text-[10px] text-emerald-400">
      {children}
    </pre>
  );
}

function CtrlBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
        active ? 'bg-violet-600 text-white' : 'text-foreground hover:bg-muted'
      )}
    >
      {icon}
      {label}
    </button>
  );
}
