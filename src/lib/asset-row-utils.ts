import type { AssetGridColumn } from '@/lib/asset-spreadsheet-columns';
import type { AssetSourceType, SecopsAsset } from '@/lib/secops-api';

export type AssetGridRow = Record<string, string> & { __id?: string };

const TOP_LEVEL_KEYS = new Set([
  'nombre',
  'ip_publica',
  'ip_privada',
  'fqdn',
  'criticidad',
  'ambiente',
  'os',
  'asset_type',
  'owner',
  'location',
  'discovery_method',
  'is_in_scope',
]);

export function assetToGridRow(asset: SecopsAsset, columns: AssetGridColumn[]): AssetGridRow {
  const row: AssetGridRow = { __id: asset.id };
  const meta = asset.metadata ?? {};

  for (const col of columns) {
    if (col.key === 'id') {
      row.id = asset.id;
      continue;
    }
    if (col.topLevel && TOP_LEVEL_KEYS.has(col.topLevel)) {
      const val = asset[col.topLevel as keyof SecopsAsset];
      row[col.key] = val === null || val === undefined ? '' : String(val);
    } else if (col.topLevel && col.topLevel !== 'id') {
      row[col.key] = String(meta[col.key] ?? meta[col.topLevel] ?? '');
    } else {
      row[col.key] = String(meta[col.key] ?? '');
    }
  }

  if (!row.nombre?.trim()) {
    row.nombre =
      asset.nombre ||
      asset.fqdn ||
      asset.ip_publica ||
      asset.ip_privada ||
      '';
  }

  return row;
}

export function gridRowToAssetPayload(
  row: AssetGridRow,
  columns: AssetGridColumn[],
  sourceType: AssetSourceType,
  engagementId?: string | null
) {
  const metadata: Record<string, string> = {};
  const payload: {
    id?: string;
    nombre: string;
    source_type: AssetSourceType;
    engagement_id?: string | null;
    metadata: Record<string, string>;
    ip_publica?: string;
    ip_privada?: string;
    fqdn?: string;
    criticidad?: string;
    ambiente?: string;
    os?: string;
    asset_type?: string;
    owner?: string;
    location?: string;
    discovery_method?: string;
    is_in_scope: boolean;
  } = {
    id: row.__id,
    nombre: '',
    source_type: sourceType,
    engagement_id: engagementId ?? null,
    metadata,
    ambiente: 'Prod',
    is_in_scope: true,
  };

  for (const col of columns) {
    if (col.key === 'id' || col.type === 'readonly') continue;
    const raw = row[col.key] ?? '';
    const value = raw.trim();
    if (!value) continue;

    if (col.topLevel && TOP_LEVEL_KEYS.has(col.topLevel)) {
      (payload as Record<string, unknown>)[col.topLevel] = value;
    } else {
      metadata[col.key] = value;
    }
  }

  payload.nombre =
    row.nombre?.trim() ||
    row.hostname_desc?.trim() ||
    payload.fqdn ||
    payload.ip_publica ||
    payload.ip_privada ||
    'Activo sin nombre';

  return payload;
}

export function emptyGridRow(columns: AssetGridColumn[]): AssetGridRow {
  const row: AssetGridRow = {};
  for (const col of columns) {
    row[col.key] = '';
  }
  return row;
}

export function rowsEqual(a: AssetGridRow, b: AssetGridRow, columns: AssetGridColumn[]): boolean {
  for (const col of columns) {
    if ((a[col.key] ?? '') !== (b[col.key] ?? '')) return false;
  }
  return true;
}

export function cloneRow(row: AssetGridRow): AssetGridRow {
  return { ...row };
}
