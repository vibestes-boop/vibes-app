'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// -----------------------------------------------------------------------------
// activateCreator — v1.w.UI.163
//
// Setzt profiles.is_creator = true für den eingeloggten User.
// Identisch mit dem Mobile-Flow (creator/activate.tsx):
//   supabase.from('profiles').update({ is_creator: true }).eq('id', user.id)
//
// Kein separater `is_creator`-Guard nötig — beim zweiten Aufruf ist
// is_creator bereits true und der Server schreibt denselben Wert (idempotent).
// -----------------------------------------------------------------------------

export async function activateCreator(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'not_authenticated' };

  const { error } = await supabase
    .from('profiles')
    .update({ is_creator: true })
    .eq('id', user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/studio');
  revalidatePath('/creator/activate');
  revalidatePath('/settings');
  return { ok: true };
}
