/**
 * Root-Middleware. Läuft bei jedem Request (außer den matcher-Ausschlüssen).
 * Kernzweck: Supabase-Session refreshen, geschützte Routes per Redirect gaten.
 */

import type { NextRequest } from 'next/server';
// Relative import (nicht `@/`-Alias) — Edge-Runtime-Bundling in Next.js 15
// resolvet Path-Aliases in der Root-middleware.ts manchmal nicht sauber,
// Vercel meldet dann "unsupported module @/lib/supabase/middleware".
// Mit relativem Pfad ist der Import eindeutig aufgelöst.
import { updateSession } from './lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths außer:
     * - _next/static (Static Files)
     * - _next/image  (Image Optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - .svg, .png, .jpg etc. (öffentliche Assets)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
