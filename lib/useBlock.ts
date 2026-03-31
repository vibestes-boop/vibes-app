import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

/** Prüft ob der aktuelle User einen anderen User geblockt hat */
export function useIsBlocked(targetUserId: string | null) {
  const currentUserId = useAuthStore((s) => s.profile?.id);

  return useQuery({
    queryKey: ['block-status', currentUserId, targetUserId],
    queryFn: async () => {
      if (!currentUserId || !targetUserId) return false;
      const { data } = await supabase
        .from('user_blocks')
        .select('blocked_id')
        .eq('blocker_id', currentUserId)
        .eq('blocked_id', targetUserId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!currentUserId && !!targetUserId && currentUserId !== targetUserId,
    staleTime: 1000 * 60 * 5,
  });
}

/** Block / Unblock Toggle für einen User */
export function useBlockUser(targetUserId: string | null) {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.profile?.id);

  const block = useMutation({
    mutationFn: async () => {
      if (!targetUserId) return;
      await supabase.rpc('block_user', { p_blocked_id: targetUserId });
    },
    onSuccess: () => {
      queryClient.setQueryData(['block-status', currentUserId, targetUserId], true);
    },
  });

  const unblock = useMutation({
    mutationFn: async () => {
      if (!targetUserId) return;
      await supabase.rpc('unblock_user', { p_blocked_id: targetUserId });
    },
    onSuccess: () => {
      queryClient.setQueryData(['block-status', currentUserId, targetUserId], false);
    },
  });

  return { block, unblock };
}

export type BlockedUser = {
  id: string;
  username: string | null;
  avatar_url: string | null;
};

/** Alle vom aktuellen User geblockten User laden */
export function useBlockedUsers() {
  const currentUserId = useAuthStore((s) => s.profile?.id);

  return useQuery<BlockedUser[]>({
    queryKey: ['blocked-users', currentUserId],
    queryFn: async () => {
      if (!currentUserId) return [];
      const { data, error } = await supabase
        .from('user_blocks')
        .select('blocked:blocked_id ( id, username, avatar_url )')
        .eq('blocker_id', currentUserId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((row) => row.blocked as BlockedUser);
    },
    enabled: !!currentUserId,
    staleTime: 1000 * 60 * 5,
  });
}

