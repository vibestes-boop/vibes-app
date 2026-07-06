import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from './authStore';
import { supabase } from './supabase';

// ── Block-Beziehungs-IDs (beide Richtungen), kurz gecacht ────────────────────
// get_blocked_user_ids() liefert alle User, mit denen ich eine Block-Beziehung
// habe (ich→sie ODER sie→ich; letzteres verbirgt die RLS auf user_blocks, daher
// die SECURITY-DEFINER-RPC). Feed/Kommentar-Filter nutzen das, um geblockte
// Autoren beidseitig auszublenden — ohne bei jeder Feed-Seite einen Roundtrip.
let _blockedIdsCache: { at: number; ids: Set<string> } | null = null;
const BLOCKED_IDS_TTL = 60_000;

export async function getBlockedIdSet(): Promise<Set<string>> {
  const now = Date.now();
  if (_blockedIdsCache && now - _blockedIdsCache.at < BLOCKED_IDS_TTL) {
    return _blockedIdsCache.ids;
  }
  try {
    const { data } = await supabase.rpc('get_blocked_user_ids');
    const ids = new Set<string>(
      ((data ?? []) as { user_id: string }[]).map((r) => r.user_id),
    );
    _blockedIdsCache = { at: now, ids };
    return ids;
  } catch {
    // Bei Fehler lieber nicht filtern als den Feed leeren.
    return _blockedIdsCache?.ids ?? new Set<string>();
  }
}

/** Cache verwerfen — nach Block/Unblock, damit Feed/Kommentare sofort greifen. */
export function clearBlockedIdCache(): void {
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

  const block = useMutation({
    mutationFn: async () => {
      if (!targetUserId) return;
      await supabase.rpc('block_user', { p_blocked_id: targetUserId });
    },
    onSuccess: () => {
      queryClient.setQueryData(['block-status', currentUserId, targetUserId], true);
      clearBlockedIdCache();
      // Feed + Kommentare neu ziehen, damit die geblockten Inhalte sofort weg sind.
      queryClient.invalidateQueries({ queryKey: ['vibe-feed'] });
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
    },
  });

  const unblock = useMutation({
    mutationFn: async () => {
      if (!targetUserId) return;
      await supabase.rpc('unblock_user', { p_blocked_id: targetUserId });
    },
    onSuccess: () => {
      queryClient.setQueryData(['block-status', currentUserId, targetUserId], false);
      clearBlockedIdCache();
      queryClient.invalidateQueries({ queryKey: ['vibe-feed'] });
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
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

