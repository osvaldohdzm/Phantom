import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import {
  EXPLICACION_TECNICA_MAX_PARAGRAPHS,
  truncateToParagraphs,
} from '@/lib/truncate-paragraphs';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BATCH = 200;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { max_paragraphs?: number };
    const maxParagraphs = Math.max(
      1,
      Math.min(10, body.max_paragraphs ?? EXPLICACION_TECNICA_MAX_PARAGRAPHS)
    );

    const countResult = await dbQuery<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM core.vulns_catalog`
    );
    const total = Number.parseInt(countResult.rows[0]?.total ?? '0', 10);

    let updatedRows = 0;
    let offset = 0;

    while (offset < total) {
      const idsResult = await dbQuery<{ Id: string }>(
        `SELECT "Id" FROM core.vulns_catalog ORDER BY "Id"::int ASC NULLS LAST LIMIT $1 OFFSET $2`,
        [BATCH, offset]
      );
      if (!idsResult.rows.length) break;

      for (const { Id } of idsResult.rows) {
        const rowResult = await dbQuery<{ EspExplicacionTecnica: string | null }>(
          `SELECT "EspExplicacionTecnica" FROM core.vulns_catalog WHERE "Id" = $1`,
          [Id]
        );
        const raw = rowResult.rows[0]?.EspExplicacionTecnica;
        if (!raw?.trim()) continue;

        const truncated = truncateToParagraphs(raw, maxParagraphs);
        if (truncated === raw.trim()) continue;

        await dbQuery(
          `UPDATE core.vulns_catalog SET "EspExplicacionTecnica" = $1 WHERE "Id" = $2`,
          [truncated, Id]
        );
        updatedRows += 1;
      }

      offset += BATCH;
    }

    return NextResponse.json({
      ok: true,
      total_rows: total,
      updated_rows: updatedRows,
      max_paragraphs: maxParagraphs,
      hint: 'Ejecuta Sync catálogo en revisión de hallazgos para propagar los cambios.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'No se pudo acotar Explicación técnica', details: message },
      { status: 500 }
    );
  }
}
