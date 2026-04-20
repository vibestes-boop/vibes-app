/**
 * useAnalytics.ts — Creator Analytics Data Hooks
 *
 * Lädt echte Metriken aus Supabase via dedizierte RPCs.
 * Jeder Hook cached via React Query (5 Min stale time).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type AnalyticsPeriod = 7 | 28 | 60 | 90;
export type ContentSortBy = 'views' | 'likes' | 'comments';

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface CreatorOverview {
  total_views:     number;
  total_likes:     number;
  total_comments:  number;
  prev_views:      number;
  prev_likes:      number;
  prev_comments:   number;
  total_followers: number;
  new_followers:   number;
  prev_followers:  number;
  /** Berechnete Engagement Rate: (likes+comments) / views * 100 */
  engagement_rate: number;
  /** % Änderung View vs. Vorperiode */
  views_delta:     number | null;
  likes_delta:     number | null;
  comments_delta:  number | null;
  followers_delta: number | null;
}

export interface TopPost {
  post_id:       string;
  caption:       string | null;
  media_url:     string | null;
  media_type:    string | null;
  thumbnail_url: string | null;
  view_count:    number;
  like_count:    number;
  comment_count: number;
  created_at:    string;
  rank:          number;
}

export interface FollowerGrowthPoint {
  day:          string; // 'YYYY-MM-DD'
  new_followers: number;
}

// ─── Hilfsfunktion: % Änderung ────────────────────────────────────────────────
function calcDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// ─── Hook: Übersicht ──────────────────────────────────────────────────────────
export function useCreatorOverview(userId: string | null, days: AnalyticsPeriod = 28) {
  return useQuery<CreatorOverview>({
    queryKey: ['creator-overview', userId, days],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_creator_overview', { p_user_id: userId, p_days: days });
      if (error) throw error;
      const row = (data as any[])?.[0] ?? {};
      const tv = Number(row.total_views ?? 0);
      const tl = Number(row.total_likes ?? 0);
      const tc = Number(row.total_comments ?? 0);
      const pv = Number(row.prev_views ?? 0);
      const pl = Number(row.prev_likes ?? 0);
      const pc = Number(row.prev_comments ?? 0);
      const tf = Number(row.total_followers ?? 0);
      const nf = Number(row.new_followers ?? 0);
      const pf = Number(row.prev_followers ?? 0);
      return {
        total_views:     tv,
        total_likes:     tl,
        total_comments:  tc,
        prev_views:      pv,
        prev_likes:      pl,
        prev_comments:   pc,
        total_followers: tf,
        new_followers:   nf,
        prev_followers:  pf,
        engagement_rate: tv > 0 ? Math.round(((tl + tc) / tv) * 100 * 10) / 10 : 0,
        views_delta:     calcDelta(tv, pv),
        likes_delta:     calcDelta(tl, pl),
        comments_delta:  calcDelta(tc, pc),
        followers_delta: calcDelta(nf, pf),
      };
    },
  });
}

// ─── Hook: Top Posts ──────────────────────────────────────────────────────────
export function useCreatorTopPosts(
  userId: string | null,
  sortBy: ContentSortBy = 'views',
  limit = 5,
) {
  return useQuery<TopPost[]>({
    queryKey: ['creator-top-posts', userId, sortBy, limit],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_creator_top_posts', {
          p_user_id: userId,
          p_sort:    sortBy,
          p_limit:   limit,
        });
      if (error) throw error;
      return ((data as any[]) ?? []).map((row) => ({
        post_id:       row.post_id,
        caption:       row.caption ?? null,
        media_url:     row.media_url ?? null,
        media_type:    row.media_type ?? null,
        thumbnail_url: row.thumbnail_url ?? null,
        view_count:    Number(row.view_count ?? 0),
        like_count:    Number(row.like_count ?? 0),
        comment_count: Number(row.comment_count ?? 0),
        created_at:    row.created_at,
        rank:          Number(row.rank ?? 0),
      }));
    },
  });
}

// ─── Hook: Follower-Wachstum ──────────────────────────────────────────────────
export function useFollowerGrowth(userId: string | null, days: AnalyticsPeriod = 28) {
  return useQuery<FollowerGrowthPoint[]>({
    queryKey: ['creator-follower-growth', userId, days],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_creator_follower_growth', { p_user_id: userId, p_days: days });
      if (error) throw error;
      return ((data as any[]) ?? []).map((row) => ({
        day:           String(row.day),
        new_followers: Number(row.new_followers ?? 0),
      }));
    },
  });
}

// ─── Hilfsfunktion: Zahlen formatieren ───────────────────────────────────────
export function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Rendert ein Delta z.B. "+12%" in grün oder "-5%" in rot */
export function formatDelta(delta: number | null): { label: string; positive: boolean } | null {
  if (delta === null) return null;
  const positive = delta >= 0;
  return { label: `${positive ? '+' : ''}${delta}%`, positive };
}

