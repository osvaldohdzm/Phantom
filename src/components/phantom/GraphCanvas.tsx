/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, MouseEvent } from 'react';
import { PentestNode, NodeConnection, NodeClass, NodeState } from '@/components/phantom/types';
import { Copy, Plus, HelpCircle, AlertCircle, Share2, ZoomIn, ZoomOut, Maximize, Play, CheckCircle2, ShieldAlert, Cpu, Trash2, X, Network, Sparkles, Scaling, Download } from 'lucide-react';
import { WORKFLOW_TEMPLATES } from '@/components/phantom/data/templates';

const PHASES_METADATA = [
  { 
    title: '01. RECONOCIMIENTO', 
    subtitle: 'Recon & OSINT', 
    color: 'border-cyan-500/20 text-cyan-400 bg-[#0c1c24]/80', 
    lineColor: 'rgba(6,182,212,0.05)',
    iconColor: 'text-cyan-400'
  },
  { 
    title: '02. ENUMERACIÓN', 
    subtitle: 'Services & Web Survey', 
    color: 'border-emerald-500/20 text-emerald-400 bg-[#0a1e16]/80', 
    lineColor: 'rgba(16,185,129,0.05)',
    iconColor: 'text-emerald-400'
  },
  { 
    title: '03. ANÁLISIS VULNS', 
    subtitle: 'Vulnerability Assessment', 
    color: 'border-purple-500/20 text-purple-400 bg-[#161224]/80', 
    lineColor: 'rgba(168,85,247,0.05)',
    iconColor: 'text-purple-400'
  },
  { 
    title: '04. EXPLOTACIÓN', 
    subtitle: 'Weaponize & Access', 
    color: 'border-rose-500/20 text-rose-450 bg-[#250f14]/80', 
    lineColor: 'rgba(244,63,94,0.05)',
    iconColor: 'text-rose-400'
  },
  { 
    title: '05. MOVIMIENTO LATERAL', 
    subtitle: 'Pivoting & Active Directory', 
    color: 'border-amber-500/20 text-amber-500 bg-[#24170d]/80', 
    lineColor: 'rgba(245,158,11,0.05)',
    iconColor: 'text-amber-500'
  },
  { 
    title: '06. POST-EXPLOTACIÓN', 
    subtitle: 'Loot, Privilege Esc. & Persistence', 
    color: 'border-fuchsia-500/20 text-fuchsia-400 bg-[#230d24]/80', 
    lineColor: 'rgba(217,70,239,0.05)',
    iconColor: 'text-fuchsia-400'
  }
];

interface GraphCanvasProps {
  nodes: PentestNode[];
  connections: NodeConnection[];
  selectedNodeId: string | null;
  target: string;
  attackerIp: string;
  globalVars: Record<string, string>;
  onSelectNode: (id: string | null) => void;
  onUpdateNodes: (nodes: PentestNode[]) => void;
  onUpdateConnections: (connections: NodeConnection[]) => void;
  onLogMessage: (type: 'info' | 'success' | 'error' | 'command_copied' | 'state_change' | 'ai', msg: string) => void;
  onSpawnSuggestedNode: (parent: PentestNode, suggestion: any) => void;
  ruleSuggestions: Record<string, any[]>;
  onDeleteNode?: (id: string) => void;
  onDeleteConnection?: (id: string) => void;
  onReplaceGraph?: (nodes: PentestNode[], connections: NodeConnection[], name?: string) => void;
  onAutoAlign?: (mode: 'columns' | 'rows' | 'tree') => void;
}

