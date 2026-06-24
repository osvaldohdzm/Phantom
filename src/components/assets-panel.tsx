'use client';

import { useState } from 'react';
import { Loader2, Map, Server, Table2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AssetsScanTargetsPanel } from '@/components/assets-scan-targets-panel';
import { AssetsSourceGrid } from '@/components/assets-source-grid';
import { AssetsTargetMapPanel } from '@/components/assets-target-map-panel';
import { type AssetSourceType } from '@/lib/asset-spreadsheet-columns';
import { assetSourceLabel } from '@/lib/ui-locale';
import { engagementLabel } from '@/lib/default-engagement';
import { useProjectSelection } from '@/lib/use-project-selection';
import { useUiT } from '@/lib/use-ui-locale';

const SOURCE_TABS: AssetSourceType[] = [
  'inventory',
  'external_recon',
  'external_attack_surface',
  'internal_recon',
  'internal_attack_surface',
];

type ViewMode = 'scan-targets' | AssetSourceType;
type DisplayMode = 'grid' | 'map';

function isAttackSurfaceView(view: ViewMode): view is 'external_attack_surface' | 'internal_attack_surface' {
  return view === 'external_attack_surface' || view === 'internal_attack_surface';
}

export function AssetsPanel() {
  const { t, uiLanguage, format } = useUiT();
  const [view, setView] = useState<ViewMode>('scan-targets');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('grid');
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

  const showTargetMap = isAttackSurfaceView(view);

  const onSelectView = (next: ViewMode) => {
    setView(next);
    if (!isAttackSurfaceView(next)) setDisplayMode('grid');
  };

  return (
    <div className="max-w-[min(100%,1400px)] mx-auto space-y-6">
      <div>
        <h1 className="type-h1 flex items-center gap-2">
          <Server className="size-7 text-cyan-500" />
          {t('assetsTitle')}
        </h1>
        <p className="type-body text-muted-foreground mt-2 max-w-3xl">{t('assetsSubtitle')}</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('assetsSourceCardTitle')}</CardTitle>
          <CardDescription>{t('assetsSourceCardDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSelectView('scan-targets')}
              className={[
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                view === 'scan-targets'
                  ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200'
                  : 'border-border text-muted-foreground hover:bg-muted/60',
              ].join(' ')}
            >
              {t('assetsTabFromScans')}
            </button>
            {SOURCE_TABS.map((source) => (
              <button
                key={source}
                type="button"
                onClick={() => onSelectView(source)}
                className={[
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                  view === source
                    ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200'
                    : 'border-border text-muted-foreground hover:bg-muted/60',
                ].join(' ')}
              >
                {assetSourceLabel(source, uiLanguage)}
              </button>
            ))}
          </div>

          <label className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">{t('assetsProjectLabel')}</span>
            {loadingEng ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <select
                className="h-8 min-w-[14rem] rounded-md border border-input bg-background px-2 text-xs"
                value={engagementId}
                onChange={(e) => setEngagementId(e.target.value)}
              >
                <option value="">{t('assetsNoProject')}</option>
                {engagements.map((e) => (
                  <option key={e.id} value={e.id}>
                    {engagementLabel(e)}
                  </option>
                ))}
              </select>
            )}
            {needsProject && !engagementId ? (
              <span className="text-amber-700 dark:text-amber-400">
                {format('assetsProjectRecommended', {
                  source: assetSourceLabel(tab, uiLanguage),
                })}
              </span>
            ) : null}
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                {view === 'scan-targets'
                  ? t('assetsScanTargetsCardTitle')
                  : assetSourceLabel(view, uiLanguage)}
              </CardTitle>
              <CardDescription>
                {view === 'scan-targets'
                  ? t('assetsScanTargetsCardDesc')
                  : showTargetMap && displayMode === 'map'
                    ? t('assetsTargetMapCardDesc')
                    : t('assetsGridCardDesc')}
              </CardDescription>
            </div>
            {showTargetMap ? (
              <div className="inline-flex rounded-md border border-border/60 bg-background p-0.5">
                <button
                  type="button"
                  onClick={() => setDisplayMode('grid')}
                  className={[
                    'inline-flex items-center gap-1 rounded px-2.5 py-1 text-[10px] font-medium',
                    displayMode === 'grid'
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground',
                  ].join(' ')}
                >
                  <Table2 className="size-3.5" />
                  {t('assetsViewGrid')}
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayMode('map')}
                  className={[
                    'inline-flex items-center gap-1 rounded px-2.5 py-1 text-[10px] font-medium',
                    displayMode === 'map'
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground',
                  ].join(' ')}
                >
                  <Map className="size-3.5" />
                  {t('assetsViewTargetMap')}
                </button>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {view === 'scan-targets' ? (
            <AssetsScanTargetsPanel
              engagementId={engagementId || null}
              onPromoted={() => setGridReload((n) => n + 1)}
            />
          ) : showTargetMap && displayMode === 'map' ? (
            <AssetsTargetMapPanel
              key={`${view}-${engagementId || 'global'}-${gridReload}`}
              sourceType={view}
              engagementId={engagementId || null}
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
