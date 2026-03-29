import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export type UseLikeBatch = { liked: boolean; count: number };

export function useLike(postId: string, batch?: UseLikeBatch | null) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.profile?.id);
  const skipQueries = batch != null;

  // ── Hat der User geliked? ──────────────────────────────────────────────────
  const { data: likedFromQ = false } = useQuery({
    queryKey: ['like-status', userId, postId],
    queryFn: async () => {
      if (!userId) return false;
      const { data } = await supabase
        .from('likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!userId && !!postId && !skipQueries,
    staleTime: 1000 * 60,
  });

  // ── Like-Anzahl ────────────────────────────────────────────────────────────
  const { data: countFromQ = 0 } = useQuery({
    queryKey: ['like-count', postId],
    queryFn: async () => {
      const { count: c } = await supabase
        .from('likes')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', postId);
      return c ?? 0;
    },
    enabled: !!postId && !skipQueries,
    staleTime: 1000 * 60,
  });

  const liked = skipQueries ? batch!.liked : likedFromQ;
  const count = skipQueries ? batch!.count : countFromQ;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['like-status', userId, postId] });
    queryClient.invalidateQueries({ queryKey: ['like-count', postId] });
    queryClient.invalidateQueries({ queryKey: ['feed-engagement', userId] });
  };

  // ── Like hinzufügen ────────────────────────────────────────────────────────
  const likePost = useMutation({
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['like-status', userId, postId] });
      await queryClient.cancelQueries({ queryKey: ['like-count', postId] });
      queryClient.setQueryData(['like-status', userId, postId], true);
      queryClient.setQueryData(['like-count', postId], (old: number = 0) => old + 1);
    },
    mutationFn: async () => {
      if (!userId) return;
      await supabase.from('likes').insert({ post_id: postId, user_id: userId });
    },
    onError: (err: any) => {
      queryClient.setQueryData(['like-status', userId, postId], false);
      queryClient.setQueryData(['like-count', postId], (old: number = 1) => Math.max(0, old - 1));
      Alert.alert('Fehler', err?.message ?? 'Like fehlgeschlagen.');
    },
    onSettled: invalidate,
  });

  // ── Like entfernen ─────────────────────────────────────────────────────────
  const unlikePost = useMutation({
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['like-status', userId, postId] });
      await queryClient.cancelQueries({ queryKey: ['like-count', postId] });
      queryClient.setQueryData(['like-status', userId, postId], false);
      queryClient.setQueryData(['like-count', postId], (old: number = 1) => Math.max(0, old - 1));
    },
    mutationFn: async () => {
      if (!userId) return;
      await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', userId);
    },
    onError: (err: any) => {
      queryClient.setQueryData(['like-status', userId, postId], true);
      queryClient.setQueryData(['like-count', postId], (old: number = 0) => old + 1);
      Alert.alert('Fehler', err?.message ?? 'Unlike fehlgeschlagen.');
    },
    onSettled: invalidate,
  });

  const toggle = () => {
    if (!userId) return;
    if (likePost.isPending || unlikePost.isPending) return; // B8: Debounce Doppel-Tap
    if (liked) unlikePost.mutate();
    else likePost.mutate();
  };

  return {
    liked,
    count,
    formattedCount: formatCount(count),
    toggle,
    isLoading: likePost.isPending || unlikePost.isPending,
  };
}
