import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from './supabase';

export interface StoryComment {
  id: string;
  story_id: string;
  author_id: string;
  content: string;
  is_emoji: boolean;
  created_at: string;
  profiles: {
    username: string | null;
    avatar_url: string | null;
  } | null;
}

// ── Kommentare für eine bestimmte Story laden ──────────────────────────────
export function useStoryComments(storyId: string | null) {
  const qc = useQueryClient();

  // Realtime-Subscription: neue Kommentare erscheinen sofort
  useEffect(() => {
    if (!storyId) return;
    const channel = supabase
      .channel(`story-comments-${storyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'story_comments',
          filter: `story_id=eq.${storyId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['story-comments', storyId] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [storyId, qc]);

  return useQuery<StoryComment[]>({
    queryKey: ['story-comments', storyId],
    queryFn: async () => {
      if (!storyId) return [];
      const { data, error } = await supabase
        .from('story_comments')
        .select('*, profiles(username, avatar_url)')
        .eq('story_id', storyId)
        .order('created_at', { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as StoryComment[];
    },
    enabled: !!storyId,
    staleTime: 0,
  });
}

// ── Kommentar hinzufügen ───────────────────────────────────────────────────
export function useAddStoryComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      storyId,
      content,
      isEmoji = false,
    }: {
      storyId: string;
      content: string;
      isEmoji?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nicht eingeloggt');
      const { error } = await supabase.from('story_comments').insert({
        story_id: storyId,
        author_id: user.id,
        content,
        is_emoji: isEmoji,
      });
      if (error) throw error;
    },
    onSuccess: (_, { storyId }) => {
      qc.invalidateQueries({ queryKey: ['story-comments', storyId] });
    },
  });
}
