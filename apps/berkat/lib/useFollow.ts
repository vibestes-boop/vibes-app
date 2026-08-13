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
