import { createClient } from '@/lib/supabase/server';

// -----------------------------------------------------------------------------
// lib/data/story-highlights.ts — v1.w.UI.235
//
// Server-side data fetching for story_highlights.
// Parity mit native lib/useStoryHighlights.ts.
// -----------------------------------------------------------------------------

export type StoryHighlight = {
  id: string;
  user_id: string;
  story_id: string | null;
  post_id: string | null;
  title: string;
  media_url: string | null;
  media_type: 'image' | 'video';
  thumbnail_url: string | null;
  created_at: string;
};

/**
 * Fetch all highlights for a given user, ordered oldest-first
 * (same as native — new ones append at the end).
 */
export async function getProfileHighlights(userId: string): Promise<StoryHighlight[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('story_highlights')
    .select('id, user_id, story_id, post_id, title, media_url, media_type, thumbnail_url, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    // Non-fatal — highlights are cosmetic; return empty on any error.
    return [];
  }
  return (data ?? []) as StoryHighlight[];
}
