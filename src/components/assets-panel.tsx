'use client';

import { useState } from 'react';
import { Loader2, Server } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AssetsScanTargetsPanel } from '@/components/assets-scan-targets-panel';
import { AssetsSourceGrid } from '@/components/assets-source-grid';
import {
  ASSET_SOURCE_LABELS,
  type AssetSourceType,
} from '@/lib/asset-spreadsheet-columns';
import { engagementLabel } from '@/lib/default-engagement';
import { useProjectSelection } from '@/lib/use-project-selection';

const SOURCE_TABS: AssetSourceType[] = [
  'inventory',
  'external_recon',
  'external_attack_surface',
  'internal_recon',
  'internal_attack_surface',
];

type ViewMode = 'scan-targets' | AssetSourceType;

export function AssetsPanel() {
  const [view, setView] = useState<ViewMode>('scan-targets');
  const [gridReload, setGridReload] = useState(0);
  const { engagements, engagementId, setEngagementId, loading: loadingEng } = useProjectSelection();

  const tab = view === 'scan-targets' ? 'inventory' : view;
  const needsProject =
    view !== 'scan-targets' &&
    view !== 'inventory' &&
    (view === 'external_recon' ||
      view === 'external_attack_surface' ||
      view === 'internal_recon' ||
      view === 'internal_attack_surface');

  return (
    <div className="max-w-[min(100%,1400px)] mx-auto space-y-6">
      <div>
        <h1 className="type-h1 flex items-center gap-2">
          <Server className="size-7 text-cyan-500" />
          Activos
        </h1>
        <p className="type-body text-muted-foreground mt-2 max-w-3xl">
          Inventario central o superficies de ataque (M2). Desde escaneos puedes decidir qué objetivos
          entran al inventario; cada fuente tiene además un grid Excel editable.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Fuente de activos</CardTitle>
          <CardDescription>
            Inventario manual, objetivos detectados en escaneos, o hojas de recon interno/externo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setView('scan-targets')}
              className={[
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                view === 'scan-targets'
                  ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200'
                  : 'border-border text-muted-foreground hover:bg-muted/60',
              ].join(' ')}
            >
              Desde escaneos
            </button>
            {SOURCE_TABS.map((source) => (
              <button
                key={source}
                type="button"
                onClick={() => setView(source)}
                className={[
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                  view === source
                    ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200'
                    : 'border-border text-muted-foreground hover:bg-muted/60',
                ].join(' ')}
              >
                {ASSET_SOURCE_LABELS[source].replace(/ \(.*\)/, '')}
              </button>
            ))}
          </div>

          <label className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Proyecto / engagement</span>
            {loadingEng ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <select
                className="h-8 min-w-[14rem] rounded-md border border-input bg-background px-2 text-xs"
                value={engagementId}
                onChange={(e) => setEngagementId(e.target.value)}
              >
                <option value="">Sin proyecto (inventario global)</option>
                {engagements.map((e) => (
                  <option key={e.id} value={e.id}>
                    {engagementLabel(e)}
                  </option>
                ))}
              </select>
            )}
            {needsProject && !engagementId ? (
              <span className="text-amber-700 dark:text-amber-400">
                Recomendado: selecciona un proyecto para {ASSET_SOURCE_LABELS[tab]}
              </span>
            ) : null}
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {view === 'scan-targets'
              ? 'Objetivos desde escaneos'
              : ASSET_SOURCE_LABELS[view]}
          </CardTitle>
          <CardDescription>
            {view === 'scan-targets'
              ? 'Revisa hosts/activos detectados en Nessus, Nmap, etc. Agregar al inventario o pasar (omitir).'
              : 'Ctrl+V desde Excel · Shift+flechas o arrastrar · Guardar solo filas modificadas'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {view === 'scan-targets' ? (
            <AssetsScanTargetsPanel
              engagementId={engagementId || null}
              onPromoted={() => setGridReload((n) => n + 1)}
            />
          ) : (
            <AssetsSourceGrid
              key={`${view}-${engagementId || 'global'}-${gridReload}`}
              sourceType={view}
              engagementId={engagementId || null}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
