import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { VULNS_CATALOG_SELECT_COLUMNS } from '@/lib/vulns-catalog-columns';
import { catalogColumnForSource, normalizeToolSource } from '@/lib/catalog-tool-index';
import { findingToCatalogRow, type CatalogFromFindingInput } from '@/lib/catalog-from-finding';
import { extractNessusPluginId } from '@/lib/finding-grouping';
import { extractCatalogLookupTokens } from '@/lib/catalog-lookup-tokens';
import { fixTextEncoding } from '@/lib/text-encoding';

export const dynamic = 'force-dynamic';

const selectColumnsSql = VULNS_CATALOG_SELECT_COLUMNS.map((c) => `"${c}"`).join(', ');

type Row = Record<string, unknown>;

async function fetchById(id: string): Promise<Row | null> {
  const result = await dbQuery<Row>(
    `SELECT ${selectColumnsSql} FROM core.vulns_catalog WHERE "Id" = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] ?? null;
}

async function fetchByPluginId(pluginId: string): Promise<Row | null> {
  return fetchByCatalogColumn('NessusPluginId', pluginId);
}

async function fetchByCatalogColumn(column: string, value: string): Promise<Row | null> {
  const v = value.trim();
  if (!v) return null;
  const result = await dbQuery<Row>(
    `SELECT ${selectColumnsSql}
     FROM core.vulns_catalog
     WHERE TRIM("${column}"::text) = $1
     LIMIT 1`,
    [v]
  );
  return result.rows[0] ?? null;
}

async function fetchByToken(token: string): Promise<Row | null> {
  const t = token.trim();
  if (!t) return null;
  const like = `%${t}%`;
  const result = await dbQuery<Row>(
    `SELECT ${selectColumnsSql}
     FROM core.vulns_catalog
     WHERE "CVE" ILIKE $1
        OR "StandardVulnerabilityName" ILIKE $1
        OR "EspNombreVulnerabilidadUnificado" ILIKE $1
        OR "Vulnerability" ILIKE $1
        OR "Description" ILIKE $1
     ORDER BY
       CASE
         WHEN "CVE" ILIKE $2 THEN 0
         WHEN "StandardVulnerabilityName" ILIKE $2 THEN 1
         WHEN "EspNombreVulnerabilidadUnificado" ILIKE $2 THEN 2
         ELSE 3
       END,
       "Id"::int DESC NULLS LAST
     LIMIT 1`,
    [like, t]
  );
  return result.rows[0] ?? null;
}

async function resolveByTokens(
  titulo: string,
  cve?: string | null,
  raw?: string | null
): Promise<{ row: Row; match: string } | null> {
  const tokens = extractCatalogLookupTokens(titulo, cve, raw);
  for (const token of tokens) {
    const row = await fetchByToken(token);
    if (row) return { row, match: `token:${token}` };
  }
  return null;
}

async function nextCatalogId(): Promise<string> {
  const result = await dbQuery<{ next_id: string }>(
    `SELECT COALESCE(MAX("Id"::int), 0) + 1 AS next_id FROM core.vulns_catalog`
  );
  return String(result.rows[0]?.next_id ?? '1');
}

async function insertCatalogRow(payload: Record<string, string | null>): Promise<Row> {
  const columnsResult = await dbQuery<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'core' AND table_name = 'vulns_catalog'
     ORDER BY ordinal_position ASC`
  );
  const tableColumns = new Set(columnsResult.rows.map((r) => r.column_name));

  const entries = Object.entries(payload).filter(
    ([col, val]) => tableColumns.has(col) && val !== null && val !== ''
  );

  const id = await nextCatalogId();
  const cols = ['"Id"', ...entries.map(([col]) => `"${col}"`)];
  const values: Array<string | null> = [id, ...entries.map(([, val]) => fixTextEncoding(val!))];
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

  const result = await dbQuery<Row>(
    `INSERT INTO core.vulns_catalog (${cols.join(', ')})
     VALUES (${placeholders})
     RETURNING ${selectColumnsSql}`,
    values
  );
  return result.rows[0];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CatalogFromFindingInput & { lookup_only?: boolean };
    const lookupOnly = Boolean(body.lookup_only);

    if (body.catalog_id != null) {
      const existing = await fetchById(String(body.catalog_id));
      if (existing) {
        return NextResponse.json({ row: existing, created: false, match: 'catalog_id' });
      }
    }

    const pluginId = extractNessusPluginId(body.raw_tool_output ?? null);
    if (pluginId) {
      const byPlugin = await fetchByPluginId(pluginId);
      if (byPlugin) {
        return NextResponse.json({ row: byPlugin, created: false, match: 'nessus_plugin_id' });
      }
    }

    const toolSource = normalizeToolSource(body.tool_source ?? (pluginId ? 'Nessus' : 'Manual'));
    const toolId = (body.tool_vuln_id ?? '').trim() || (toolSource === 'nessus' && pluginId ? pluginId : '');
    const toolCol = catalogColumnForSource(toolSource);
    if (toolCol && toolId && toolCol !== 'NessusPluginId') {
      const byTool = await fetchByCatalogColumn(toolCol, toolId);
      if (byTool) {
        return NextResponse.json({ row: byTool, created: false, match: `tool:${toolSource}` });
      }
    }

    const byTokens = await resolveByTokens(
      body.titulo || '',
      body.cve,
      body.raw_tool_output
    );
    if (byTokens) {
      return NextResponse.json({
        row: byTokens.row,
        created: false,
        match: byTokens.match,
      });
    }

    if (lookupOnly) {
      return NextResponse.json(
        { error: 'No se encontró entrada en el catálogo para este hallazgo' },
        { status: 404 }
      );
    }

    const payload = findingToCatalogRow(body);
    const row = await insertCatalogRow(payload);
    return NextResponse.json({ row, created: true, match: 'created' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'No se pudo crear o resolver entrada de catálogo', details: message },
      { status: 500 }
    );
  }
}
