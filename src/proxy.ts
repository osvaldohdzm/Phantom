import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC = new Set(['/login', '/login-client']);

function isRscNavigation(request: NextRequest): boolean {
  return (
    request.headers.get('RSC') === '1' ||
    request.headers.get('Next-Router-Prefetch') === '1' ||
    request.headers.has('Next-Router-State-Tree')
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC.has(pathname) || pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const token = request.cookies.get('Phantom_session')?.value;
  if (!token) {
    // Redirecting RSC fetches breaks client-side navigation (Failed to fetch).
    if (isRscNavigation(request)) {
      return NextResponse.next();
    }
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host;
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    const url = new URL(`${proto}://${host}/login`);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
