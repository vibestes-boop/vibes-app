import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

/**
 * Get the current authenticated user from the Supabase session.
 * Cached per-request via React's `cache()` to deduplicate across RSC calls.
 * Returns `null` if not authenticated.
 *
 * Use this in Server Components / Route Handlers / Server Actions.
 */
export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Get the current user's profile row (username, avatar, display_name, bio).
 * Returns `null` if not authenticated OR no profile row exists (= onboarding pending).
 *
 * NOTE: `coins_balance` existiert NICHT als Spalte in `profiles` — der Coin-/Diamond-
 * Saldo lebt in `coins_wallets`. Für den Balance siehe `lib/data/payments.ts →
 * getMyCoinBalance()`. Eine frühere Version hat `coins_balance` hier geselected,
 * was silent null zurückgab (PostgREST ignoriert unbekannte Spalten im select
 * nicht — es wirft 400). Bug behoben in v1.w.10.1.
 */
export const getProfile = cache(async () => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio, website, teip, is_creator, gender, women_only_verified, verification_level')
    .eq('id', user.id)
    .maybeSingle();

  return data;
});

/**
 * Throw-style variant — use when a Server Component absolutely requires auth.
 * Prefer middleware-based protection for route-level gating; use this for
 * defense-in-depth within the component.
 */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) {
    throw new Error('UNAUTHENTICATED');
  }
  return user;
}
