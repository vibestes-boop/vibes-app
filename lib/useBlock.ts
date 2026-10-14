import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from './authStore';
import { supabase } from './supabase';

// ── Block-Beziehungs-IDs (beide Richtungen), kurz gecacht ────────────────────
// get_blocked_user_ids() liefert alle User, mit denen ich eine Block-Beziehung
// habe (ich→sie ODER sie→ich; letzteres verbirgt die RLS auf user_blocks, daher
// die SECURITY-DEFINER-RPC). Feed/Kommentar-Filter nutzen das, um geblockte
// Autoren beidseitig auszublenden — ohne bei jeder Feed-Seite einen Roundtrip.
let _blockedIdsCache: { userId: string; at: number; ids: Set<string> } | null = null;
let blockedCacheGeneration = 0;
const BLOCKED_IDS_TTL = 60_000;

export async function getBlockedIdSet({
  userId = useAuthStore.getState().profile?.id,
  strict = false,
}: { userId?: string; strict?: boolean } = {}): Promise<Set<string>> {
  if (!userId) return new Set<string>();
  const now = Date.now();
  const cached = _blockedIdsCache?.userId === userId ? _blockedIdsCache : null;
  if (cached && now - cached.at < BLOCKED_IDS_TTL) return cached.ids;
  const generation = blockedCacheGeneration;
  try {
    const { data, error } = await supabase.rpc('get_blocked_user_ids');
    if (error) throw error;
    const ids = new Set<string>(((data ?? []) as { user_id: string }[]).map(row => row.user_id));
    // A request started before a block must not repopulate the cleared cache.
    if (generation === blockedCacheGeneration) _blockedIdsCache = { userId, at: now, ids };
    return ids;
  } catch (error) {
    if (strict) throw error;
    return cached?.ids ?? new Set<string>();
  }
}

/** Cache verwerfen — nach Block/Unblock, damit Feed/Kommentare sofort greifen. */
export function clearBlockedIdCache(): void {
  blockedCacheGeneration += 1;
  _blockedIdsCache = null;
}

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

  const refreshVisibility = async (isBlocked: boolean) => {
    queryClient.setQueryData(['block-status', currentUserId, targetUserId], isBlocked);
    clearBlockedIdCache();
    await Promise.all([
      'vibe-feed', 'following-feed', 'comments', 'conversations', 'blocked-users',
      'explore-grid', 'post-search', 'user-search', 'discover-people', 'trending-tags',
    ].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
  };

  const block = useMutation({
    mutationFn: async () => {
      if (!targetUserId) throw new Error('No user selected');
      const { error } = await supabase.rpc('block_user', { p_blocked_id: targetUserId });
      if (error) throw error;
    },
    onSuccess: () => refreshVisibility(true),
  });

  const unblock = useMutation({
    mutationFn: async () => {
      if (!targetUserId) throw new Error('No user selected');
      const { error } = await supabase.rpc('unblock_user', { p_blocked_id: targetUserId });
      if (error) throw error;
    },
    onSuccess: () => refreshVisibility(false),
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

