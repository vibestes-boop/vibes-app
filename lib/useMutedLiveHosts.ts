/**
 * lib/useMutedLiveHosts.ts
 *
 * v1.17.0 — Go-Live Push-Preferences.
 *
 * Ein User folgt vielleicht hunderten Accounts, aber möchte nur von
 * wenigen einen Push bekommen wenn sie live gehen. Diese Hooks
 * verwalten die `muted_live_hosts`-Tabelle.
 *
 * Backend: Der `notify_followers_on_go_live` Trigger macht ein
 * NOT EXISTS-Join → stumm geschaltete Hosts bekommen keinen Push.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

export interface MutedHost {
  hostId:       string;
  username:     string | null;
  avatarUrl:    string | null;
  mutedAt:      string;
}

/**
 * Liste aller Hosts die der aktuelle User stumm geschaltet hat
 * (für die Settings-Seite).
 */
export function useMutedLiveHosts() {
  const userId = useAuthStore((s) => s.profile?.id);

  return useQuery<MutedHost[]>({
    queryKey: ['muted-live-hosts', userId],
    enabled:  !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('muted_live_hosts')
        .select(`
          host_id, created_at,
          host:profiles!muted_live_hosts_host_id_fkey(id, username, avatar_url)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        __DEV__ && console.warn('[useMutedLiveHosts] fetch error:', error.message);
        return [];
      }

      return (data ?? []).map((row: any): MutedHost => ({
        hostId:    row.host_id,
        username:  row.host?.username   ?? null,
        avatarUrl: row.host?.avatar_url ?? null,
        mutedAt:   row.created_at,
      }));
    },
  });
}

/**
 * Ist ein konkreter Host stumm geschaltet? Leichtgewichtig — perfekt
 * für das Glocken-Toggle auf dem Profil eines Creators.
 */
export function useIsHostMuted(hostId: string | null | undefined) {
  const userId = useAuthStore((s) => s.profile?.id);

  return useQuery<boolean>({
    queryKey: ['is-host-muted', userId, hostId],
    enabled:  !!userId && !!hostId && userId !== hostId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!userId || !hostId) return false;

      const { count, error } = await supabase
        .from('muted_live_hosts')
        .select('host_id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('host_id', hostId);

      if (error) {
        __DEV__ && console.warn('[useIsHostMuted] error:', error.message);
        return false;
      }

      return (count ?? 0) > 0;
    },
  });
}

/**
 * Mute/Unmute eines Hosts für Go-Live Benachrichtigungen.
 * Optimistic-Update auf `is-host-muted` und `muted-live-hosts`.
 */
export function useToggleMuteHost() {
  const userId = useAuthStore((s) => s.profile?.id);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      hostId,
      mute,
    }: { hostId: string; mute: boolean }) => {
      if (!userId) throw new Error('Nicht eingeloggt');
      if (userId === hostId) throw new Error('Du kannst dich nicht selbst stummschalten');

      if (mute) {
        const { error } = await supabase
          .from('muted_live_hosts')
          .upsert(
            { user_id: userId, host_id: hostId },
            { onConflict: 'user_id,host_id', ignoreDuplicates: true },
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('muted_live_hosts')
          .delete()
          .eq('user_id', userId)
          .eq('host_id', hostId);
        if (error) throw error;
      }
    },
    onMutate: async ({ hostId, mute }) => {
      await qc.cancelQueries({ queryKey: ['is-host-muted', userId, hostId] });
      const prev = qc.getQueryData<boolean>(['is-host-muted', userId, hostId]);
      qc.setQueryData(['is-host-muted', userId, hostId], mute);
      return { prev };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(['is-host-muted', userId, vars.hostId], ctx.prev);
      }
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ['is-host-muted', userId, vars.hostId] });
      qc.invalidateQueries({ queryKey: ['muted-live-hosts', userId] });
    },
  });
}