// ─── Typen: Earnings ──────────────────────────────────────────────────────────
export interface CreatorEarnings {
  diamonds_balance:  number;  // Aktueller Wallet-Stand
  total_gifted:      number;  // Gesamt-Coins aller Zeiten
  period_gifts:      number;  // Anzahl Gifts im Zeitraum
  period_diamonds:   number;  // Diamonds verdient im Zeitraum
  top_gift_name:     string | null;
  top_gift_emoji:    string | null;
  top_gifter_name:   string | null;
}

export interface GiftHistoryItem {
  gift_name:     string;
  gift_emoji:    string;
  diamond_value: number;
  sender_name:   string;
  sender_avatar: string | null;
  created_at:    string;
}

// ─── Hook: Creator Earnings ───────────────────────────────────────────────────
export function useCreatorEarnings(userId: string | null, days: AnalyticsPeriod = 28) {
  return useQuery<CreatorEarnings>({
    queryKey: ['creator-earnings', userId, days],
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_creator_earnings', { p_user_id: userId, p_days: days });
      if (error) throw error;
      const row = (data as any[])?.[0] ?? {};
      return {
        diamonds_balance:  Number(row.diamonds_balance  ?? 0),
        total_gifted:      Number(row.total_gifted      ?? 0),
        period_gifts:      Number(row.period_gifts      ?? 0),
        period_diamonds:   Number(row.period_diamonds   ?? 0),
        top_gift_name:     row.top_gift_name    ?? null,
        top_gift_emoji:    row.top_gift_emoji   ?? null,
        top_gifter_name:   row.top_gifter_name  ?? null,
      };
    },
  });
}

// ─── Hook: Gift-Historie ──────────────────────────────────────────────────────
export function useCreatorGiftHistory(userId: string | null, limit = 10) {
  return useQuery<GiftHistoryItem[]>({
    queryKey: ['creator-gift-history', userId, limit],
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_creator_gift_history', { p_user_id: userId, p_limit: limit });
      if (error) throw error;
      return ((data as any[]) ?? []).map((row) => ({
        gift_name:     String(row.gift_name ?? ''),
        gift_emoji:    String(row.gift_emoji ?? '🎁'),
        diamond_value: Number(row.diamond_value ?? 0),
        sender_name:   String(row.sender_name ?? ''),
        sender_avatar: row.sender_avatar ?? null,
        created_at:    String(row.created_at ?? ''),
      }));
    },
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// v1.20 — Creator-Studio Pro: Peak-Hours + Watch-Time
// ═════════════════════════════════════════════════════════════════════════════

export interface EngagementHourPoint {
  /** 0 = Mo, 6 = So (ISO-Wochentag minus 1) */
  weekday:          number;
  /** 0..23 UTC */
  hour_of_day:      number;
  engagement_count: number;
}

/**
 * Heatmap-Daten: wann ist meine Audience aktiv?
 * Gibt ein sparse-Array zurück — nur (weekday, hour)-Paare mit Aktivität.
 * Die UI füllt auf 7×24 auf.
 */
export function useCreatorEngagementHours(userId: string | null, days: AnalyticsPeriod = 28) {
  return useQuery<EngagementHourPoint[]>({
    queryKey: ['creator-engagement-hours', userId, days],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_creator_engagement_hours', { p_user_id: userId, p_days: days });
      if (error) throw error;
      return ((data as any[]) ?? []).map((row) => ({
        weekday:          Number(row.weekday ?? 0),
        hour_of_day:      Number(row.hour_of_day ?? 0),
        engagement_count: Number(row.engagement_count ?? 0),
      }));
    },
  });
}

export interface WatchTimeEstimate {
  total_seconds_est:    number;
  total_views:          number;
  avg_seconds_per_view: number;
}

/**
 * Grobe Watch-Time-Schätzung. Solange keine per-view-events persistiert
 * werden, rechnen wir total_views × 8s (TikTok-Median). Die UI zeigt
 * einen "Schätzung"-Hinweis.
 */
export function useCreatorWatchTime(userId: string | null, days: AnalyticsPeriod = 28) {
  return useQuery<WatchTimeEstimate>({
    queryKey: ['creator-watch-time', userId, days],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_creator_watch_time_estimate', { p_user_id: userId, p_days: days });
      if (error) throw error;
      const row = (data as any[])?.[0] ?? {};
      return {
        total_seconds_est:    Number(row.total_seconds_est    ?? 0),
        total_views:          Number(row.total_views          ?? 0),
        avg_seconds_per_view: Number(row.avg_seconds_per_view ?? 0),
      };
    },
  });
}

/** "1h 23m" / "4m 12s" für UI-Formatierung */
export function fmtDuration(totalSeconds: number): string {
  if (totalSeconds < 60)     return `${totalSeconds}s`;
  if (totalSeconds < 3600)   return `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`;
  if (totalSeconds < 86400)  return `${Math.floor(totalSeconds / 3600)}h ${Math.floor((totalSeconds % 3600) / 60)}m`;
  return `${Math.floor(totalSeconds / 86400)}d ${Math.floor((totalSeconds % 86400) / 3600)}h`;
}
