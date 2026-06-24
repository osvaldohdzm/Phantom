'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AssetTargetMapView } from '@/components/asset-target-map-view';
import { buildAssetTargetMapData, type AssetTargetMapData } from '@/lib/asset-target-map';
import { assetSourceLabel } from '@/lib/ui-locale';
import { useUiT } from '@/lib/use-ui-locale';
import { listAssets } from '@/lib/secops-api';

type Props = {
  sourceType: 'external_attack_surface' | 'internal_attack_surface';
  engagementId?: string | null;
};

export function AssetsTargetMapPanel({ sourceType, engagementId }: Props) {
  const { t, uiLanguage } = useUiT();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapData, setMapData] = useState<AssetTargetMapData | null>(null);

  const scope = sourceType === 'external_attack_surface' ? 'external' : 'internal';
  const title = assetSourceLabel(sourceType, uiLanguage);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const assets = await listAssets({
          source_type: sourceType,
          engagement_id: engagementId ?? undefined,
          limit: 5000,
        });
        if (cancelled) return;
        const data = buildAssetTargetMapData(assets, scope);
        setMapData(data);
        if (!data.hosts.length) setError(t('assetsTargetMapEmpty'));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t('assetsLoadError'));
          setMapData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sourceType, engagementId, scope, t]);

  const statsLine = useMemo(() => {
    if (!mapData) return '';
    let ports = 0;
    for (const h of mapData.hosts) ports += h.ports.length;
    return t('assetsTargetMapStats')
      .replace('{hosts}', String(mapData.hosts.length))
      .replace('{ports}', String(ports));
  }, [mapData, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm">{t('assetsTargetMapBuilding')}</span>
      </div>
    );
  }

  if (!mapData?.hosts.length) {
    return (
      <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg px-4 py-8 text-center">
        {error ?? t('assetsTargetMapEmpty')}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-muted-foreground tabular-nums">{statsLine}</p>
      <AssetTargetMapView data={mapData} title={title} />
    </div>
  );
}
