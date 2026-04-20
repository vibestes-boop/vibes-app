/**
 * Lightweight Edge-Middleware-Helper — Cookie-Presence-Check only.
 *
 * Hintergrund: Die vorherige Version importierte `createServerClient` aus
 * `@supabase/ssr` direkt in die Edge-Middleware. Irgendwo im transitiven
 * Dependency-Graph (wahrscheinlich `@supabase/supabase-js` → `@supabase/auth-js`
 * → Node-Polyfill-Shim) wird `__dirname` referenziert, was im V8-Isolate der
 * Vercel-Edge-Runtime nicht definiert ist. Ergebnis: jeder Request endete in
 * `MIDDLEWARE_INVOCATION_FAILED: ReferenceError: __dirname is not defined`.
 *
 * Neue Strategie:
 * 1. Middleware prüft NUR Cookie-Presence (`sb-*-auth-token*`).
 * 2. Echte Token-Validierung + Session-Refresh passieren im Server-Component
 *    der jeweiligen Protected-Page (`lib/supabase/server.ts → createServerClient`,
 *    läuft unter Node-Runtime, wo `__dirname` existiert).
 * 3. Trade-off: Session-Refresh läuft nicht mehr pro-Request vorab, sondern
 *    lazy beim ersten Page-Hit. Für 1h-Tokens unkritisch — sobald der User
 *    navigiert, erneuert das Server-Component den Token automatisch.
 *
 * Wenn wir später Session-Refresh in der Edge brauchen, können wir auf
 * `experimental.nodeMiddleware: true` (Next.js 15.3+) umstellen und den
 * `@supabase/ssr`-Client zurückholen.
 */

import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/studio', '/messages', '/settings', '/create'] as const;

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const requiresAuth = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!requiresAuth) {
    return NextResponse.next({ request });
  }

  // Supabase schreibt Auth-Cookies in das Muster `sb-<project-ref>-auth-token(.N)`
  // — es können mehrere sein (chunked bei grossen JWTs). Wir prüfen nur, ob
  // irgendeines existiert. Tampering/Expiry checkt das Server-Component.
  const hasSupabaseAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'));

  if (!hasSupabaseAuthCookie) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next({ request });
}
