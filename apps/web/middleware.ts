/**
 * Minimal middleware — temporär reduziert auf No-Op + Cookie-Redirect,
 * ohne externe Imports aus `./lib/*`. Ziel: konfirmieren dass der
 * `__dirname is not defined`-Crash aus User-Code oder aus der Edge-Runtime
 * selbst kommt. Wenn dieser reine `next/server`-only Bundle trotzdem
 * crasht, liegt es am Vercel-Build-Cache oder Next.js-Auto-Injection.
 */

import { NextResponse, type NextRequest } from 'next/server';

// Node.js-Runtime statt Edge (V8-Isolate). Siehe Kommentar in next.config.mjs
// `experimental.nodeMiddleware`. Umgeht den __dirname-Crash der Edge-Runtime.
export const runtime = 'nodejs';

const PROTECTED_PREFIXES = ['/studio', '/messages', '/settings', '/create'] as const;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const requiresAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!requiresAuth) {
    return NextResponse.next();
  }

  const hasAuth = request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'));

  if (!hasAuth) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
