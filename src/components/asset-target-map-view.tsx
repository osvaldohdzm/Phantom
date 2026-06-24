'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Loader2, Magnet, Network as NetworkIcon, Radius, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme-provider';
import type { AssetTargetMapData } from '@/lib/asset-target-map';
import { useUiT } from '@/lib/use-ui-locale';

type GraphNode = {
  id: string;
  label?: string;
  title?: string;
  shape: string;
  size: number;
  x?: number;
  y?: number;
  fixed?: boolean;
  hidden?: boolean;
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

const HOST_EDGE = 'rgba(100,116,139,0.28)';
const PORT_EDGE = 'rgba(20,184,166,0.5)';
const HOST_RADIUS = 520;

function buildGraph(data: AssetTargetMapData, rootLabel: string) {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const portNodes: GraphNode[] = [];
  const portEdges: GraphEdge[] = [];

  nodes.push({
    id: 'root',
    label: rootLabel,
    shape: 'hexagon',
    size: 38,
    x: 0,
    y: 0,
    fixed: true,
    color: { background: '#0891b2', border: '#0e7490' },
    font: { color: '#ffffff', size: 14 },
  });

  const hosts = data.hosts;
  if (!hosts.length) return { nodes, edges, portNodes, portEdges };

  const step = (2 * Math.PI) / hosts.length;
  hosts.forEach((host, i) => {
    const angle = i * step;
    const r = HOST_RADIUS + (i % 2 === 0 ? 20 : -20);
    const hx = r * Math.cos(angle);
    const hy = r * Math.sin(angle);
    const hasPorts = host.ports.length > 0;

    nodes.push({
      id: host.key,
      label: host.ip,
      title: host.hostname || host.ip,
      shape: 'dot',
      size: hasPorts ? 22 : 14,
      x: hx,
      y: hy,
      fixed: true,
      borderWidth: hasPorts ? 2 : 1,
      color: {
        background: hasPorts ? '#0ea5e9' : '#64748b',
        border: hasPorts ? '#0284c7' : '#475569',
        highlight: { background: '#38bdf8', border: '#ffffff' },
      },
      font: { size: 12, face: 'JetBrains Mono, monospace' },
    });
    edges.push({ from: 'root', to: host.key, color: { color: HOST_EDGE } });

    for (const p of host.ports) {
      const portId = `${host.key}:${p.port}`;
      const svc = p.service ? ` · ${p.service}` : '';
      portNodes.push({
        id: portId,
        group: 'port',
        label: String(p.port),
        title: `${p.port}${p.protocol ? `/${p.protocol}` : ''}${svc}`,
        shape: 'diamond',
        size: 10,
        color: { background: '#2dd4bf', border: '#0d9488' },
        font: { size: 10 },
      });
      portEdges.push({ from: host.key, to: portId, length: 55, color: { color: PORT_EDGE } });
    }
  });

  return { nodes, edges, portNodes, portEdges };
}

type Props = {
  data: AssetTargetMapData;
  title: string;
};

export function AssetTargetMapView({ data, title }: Props) {
  const { t } = useUiT();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<{
    destroy: () => void;
    focus: (id: string, o?: unknown) => void;
    selectNodes: (ids: string[]) => void;
    fit: () => void;
    setOptions: (o: unknown) => void;
  } | null>(null);
  const nodesRef = useRef<{ add: (n: unknown) => void; update: (n: unknown) => void } | null>(null);
  const edgesRef = useRef<{ add: (e: unknown) => void } | null>(null);
  const portsInjected = useRef(false);

  const [query, setQuery] = useState('');
  const [openHosts, setOpenHosts] = useState<Set<string>>(new Set());
  const [physics, setPhysics] = useState(false);
  const [showPorts, setShowPorts] = useState(true);
  const [builtKey, setBuiltKey] = useState('');
  const dataKey = useMemo(
    () => `${data.hosts.length}:${data.hosts.map((h) => `${h.key}=${h.ports.length}`).join(',')}`,
    [data]
  );

  const rootLabel = t('assetsMapRootLabel');
  const graph = useMemo(() => buildGraph(data, rootLabel), [data, rootLabel]);
  const building = builtKey !== dataKey;

  const stats = useMemo(() => {
    let ports = 0;
    for (const h of data.hosts) ports += h.ports.length;
    return { hosts: data.hosts.length, ports };
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const vis = await import('vis-network/standalone');
      if (cancelled || !containerRef.current) return;
      networkRef.current?.destroy();

      const allNodes = [...graph.nodes, ...(showPorts ? graph.portNodes : [])];
      const allEdges = [...graph.edges, ...(showPorts ? graph.portEdges : [])];
      const nodes = new vis.DataSet(allNodes as never);
      const edges = new vis.DataSet(allEdges as never);
      const network = new vis.Network(
        containerRef.current,
        { nodes, edges } as never,
        {
          layout: { improvedLayout: false },
          physics: {
            enabled: false,
            solver: 'barnesHut',
            barnesHut: {
              gravitationalConstant: -2000,
              centralGravity: 0.3,
              springLength: 140,
              springConstant: 0.04,
              damping: 0.09,
            },
            stabilization: false,
          },
          interaction: { hover: true, hideEdgesOnDrag: true, tooltipDelay: 120 },
        } as never
      );

      networkRef.current = network as never;
      nodesRef.current = nodes as never;
      edgesRef.current = edges as never;
      portsInjected.current = showPorts;
      setBuiltKey(dataKey);
    })();
    return () => {
      cancelled = true;
      networkRef.current?.destroy();
      networkRef.current = null;
    };
  }, [graph, showPorts, dataKey]);

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

  const togglePorts = useCallback(() => {
    if (!nodesRef.current || !edgesRef.current) return;
    setShowPorts((prev) => {
      const next = !prev;
      if (next && !portsInjected.current) {
        nodesRef.current!.add(graph.portNodes as never);
        edgesRef.current!.add(graph.portEdges as never);
        portsInjected.current = true;
      } else if (portsInjected.current) {
        nodesRef.current!.update(
          graph.portNodes.map((n) => ({ id: n.id, hidden: !next })) as never
        );
      }
      return next;
    });
  }, [graph]);

  const togglePhysics = useCallback(() => {
    setPhysics((prev) => {
      const next = !prev;
      networkRef.current?.setOptions({ physics: { enabled: next } });
      return next;
    });
  }, []);

  const q = query.trim().toLowerCase();
  const hostRows = useMemo(
    () =>
      data.hosts
        .filter(
          (h) =>
            !q ||
            h.ip.toLowerCase().includes(q) ||
            h.hostname.toLowerCase().includes(q) ||
            h.ports.some((p) => String(p.port).includes(q) || (p.service ?? '').toLowerCase().includes(q))
        )
        .slice(0, 500),
    [data.hosts, q]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_1fr] gap-0 overflow-hidden rounded-xl border border-border bg-card">
      <aside className="flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r border-border bg-muted/20">
        <div className="grid grid-cols-2 gap-2 p-3 border-b border-border/60">
          <Stat label={t('assetsMapHosts')} value={stats.hosts} />
          <Stat label={t('assetsMapPorts')} value={stats.ports} accent="text-cyan-600 dark:text-cyan-400" />
        </div>

        <div className="p-3 border-b border-border/60">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('assetsMapFilterPlaceholder')}
              className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-xs outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 max-h-[62vh] lg:max-h-[min(72vh,820px)]">
          {hostRows.map((host) => {
            const open = openHosts.has(host.key);
            return (
              <div key={host.key} className="mb-2 overflow-hidden rounded-lg border border-border bg-background">
                <button
                  type="button"
                  onClick={() => {
                    setOpenHosts((prev) => {
                      const next = new Set(prev);
                      if (next.has(host.key)) next.delete(host.key);
                      else next.add(host.key);
                      return next;
                    });
                    focusNode(host.key);
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold font-mono">{host.ip}</span>
                    {host.hostname ? (
                      <span className="block truncate text-[11px] text-muted-foreground">{host.hostname}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] tabular-nums">
                    {host.ports.length}
                  </span>
                </button>
                {open && host.ports.length ? (
                  <div className="border-t border-border/60 bg-muted/20 p-3">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-600 dark:text-cyan-400">
                      {t('assetsMapPorts')}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {host.ports.map((p) => (
                        <button
                          key={p.port}
                          type="button"
                          onClick={() => focusNode(`${host.key}:${p.port}`)}
                          className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] hover:border-cyan-500/60"
                          title={p.service}
                        >
                          {p.port}
                          {p.protocol ? `/${p.protocol}` : ''}
                          {p.service ? ` ${p.service}` : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
          {hostRows.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">{t('assetsTargetMapEmpty')}</p>
          ) : null}
        </div>
      </aside>

      <div className="relative min-h-[420px] h-[62vh] lg:h-[min(78vh,880px)] bg-slate-100 dark:bg-slate-950">
        <div ref={containerRef} className="absolute inset-0" />
        {building ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/60 backdrop-blur-sm">
            <Loader2 className="size-6 animate-spin text-cyan-500" />
            <span className="text-xs text-muted-foreground">{t('assetsTargetMapBuilding')}</span>
          </div>
        ) : null}

        <div className="pointer-events-auto absolute left-1/2 bottom-5 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card/90 px-2 py-1.5 shadow-lg backdrop-blur">
          <CtrlBtn
            active={showPorts}
            onClick={togglePorts}
            icon={<Radius className="size-3.5" />}
            label={t('assetsMapTogglePorts')}
          />
          <CtrlBtn
            onClick={() => networkRef.current?.fit()}
            icon={<Crosshair className="size-3.5" />}
            label={t('assetsMapFit')}
          />
          <CtrlBtn
            active={physics}
            onClick={togglePhysics}
            icon={<Magnet className="size-3.5" />}
            label={t('assetsMapPhysics')}
          />
        </div>

        <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-lg border border-border bg-card/85 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur">
          <NetworkIcon className="size-3.5 text-cyan-500" />
          <span className="max-w-[40ch] truncate">{title}</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-md border border-border bg-background px-2 py-1.5 text-center">
      <span className={cn('block font-mono text-base font-bold leading-none', accent)}>{value.toLocaleString()}</span>
      <span className="mt-1 block text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
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
      title={label}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors',
        active ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300' : 'text-muted-foreground hover:bg-muted'
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
