import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_CATALOG_FIELD_CONFIG,
  type CatalogFieldConfig,
} from '@/lib/catalog-field-config';
import { getCatalogFieldConfigJson, setCatalogFieldConfigJson } from '@/lib/vulns-catalog-meta';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stored = await getCatalogFieldConfigJson();
    const config = (stored as CatalogFieldConfig | null) ?? DEFAULT_CATALOG_FIELD_CONFIG;
    return NextResponse.json({ config });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'No se pudo leer la configuración de campos', details: message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as { config?: CatalogFieldConfig };
    if (!body.config || typeof body.config !== 'object') {
      return NextResponse.json({ error: 'Configuración inválida' }, { status: 400 });
    }
    await setCatalogFieldConfigJson(body.config);
    return NextResponse.json({ ok: true, config: body.config });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'No se pudo guardar la configuración', details: message },
      { status: 500 }
    );
  }
}
