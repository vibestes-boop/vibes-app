/**
 * lib/useCreatorLiveHistory.ts — Live-Analytics History für Creator Studio
 *
 * Liest die letzten N abgeschlossenen Live-Sessions eines Hosts aus der View
 * `creator_live_history` inkl. Peak-Viewers, Gift-Coins/Diamonds, Comment-Count
 * und (falls vorhanden) Battle-Ergebnis + Gegner.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

// ─── Typen ────────────────────────────────────────────────────────────────────

export type BattleResult = 'win' | 'loss' | 'draw';

export interface CreatorLiveSession {
  session_id:              string;
  host_id:                 string;
  title:                   string | null;
  started_at:              string;            // ISO
  ended_at:                string | null;     // ISO oder null (noch aktiv)
  duration_secs:           number;
  peak_viewers:            number;
  status:                  'active' | 'ended';

  /** Summe aller Gift-Coins die in dieser Session an den Host gingen */
  total_gift_coins:        number;
  /** Summe der Diamonds (Creator-Earnings) */
  total_gift_diamonds:     number;
  /** Anzahl gesendeter Gifts in dieser Session */
  gift_count:              number;

  /** Wie viele Kommentare? */
  comment_count:           number;

  /** Battle-Infos (null wenn kein Battle) */
  battle_result:           BattleResult | null;
  battle_host_score:       number | null;
  battle_guest_score:      number | null;
  battle_opponent_id:      string | null;
  battle_opponent_name:    string | null;
  battle_opponent_avatar:  string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Letzte `limit` Streams des Users (default 30).
 * Nur ended + active Sessions; ordered by started_at DESC.
 */
export function useCreatorLiveHistory(userId: string | null, limit: number = 30) {
  return useQuery<CreatorLiveSession[]>({
    queryKey: ['creator-live-history', userId, limit],
    enabled: !!userId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('creator_live_history')
        .select('*')
        .eq('host_id', userId!)
        .order('started_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as CreatorLiveSession[];
    },
  });
}

// ─── Formatter ────────────────────────────────────────────────────────────────

/** 327 → "5 Min", 3620 → "1 Std 0 Min", 65 → "1 Min" */
export function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} Min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} Std` : `${h} Std ${m} Min`;
}

/** ISO → "vor 3 Min", "vor 2 Std", "gestern", "vor 5 Tagen" */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1)   return 'gerade eben';
  if (diffMin < 60)  return `vor ${diffMin} Min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH  < 24)   return `vor ${diffH} Std`;
  const diffD = Math.round(diffH  / 24);
  if (diffD  === 1)  return 'gestern';
  if (diffD  < 7)    return `vor ${diffD} Tagen`;
  if (diffD  < 30)   return `vor ${Math.round(diffD / 7)} Wo`;
  if (diffD  < 365)  return `vor ${Math.round(diffD / 30)} Mon`;
  return `vor ${Math.round(diffD / 365)} J`;
}
