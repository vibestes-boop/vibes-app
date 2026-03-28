import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

export function useFollowCounts(userId: string | null) {
  return useQuery({
    queryKey: ['follow-counts', userId],
    queryFn: async () => {
      if (!userId) return { followers: 0, following: 0 };
      const { data, error } = await supabase.rpc('get_follow_counts', {
        target_user_id: userId,
      });
      if (error) throw error;
      const row = (data as { followers: number; following: number }[])?.[0];
      return { followers: Number(row?.followers ?? 0), following: Number(row?.following ?? 0) };
    },
    enabled: !!userId,
    staleTime: 1000 * 30,
  });
}

export function useFollow(targetUserId: string | null, batchIsFollowing?: boolean) {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.profile?.id);
  const skipQuery = batchIsFollowing !== undefined;

  const { data: isFollowingFromQ = false } = useQuery({
    queryKey: ['is-following', currentUserId, targetUserId],
    queryFn: async () => {
      if (!currentUserId || !targetUserId) return false;
      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUserId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!currentUserId && !!targetUserId && currentUserId !== targetUserId && !skipQuery,
  });

  const isFollowing = skipQuery ? batchIsFollowing! : isFollowingFromQ;

  const followKey   = ['is-following', currentUserId, targetUserId];
  const countsKey   = ['follow-counts', targetUserId];
  const engageKey   = ['feed-engagement', currentUserId];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: followKey });
    queryClient.invalidateQueries({ queryKey: countsKey });
    queryClient.invalidateQueries({ queryKey: engageKey });
  };

  const follow = useMutation({
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: followKey });
      const prev = queryClient.getQueryData<boolean>(followKey);
      queryClient.setQueryData(followKey, true);
      // Follower-Zähler sofort hochzählen
      queryClient.setQueryData<{ followers: number; following: number }>(
        countsKey,
        (old) => old ? { ...old, followers: old.followers + 1 } : old
      );
      return { prev };
    },
    mutationFn: async () => {
      if (!currentUserId || !targetUserId) return;
      const { error } = await supabase.from('follows').insert({
        follower_id: currentUserId,
        following_id: targetUserId,
      });
      if (error) throw error;
    },
    onError: (err: any, _vars, ctx) => {
      // Rollback
      queryClient.setQueryData(followKey, ctx?.prev ?? false);
      queryClient.setQueryData<{ followers: number; following: number }>(
        countsKey,
        (old) => old ? { ...old, followers: Math.max(0, old.followers - 1) } : old
      );
      Alert.alert('Fehler', err?.message ?? 'Folgen fehlgeschlagen.');
    },
    onSettled: invalidate,
  });

  const unfollow = useMutation({
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: followKey });
      const prev = queryClient.getQueryData<boolean>(followKey);
      queryClient.setQueryData(followKey, false);
      queryClient.setQueryData<{ followers: number; following: number }>(
        countsKey,
        (old) => old ? { ...old, followers: Math.max(0, old.followers - 1) } : old
      );
      return { prev };
    },
    mutationFn: async () => {
      if (!currentUserId || !targetUserId) return;
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUserId);
      if (error) throw error;
    },
    onError: (err: any, _vars, ctx) => {
      // Rollback
      queryClient.setQueryData(followKey, ctx?.prev ?? true);
      queryClient.setQueryData<{ followers: number; following: number }>(
        countsKey,
        (old) => old ? { ...old, followers: old.followers + 1 } : old
      );
      Alert.alert('Fehler', err?.message ?? 'Entfolgen fehlgeschlagen.');
    },
    onSettled: invalidate,
  });

  const toggle = () => {
    if (isFollowing) unfollow.mutate();
    else follow.mutate();
  };

  const isLoading = follow.isPending || unfollow.isPending;
  const isOwnProfile = currentUserId === targetUserId;

  return { isFollowing, toggle, isLoading, isOwnProfile };
}
