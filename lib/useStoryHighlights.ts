/**
 * lib/useStoryHighlights.ts
 *
 * Story-Highlights: Eigene Stories können dauerhaft als Highlight
 * auf dem Profil gespeichert werden (überdauern die 24h-Grenze).
 *
 * DB-Tabelle: story_highlights (id, user_id, story_id, title, created_at)
 * Referenziert: stories(id) — kein CASCADE, da Story media_url in R2 dauerhaft
 *
 * Fallback-Strategie: Wenn die Tabelle noch nicht existiert, wird ein leeres
 * Array zurückgegeben (kein Crash).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

export type StoryHighlight = {
  id: string;
  user_id: string;
  story_id: string;
  title: string;
  media_url: string;
  media_type: string;
  created_at: string;
};

/** Alle Highlights eines Users (für Profil-Anzeige) */
export function useStoryHighlights(userId: string | null) {
  return useQuery<StoryHighlight[]>({
    queryKey: ['story-highlights', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('story_highlights')
        .select(`
          id, user_id, story_id, title, created_at,
          story:story_id ( media_url, media_type )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      // Tabelle existiert noch nicht → leere Liste ohne Fehler
      if (error) {
        if (error.code === '42P01') return []; // relation does not exist
        __DEV__ && console.warn('[useStoryHighlights]', error.message);
        return [];
      }

      return ((data ?? []) as any[]).map((row) => ({
        id: row.id,
        user_id: row.user_id,
        story_id: row.story_id,
        title: row.title,
        media_url: row.story?.media_url ?? '',
        media_type: row.story?.media_type ?? 'image',
        created_at: row.created_at,
      }));
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
  });
}

/** Highlight hinzufügen */
export function useAddHighlight() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.profile?.id);

  return useMutation({
    mutationFn: async ({ storyId, title }: { storyId: string; title: string }) => {
      if (!userId) throw new Error('Nicht eingeloggt');
      const { error } = await supabase.from('story_highlights').insert({
        user_id: userId,
        story_id: storyId,
        title: title.trim() || 'Highlight',
      });
      if (error && error.code !== '23505') throw error; // 23505 = already added
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['story-highlights', userId] });
    },
  });
}

/** Highlight entfernen */
export function useRemoveHighlight() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.profile?.id);

  return useMutation({
    mutationFn: async (highlightId: string) => {
      const { error } = await supabase
        .from('story_highlights')
        .delete()
        .eq('id', highlightId)
        .eq('user_id', userId ?? '');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['story-highlights', userId] });
    },
  });
}
