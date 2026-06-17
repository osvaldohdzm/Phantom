'use client';

import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Finding, Severity } from '@/lib/secops-api';
import type { FindingGroup } from '@/lib/finding-grouping';

const SEVERITY_COLORS: Record<Severity, string> = {
  Critical: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  High: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  Medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  Low: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  Info: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
};

const SEVERITY_LABEL: Record<Severity, string> = {
  Critical: 'Crítica',
  High: 'Alta',
  Medium: 'Media',
  Low: 'Baja',
  Info: 'Info',
};

type GroupedFindingsViewProps = {
  groups: FindingGroup[];
  expandedGroupKey: string | null;
  onToggleGroup: (key: string) => void;
  selectedIds: Set<string>;
  onToggleMember?: (id: string) => void;
  renderMember?: (finding: Finding, group: FindingGroup) => ReactNode;
  emptyMessage?: string;
};

export function GroupedFindingsView({
  groups,
  expandedGroupKey,
  onToggleGroup,
  selectedIds,
  onToggleMember,
  renderMember,
  emptyMessage = 'Ningún hallazgo para agrupar.',
}: GroupedFindingsViewProps) {
  if (!groups.length) {
    return <p className="text-sm text-slate-500 text-center py-8">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const isOpen = expandedGroupKey === group.key;
        const selectedInGroup = group.members.filter((m) => selectedIds.has(m.id)).length;
        return (
          <div
            key={group.key}
            className={cn(
              'rounded-xl border border-slate-800 bg-slate-950/50 overflow-hidden',
              selectedInGroup > 0 && 'border-violet-500/30'
            )}
          >
            <button
              type="button"
              className="w-full text-left px-3 py-3 flex items-start gap-2"
              onClick={() => onToggleGroup(group.key)}
            >
              {isOpen ? (
                <ChevronDown className="size-4 text-slate-500 shrink-0 mt-0.5" />
              ) : (
                <ChevronRight className="size-4 text-slate-500 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-100">{group.titulo}</span>
                  <span
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase',
                      SEVERITY_COLORS[group.severidad]
                    )}
                  >
                    {SEVERITY_LABEL[group.severidad]}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-violet-500/40 text-violet-300 bg-violet-500/10 flex items-center gap-1">
                    <Layers className="size-3" />
                    {group.members.length} instancia{group.members.length === 1 ? '' : 's'}
                  </span>
                </div>
                {!isOpen && group.componentes.length > 0 && (
                  <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 pl-0">
                    Sistemas: {group.componentes.slice(0, 4).join(' · ')}
                    {group.componentes.length > 4 ? ` · +${group.componentes.length - 4} más` : ''}
                  </p>
                )}
                {isOpen && group.componentes.length > 0 && (
                  <div className="mt-2 text-[10px] text-slate-400 space-y-0.5">
                    <p className="text-slate-500 uppercase tracking-wide">Sistemas afectados</p>
                    {group.componentes.map((c) => (
                      <p key={c} className="font-mono text-emerald-400/90">
                        {c}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </button>
            {isOpen && renderMember && (
              <div className="border-t border-slate-800/80 divide-y divide-slate-800/60">
                {group.members.map((m) => renderMember(m, group))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
