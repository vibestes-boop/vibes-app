/**
 * lib/useLiveModerators.ts
 *
 * v1.22.3 — Live-Moderator-System
 *
 * Host kann einzelne Viewer für seine Session als "Moderator" markieren.
 * Der Status wird serverseitig enforced (nur Host darf granten/revoken)
 * und clientseitig als Set<userId> für schnelle Row-Lookups geliefert.
 *
 * Realtime-Updates via postgres_changes auf live_moderators — Mod-Badges
 * tauchen sofort auf/ab wenn der Host einen User ernennt oder entfernt.
 *
 * Nutzung:
 *   const { modIds, isModerator } = useLiveModerators(sessionId);
 *   const { grant, revoke, isBusy } = useLiveModeratorActions(sessionId);
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

// ─── Read hook ────────────────────────────────────────────────────────────

export function useLiveModerators(sessionId: string | null | undefined) {
  const [modIds, setModIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(!!sessionId);

  useEffect(() => {
    if (!sessionId) {
      setModIds(new Set());
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from('live_moderators')
        .select('user_id')
        .eq('session_id', sessionId);
      if (cancelled) return;
      if (error) {
        __DEV__ && console.warn('[useLiveModerators] load failed:', error.message);
        setModIds(new Set());
      } else {
        setModIds(new Set((data ?? []).map((r: { user_id: string }) => r.user_id)));
      }
      setLoading(false);
    };

    load();

    // Realtime: neue Grants / Revokes sofort reflektieren
    const ch = supabase
      .channel(`live-moderators-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'live_moderators',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const uid = (payload.new as { user_id?: string } | null)?.user_id;
          if (uid) {
            setModIds((prev) => {
              if (prev.has(uid)) return prev;
              const next = new Set(prev);
              next.add(uid);
              return next;
            });
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event:  'DELETE',
          schema: 'public',
          table:  'live_moderators',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const uid = (payload.old as { user_id?: string } | null)?.user_id;
          if (uid) {
            setModIds((prev) => {
              if (!prev.has(uid)) return prev;
              const next = new Set(prev);
              next.delete(uid);
              return next;
            });
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [sessionId]);

  const isModerator = useCallback(
    (userId: string | null | undefined) => !!userId && modIds.has(userId),
    [modIds],
  );

  return { modIds, isModerator, loading };
}

// ─── Host-Actions ─────────────────────────────────────────────────────────

export function useLiveModeratorActions(sessionId: string | null | undefined) {
  const qc = useQueryClient();

  const grantMut = useMutation({
    mutationFn: async (userId: string) => {
      if (!sessionId) throw new Error('no_session');
      const { error } = await supabase.rpc('grant_moderator', {
        p_session_id: sessionId,
        p_user_id:    userId,
      });
      if (error) throw error;
      return userId;
    },
    onError: (e: any) => {
      const msg = e?.message ?? 'Unbekannter Fehler';
      __DEV__ && console.warn('[useLiveModeratorActions] grant failed:', msg);
      Alert.alert('Moderator nicht ernannt', msg);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['live-moderators', sessionId] });
    },
  });

  const revokeMut = useMutation({
    mutationFn: async (userId: string) => {
      if (!sessionId) throw new Error('no_session');
      const { error } = await supabase.rpc('revoke_moderator', {
        p_session_id: sessionId,
        p_user_id:    userId,
      });
      if (error) throw error;
      return userId;
    },
    onError: (e: any) => {
      const msg = e?.message ?? 'Unbekannter Fehler';
      __DEV__ && console.warn('[useLiveModeratorActions] revoke failed:', msg);
      Alert.alert('Moderator nicht entfernt', msg);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['live-moderators', sessionId] });
    },
  });

  const grant  = useCallback((uid: string) => grantMut.mutateAsync(uid),  [grantMut]);
  const revoke = useCallback((uid: string) => revokeMut.mutateAsync(uid), [revokeMut]);

  return useMemo(
    () => ({
      grant,
      revoke,
      isBusy: grantMut.isPending || revokeMut.isPending,
    }),
    [grant, revoke, grantMut.isPending, revokeMut.isPending],
  );
}
