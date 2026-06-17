import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { fixTextEncoding } from '@/lib/text-encoding';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BATCH = 200;

export async function POST() {
  try {
    const colsResult = await dbQuery<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'core' AND table_name = 'vulns_catalog'
         AND data_type IN ('text', 'character varying', 'character')
       ORDER BY ordinal_position ASC`
    );
    const textColumns = colsResult.rows.map((r) => r.column_name);
    if (!textColumns.length) {
      return NextResponse.json({ error: 'Sin columnas de texto' }, { status: 400 });
    }

    const countResult = await dbQuery<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM core.vulns_catalog`
    );
    const total = Number.parseInt(countResult.rows[0]?.total ?? '0', 10);

    let repairedRows = 0;
    let repairedCells = 0;
    let offset = 0;

    while (offset < total) {
      const idsResult = await dbQuery<{ Id: string }>(
        `SELECT "Id" FROM core.vulns_catalog ORDER BY "Id"::int ASC NULLS LAST LIMIT $1 OFFSET $2`,
        [BATCH, offset]
      );
      if (!idsResult.rows.length) break;

      for (const { Id } of idsResult.rows) {
        const rowResult = await dbQuery<Record<string, unknown>>(
          `SELECT ${textColumns.map((c) => `"${c}"`).join(', ')} FROM core.vulns_catalog WHERE "Id" = $1`,
          [Id]
        );
        const row = rowResult.rows[0];
        if (!row) continue;

        const updates: string[] = [];
        const values: unknown[] = [];
        let rowChanged = false;

        for (const col of textColumns) {
          const raw = row[col];
          if (raw === null || raw === undefined) continue;
          const original = String(raw);
          const fixed = fixTextEncoding(original);
          if (fixed !== original) {
            values.push(fixed === '' ? null : fixed);
            updates.push(`"${col}" = $${values.length}`);
            rowChanged = true;
            repairedCells += 1;
          }
        }

        if (rowChanged) {
          values.push(Id);
          await dbQuery(
            `UPDATE core.vulns_catalog SET ${updates.join(', ')} WHERE "Id" = $${values.length}`,
            values
          );
          repairedRows += 1;
        }
      }

      offset += BATCH;
    }

    const replacementChecks = textColumns
      .map((c) => `COALESCE("${c}"::text, '') LIKE '%' || chr(65533) || '%'`)
      .join(' OR ');
    const stillBroken = await dbQuery<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM core.vulns_catalog WHERE ${replacementChecks}`
    );

    return NextResponse.json({
      ok: true,
      total_rows: total,
      repaired_rows: repairedRows,
      repaired_cells: repairedCells,
      rows_with_replacement_char: Number.parseInt(stillBroken.rows[0]?.n ?? '0', 10),
      hint:
        'Si quedan filas con caracteres de reemplazo (), reimporta el CSV con codificación Windows-1252 o UTF-8.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'No se pudo reparar el catálogo', details: message }, { status: 500 });
  }
}
