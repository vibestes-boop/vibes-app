import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createSupabaseTimingFetch } from './timing';

/**
 * Cookie-freier Supabase-Client fuer rein oeffentliche Server-Reads.
 *
 * Der normale SSR-Client in `lib/supabase/server` liest `cookies()` und macht
 * Requests dadurch dynamisch/auth-aware. Fuer anonyme Explore/API-Reads ist das
 * teuer und unnoetig: RLS-Anon-Policies reichen, Engagement-Flags bleiben false.
 */
export function createPublicClient() {
  const timingFetch = createSupabaseTimingFetch({ runtime: 'server' });

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(timingFetch ? { global: { fetch: timingFetch } } : {}),
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}
