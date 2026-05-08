/**
 * Supabase Browser-Client (Client Components).
 *
 * Wird aus `'use client'` Components importiert. Nutzt `@supabase/ssr`
 * um Auth-Cookies automatisch mit dem Server zu synchronisieren.
 */

import { createBrowserClient } from '@supabase/ssr';
import { createSupabaseTimingFetch } from './timing';

export function createClient() {
  const timingFetch = createSupabaseTimingFetch({ runtime: 'browser' });

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    timingFetch ? { global: { fetch: timingFetch } } : undefined,
  );
}
