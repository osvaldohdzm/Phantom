'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { searchMapNodes, type MapSearchHit } from '@/lib/pentest-map-path-highlight';
import type { PentestTargetMapDocument } from '@/lib/pentest-target-map-schema';
import { getMapNodeIconDataUri } from '@/lib/pentest-target-map-icons';

type Props = {
  doc: PentestTargetMapDocument;
  isDark: boolean;
  placeholder: string;
  onFocusNode: (id: string) => void;
  className?: string;
};

export function MapSearchBar({ doc, isDark, placeholder, onFocusNode, className }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const hits = searchMapNodes(doc, query);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = (hit: MapSearchHit) => {
    onFocusNode(hit.id);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className={cn('phantom-map-search', className)}>
      <Search className="size-3.5 shrink-0 text-muted-foreground" />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="phantom-map-search-input"
        spellCheck={false}
      />
      {query ? (
        <button
          type="button"
          onClick={() => {
            setQuery('');
            setOpen(false);
          }}
          className="phantom-map-search-clear"
          aria-label="Clear"
        >
          <X className="size-3" />
        </button>
      ) : null}
      {open && query.trim() && hits.length > 0 ? (
        <ul className="phantom-map-search-results">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button type="button" onClick={() => pick(hit)} className="phantom-map-search-hit">
                <img src={getMapNodeIconDataUri(hit.kind, isDark)} alt="" className="size-5 shrink-0" />
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[11px] font-medium text-foreground">{hit.label}</span>
                  {hit.subtitle ? (
                    <span className="block truncate font-mono text-[9px] text-muted-foreground">{hit.subtitle}</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-[9px] uppercase text-muted-foreground">{hit.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && query.trim() && hits.length === 0 ? (
        <p className="phantom-map-search-empty">—</p>
      ) : null}
    </div>
  );
}
