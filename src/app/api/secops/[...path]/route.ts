import { NextRequest, NextResponse } from 'next/server';
import { getBackendApiV1Url } from '@/lib/secops-backend-url';

export const dynamic = 'force-dynamic';
export const maxDuration = 600;

type RouteContext = { params: Promise<{ path: string[] }> };

/** Reenvía /api/secops/* → FastAPI en runtime (lee API_PROXY_URL del entorno Docker). */
async function proxyToBackend(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { path } = await context.params;
  const segments = path ?? [];
  if (!segments.length) {
    return NextResponse.json({ detail: 'Ruta API no especificada' }, { status: 404 });
  }

  const endpointPath = segments.join('/');
  const target = `${getBackendApiV1Url()}/${endpointPath}${request.nextUrl.search}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 590_000);

  try {
    const headers: Record<string, string> = {};
    const auth = request.headers.get('authorization');
    const contentType = request.headers.get('content-type');
    if (auth) headers.authorization = auth;
    if (contentType) headers['content-type'] = contentType;

    const init: RequestInit = {
      method: request.method,
      headers,
      signal: controller.signal,
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const body = await request.arrayBuffer();
      if (body.byteLength > 0) {
        init.body = body;
      }
    }

    const backendRes = await fetch(target, init);
    const responseText = await backendRes.text();
    return new NextResponse(responseText, {
      status: backendRes.status,
      headers: {
        'content-type': backendRes.headers.get('content-type') || 'application/json',
        'x-phantom-api-proxy': 'route-handler',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    const aborted = error instanceof Error && error.name === 'AbortError';
    return NextResponse.json(
      {
        detail: aborted
          ? 'El API tardó demasiado en responder.'
          : `No se pudo contactar al API: ${message}`,
      },
      { status: aborted ? 504 : 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyToBackend(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyToBackend(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyToBackend(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyToBackend(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyToBackend(request, context);
}
