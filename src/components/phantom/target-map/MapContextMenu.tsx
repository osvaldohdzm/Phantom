'use client';

import { useEffect, useRef } from 'react';
import { Copy, GitBranch, LayoutGrid, Pencil, Plus, Trash2, Undo2, Shield, Router, Terminal, Zap, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MapViewMode } from '@/lib/pentest-map-attack-graph';

export type MapContextMenuState =
  | { type: 'canvas'; x: number; y: number; canvasX: number; canvasY: number }
  | { type: 'node'; x: number; y: number; nodeId: string }
  | { type: 'edge'; x: number; y: number; edgeId: string; canvasX: number; canvasY: number };

type Labels = {
  addNode: string;
  autoArrange: string;
  undo: string;
  duplicate: string;
  delete: string;
  connect: string;
  edit: string;
  copyCommand?: string;
};

type Props = {
  menu: MapContextMenuState;
  isTouchDevice?: boolean;
  labels: Labels;
  canUndo: boolean;
  viewMode?: MapViewMode;
  onAddNode: () => void;
  onAutoArrange: () => void;
  onUndo: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onConnect?: () => void;
  onEdit?: () => void;
  onClose: () => void;
  onCopyCommand?: () => void;
  isCommandNode?: boolean;
  onInsertOnEdge?: (kind: string) => void;
  onDeleteEdge?: () => void;
  onEditEdge?: () => void;
};

export function MapContextMenu({
  menu,
  isTouchDevice,
  labels,
  canUndo,
  viewMode,
  onAddNode,
  onAutoArrange,
  onUndo,
  onDuplicate,
  onDelete,
  onConnect,
  onEdit,
  onClose,
  onCopyCommand,
  isCommandNode,
  onInsertOnEdge,
  onDeleteEdge,
  onEditEdge,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [onClose]);

  let menuItems: React.ReactNode;

  if (menu.type === 'edge') {
    const isAttackChain = viewMode === 'attack_chain';
    menuItems = (
      <>
        {isAttackChain ? (
          <>
            <MenuBtn icon={<Terminal className="size-3.5" />} label="+ Command" onClick={() => onInsertOnEdge?.('command')} touch={isTouchDevice} />
            <MenuBtn icon={<Zap className="size-3.5" />} label="+ Exploit" onClick={() => onInsertOnEdge?.('exploit')} touch={isTouchDevice} />
            <MenuBtn icon={<Layers className="size-3.5" />} label="+ Pivot" onClick={() => onInsertOnEdge?.('pivot')} touch={isTouchDevice} />
          </>
        ) : (
          <>
            <MenuBtn icon={<Shield className="size-3.5" />} label="+ WAF / Firewall" onClick={() => onInsertOnEdge?.('firewall')} touch={isTouchDevice} />
            <MenuBtn icon={<Router className="size-3.5" />} label="+ Router / Gateway" onClick={() => onInsertOnEdge?.('router')} touch={isTouchDevice} />
            <MenuBtn icon={<GitBranch className="size-3.5" />} label="+ Host (Pivoting)" onClick={() => onInsertOnEdge?.('pivot_host')} touch={isTouchDevice} />
          </>
        )}
        <div className="my-1 h-px bg-border" />
        <MenuBtn icon={<Pencil className="size-3.5" />} label={labels.edit} onClick={() => onEditEdge?.()} touch={isTouchDevice} />
        <MenuBtn
          icon={<Trash2 className="size-3.5" />}
          label={labels.delete}
          onClick={() => onDeleteEdge?.()}
          danger
          touch={isTouchDevice}
        />
      </>
    );
  } else {
    menuItems = (
      <>
        <MenuBtn icon={<Plus className="size-3.5" />} label={labels.addNode} onClick={onAddNode} touch={isTouchDevice} />
        {menu.type === 'node' ? (
          <>
            <MenuBtn icon={<Pencil className="size-3.5" />} label={labels.edit} onClick={() => onEdit?.()} touch={isTouchDevice} />
            {isCommandNode && onCopyCommand && (
              <MenuBtn icon={<Copy className="size-3.5" />} label={labels.copyCommand || 'Copy Command'} onClick={onCopyCommand} touch={isTouchDevice} />
            )}
            <MenuBtn icon={<Copy className="size-3.5" />} label={labels.duplicate} onClick={() => onDuplicate?.()} touch={isTouchDevice} />
            <MenuBtn icon={<GitBranch className="size-3.5" />} label={labels.connect} onClick={() => onConnect?.()} touch={isTouchDevice} />
            <MenuBtn
              icon={<Trash2 className="size-3.5" />}
              label={labels.delete}
              onClick={() => onDelete?.()}
              danger
              touch={isTouchDevice}
            />
          </>
        ) : null}
        <div className="my-1 h-px bg-border" />
        <MenuBtn
          icon={<Undo2 className="size-3.5" />}
          label={labels.undo}
          onClick={onUndo}
          disabled={!canUndo}
          touch={isTouchDevice}
        />
        <MenuBtn icon={<LayoutGrid className="size-3.5" />} label={labels.autoArrange} onClick={onAutoArrange} touch={isTouchDevice} />
      </>
    );
  }

  // On touch devices, show as a bottom sheet
  if (isTouchDevice) {
    return (
      <>
        <div className="phantom-map-context-backdrop" onClick={onClose} />
        <div
          ref={ref}
          className="phantom-map-context-menu phantom-map-context-menu--touch"
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="phantom-map-inspector-drag-handle" />
          {menuItems}
        </div>
      </>
    );
  }

  const clampedX = Math.min(menu.x, typeof window !== 'undefined' ? window.innerWidth - 200 : menu.x);
  const clampedY = Math.min(menu.y, typeof window !== 'undefined' ? window.innerHeight - 280 : menu.y);

  return (
    <div
      ref={ref}
      className="phantom-map-context-menu"
      style={{ left: clampedX, top: clampedY }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menuItems}
    </div>
  );
}

function MenuBtn({
  icon,
  label,
  onClick,
  danger,
  disabled,
  touch,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  touch?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'phantom-map-context-item',
        touch && 'phantom-map-context-item--touch',
        danger && 'text-destructive',
        disabled && 'pointer-events-none opacity-40'
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
