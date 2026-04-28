'use server';

// -----------------------------------------------------------------------------
// app/actions/highlights.ts — v1.w.UI.235
//
// Server actions for story highlight management (delete only on web).
// RLS on story_highlights enforces auth.uid() = user_id for DELETE.
// -----------------------------------------------------------------------------

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function deleteHighlight(
  highlightId: string,
  username: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('story_highlights')
    .delete()
    .eq('id', highlightId);

  if (error) {
    return { ok: false, error: error.message };
  }

  // Revalidate the profile page so the row disappears.
  revalidatePath(`/u/${username}`);
  return { ok: true };
}
