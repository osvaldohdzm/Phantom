/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Search,
  Download,
  GitBranch,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { POLNode, Methodology, NodeKind } from './types';
import { KIND_COLORS, STATUS_SYMBOLS } from './types';

interface MarkmapMindmapViewProps {
  methodology: Methodology;
  nodes: POLNode[];
  activeNodeId: string | null;
  onSelectNode: (id: string | null) => void;
}

interface RenderNode {
  node: POLNode;
  x: number;
  y: number;
  children: RenderNode[];
  width: number;
  height: number;
}

export function MarkmapMindmapView({
  methodology,
  nodes,
  activeNodeId,
  onSelectNode,
}: MarkmapMindmapViewProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 150 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Build hierarchical layout tree coordinates
  const layoutTree = useMemo(() => {
    const childrenMap = new Map<string | null, POLNode[]>();
    for (const node of nodes) {
      const pid = node.parentId;
      if (!childrenMap.has(pid)) {
        childrenMap.set(pid, []);
      }
      childrenMap.get(pid)!.push(node);
    }

    let currentY = 0;
    const nodeYSpacing = 56;
    const levelXSpacing = 270;

    const buildTree = (node: POLNode, depth: number): RenderNode => {
      const children = (childrenMap.get(node.id) || []).map((child) => buildTree(child, depth + 1));

      let y = currentY;
      if (children.length > 0) {
        y = (children[0].y + children[children.length - 1].y) / 2;
      } else {
        currentY += nodeYSpacing;
      }

      return {
        node,
        x: depth * levelXSpacing,
        y,
        children,
        width: 230,
        height: 42,
      };
    };

    const roots = childrenMap.get(null) || (nodes.length > 0 ? [nodes[0]] : []);
    return roots.map((root) => buildTree(root, 0));
  }, [nodes]);

  // Flatten layout tree into nodes and SVG curve connections
  const { flatNodes, connections } = useMemo(() => {
    const flat: RenderNode[] = [];
    const conns: { id: string; x1: number; y1: number; x2: number; y2: number; color: string }[] = [];

    const traverse = (item: RenderNode) => {
      flat.push(item);
      for (const child of item.children) {
        conns.push({
          id: `${item.node.id}-${child.node.id}`,
          x1: item.x + item.width,
          y1: item.y + item.height / 2,
          x2: child.x,
          y2: child.y + child.height / 2,
          color: child.node.kind === 'phase' ? '#8b5cf6' : child.node.kind === 'service' ? '#06b6d4' : child.node.kind === 'check' ? '#10b981' : '#f59e0b',
        });
        traverse(child);
      }
    };

    layoutTree.forEach(traverse);

    return { flatNodes: flat, connections: conns };
  }, [layoutTree]);

  // Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 40, y: 150 });
  };

  // Export full standalone SVG file
  const handleDownloadSvg = () => {
    let maxX = 800;
    let maxY = 600;
    flatNodes.forEach((n) => {
      if (n.x + n.width + 100 > maxX) maxX = n.x + n.width + 100;
      if (n.y + n.height + 100 > maxY) maxY = n.y + n.height + 100;
    });

    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${maxX} ${maxY}" width="${maxX}" height="${maxY}" style="background-color: #09090b; font-family: monospace;">\n`;
    
    // Add connections
    connections.forEach((c) => {
      const deltaX = (c.x2 - c.x1) / 2;
      svgContent += `  <path d="M ${c.x1} ${c.y1} C ${c.x1 + deltaX} ${c.y1}, ${c.x2 - deltaX} ${c.y2}, ${c.x2} ${c.y2}" fill="none" stroke="${c.color}" stroke-width="2" stroke-opacity="0.8" />\n`;
    });

    // Add nodes
    flatNodes.forEach(({ node, x, y, width, height }) => {
      const color = node.kind === 'phase' ? '#8b5cf6' : node.kind === 'service' ? '#06b6d4' : node.kind === 'check' ? '#10b981' : '#f59e0b';
      const cleanTitle = node.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      
      svgContent += `  <g transform="translate(${x}, ${y})">\n`;
      svgContent += `    <rect width="${width}" height="${height}" rx="8" fill="#18181b" stroke="${color}" stroke-width="1.5" />\n`;
      svgContent += `    <text x="12" y="24" fill="#f4f4f5" font-size="11" font-weight="bold">${cleanTitle.substring(0, 24)}</text>\n`;
      svgContent += `  </g>\n`;
    });

    svgContent += `</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${methodology.code.toLowerCase()}_mindmap.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={cn(
        'w-full flex-1 flex flex-col overflow-hidden border border-border/50 rounded-2xl bg-card shadow-lg relative select-none',
        isFullscreen && 'fixed inset-0 z-50 rounded-none border-none'
      )}
    >
      {/* Top Floating Controls Overlay */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Search within Mindmap */}
        <div className="pointer-events-auto bg-card/90 backdrop-blur-md border border-border/60 rounded-xl p-1.5 flex items-center gap-2 shadow-lg">
          <Search className="size-3.5 text-muted-foreground ml-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar en mapa mental..."
            className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none w-48"
          />
        </div>

        {/* Zoom, Canvas Controls & Download SVG */}
        <div className="pointer-events-auto bg-card/90 backdrop-blur-md border border-border/60 rounded-xl p-1.5 flex items-center gap-1.5 shadow-lg">
          {/* Download SVG Button */}
          <button
            onClick={handleDownloadSvg}
            className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all hover:scale-[1.02]"
            title="Descargar diagrama completo como archivo .SVG"
          >
            <Download className="size-3.5" />
            <span>Descargar SVG</span>
          </button>

          <div className="h-4 w-px bg-border/60 my-auto mx-0.5" />

          <button
            onClick={() => setZoom((z) => Math.min(z + 0.15, 2.5))}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Zoom In"
          >
            <ZoomIn className="size-4" />
          </button>
          <span className="text-[11px] font-mono font-semibold px-2 text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.15, 0.3))}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Zoom Out"
          >
            <ZoomOut className="size-4" />
          </button>

          <div className="h-4 w-px bg-border/60 my-auto mx-0.5" />

          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Centrar Vista"
          >
            <RotateCcw className="size-4" />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Pantalla Completa"
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        </div>
      </div>

      {/* Mindmap Interactive Canvas Container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="flex-1 w-full h-full cursor-grab active:cursor-grabbing bg-radial from-violet-500/5 via-transparent to-transparent relative overflow-hidden"
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
          className="absolute inset-0 pointer-events-none"
        >
          {/* SVG Connection Curves */}
          <svg ref={svgRef} className="absolute inset-0 w-[4000px] h-[4000px] overflow-visible pointer-events-none">
            {connections.map((conn) => {
              const deltaX = (conn.x2 - conn.x1) / 2;
              const pathD = `M ${conn.x1} ${conn.y1} C ${conn.x1 + deltaX} ${conn.y1}, ${conn.x2 - deltaX} ${conn.y2}, ${conn.x2} ${conn.y2}`;

              return (
                <path
                  key={conn.id}
                  d={pathD}
                  fill="none"
                  stroke={conn.color}
                  strokeWidth="2"
                  strokeOpacity="0.75"
                  strokeDasharray={conn.id.includes('command') ? '4 4' : 'none'}
                />
              );
            })}
          </svg>

          {/* Render Interactive Mind Map Nodes */}
          {flatNodes.map(({ node, x, y, width, height }) => {
            const isActive = node.id === activeNodeId;
            const isMatch =
              searchQuery.trim() && node.title.toLowerCase().includes(searchQuery.toLowerCase());
            const statusInfo = STATUS_SYMBOLS[node.status];
            const kindStyle = KIND_COLORS[node.kind];

            return (
              <div
                key={node.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectNode(node.id);
                }}
                style={{
                  left: `${x}px`,
                  top: `${y}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                }}
                className={cn(
                  'absolute pointer-events-auto rounded-xl border p-2 flex items-center justify-between gap-2 shadow-md cursor-pointer transition-all duration-150 backdrop-blur-md',
                  kindStyle.bg,
                  kindStyle.border,
                  isActive && 'ring-2 ring-violet-500 border-violet-500 scale-[1.03] z-30 shadow-violet-500/20',
                  isMatch && 'ring-2 ring-amber-400 border-amber-400 animate-pulse',
                  !isActive && !isMatch && 'hover:scale-[1.02] hover:border-violet-500/50'
                )}
              >
                {/* Status Indicator */}
                <span className={cn('font-mono font-bold text-xs shrink-0', statusInfo.color)}>
                  {statusInfo.symbol}
                </span>

                {/* Node Title */}
                <span className="flex-1 font-mono text-[11px] font-semibold truncate text-foreground leading-tight">
                  {node.title}
                </span>

                {/* Node Kind Tag */}
                <span className={cn('text-[9px] font-mono px-1.5 py-0.2 rounded uppercase font-bold shrink-0', kindStyle.text)}>
                  {node.kind}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
