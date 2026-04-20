/**
 * Supabase Middleware-Helper für Session-Refresh.
 *
 * Wird von der Root-`middleware.ts` bei jedem Request aufgerufen.
 * Refreshed die Supabase-Auth-Session und schreibt die aktualisierten
 * Cookies sowohl in den Response als auch zurück in den Request — so
 * haben Server Components direkt Zugriff auf frische Cookies.
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // WICHTIG: Nichts zwischen `createServerClient` und `getUser()` machen,
  // sonst ist die User-Info nicht zuverlässig refreshed.
  const { data: { user } } = await supabase.auth.getUser();

  // Protected-Routes-Redirect: alle /studio/* + /messages/* + /settings/*
  // erfordern Login. Andere Routes (/, /u/, /p/, /shop/, /live/) sind public.
  const pathname = request.nextUrl.pathname;
  const requiresAuth =
    pathname.startsWith('/studio') ||
    pathname.startsWith('/messages') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/create');

  if (!user && requiresAuth) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
