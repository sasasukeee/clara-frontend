import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hasAccessToken = request.cookies.has('access_token');
  const hasRefreshToken = request.cookies.has('refresh_token');
  
  if (!hasAccessToken && !hasRefreshToken) {
    if (request.nextUrl.pathname === '/' || request.nextUrl.pathname.startsWith('/app')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  } else {
    if (request.nextUrl.pathname === '/' || request.nextUrl.pathname === '/login') {
      return NextResponse.redirect(new URL('/app', request.url));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/app/:path*', '/login'],
};
