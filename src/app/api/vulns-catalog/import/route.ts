import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import { dbQuery } from '@/lib/db';
import { extractCatalogVersion, setCatalogMeta } from '@/lib/vulns-catalog-meta';
import { decodeCsvBytes, fixTextEncoding, type CsvEncoding } from '@/lib/text-encoding';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const BATCH = 100;

function normalizeHeader(h: string): string {
  return h.replace(/^\uFEFF/, '').trim();
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    const versionOverride = String(form.get('version') || '').trim() || null;
    const replaceAll = String(form.get('replace') || '') === 'true';
    const encodingRaw = String(form.get('encoding') || 'auto').trim().toLowerCase();
    const encoding: CsvEncoding =
      encodingRaw === 'utf-8' || encodingRaw === 'cp1252' || encodingRaw === 'latin-1'
        ? encodingRaw
        : 'auto';

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo CSV requerido (campo file)' }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const text = decodeCsvBytes(bytes, encoding);
    const records = parse(text, {
      columns: (headers: string[]) => headers.map(normalizeHeader),
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    }) as Record<string, string>[];

    if (!records.length) {
      return NextResponse.json({ error: 'El CSV no contiene filas de datos' }, { status: 400 });
    }

    const columnsResult = await dbQuery<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'core' AND table_name = 'vulns_catalog'
       ORDER BY ordinal_position ASC`
    );
    const tableColumns = new Set(columnsResult.rows.map((r) => r.column_name));
    const csvColumns = Object.keys(records[0]).filter((c) => tableColumns.has(c));

    if (!csvColumns.length) {
      return NextResponse.json(
        {
          error: 'Ninguna columna del CSV coincide con core.vulns_catalog',
          csvHeaders: Object.keys(records[0]).slice(0, 20),
        },
        { status: 400 }
      );
    }

    if (replaceAll) {
      await dbQuery(`TRUNCATE TABLE core.vulns_catalog`);
    }

    const hasId = csvColumns.includes('Id');
    const upsertCols = hasId ? csvColumns : csvColumns;
    const quotedCols = upsertCols.map((c) => `"${c}"`).join(', ');
    const updateSet = upsertCols
      .filter((c) => c !== 'Id')
      .map((c) => `"${c}" = EXCLUDED."${c}"`)
      .join(', ');

    let upserted = 0;
    let skipped = 0;
    let cellsWithReplacementChar = 0;

    const isEmptyRow = (row: Record<string, string>) =>
      !Object.values(row).some((v) => String(v ?? '').trim() !== '');

    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH);
      for (const row of batch) {
        if (isEmptyRow(row)) {
          skipped += 1;
          continue;
        }

        const idVal = row.Id?.trim() ?? '';
        const cols: string[] = [];
        const values: unknown[] = [];
        for (const col of upsertCols) {
          if (!(col in row)) continue;
          const raw = row[col];
          if (raw === '' || raw === undefined) {
            if (col === 'Id') continue;
            cols.push(`"${col}"`);
            values.push(null);
            continue;
          }
          const fixed = fixTextEncoding(raw);
          if (fixed.includes('\uFFFD')) cellsWithReplacementChar += 1;
          cols.push(`"${col}"`);
          values.push(fixed);
        }
        if (!cols.length) {
          skipped += 1;
          continue;
        }

        const placeholders = values.map((_, j) => `$${j + 1}`).join(', ');
        if (hasId && idVal && updateSet && !replaceAll) {
          await dbQuery(
            `INSERT INTO core.vulns_catalog (${cols.join(', ')})
             VALUES (${placeholders})
             ON CONFLICT ("Id") DO UPDATE SET ${updateSet}`,
            values
          );
        } else {
          await dbQuery(
            `INSERT INTO core.vulns_catalog (${cols.join(', ')}) VALUES (${placeholders})`,
            values
          );
        }
        upserted += 1;
      }
    }

    const version = extractCatalogVersion(file.name, versionOverride);
    const countResult = await dbQuery<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM core.vulns_catalog`
    );
    const rowCount = Number.parseInt(countResult.rows[0]?.total ?? '0', 10);
    await setCatalogMeta(version, file.name, rowCount);

    return NextResponse.json({
      ok: true,
      version,
      upserted,
      skipped,
      total_rows: rowCount,
      columns_matched: csvColumns.length,
      csv_headers_sample: Object.keys(records[0]).slice(0, 25),
      matched_columns: csvColumns,
      encoding_used: encoding,
      cells_with_replacement_char: cellsWithReplacementChar,
      replace_all: replaceAll,
      hint:
        cellsWithReplacementChar > 0
          ? 'Quedaron celdas con caracteres de reemplazo (). Prueba reimportar con codificación Windows-1252.'
          : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'No se pudo importar el catálogo', details: message }, { status: 500 });
  }
}
