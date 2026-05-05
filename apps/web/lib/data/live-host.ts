import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

// -----------------------------------------------------------------------------
// Live-Host-Data-Layer — Reads die NUR der Host braucht. Getrennt von viewer
// `lib/data/live.ts` damit Bundle-Splitting greift.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// getMyActiveLiveSession — eine aktive Session des eingeloggten Users, falls
// vorhanden. Genutzt auf `/live/start` um zu entscheiden ob Setup oder direkt
// zum Host-Deck umleiten.
// -----------------------------------------------------------------------------

export interface MyActiveSession {
  id: string;
  room_name: string;
  title: string | null;
  started_at: string;
  viewer_count: number;
  peak_viewer_count: number;
}

export const getMyActiveLiveSession = cache(
  async (): Promise<MyActiveSession | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from('live_sessions')
      // `peak_viewer_count:peak_viewers` — DB-Spalte heißt `peak_viewers`,
      // Alias damit `MyActiveSession.peak_viewer_count` weiter passt.
      .select('id, room_name, title, started_at, viewer_count, peak_viewer_count:peak_viewers')
      .eq('host_id', user.id)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return (data as MyActiveSession | null) ?? null;
  },
);

// -----------------------------------------------------------------------------
// getMyPastSessions — History für `/studio/live`.
// -----------------------------------------------------------------------------

export type BattleResult = 'win' | 'loss' | 'draw';

export interface PastSession {
  id: string;
  room_name: string;
  title: string | null;
  thumbnail_url: string | null;
  started_at: string;
  ended_at: string | null;
  peak_viewer_count: number;
  viewer_count: number;
  status: string;
  duration_secs: number | null;
  // enriched from creator_live_history view
  total_gift_diamonds: number;
  gift_count: number;
  comment_count: number;
  battle_result: BattleResult | null;
  battle_host_score: number | null;
  battle_guest_score: number | null;
  battle_opponent_name: string | null;
  battle_opponent_avatar: string | null;
}

type CreatorLiveHistoryRow = {
  session_id: string;
  title: string | null;
  started_at: string;
  ended_at: string | null;
  peak_viewers: number | null;
  status: string;
  duration_secs: number | null;
  total_gift_diamonds: number | null;
  gift_count: number | null;
  comment_count: number | null;
  battle_result: BattleResult | null;
  battle_host_score: number | null;
  battle_guest_score: number | null;
  battle_opponent_name: string | null;
  battle_opponent_avatar: string | null;
};

type LiveSessionExtraRow = {
  id: string;
  thumbnail_url: string | null;
  room_name: string | null;
  viewer_count: number | null;
};

export const getMyPastSessions = cache(
  async (limit = 30): Promise<PastSession[]> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    // Use creator_live_history view for rich per-session analytics
    // (gift totals, comment count, battle result) — same data as mobile live-history screen.
    const { data } = await supabase
      .from('creator_live_history')
      .select(
        'session_id, title, started_at, ended_at, peak_viewers, status, duration_secs,' +
        'total_gift_diamonds, gift_count, comment_count,' +
        'battle_result, battle_host_score, battle_guest_score,' +
        'battle_opponent_name, battle_opponent_avatar',
      )
      .eq('host_id', user.id)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (!data) return [];

    // Fetch thumbnails separately from live_sessions (not in the view)
    const rows = data as unknown as CreatorLiveHistoryRow[];
    const ids = rows.map((r) => r.session_id);
    const { data: sessions } = await supabase
      .from('live_sessions')
      .select('id, thumbnail_url, room_name, viewer_count')
      .in('id', ids);
    const sessionMap = new Map(
      ((sessions ?? []) as LiveSessionExtraRow[]).map((s) => [s.id, s]),
    );

    return rows.map((row) => {
      const extra = sessionMap.get(row.session_id);
      return {
        id:                  row.session_id,
        room_name:           extra?.room_name ?? '',
        title:               row.title ?? null,
        thumbnail_url:       extra?.thumbnail_url ?? null,
        started_at:          row.started_at,
        ended_at:            row.ended_at ?? null,
        peak_viewer_count:   row.peak_viewers ?? 0,
        viewer_count:        extra?.viewer_count ?? 0,
        status:              row.status,
        duration_secs:       row.duration_secs ?? null,
        total_gift_diamonds: row.total_gift_diamonds ?? 0,
        gift_count:          row.gift_count ?? 0,
        comment_count:       row.comment_count ?? 0,
        battle_result:       row.battle_result ?? null,
        battle_host_score:   row.battle_host_score ?? null,
        battle_guest_score:  row.battle_guest_score ?? null,
        battle_opponent_name:   row.battle_opponent_name ?? null,
        battle_opponent_avatar: row.battle_opponent_avatar ?? null,
      } as PastSession;
    });
  },
);

// -----------------------------------------------------------------------------
// getSessionGifts — eingehende Geschenke des aktuellen Streams (nur Host sieht).
// Initial-Load, Live-Updates kommen via Broadcast `live:{id}` Event `gift`.
// -----------------------------------------------------------------------------

