"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Arrow, Circle, Text, Line, Transformer, Group } from 'react-konva';
import * as htmlToImage from 'html-to-image';
import { 
  Copy, 
  Download, 
  Trash2, 
  Image as ImageIcon,
  Check,
  AlertCircle,
  ArrowRight,
  Highlighter,
  Type,
  Square,
  Circle as CircleIcon,
  MousePointer2,
  Minus,
  Hash,
  EyeOff,
  Palette
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// --- Types ---

type Tool = 'select' | 'arrow' | 'rect' | 'circle' | 'text' | 'pen' | 'counter' | 'blur' | 'highlight';

interface CanvasElement {
  id: string;
  type: 'image' | 'arrow' | 'rect' | 'circle' | 'text' | 'pen' | 'counter' | 'blur';
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  src?: string; // For images
  text?: string; // For text/counter
  points?: number[]; // For pen
  color?: string;
  strokeWidth?: number;
  opacity?: number;
  zIndex: number;
}

// --- Main Component ---

export function HackerCanvas() {
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState('#06b6d4'); // cyan-500
  const [counter, setCounter] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  
  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);

  // --- Handlers ---

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (!blob) continue;

        const reader = new FileReader();
        reader.onload = (event) => {
          const src = event.target?.result as string;
          const img = new Image();
          img.onload = () => {
            let w = img.width;
            let h = img.height;
            const maxInitial = 500;
            if (w > maxInitial || h > maxInitial) {
              const ratio = Math.min(maxInitial / w, maxInitial / h);
              w *= ratio;
              h *= ratio;
            }

            const newId = `img-${Date.now()}`;
            const newElement: CanvasElement = {
              id: newId,
              type: 'image',
              src,
              x: 100,
              y: 100,
              width: w,
              height: h,
              zIndex: elements.length,
            };
            setElements(prev => [...prev, newElement]);
            setSelectedId(newId);
          };
          img.src = src;
        };
        reader.readAsDataURL(blob);
      }
    }
  }, [elements.length]);

  useEffect(() => {
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const [isDrawing, setIsDrawing] = useState(false);

  const handleStageMouseDown = (e: any) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();

    if (tool === 'select') {
      const clickedOnEmpty = e.target === stage;
      if (clickedOnEmpty) {
        setSelectedId(null);
      }
      return;
    }

    setIsDrawing(true);
    const id = `el-${Date.now()}`;
    let newElement: CanvasElement;

    switch (tool) {
      case 'arrow':
        newElement = { id, type: 'arrow', x: pos.x, y: pos.y, points: [0, 0, 0, 0], color, strokeWidth: 4, zIndex: elements.length };
        break;
      case 'rect':
        newElement = { id, type: 'rect', x: pos.x, y: pos.y, width: 0, height: 0, color, strokeWidth: 2, zIndex: elements.length };
        break;
      case 'circle':
        newElement = { id, type: 'circle', x: pos.x, y: pos.y, width: 0, height: 0, color, strokeWidth: 2, zIndex: elements.length };
        break;
      case 'blur':
        newElement = { id, type: 'blur', x: pos.x, y: pos.y, width: 0, height: 0, zIndex: elements.length };
        break;
      case 'text':
        newElement = { id, type: 'text', x: pos.x, y: pos.y, text: 'TEXTO', color, zIndex: elements.length };
        setIsDrawing(false);
        setTool('select');
        break;
      case 'counter':
        newElement = { id, type: 'counter', x: pos.x, y: pos.y, text: String(counter), color, zIndex: elements.length };
        setCounter(prev => prev + 1);
        setIsDrawing(false);
        setTool('select');
        break;
      default:
        return;
    }

    setElements(prev => [...prev, newElement]);
    setSelectedId(id);
  };

  const handleStageMouseMove = (e: any) => {
    if (!isDrawing || tool === 'select' || !selectedId) return;

    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();

    setElements(prev => prev.map(el => {
      if (el.id !== selectedId) return el;

      switch (el.type) {
        case 'arrow':
          return { ...el, points: [0, 0, pos.x - el.x, pos.y - el.y] };
        case 'rect':
        case 'circle':
        case 'blur':
          return { ...el, width: pos.x - el.x, height: pos.y - el.y };
        default:
          return el;
      }
    }));
  };

  const handleStageMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
      setTool('select');
    }
  };

  useEffect(() => {
    if (selectedId && transformerRef.current) {
      const selectedNode = stageRef.current.findOne('#' + selectedId);
      const el = elements.find(e => e.id === selectedId);
      
      // Arrows have custom anchors, don't use transformer for them
      if (selectedNode && el?.type !== 'arrow') {
        transformerRef.current.nodes([selectedNode]);
        transformerRef.current.getLayer().batchDraw();
      } else {
        transformerRef.current.nodes([]);
      }
    }
  }, [selectedId, elements]);

  const exportCanvas = async (mode: 'download' | 'copy') => {
    if (!stageRef.current || elements.length === 0) return;
    
    setIsExporting(true);
    const oldId = selectedId;
    setSelectedId(null);

    try {
      await new Promise(r => setTimeout(r, 100));
      const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 });

      if (mode === 'download') {
        const link = document.createElement("a");
        link.download = `spectre-forensics-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
      } else {
        if (!navigator.clipboard || !navigator.clipboard.write) {
          const link = document.createElement("a");
          link.href = dataUrl;
          link.download = `spectre-canvas-${Date.now()}.png`;
          link.click();
          alert("HTTPS requerido para copiar. Se descargó automáticamente.");
        } else {
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          setShowCopySuccess(true);
          setTimeout(() => setShowCopySuccess(false), 2000);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSelectedId(oldId);
      setIsExporting(false);
    }
  };

  // --- Rendering Helpers ---

  const renderElement = (el: CanvasElement) => {
    if (el.type === 'image') {
      const imgObj = new window.Image();
      imgObj.src = el.src!;
      return (
        <KonvaImage
          key={el.id}
          id={el.id}
          image={imgObj}
          x={el.x}
          y={el.y}
          width={el.width}
          height={el.height}
          draggable={!isExporting}
          onClick={() => setSelectedId(el.id)}
          onDragEnd={(e) => {
            setElements(prev => prev.map(item => item.id === el.id ? { ...item, x: e.target.x(), y: e.target.y() } : item));
          }}
        />
      );
    }

    if (el.type === 'arrow') {
      const isSelected = selectedId === el.id && !isExporting;
      return (
        <Group key={el.id}>
          <Arrow
            id={el.id}
            x={el.x}
            y={el.y}
            points={el.points!}
            stroke={el.color}
            fill={el.color}
            strokeWidth={el.strokeWidth}
            draggable={!isExporting && tool === 'select'}
            onClick={() => setSelectedId(el.id)}
            onDragEnd={(e) => {
              setElements(prev => prev.map(item => item.id === el.id ? { ...item, x: e.target.x(), y: e.target.y() } : item));
            }}
          />
          {isSelected && (
            <>
              {/* Start Point Anchor */}
              <Circle
                x={el.x + el.points![0]}
                y={el.y + el.points![1]}
                radius={6}
                fill="white"
                stroke={el.color}
                strokeWidth={2}
                draggable
                onDragMove={(e) => {
                  const newX = e.target.x() - el.x;
                  const newY = e.target.y() - el.y;
                  setElements(prev => prev.map(item => item.id === el.id ? { 
                    ...item, 
                    points: [newX, newY, item.points![2], item.points![3]] 
                  } : item));
                }}
              />
              {/* End Point Anchor */}
              <Circle
                x={el.x + el.points![2]}
                y={el.y + el.points![3]}
                radius={6}
                fill={el.color}
                stroke="white"
                strokeWidth={2}
                draggable
                onDragMove={(e) => {
                  const newX = e.target.x() - el.x;
                  const newY = e.target.y() - el.y;
                  setElements(prev => prev.map(item => item.id === el.id ? { 
                    ...item, 
                    points: [item.points![0], item.points![1], newX, newY] 
                  } : item));
                }}
              />
            </>
          )}
        </Group>
      );
    }

    if (el.type === 'rect') {
      return (
        <Rect
          key={el.id}
          id={el.id}
          x={el.x}
          y={el.y}
          width={el.width}
          height={el.height}
          stroke={el.color}
          strokeWidth={el.strokeWidth}
          draggable={!isExporting}
          onClick={() => setSelectedId(el.id)}
        />
      );
    }

    if (el.type === 'circle') {
      return (
        <Circle
          key={el.id}
          id={el.id}
          x={el.x}
          y={el.y}
          width={el.width}
          height={el.height}
          stroke={el.color}
          strokeWidth={el.strokeWidth}
          draggable={!isExporting}
          onClick={() => setSelectedId(el.id)}
        />
      );
    }

    if (el.type === 'text' || el.type === 'counter') {
      return (
        <Group
          key={el.id}
          id={el.id}
          x={el.x}
          y={el.y}
          draggable={!isExporting}
          onClick={() => setSelectedId(el.id)}
        >
          {el.type === 'counter' && (
            <Circle radius={15} fill={el.color} />
          )}
          <Text
            text={el.text}
            fontSize={el.type === 'counter' ? 14 : 20}
            fill={el.type === 'counter' ? 'white' : el.color}
            fontStyle="bold"
            align="center"
            verticalAlign="middle"
            offsetX={el.type === 'counter' ? 5 : 0}
            offsetY={el.type === 'counter' ? 7 : 0}
          />
        </Group>
      );
    }

    if (el.type === 'blur') {
      return (
        <Rect
          key={el.id}
          id={el.id}
          x={el.x}
          y={el.y}
          width={el.width}
          height={el.height}
          fill="#334155"
          opacity={0.9}
          draggable={!isExporting}
          onClick={() => setSelectedId(el.id)}
        />
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] space-y-4">
      {/* --- Toolbar --- */}
      <div className="flex items-center justify-between bg-slate-900/50 p-2 rounded-xl border border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-1.5">
          <ToolbarButton active={tool === 'select'} onClick={() => setTool('select')} icon={<MousePointer2 className="size-4" />} label="Select" />
          <div className="w-px h-6 bg-slate-800 mx-1" />
          <ToolbarButton active={tool === 'arrow'} onClick={() => setTool('arrow')} icon={<ArrowRight className="size-4" />} label="Arrow" />
          <ToolbarButton active={tool === 'rect'} onClick={() => setTool('rect')} icon={<Square className="size-4" />} label="Rect" />
          <ToolbarButton active={tool === 'circle'} onClick={() => setTool('circle')} icon={<CircleIcon className="size-4" />} label="Circle" />
          <ToolbarButton active={tool === 'text'} onClick={() => setTool('text')} icon={<Type className="size-4" />} label="Text" />
          <ToolbarButton active={tool === 'counter'} onClick={() => setTool('counter')} icon={<Hash className="size-4" />} label="Step" />
          <ToolbarButton active={tool === 'blur'} onClick={() => setTool('blur')} icon={<EyeOff className="size-4" />} label="Blur" />
          
          <div className="w-px h-6 bg-slate-800 mx-1" />
          
          {/* Color Picker */}
          <div className="flex gap-1 ml-2">
            {['#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6', '#ffffff'].map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  "size-5 rounded-full border border-black/50 transition-transform hover:scale-125",
                  color === c ? "ring-2 ring-white scale-110" : ""
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
           <Button 
              variant="ghost" 
              size="sm" 
              className="text-slate-400 hover:text-rose-400"
              onClick={() => {
                if (selectedId) {
                  setElements(prev => prev.filter(e => e.id !== selectedId));
                  setSelectedId(null);
                } else {
                  setElements([]);
                  setCounter(1);
                }
              }}
           >
             <Trash2 className="size-4 mr-2" />
             {selectedId ? "Borrar" : "Limpiar"}
           </Button>
           <Button variant="outline" size="sm" className="border-slate-700" onClick={() => exportCanvas('copy')}>
             {showCopySuccess ? <Check className="size-4 mr-2 text-emerald-500" /> : <Copy className="size-4 mr-2" />}
             Copiar
           </Button>
           <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500" onClick={() => exportCanvas('download')}>
             <Download className="size-4 mr-2" />
             PNG
           </Button>
        </div>
      </div>

      {/* --- Canvas --- */}
      <Card className="flex-1 relative bg-[#020617] border-slate-800 overflow-hidden">
        <Stage
          width={window.innerWidth > 1400 ? 1400 : window.innerWidth - 100}
          height={600}
          ref={stageRef}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
          className="cursor-crosshair"
        >
          <Layer>
            {/* Background for Export */}
            <Rect width={2000} height={2000} fill="#020617" />
            
            {/* Elements */}
            {elements.map(renderElement)}
            
            {/* Transformer */}
            {!isExporting && (
              <Transformer
                ref={transformerRef}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 5 || newBox.height < 5) return oldBox;
                  return newBox;
                }}
              />
            )}
          </Layer>
        </Stage>

        {elements.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-20">
            <ImageIcon className="size-20 text-slate-500 mb-4" />
            <p className="text-xl font-mono">WAITING_FOR_EVIDENCE_PASTE [CTRL+V]</p>
          </div>
        )}
      </Card>
      
      <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500 uppercase">
        <div className="px-2 py-0.5 bg-slate-900 rounded border border-slate-800 text-cyan-400">Tool: {tool}</div>
        <div className="px-2 py-0.5 bg-slate-900 rounded border border-slate-800">Layers: {elements.length}</div>
        <div className="px-2 py-0.5 bg-slate-900 rounded border border-slate-800">Export: PNG 2X</div>
        <div className="ml-auto animate-pulse text-emerald-500/50 italic">Terminal Ready _</div>
      </div>
    </div>
  );
}

function ToolbarButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      size="sm"
      onClick={onClick}
      className={cn(
        "h-9 w-9 p-0 flex flex-col gap-0",
        active ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" : "text-slate-400"
      )}
      title={label}
    >
      {icon}
    </Button>
  );
}
