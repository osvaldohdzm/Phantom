'use client';

import { ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MAP_KIND_LEGEND, getMapNodeIconDataUri } from '@/lib/pentest-target-map-icons';
import type { PentestMapNodeKind } from '@/lib/pentest-target-map-schema';

type Props = {
  isDark: boolean;
  uiLanguage: 'es' | 'en';
  title: string;
  hint: string;
  filterLabel: string;
  showAllLabel: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  hiddenKinds: Set<PentestMapNodeKind>;
  onToggleKind: (kind: PentestMapNodeKind) => void;
  onShowAll: () => void;
  counts: Partial<Record<PentestMapNodeKind, number>>;
};

export function MapLegendFilter({
  isDark,
  uiLanguage,
  title,
  hint,
  filterLabel,
  showAllLabel,
  collapsed,
  onToggleCollapsed,
  hiddenKinds,
  onToggleKind,
  onShowAll,
  counts,
}: Props) {
  const hiddenCount = hiddenKinds.size;

  return (
    <div className={cn('phantom-map-legend phantom-map-legend--filter pointer-events-auto', collapsed && 'phantom-map-legend--collapsed')}>
      <button type="button" onClick={onToggleCollapsed} className="phantom-map-legend-toggle">
        <span className="flex items-center gap-1.5">
          <Filter className="size-3 text-[var(--phantom-accent)]" />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">{title}</span>
          {hiddenCount > 0 ? (
            <span className="rounded-full bg-[var(--phantom-accent)]/15 px-1.5 py-0.5 text-[8px] font-bold text-[var(--phantom-accent)]">
              {hiddenCount}
            </span>
          ) : null}
        </span>
        {collapsed ? <ChevronUp className="size-3.5 text-muted-foreground" /> : <ChevronDown className="size-3.5 text-muted-foreground" />}
      </button>
      {!collapsed ? (
        <>
          <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">{hint}</p>
          <p className="mt-1.5 text-[8px] font-medium uppercase tracking-wide text-muted-foreground">{filterLabel}</p>
          {hiddenCount > 0 ? (
            <button type="button" onClick={onShowAll} className="phantom-map-legend-show-all">
              {showAllLabel}
            </button>
          ) : null}
          <div className="phantom-map-legend-grid">
            {MAP_KIND_LEGEND.map((item) => {
              const count = counts[item.kind] ?? 0;
              if (!count) return null;
              const hidden = hiddenKinds.has(item.kind);
              return (
                <button
                  key={item.kind}
                  type="button"
                  onClick={() => onToggleKind(item.kind)}
                  className={cn('phantom-map-legend-item phantom-map-legend-item--btn', hidden && 'phantom-map-legend-item--hidden')}
                  title={hidden ? showAllLabel : filterLabel}
                >
                  <img src={getMapNodeIconDataUri(item.kind, isDark)} alt="" />
                  <span>{uiLanguage === 'es' ? item.labelEs : item.labelEn}</span>
                  <span className="ml-auto font-mono text-[8px] text-muted-foreground">{count}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
