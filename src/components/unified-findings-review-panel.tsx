'use client';

import { useState, type ReactNode } from 'react';
import { Layers, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AutomatedFindingsReviewPanel } from '@/components/automated-findings-review-panel';
import { VulnerabilityTypesReviewPanel } from '@/components/vulnerability-types-review-panel';

export type FindingsReviewRowMode = 'instances' | 'catalog-types';

type UnifiedFindingsReviewPanelProps = {
  engagementId?: string;
  projectName?: string;
  refreshToken?: number;
  /** Repositorio global (vul-mgmt) o proyecto (reportes). */
  scope?: 'engagement' | 'repository';
  defaultRowMode?: FindingsReviewRowMode;
  showRowModeToggle?: boolean;
};

const ROW_MODE_OPTIONS: {
  id: FindingsReviewRowMode;
  label: string;
  short: string;
  icon: ReactNode;
}[] = [
  { id: 'instances', label: 'Instancias por activo', short: 'Instancias', icon: <Table2 className="size-3.5" /> },
  {
    id: 'catalog-types',
    label: 'Consolidado por tipo',
    short: 'Por tipo',
    icon: <Layers className="size-3.5" />,
  },
];

export function UnifiedFindingsReviewPanel({
  engagementId,
  projectName,
  refreshToken,
  scope = engagementId ? 'engagement' : 'repository',
  defaultRowMode = 'instances',
  showRowModeToggle = true,
}: UnifiedFindingsReviewPanelProps) {
  const [rowMode, setRowMode] = useState<FindingsReviewRowMode>(defaultRowMode);
  const isRepository = scope === 'repository';

  return (
    <div className="space-y-3">
      {showRowModeToggle ? (
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5"
            role="tablist"
            aria-label="Modo de revisión"
          >
            {ROW_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={rowMode === opt.id}
                title={opt.label}
                onClick={() => setRowMode(opt.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors',
                  rowMode === opt.id
                    ? 'bg-background font-medium text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {opt.icon}
                {opt.short}
              </button>
            ))}
          </div>
          {isRepository ? (
            <span className="text-[11px] text-muted-foreground">
              Todas las integraciones · Nessus, Acunetix, Nmap, CSV y manual
            </span>
          ) : null}
        </div>
      ) : null}

      {rowMode === 'instances' ? (
        <AutomatedFindingsReviewPanel
          engagementId={engagementId}
          projectName={projectName}
          refreshToken={refreshToken}
          scope={scope}
          embedded={showRowModeToggle}
        />
      ) : (
        <VulnerabilityTypesReviewPanel
          engagementId={engagementId}
          projectName={projectName}
          refreshToken={refreshToken}
          scope={scope}
          embedded={showRowModeToggle}
        />
      )}
    </div>
  );
}
