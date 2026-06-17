import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC = new Set(['/login']);

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
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
