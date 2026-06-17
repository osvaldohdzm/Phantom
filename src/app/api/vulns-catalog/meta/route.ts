import { NextResponse } from 'next/server';
import { getCatalogMeta } from '@/lib/vulns-catalog-meta';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const meta = await getCatalogMeta();
    return NextResponse.json(meta);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'No se pudo leer metadatos del catálogo', details: message }, { status: 500 });
  }
}
