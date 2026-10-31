import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { useAuthStore } from './authStore';
import { fmtNum } from './formatNum';
import { supabase } from './supabase';

export type UseLikeBatch = { liked: boolean; count: number };

export function useLike(postId: string, batch?: UseLikeBatch | null) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.profile?.id);
  // Mit Sammelwerten (Feed, Gilde) kommt der Stand aus der Sammelabfrage: keine
  // Einzelabfragen, und die Anzeige folgt ihr, bis der Nutzer selbst tippt.
  // Früher als initialData eingefroren: Kam die Sammelabfrage erst nach dem
  // Einhängen, stand eine Minute lang „0 Likes, nicht geliked" da.
  const fromBatch = batch != null;

  // ── Hat der User geliked? ──────────────────────────────────────────────────
  const { data: likedData } = useQuery({
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
    placeholderData: fromBatch ? batch.liked : undefined,
    enabled: !!userId && !!postId && !fromBatch,
    staleTime: 1000 * 60,
  });

  // ── Like-Anzahl ────────────────────────────────────────────────────────────
  const { data: countData } = useQuery({
    queryKey: ['like-count', postId],
    queryFn: async () => {
      const { count: c } = await supabase
        .from('likes')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', postId);
      return c ?? 0;
    },
    placeholderData: fromBatch ? batch.count : undefined,
    enabled: !!postId && !fromBatch,
    staleTime: 1000 * 60,
  });

  const liked = likedData ?? false;
  const count = countData ?? 0;

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
      // Ohne eigenen Cache-Eintrag (Sammelwerte) von der angezeigten Zahl ausgehen
      queryClient.setQueryData(['like-count', postId], (old?: number) => (old ?? count) + 1);
    },
    mutationFn: async () => {
      if (!userId) return;
      // upsert statt insert → verhindert 409 Conflict bei Race Conditions (error=23505)
      await supabase.from('likes').upsert(
        { post_id: postId, user_id: userId },
        { onConflict: 'post_id,user_id', ignoreDuplicates: true }
      );
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
      queryClient.setQueryData(['like-count', postId], (old?: number) => Math.max(0, (old ?? count) - 1));
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
    formattedCount: fmtNum(count),
    toggle,
    isLoading: likePost.isPending || unlikePost.isPending,
  };
}
