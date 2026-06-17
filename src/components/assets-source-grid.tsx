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

type Props = {
  sourceType: AssetSourceType;
  engagementId?: string | null;
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

export function AssetsSourceGrid({ sourceType, engagementId }: Props) {
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
    setRows([emptyGridRow(loaded)]);
  }, [sourceType, baseColumns]);

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
      const gridRows = assets.map((a) => assetToGridRow(a, columns));
      setRows(gridRows.length ? gridRows : [emptyGridRow(columns)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar activos');
      setRows([emptyGridRow(columns)]);
    } finally {
      setLoading(false);
    }
  }, [columns, engagementId, sourceType]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (dirtyRows: AssetGridRow[], deletedIds: string[]) => {
    const payloads = dirtyRows.map((row) =>
      gridRowToAssetPayload(row, columns, sourceType, engagementId)
    );
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
          Columna extra
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => updateColumns(prependReconPreset(columns))}
          title="Fuente, Tipo, SubTipo, FQDN, IP, Fecha — ideal para SOCRadar / recon"
        >
          <Columns3 className="size-3.5 mr-1" />
          + columnas recon
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
