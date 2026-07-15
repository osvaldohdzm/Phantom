'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Map as MapIcon, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PHANTOM_NODE_PALETTE } from '@/lib/phantom-graph-theme';
import type { PentestMapNodeKind, PentestTargetMapDocument } from '@/lib/pentest-target-map-schema';

type NetworkLike = {
  getPositions: (ids?: string[]) => Record<string, { x: number; y: number }>;
  getScale: () => number;
  getViewPosition: () => { x: number; y: number };
  moveTo: (o: { position: { x: number; y: number }; scale?: number; animation?: boolean | object }) => void;
} | null;

type Props = {
  doc: PentestTargetMapDocument;
  networkRef: React.RefObject<NetworkLike | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  title: string;
  building?: boolean;
};

const W = 148;
const H = 96;
const PAD = 8;

export function MapMinimap({
  doc,
  networkRef,
  containerRef,
  collapsed,
  onToggleCollapsed,
  title,
  building,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const net = networkRef.current;
    const container = containerRef.current;
    if (!canvas || !net || !container || collapsed) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(6, 10, 16, 0.88)';
    ctx.fillRect(0, 0, W, H);

    const positions = net.getPositions();
    const ids = Object.keys(positions);
    if (!ids.length) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const id of ids) {
      const p = positions[id];
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    const spanX = Math.max(maxX - minX, 120);
    const spanY = Math.max(maxY - minY, 80);
    const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);

    const toMini = (p: { x: number; y: number }) => ({
      x: PAD + (p.x - minX) * scale,
      y: PAD + (p.y - minY) * scale,
    });

    const kindById = new Map(doc.nodes.map((n) => [n.id, n.kind]));

    for (const id of ids) {
      const p = toMini(positions[id]);
      const kind = kindById.get(id) ?? 'note';
      const color = PHANTOM_NODE_PALETTE[kind as PentestMapNodeKind]?.border ?? '#64748b';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    const view = net.getViewPosition();
    const zoom = net.getScale();
    const rect = container.getBoundingClientRect();
    const halfW = rect.width / 2 / zoom;
    const halfH = rect.height / 2 / zoom;

    const tl = toMini({ x: view.x - halfW, y: view.y - halfH });
    const br = toMini({ x: view.x + halfW, y: view.y + halfH });
    const vw = br.x - tl.x;
    const vh = br.y - tl.y;

    ctx.strokeStyle = 'rgba(34, 211, 238, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tl.x, tl.y, vw, vh);
    ctx.fillStyle = 'rgba(34, 211, 238, 0.08)';
    ctx.fillRect(tl.x, tl.y, vw, vh);
  }, [collapsed, containerRef, doc.nodes, networkRef]);

  useEffect(() => {
    if (collapsed || building) return;
    draw();
    const id = window.setInterval(draw, 280);
    return () => window.clearInterval(id);
  }, [collapsed, building, draw, doc.nodes.length]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const net = networkRef.current;
    const container = containerRef.current;
    if (!net || !container || collapsed) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const positions = net.getPositions();
    const ids = Object.keys(positions);
    if (!ids.length) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const id of ids) {
      const p = positions[id];
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const spanX = Math.max(maxX - minX, 120);
    const spanY = Math.max(maxY - minY, 80);
    const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);

    const canvasX = minX + (mx - PAD) / scale;
    const canvasY = minY + (my - PAD) / scale;

    net.moveTo({
      position: { x: canvasX, y: canvasY },
      animation: { duration: 350, easingFunction: 'easeInOutQuad' },
    });
  };

  return (
    <div className={cn('phantom-map-minimap pointer-events-auto', collapsed && 'phantom-map-minimap--collapsed')}>
      <button type="button" onClick={onToggleCollapsed} className="phantom-map-minimap-toggle" title={title}>
        {collapsed ? <MapIcon className="size-3.5" /> : <Minimize2 className="size-3" />}
        <span className="text-[9px] font-semibold uppercase tracking-wide">{title}</span>
      </button>
      {!collapsed ? (
        <canvas ref={canvasRef} width={W} height={H} className="phantom-map-minimap-canvas" onClick={handleClick} />
      ) : null}
    </div>
  );
}
