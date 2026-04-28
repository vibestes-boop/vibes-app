'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// -----------------------------------------------------------------------------
// voteOnStoryPoll — v1.w.UI.161
//
// Wirft oder ändert die Stimme eines Users für eine Story-Poll-Option.
// RLS-Policy: story_votes INSERT mit CHECK(auth.uid() = user_id).
// Unique-Constraint (story_id, user_id) → kein Double-Voting möglich.
//
// Wenn der User bereits abgestimmt hat (UNIQUE-Conflict):
// - Gleiche Option: ist schon gesetzt, kein Update nötig → ok.
// - Andere Option: Story-Polls auf Mobile erlauben keinen Wechsel —
//   wir verhalten uns identisch und geben einen sprechenden Fehler zurück.
// -----------------------------------------------------------------------------

export async function voteOnStoryPoll(
  storyId: string,
  optionIdx: number,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'not_authenticated' };

  // Prüf ob bereits abgestimmt.
  const { data: existing } = await supabase
    .from('story_votes')
    .select('option_idx')
    .eq('story_id', storyId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing !== null) {
    // Bereits abgestimmt — keine Änderung erlaubt (konsistent mit Mobile).
    return { ok: false, error: 'already_voted' };
  }

  const { error } = await supabase
    .from('story_votes')
    .insert({ story_id: storyId, user_id: user.id, option_idx: optionIdx });

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'already_voted' };
    return { ok: false, error: error.message };
  }

  // Invalidiert den getStory-Cache für diese Story.
  revalidatePath(`/s/${storyId}`);
  return { ok: true };
}
