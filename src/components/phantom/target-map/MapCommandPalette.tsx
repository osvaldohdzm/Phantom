'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGrid, Plus, Search, Target, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PentestMapNodeKind, PentestMapNode } from '@/lib/pentest-target-map-schema';
import { filterMapKinds, kindLabel } from '@/lib/pentest-target-map-kinds';
import type { MapTemplateId } from '@/lib/pentest-target-map-templates';
import { MAP_NODE_TEMPLATES } from '@/lib/pentest-target-map-templates';

export type MapPaletteAction =
  | { type: 'create'; kind: PentestMapNodeKind }
  | { type: 'template'; id: MapTemplateId }
  | { type: 'find'; nodeId: string }
  | { type: 'autoLayout' }
  | { type: 'undo' };

type Props = {
  open: boolean;
  uiLanguage: 'es' | 'en';
  nodes: PentestMapNode[];
  canUndo: boolean;
  labels: {
    placeholder: string;
    createHost: string;
    createPort: string;
    createCommand: string;
    findNode: string;
    autoLayout: string;
    undo: string;
    templates: string;
  };
  onAction: (action: MapPaletteAction) => void;
  onClose: () => void;
};

export function MapCommandPalette({ open, uiLanguage, nodes, canUndo, labels, onAction, onClose }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const staticActions = useMemo(
    () => [
      { id: 'host', icon: Target, label: labels.createHost, action: { type: 'create' as const, kind: 'target' as const } },
      { id: 'port', icon: Plus, label: labels.createPort, action: { type: 'create' as const, kind: 'port' as const } },
      { id: 'cmd', icon: Plus, label: labels.createCommand, action: { type: 'create' as const, kind: 'command' as const } },
      { id: 'layout', icon: LayoutGrid, label: labels.autoLayout, action: { type: 'autoLayout' as const } },
      { id: 'undo', icon: Undo2, label: labels.undo, action: { type: 'undo' as const }, disabled: !canUndo },
    ],
    [labels, canUndo]
  );

  const nodeHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return nodes
      .filter((n) => n.label.toLowerCase().includes(q) || n.kind.includes(q) || n.id.includes(q))
      .slice(0, 8);
  }, [nodes, query]);

  const kindHits = useMemo(() => filterMapKinds(query, uiLanguage).slice(0, 6), [query, uiLanguage]);

  if (!open) return null;

  return (
    <div className="phantom-map-palette-backdrop" onClick={onClose}>
      <div
        className="phantom-map-palette"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <label className="phantom-map-palette-search">
          <Search className="size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={labels.placeholder}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <kbd className="phantom-map-kbd">Esc</kbd>
        </label>

        {query.trim() ? (
          <div className="phantom-map-palette-section">
            {nodeHits.length > 0 ? (
              <>
                <p className="phantom-map-palette-heading">{labels.findNode}</p>
                {nodeHits.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className="phantom-map-palette-item"
                    onClick={() => onAction({ type: 'find', nodeId: n.id })}
                  >
                    <span className="font-medium">{n.label}</span>
                    <span className="text-[10px] text-muted-foreground">{n.kind}</span>
                  </button>
                ))}
              </>
            ) : null}
            {kindHits.map((k) => (
              <button
                key={k.kind}
                type="button"
                className="phantom-map-palette-item"
                onClick={() => onAction({ type: 'create', kind: k.kind })}
              >
                <span>{kindLabel(k, uiLanguage)}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{k.slash[0]}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="phantom-map-palette-section">
            {staticActions.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={item.disabled}
                className={cn('phantom-map-palette-item', item.disabled && 'opacity-40')}
                onClick={() => onAction(item.action)}
              >
                <item.icon className="size-3.5 shrink-0 text-primary" />
                <span>{item.label}</span>
              </button>
            ))}
            <p className="phantom-map-palette-heading mt-2">{labels.templates}</p>
            {MAP_NODE_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className="phantom-map-palette-item"
                onClick={() => onAction({ type: 'template', id: tpl.id })}
              >
                <span className="text-xs">{uiLanguage === 'es' ? tpl.labelEs : tpl.labelEn}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
