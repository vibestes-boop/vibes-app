/**
 * lib/useStoryViews.ts
 * Liest die Viewer-Liste einer eigenen Story aus der `story_views` Tabelle.
 * Nur für den Story-Autor sichtbar (RLS: story_views_select USING (true)).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type StoryViewerEntry = {
  user_id: string;
  viewed_at: string;
  profiles: {
    username: string | null;
    avatar_url: string | null;
  } | null;
};

/**
 * Lädt alle User die eine bestimmte Story gesehen haben.
 * @param storyId  ID der Story
 * @param enabled  Nur abfragen wenn true (z. B. nur wenn Sheet offen ist)
 */
export function useStoryViewers(storyId: string | null | undefined, enabled = true) {
  return useQuery<StoryViewerEntry[]>({
    queryKey: ['story-viewers', storyId],
    queryFn: async () => {
      if (!storyId) return [];

      const { data, error } = await supabase
        .from('story_views')
        .select('user_id, viewed_at, profiles!story_views_user_id_fkey(username, avatar_url)')
        .eq('story_id', storyId)
        .order('viewed_at', { ascending: false })
        .limit(500);

      if (error) {
        __DEV__ && console.warn('[useStoryViewers]', error.message);
        return [];
      }

      return (data ?? []) as unknown as StoryViewerEntry[];
    },
    enabled: enabled && !!storyId,
    staleTime: 1000 * 30,       // 30s — Viewer-Liste ändert sich häufig
    refetchInterval: 1000 * 60, // Alle 60s automatisch aktualisieren während Sheet offen
  });
}
