// Gewinnspiel im Stream.
//
// Teilnahme ist immer kostenlos — das ist die Trennlinie zum Glücksspiel und
// steht sowohl hier als auch in der Migration. Höchste erlaubte Bedingung ist
// „folgen", so wie bei Whatnot.

import { useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { subscribeToTable } from './realtime';

export type Giveaway = {
  id: string;
  session_id: string;
  host_id: string;
  title: string;
  image_url: string | null;
  requires_follow: boolean;
  status: 'open' | 'drawn' | 'cancelled';
  entry_count: number;
  winner_id: string | null;
  drawn_at: string | null;
};

/** Wie lange ein gezogener Gewinner noch angezeigt wird. */
const WINNER_VISIBLE_MS = 45_000;

/**
 * Das aktuell sichtbare Gewinnspiel einer Show: das offene, oder für kurze
 * Zeit noch das gerade gezogene, damit die Bekanntgabe nicht wegblitzt.
 */
export function useLiveGiveaway(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['berkat', 'giveaway', sessionId];

  const query = useQuery({
    queryKey,
    enabled: Boolean(sessionId),
    refetchInterval: 20_000,
    queryFn: async (): Promise<Giveaway | null> => {
      const { data, error } = await supabase
        .from('live_giveaways')
        .select(
          'id, session_id, host_id, title, image_url, requires_follow, status, entry_count, winner_id, drawn_at',
        )
        .eq('session_id', sessionId!)
        .in('status', ['open', 'drawn'])
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;

      const row = (data?.[0] as Giveaway | undefined) ?? null;
      if (!row) return null;
      if (row.status === 'open') return row;
      if (!row.drawn_at) return null;
      const age = Date.now() - new Date(row.drawn_at).getTime();
      return age < WINNER_VISIBLE_MS ? row : null;
    },
  });

  useEffect(() => {
    if (!sessionId) return;
    return subscribeToTable(
      `berkat-giveaway-${sessionId}`,
      { event: '*', table: 'live_giveaways', filter: `session_id=eq.${sessionId}` },
      () => queryClient.invalidateQueries({ queryKey }),
    );
    // queryKey ist ein frisches Array pro Render — der Inhalt ist stabil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, queryClient]);

  return query.data ?? null;
}

/** Habe ich bei diesem Gewinnspiel schon mitgemacht? */
export function useMyGiveawayEntry(giveawayId: string | undefined, userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'giveaway-entry', giveawayId, userId],
    enabled: Boolean(giveawayId && userId),
    staleTime: 10_000,
    queryFn: async (): Promise<boolean> => {
      const { count, error } = await supabase
        .from('live_giveaway_entries')
        .select('user_id', { count: 'exact', head: true })
        .eq('giveaway_id', giveawayId!)
        .eq('user_id', userId!);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });
}

export function giveawayErrorText(message: string): string {
  if (message.includes('follow_required'))
    return 'Folge dem Verkäufer, dann bist du dabei.';
  if (message.includes('host_cannot_enter')) return 'Beim eigenen Gewinnspiel geht das nicht.';
  if (message.includes('giveaway_closed')) return 'Zu spät — das Gewinnspiel ist schon durch.';
  if (message.includes('giveaway_already_open')) return 'Es läuft schon ein Gewinnspiel.';
  if (message.includes('forbidden')) return 'Das darf nur der Gastgeber.';
  if (message.includes('does not exist') || message.includes('PGRST202'))
    return 'Die Gewinnspiel-Tabellen fehlen noch in der Datenbank. Migration einspielen.';
  return 'Hat nicht geklappt. Versuch es noch einmal.';
}

export function useGiveawayActions(sessionId: string | undefined) {
  const queryClient = useQueryClient();

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'giveaway', sessionId] });
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'giveaway-entry'] });
  }, [queryClient, sessionId]);

  const create = useMutation({
    mutationFn: async (title: string): Promise<string> => {
      const { data, error } = await supabase.rpc('create_live_giveaway', {
        p_session_id: sessionId,
        p_title: title,
        p_image_url: null,
        p_requires_follow: true,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: refresh,
  });

  const enter = useMutation({
    mutationFn: async (giveawayId: string): Promise<void> => {
      const { error } = await supabase.rpc('enter_live_giveaway', { p_giveaway_id: giveawayId });
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const draw = useMutation({
    mutationFn: async (giveawayId: string): Promise<string | null> => {
      const { data, error } = await supabase.rpc('draw_live_giveaway', {
        p_giveaway_id: giveawayId,
      });
      if (error) throw error;
      return (data as { winner_id: string | null }).winner_id;
    },
    onSuccess: refresh,
  });

  return {
    createGiveaway: create.mutateAsync,
    enterGiveaway: enter.mutateAsync,
    drawGiveaway: draw.mutateAsync,
    busy: create.isPending || enter.isPending || draw.isPending,
  };
}
