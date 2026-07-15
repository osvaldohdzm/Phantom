'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  buildDefaultNodeFields,
  filterMapKinds,
  kindLabel,
  resolveSlashCommand,
  type MapKindCatalogEntry,
} from '@/lib/pentest-target-map-kinds';
import { filterMapTemplates, type MapTemplateId } from '@/lib/pentest-target-map-templates';
import { getMapNodeIconDataUri } from '@/lib/pentest-target-map-icons';
import type { PentestMapNodeKind } from '@/lib/pentest-target-map-schema';
import type { MapViewMode } from '@/lib/pentest-map-attack-graph';

import { useTouchDevice } from '@/hooks/use-touch-device';

type Props = {
  x: number;
  y: number;
  isDark: boolean;
  uiLanguage: 'es' | 'en';
  viewMode: MapViewMode;
  connectFrom?: string;
  connectFromKind?: PentestMapNodeKind;
  hasInitialTarget?: boolean;
  insideTarget?: boolean;
  title: string;
  searchPlaceholder: string;
  templatesLabel: string;
  onPickKind: (kind: PentestMapNodeKind) => void;
  onPickTemplate: (id: MapTemplateId) => void;
  onClose: () => void;
};

export function MapAddNodePopover({
  x,
  y,
  isDark,
  uiLanguage,
  viewMode,
  connectFrom,
  connectFromKind,
  hasInitialTarget = false,
  insideTarget = false,
  title,
  searchPlaceholder,
  templatesLabel,
  onPickKind,
  onPickTemplate,
  onClose,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const { isTouchDevice } = useTouchDevice();

  const kinds = useMemo(() => filterMapKinds(query, uiLanguage, viewMode, connectFromKind ?? null, hasInitialTarget, insideTarget), [query, uiLanguage, viewMode, connectFromKind, hasInitialTarget, insideTarget]);
  const templates = useMemo(() => filterMapTemplates(query, uiLanguage), [query, uiLanguage]);

  useEffect(() => {
    // Only auto-focus inputs on non-touch devices to avoid bringing up touch keyboard immediately
    if (!isTouchDevice) {
      inputRef.current?.focus();
    }
  }, [isTouchDevice]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: PointerEvent) => {
      // For desktop/pointer close behavior
      if (!isTouchDevice && rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [onClose, isTouchDevice]);

  const handleSubmit = () => {
    const slash = resolveSlashCommand(query);
    if (slash) {
      onPickKind(slash);
      return;
    }
    const first = kinds[0];
    if (first) onPickKind(first.kind);
  };

  const clampedX = Math.min(Math.max(x, 12), typeof window !== 'undefined' ? window.innerWidth - 280 : x);
  const clampedY = Math.min(Math.max(y, 12), typeof window !== 'undefined' ? window.innerHeight - 360 : y);

  const popoverContent = (
    <div
      ref={rootRef}
      className={cn(
        'phantom-map-add-popover',
        isTouchDevice && 'phantom-map-add-popover--touch'
      )}
      style={isTouchDevice ? undefined : { left: clampedX, top: clampedY }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <p className="phantom-map-add-popover-title">{title}</p>
      {connectFrom ? (
        <p className="mb-2 text-xs text-muted-foreground">
          {uiLanguage === 'es' ? '→ conectar con nodo seleccionado' : '→ connect with selected node'}
        </p>
      ) : null}
      <label className="phantom-map-add-search">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={searchPlaceholder}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>
      <ul className="phantom-map-add-list">
        {kinds.map((entry) => (
          <KindRow
            key={entry.kind}
            entry={entry}
            isDark={isDark}
            uiLanguage={uiLanguage}
            onPick={() => onPickKind(entry.kind)}
          />
        ))}
      </ul>
      {templates.length > 0 ? (
        <>
          <p className="phantom-map-add-section">{templatesLabel}</p>
          <ul className="phantom-map-add-list">
            {templates.map((tpl) => (
              <li key={tpl.id}>
                <button
                  type="button"
                  className="phantom-map-add-item w-full text-left"
                  onClick={() => onPickTemplate(tpl.id)}
                >
                  <span className="text-sm font-medium">
                    {uiLanguage === 'es' ? tpl.labelEs : tpl.labelEn}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );

  if (isTouchDevice) {
    return (
      <>
        <div className="phantom-map-inspector-backdrop" onClick={onClose} />
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto">
            {popoverContent}
          </div>
        </div>
      </>
    );
  }

  return popoverContent;
}

function KindRow({
  entry,
  isDark,
  uiLanguage,
  onPick,
}: {
  entry: MapKindCatalogEntry;
  isDark: boolean;
  uiLanguage: 'es' | 'en';
  onPick: () => void;
}) {
  return (
    <li>
      <button type="button" className="phantom-map-add-item w-full" onClick={onPick}>
        <img src={getMapNodeIconDataUri(entry.kind, isDark)} alt="" className="size-6 shrink-0" />
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-sm font-semibold">{kindLabel(entry, uiLanguage)}</span>
          <span className="block truncate font-mono text-[11px] text-muted-foreground">
            {entry.slash[0]} · {uiLanguage === 'es' ? entry.defaultLabelEs : entry.defaultLabelEn}
          </span>
        </span>
      </button>
    </li>
  );
}
