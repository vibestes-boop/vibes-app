/**
 * lib/useBattleStats.ts
 *
 * Liest die aggregierte Battle-Bilanz (Wins / Losses / Draws) eines Users.
 * Quelle: SQL-View `user_battle_stats` aus 20260418000000_live_battle_history.sql.
 *
 * Verwendung:
 *   const { stats, loading } = useBattleStats(profile.id);
 *   → stats: { wins: 12, losses: 3, draws: 1, totalBattles: 16 }
 *
 * Cached via TanStack Query (60s stale → refresht nach jedem neuen Battle).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export interface BattleStats {
  wins:          number;
  losses:        number;
  draws:         number;
  totalBattles:  number;
  /** Win-Rate in Prozent (0..100). Null bei 0 Battles. */
  winRate:       number | null;
}

const EMPTY: BattleStats = {
  wins: 0, losses: 0, draws: 0, totalBattles: 0, winRate: null,
};

export function useBattleStats(userId: string | null | undefined) {
  return useQuery<BattleStats>({
    queryKey: ['battle-stats', userId],
    enabled:  !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!userId) return EMPTY;

      const { data, error } = await supabase
        .from('user_battle_stats')
        .select('wins, losses, draws, total_battles')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        __DEV__ && console.warn('[useBattleStats] fetch error:', error.message);
        return EMPTY;
      }
      if (!data) return EMPTY;

      const wins   = data.wins   ?? 0;
      const losses = data.losses ?? 0;
      const draws  = data.draws  ?? 0;
      const total  = data.total_battles ?? 0;

      return {
        wins,
        losses,
        draws,
        totalBattles: total,
        winRate: total > 0 ? Math.round((wins / total) * 100) : null,
      };
    },
  });
}

/**
 * Holt die letzten N Battles eines Users — für einen Battle-History-Tab
 * auf dem Profil (Opponent, Score, Datum).
 */
export interface BattleHistoryEntry {
  id:            string;
  sessionId:     string;
  opponentId:    string;
  opponentUsername: string | null;
  opponentAvatar:   string | null;
  myScore:       number;
  opponentScore: number;
  wasHost:       boolean;
  result:        'win' | 'loss' | 'draw';
  durationSecs:  number;
  endedAt:       string;
}

export function useBattleHistory(userId: string | null | undefined, limit = 20) {
  return useQuery<BattleHistoryEntry[]>({
    queryKey: ['battle-history', userId, limit],
    enabled:  !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!userId) return [];

      // Eine Query die BEIDE Rollen abdeckt: als Host ODER als Guest.
      const { data, error } = await supabase
        .from('live_battle_history')
        .select(`
          id, session_id, host_id, guest_id,
          host_score, guest_score, winner, duration_secs, ended_at,
          host_profile:profiles!live_battle_history_host_id_fkey(id, username, avatar_url),
          guest_profile:profiles!live_battle_history_guest_id_fkey(id, username, avatar_url)
        `)
        .or(`host_id.eq.${userId},guest_id.eq.${userId}`)
        .order('ended_at', { ascending: false })
        .limit(limit);

      if (error) {
        __DEV__ && console.warn('[useBattleHistory] fetch error:', error.message);
        return [];
      }

      return (data ?? []).map((row: any): BattleHistoryEntry => {
        const wasHost = row.host_id === userId;
        const opponent = wasHost ? row.guest_profile : row.host_profile;
        const myScore       = wasHost ? row.host_score  : row.guest_score;
        const opponentScore = wasHost ? row.guest_score : row.host_score;
        const winner = row.winner as 'host' | 'guest' | 'draw';
        const result: 'win' | 'loss' | 'draw' =
          winner === 'draw' ? 'draw'
          : (wasHost && winner === 'host') || (!wasHost && winner === 'guest')
            ? 'win'
            : 'loss';

        return {
          id:               row.id,
          sessionId:        row.session_id,
          opponentId:       wasHost ? row.guest_id : row.host_id,
          opponentUsername: opponent?.username  ?? null,
          opponentAvatar:   opponent?.avatar_url ?? null,
          myScore,
          opponentScore,
          wasHost,
          result,
          durationSecs:     row.duration_secs,
          endedAt:          row.ended_at,
        };
      });
    },
  });
}
