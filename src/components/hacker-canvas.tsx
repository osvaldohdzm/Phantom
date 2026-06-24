"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Rect,
  Arrow,
  Circle,
  Ellipse,
  Text,
  Transformer,
  Group,
} from "react-konva";
import type Konva from "konva";
import {
  Copy,
  Download,
  Trash2,
  Image as ImageIcon,
  Check,
  ArrowRight,
  Type,
  Square,
  Circle as CircleIcon,
  MousePointer2,
  Hash,
  Grid3X3,
  Crop,
  HelpCircle,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import {
  type CensorMode,
  cropImageDataUrl,
  normalizeBox,
  processRegionFromDataUrl,
} from "@/lib/canvas-image-utils";

const CANVAS_BG = { light: "#f1f5f9", dark: "#0f172a" } as const;
const MIN_SHAPE_SIZE = 4;
const EXPORT_PADDING = 12;
const IMAGE_BASE_Z = 0;
const ANNOTATION_BASE_Z = 1000;

type Tool = "select" | "arrow" | "rect" | "circle" | "text" | "counter" | "censor";

interface CanvasElement {
  id: string;
  type: "image" | "arrow" | "rect" | "circle" | "text" | "counter" | "censor";
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  src?: string;
  text?: string;
  points?: number[];
  color?: string;
  strokeWidth?: number;
  censorMode?: CensorMode;
  zIndex: number;
}

const TOOL_META: Record<Tool, { label: string; hint: string }> = {
  select: {
    label: "Seleccionar",
    hint: "Clic para seleccionar. Arrastra para mover. Esquinas para redimensionar. Capas: adelante/atrás en la barra.",
  },
  arrow: {
    label: "Flecha",
    hint: "Arrastra sobre la captura (siempre se dibuja encima). Ajusta extremos con Seleccionar.",
  },
  rect: {
    label: "Rectángulo",
    hint: "Arrastra en cualquier dirección. Se coloca por encima de imágenes.",
  },
  circle: {
    label: "Óvalo",
    hint: "Arrastra para definir el óvalo de resaltado.",
  },
  text: {
    label: "Texto",
    hint: "Clic para colocar. Doble clic para editar.",
  },
  counter: {
    label: "Paso",
    hint: "Clic para numerar pasos en la evidencia.",
  },
  censor: {
    label: "Censurar",
    hint: "Arrastra un rectángulo sobre datos sensibles. Elige pixelado, borroso o sólido arriba.",
  },
};

function isBackgroundTarget(target: Konva.Node, stage: Konva.Stage | null) {
  if (!stage) return false;
  return target === stage || target.name() === "canvas-bg";
}

function sortByZ(elements: CanvasElement[]) {
  return [...elements].sort((a, b) => a.zIndex - b.zIndex);
}

function nextTopZ(elements: CanvasElement[]) {
  const max = elements.reduce((m, e) => Math.max(m, e.zIndex), ANNOTATION_BASE_Z - 1);
  return max + 1;
}

function nextImageZ(elements: CanvasElement[]) {
  const imgs = elements.filter((e) => e.type === "image");
  if (!imgs.length) return IMAGE_BASE_Z;
  return Math.min(...imgs.map((e) => e.zIndex)) - 1;
}

/** Recorte al área con contenido (sin relleno del stage completo). */
function getExportRegion(stage: Konva.Stage): { x: number; y: number; width: number; height: number } {
  const layer = stage.getLayers()[0];
  if (!layer) {
    return { x: 0, y: 0, width: stage.width(), height: stage.height() };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = false;

  for (const node of layer.getChildren()) {
    if (node.name() === "canvas-bg" || node.getClassName() === "Transformer") continue;
    const box = node.getClientRect({ relativeTo: stage, skipShadow: true });
    if (!Number.isFinite(box.width) || !Number.isFinite(box.height)) continue;
    if (box.width <= 0 && box.height <= 0) continue;
    found = true;
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }

  if (!found) {
    return { x: 0, y: 0, width: stage.width(), height: stage.height() };
  }

  const x = Math.max(0, Math.floor(minX - EXPORT_PADDING));
  const y = Math.max(0, Math.floor(minY - EXPORT_PADDING));
  const right = Math.min(stage.width(), Math.ceil(maxX + EXPORT_PADDING));
  const bottom = Math.min(stage.height(), Math.ceil(maxY + EXPORT_PADDING));

  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  };
}

export function HackerCanvas() {
  const { theme } = useTheme();
  const canvasBg = CANVAS_BG[theme];
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState("#06b6d4");
  const [censorMode, setCensorMode] = useState<CensorMode>("pixelate");
  const [counter, setCounter] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  const [drawingId, setDrawingId] = useState<string | null>(null);
  const [baking, setBaking] = useState(false);
  const [cropTargetId, setCropTargetId] = useState<string | null>(null);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null
  );

  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const cropTransformerRef = useRef<Konva.Transformer | null>(null);
  const cropRectRef = useRef<Konva.Rect | null>(null);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  const [stageWidth, setStageWidth] = useState(1200);
  const sortedElements = useMemo(() => sortByZ(elements), [elements]);
  const selectedEl = elements.find((e) => e.id === selectedId);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () =>
      setStageWidth(window.innerWidth > 1400 ? 1400 : Math.max(320, window.innerWidth - 100));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const updateElement = useCallback((id: string, patch: Partial<CanvasElement>) => {
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, ...patch } : el)));
  }, []);

  const reorderLayer = useCallback((id: string, action: "front" | "back" | "forward" | "backward") => {
    setElements((prev) => {
      const sorted = sortByZ(prev);
      const idx = sorted.findIndex((e) => e.id === id);
      if (idx < 0) return prev;
      const el = sorted[idx];
      const others = sorted.filter((e) => e.id !== id);
      let newZ = el.zIndex;
      if (action === "front") newZ = nextTopZ(prev);
      if (action === "back") newZ = Math.min(...prev.map((e) => e.zIndex), IMAGE_BASE_Z) - 1;
      if (action === "forward") {
        const above = others.filter((e) => e.zIndex > el.zIndex);
        newZ = above.length ? Math.min(...above.map((e) => e.zIndex)) + 0.5 : el.zIndex + 1;
      }
      if (action === "backward") {
        const below = others.filter((e) => e.zIndex < el.zIndex);
        newZ = below.length ? Math.max(...below.map((e) => e.zIndex)) - 0.5 : el.zIndex - 1;
      }
      const updated = prev.map((e) => (e.id === id ? { ...e, zIndex: newZ } : e));
      return sortByZ(updated).map((e, i) => ({ ...e, zIndex: i }));
    });
  }, []);

  const deleteSelected = useCallback(() => {
    if (cropTargetId) {
      setCropTargetId(null);
      setCropRect(null);
      return;
    }
    if (selectedId) {
      setElements((prev) => prev.filter((e) => e.id !== selectedId));
      setSelectedId(null);
    } else {
      setElements([]);
      setCounter(1);
    }
  }, [selectedId, cropTargetId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.key === "Delete" || e.key === "Backspace") && (selectedId || cropTargetId)) {
        e.preventDefault();
        deleteSelected();
      }
      if (e.key === "Escape") {
        setSelectedId(null);
        setCropTargetId(null);
        setCropRect(null);
        setTool("select");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, cropTargetId, deleteSelected]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") === -1) continue;
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
          imageCache.current.set(newId, img);
          setElements((prev) => [
            ...prev,
            {
              id: newId,
              type: "image",
              src,
              x: 80,
              y: 80,
              width: w,
              height: h,
              zIndex: nextImageZ(prev),
            },
          ]);
          setSelectedId(newId);
          setTool("select");
        };
        img.src = src;
      };
      reader.readAsDataURL(blob);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const bakeCensor = useCallback(
    async (box: { x: number; y: number; width: number; height: number }) => {
      const stage = stageRef.current;
      if (!stage) return;
      setBaking(true);
      setSelectedId(null);
      await new Promise((r) => requestAnimationFrame(r));

      try {
        const dataUrl = stage.toDataURL({
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          pixelRatio: 2,
        });
        const processed = await processRegionFromDataUrl(
          dataUrl,
          censorMode,
          theme === "light" ? "#94a3b8" : "#334155"
        );
        const img = new Image();
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = rej;
          img.src = processed;
        });
        const id = `censor-${Date.now()}`;
        imageCache.current.set(id, img);
        setElements((prev) => [
          ...prev,
          {
            id,
            type: "censor",
            src: processed,
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            censorMode,
            zIndex: nextTopZ(prev),
          },
        ]);
        setSelectedId(id);
        setTool("select");
      } catch (err) {
        console.error(err);
      } finally {
        setBaking(false);
      }
    },
    [censorMode, theme]
  );

  const finishDrawing = useCallback(
    async (id: string) => {
      const el = elementsRef.current.find((e) => e.id === id);
      if (!el) {
        setDrawingId(null);
        return;
      }

      if (el.type === "censor") {
        const norm = normalizeBox(el.x, el.y, el.width ?? 0, el.height ?? 0);
        setElements((prev) => prev.filter((e) => e.id !== id));
        setDrawingId(null);
        if (norm.width >= MIN_SHAPE_SIZE && norm.height >= MIN_SHAPE_SIZE) {
          await bakeCensor(norm);
        }
        return;
      }

      setElements((prev) => {
        const current = prev.find((e) => e.id === id);
        if (!current) return prev;

        if (current.type === "rect" || current.type === "circle") {
          const norm = normalizeBox(current.x, current.y, current.width ?? 0, current.height ?? 0);
          if (norm.width < MIN_SHAPE_SIZE || norm.height < MIN_SHAPE_SIZE) {
            return prev.filter((e) => e.id !== id);
          }
          return prev.map((e) => (e.id === id ? { ...e, ...norm, zIndex: nextTopZ(prev) } : e));
        }

        if (current.type === "arrow") {
          const pts = current.points ?? [0, 0, 0, 0];
          if (Math.hypot(pts[2], pts[3]) < MIN_SHAPE_SIZE) {
            return prev.filter((e) => e.id !== id);
          }
          return prev.map((e) => (e.id === id ? { ...e, zIndex: nextTopZ(prev) } : e));
        }

        return prev;
      });
      setDrawingId(null);
    },
    [bakeCensor]
  );

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (cropTargetId || baking) return;
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    if (tool === "select") {
      if (isBackgroundTarget(e.target, stage)) setSelectedId(null);
      return;
    }

    const id = `el-${Date.now()}`;
    let newElement: CanvasElement | null = null;
    const topZ = nextTopZ(elementsRef.current);

    switch (tool) {
      case "arrow":
        newElement = {
          id,
          type: "arrow",
          x: pos.x,
          y: pos.y,
          points: [0, 0, 0, 0],
          color,
          strokeWidth: 3,
          zIndex: topZ,
        };
        setDrawingId(id);
        break;
      case "rect":
        newElement = {
          id,
          type: "rect",
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          color,
          strokeWidth: 2,
          zIndex: topZ,
        };
        setDrawingId(id);
        break;
      case "circle":
        newElement = {
          id,
          type: "circle",
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          color,
          strokeWidth: 2,
          zIndex: topZ,
        };
        setDrawingId(id);
        break;
      case "censor":
        newElement = {
          id,
          type: "censor",
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          censorMode,
          zIndex: topZ,
        };
        setDrawingId(id);
        break;
      case "text":
        newElement = {
          id,
          type: "text",
          x: pos.x,
          y: pos.y,
          text: "Texto",
          color,
          zIndex: topZ,
        };
        setSelectedId(id);
        setTool("select");
        break;
      case "counter":
        newElement = {
          id,
          type: "counter",
          x: pos.x,
          y: pos.y,
          text: String(counter),
          color,
          zIndex: topZ,
        };
        setCounter((c) => c + 1);
        setSelectedId(id);
        setTool("select");
        break;
      default:
        break;
    }

    if (newElement) {
      setElements((prev) => [...prev, newElement!]);
      setSelectedId(id);
    }
  };

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!drawingId) return;
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    setElements((prev) =>
      prev.map((el) => {
        if (el.id !== drawingId) return el;
        switch (el.type) {
          case "arrow":
            return { ...el, points: [0, 0, pos.x - el.x, pos.y - el.y] };
          case "rect":
          case "circle":
          case "censor":
            return { ...el, width: pos.x - el.x, height: pos.y - el.y };
          default:
            return el;
        }
      })
    );
  };

  const handleStageMouseUp = () => {
    if (!drawingId) return;
    void finishDrawing(drawingId);
  };

  const startCrop = () => {
    if (!selectedEl || selectedEl.type !== "image" || !selectedEl.width || !selectedEl.height) return;
    setCropTargetId(selectedEl.id);
    setCropRect({
      x: selectedEl.x,
      y: selectedEl.y,
      width: selectedEl.width,
      height: selectedEl.height,
    });
    setSelectedId(null);
  };

  const applyCrop = async () => {
    if (!cropTargetId || !cropRect) return;
    const imgEl = elements.find((e) => e.id === cropTargetId);
    if (!imgEl?.src || !imgEl.width || !imgEl.height) return;

    const scaleX = (imageCache.current.get(imgEl.id)?.naturalWidth ?? imgEl.width) / imgEl.width;
    const scaleY = (imageCache.current.get(imgEl.id)?.naturalHeight ?? imgEl.height) / imgEl.height;
    const rel = normalizeBox(
      cropRect.x - imgEl.x,
      cropRect.y - imgEl.y,
      cropRect.width,
      cropRect.height
    );
    const crop = {
      x: rel.x * scaleX,
      y: rel.y * scaleY,
      width: rel.width * scaleX,
      height: rel.height * scaleY,
    };

    try {
      setBaking(true);
      const { dataUrl, width, height } = await cropImageDataUrl(imgEl.src, crop);
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = rej;
        img.src = dataUrl;
      });
      imageCache.current.set(imgEl.id, img);
      updateElement(imgEl.id, {
        src: dataUrl,
        x: cropRect.x,
        y: cropRect.y,
        width,
        height,
      });
      setCropTargetId(null);
      setCropRect(null);
      setSelectedId(imgEl.id);
    } catch (err) {
      console.error(err);
    } finally {
      setBaking(false);
    }
  };

  useEffect(() => {
    const tr = transformerRef.current;
    const stage = stageRef.current;
    if (!tr || !stage || cropTargetId) return;

    if (!selectedId || isExporting) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }

    const el = elements.find((e) => e.id === selectedId);
    if (!el || el.type === "arrow") {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }

    const node = stage.findOne(`#${selectedId}`);
    if (node) {
      tr.nodes([node]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedId, elements, isExporting, cropTargetId]);

  useEffect(() => {
    const tr = cropTransformerRef.current;
    const node = cropRectRef.current;
    if (!tr || !node || !cropTargetId) return;
    tr.nodes([node]);
    tr.getLayer()?.batchDraw();
  }, [cropTargetId, cropRect]);

  const exportCanvas = async (mode: "download" | "copy") => {
    if (!stageRef.current || elements.length === 0) return;

    setIsExporting(true);
    const oldId = selectedId;
    setSelectedId(null);
    setCropTargetId(null);

    try {
      await new Promise((r) => setTimeout(r, 80));
      const region = getExportRegion(stageRef.current);
      const dataUrl = stageRef.current.toDataURL({
        ...region,
        pixelRatio: 2,
      });

      if (mode === "download") {
        const link = document.createElement("a");
        link.download = `phantom-canvas-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
      } else if (navigator.clipboard?.write) {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setShowCopySuccess(true);
        setTimeout(() => setShowCopySuccess(false), 2000);
      } else {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `phantom-canvas-${Date.now()}.png`;
        link.click();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSelectedId(oldId);
      setIsExporting(false);
    }
  };

  const editText = (el: CanvasElement) => {
    const next = window.prompt("Editar texto", el.text ?? "");
    if (next !== null && next.trim()) updateElement(el.id, { text: next.trim() });
  };

  const bindSelect = (id: string) => ({
    onClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      if (tool === "select" && !cropTargetId) setSelectedId(id);
    },
    onTap: () => {
      if (tool === "select" && !cropTargetId) setSelectedId(id);
    },
  });

  const bindDrag = (id: string) => ({
    draggable: tool === "select" && !isExporting && !cropTargetId,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      updateElement(id, { x: e.target.x(), y: e.target.y() });
    },
  });

  const bindTransform = (id: string) => ({
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      updateElement(id, {
        x: node.x(),
        y: node.y(),
        width: Math.max(MIN_SHAPE_SIZE, (node.width() || 0) * scaleX),
        height: Math.max(MIN_SHAPE_SIZE, (node.height() || 0) * scaleY),
        rotation: node.rotation(),
      });
    },
  });

  const renderElement = (el: CanvasElement) => {
    if (el.type === "image" || (el.type === "censor" && el.src)) {
      let img = imageCache.current.get(el.id);
      if (!img && el.src) {
        img = new window.Image();
        img.src = el.src;
        imageCache.current.set(el.id, img);
      }
      return (
        <KonvaImage
          key={el.id}
          id={el.id}
          image={img}
          x={el.x}
          y={el.y}
          width={el.width}
          height={el.height}
          {...bindSelect(el.id)}
          {...bindDrag(el.id)}
          {...bindTransform(el.id)}
        />
      );
    }

    if (el.type === "arrow") {
      const isSelected = selectedId === el.id && !isExporting;
      const pts = el.points ?? [0, 0, 0, 0];
      return (
        <Group key={el.id}>
          <Arrow
            id={el.id}
            x={el.x}
            y={el.y}
            points={pts}
            stroke={el.color}
            fill={el.color}
            strokeWidth={el.strokeWidth}
            pointerLength={12}
            pointerWidth={12}
            hitStrokeWidth={16}
            lineCap="round"
            lineJoin="round"
            {...bindSelect(el.id)}
            {...bindDrag(el.id)}
          />
          {isSelected && tool === "select" && (
            <>
              <Circle
                x={el.x + pts[0]}
                y={el.y + pts[1]}
                radius={7}
                fill={theme === "light" ? "#fff" : "#1e293b"}
                stroke={el.color}
                strokeWidth={2}
                draggable
                onDragMove={(e) => {
                  updateElement(el.id, {
                    points: [e.target.x() - el.x, e.target.y() - el.y, pts[2], pts[3]],
                  });
                }}
              />
              <Circle
                x={el.x + pts[2]}
                y={el.y + pts[3]}
                radius={7}
                fill={el.color}
                stroke={theme === "light" ? "#fff" : "#1e293b"}
                strokeWidth={2}
                draggable
                onDragMove={(e) => {
                  updateElement(el.id, {
                    points: [pts[0], pts[1], e.target.x() - el.x, e.target.y() - el.y],
                  });
                }}
              />
            </>
          )}
        </Group>
      );
    }

    if (el.type === "rect") {
      const box = normalizeBox(el.x, el.y, el.width ?? 0, el.height ?? 0);
      return (
        <Rect
          key={el.id}
          id={el.id}
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          stroke={el.color}
          strokeWidth={el.strokeWidth}
          fill="transparent"
          dash={drawingId === el.id ? [6, 4] : undefined}
          {...bindSelect(el.id)}
          {...bindDrag(el.id)}
          {...bindTransform(el.id)}
        />
      );
    }

    if (el.type === "circle") {
      const box = normalizeBox(el.x, el.y, el.width ?? 0, el.height ?? 0);
      return (
        <Group key={el.id} id={el.id} x={box.x} y={box.y} {...bindSelect(el.id)} {...bindDrag(el.id)} {...bindTransform(el.id)}>
          <Rect width={box.width} height={box.height} fill="transparent" opacity={0} />
          <Ellipse
            x={box.width / 2}
            y={box.height / 2}
            radiusX={Math.max(box.width / 2, 1)}
            radiusY={Math.max(box.height / 2, 1)}
            stroke={el.color}
            strokeWidth={el.strokeWidth}
            fill="transparent"
            dash={drawingId === el.id ? [6, 4] : undefined}
            listening={false}
          />
        </Group>
      );
    }

    if (el.type === "text" || el.type === "counter") {
      const isCounter = el.type === "counter";
      return (
        <Group key={el.id} id={el.id} x={el.x} y={el.y} {...bindSelect(el.id)} {...bindDrag(el.id)} onDblClick={() => editText(el)}>
          {isCounter && <Circle radius={14} fill={el.color} />}
          <Text
            text={el.text}
            fontSize={isCounter ? 13 : 18}
            fill={isCounter ? "#fff" : el.color}
            fontStyle="bold"
            align="center"
            verticalAlign="middle"
            offsetX={isCounter ? 6 : 0}
            offsetY={isCounter ? 6 : 0}
          />
        </Group>
      );
    }

    if (el.type === "censor" && !el.src) {
      const box = normalizeBox(el.x, el.y, el.width ?? 0, el.height ?? 0);
      return (
        <Rect
          key={el.id}
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          stroke="#f59e0b"
          strokeWidth={2}
          dash={[8, 4]}
          fill="rgba(245,158,11,0.15)"
          listening={false}
        />
      );
    }

    return null;
  };

  const emptyHintColor = useMemo(
    () => (theme === "light" ? "text-slate-400" : "text-slate-500/50"),
    [theme]
  );

  const cursorClass = tool === "select" ? "cursor-default" : "cursor-crosshair";

  const CENSOR_MODES: { id: CensorMode; label: string }[] = [
    { id: "pixelate", label: "Pixelado" },
    { id: "blur", label: "Borroso" },
    { id: "solid", label: "Sólido" },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-card p-2 rounded-xl border border-border shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(TOOL_META) as Tool[]).map((t) => {
            const icons: Record<Tool, React.ReactNode> = {
              select: <MousePointer2 className="size-4" />,
              arrow: <ArrowRight className="size-4" />,
              rect: <Square className="size-4" />,
              circle: <CircleIcon className="size-4" />,
              text: <Type className="size-4" />,
              counter: <Hash className="size-4" />,
              censor: <Grid3X3 className="size-4" />,
            };
            return (
              <ToolbarButton
                key={t}
                active={tool === t}
                onClick={() => {
                  setTool(t);
                  setCropTargetId(null);
                }}
                icon={icons[t]}
                label={TOOL_META[t].label}
              />
            );
          })}

          <div className="w-px h-6 bg-border mx-1" />

          {tool === "censor" && (
            <div className="flex gap-1 rounded-lg border border-border p-0.5 bg-muted/40">
              {CENSOR_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setCensorMode(m.id)}
                  className={cn(
                    "px-2 py-1 text-[10px] rounded-md transition-colors",
                    censorMode === m.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {tool !== "censor" && (
            <div className="flex gap-1 ml-1">
              {["#ef4444", "#f59e0b", "#10b981", "#06b6d4", "#8b5cf6", "#1e293b"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "size-5 rounded-full border border-border shadow-sm transition-transform hover:scale-110",
                    color === c ? "ring-2 ring-primary ring-offset-2 ring-offset-card scale-110" : ""
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedEl && selectedEl.type === "image" && !cropTargetId && (
            <Button type="button" variant="outline" size="sm" onClick={startCrop}>
              <Crop className="size-4 mr-1" />
              Recortar
            </Button>
          )}
          {cropTargetId && (
            <>
              <Button type="button" size="sm" onClick={() => void applyCrop()} disabled={baking}>
                <Check className="size-4 mr-1" />
                Aplicar recorte
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCropTargetId(null);
                  setCropRect(null);
                }}
              >
                Cancelar
              </Button>
            </>
          )}
          {selectedId && !cropTargetId && (
            <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
              <LayerButton title="Al fondo" onClick={() => reorderLayer(selectedId, "back")}>
                <ChevronsDown className="size-3.5" />
              </LayerButton>
              <LayerButton title="Atrás" onClick={() => reorderLayer(selectedId, "backward")}>
                <ArrowDown className="size-3.5" />
              </LayerButton>
              <LayerButton title="Adelante" onClick={() => reorderLayer(selectedId, "forward")}>
                <ArrowUp className="size-3.5" />
              </LayerButton>
              <LayerButton title="Al frente" onClick={() => reorderLayer(selectedId, "front")}>
                <ChevronsUp className="size-3.5" />
              </LayerButton>
            </div>
          )}
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setShowHelp((v) => !v)}>
            <HelpCircle className="size-4 mr-1" />
            Ayuda
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={deleteSelected}>
            <Trash2 className="size-4 mr-2" />
            {selectedId || cropTargetId ? "Borrar" : "Limpiar"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => exportCanvas("copy")} disabled={!elements.length || baking}>
            {showCopySuccess ? <Check className="size-4 mr-2 text-emerald-600" /> : <Copy className="size-4 mr-2" />}
            Copiar
          </Button>
          <Button type="button" size="sm" onClick={() => exportCanvas("download")} disabled={!elements.length || baking}>
            <Download className="size-4 mr-2" />
            PNG
          </Button>
        </div>
      </div>

      {showHelp && (
        <div className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">{TOOL_META[tool].label}:</span> {TOOL_META[tool].hint}
          {cropTargetId && (
            <span className="block mt-1 text-amber-700 dark:text-amber-300">
              Modo recorte: ajusta el marco y pulsa «Aplicar recorte».
            </span>
          )}
          <span className="hidden sm:inline">
            {" "}
            · Ctrl+V pega · Supr borra · Esc cancela
          </span>
        </div>
      )}

      <Card className="flex-1 relative overflow-hidden border-border" style={{ backgroundColor: canvasBg }}>
        {baking && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 text-sm text-muted-foreground">
            Procesando…
          </div>
        )}
        <Stage
          width={stageWidth}
          height={600}
          ref={stageRef}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
          onTouchStart={handleStageMouseDown}
          onTouchMove={handleStageMouseMove}
          onTouchEnd={handleStageMouseUp}
          className={cursorClass}
        >
          <Layer>
            <Rect name="canvas-bg" width={2000} height={2000} fill={canvasBg} listening />
            {sortedElements.map(renderElement)}
            {cropTargetId && cropRect && (
              <>
                <Rect
                  ref={cropRectRef}
                  x={cropRect.x}
                  y={cropRect.y}
                  width={cropRect.width}
                  height={cropRect.height}
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dash={[6, 3]}
                  fill="rgba(6,182,212,0.08)"
                  draggable
                  onDragEnd={(e) => {
                    setCropRect({
                      ...cropRect,
                      x: e.target.x(),
                      y: e.target.y(),
                    });
                  }}
                  onTransformEnd={(e) => {
                    const node = e.target;
                    const sx = node.scaleX();
                    const sy = node.scaleY();
                    node.scaleX(1);
                    node.scaleY(1);
                    setCropRect({
                      x: node.x(),
                      y: node.y(),
                      width: Math.max(MIN_SHAPE_SIZE, node.width() * sx),
                      height: Math.max(MIN_SHAPE_SIZE, node.height() * sy),
                    });
                  }}
                />
                <Transformer
                  ref={cropTransformerRef}
                  rotateEnabled={false}
                  borderStroke="#06b6d4"
                  anchorStroke="#06b6d4"
                  anchorFill={theme === "light" ? "#fff" : "#0f172a"}
                />
              </>
            )}
            {!isExporting && !cropTargetId && (
              <Transformer
                ref={transformerRef}
                rotateEnabled
                borderStroke="#06b6d4"
                anchorStroke="#06b6d4"
                anchorFill={theme === "light" ? "#fff" : "#0f172a"}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < MIN_SHAPE_SIZE || newBox.height < MIN_SHAPE_SIZE) return oldBox;
                  return newBox;
                }}
              />
            )}
          </Layer>
        </Stage>

        {elements.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6 text-center">
            <ImageIcon className={cn("size-16 mb-3 opacity-40", emptyHintColor)} />
            <p className={cn("text-sm font-medium", emptyHintColor)}>Pega una captura con Ctrl+V</p>
            <p className={cn("text-xs mt-1 max-w-md", emptyHintColor)}>
              Anotaciones y censuras siempre se dibujan encima de las imágenes.
            </p>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-muted-foreground uppercase">
        <span className="px-2 py-0.5 bg-muted rounded border border-border text-cyan-700 dark:text-cyan-400">
          {TOOL_META[tool].label}
        </span>
        <span className="px-2 py-0.5 bg-muted rounded border border-border">Capas: {elements.length}</span>
        {selectedId && <span className="px-2 py-0.5 bg-muted rounded border border-border">Capa {elements.findIndex((e) => e.id === selectedId) + 1}</span>}
      </div>
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="sm"
      onClick={onClick}
      className={cn(
        "h-9 min-w-9 px-2 gap-1",
        active
          ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
      title={label}
    >
      {icon}
      <span className="hidden lg:inline text-[10px]">{label}</span>
    </Button>
  );
}

function LayerButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
    >
      {children}
    </button>
  );
}