export default function GraphCanvas({
  nodes,
  connections,
  selectedNodeId,
  target,
  attackerIp,
  globalVars,
  onSelectNode,
  onUpdateNodes,
  onUpdateConnections,
  onLogMessage,
  onSpawnSuggestedNode,
  ruleSuggestions,
  onDeleteNode,
  onDeleteConnection,
  onReplaceGraph,
  onAutoAlign
}: GraphCanvasProps) {
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [showAlignMenu, setShowAlignMenu] = useState<boolean>(false);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [layoutVisualMode, setLayoutVisualMode] = useState<'free' | 'horizontal' | 'vertical'>('free');

  // Selected Connection states
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [connectionClickPos, setConnectionClickPos] = useState<Record<string, { x: number; y: number }>>({});

  // Node connection state
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [connectingMousePos, setConnectingMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);

  // Global Keydown/Keyup events for Spacebar panning & escape drawer closing
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isTyping = document.activeElement && (
        document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.getAttribute('contenteditable') === 'true'
      );
      if (isTyping) return;

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsSpacePressed(true);
      }

      if (e.key === 'Escape' || e.code === 'Escape') {
        onSelectNode(null);
        setSelectedConnectionId(null);
        onLogMessage('info', 'De-selected active node or connection and collapsed detail drawer.');
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          onDeleteNode?.(selectedNodeId);
        } else if (selectedConnectionId) {
          onDeleteConnection?.(selectedConnectionId);
          setSelectedConnectionId(null);
        }
      }
    };

    const handleGlobalKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    const handleBlur = () => {
      setIsSpacePressed(false);
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('keyup', handleGlobalKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('keyup', handleGlobalKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [onSelectNode, onLogMessage, selectedNodeId, selectedConnectionId, nodes, connections, onDeleteNode, onDeleteConnection]);

  // Keyboard navigation & pan reset
  const handleResetZoom = () => {
    setZoom(1.0);
    setPan({ x: 50, y: 50 });
    onLogMessage('info', 'Canvas viewport zoom reset.');
  };

  // Dynamically calculate bounding box of all nodes and scale/pan to fit them safely
  const handleZoomToFit = () => {
    if (nodes.length === 0) {
      handleResetZoom();
      return;
    }

    if (!canvasRef.current) return;

    const width = canvasRef.current.clientWidth || 800;
    const height = canvasRef.current.clientHeight || 600;

    // Standard card boundary estimations during auto layout fit
    const cardWidth = 300;
    const cardHeight = 200;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    nodes.forEach(node => {
      const x = node.position.x;
      const y = node.position.y;
      if (x < minX) minX = x;
      if (x + cardWidth > maxX) maxX = x + cardWidth;
      if (y < minY) minY = y;
      if (y + cardHeight > maxY) maxY = y + cardHeight;
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    const padding = 100; // Generous boundary safety margin
    const availableWidth = Math.max(200, width - padding * 2);
    const availableHeight = Math.max(200, height - padding * 2);

    const zoomX = availableWidth / contentWidth;
    const zoomY = availableHeight / contentHeight;
    let targetZoom = Math.min(zoomX, zoomY);

    // Limit zoom-to-fit factor ranges for high-fidelity legibility
    targetZoom = Math.min(Math.max(targetZoom, 0.25), 1.25);

    const centerX = minX + contentWidth / 2;
    const centerY = minY + contentHeight / 2;

    const viewportCenterX = width / 2;
    const viewportCenterY = height / 2;

    const targetPanX = viewportCenterX - centerX * targetZoom;
    const targetPanY = viewportCenterY - centerY * targetZoom;

    setZoom(targetZoom);
    setPan({ x: targetPanX, y: targetPanY });
    onLogMessage('info', `Zoom-to-Fit completed: Scaled workspace viewport dynamically to ${Math.round(targetZoom * 100)}% and centered current active graph.`);
  };

  const handleDownloadDiagram = (format: 'svg' | 'png') => {
    // 1. Find bounding box of diagram nodes
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach(node => {
      // Calculate dynamic card height to match layout
      const descLen = node.description ? node.description.length : 0;
      const cmdLen = node.commandTemplate ? node.commandTemplate.length : 0;
      const tagsLen = node.tags ? node.tags.length : 0;
      let nh = 110;
      if (descLen > 0) nh += Math.min(60, Math.ceil(descLen / 36) * 14);
      if (cmdLen > 0) nh += 28;
      if (tagsLen > 0) nh += 24;
      nh = Math.max(130, nh);

      if (node.position.x < minX) minX = node.position.x;
      if (node.position.y < minY) minY = node.position.y;
      if (node.position.x + 240 > maxX) maxX = node.position.x + 240;
      if (node.position.y + nh > maxY) maxY = node.position.y + nh;
    });

    if (nodes.length === 0) {
      minX = 0;
      minY = 0;
      maxX = 800;
      maxY = 600;
    }

    // Add padding to bounding box
    const padding = 60;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const width = maxX - minX;
    const height = maxY - minY;

    // 2. Escape HTML utilities
    const escapeHtml = (unsafe: string): string => {
      if (!unsafe) return '';
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    // 3. Render connections, swimlanes, and nodes as string elements
    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}">`;
    
    // Add nice style imports and fonts
    svgContent += `
      <defs>
        <style>
          <![CDATA[
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
          .text-sans { font-family: 'Inter', sans-serif; }
          .text-mono { font-family: 'JetBrains Mono', monospace; }
          ]]>
        </style>
        <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.6"/>
        </filter>
      </defs>
      
      <!-- Dark canvas background fill -->
      <rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#0A0B0E" />
    `;

    // Draw swimlanes if active
    if (layoutVisualMode !== 'free') {
      if (layoutVisualMode === 'horizontal') {
        PHASES_METADATA.forEach((phase, idx) => {
          const startX = 40 + idx * 340;
          svgContent += `
            <!-- Swimlane ${idx} ${escapeHtml(phase.title)} -->
            <rect x="${startX}" y="${minY + 20}" width="340" height="${height - 40}" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1" stroke-dasharray="4 4" />
            <g transform="translate(${startX + 16}, ${minY + 30})">
              <rect width="308" height="42" rx="6" fill="#0d1f22" stroke="rgba(6,182,212,0.15)" stroke-width="1" />
              <text x="12" y="18" fill="#22d3ee" font-family="'Inter', sans-serif" font-weight="700" font-size="9" letter-spacing="1">${escapeHtml(phase.title)}</text>
              <text x="12" y="32" fill="#64748b" font-family="'Inter', sans-serif" font-size="8">${escapeHtml(phase.subtitle)}</text>
            </g>
          `;
        });
      } else if (layoutVisualMode === 'vertical') {
        PHASES_METADATA.forEach((phase, idx) => {
          const startY = 60 + idx * 380;
          svgContent += `
            <!-- Swimlane ${idx} ${escapeHtml(phase.title)} -->
            <rect x="${minX + 20}" y="${startY}" width="${width - 40}" height="380" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1" stroke-dasharray="4 4" />
            <g transform="translate(${minX + 30}, ${startY + 20})">
              <rect width="208" height="42" rx="6" fill="#0d1b22" stroke="rgba(6,182,212,0.15)" stroke-width="1" />
              <text x="12" y="18" fill="#22d3ee" font-family="'Inter', sans-serif" font-weight="700" font-size="9" letter-spacing="1">${escapeHtml(phase.title)}</text>
              <text x="12" y="32" fill="#64748b" font-family="'Inter', sans-serif" font-size="8">${escapeHtml(phase.subtitle)}</text>
            </g>
          `;
        });
      }
    }

    // Connective elements
    connections.forEach(conn => {
      const source = nodes.find(n => n.id === conn.sourceNodeId);
      const target = nodes.find(n => n.id === conn.targetNodeId);
      if (!source || !target) return;

      const sx = source.position.x + 246;
      const sy = source.position.y + 60;
      const tx = target.position.x - 3;
      const ty = target.position.y + 68;
      const dx = Math.abs(tx - sx) * 0.55;
      const pathString = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;

      let strokeColor = '#3f3f46';
      if (source.state === 'success') {
        strokeColor = '#10b981';
      } else if (source.state === 'running') {
        strokeColor = '#3b82f6';
      }

      svgContent += `<path d="${pathString}" fill="none" stroke="${strokeColor}" stroke-width="2" opacity="0.8" />`;
    });

    // Nodes
    nodes.forEach(node => {
      const nx = node.position.x;
      const ny = node.position.y;
      const nw = 240;

      const descLen = node.description ? node.description.length : 0;
      const cmdLen = node.commandTemplate ? node.commandTemplate.length : 0;
      const tagsLen = node.tags ? node.tags.length : 0;
      let nh = 110;
      if (descLen > 0) nh += Math.min(60, Math.ceil(descLen / 36) * 14);
      if (cmdLen > 0) nh += 28;
      if (tagsLen > 0) nh += 24;
      nh = Math.max(130, nh);

      let strokeColor = '#27272a';
      if (node.state === 'success') strokeColor = '#10b981';
      else if (node.state === 'running') strokeColor = '#3b82f6';
      else if (node.state === 'failed') strokeColor = '#f43f5e';

      svgContent += `
        <!-- Node card -->
        <g transform="translate(${nx}, ${ny})" filter="url(#shadow)">
          <rect width="${nw}" height="${nh}" rx="12" fill="#0f1118" stroke="${strokeColor}" stroke-width="1.5" />
          <path d="M 1 12 A 11 11 0 0 1 12 1 h 216 a 11 11 0 0 1 11 11 v 25 H 1 Z" fill="#131620" />
          <line x1="1" y1="36" x2="239" y2="36" stroke="#090a0c" stroke-width="1" />
      `;

      let iconBgColor = '#27272a';
      let iconFgColor = '#a1a1aa';
      switch (node.type) {
        case 'discovery': iconBgColor = 'rgba(6,182,212,0.1)'; iconFgColor = '#22d3ee'; break;
        case 'web': iconBgColor = 'rgba(16,185,129,0.1)'; iconFgColor = '#34d399'; break;
        case 'ad': iconBgColor = 'rgba(245,158,11,0.1)'; iconFgColor = '#fbbf24'; break;
        case 'exploitation': iconBgColor = 'rgba(244,63,94,0.1)'; iconFgColor = '#f43f5e'; break;
        case 'post-exploitation': iconBgColor = 'rgba(217,70,239,0.1)'; iconFgColor = '#e879f9'; break;
      }

      svgContent += `
          <rect x="10" y="8" width="20" height="20" rx="4" fill="${iconBgColor}" />
          <rect x="14" y="12" width="12" height="12" rx="2" fill="none" stroke="${iconFgColor}" stroke-width="1.2" />
          <text x="36" y="21" fill="#f4f4f5" font-family="'Inter', sans-serif" font-weight="600" font-size="9.5" text-anchor="start">${escapeHtml(node.title)}</text>
      `;

      let badgeText = node.state.toUpperCase();
      let badgeBg = '#1c1c1e';
      let badgeFg = '#8e8e93';
      if (node.state === 'success') {
        badgeText = 'PWND';
        badgeBg = '#052e16';
        badgeFg = '#4ade80';
      } else if (node.state === 'running') {
        badgeBg = '#172554';
        badgeFg = '#60a5fa';
      } else if (node.state === 'failed') {
        badgeBg = '#4c0519';
        badgeFg = '#fb7185';
      }

      const badgeWidth = badgeText.length * 5 + 8;
      svgContent += `
          <rect x="${230 - badgeWidth}" y="10" width="${badgeWidth}" height="14" rx="3" fill="${badgeBg}" />
          <text x="${230 - badgeWidth / 2}" y="20.5" fill="${badgeFg}" font-family="'JetBrains Mono', monospace" font-weight="700" font-size="7" text-anchor="middle">${badgeText}</text>
      `;

      const escapedDesc = escapeHtml(node.description || 'No custom details specified.');
      const words = escapedDesc.split(' ');
      let line = '';
      const linesList: string[] = [];
      words.forEach(word => {
        if ((line + word).length > 38) {
          linesList.push(line);
          line = word + ' ';
        } else {
          line += word + ' ';
        }
      });
      if (line) linesList.push(line);

      const displayLines = linesList.slice(0, 2);
      displayLines.forEach((l, lIdx) => {
        svgContent += `
          <text x="12" y="${55 + lIdx * 12}" fill="#a1a1aa" font-family="'Inter', sans-serif" font-size="8.5" text-anchor="start">${l.trim()}</text>
        `;
      });

      const cmdY = 82;
      const cmdText = getCommandPreview(node);
      const truncatedCmd = cmdText.length > 34 ? cmdText.slice(0, 31) + '...' : cmdText;

      svgContent += `
          <rect x="12" y="${cmdY}" width="216" height="20" rx="4" fill="#090a0c" stroke="#18181b" stroke-width="1" />
          <text x="18" y="${cmdY + 12.5}" fill="#38bdf8" font-family="'JetBrains Mono', monospace" font-size="7.5" text-anchor="start">${escapeHtml(truncatedCmd)}</text>
      `;

      if (node.tags.length > 0) {
        const tagY = cmdY + 28;
        let tagXOffset = 12;
        node.tags.slice(0, 3).forEach((tag) => {
          const displayTag = `#${tag}`;
          const tagW = displayTag.length * 5.2 + 8;
          svgContent += `
            <rect x="${tagXOffset}" y="${tagY}" width="${tagW}" height="12" rx="2" fill="#18181b" />
            <text x="${tagXOffset + tagW / 2}" y="${tagY + 9}" fill="#71717a" font-family="'JetBrains Mono', monospace" font-size="7" text-anchor="middle">${escapeHtml(displayTag)}</text>
          `;
          tagXOffset += tagW + 4;
        });
      }

      if (node.evidenceProduced.open_ports && node.evidenceProduced.open_ports.length > 0) {
        const portsY = cmdY + 44;
        const portsStr = `PORTS: ${node.evidenceProduced.open_ports.join(', ')}`;
        const displayPorts = portsStr.length > 34 ? portsStr.slice(0, 31) + '...' : portsStr;
        svgContent += `
          <rect x="12" y="${portsY}" width="216" height="12" rx="2" fill="rgba(16,185,129,0.05)" stroke="rgba(16,185,129,0.2)" stroke-width="0.8" />
          <text x="18" y="${portsY + 9}" fill="#34d399" font-family="'JetBrains Mono', monospace" font-weight="600" font-size="7" text-anchor="start">${escapeHtml(displayPorts)}</text>
        `;
      }

      svgContent += `</g>`;
    });

    svgContent += `</svg>`;

    // 4. Download based on requested format
    try {
      if (format === 'svg') {
        const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `diagrama_pentest_${Date.now()}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        onLogMessage('success', 'Diagrama exportado y descargado exitosamente como SVG vectorial.');
      } else if (format === 'png') {
        const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          // Create high-res dynamic canvas to rasterize
          const canvas = document.createElement('canvas');
          // Scale for higher resolution
          const pixelRatio = window.devicePixelRatio || 2;
          canvas.width = width * pixelRatio;
          canvas.height = height * pixelRatio;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.scale(pixelRatio, pixelRatio);
            ctx.fillStyle = '#0A0B0E';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            
            try {
              const pngUrl = canvas.toDataURL('image/png');
              const link = document.createElement('a');
              link.href = pngUrl;
              link.download = `diagrama_pentest_${Date.now()}.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              onLogMessage('success', 'Diagrama rasterizado y descargado exitosamente como PNG de alta resolución.');
            } catch (err) {
              console.error('PNG data url conversion error:', err);
              // Fallback to SVG download if security or browser error blocks dataUrl conversion
              onLogMessage('info', 'La exportación PNG directa falló debido a políticas de seguridad del navegador. Descargando SVG en su lugar.');
              handleDownloadDiagram('svg');
            }
          }
          URL.revokeObjectURL(url);
        };
        img.onerror = () => {
          onLogMessage('error', 'Error al procesar la rasterización de la imagen del diagrama.');
          URL.revokeObjectURL(url);
        };
        img.src = url;
      }
    } catch (e: any) {
      onLogMessage('error', `Error al exportar diagrama: ${e?.message || e}`);
    }
  };

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey || true) { // Always zoom on wheel for rapid whiteboard feel
      e.preventDefault();
      const zoomFactor = 1.05;
      const nextZoom = e.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
      // Clamp zoom between 0.4 and 2.0
      setZoom(Math.min(Math.max(nextZoom, 0.35), 2.1));
    }
  };

  // Convert client coordinate into relative canvas coordinate (essential for connecting mouse lines)
  const getRelativePosition = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom
    };
  };

  // Mouse Down: Node dragging or Grid panning
  const handleMouseDown = (e: MouseEvent) => {
    setShowAlignMenu(false);

    if (isSpacePressed) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
      return;
    }

    // Left-click on canvas grid: initiate pan
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-grid')) {
      setSelectedConnectionId(null);
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
    }
  };

  // Mouse Move: Node dragging or Grid Panning
  const handleMouseMove = (e: MouseEvent) => {
    if (draggingNodeId) {
      const updatedNodes = nodes.map(n => {
        if (n.id === draggingNodeId) {
          // Adjust position delta divided by zoom level for precision dragging
          const relPos = getRelativePosition(e.clientX, e.clientY);
          // Clamp dragging coordinate values to avoid negative overflow
          const finalX = Math.round(relPos.x - dragOffset.x);
          const finalY = Math.round(relPos.y - dragOffset.y);
          return {
            ...n,
            position: { x: finalX, y: finalY }
          };
        }
        return n;
      });
      onUpdateNodes(updatedNodes);
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    } else if (connectingSourceId) {
      const relPos = getRelativePosition(e.clientX, e.clientY);
      setConnectingMousePos(relPos);
    }
  };

  // Mouse Up: terminate pans and drags
  const handleMouseUp = (e: MouseEvent) => {
    if (draggingNodeId) {
      setDraggingNodeId(null);
    }
    if (isPanning) {
      setIsPanning(false);
    }
    if (connectingSourceId) {
      // Check if mouse is released over any valid target node card (except self)
      const targetCard = (e.target as HTMLElement).closest('.node-card');
      if (targetCard) {
        const targetId = targetCard.getAttribute('data-node-id');
        if (targetId && targetId !== connectingSourceId) {
          // Add connection if not already existing
          const alreadyExists = connections.some(c => c.sourceNodeId === connectingSourceId && c.targetNodeId === targetId);
          if (!alreadyExists) {
            const newConn: NodeConnection = {
              id: `conn-${Date.now()}`,
              sourceNodeId: connectingSourceId,
              targetNodeId: targetId,
              type: 'default'
            };
            onUpdateConnections([...connections, newConn]);
            onLogMessage('success', `Created tactical workflow path between ${connectingSourceId} ➜ ${targetId}`);
          }
        }
      }
      setConnectingSourceId(null);
    }
  };

  // Trigger Node Dragging
  const startDragNode = (e: MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (isSpacePressed) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
      return;
    }

    onSelectNode(nodeId);
    
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      const rel = getRelativePosition(e.clientX, e.clientY);
      setDragOffset({
        x: rel.x - node.position.x,
        y: rel.y - node.position.y
      });
      setDraggingNodeId(nodeId);
    }
  };

  // Trigger Node connecting anchor dot click
  const startConnection = (e: MouseEvent, nodeId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    // Anchor connection dot is situated roughly at right edge of node template card
    // We initiate drawing line from right edge of node card: (x + 240, y + 60)
    setConnectingSourceId(nodeId);
    setConnectingMousePos({ x: node.position.x + 240, y: node.position.y + 60 });
  };

      // Render SVG connection lines connecting node anchors with curved beziers
  const renderConnections = () => {
    return connections.map(conn => {
      const source = nodes.find(n => n.id === conn.sourceNodeId);
      const target = nodes.find(n => n.id === conn.targetNodeId);
      if (!source || !target) return null;

      // Anchor offsets calculations (Source output: right side, Target input: left side)
      const sx = source.position.x + 246;
      const sy = source.position.y + 60;
      const tx = target.position.x - 3;
      const ty = target.position.y + 68;

      // Calculate path curve dynamics
      const dx = Math.abs(tx - sx) * 0.55;
      const pathString = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;

      const baseColorClass = source.state === 'success' 
        ? 'stroke-emerald-500/60 drop-shadow-[0_0_2px_rgba(16,185,129,0.4)]' 
        : source.state === 'running' 
          ? 'stroke-blue-500/50 stroke-dash'
          : 'stroke-zinc-700/65';

      const isConnSelected = selectedConnectionId === conn.id;
      
      // Accurate Bezier midpoint at t = 0.5 for absolute visual symmetry
      const mx = 0.125 * sx + 0.375 * (sx + dx) + 0.375 * (tx - dx) + 0.125 * tx;
      const my = 0.125 * sy + 0.375 * sy + 0.375 * ty + 0.125 * ty;
      const clickPos = connectionClickPos[conn.id] || { x: mx, y: my };

      return (
        <g key={conn.id} className="group cursor-pointer pointer-events-auto" style={{ pointerEvents: 'auto' }}>
          <title>{`Remove connection path: ${source.tool} ➜ ${target.tool}`}</title>
          
          {/* Main Visual Bezier Connector */}
          <path
            d={pathString}
            fill="none"
            style={{ pointerEvents: 'auto' }}
            className={isConnSelected 
              ? 'stroke-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)] stroke-[3.5px] transition-all duration-300' 
              : `${baseColorClass} group-hover:stroke-zinc-300 group-hover:stroke-[2.5px] transition-all duration-300`
            }
            strokeWidth={isConnSelected || selectedNodeId === conn.sourceNodeId || selectedNodeId === conn.targetNodeId ? 3.5 : 2}
          />

          {/* Transparent Thicker Hitbox Line for easier interactive clicks */}
          <path
            d={pathString}
            fill="none"
            stroke="transparent"
            strokeWidth={18}
            style={{ pointerEvents: 'auto' }}
            className="cursor-pointer"
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const relPos = getRelativePosition(e.clientX, e.clientY);
              setSelectedConnectionId(conn.id);
              setConnectionClickPos(prev => ({ ...prev, [conn.id]: relPos }));
              onSelectNode(null); // Focus purely on the selected connector
              onLogMessage('info', `Selected connection path: ${source.tool} ➜ ${target.tool}. Click the Red X button appearing directly next to your cursor, or press Backspace/Delete to remove it.`);
            }}
          />

          {/* Interactive Midpoint Delete Badge with embedded "X" mark */}
          <g 
            className={`${isConnSelected ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto pointer-events-none'} transition-all duration-200 cursor-pointer`} 
            style={{ pointerEvents: isConnSelected ? 'auto' : 'none' }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDeleteConnection?.(conn.id);
              setSelectedConnectionId(null);
            }}
          >
            <circle
              cx={clickPos.x}
              cy={clickPos.y}
              r={14}
              className="fill-[#090A0C] stroke-rose-500 stroke-[2] shadow-[0_0_12px_rgba(244,63,94,0.4)] hover:fill-rose-500 hover:stroke-white hover:scale-115 active:scale-95 transition-all duration-150"
            />
            {/* Visual X Graphic inside badge */}
            <path
              d={`M ${clickPos.x - 4} ${clickPos.y - 4} L ${clickPos.x + 4} ${clickPos.y + 4} M ${clickPos.x + 4} ${clickPos.y - 4} L ${clickPos.x - 4} ${clickPos.y + 4}`}
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="text-[#F43F5E] hover:text-white transition-colors duration-150 pointer-events-none"
            />
          </g>
        </g>
      );
    });
  };

  const handleSpawnSuggested = (nodeId: string, suggestion: any) => {
    const parent = nodes.find(n => n.id === nodeId);
    if (parent) {
      onSpawnSuggestedNode(parent, suggestion);
    }
  };

  const handleDuplicateNode = (node: PentestNode) => {
    const newId = `node-dup-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const duplicatedNode: PentestNode = {
      ...JSON.parse(JSON.stringify(node)),
      id: newId,
      position: {
        x: node.position.x + 40,
        y: node.position.y + 40
      }
    };
    onUpdateNodes([...nodes, duplicatedNode]);
    onSelectNode(newId);
    onLogMessage('success', `Nodo "${node.title}" duplicado correctamente (clon individual sin relaciones creado).`);
  };

  const getNodeStateStyle = (state: NodeState) => {
    switch (state) {
      case 'running': return 'border-blue-500 shadow-[0_0_12px_rgba(37,99,235,0.25)] ring-1 ring-blue-500';
      case 'success': return 'border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500/30';
      case 'failed': return 'border-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]';
      case 'discarded': return 'opacity-55 scale-95 border-zinc-800';
      default: return 'border-zinc-800 hover:border-zinc-700 hover:shadow-[0_0_8px_rgba(255,255,255,0.03)]';
    }
  };

  const getHeaderIconBg = (type: NodeClass) => {
    switch (type) {
      case 'discovery': return 'bg-cyan-500/10 text-cyan-400';
      case 'web': return 'bg-emerald-500/10 text-emerald-400';
      case 'ad': return 'bg-amber-500/10 text-amber-400';
      case 'exploitation': return 'bg-rose-500/10 text-rose-400';
      case 'post-exploitation': return 'bg-fuchsia-500/10 text-fuchsia-400';
      default: return 'bg-zinc-800 text-zinc-400';
    }
  };

  // Convert dynamic string command variables reactively
  const getCommandPreview = (node: PentestNode): string => {
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

    // Replace from least specific to most specific
    const combined = { ...defaults, ...globalVars, ...node.customParams };
    
    // Sort keys by length descending to prevent partial replacements (e.g. '$PORT_KNOCK' before '$PORT')
    const keys = Object.keys(combined).sort((a, b) => b.length - a.length);
    keys.forEach(key => {
      cmd = cmd.replaceAll(key, combined[key]);
    });

    if (cmd.length > 34) {
      return cmd.slice(0, 31) + '...';
    }
    return cmd;
  };

  return (
    <div
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      className={`relative flex-1 overflow-hidden h-full bg-[#0A0B0E] select-none ${
        isSpacePressed 
          ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') 
          : (isPanning ? 'cursor-grabbing' : 'cursor-grab')
      }`}
      style={{ touchAction: 'none' }}
    >
      {/* Visual background grid - Dotted Sophisticated style */}
      <div
        className="canvas-grid absolute inset-0 pointer-events-none transition duration-75"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, 0.04) 1px, transparent 1px)',
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`
        }}
      />

      {/* High-Fidelity Active Canvas Empty State Handler */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#090A0C]/90 backdrop-blur-md p-6">
          <div className="max-w-md w-full bg-[#0F1116] border border-white/10 rounded-xl p-8 shadow-2xl text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full animate-pulse">
                <Network className="h-8 w-8" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-sans font-bold text-base text-zinc-100 tracking-tight uppercase">Active Workspace Empty</h3>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto">
                All whiteboard nodes have been cleared or deleted. Instantly reinitialize your campaign flow from prebuilt templates:
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5 text-left">
              {WORKFLOW_TEMPLATES.map((tpl, idx) => (
                <button
                  key={idx}
                  id={`empty-restore-btn-${idx}`}
                  onClick={() => {
                    if (onReplaceGraph) {
                      onReplaceGraph(tpl.nodes, tpl.connections);
                      onLogMessage('success', `Initialized workspace layout template: "${tpl.name}". Fully restored.`);
                    }
                  }}
                  className="p-3 bg-white/[0.02] hover:bg-emerald-500/10 hover:border-emerald-500/30 rounded-lg border border-white/5 transition flex items-center justify-between cursor-pointer group"
                >
                  <div className="space-y-0.5 pr-3 overflow-hidden">
                    <div className="text-xs font-sans font-bold text-zinc-200 group-hover:text-emerald-450 transition truncate">
                      {tpl.name}
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate">
                      {tpl.description}
                    </div>
                  </div>
                  <span className="text-[9px] font-mono font-semibold uppercase bg-emerald-950/50 border border-emerald-900/40 text-emerald-400 py-1 px-2.5 rounded shrink-0">
                    LOAD
                  </span>
                </button>
              ))}
            </div>

            <div className="pt-3 border-t border-white/5 text-[10px] text-zinc-500 select-none leading-snug">
              Alternatively, customize variables or spawn individual action nodes using the control panel located inside the left sidebar.
            </div>
          </div>
        </div>
      )}

      {/* Floating Canvas Viewport & Layout Controller */}
      <div className="absolute left-6 top-6 z-20 flex flex-wrap gap-2 items-center bg-[#0F1116]/95 border border-white/10 p-1.5 rounded-lg shadow-2xl">
        <div className="flex bg-black/40 border border-white/5 rounded p-0.5 space-x-0.5">
          <button
            onClick={() => setZoom(prev => Math.min(prev + 0.1, 2.0))}
            className="p-1 px-1.5 rounded text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
            title="Aumentar Zoom"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setZoom(prev => Math.max(prev - 0.1, 0.4))}
            className="p-1 px-1.5 rounded text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
            title="Reducir Zoom"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-1 px-1.5 rounded text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
            title="Restaurar Vista"
          >
            <Maximize className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleZoomToFit}
            className="p-1 px-1.5 rounded text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
            title="Aproximar todo el mapa"
          >
            <Scaling className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="w-[1px] h-5 bg-white/10 self-center mx-0.5" />

        <span className="text-[10px] font-mono text-slate-500 self-center px-1 select-none">
          {Math.round(zoom * 100)}%
        </span>

        <div className="w-[1px] h-5 bg-white/10 self-center mx-0.5" />

        {/* Dynamic Swimlane Visor selector */}
        <div className="flex bg-black/45 border border-white/5 rounded p-0.5 space-x-1 items-center">
          <span className="text-[8px] font-mono font-bold text-slate-500 uppercase px-1.5 leading-none select-none">LÍNEAS:</span>
          {(['free', 'horizontal', 'vertical'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => {
                setLayoutVisualMode(mode);
                if (onAutoAlign) {
                  if (mode === 'horizontal') {
                    onAutoAlign('columns');
                    setTimeout(() => handleZoomToFit(), 100);
                  } else if (mode === 'vertical') {
                    onAutoAlign('rows');
                    setTimeout(() => handleZoomToFit(), 100);
                  }
                }
                onLogMessage('info', `Fase de visualización cambiada a: ${mode === 'free' ? 'Libre' : mode === 'horizontal' ? 'Columnas Secuenciales' : 'Filas Jerárquicas'}`);
              }}
              className={`px-1.5 py-0.5 text-[8px] font-mono tracking-tighter uppercase rounded transition cursor-pointer border ${
                layoutVisualMode === mode 
                  ? 'bg-purple-650/15 text-purple-400 border-purple-500/35 font-bold shadow-[0_0_8px_rgba(168,85,247,0.15)]' 
                  : 'text-slate-500 hover:text-slate-350 border-transparent'
              }`}
            >
              {mode === 'free' ? 'Off' : mode === 'horizontal' ? 'Col' : 'Row'}
            </button>
          ))}
        </div>

        {onAutoAlign && (
          <>
            <div className="w-[1px] h-5 bg-white/10 self-center mx-0.5" />
            <div className="relative">
              <button
                onClick={() => setShowAlignMenu(prev => !prev)}
                className="px-2 py-1 bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/30 text-purple-300 hover:text-white text-[9.5px] font-mono font-bold uppercase rounded transition cursor-pointer flex items-center space-x-1.5 shadow-[0_1px_8px_rgba(0,0,0,0.3)]"
                title="Ajustar y alinear nodos jerárquicamente"
              >
                <Sparkles className="h-3 w-3 text-purple-400 animate-pulse shrink-0" />
                <span>Auto-Ajustar</span>
                <span className="text-[8px] font-mono opacity-60">▼</span>
              </button>

              {showAlignMenu && (
                <div className="absolute top-8 left-0 w-72 bg-[#0d0f15]/98 border border-white/10 rounded-lg shadow-2xl z-50 p-2.5 space-y-1.5 my-1 divide-y divide-white/5 animate-fade-in backdrop-blur-md">
                  <div className="pb-1">
                    <div className="text-[8px] font-mono text-purple-400 uppercase font-black tracking-widest px-1">
                      ORGANIZADOR AUTOMÁTICO
                    </div>
                    <div className="text-[9px] text-slate-500 font-sans px-1 mt-0.5 leading-snug">
                      Alineación automática de la infraestructura y ataques
                    </div>
                  </div>
                  
                  <div className="space-y-1 pt-1.5">
                    <button
                      onClick={() => {
                        setLayoutVisualMode('horizontal');
                        onAutoAlign('columns');
                        setShowAlignMenu(false);
                        setTimeout(() => handleZoomToFit(), 100);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-purple-600/10 text-xs font-sans text-slate-200 hover:text-white flex flex-col cursor-pointer transition"
                    >
                      <span className="font-bold flex items-center gap-1.5 text-purple-300">
                        📋 Fases en Columnas (Horizontal)
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5 leading-normal">
                        Fases secuenciadas de izquierda a derecha. Estilo tablero ágil transparente.
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        setLayoutVisualMode('vertical');
                        onAutoAlign('rows');
                        setShowAlignMenu(false);
                        setTimeout(() => handleZoomToFit(), 100);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-blue-600/10 text-xs font-sans text-slate-200 hover:text-white flex flex-col cursor-pointer transition"
                    >
                      <span className="font-bold flex items-center gap-1.5 text-blue-400">
                        📖 Fases en Filas (Vertical)
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5 leading-normal">
                        Organiza el progreso de arriba a abajo. Fomenta un esquema descendente tradicional.
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        setLayoutVisualMode('free');
                        onAutoAlign('tree');
                        setShowAlignMenu(false);
                        setTimeout(() => handleZoomToFit(), 100);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-emerald-600/10 text-xs font-sans text-slate-200 hover:text-white flex flex-col cursor-pointer transition"
                    >
                      <span className="font-bold flex items-center gap-1.5 text-emerald-400">
                        🌿 Árbol de Pivote (Jerarquía)
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5 leading-normal">
                        Secuencia lógica basada estrictamente en dependencias de red y vector inicial.
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Export / Download Diagram Button */}
        <div className="w-[1px] h-5 bg-white/10 self-center mx-0.5" />
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(prev => !prev)}
            className="px-2 py-1 bg-emerald-600/15 hover:bg-emerald-650/25 border border-emerald-500/30 text-emerald-300 hover:text-white text-[9.5px] font-mono font-bold uppercase rounded transition cursor-pointer flex items-center space-x-1.5 shadow-[0_1px_8px_rgba(0,0,0,0.3)]"
            title="Exportar y descargar diagrama táctico"
          >
            <Download className="h-3 w-3 text-emerald-400 shrink-0" />
            <span>Exportar</span>
            <span className="text-[8px] font-mono opacity-60">▼</span>
          </button>

          {showExportMenu && (
            <div className="absolute top-8 right-0 w-56 bg-[#0d0f15]/98 border border-white/10 rounded-lg shadow-2xl z-50 p-2 space-y-1 my-1 backdrop-blur-md">
              <div className="px-1.5 py-1">
                <div className="text-[8px] font-mono text-emerald-400 uppercase font-black tracking-widest leading-none">
                  DESCARGAR IMAGEN
                </div>
                <div className="text-[9px] text-slate-500 font-sans mt-0.5 leading-snug">
                  Exportación de alta fidelidad con márgenes incluidos
                </div>
              </div>
              
              <div className="space-y-0.5 pt-1">
                <button
                  onClick={() => {
                    handleDownloadDiagram('png');
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-emerald-650/15 text-xs font-sans text-slate-200 hover:text-white flex items-center gap-2 cursor-pointer transition"
                >
                  <span className="text-emerald-400 font-mono text-[10px] font-bold w-10 border border-emerald-500/30 rounded text-center py-0.5 bg-emerald-950/25">PNG</span>
                  <div className="flex flex-col select-none">
                    <span className="font-bold text-slate-200">Formato Raster</span>
                    <span className="text-[8.5px] text-slate-400 leading-none">Útil para reportes rápidos</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    handleDownloadDiagram('svg');
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-purple-650/15 text-xs font-sans text-slate-200 hover:text-white flex items-center gap-2 cursor-pointer transition"
                >
                  <span className="text-purple-400 font-mono text-[10px] font-bold w-10 border border-purple-500/30 rounded text-center py-0.5 bg-purple-950/25">SVG</span>
                  <div className="flex flex-col select-none">
                    <span className="font-bold text-slate-200">Vector Escalable</span>
                    <span className="text-[8.5px] text-slate-400 leading-none">Nítido y compatible CAD</span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Spacing coordinates dashboard label */}
      <div className="absolute right-6 top-6 z-20 py-1.5 px-3 rounded-md bg-black/40 border border-white/10 font-mono text-[9px] text-slate-500 select-none pointer-events-none">
        X: {Math.round(pan.x)} / Y: {Math.round(pan.y)}
      </div>

      {/* Main coordinate-transformed viewport element */}
      <div
        className="absolute inset-0 origin-top-left pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
        }}
      >
        <div className="relative w-full h-full pointer-events-auto">

          {/* Phase Swimlanes Background Visualization Layer */}
          {layoutVisualMode !== 'free' && (
            <div className="absolute inset-0 pointer-events-none select-none z-0">
              {layoutVisualMode === 'horizontal' ? (
                <>
                  {PHASES_METADATA.map((phase, idx) => {
                    const startX = 40 + idx * 340;
                    return (
                      <div 
                        key={idx}
                        className="absolute h-[3000px] border-l border-dashed flex flex-col group/lane transition duration-300 animate-fade-in"
                        style={{ 
                          left: `${startX}px`, 
                          width: '340px',
                          borderColor: 'rgba(255, 255, 255, 0.05)'
                        }}
                      >
                        {/* Lane Header */}
                        <div className={`mx-4 mt-4 p-2 rounded-lg border text-left flex flex-col backdrop-blur-md ${phase.color} shadow-lg transition duration-200`}>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-[9px] font-bold tracking-wider leading-none uppercase">
                              {phase.title}
                            </span>
                          </div>
                          <span className="text-[7.5px] font-mono text-slate-500 mt-0.5 whitespace-nowrap">
                            {phase.subtitle}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {/* Right boundary line */}
                  <div 
                    className="absolute h-[3000px] border-l border-dashed"
                    style={{ left: `${40 + 6 * 340}px`, borderColor: 'rgba(255, 255, 255, 0.05)' }}
                  />
                </>
              ) : (
                <>
                  {PHASES_METADATA.map((phase, idx) => {
                    const startY = 60 + idx * 380;
                    return (
                      <div 
                        key={idx}
                        className="absolute w-[4000px] border-t border-dashed flex items-start group/lane transition duration-300 animate-fade-in"
                        style={{ 
                          top: `${startY}px`, 
                          height: '380px',
                          borderColor: 'rgba(255, 255, 255, 0.05)'
                        }}
                      >
                        {/* Lane Header positioned at the left side of Row */}
                        <div className={`ml-4 mt-4 p-2 rounded-lg border text-left flex flex-col backdrop-blur-md w-52 shrink-0 ${phase.color} shadow-lg shadow-black/40`}>
                          <span className="font-mono text-[9px] font-bold tracking-wider leading-none uppercase">
                            {phase.title}
                          </span>
                          <span className="text-[7.5px] font-mono text-slate-500 mt-0.5">
                            {phase.subtitle}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {/* Bottom boundary line */}
                  <div 
                    className="absolute w-[4000px] border-t border-dashed"
                    style={{ top: `${60 + 6 * 380}px`, borderColor: 'rgba(255, 255, 255, 0.05)' }}
                  />
                </>
              )}
            </div>
          )}

          {/* Connective SVG Render layer */}
          <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none z-0">
            {renderConnections()}

            {/* If in interactive link drawing mode, draw live pointer guideline */}
            {connectingSourceId && (() => {
              const srcNode = nodes.find(n => n.id === connectingSourceId);
              if (!srcNode) return null;
              const sx = srcNode.position.x + 246;
              const sy = srcNode.position.y + 60;
              const tx = connectingMousePos.x;
              const ty = connectingMousePos.y;
              const dx = Math.abs(tx - sx) * 0.4;
              return (
                <path
                  d={`M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`}
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  className="animate-[dash_10s_linear_infinite]"
                />
              );
            })()}
          </svg>

          {/* Draggable Active Nodes List */}
          {nodes.map(node => {
            const hasSuggestions = ruleSuggestions[node.id] && ruleSuggestions[node.id].length > 0;
            const isSelected = selectedNodeId === node.id;

            return (
              <div
                key={node.id}
                data-node-id={node.id}
                className={`node-card absolute w-60 rounded-xl bg-[#0f1118]/95 border text-zinc-100 flex flex-col shadow-2xl transition-all duration-200 shrink-0 z-10 hover:shadow-[0_8px_24px_rgba(0,0,0,0.5)] select-none ${
                  isSpacePressed ? (isPanning ? 'cursor-grabbing pointer-events-none' : 'cursor-grab') : 'cursor-default'
                }`}
                style={{
                  left: `${node.position.x}px`,
                  top: `${node.position.y}px`,
                  transform: isSelected ? 'scale(1.02)' : 'none'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isSpacePressed) return;
                  onSelectNode(node.id);
                }}
              >
                {/* Node Top Header Handle */}
                <div
                  onMouseDown={(e) => startDragNode(e, node.id)}
                  className={`px-3 py-2.5 rounded-t-xl bg-[#131620] border-b border-zinc-900 flex items-center justify-between transition-all duration-150 ${getNodeStateStyle(node.state)} ${
                    isSpacePressed ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-grab active:cursor-grabbing'
                  }`}
                >
                  <div className="flex items-center space-x-2 overflow-hidden">
                    <div className={`p-1 rounded ${getHeaderIconBg(node.type)} shrink-0`}>
                      <Cpu className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-sans font-medium text-xs truncate max-w-36 text-zinc-100 uppercase tracking-wide">
                      {node.title}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    {/* Tiny State Quick-Pill */}
                    <span className={`text-[8px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded ${
                      node.state === 'success' 
                        ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' 
                        : node.state === 'running'
                          ? 'bg-blue-950/40 text-blue-400 border border-blue-900/40 animate-pulse'
                          : 'bg-zinc-900 text-zinc-500'
                    }`}>
                      {node.state === 'success' ? 'PWND' : node.state}
                    </span>

                    {/* Duplicate Action button */}
                    <button
                      id={`btn-card-duplicate-${node.id}`}
                      title={`Duplicar Nodo "${node.title}" (Clonar sin relaciones)`}
                      onMouseDown={(e) => {
                        e.stopPropagation(); // Avoid triggering node dragging
                      }}
                      onClick={(e) => {
                        e.stopPropagation(); // Avoid selecting node card
                        handleDuplicateNode(node);
                      }}
                      className="p-1 rounded text-zinc-500 hover:text-emerald-450 hover:bg-emerald-950/25 hover:scale-105 active:scale-90 transition cursor-pointer flex items-center justify-center shrink-0 pointer-events-auto"
                    >
                      <Copy className="h-3 w-3" />
                    </button>

                    {/* Trash Delete button on the card */}
                    <button
                      id={`btn-card-delete-${node.id}`}
                      title={`Remove Node "${node.title}"`}
                      onMouseDown={(e) => {
                        e.stopPropagation(); // Avoid triggering node dragging
                      }}
                      onClick={(e) => {
                        e.stopPropagation(); // Avoid selecting node card
                        onDeleteNode?.(node.id);
                      }}
                      className="p-1 rounded text-zinc-500 hover:text-rose-450 hover:bg-rose-950/30 hover:scale-105 active:scale-95 transition cursor-pointer flex items-center justify-center shrink-0 pointer-events-auto"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Node Description Details */}
                <div className="p-3 flex flex-col flex-1 space-y-2 text-left">
                  <p className="text-[10px] text-zinc-400 font-sans leading-relaxed min-h-6 line-clamp-2">
                    {node.description || 'No custom details specified for this action.'}
                  </p>

                  {/* Command preview pill */}
                  <div className="py-1 px-1.5 rounded bg-zinc-950 border border-zinc-900 font-mono text-[9px] text-sky-400 flex items-center justify-between select-text group">
                    <span className="truncate flex-1" title={getCommandPreview(node)}>{getCommandPreview(node)}</span>
                  </div>

                  {/* Tags indicators */}
                  {node.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {node.tags.slice(0, 3).map((tg, idx) => (
                        <span key={idx} className="text-[8px] font-mono bg-zinc-900 text-zinc-500 px-1 rounded">
                          #{tg}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Discovered dynamic hints (open ports) inside the node */}
                  {node.evidenceProduced.open_ports && node.evidenceProduced.open_ports.length > 0 && (
                    <div className="mt-1 flex items-center space-x-1.5 bg-emerald-950/10 border border-emerald-900/30 py-0.5 px-1.5 rounded">
                      <span className="text-[8px] font-mono font-bold text-emerald-400 uppercase">PORTS:</span>
                      <span className="text-[8px] font-mono text-emerald-300 font-semibold truncate">
                        {node.evidenceProduced.open_ports.join(', ')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Suggested inferences block (If Rule match active, clicking suggestions spawns successor nodes dynamically) */}
                {hasSuggestions && (
                  <div className="px-3 pb-2 pt-1 border-t border-zinc-900 bg-zinc-950/20">
                    <div className="flex items-center space-x-1 text-[9px] font-mono text-purple-400 mb-1">
                      <Cpu className="h-3 w-3 animate-pulse" />
                      <span className="font-semibold uppercase tracking-wider">AI Inference Link</span>
                    </div>
                    <div className="flex flex-col gap-1.5 mt-1">
                      {ruleSuggestions[node.id].map((sug, idx) => (
                        <button
                          id={`btn-spawn-suggestion-${node.id}-${idx}`}
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSpawnSuggested(node.id, sug);
                          }}
                          className="w-full py-1 px-2 text-left bg-purple-950/15 border border-purple-900/20 hover:border-purple-600/50 rounded text-[9px] font-mono text-purple-300 hover:text-purple-200 transition flex items-center justify-between cursor-pointer group"
                        >
                          <span className="truncate">➜ Launch {sug.suggestNode.tool}</span>
                          <Plus className="h-3 w-3 text-purple-400 group-hover:scale-125 transition" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Successor connector Anchor dot */}
                <div
                  onMouseDown={(e) => startConnection(e, node.id)}
                  className="absolute -right-1 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#10B981] border-2 border-[#0A0B0E] shadow-[0_0_8px_rgba(16,185,129,0.8)] hover:scale-130 transition cursor-crosshair flex items-center justify-center pointer-events-auto"
                  title="Drag path link to pivot target node"
                >
                  <span className="w-1 h-1 rounded-full bg-white select-none pointer-events-none" />
                </div>

                {/* Predecessor receiver indicator (Left side anchor - acts as visual helper) */}
                <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-zinc-800 border-2 border-[#0A0B0E] select-none pointer-events-none" />
              </div>
            );
          })}

        </div>
      </div>

      {/* Minimap Overlay - Sophisticated design */}
      <div className="absolute bottom-6 right-6 w-32 h-24 bg-[#0F1116]/95 border border-white/10 rounded-lg overflow-hidden p-1.5 shadow-2xl z-20">
        <span className="absolute top-1 left-2 text-[7px] font-mono tracking-widest text-[#10B981] font-bold uppercase select-none pointer-events-none">MINIMAP</span>
        <div className="w-full h-full relative opacity-85 pt-3">
          {nodes.map((n) => {
            // Map typical canvas coordinates into 4px to 110px and 12px to 80px range
            const miniX = Math.max(4, Math.min(112, 56 + (n.position.x / 14)));
            const miniY = Math.max(12, Math.min(80, 42 + (n.position.y / 14)));
            let stateClass = 'bg-slate-500';
            if (n.state === 'success') stateClass = 'bg-emerald-500';
            else if (n.state === 'running') stateClass = 'bg-blue-500 animate-pulse';
            else if (n.state === 'failed') stateClass = 'bg-rose-500';
            
            return (
              <div 
                key={n.id} 
                className={`absolute w-1.5 h-1.5 rounded-full ${stateClass} shadow-[0_0_4px_currentColor]`}
                style={{ top: `${miniY}px`, left: `${miniX}px` }}
                title={n.tool}
              />
            );
          })}
          <div className="absolute inset-0 border border-white/5 pointer-events-none rounded" />
        </div>
      </div>

    </div>
  );
}
