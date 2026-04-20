/**
 * Root-Middleware. Läuft bei jedem Request (außer den matcher-Ausschlüssen).
 * Kernzweck: Supabase-Session refreshen, geschützte Routes per Redirect gaten.
 */

import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

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
