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
      .select('id, room_name, title, started_at, viewer_count, peak_viewer_count')
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
}

export const getMyPastSessions = cache(
  async (limit = 30): Promise<PastSession[]> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data } = await supabase
      .from('live_sessions')
      .select(
        'id, room_name, title, thumbnail_url, started_at, ended_at, peak_viewer_count, viewer_count, status',
      )
      .eq('host_id', user.id)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (!data) return [];

    return data.map((row) => {
      const start = row.started_at ? new Date(row.started_at).getTime() : null;
      const end = row.ended_at ? new Date(row.ended_at).getTime() : null;
      const duration = start && end ? Math.floor((end - start) / 1000) : null;
      return { ...row, duration_secs: duration } as PastSession;
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
