import { NextRequest, NextResponse } from 'next/server';
import { handleSuggestCatalogLocale } from '@/lib/suggest-catalog-locale-server';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    return await handleSuggestCatalogLocale(body);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('suggest-catalog-locale:', msg);
    return NextResponse.json({ error: `No se pudo sugerir el campo: ${msg}` }, { status: 500 });
  }
}