export interface SessionGiftRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  gift_id: string;
  coin_cost: number;
  created_at: string;
  sender: {
    username: string;
    avatar_url: string | null;
  } | null;
  gift: {
    name: string;
    image_url: string | null;
  } | null;
}

export const getSessionGifts = cache(
  async (sessionId: string, limit = 30): Promise<SessionGiftRow[]> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from('live_gifts')
      .select(
        `id, sender_id, recipient_id, gift_id, coin_cost, created_at,
         sender:profiles!live_gifts_sender_id_fkey ( username, avatar_url ),
         gift:live_gift_catalog!live_gifts_gift_id_fkey ( name, image_url )`,
      )
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!data) return [];
    return (data as unknown as (SessionGiftRow & { sender: unknown; gift: unknown })[]).map(
      (r) => ({
        ...r,
        sender: Array.isArray(r.sender) ? ((r.sender[0] as SessionGiftRow['sender']) ?? null) : (r.sender as SessionGiftRow['sender']),
        gift: Array.isArray(r.gift) ? ((r.gift[0] as SessionGiftRow['gift']) ?? null) : (r.gift as SessionGiftRow['gift']),
      }),
    );
  },
);

// -----------------------------------------------------------------------------
// getActiveGiftGoal — Coin-Ziel für den aktuellen Stream (falls gesetzt).
// -----------------------------------------------------------------------------

export interface ActiveGiftGoal {
  id: string;
  session_id: string;
  host_id: string;
  label: string;
  target_coins: number;
  current_coins: number;
  created_at: string;
}

export const getActiveGiftGoal = cache(
  async (sessionId: string): Promise<ActiveGiftGoal | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from('live_gift_goals')
      .select('id, session_id, host_id, label, target_coins, current_coins, created_at')
      .eq('session_id', sessionId)
      .is('closed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as ActiveGiftGoal | null) ?? null;
  },
);

// -----------------------------------------------------------------------------
// Scheduled Lives — v1.w.UI.155
// -----------------------------------------------------------------------------

export interface ScheduledLiveRow {
  id:           string;
  host_id:      string;
  title:        string;
  description:  string | null;
  scheduled_at: string;
  status:       'scheduled' | 'reminded' | 'live' | 'expired' | 'cancelled';
  allow_comments: boolean;
  allow_gifts:    boolean;
  women_only:     boolean;
  session_id:   string | null;
  created_at:   string;
  // join
  host_username:   string | null;
  host_avatar_url: string | null;
}

type ScheduledLiveSelectRow = Omit<
  ScheduledLiveRow,
  'host_username' | 'host_avatar_url'
> & {
  profiles?: {
    username: string | null;
    avatar_url: string | null;
  } | Array<{
    username: string | null;
    avatar_url: string | null;
  }> | null;
};

function mapScheduledRow(r: ScheduledLiveSelectRow): ScheduledLiveRow {
  const host = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
  return {
    id:           r.id,
    host_id:      r.host_id,
    title:        r.title,
    description:  r.description ?? null,
    scheduled_at: r.scheduled_at,
    status:       r.status,
    allow_comments: r.allow_comments,
    allow_gifts:    r.allow_gifts,
    women_only:     r.women_only,
    session_id:   r.session_id ?? null,
    created_at:   r.created_at,
    host_username:   host?.username   ?? null,
    host_avatar_url: host?.avatar_url ?? null,
  };
}

/** Public upcoming lives — for /live page "Demnächst" strip. */
export const getUpcomingScheduledLives = cache(
  async (limit = 8): Promise<ScheduledLiveRow[]> => {
    const supabase = await createClient();
    const cutoff = new Date(Date.now() - 10 * 60_000).toISOString();
    const { data } = await supabase
      .from('scheduled_lives')
      .select('*, profiles!host_id(username, avatar_url)')
      .in('status', ['scheduled', 'reminded'])
      .gt('scheduled_at', cutoff)
      .order('scheduled_at', { ascending: true })
      .limit(limit);
    if (!data) return [];
    return data.map(mapScheduledRow);
  },
);

/** Creator's own scheduled lives — for /studio/live page. */
export const getMyScheduledLives = cache(
  async (): Promise<ScheduledLiveRow[]> => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data } = await supabase
      .from('scheduled_lives')
      .select('*, profiles!host_id(username, avatar_url)')
      .eq('host_id', user.id)
      .in('status', ['scheduled', 'reminded', 'live'])
      .order('scheduled_at', { ascending: true })
      .limit(20);
    if (!data) return [];
    return data.map(mapScheduledRow);
  },
);

// -----------------------------------------------------------------------------
// isHostMuted — check if the current viewer has muted this host's Go-Live push.
// Used on public profile pages to render the bell toggle button.
// Returns false for unauthenticated visitors or self-profile.
// -----------------------------------------------------------------------------
export const isHostMuted = cache(
  async (hostId: string): Promise<boolean> => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id === hostId) return false;
    const { count } = await supabase
      .from('muted_live_hosts')
      .select('host_id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('host_id', hostId);
    return (count ?? 0) > 0;
  },
);
