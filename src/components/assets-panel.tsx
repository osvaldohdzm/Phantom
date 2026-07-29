'use client';

import { useState } from 'react';
import { Loader2, Map, Server, Table2, ShieldCheck, Database, KeyRound, Radio, Cpu, Globe } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AssetsScanTargetsPanel } from '@/components/assets-scan-targets-panel';
import { AssetsSourceGrid } from '@/components/assets-source-grid';
import { AssetsTargetMapPanel } from '@/components/assets-target-map-panel';
import { AccessVaultPanel } from '@/components/access-vault-panel';
import { type AssetSourceType } from '@/lib/asset-spreadsheet-columns';
import { assetSourceLabel } from '@/lib/ui-locale';
import { engagementLabel } from '@/lib/default-engagement';
import { useProjectSelection } from '@/lib/use-project-selection';
import { useUiT } from '@/lib/use-ui-locale';

type ViewMode =
  | 'host_inventory'
  | 'domain_inventory'
  | 'app_inventory'
  | 'enterprise_devices'
  | 'access_inventory'
  | 'scan-targets'
  | 'external_recon'
  | 'external_attack_surface'
  | 'internal_recon'
  | 'internal_attack_surface';

type DisplayMode = 'grid' | 'map';

function isAttackSurfaceView(view: ViewMode): view is 'external_attack_surface' | 'internal_attack_surface' {
  return view === 'external_attack_surface' || view === 'internal_attack_surface';
}

