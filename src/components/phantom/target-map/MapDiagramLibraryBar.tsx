'use client';

import { Copy, Layers, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UiMessageKey } from '@/lib/ui-locale';
import type { MapDiagramSummary } from '@/lib/pentest-target-map-library';

type Props = {
  summaries: MapDiagramSummary[];
  activeId?: string;
  t: (key: UiMessageKey) => string;
  onNew: () => void;
  onSwitch: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
};

export function MapDiagramLibraryBar({
  summaries,
  activeId,
  t,
  onNew,
  onSwitch,
  onDuplicate,
  onDelete,
}: Props) {
  return (
    <section className="phantom-map-diagram-bar border-b border-[var(--phantom-panel-border)]">
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Layers className="size-3.5 shrink-0 text-primary" />
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-foreground">
            {t('phantomMapTabDiagrams')}
          </p>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="phantom-btn shrink-0 px-2 py-1 text-[10px]"
          title={t('phantomMapNewDiagram')}
        >
          <Plus className="size-3" />
          {t('phantomMapNewDiagram')}
        </button>
      </div>

      {summaries.length === 0 ? (
        <p className="px-3 pb-3 text-[10px] text-muted-foreground">{t('phantomMapDiagramsEmpty')}</p>
      ) : (
        <ul className="max-h-36 space-y-1 overflow-y-auto px-2 pb-2">
          {summaries.map((summary) => {
            const active = summary.id === activeId;
            return (
              <li
                key={summary.id}
                className={cn(
                  'group rounded-lg border px-2 py-1.5 transition-colors',
                  active
                    ? 'border-primary/40 bg-primary/8 ring-1 ring-primary/25'
                    : 'border-transparent hover:border-border/60 hover:bg-muted/30'
                )}
              >
                <div className="flex items-start gap-1">
                  <button
                    type="button"
                    onClick={() => onSwitch(summary.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-xs font-medium text-foreground">{summary.name}</p>
                    <p className="text-[9px] text-muted-foreground">
                      {summary.nodeCount} · {summary.platform ?? 'custom'}
                    </p>
                  </button>
                  <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      title={t('phantomMapDuplicateDiagram')}
                      onClick={() => onDuplicate(summary.id)}
                      className="rounded p-1 text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="size-3" />
                    </button>
                    <button
                      type="button"
                      title={t('phantomMapDeleteDiagram')}
                      onClick={() => onDelete(summary.id)}
                      className="rounded p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
