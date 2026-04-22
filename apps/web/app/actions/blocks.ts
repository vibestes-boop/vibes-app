'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from './live';

// -----------------------------------------------------------------------------
// Block-Actions — User blockieren / entblocken.
//
// DB-Grundlage: `supabase/user_blocks.sql` (PK: blocker_id + blocked_id).
// Native nutzt die gleichen RPCs (`block_user` / `unblock_user`), hier
// delegieren wir ebenfalls damit das RLS + `SECURITY DEFINER` Verhalten
// identisch bleibt. Apple-Store-Pflicht: User müssen Blocks selbst verwalten
// können — deswegen liegt das auf `/settings/blocked` und nicht nur als
// Nebenwirkung auf fremden Profilen.
// -----------------------------------------------------------------------------

export async function unblockUser(targetUserId: string): Promise<ActionResult<null>> {
  if (!targetUserId) return { ok: false, error: 'Ungültige User-ID.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Bitte einloggen.' };

  const { error } = await supabase.rpc('unblock_user', {
    p_blocked_id: targetUserId,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/settings/blocked');
  return { ok: true, data: null };
}
