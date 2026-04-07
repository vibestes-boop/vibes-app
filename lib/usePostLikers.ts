/**
 * lib/usePostLikers.ts
 * Lädt die Liste aller User die einen bestimmten Post geliked haben.
 * Paginiert: 50 User pro Seite — für den "Wer hat geliked"-Sheet.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type LikerProfile = {
  user_id: string;
  liked_at: string;
  profiles: {
    username: string | null;
    avatar_url: string | null;
    bio: string | null;
  } | null;
};

export function usePostLikers(postId: string | null | undefined, enabled = true) {
  return useQuery<LikerProfile[]>({
    queryKey: ['post-likers', postId],
    queryFn: async () => {
      if (!postId) return [];

      const { data, error } = await supabase
        .from('likes')
        .select('user_id, created_at, profiles!likes_user_id_fkey(username, avatar_url, bio)')
        .eq('post_id', postId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        __DEV__ && console.warn('[usePostLikers]', error.message);
        return [];
      }

      // Supabase gibt created_at zurück, wir mappen es auf liked_at
      return (data ?? []).map((row: any) => ({
        user_id: row.user_id,
        liked_at: row.created_at,
        profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles,
      })) as LikerProfile[];
    },
    enabled: enabled && !!postId,
    staleTime: 1000 * 60,
  });
}
