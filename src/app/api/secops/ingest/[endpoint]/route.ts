import { NextRequest, NextResponse } from 'next/server';
import { getBackendApiV1Url } from '@/lib/secops-backend-url';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ALLOWED_ENDPOINTS = new Set(['nessus-csv', 'acunetix-html', 'nmap', 'universal-csv']);

type RouteContext = { params: Promise<{ endpoint: string }> };

/**
 * Proxy server-side de ingest multipart → FastAPI.
 * Evita el límite de 10 MB del rewrite/proxy de Next.js en el navegador.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { endpoint } = await context.params;
  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return NextResponse.json({ detail: 'Endpoint de ingesta no permitido' }, { status: 404 });
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json(
      { detail: 'Se espera multipart/form-data con el archivo' },
      { status: 400 },
    );
  }

  const body = await request.arrayBuffer();
  const target = `${getBackendApiV1Url()}/ingest/${endpoint}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 290_000);

  try {
    const auth = request.headers.get('authorization');
    const backendRes = await fetch(target, {
      method: 'POST',
      headers: {
        'content-type': contentType,
        ...(auth ? { authorization: auth } : {}),
      },
      body,
      signal: controller.signal,
    });

    const responseText = await backendRes.text();
    return new NextResponse(responseText, {
      status: backendRes.status,
      headers: {
        'content-type': backendRes.headers.get('content-type') || 'application/json',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    const aborted = error instanceof Error && error.name === 'AbortError';
    return NextResponse.json(
      {
        detail: aborted
          ? 'La ingesta tardó demasiado en el servidor. Prueba un CSV más pequeño o revisa que el backend esté en marcha.'
          : `No se pudo contactar al API de ingesta: ${message}`,
      },
      { status: aborted ? 504 : 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
