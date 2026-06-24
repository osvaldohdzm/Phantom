import { NextRequest, NextResponse } from 'next/server';
import { handleSuggestCatalogLocale } from '@/lib/suggest-catalog-locale-server';

/** Compatibilidad: mismo handler con idioma español por defecto. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    return await handleSuggestCatalogLocale({
      ...body,
      language: 'es',
      sourceContext: body.englishContext ?? body.sourceContext,
      currentValue: body.currentSpanish ?? body.currentValue,
      hasFilledLocale: body.hasFilledSpanish ?? body.hasFilledLocale,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('suggest-catalog-spanish:', msg);
    return NextResponse.json({ error: `No se pudo sugerir el campo: ${msg}` }, { status: 500 });
  }
}
