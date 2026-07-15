'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Columns3, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  columnsForSource,
  type AssetGridColumn,
  type AssetSourceType,
} from '@/lib/asset-spreadsheet-columns';
import {
  createCustomColumn,
  loadColumnLayout,
  prependReconPreset,
  saveColumnLayout,
} from '@/lib/asset-grid-column-layout';
import {
  assetToGridRow,
  emptyGridRow,
  gridRowToAssetPayload,
  type AssetGridRow,
} from '@/lib/asset-row-utils';
import { AssetExcelGrid } from '@/components/asset-excel-grid';
import { bulkUpsertAssets, listAssets } from '@/lib/secops-api';
import { useUiT } from '@/lib/use-ui-locale';

type Props = {
  sourceType: AssetSourceType;
  engagementId?: string | null;
  subType?: 'host' | 'app';
};

function remapRows(rows: AssetGridRow[], columns: AssetGridColumn[]): AssetGridRow[] {
  return rows.map((r) => {
    const nr = emptyGridRow(columns);
    for (const col of columns) nr[col.key] = r[col.key] ?? '';
    if (r.__id) nr.__id = r.__id;
    if (r.id) nr.id = r.id;
    return nr;
  });
}

export function AssetsSourceGrid({ sourceType, engagementId, subType }: Props) {
  const { t } = useUiT();
  const baseColumns = useMemo(() => columnsForSource(sourceType), [sourceType]);
  const [columns, setColumns] = useState<AssetGridColumn[]>(() =>
    loadColumnLayout(sourceType, baseColumns)
  );
  const [rows, setRows] = useState<AssetGridRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gridVersion, setGridVersion] = useState(0);

  useEffect(() => {
    const loaded = loadColumnLayout(sourceType, baseColumns);
    setColumns(loaded);
    const initRow = emptyGridRow(loaded);
    if (sourceType === 'inventory' && subType) {
      const assetTypeCol = loaded.find((c) => c.topLevel === 'asset_type');
      if (assetTypeCol) {
        initRow[assetTypeCol.key] = subType === 'app' ? 'App' : 'Host';
      }
    }
    setRows([initRow]);
  }, [sourceType, baseColumns, subType]);

  const updateColumns = useCallback(
    (next: AssetGridColumn[]) => {
      setColumns(next);
      saveColumnLayout(sourceType, next);
      setRows((prev) => remapRows(prev, next));
    },
    [sourceType]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const assets = await listAssets({
        source_type: sourceType,
        engagement_id: engagementId ?? undefined,
        limit: 5000,
      });

      let filteredAssets = assets;
      if (sourceType === 'inventory' && subType) {
        if (subType === 'host') {
          filteredAssets = assets.filter((a) => {
            const t = (a.asset_type || '').toLowerCase();
            return t !== 'app' && t !== 'webapp' && t !== 'web_app' && t !== 'web app' && t !== 'api';
          });
        } else if (subType === 'app') {
          filteredAssets = assets.filter((a) => {
            const t = (a.asset_type || '').toLowerCase();
            return t === 'app' || t === 'webapp' || t === 'web_app' || t === 'web app' || t === 'api';
          });
        }
      }

      const gridRows = filteredAssets.map((a) => assetToGridRow(a, columns));
      const initRow = emptyGridRow(columns);
      if (sourceType === 'inventory' && subType) {
        const assetTypeCol = columns.find((c) => c.topLevel === 'asset_type');
        if (assetTypeCol) {
          initRow[assetTypeCol.key] = subType === 'app' ? 'App' : 'Host';
        }
      }
      setRows(gridRows.length ? gridRows : [initRow]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('assetsLoadError'));
      const initRow = emptyGridRow(columns);
      if (sourceType === 'inventory' && subType) {
        const assetTypeCol = columns.find((c) => c.topLevel === 'asset_type');
        if (assetTypeCol) {
          initRow[assetTypeCol.key] = subType === 'app' ? 'App' : 'Host';
        }
      }
      setRows([initRow]);
    } finally {
      setLoading(false);
    }
  }, [columns, engagementId, sourceType, subType, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (dirtyRows: AssetGridRow[], deletedIds: string[]) => {
    const payloads = dirtyRows.map((row) => {
      const payload = gridRowToAssetPayload(row, columns, sourceType, engagementId);
      if (sourceType === 'inventory' && subType) {
        if (!payload.asset_type) {
          payload.asset_type = subType === 'app' ? 'App' : 'Host';
        }
      }
      return payload;
    });
    await bulkUpsertAssets({
      rows: payloads,
      delete_ids: deletedIds,
    });
    await load();
    setGridVersion((v) => v + 1);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => updateColumns([...columns, createCustomColumn()])}
        >
          <Plus className="size-3.5 mr-1" />
          {t('assetsExtraColumn')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => updateColumns(prependReconPreset(columns))}
          title="Fuente, Tipo, SubTipo, FQDN, IP, Fecha"
        >
          <Columns3 className="size-3.5 mr-1" />
          {t('assetsReconColumns')}
        </Button>
      </div>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <AssetExcelGrid
        key={gridVersion}
        columns={columns}
        rows={rows}
        onRowsChange={setRows}
        onSave={handleSave}
        onColumnsChange={updateColumns}
        loading={loading}
      />
    </div>
  );
}
