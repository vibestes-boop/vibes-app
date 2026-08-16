// Folgen — dieselbe `follows`-Tabelle wie Serlo.
//
// Nebeneffekt mit Absicht: auf INSERT hängen dort zwei Trigger, die eine
// Benachrichtigung erzeugen. Wer in Berkat einem Verkäufer folgt, taucht also
// auch in dessen Serlo-Mitteilungen auf. Eine Community, zwei Oberflächen.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

export function useFollow(targetUserId: string | undefined, myUserId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['berkat', 'follows', myUserId, targetUserId];
  const enabled = Boolean(myUserId && targetUserId && myUserId !== targetUserId);

  const state = useQuery({
    queryKey,
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<boolean> => {
      const { count, error } = await supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('follower_id', myUserId!)
        .eq('following_id', targetUserId!);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });

  const toggle = useMutation({
    mutationFn: async (): Promise<boolean> => {
      if (!myUserId || !targetUserId) throw new Error('not_authenticated');
      if (state.data) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', myUserId)
          .eq('following_id', targetUserId);
        if (error) throw error;
        return false;
      }
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: myUserId, following_id: targetUserId });
      // Doppeltes Folgen ist kein Fehler — der Unique-Index auf dem Paar
      // fängt Doppel-Taps ab, das Ergebnis ist dasselbe.
      if (error && !error.message.includes('duplicate')) throw error;
      return true;
    },
    onSuccess: (following) => {
      queryClient.setQueryData(queryKey, following);
      // Die Zahl auf dem Profil muss mitgehen — sonst steht dort weiter der
      // alte Stand, während der Knopf schon „Du folgst" sagt.
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'follow-counts', targetUserId] });
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'follow-counts', myUserId] });
    },
  });

  return {
    /** Nur sinnvoll, wenn ein fremdes Profil angezeigt wird */
    canFollow: enabled,
    isFollowing: state.data ?? false,
    toggle: toggle.mutate,
    busy: toggle.isPending,
  };
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