export function AssetsPanel() {
  const { t, uiLanguage, format } = useUiT();
  const [view, setView] = useState<ViewMode>('host_inventory');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('grid');
  const [gridReload, setGridReload] = useState(0);
  const { engagements, engagementId, setEngagementId, loading: loadingEng } = useProjectSelection();

  const needsProject =
    view === 'external_recon' ||
    view === 'external_attack_surface' ||
    view === 'internal_recon' ||
    view === 'internal_attack_surface';

  const showTargetMap = isAttackSurfaceView(view);

  const onSelectView = (next: ViewMode) => {
    setView(next);
    if (!isAttackSurfaceView(next)) setDisplayMode('grid');
  };

  return (
    <div className="max-w-[min(100%,1400px)] mx-auto space-y-6">
      <div>
        <h1 className="type-h1 flex items-center gap-2">
          <Server className="size-7 text-cyan-500 animate-pulse" />
          Gestor de Activos y Accesos
        </h1>
        <p className="type-body text-muted-foreground mt-2 max-w-3xl">
          Administra el inventario de hosts, aplicaciones, dispositivos médicos/IoT (Enterprise Devices) y credenciales seguras (Vault) del engagement, integrando hallazgos desde escaneos automáticos y recolección manual.
        </p>
      </div>

      <Card className="bg-muted/15 border-border/40 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Radio className="size-4 text-cyan-500 animate-pulse" />
            Navegación de Fuentes y Vault
          </CardTitle>
          <CardDescription>Selecciona la categoría de inventario o superficie que deseas ver.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Core Inventory Group */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-muted-foreground dark:text-muted-foreground/80 uppercase tracking-wider block">
                Inventario Core & Accesos
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'host_inventory', label: 'Host Inventory', icon: Server },
                  { id: 'domain_inventory', label: 'Domain Inventory', icon: Globe },
                  { id: 'app_inventory', label: 'Apps Inventory', icon: Database },
                  { id: 'enterprise_devices', label: 'Enterprise Devices (Dispositivos Médicos / IoT / OT)', icon: Cpu },
                  { id: 'access_inventory', label: 'Access Inventory (Vault)', icon: KeyRound },
                  { id: 'scan-targets', label: t('assetsTabFromScans'), icon: ShieldCheck },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => onSelectView(tab.id as ViewMode)}
                      className={[
                        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all hover:bg-muted/40 cursor-pointer',
                        view === tab.id
                          ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 shadow-sm'
                          : 'border-border text-muted-foreground hover:text-foreground',
                      ].join(' ')}
                    >
                      <Icon className="size-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recon Group */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-muted-foreground dark:text-muted-foreground/80 uppercase tracking-wider block">
                Recon & Superficie de Ataque
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'external_recon', label: assetSourceLabel('external_recon', uiLanguage) },
                  { id: 'external_attack_surface', label: assetSourceLabel('external_attack_surface', uiLanguage) },
                  { id: 'internal_recon', label: assetSourceLabel('internal_recon', uiLanguage) },
                  { id: 'internal_attack_surface', label: assetSourceLabel('internal_attack_surface', uiLanguage) },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onSelectView(tab.id as ViewMode)}
                    className={[
                      'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all hover:bg-muted/40 cursor-pointer',
                      view === tab.id
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 shadow-sm'
                        : 'border-border text-muted-foreground hover:text-foreground',
                    ].join(' ')}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border/40 text-xs">
            <span className="text-muted-foreground font-medium">Proyecto / Scope del Engagement:</span>
            {loadingEng ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : (
              <select
                className="h-8 min-w-[14rem] rounded-md border border-input bg-background/50 px-2 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
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
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                {format('assetsProjectRecommended', {
                  source: view,
                })}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/40 shadow-md">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                {view === 'scan-targets'
                  ? t('assetsScanTargetsCardTitle')
                  : view === 'host_inventory'
                    ? 'Host Inventory'
                    : view === 'domain_inventory'
                      ? 'Domain Inventory'
                      : view === 'app_inventory'
                        ? 'Apps Inventory'
                        : view === 'enterprise_devices'
                          ? 'Enterprise Devices Inventory (Dispositivos Médicos / IoT / OT / Baxter)'
                          : view === 'access_inventory'
                            ? 'Access Inventory (Vault Cifrado)'
                            : assetSourceLabel(view as AssetSourceType, uiLanguage)}
              </CardTitle>
              <CardDescription>
                {view === 'scan-targets'
                  ? t('assetsScanTargetsCardDesc')
                  : view === 'access_inventory'
                    ? 'Bitácora cifrada (AES-256) de contraseñas y llaves de acceso del engagement.'
                    : view === 'host_inventory'
                      ? 'Edición y control del inventario de hosts, servidores e infraestructura.'
                      : view === 'domain_inventory'
                        ? 'Edición y control del inventario de dominios de Internet, FQDNs y configuraciones DNS.'
                        : view === 'app_inventory'
                          ? 'Edición y control de aplicaciones web, portales, APIs y servicios lógicos.'
                          : view === 'enterprise_devices'
                            ? 'Edición y control del inventario especializado de dispositivos médicos (Baxter, infusion pumps), sensores IoT, sistemas OT y hardware industrial.'
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
                    'inline-flex items-center gap-1 rounded px-2.5 py-1 text-[10px] font-medium cursor-pointer',
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
                    'inline-flex items-center gap-1 rounded px-2.5 py-1 text-[10px] font-medium cursor-pointer',
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
          ) : view === 'access_inventory' ? (
            <AccessVaultPanel engagementId={engagementId || null} />
          ) : view === 'host_inventory' ? (
            <AssetsSourceGrid
              key={`host-${engagementId || 'global'}-${gridReload}`}
              sourceType="inventory"
              subType="host"
              engagementId={engagementId || null}
            />
          ) : view === 'domain_inventory' ? (
            <AssetsSourceGrid
              key={`domain-${engagementId || 'global'}-${gridReload}`}
              sourceType="inventory"
              subType="domain"
              engagementId={engagementId || null}
            />
          ) : view === 'app_inventory' ? (
            <AssetsSourceGrid
              key={`app-${engagementId || 'global'}-${gridReload}`}
              sourceType="inventory"
              subType="app"
              engagementId={engagementId || null}
            />
          ) : view === 'enterprise_devices' ? (
            <AssetsSourceGrid
              key={`enterprise-${engagementId || 'global'}-${gridReload}`}
              sourceType="inventory"
              subType="enterprise_device"
              engagementId={engagementId || null}
            />
          ) : showTargetMap && displayMode === 'map' ? (
            <AssetsTargetMapPanel
              key={`${view}-${engagementId || 'global'}-${gridReload}`}
              sourceType={view as any}
              engagementId={engagementId || null}
            />
          ) : (
            <AssetsSourceGrid
              key={`${view}-${engagementId || 'global'}-${gridReload}`}
              sourceType={view as any}
              engagementId={engagementId || null}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
