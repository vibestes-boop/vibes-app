/**
 * useAnalytics.ts — Creator Analytics Data Hooks
 *
 * Lädt echte Metriken aus Supabase via dedizierte RPCs.
 * Jeder Hook cached via React Query (5 Min stale time).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type AnalyticsPeriod = 7 | 28 | 60;
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
