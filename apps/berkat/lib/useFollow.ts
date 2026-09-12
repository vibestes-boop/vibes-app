// Folgen — dieselbe `follows`-Tabelle wie Serlo.
//
// Nebeneffekt mit Absicht: auf INSERT hängen dort zwei Trigger, die eine
// Benachrichtigung erzeugen. Wer in Berkat einem Verkäufer folgt, taucht also
// auch in dessen Serlo-Mitteilungen auf. Eine Community, zwei Oberflächen.

import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

type FollowChange = { followerId: string; targetId: string; wasFollowing: boolean };
const followKey = (followerId: string, targetId: string) => ['berkat', 'follows', followerId, targetId];

export function useFollow(targetUserId: string | undefined, myUserId: string | null) {
  const queryClient = useQueryClient();
  const locked = useRef(false);
  const queryKey = ['berkat', 'follows', myUserId, targetUserId];
  const enabled = Boolean(myUserId && targetUserId && myUserId !== targetUserId);

  const state = useQuery({
    queryKey,
    enabled,
    staleTime: 60_000,
    retry: 1,
    queryFn: async ({ signal }): Promise<boolean> => {
      const { count, error } = await supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('follower_id', myUserId!)
        .eq('following_id', targetUserId!)
        .abortSignal(signal)
        .retry(false);
      if (error) throw error;
      if (count == null) throw new Error('follow_state_missing');
      return count > 0;
    },
  });

  const change = useMutation({
    retry: false,
    // Bind the request and its cache updates to the account/profile at tap time.
    mutationFn: async ({ followerId, targetId, wasFollowing }: FollowChange): Promise<boolean> => {
      if (wasFollowing) {
        const { error } = await supabase.from('follows').delete()
          .eq('follower_id', followerId).eq('following_id', targetId);
        if (error) throw error;
        return false;
      }
      const { error } = await supabase.from('follows')
        .insert({ follower_id: followerId, following_id: targetId });
      if (error && error.code !== '23505') throw error;
      return true;
    },
    onMutate: ({ followerId, targetId }) => queryClient.cancelQueries({ queryKey: followKey(followerId, targetId), exact: true }),
    onSuccess: async (following, { followerId, targetId }) => {
      const key = followKey(followerId, targetId);
      // A refresh started while saving must not overwrite the confirmed result.
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      queryClient.setQueryData(key, following);
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'follow-counts', targetId] });
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'follow-counts', followerId] });
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'following', followerId] });
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'discovery', followerId] });
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'shows', 'discovery', followerId] });
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'upcoming-shows', 'discovery', followerId] });
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'activity', followerId] });
    },
  });

  const currentChange = change.variables?.followerId === myUserId && change.variables?.targetId === targetUserId;
  const readFailed = enabled && state.isError;
  const writeFailed = enabled && currentChange && change.isError;
  const busy = enabled && (state.isFetching && (state.data === undefined || state.isError) || change.isPending);
  const isFollowing = enabled && state.data === true;
  const error = readFailed ? 'Dein Folgestatus konnte nicht geladen werden. Bitte lade ihn erneut.'
    : writeFailed ? 'Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.' : null;
  const label = busy ? 'Einen Moment …' : readFailed || (enabled && state.data === undefined) ? 'Erneut laden'
    : writeFailed ? 'Erneut versuchen' : isFollowing ? 'Du folgst' : 'Folgen';

  const toggle = async () => {
    if (!enabled || !myUserId || !targetUserId || locked.current || change.isPending) return;
    locked.current = true;
    try {
      // An unknown/failed status is a read retry, never an inferred follow.
      if (state.isError || state.data === undefined) {
        await state.refetch({ cancelRefetch: false });
        return;
      }
      await change.mutateAsync({ followerId: myUserId, targetId: targetUserId, wasFollowing: state.data });
    } catch {
      // Query/mutation state supplies visible, retryable feedback at every entry.
    } finally {
      locked.current = false;
    }
  };

  return { canFollow: enabled, isFollowing, toggle, busy, error, label };
}

/**
 * „1584 Follower · 3 Gefolgt" — bei Whatnot die zweitgrößte Zahl auf dem
 * Profil, in Berkat bis zum 16.08.2026 gar nicht vorhanden.
 *
 * Warum das mehr ist als Kosmetik: Die drei Kacheln darüber (Bewertung,
 * Versandzeit, Zuschläge) messen ABGESCHLOSSENE Geschäfte. Ein Verkäufer, der
 * gerade anfängt, steht dort dreimal auf „—". Die Follower-Zahl ist die
 * einzige Zahl, die schon vor dem ersten Verkauf etwas aussagt — und in dieser
 * Community ist „dem folgen 200 Leute" genau die Auskunft, nach der jemand
 * sucht, der noch nicht gekauft hat.
 *
 * Zwei Zählabfragen mit `head: true` — es wird nur der `Content-Range`-Kopf
 * gelesen, keine Zeile übertragen. `follows_select` steht auf `USING (true)`
 * (am 16.08. im Schema-Abzug nachgesehen), Zählen ist also auch ohne Konto
 * erlaubt.
 */
export function useFollowCounts(userId: string | undefined) {
  return useQuery({
    queryKey: ['berkat', 'follow-counts', userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<{ followers: number; following: number }> => {
      const [followers, following] = await Promise.all([
        supabase
          .from('follows')
          .select('id', { count: 'exact', head: true })
          .eq('following_id', userId!),
        supabase
          .from('follows')
          .select('id', { count: 'exact', head: true })
          .eq('follower_id', userId!),
      ]);
      // Scheitert eine der beiden, ist eine 0 besser als ein kaputtes Profil —
      // dieselbe Regel wie beim Glocken-Abzeichen auf der Startseite.
      if ((followers.error || following.error) && __DEV__) {
        console.warn(
          '[Berkat] Follower zählen:',
          followers.error?.message ?? following.error?.message,
        );
      }
      return { followers: followers.count ?? 0, following: following.count ?? 0 };
    },
  });
}
