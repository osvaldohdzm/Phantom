'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Copy,
  Plus,
  Trash2,
  Edit,
  Terminal,
  ChevronDown,
  ChevronRight,
  Sliders,
  Check,
  MoveUp,
  MoveDown,
  PlusCircle,
  Play,
  HelpCircle,
  FolderKanban,
  CheckSquare,
  Square,
  ShieldAlert,
  Target,
  FileCode,
  GripVertical,
  Layers,
  Lock,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { UiMessageKey } from '@/lib/ui-locale';
import type { PentestMapNode, PentestTargetMapDocument, PentestMapNodeKind } from '@/lib/pentest-target-map-schema';
import { addMapNode, removeMapNode } from '@/lib/pentest-target-map-schema';
import { buildDefaultNodeFields } from '@/lib/pentest-target-map-kinds';
import { getMapNodeIconDataUri } from '@/lib/pentest-target-map-icons';
import {
  resolveNodeVariables,
  resolveCommand,
  resolveCommandWithVariables,
} from '@/lib/pentest-map-variable-resolver';
import {
  buildOutlineTree,
  flattenOutlineTree,
  indentNode,
  outdentNode,
  moveNodeUp,
  moveNodeDown,
  isDropAllowed,
  sortNodeChildren,
  sortRootNodes,
} from '@/lib/pentest-outline-tree-engine';

import type { MapViewMode } from '@/lib/pentest-map-attack-graph';

function getNodeBorderAndBg(kind: PentestMapNodeKind) {
  switch (kind) {
    case 'target':
    case 'initial_target':
    case 'derived_target':
      return 'border-l-orange-500/80 bg-orange-500/4 border-orange-500/20';
    case 'attacker':
      return 'border-l-slate-500/80 bg-slate-500/4 border-slate-500/20';
    case 'command':
      return 'border-l-emerald-500/80 bg-emerald-500/4 border-emerald-500/20';
    case 'port':
      return 'border-l-cyan-500/80 bg-cyan-500/4 border-cyan-500/20';
    case 'service':
      return 'border-l-sky-500/80 bg-sky-500/4 border-sky-500/20';
    case 'technology':
      return 'border-l-indigo-500/80 bg-indigo-500/4 border-indigo-500/20';
    case 'route':
      return 'border-l-pink-500/80 bg-pink-500/4 border-pink-500/20';
    case 'vulnerability':
    case 'exploit':
      return 'border-l-pink-500/80 bg-pink-500/4 border-pink-500/20';
    case 'session':
      return 'border-l-purple-500/80 bg-purple-500/4 border-purple-500/20';
    case 'loot':
    case 'flag':
    case 'credential':
      return 'border-l-amber-500/80 bg-amber-500/4 border-amber-500/20';
    default:
      return 'border-l-border bg-muted/10 border-border/30';
  }
}

type Props = {
  doc: PentestTargetMapDocument;
  applyDoc: (next: PentestTargetMapDocument) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  lang: 'es' | 'en';
  t: (key: UiMessageKey) => string;
  isDark: boolean;
  viewMode: MapViewMode;
  setViewMode: (mode: MapViewMode) => void;
};

