import { NextRequest, NextResponse } from 'next/server';
import { getBackendApiV1Url } from '@/lib/secops-backend-url';

export const dynamic = 'force-dynamic';
export const maxDuration = 600;

const ALLOWED_PATHS = new Set([
  'nessus-csv',
  'nessus-csv/rescan',
  'acunetix-html',
  'nmap',
  'universal-csv',
]);

type RouteContext = { params: Promise<{ path: string[] }> };

/**
 * Proxy server-side de ingest multipart → FastAPI.
 * Evita el límite de 10 MB del rewrite/proxy de Next.js en el navegador.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const endpointPath = (path ?? []).join('/');
  if (!endpointPath || !ALLOWED_PATHS.has(endpointPath)) {
    return NextResponse.json({ detail: 'Endpoint de ingesta no permitido' }, { status: 404 });
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json(
      { detail: 'Se espera multipart/form-data con el archivo' },
      { status: 400 },
    );
  }

  const target = `${getBackendApiV1Url()}/ingest/${endpointPath}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 590_000);

  try {
    const auth = request.headers.get('authorization');
    const contentLength = request.headers.get('content-length');
    const headers: Record<string, string> = {
      'content-type': contentType,
      ...(auth ? { authorization: auth } : {}),
    };
    if (contentLength) headers['content-length'] = contentLength;

    const backendRes = await fetch(target, {
      method: 'POST',
      headers,
      body: request.body,
      // @ts-expect-error duplex requerido para reenviar body en streaming (Node 18+)
      duplex: 'half',
      signal: controller.signal,
    });

    // Buffer body: streaming passthrough provoca ECONNRESET si el backend recarga o cierra tarde.
    const responseText = await backendRes.text();
    return new NextResponse(responseText, {
      status: backendRes.status,
      headers: {
        'content-type': backendRes.headers.get('content-type') || 'application/json',
        'x-spectre-ingest-proxy': 'route-handler',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    const aborted = error instanceof Error && error.name === 'AbortError';
    return NextResponse.json(
      {
        detail: aborted
          ? 'La ingesta tardó demasiado. Si el CSV es muy grande (>50 MB), usa subida directa al puerto 8000 o Herramientas → Network Exposure para el mapa.'
          : `No se pudo contactar al API de ingesta: ${message}`,
      },
      { status: aborted ? 504 : 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
