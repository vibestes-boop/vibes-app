'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/session';

// -----------------------------------------------------------------------------
// activateWomenOnlyZone — Level-1 Selbstdeklaration (gender=female +
// women_only_verified=true + verification_level=1).
// v1.w.UI.167: Parity mit lib/useWomenOnly.ts → activateLevel1().
// -----------------------------------------------------------------------------

export async function activateWomenOnlyZone(): Promise<{ error: string | null }> {
  const user = await getUser();
  if (!user) return { error: 'not_authenticated' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      gender: 'female',
      women_only_verified: true,
      verification_level: 1,
    })
    .eq('id', user.id);

  if (error) return { error: error.message };

  revalidatePath('/women-only');
  revalidatePath('/woz');
  return { error: null };
}

// -----------------------------------------------------------------------------
// deactivateWomenOnlyZone — Setzt women_only_verified=false zurück.
// -----------------------------------------------------------------------------

export async function deactivateWomenOnlyZone(): Promise<{ error: string | null }> {
  const user = await getUser();
  if (!user) return { error: 'not_authenticated' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      women_only_verified: false,
      verification_level: 0,
    })
    .eq('id', user.id);

  if (error) return { error: error.message };

  revalidatePath('/women-only');
  revalidatePath('/woz');
  return { error: null };
}