export function MapOutlineView({
  doc,
  applyDoc,
  selectedId,
  setSelectedId,
  lang,
  t,
  isDark,
  viewMode,
  setViewMode,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const handleCollapseAll = () => {
    const allNodeIds = doc.nodes.map((n) => n.id);
    setCollapsedIds(new Set(allNodeIds));
  };
  const handleExpandAll = () => {
    setCollapsedIds(new Set());
  };
  const [copiedNodeId, setCopiedNodeId] = useState<string | null>(null);
  const [copiedCombinedId, setCopiedCombinedId] = useState<string | null>(null);
  const [newVarName, setNewVarName] = useState('');
  const [newVarValue, setNewVarValue] = useState('');

  // Target Groups States
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupTargets, setSelectedGroupTargets] = useState<Set<string>>(new Set());

  // Drag and Drop States
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{ id: string; position: 'before' | 'after' | 'inside' } | null>(
    null
  );
  const activeDragIdRef = useRef<string | null>(null);
  const dropIndicatorRef = useRef<{ id: string; position: 'before' | 'after' | 'inside' } | null>(null);

  // 1. Build and partition the outline tree
  const tree = useMemo(() => buildOutlineTree(doc), [doc]);

  // Consolidates Attackers and all Red Team / Operational nodes into the 1st section
  const attackerRoots = useMemo(() => {
    return tree.filter(
      (t) =>
        t.node.kind === 'attacker' ||
        ['command', 'exploit', 'payload', 'session', 'privesc', 'credential', 'pivot', 'evidence'].includes(t.node.kind)
    );
  }, [tree]);

  // Consolidates Targets and all Host Recon / Vulnerability details into the 2nd section
  const victimRoots = useMemo(() => {
    return tree.filter(
      (t) =>
        ['target', 'initial_target', 'derived_target'].includes(t.node.kind) ||
        ['port', 'service', 'technology', 'route', 'vulnerability', 'flag', 'loot'].includes(t.node.kind)
    );
  }, [tree]);

  const attackerItems = useMemo(() => {
    return flattenOutlineTree(attackerRoots, collapsedIds);
  }, [attackerRoots, collapsedIds]);

  const victimItems = useMemo(() => {
    return flattenOutlineTree(victimRoots, collapsedIds);
  }, [victimRoots, collapsedIds]);

  const allFlatItems = useMemo(() => {
    return [...attackerItems, ...victimItems];
  }, [attackerItems, victimItems]);

  const selectedItemIndex = useMemo(() => {
    if (!selectedId) return -1;
    return allFlatItems.findIndex((item) => item.node.id === selectedId);
  }, [allFlatItems, selectedId]);

  const victimHosts = useMemo(() => {
    return doc.nodes.filter((n) => ['target', 'initial_target', 'derived_target'].includes(n.kind));
  }, [doc.nodes]);

  // Keyboard navigation logic
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const targetTag = (e.target as HTMLElement).tagName.toLowerCase();
    if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') {
      return;
    }

    if (!selectedId) {
      if (allFlatItems.length > 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        setSelectedId(allFlatItems[0].node.id);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const nextIdx = (selectedItemIndex + 1) % allFlatItems.length;
        setSelectedId(allFlatItems[nextIdx].node.id);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prevIdx = (selectedItemIndex - 1 + allFlatItems.length) % allFlatItems.length;
        setSelectedId(allFlatItems[prevIdx].node.id);
        break;
      }
      case 'Tab': {
        e.preventDefault();
        if (e.shiftKey) {
          applyDoc(outdentNode(doc, selectedId));
        } else {
          applyDoc(indentNode(doc, selectedId));
        }
        break;
      }
      case 'Enter': {
        e.preventDefault();
        const activeNode = allFlatItems[selectedItemIndex]?.node;
        const parentId = activeNode?.parentNode;
        const defaultFields = buildDefaultNodeFields('command', lang);

        let newDoc = doc;
        if (activeNode) {
          newDoc = addMapNode(
            doc,
            {
              ...defaultFields,
              parentNode: parentId,
              label: lang === 'es' ? 'Nuevo Comando' : 'New Command',
            },
            parentId || undefined
          );
        } else {
          newDoc = addMapNode(doc, {
            ...defaultFields,
            label: lang === 'es' ? 'Nuevo Comando' : 'New Command',
          });
        }
        const lastNode = newDoc.nodes[newDoc.nodes.length - 1];
        applyDoc(newDoc);
        if (lastNode) {
          setSelectedId(lastNode.id);
        }
        break;
      }
      case 'Delete':
      case 'Backspace': {
        e.preventDefault();
        if (
          confirm(
            lang === 'es' ? '¿Eliminar este nodo y sus conexiones?' : 'Delete this node and its connections?'
          )
        ) {
          const prevIdx = selectedItemIndex > 0 ? selectedItemIndex - 1 : 0;
          applyDoc(removeMapNode(doc, selectedId));
          if (allFlatItems.length > 1) {
            setSelectedId(allFlatItems[prevIdx].node.id);
          } else {
            setSelectedId(null);
          }
        }
        break;
      }
      default:
        break;
    }
  };

  useEffect(() => {
    if (selectedId && containerRef.current) {
      containerRef.current.focus({ preventScroll: true });
    }
  }, [selectedId]);

  const toggleCollapse = (id: string) => {
    const next = new Set(collapsedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setCollapsedIds(next);
  };

  const updateNodeField = (nodeId: string, patch: Partial<PentestMapNode>) => {
    const updatedNodes = doc.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n));
    applyDoc({ ...doc, nodes: updatedNodes });
  };

  const currentEnv = useMemo(() => {
    if (!selectedId) return {};
    return resolveNodeVariables(doc, selectedId);
  }, [doc, selectedId]);

  const addGlobalVariable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVarName.trim()) return;
    const cleanName = newVarName.trim().toLowerCase();
    const updatedVariables = {
      ...(doc.meta.variables ?? {}),
      [cleanName]: newVarValue,
    };
    applyDoc({
      ...doc,
      meta: {
        ...doc.meta,
        variables: updatedVariables,
      },
    });
    setNewVarName('');
    setNewVarValue('');
  };

  const deleteGlobalVariable = (key: string) => {
    const nextVariables = { ...(doc.meta.variables ?? {}) };
    delete nextVariables[key];
    applyDoc({
      ...doc,
      meta: {
        ...doc.meta,
        variables: nextVariables,
      },
    });
  };

  const updateGlobalVariable = (key: string, value: string) => {
    const updatedVariables = {
      ...(doc.meta.variables ?? {}),
      [key]: value,
    };
    applyDoc({
      ...doc,
      meta: {
        ...doc.meta,
        variables: updatedVariables,
      },
    });
  };

  // Target Groups Mutator
  const handleAddTargetGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || selectedGroupTargets.size === 0) return;
    const cleanName = newGroupName.trim().replace(/\s+/g, '_').toLowerCase();
    const updatedGroups = {
      ...(doc.meta.targetGroups ?? {}),
      [cleanName]: Array.from(selectedGroupTargets),
    };
    applyDoc({
      ...doc,
      meta: {
        ...doc.meta,
        targetGroups: updatedGroups,
      },
    });
    setNewGroupName('');
    setSelectedGroupTargets(new Set());
  };

  const handleDeleteTargetGroup = (groupKey: string) => {
    const nextGroups = { ...(doc.meta.targetGroups ?? {}) };
    delete nextGroups[groupKey];
    applyDoc({
      ...doc,
      meta: {
        ...doc.meta,
        targetGroups: nextGroups,
      },
    });
  };

  const handleToggleTargetInNewGroup = (id: string) => {
    const next = new Set(selectedGroupTargets);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedGroupTargets(next);
  };

  // Node variable editor
  const updateNodeVariable = (nodeId: string, key: string, value: string) => {
    const node = doc.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const updatedVars = {
      ...(node.variables ?? {}),
      [key]: value,
    };
    updateNodeField(nodeId, { variables: updatedVars });
  };

  const addNodeVariable = (nodeId: string, key: string, value: string) => {
    const node = doc.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const cleanKey = key.trim().toLowerCase();
    if (!cleanKey) return;
    const updatedVars = {
      ...(node.variables ?? {}),
      [cleanKey]: value,
    };
    updateNodeField(nodeId, { variables: updatedVars });
  };

  const deleteNodeVariable = (nodeId: string, key: string) => {
    const node = doc.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const nextVars = { ...(node.variables ?? {}) };
    delete nextVars[key];
    updateNodeField(nodeId, { variables: nextVars });
  };

  const handleCopyCommand = (node: PentestMapNode, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNodeId(node.id);
    setTimeout(() => setCopiedNodeId(null), 1500);
  };

  const handleCompileBlock = (node: PentestMapNode) => {
    const collectDescendantCommands = (nid: string): string[] => {
      const childrenNodes = doc.nodes.filter((n) => n.parentNode === nid);
      const ownCommand = doc.nodes.find((n) => n.id === nid);
      const currentResolved = ownCommand ? resolveCommand(doc, ownCommand) : '';

      const list: string[] = [];
      if (currentResolved) {
        list.push(currentResolved);
      }

      for (const child of childrenNodes) {
        list.push(...collectDescendantCommands(child.id));
      }
      return list;
    };

    const commands = collectDescendantCommands(node.id);
    const combinedScript = commands.join('\n');
    navigator.clipboard.writeText(combinedScript);
    setCopiedCombinedId(node.id);
    setTimeout(() => setCopiedCombinedId(null), 1500);
  };

  const extractTemplateVariables = (template: string): string[] => {
    const matches = template.match(/\{\{([a-zA-Z0-9_-]+)\}\}/g) || [];
    const keys = matches.map((m) => m.slice(2, -2).trim().toLowerCase());
    return Array.from(new Set(keys)).filter(
      (k) =>
        ![
          'target',
          'target_ip',
          'targets',
          'target_list',
          'attacker',
          'attacker_ip',
          'domain',
          'port',
        ].includes(k)
    );
  };

  // Helper to discover host attributes (ports, services, tech, etc.) dynamically
  const getDiscoveredValuesForTargets = (
    targetRefs: string[] | undefined,
    variableName: string
  ): string[] => {
    if (!targetRefs || targetRefs.length === 0) return [];

    const targetIds = new Set<string>();
    for (const ref of targetRefs) {
      if (doc.meta.targetGroups && doc.meta.targetGroups[ref]) {
        doc.meta.targetGroups[ref].forEach((id) => targetIds.add(id));
      } else {
        targetIds.add(ref);
      }
    }

    const values = new Set<string>();

    const getDescendants = (parentId: string): PentestMapNode[] => {
      const children = doc.nodes.filter((n) => n.parentNode === parentId);
      const list = [...children];
      for (const child of children) {
        list.push(...getDescendants(child.id));
      }
      return list;
    };

    const cleanVarName = variableName.toLowerCase().trim();

    for (const tid of targetIds) {
      const descendants = getDescendants(tid);
      for (const d of descendants) {
        if (cleanVarName === 'port') {
          if (d.port) values.add(d.port.toString());
        } else if (cleanVarName === 'service') {
          if (d.service) values.add(d.service);
          if (d.kind === 'service' && d.label) values.add(d.label);
        } else if (cleanVarName === 'tech' || cleanVarName === 'technology') {
          if (d.kind === 'technology' && d.label) values.add(d.label);
        } else if (cleanVarName === 'route' || cleanVarName === 'path') {
          if (d.kind === 'route' && d.label) values.add(d.label);
        }
      }
    }

    return Array.from(values);
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setActiveDragId(id);
    activeDragIdRef.current = id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const dragId = activeDragIdRef.current || activeDragId;
    if (!dragId || dragId === targetId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    const dragNode = doc.nodes.find((n) => n.id === dragId);
    const targetNode = doc.nodes.find((n) => n.id === targetId);

    let nextIndicator: typeof dropIndicator = null;

    if (y < height * 0.25) {
      nextIndicator = { id: targetId, position: 'before' };
    } else if (y > height * 0.75) {
      nextIndicator = { id: targetId, position: 'after' };
    } else {
      if (dragNode && targetNode && isDropAllowed(dragNode.kind, targetNode.kind)) {
        nextIndicator = { id: targetId, position: 'inside' };
      } else {
        nextIndicator = { id: targetId, position: 'after' };
      }
    }

    setDropIndicator(nextIndicator);
    dropIndicatorRef.current = nextIndicator;
  };

  const handleDragLeave = () => {
    // Keep hover indicator persistent on child elements to prevent UX flickering.
    // Cleared instead on container drag-leave or drag-end.
  };

  const handleDragEnd = () => {
    setActiveDragId(null);
    activeDragIdRef.current = null;
    setDropIndicator(null);
    dropIndicatorRef.current = null;
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const dragId = activeDragIdRef.current || activeDragId || e.dataTransfer.getData('text/plain');
    if (!dragId || dragId === targetId) return;

    const indicator = dropIndicatorRef.current || dropIndicator;
    const position = indicator?.position || 'inside';

    const newDoc = { ...doc };
    const dragNode = newDoc.nodes.find((n) => n.id === dragId);
    const targetNode = newDoc.nodes.find((n) => n.id === targetId);

    if (!dragNode || !targetNode) return;

    newDoc.edges = newDoc.edges.filter((edge) => edge.to !== dragId);

    if (position === 'inside') {
      dragNode.parentNode = targetId;
      newDoc.edges.push({
        id: `e-${targetId}-${dragId}`,
        from: targetId,
        to: dragId,
      });
    } else {
      const incomingEdges = new Map<string, string>();
      doc.edges.forEach((edge) => {
        if (!incomingEdges.has(edge.to)) incomingEdges.set(edge.to, edge.from);
      });
      const targetParentId = targetNode.parentNode || incomingEdges.get(targetId);

      dragNode.parentNode = targetParentId;
      if (targetParentId) {
        newDoc.edges.push({
          id: `e-${targetParentId}-${dragId}`,
          from: targetParentId,
          to: dragId,
        });
      }

      let updatedNodes = newDoc.nodes.filter((n) => n.id !== dragId);
      const targetIdx = updatedNodes.findIndex((n) => n.id === targetId);
      const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
      updatedNodes.splice(insertIdx, 0, dragNode);
      newDoc.nodes = updatedNodes;
    }

    applyDoc(newDoc);
    setActiveDragId(null);
    activeDragIdRef.current = null;
    setDropIndicator(null);
    dropIndicatorRef.current = null;
  };

  // Add child node helper for contextual outline menu buttons
  const handleAddChildNode = (parentId: string, kind: PentestMapNodeKind) => {
    const defaultFields = buildDefaultNodeFields(kind, lang);
    let label = '';
    switch (kind) {
      case 'port':
        label = lang === 'es' ? 'Puerto 80/tcp' : 'Port 80/tcp';
        break;
      case 'service':
        label = 'http';
        break;
      case 'technology':
        label = 'Apache httpd';
        break;
      case 'route':
        label = '/admin';
        break;
      case 'exploit':
        label = lang === 'es' ? 'Exploit de Vulnerabilidad' : 'Vulnerability Exploit';
        break;
      case 'flag':
        label = 'user.txt';
        break;
      case 'command':
        label = lang === 'es' ? 'Nuevo Comando' : 'New Command';
        break;
      default:
        label = `New ${kind}`;
    }

    const newDoc = addMapNode(
      doc,
      {
        ...defaultFields,
        parentNode: parentId,
        label,
      },
      parentId
    );

    applyDoc(newDoc);

    const lastNode = newDoc.nodes[newDoc.nodes.length - 1];
    if (lastNode) setSelectedId(lastNode.id);
  };

  // Select/Toggle target victim (supporting multiple targets and groups)
  const handleToggleTargetRef = (commandNodeId: string, refId: string) => {
    const newDoc = { ...doc };
    const node = newDoc.nodes.find((n) => n.id === commandNodeId);
    if (!node) return;

    const currentRefs = node.targetRefs || [];
    let nextRefs = [...currentRefs];

    if (nextRefs.includes(refId)) {
      nextRefs = nextRefs.filter((r) => r !== refId);
    } else {
      nextRefs.push(refId);
    }
    node.targetRefs = nextRefs;

    newDoc.edges = newDoc.edges.filter(
      (e) =>
        !(
          e.from === commandNodeId &&
          ['target', 'initial_target', 'derived_target'].includes(
            newDoc.nodes.find((n) => n.id === e.to)?.kind || ''
          )
        )
    );

    const targetsToConnect = new Set<string>();
    for (const ref of nextRefs) {
      if (doc.meta.targetGroups && doc.meta.targetGroups[ref]) {
        doc.meta.targetGroups[ref].forEach((tid) => targetsToConnect.add(tid));
      } else {
        targetsToConnect.add(ref);
      }
    }

    targetsToConnect.forEach((tid) => {
      newDoc.edges.push({
        id: `e-${commandNodeId}-${tid}`,
        from: commandNodeId,
        to: tid,
        label: 'targets',
      });
    });

    applyDoc(newDoc);
  };

  // Reusable sub-tree node renderer
  const renderFlatListItems = (items: typeof allFlatItems) => {
    return items.map((item) => {
      const isSelected = selectedId === item.node.id;
      const isDragging = activeDragId === item.node.id;
      const isTargetOfDrop = dropIndicator?.id === item.node.id;
      const templateVars = item.node.command ? extractTemplateVariables(item.node.command) : [];
      const hasChildren = item.childrenCount > 0;

      return (
        <div
          key={item.node.id}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedId(item.node.id);
          }}
          style={{ paddingLeft: `${item.depth * 28}px` }}
          className={`relative group/block focus:outline-none transition-all ${
            isDragging ? 'opacity-40 scale-[0.98]' : ''
          }`}
          draggable
          onDragStart={(e) => handleDragStart(e, item.node.id)}
          onDragOver={(e) => handleDragOver(e, item.node.id)}
          onDragLeave={handleDragLeave}
          onDragEnd={handleDragEnd}
          onDrop={(e) => handleDrop(e, item.node.id)}
        >
          {/* Drag Top Drop Indicator */}
          {isTargetOfDrop && dropIndicator.position === 'before' && (
            <div className="absolute top-0 left-4 right-4 h-0.5 bg-cyan-500 z-50 rounded shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
          )}

          {/* Drag Bottom Drop Indicator */}
          {isTargetOfDrop && dropIndicator.position === 'after' && (
            <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-cyan-500 z-50 rounded shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
          )}

          {item.depth > 0 && (
            <div
              style={{ left: `${(item.depth - 1) * 28 + 14}px` }}
              className="absolute top-0 bottom-0 w-px border-l border-dashed border-border/60 pointer-events-none"
            />
          )}

          <div
            className={`relative flex flex-col border border-l-4 rounded-xl p-3 shadow-sm hover:border-primary/45 transition-all cursor-grab active:cursor-grabbing ${getNodeBorderAndBg(
              item.node.kind
            )} ${
              isSelected
                ? 'ring-2 ring-primary border-primary/50 bg-primary/3 dark:bg-primary/1'
                : ''
            } ${
              isTargetOfDrop && dropIndicator.position === 'inside'
                ? 'border-cyan-400 bg-cyan-500/5 ring-1 ring-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                : ''
            }`}
          >
            {/* Header row */}
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Visual Grip Handle for Dragging */}
              <div className="text-muted-foreground/40 group-hover/block:text-muted-foreground/80 cursor-grab active:cursor-grabbing p-0.5 shrink-0 transition-colors">
                <GripVertical className="size-3.5" />
              </div>

              {hasChildren ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCollapse(item.node.id);
                  }}
                  className="p-1 hover:bg-muted/40 rounded transition-colors text-muted-foreground"
                >
                  {item.isCollapsed ? (
                    <ChevronRight className="size-3.5" />
                  ) : (
                    <ChevronDown className="size-3.5" />
                  )}
                </button>
              ) : (
                <div className="w-5.5" />
              )}

              <img
                src={getMapNodeIconDataUri(item.node.kind, isDark)}
                alt=""
                className="size-4 shrink-0"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />

              <input
                type="text"
                value={item.node.label}
                onChange={(e) => updateNodeField(item.node.id, { label: e.target.value })}
                className="text-xs font-semibold bg-transparent border-none text-foreground hover:bg-muted/30 focus:bg-background focus:ring-1 focus:ring-primary focus:outline-none rounded py-0.5 px-1 flex-1 min-w-0"
              />

              <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground/80 bg-muted/60 border border-border/30 rounded px-1.5 py-0.5">
                {item.node.kind}
              </span>

              <div className="flex items-center opacity-0 group-hover/block:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    applyDoc(moveNodeUp(doc, item.node.id));
                  }}
                  className="p-1 hover:bg-muted/40 text-muted-foreground rounded"
                  title="Move Up"
                >
                  <MoveUp className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    applyDoc(moveNodeDown(doc, item.node.id));
                  }}
                  className="p-1 hover:bg-muted/40 text-muted-foreground rounded"
                  title="Move Down"
                >
                  <MoveDown className="size-3" />
                </button>
              </div>

              {/* Dynamic child actions */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(item.node.kind === 'target' ||
                  item.node.kind === 'initial_target' ||
                  item.node.kind === 'derived_target') && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddChildNode(item.node.id, 'port');
                      }}
                      className="phantom-btn text-[9px] border-cyan-500/20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 py-0.5 px-1.5"
                    >
                      <Plus className="size-2.5 mr-0.5" />
                      Port
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddChildNode(item.node.id, 'command');
                      }}
                      className="phantom-btn text-[9px] border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 py-0.5 px-1.5"
                    >
                      <Plus className="size-2.5 mr-0.5" />
                      Cmd
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddChildNode(item.node.id, 'flag');
                      }}
                      className="phantom-btn text-[9px] border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 py-0.5 px-1.5"
                    >
                      <Plus className="size-2.5 mr-0.5" />
                      Flag
                    </button>
                  </>
                )}

                {item.node.kind === 'attacker' && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddChildNode(item.node.id, 'command');
                      }}
                      className="phantom-btn text-[9px] border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 py-0.5 px-1.5"
                    >
                      <Plus className="size-2.5 mr-0.5" />
                      Cmd
                    </button>
                  </>
                )}

                {item.node.kind === 'port' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddChildNode(item.node.id, 'service');
                    }}
                    className="phantom-btn text-[9px] border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 py-0.5 px-1.5"
                  >
                    <Plus className="size-2.5 mr-0.5" />
                    Service
                  </button>
                )}

                {item.node.kind === 'service' && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddChildNode(item.node.id, 'technology');
                      }}
                      className="phantom-btn text-[9px] border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 py-0.5 px-1.5"
                    >
                      <Plus className="size-2.5 mr-0.5" />
                      Tech
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddChildNode(item.node.id, 'command');
                      }}
                      className="phantom-btn text-[9px] border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 py-0.5 px-1.5"
                    >
                      <Plus className="size-2.5 mr-0.5" />
                      Cmd
                    </button>
                  </>
                )}

                {item.node.kind === 'technology' && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddChildNode(item.node.id, 'route');
                      }}
                      className="phantom-btn text-[9px] border-pink-500/20 bg-pink-500/10 text-pink-600 dark:text-pink-400 hover:bg-pink-500/20 py-0.5 px-1.5"
                    >
                      <Plus className="size-2.5 mr-0.5" />
                      Route
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddChildNode(item.node.id, 'exploit');
                      }}
                      className="phantom-btn text-[9px] border-pink-500/20 bg-pink-500/10 text-pink-600 dark:text-pink-400 hover:bg-pink-500/20 py-0.5 px-1.5"
                    >
                      <Plus className="size-2.5 mr-0.5" />
                      Exploit
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddChildNode(item.node.id, 'command');
                      }}
                      className="phantom-btn text-[9px] border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 py-0.5 px-1.5"
                    >
                      <Plus className="size-2.5 mr-0.5" />
                      Cmd
                    </button>
                  </>
                )}

                {item.node.kind === 'command' && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddChildNode(item.node.id, 'command');
                      }}
                      className="phantom-btn text-[9px] border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 py-0.5 px-1.5"
                      title="Add subcommand (child)"
                    >
                      <Plus className="size-2.5 mr-0.5" />
                      SubCmd
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const parentId = item.node.parentNode;
                        const defaultFields = buildDefaultNodeFields('command', lang);
                        const newDoc = addMapNode(
                          doc,
                          {
                            ...defaultFields,
                            parentNode: parentId || undefined,
                            label: lang === 'es' ? 'Comando Secuencial' : 'Sequential Cmd',
                          },
                          parentId || undefined
                        );
                        applyDoc(newDoc);
                        const lastNode = newDoc.nodes[newDoc.nodes.length - 1];
                        if (lastNode) setSelectedId(lastNode.id);
                      }}
                      className="phantom-btn text-[9px] border-cyan-500/20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 py-0.5 px-1.5"
                      title="Add sequential command (sibling)"
                    >
                      <Plus className="size-2.5 mr-0.5" />
                      SeqCmd
                    </button>
                  </>
                )}

                {/* Local auto-sorting toolbar */}
                {hasChildren && (
                  <div className="flex items-center gap-1 border-l border-border/30 pl-2">
                    {['target', 'initial_target', 'derived_target'].includes(item.node.kind) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          applyDoc(sortNodeChildren(doc, item.node.id, 'port'));
                        }}
                        className="text-[9px] font-bold text-cyan-400 bg-cyan-400/10 border border-cyan-400/25 rounded px-1.5 py-0.5 hover:bg-cyan-400/20 transition-colors"
                        title="Sort Ports Numerically"
                      >
                        123
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        applyDoc(sortNodeChildren(doc, item.node.id, 'alpha-asc'));
                      }}
                      className="text-[9px] font-bold text-zinc-400 bg-zinc-400/10 border border-zinc-400/25 rounded px-1.5 py-0.5 hover:bg-zinc-400/20 transition-colors"
                      title="Sort AZ Ascending"
                    >
                      A-Z
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        applyDoc(sortNodeChildren(doc, item.node.id, 'alpha-desc'));
                      }}
                      className="text-[9px] font-bold text-zinc-400 bg-zinc-400/10 border border-zinc-400/25 rounded px-1.5 py-0.5 hover:bg-zinc-400/20 transition-colors"
                      title="Sort AZ Descending"
                    >
                      Z-A
                    </button>
                  </div>
                )}

                {hasChildren && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCompileBlock(item.node);
                    }}
                    className="phantom-btn text-[9px] border-cyan-500/20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 py-0.5 px-1.5"
                    title="Compile and copy entire block of scripts"
                  >
                    {copiedCombinedId === item.node.id ? (
                      <Check className="size-3 text-emerald-500" />
                    ) : (
                      <Play className="size-3" />
                    )}
                    <span className="ml-1">Compile</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(lang === 'es' ? '¿Eliminar este bloque?' : 'Delete this block?')) {
                      applyDoc(removeMapNode(doc, item.node.id));
                      setSelectedId(null);
                    }
                  }}
                  className="text-rose-500 hover:bg-rose-500/10 p-1.5 rounded transition-colors"
                  title="Delete Node"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Inline attributes */}
            <div className="flex flex-wrap items-center gap-3 mt-2 pl-7 text-[10.5px]">
              {(item.node.kind === 'target' ||
                item.node.kind === 'initial_target' ||
                item.node.kind === 'derived_target' ||
                item.node.kind === 'attacker') && (
                <label className="flex items-center gap-1.5">
                  <span className="text-muted-foreground font-semibold">IP:</span>
                  <input
                    type="text"
                    value={item.node.ip ?? ''}
                    placeholder="10.10.10.X"
                    onChange={(e) => updateNodeField(item.node.id, { ip: e.target.value })}
                    className="phantom-field py-0.5 px-1.5 text-[10px] w-28 font-mono bg-background/50"
                  />
                </label>
              )}

              {item.node.kind === 'port' && (
                <label className="flex items-center gap-1.5">
                  <span className="text-muted-foreground font-semibold">Port:</span>
                  <input
                    type="number"
                    value={item.node.port ?? ''}
                    placeholder="80"
                    onChange={(e) =>
                      updateNodeField(item.node.id, {
                        port: e.target.value ? parseInt(e.target.value, 10) : undefined,
                      })
                    }
                    className="phantom-field py-0.5 px-1.5 text-[10px] w-16 font-mono bg-background/50"
                  />
                </label>
              )}

              {item.node.kind === 'service' && (
                <>
                  <label className="flex items-center gap-1.5">
                    <span className="text-muted-foreground font-semibold">Service:</span>
                    <input
                      type="text"
                      value={item.node.service ?? ''}
                      placeholder="http"
                      onChange={(e) => updateNodeField(item.node.id, { service: e.target.value })}
                      className="phantom-field py-0.5 px-1.5 text-[10px] w-24 bg-background/50"
                    />
                  </label>
                  <label className="flex items-center gap-1.5">
                    <span className="text-muted-foreground font-semibold">Port:</span>
                    <input
                      type="number"
                      value={item.node.port ?? ''}
                      onChange={(e) =>
                        updateNodeField(item.node.id, {
                          port: e.target.value ? parseInt(e.target.value, 10) : undefined,
                        })
                      }
                      className="phantom-field py-0.5 px-1.5 text-[10px] w-16 font-mono bg-background/50"
                    />
                  </label>
                </>
              )}

              {(item.node.url !== undefined ||
                ['service', 'vulnerability', 'exploit'].includes(item.node.kind)) && (
                <label className="flex items-center gap-1.5">
                  <span className="text-muted-foreground font-semibold">URL:</span>
                  <input
                    type="text"
                    value={item.node.url ?? ''}
                    placeholder="http://"
                    onChange={(e) => updateNodeField(item.node.id, { url: e.target.value })}
                    className="phantom-field py-0.5 px-1.5 text-[10px] w-48 bg-background/50"
                  />
                </label>
              )}

              {item.node.kind === 'route' && (
                <label className="flex items-center gap-1.5">
                  <span className="text-muted-foreground font-semibold">Route/Path:</span>
                  <input
                    type="text"
                    value={item.node.label ?? ''}
                    placeholder="/admin"
                    onChange={(e) => updateNodeField(item.node.id, { label: e.target.value })}
                    className="phantom-field py-0.5 px-1.5 text-[10px] w-48 font-mono bg-background/50"
                  />
                </label>
              )}

              {(item.node.kind === 'vulnerability' || item.node.kind === 'exploit') && (
                <label className="flex items-center gap-1.5">
                  <span className="text-muted-foreground font-semibold">CVE:</span>
                  <input
                    type="text"
                    value={item.node.cve ?? ''}
                    placeholder="CVE-2026-..."
                    onChange={(e) => updateNodeField(item.node.id, { cve: e.target.value })}
                    className="phantom-field py-0.5 px-1.5 text-[10px] w-28 font-mono bg-background/50"
                  />
                </label>
              )}

              {/* Multi-Target Victim Checklist for Commands */}
              {item.node.kind === 'command' && (
                <div className="flex flex-col gap-1.5 border border-border/40 p-2 rounded bg-background/30 max-w-sm">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">
                    Victim Target (Individual/Group):
                  </span>
                  <div className="max-h-24 overflow-y-auto space-y-1 pr-1 font-mono text-[9px]">
                    {Object.keys(doc.meta.targetGroups ?? {}).map((gname) => {
                      const isChecked = item.node.targetRefs?.includes(gname) ?? false;
                      return (
                        <label key={gname} className="flex items-center gap-1.5 cursor-pointer text-cyan-400 font-bold">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleTargetRef(item.node.id, gname)}
                            className="size-3 rounded border-border"
                          />
                          <span>[GROUP] {gname}</span>
                        </label>
                      );
                    })}
                    {victimHosts.map((vh) => {
                      const isChecked = item.node.targetRefs?.includes(vh.id) ?? false;
                      return (
                        <label key={vh.id} className="flex items-center gap-1.5 cursor-pointer text-foreground/80">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleTargetRef(item.node.id, vh.id)}
                            className="size-3 rounded border-border"
                          />
                          <span>{vh.label} {vh.ip ? `(${vh.ip})` : ''}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Row 3: Command & Terminal Script resolvers */}
            {(item.node.kind === 'command' || item.node.command != null) && (
              <div className="mt-2.5 pl-7 flex flex-col gap-2">
                {/* A. Target Host Discovered Attributes (Ports / Tech / Services) as Wildcards */}
                {item.node.targetRefs && item.node.targetRefs.length > 0 && (
                  (() => {
                    const discoveredPorts = getDiscoveredValuesForTargets(item.node.targetRefs, 'port');
                    const discoveredServices = getDiscoveredValuesForTargets(item.node.targetRefs, 'service');
                    const discoveredTechs = getDiscoveredValuesForTargets(item.node.targetRefs, 'tech');

                    const hasDiscovered = discoveredPorts.length > 0 || discoveredServices.length > 0 || discoveredTechs.length > 0;

                    if (!hasDiscovered) return null;

                    return (
                      <div className="p-2 border border-cyan-500/20 bg-cyan-500/5 rounded-lg flex flex-col gap-1.5 text-[10.5px]">
                        <span className="font-bold text-[9px] text-cyan-400 uppercase tracking-wide">
                          {lang === 'es' ? 'Atributos Detectados en Targets (Clic para agregar como local / comodín):' : 'Discovered in Targets (Click to add as local / wildcard):'}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          {discoveredPorts.map((p) => {
                            const isAdded = item.node.variables && item.node.variables['port'] === p;
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => {
                                  updateNodeVariable(item.node.id, 'port', p);
                                  if (item.node.command && !item.node.command.includes('{{port}}')) {
                                    updateNodeField(item.node.id, {
                                      command: item.node.command + ' -p {{port}}'
                                    });
                                  }
                                }}
                                className={`text-[8.5px] font-mono font-bold border rounded px-1.5 py-0.5 cursor-pointer flex items-center gap-1 transition-colors ${
                                  isAdded
                                    ? 'bg-cyan-500 text-black border-cyan-400'
                                    : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/35 hover:bg-cyan-500/20'
                                }`}
                              >
                                {isAdded ? '✓' : '+'} Port: {p}
                              </button>
                            );
                          })}

                          {discoveredServices.map((s) => {
                            const isAdded = item.node.variables && item.node.variables['service'] === s;
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => {
                                  updateNodeVariable(item.node.id, 'service', s);
                                  if (item.node.command && !item.node.command.includes('{{service}}')) {
                                    updateNodeField(item.node.id, {
                                      command: item.node.command + ' --service {{service}}'
                                    });
                                  }
                                }}
                                className={`text-[8.5px] font-mono font-bold border rounded px-1.5 py-0.5 cursor-pointer flex items-center gap-1 transition-colors ${
                                  isAdded
                                    ? 'bg-cyan-500 text-black border-cyan-400'
                                    : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/35 hover:bg-cyan-500/20'
                                }`}
                              >
                                {isAdded ? '✓' : '+'} Service: {s}
                              </button>
                            );
                          })}

                          {discoveredTechs.map((t) => {
                            const isAdded = item.node.variables && item.node.variables['tech'] === t;
                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() => {
                                  updateNodeVariable(item.node.id, 'tech', t);
                                  if (item.node.command && !item.node.command.includes('{{tech}}')) {
                                    updateNodeField(item.node.id, {
                                      command: item.node.command + ' --tech {{tech}}'
                                    });
                                  }
                                }}
                                className={`text-[8.5px] font-mono font-bold border rounded px-1.5 py-0.5 cursor-pointer flex items-center gap-1 transition-colors ${
                                  isAdded
                                    ? 'bg-cyan-500 text-black border-cyan-400'
                                    : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/35 hover:bg-cyan-500/20'
                                }`}
                              >
                                {isAdded ? '✓' : '+'} Tech: {t}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()
                )}

                <div className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed relative">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 mb-2 text-[9px] text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Terminal className="size-3 text-zinc-400" />
                      {lang === 'es' ? 'PLANTILLA DE COMANDO' : 'COMMAND TEMPLATE'}
                    </span>
                  </div>

                  <textarea
                    value={item.node.command ?? ''}
                    onChange={(e) => updateNodeField(item.node.id, { command: e.target.value })}
                    rows={1}
                    placeholder="nmap -p {{port}} {{target}}"
                    className="bg-transparent text-zinc-300 font-mono text-[11px] leading-normal outline-none border-none border-b border-dashed border-zinc-800 focus:border-zinc-600 focus:bg-zinc-900/40 rounded p-1 resize-y w-full placeholder:text-zinc-700"
                  />

                  <div className="mt-2.5 pt-2 border-t border-zinc-900 flex items-start justify-between gap-3 bg-zinc-900/30 rounded p-2 border border-zinc-900/60">
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wide block mb-0.5">
                        {lang === 'es' ? 'Comando Generado (Final)' : 'Compiled Output'}
                      </span>
                      <pre className="text-emerald-400 whitespace-pre-wrap break-all select-all font-mono leading-relaxed text-[11.5px]">
                        {resolveCommand(doc, item.node) || (
                          <span className="text-zinc-600 font-sans italic">
                            {lang === 'es' ? '(Resolviendo variables...)' : '(Empty command template)'}
                          </span>
                        )}
                      </pre>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyCommand(item.node, resolveCommand(doc, item.node))}
                      className="phantom-btn border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white p-1.5 mt-2 transition-all"
                      title="Copy compiled script"
                    >
                      {copiedNodeId === item.node.id ? (
                        <Check className="size-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Variable fields with discovered quick tags / wildcards */}
                {templateVars.length > 0 && (
                  <div className="flex flex-col gap-2 p-2.5 bg-muted/15 rounded-lg border border-border/40">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">
                      {lang === 'es' ? 'Variables del Comando:' : 'Vars for this Command:'}
                    </span>
                    <div className="flex flex-col gap-3">
                      {templateVars.map((v) => {
                        const resolvedVars = resolveNodeVariables(doc, item.node.id);
                        const currentVal = resolvedVars[v] ?? '';
                        const discoveredValues = getDiscoveredValuesForTargets(item.node.targetRefs, v);

                        return (
                          <div
                            key={v}
                            className="flex flex-col gap-1 border-b border-border/20 pb-2 last:border-0 last:pb-0"
                          >
                            <div className="flex items-center justify-between text-[10.5px]">
                              <span className="font-mono text-cyan-400 font-semibold">{v}</span>
                              <input
                                type="text"
                                value={currentVal}
                                placeholder="value"
                                onChange={(e) => {
                                  updateNodeVariable(item.node.id, v, e.target.value);
                                }}
                                className="phantom-field py-0.5 px-2 text-[10px] font-mono bg-background/50 w-36"
                              />
                            </div>

                            {/* Discovered attributes as wildcards */}
                            {discoveredValues.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1 mt-1 pl-2">
                                <span className="text-[8px] text-muted-foreground uppercase mr-1">
                                  {lang === 'es' ? 'Detectados:' : 'Discovered:'}
                                </span>
                                {discoveredValues.map((val) => (
                                  <button
                                    key={val}
                                    type="button"
                                    onClick={() => updateNodeVariable(item.node.id, v, val)}
                                    className="text-[8px] font-mono font-bold bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20 border border-cyan-500/30 rounded px-1.5 py-0.5 cursor-pointer transition-colors"
                                    title={lang === 'es' ? `Usar valor detectado: ${val}` : `Use discovered value: ${val}`}
                                  >
                                    {val}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    });
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex bg-background focus:outline-none select-none text-foreground font-sans overflow-hidden"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onDragLeave={() => {
        setDropIndicator(null);
        dropIndicatorRef.current = null;
      }}
    >
      {/* Playscript Canvas Editor */}
      <main className="flex-1 flex flex-col h-full overflow-hidden select-text relative">
        {/* Playbook Canvas header controls */}
        <header className="p-4 border-b border-border/60 flex items-center justify-between gap-4 shrink-0 bg-card/20 backdrop-blur-sm z-10 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="font-bold text-sm tracking-wide text-foreground">
              {doc.meta.name || (lang === 'es' ? 'Playbook del Pentest' : 'Pentest Playbook')}
            </span>

            {/* View Mode Switcher tabs */}
            <div className="flex items-center gap-0.5 bg-muted/60 border border-border/80 rounded-lg p-0.5 select-none shrink-0 sm:ml-4">
              <button
                type="button"
                onClick={() => setViewMode('topology')}
                className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-wide uppercase transition-all ${
                  viewMode === 'topology'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Topology
              </button>
              <button
                type="button"
                onClick={() => setViewMode('attack_chain')}
                className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-wide uppercase transition-all ${
                  viewMode === 'attack_chain'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Attack Chain
              </button>
              <button
                type="button"
                onClick={() => setViewMode('outline')}
                className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-wide uppercase transition-all ${
                  viewMode === 'outline'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Outline
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Collapse / Expand All triggers */}
            <button
              type="button"
              onClick={handleCollapseAll}
              className="phantom-btn border-border bg-muted/20 text-muted-foreground hover:bg-muted/40 py-1.5 px-3 text-xs"
              title="Collapse All Nodes"
            >
              {lang === 'es' ? 'Colapsar Todo' : 'Collapse All'}
            </button>
            <button
              type="button"
              onClick={handleExpandAll}
              className="phantom-btn border-border bg-muted/20 text-muted-foreground hover:bg-muted/40 py-1.5 px-3 text-xs"
              title="Expand All Nodes"
            >
              {lang === 'es' ? 'Expandir Todo' : 'Expand All'}
            </button>

            <button
              type="button"
              onClick={() => {
                const fields = buildDefaultNodeFields('attacker', lang);
                const newDoc = addMapNode(doc, {
                  ...fields,
                  label: lang === 'es' ? 'Máquina Atacante' : 'Attacker Machine',
                });
                applyDoc(newDoc);
                const last = newDoc.nodes[newDoc.nodes.length - 1];
                if (last) setSelectedId(last.id);
              }}
              className="phantom-btn border-slate-500/35 bg-slate-500/10 text-slate-600 dark:text-slate-400 hover:bg-slate-500/20 py-1.5 px-3 text-xs"
            >
              <Plus className="size-3.5 mr-1" />
              {lang === 'es' ? 'Agregar Atacante' : 'Add Attacker'}
            </button>

            <button
              type="button"
              onClick={() => {
                const fields = buildDefaultNodeFields('target', lang);
                const newDoc = addMapNode(doc, {
                  ...fields,
                  label: lang === 'es' ? 'Nuevo Target' : 'New Target',
                });
                applyDoc(newDoc);
                const last = newDoc.nodes[newDoc.nodes.length - 1];
                if (last) setSelectedId(last.id);
              }}
              className="phantom-btn border-orange-500/35 bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 py-1.5 px-3 text-xs"
            >
              <Plus className="size-3.5 mr-1" />
              {lang === 'es' ? 'Agregar Host' : 'Add Host'}
            </button>

            <button
              type="button"
              onClick={() => {
                const commands = doc.nodes
                  .filter((n) => n.kind === 'command' || n.command != null)
                  .map((n) => resolveCommand(doc, n))
                  .filter(Boolean);
                navigator.clipboard.writeText(commands.join('\n'));
                alert(lang === 'es' ? 'Playbook completo copiado al portapapeles' : 'Full playbook script copied!');
              }}
              className="phantom-btn border-cyan-500/35 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 py-1.5 px-3 text-xs"
            >
              <Copy className="size-3.5 mr-1" />
              {lang === 'es' ? 'Copiar Script Completo' : 'Copy Full Script'}
            </button>
          </div>
        </header>

        {/* Dynamic Canvas Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="max-w-4xl mx-auto space-y-6">

            {/* INTEGRATED HORIZONTAL VARIABLES & SCOPES PANEL (Replaces the left sidebar) */}
            <Card className="border-border/60 bg-card/45 backdrop-blur shadow-md select-text">
              <CardHeader className="p-4 border-b border-border/50 flex flex-row items-center gap-2">
                <Sliders className="size-4 text-cyan-400 shrink-0" />
                <div>
                  <CardTitle className="text-xs uppercase tracking-widest">
                    {lang === 'es' ? 'Variables y Configuración del Playbook' : 'Playbook Variables & Scope Setup'}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Global Scope Column */}
                <div className="space-y-2 border-r border-border/20 pr-4 last:border-r-0">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block flex items-center gap-1.5">
                    🌐 Global Scope
                  </span>
                  <div className="space-y-3">
                    {Object.keys(doc.meta.variables ?? {}).length > 0 ? (
                      <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                        {Object.entries(doc.meta.variables ?? {}).map(([key, val]) => (
                          <div key={key} className="flex flex-col gap-0.5">
                            <div className="flex items-center justify-between text-[9.5px]">
                              <span className="font-mono text-cyan-400 font-semibold">{`{{${key}}}`}</span>
                              <button
                                type="button"
                                onClick={() => deleteGlobalVariable(key)}
                                className="text-rose-500 hover:text-rose-400 font-bold p-0.5"
                                title="Delete Variable"
                              >
                                ✕
                              </button>
                            </div>
                            <input
                              type="text"
                              value={val}
                              onChange={(e) => updateGlobalVariable(key, e.target.value)}
                              className="phantom-field py-0.5 px-2 text-[10.5px] font-mono bg-background"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground italic">
                        {lang === 'es' ? 'Sin variables globales.' : 'No global variables defined.'}
                      </p>
                    )}

                    <form onSubmit={addGlobalVariable} className="pt-2 border-t border-border/20 flex gap-1">
                      <input
                        type="text"
                        placeholder="Key"
                        value={newVarName}
                        onChange={(e) => setNewVarName(e.target.value)}
                        className="phantom-field flex-1 py-1 px-1.5 text-[10px] font-mono"
                      />
                      <input
                        type="text"
                        placeholder="Value"
                        value={newVarValue}
                        onChange={(e) => setNewVarValue(e.target.value)}
                        className="phantom-field flex-1 py-1 px-1.5 text-[10px]"
                      />
                      <button
                        type="submit"
                        className="phantom-btn border-primary/30 bg-primary/10 text-primary p-1 hover:bg-primary/20 shrink-0"
                      >
                        <Plus className="size-3" />
                      </button>
                    </form>
                  </div>
                </div>

                {/* 2. Target Groups Column */}
                <div className="space-y-2 border-r border-border/20 pr-4 last:border-r-0">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block flex items-center gap-1.5">
                    <FolderKanban className="size-3.5 text-cyan-400" />
                    🎯 Target Groups (Lists)
                  </span>
                  <div className="space-y-3">
                    {Object.keys(doc.meta.targetGroups ?? {}).length > 0 ? (
                      <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                        {Object.entries(doc.meta.targetGroups ?? {}).map(([gname, gTargets]) => (
                          <div key={gname} className="flex items-center justify-between p-1 rounded bg-background/50 border border-border/25 text-[9.5px]">
                            <span className="font-bold text-foreground font-mono truncate mr-2">{gname}</span>
                            <span className="text-[8px] text-zinc-500 shrink-0">{gTargets.length} hosts</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteTargetGroup(gname)}
                              className="text-rose-500 hover:text-rose-400 font-bold px-1 ml-2"
                              title="Delete Group"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground italic">
                        {lang === 'es' ? 'Sin grupos creados.' : 'No target groups created.'}
                      </p>
                    )}

                    {victimHosts.length > 0 ? (
                      <form onSubmit={handleAddTargetGroup} className="pt-2 border-t border-border/20 space-y-1.5">
                        <input
                          type="text"
                          placeholder="Nombre grupo (ej. web)"
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          className="phantom-field w-full py-1 px-1.5 text-[9.5px] font-mono"
                        />
                        <div className="max-h-20 overflow-y-auto space-y-1 border border-border/45 rounded p-1 bg-background/30 pr-1">
                          {victimHosts.map((vh) => (
                            <label key={vh.id} className="flex items-center gap-1.5 text-[9px] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedGroupTargets.has(vh.id)}
                                onChange={() => handleToggleTargetInNewGroup(vh.id)}
                                className="size-3 rounded border-border"
                              />
                              <span className="truncate">{vh.label}</span>
                            </label>
                          ))}
                        </div>
                        <button
                          type="submit"
                          disabled={!newGroupName.trim() || selectedGroupTargets.size === 0}
                          className="phantom-btn text-[9px] w-full justify-center bg-cyan-600/10 border-cyan-500/35 text-cyan-400 hover:bg-cyan-500/20 py-0.5"
                        >
                          <Plus className="size-2.5 mr-0.5" />
                          {lang === 'es' ? 'Crear Grupo' : 'Add Group'}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>

                {/* 3. Selected Node Variable Scope Column */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block flex items-center gap-1.5">
                    ⚡ Node Scope: {selectedId ? (allFlatItems.find((f) => f.node.id === selectedId)?.node.label || 'Selected') : 'None'}
                  </span>
                  <div className="space-y-2">
                    {selectedId ? (
                      (() => {
                        const node = doc.nodes.find((n) => n.id === selectedId);
                        const nodeVars = node?.variables ?? {};
                        return (
                          <div className="space-y-2">
                            {Object.keys(nodeVars).length > 0 ? (
                              <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                                {Object.entries(nodeVars).map(([key, val]) => (
                                  <div key={key} className="flex items-center justify-between gap-1.5 text-[9.5px]">
                                    <span className="font-mono text-cyan-400 truncate shrink-0">{key}:</span>
                                    <input
                                      type="text"
                                      value={val}
                                      onChange={(e) => updateNodeVariable(selectedId, key, e.target.value)}
                                      className="phantom-field py-0.5 px-1.5 text-[9px] font-mono bg-background flex-1 text-right"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => deleteNodeVariable(selectedId, key)}
                                      className="text-rose-500 hover:text-rose-400 font-bold px-0.5 shrink-0"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[9.5px] text-muted-foreground italic">
                                {lang === 'es' ? 'Sin variables locales.' : 'No local variables.'}
                              </p>
                            )}
                            <div className="flex gap-1.5 pt-1.5 border-t border-border/20">
                              <button
                                type="button"
                                onClick={() => {
                                  const name = prompt(lang === 'es' ? 'Nombre de la variable:' : 'Variable name:');
                                  if (name) addNodeVariable(selectedId, name, 'value');
                                }}
                                className="phantom-btn text-[9px] w-full justify-center bg-cyan-600/10 border-cyan-500/35 text-cyan-400 hover:bg-cyan-500/20 py-0.5"
                              >
                                <Plus className="size-2.5 mr-1" />
                                {lang === 'es' ? 'Agregar local' : 'Add local'}
                              </button>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <p className="text-[9.5px] text-muted-foreground italic leading-normal">
                        {lang === 'es'
                          ? 'Selecciona un bloque en el outline para ver y editar sus variables locales.'
                          : 'Select an outline card to view and manage its local variables.'}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Keyboard shortcuts hints bar */}
            <div className="flex items-center justify-between text-[10px] text-muted-foreground border-b border-border/30 pb-2 px-1">
              <span>Outline Block</span>
              <span className="flex items-center gap-2">
                <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                  Drag
                </span>
                {lang === 'es' ? 'Arrastrar bloques ·' : 'Drag blocks ·'}
                <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                  Tab
                </span>
                {lang === 'es' ? 'Anidar ·' : 'Indent ·'}
                <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                  Shift+Tab
                </span>
                {lang === 'es' ? 'Desanidar' : 'Outdent'}
              </span>
            </div>

            {/* SECTION 1: ATTACKERS & RED TEAMS PLAYBOOKS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-muted/30 border border-border/40 rounded-xl px-4 py-2.5 shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <ShieldAlert className="size-4 text-slate-500 animate-pulse" />
                  🛡️ {lang === 'es' ? 'Equipos Atacantes / Playbooks' : 'Attack Teams / Playbooks'}
                  <span className="ml-1 bg-slate-500/10 text-slate-400 px-1.5 py-0.5 text-[10px] rounded font-bold">
                    {attackerRoots.length}
                  </span>
                </h3>
                {attackerRoots.length > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => applyDoc(sortRootNodes(doc, 'attacker', 'alpha-asc'))}
                      className="text-[9px] font-bold text-zinc-400 bg-zinc-400/10 border border-zinc-400/25 rounded px-2 py-0.5 hover:bg-zinc-400/20 transition-colors"
                      title="Sort Attackers A-Z"
                    >
                      A-Z
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDoc(sortRootNodes(doc, 'attacker', 'alpha-desc'))}
                      className="text-[9px] font-bold text-zinc-400 bg-zinc-400/10 border border-zinc-400/25 rounded px-2 py-0.5 hover:bg-zinc-400/20 transition-colors"
                      title="Sort Attackers Z-A"
                    >
                      Z-A
                    </button>
                  </div>
                )}
              </div>
              {attackerItems.length > 0 ? (
                <div className="space-y-2.5">{renderFlatListItems(attackerItems)}</div>
              ) : (
                <p className="text-[10px] text-muted-foreground italic px-4 py-2 border border-dashed border-border/50 rounded-lg">
                  {lang === 'es'
                    ? 'Sin equipos atacantes agregados. Haz clic en "Add Attacker" arriba para agregar uno.'
                    : 'No attack teams configured yet. Click "Add Attacker" above to insert one.'}
                </p>
              )}
            </div>

            {/* SECTION 2: VICTIM TARGETS & SYSTEMS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-muted/30 border border-border/40 rounded-xl px-4 py-2.5 shadow-sm">
                <h3 className="text-xs font-bold text-orange-400 uppercase tracking-widest flex items-center gap-2">
                  <Target className="size-4 text-orange-500" />
                  🎯 {lang === 'es' ? 'Infraestructura Objetivo / Víctimas' : 'Target Infrastructure / Victims'}
                  <span className="ml-1 bg-orange-500/10 text-orange-400 px-1.5 py-0.5 text-[10px] rounded font-bold">
                    {victimRoots.length}
                  </span>
                </h3>
                {victimRoots.length > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => applyDoc(sortRootNodes(doc, 'victim', 'ip'))}
                      className="text-[9px] font-bold text-cyan-400 bg-cyan-400/10 border border-cyan-400/25 rounded px-2 py-0.5 hover:bg-cyan-400/20 transition-colors"
                      title="Sort Targets by IP"
                    >
                      IP
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDoc(sortRootNodes(doc, 'victim', 'alpha-asc'))}
                      className="text-[9px] font-bold text-zinc-400 bg-zinc-400/10 border border-zinc-400/25 rounded px-2 py-0.5 hover:bg-zinc-400/20 transition-colors"
                      title="Sort Targets A-Z"
                    >
                      A-Z
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDoc(sortRootNodes(doc, 'victim', 'alpha-desc'))}
                      className="text-[9px] font-bold text-zinc-400 bg-zinc-400/10 border border-zinc-400/25 rounded px-2 py-0.5 hover:bg-zinc-400/20 transition-colors"
                      title="Sort Targets Z-A"
                    >
                      Z-A
                    </button>
                  </div>
                )}
              </div>
              {victimItems.length > 0 ? (
                <div className="space-y-2.5">{renderFlatListItems(victimItems)}</div>
              ) : (
                <p className="text-[10px] text-muted-foreground italic px-4 py-2 border border-dashed border-border/50 rounded-lg">
                  {lang === 'es'
                    ? 'Sin hosts objetivos agregados. Haz clic en "Add Host" arriba para agregar uno.'
                    : 'No target hosts configured yet. Click "Add Host" above to insert one.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
