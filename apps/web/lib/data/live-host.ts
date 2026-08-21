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
      // Ohne app-Filter übernähme das Serlo-Host-Deck eine laufende
      // Berkat-Show als „meine aktive Session" — inklusive Beenden-Knopf.
      .eq('app', 'serlo')
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

// Nur noch die Analytik-Spalten — Titel, Status, Zeiten und Peak kommen seit der
// App-Trennung aus `live_sessions` (siehe Kommentar in `getMyPastSessions`).
type CreatorLiveHistoryRow = {
  session_id: string;
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

type LiveSessionBaseRow = {
  id: string;
  title: string | null;
  status: string;
  started_at: string;
  ended_at: string | null;
  thumbnail_url: string | null;
  room_name: string | null;
  viewer_count: number | null;
  peak_viewer_count: number | null;
};

export const getMyPastSessions = cache(
  async (limit = 30): Promise<PastSession[]> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    // Die Reihenfolge der beiden Abfragen ist umgedreht, und das ist der Fix:
    //
    // `creator_live_history` (20260418040000) hat KEIN `WHERE` und gibt die
    // Spalte `app` nicht aus — auf der View lässt sich also gar nicht nach App
    // filtern. Ohne Filter standen vergangene BERKAT-Shows in Serlos Studio
    // unter „Vergangene Sessions"; die App-Trennung von 20260814280000 war hier
    // nicht durchgezogen. Kein Datenleck (security_invoker + host_id), aber die
    // falsche App.
    //
    // Erst `live_sessions` zu fragen löst das ohne Migration an einer View, die
    // die ausgelieferte Serlo-App mitbenutzt. Nachträglich filtern würde nicht
    // reichen: Dann verbrauchten die Berkat-Zeilen das Fenster von `limit`
    // schon in der View-Abfrage, und wer viel in Berkat sendet, sähe in Serlos
    // Studio nur eine Handvoll eigener Streams. So sind es genau die letzten
    // `limit` SERLO-Sessions, die die View danach nur noch anreichert.
    //
    // `app` ist für den Client lesbar — Spaltenrecht aus 20260814290000. Ohne
    // das wäre schon der Filter ein `42501`, denn Postgres verlangt SELECT auch
    // auf Spalten, die nur in der WHERE-Bedingung stehen.
    const { data: sessions } = await supabase
      .from('live_sessions')
      // `peak_viewer_count:peak_viewers` — Alias wie in `getMyActiveLiveSession`.
      .select(
        'id, title, status, started_at, ended_at,' +
        'thumbnail_url, room_name, viewer_count, peak_viewer_count:peak_viewers',
      )
      .eq('host_id', user.id)
      .eq('app', 'serlo')
      .order('started_at', { ascending: false })
      .limit(limit);

    const base = (sessions ?? []) as unknown as LiveSessionBaseRow[];
    if (base.length === 0) return [];

    // Anreicherung aus der View: Gift-Summen, Kommentar-Count, Battle-Ergebnis
    // — dieselben Kennzahlen wie im nativen live-history-Screen.
    const { data: history } = await supabase
      .from('creator_live_history')
      .select(
        'session_id, duration_secs,' +
        'total_gift_diamonds, gift_count, comment_count,' +
        'battle_result, battle_host_score, battle_guest_score,' +
        'battle_opponent_name, battle_opponent_avatar',
      )
      .eq('host_id', user.id)
      .in('session_id', base.map((s) => s.id));

    const historyMap = new Map(
      ((history ?? []) as unknown as CreatorLiveHistoryRow[]).map((h) => [h.session_id, h]),
    );

    // Über `base` gemappt, nicht über die View: `.in()` garantiert keine
    // Reihenfolge, `base` ist bereits nach `started_at` sortiert.
    return base.map((s) => {
      const h = historyMap.get(s.id);
      return {
        id:                  s.id,
        room_name:           s.room_name ?? '',
        title:               s.title ?? null,
        thumbnail_url:       s.thumbnail_url ?? null,
        started_at:          s.started_at,
        ended_at:            s.ended_at ?? null,
        peak_viewer_count:   s.peak_viewer_count ?? 0,
        viewer_count:        s.viewer_count ?? 0,
        status:              s.status,
        duration_secs:       h?.duration_secs ?? null,
        total_gift_diamonds: h?.total_gift_diamonds ?? 0,
        gift_count:          h?.gift_count ?? 0,
        comment_count:       h?.comment_count ?? 0,
        battle_result:       h?.battle_result ?? null,
        battle_host_score:   h?.battle_host_score ?? null,
        battle_guest_score:  h?.battle_guest_score ?? null,
        battle_opponent_name:   h?.battle_opponent_name ?? null,
        battle_opponent_avatar: h?.battle_opponent_avatar ?? null,
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
    image_url?: string | null;
    emoji?: string | null;
  } | null;
}

export const getSessionGifts = cache(
  async (sessionId: string, limit = 30): Promise<SessionGiftRow[]> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from('gift_transactions')
      .select(
        `id, sender_id, recipient_id, gift_id, coin_cost, created_at,
         sender:profiles!gift_transactions_sender_id_fkey ( username, avatar_url ),
         gift:gift_catalog!gift_transactions_gift_id_fkey ( name, emoji )`,
      )
      .eq('live_session_id', sessionId)
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
    if (
      process.env.LIVE_GIFT_GOALS_ENABLED !== '1' &&
      process.env.NEXT_PUBLIC_LIVE_GIFT_GOALS_ENABLED !== '1'
    ) {
      return null;
    }

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
      // Berkat teilt sich diese Tabelle seit 20260815120000 — ohne den Filter
      // stünde ein Berkat-Auktionsabend in Serlos „Demnächst"-Streifen.
      .eq('app', 'serlo')
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
      .eq('app', 'serlo')
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
export const isHostMutedForViewer = cache(
  async (hostId: string, viewerId: string | null | undefined): Promise<boolean> => {
    if (!viewerId || viewerId === hostId) return false;

    const supabase = await createClient();
    const { count } = await supabase
      .from('muted_live_hosts')
      .select('host_id', { count: 'exact', head: true })
      .eq('user_id', viewerId)
      .eq('host_id', hostId);
    return (count ?? 0) > 0;
  },
);

export const isHostMuted = cache(
  async (hostId: string): Promise<boolean> => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return isHostMutedForViewer(hostId, user?.id ?? null);
  },
);
