import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { getCatalogMeta } from '@/lib/vulns-catalog-meta';

export const dynamic = 'force-dynamic';

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  try {
    const columnsResult = await dbQuery<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'core' AND table_name = 'vulns_catalog'
       ORDER BY ordinal_position ASC`
    );
    const columns = columnsResult.rows.map((r) => r.column_name);
    if (!columns.length) {
      return NextResponse.json({ error: 'Tabla core.vulns_catalog no encontrada' }, { status: 404 });
    }

    const quoted = columns.map((c) => `"${c.replace(/"/g, '""')}"`).join(',');
    const rows = await dbQuery<Record<string, unknown>>(
      `SELECT ${quoted} FROM core.vulns_catalog ORDER BY "Id"::int ASC`
    );

    const lines = [columns.join(',')];
    for (const row of rows.rows) {
      lines.push(columns.map((c) => escapeCsv(row[c])).join(','));
    }

    const meta = await getCatalogMeta();
    const filename = `catalogo-vulnerabilidades-${meta.version.replace(/[^a-zA-Z0-9._-]/g, '_')}.csv`;

    return new NextResponse(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'No se pudo exportar el catálogo', details: message }, { status: 500 });
  }
}
