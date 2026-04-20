/**
 * Supabase Server-Client (Server Components, Server Actions, Route Handlers).
 *
 * Liest Auth-Cookies aus dem Next.js Request und schreibt sie bei Refresh zurück.
 * MUSS pro-Request neu instanziert werden (nicht cachen).
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Aufruf aus Server Component heraus → setAll wirft. Das ist okay,
            // wenn die Middleware die Cookies refreshed (was sie tut).
            // Wir schlucken hier bewusst.
          }
        },
      },
    },
  );
}
