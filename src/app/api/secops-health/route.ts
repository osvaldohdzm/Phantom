import { NextResponse } from 'next/server';
import { getBackendRootUrl } from '@/lib/secops-backend-url';

export const dynamic = 'force-dynamic';

/** Health check del API vía proxy same-origin (runtime API_PROXY_URL). */
export async function GET() {
  try {
    const res = await fetch(`${getBackendRootUrl()}/health`, { cache: 'no-store' });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') || 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ status: 'error', detail: message }, { status: 502 });
  }
}
