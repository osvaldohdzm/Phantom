import { dbQuery } from '@/lib/db';

export type CatalogMeta = {
  version: string;
  imported_at: string | null;
  source_filename: string | null;
  row_count: number;
};

export async function ensureCatalogMetaTable() {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS core.vulns_catalog_meta (
      id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      version text NOT NULL DEFAULT 'unknown',
      imported_at timestamptz,
      source_filename text,
      row_count integer NOT NULL DEFAULT 0,
      field_config_json jsonb
    )
  `);
  await dbQuery(`
    ALTER TABLE core.vulns_catalog_meta
    ADD COLUMN IF NOT EXISTS field_config_json jsonb
  `);
  await dbQuery(`
    INSERT INTO core.vulns_catalog_meta (id, version)
    VALUES (1, 'unknown')
    ON CONFLICT (id) DO NOTHING
  `);
}

export async function getCatalogMeta(): Promise<CatalogMeta> {
  await ensureCatalogMetaTable();
  const count = await dbQuery<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM core.vulns_catalog`
  );
  const meta = await dbQuery<{
    version: string;
    imported_at: string | null;
    source_filename: string | null;
    row_count: number;
  }>(`SELECT version, imported_at, source_filename, row_count FROM core.vulns_catalog_meta WHERE id = 1`);
  const row = meta.rows[0];
  return {
    version: row?.version ?? 'unknown',
    imported_at: row?.imported_at ?? null,
    source_filename: row?.source_filename ?? null,
    row_count: Number.parseInt(count.rows[0]?.total ?? '0', 10),
  };
}

export function extractCatalogVersion(filename: string, override?: string | null): string {
  if (override?.trim()) return override.trim();
  const m = filename.match(/v(\d+\.\d+(?:\.\d+)?)/i);
  if (m) return `v${m[1]}`;
  return `import-${new Date().toISOString().slice(0, 10)}`;
}

export async function getCatalogFieldConfigJson(): Promise<unknown | null> {
  await ensureCatalogMetaTable();
  const result = await dbQuery<{ field_config_json: unknown }>(
    `SELECT field_config_json FROM core.vulns_catalog_meta WHERE id = 1`
  );
  return result.rows[0]?.field_config_json ?? null;
}

export async function setCatalogFieldConfigJson(config: unknown): Promise<void> {
  await ensureCatalogMetaTable();
  await dbQuery(
    `UPDATE core.vulns_catalog_meta SET field_config_json = $1::jsonb WHERE id = 1`,
    [config]
  );
}

export async function setCatalogMeta(version: string, sourceFilename: string, rowCount: number) {
  await ensureCatalogMetaTable();
  await dbQuery(
    `UPDATE core.vulns_catalog_meta
     SET version = $1, imported_at = NOW(), source_filename = $2, row_count = $3
     WHERE id = 1`,
    [version, sourceFilename, rowCount]
  );
}
