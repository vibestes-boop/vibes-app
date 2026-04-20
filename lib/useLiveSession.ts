/**
 * useLiveSession.ts
 *
 * Verwaltet Live-Sessions über Supabase:
 * - Session erstellen / beenden (Host)
 * - Session beitreten / verlassen (Zuschauer)
 * - Echtzeit-Kommentare via Supabase Realtime
 * - Echtzeit-Reaktionen via Supabase Realtime
 * - Aktive Lives für den Feed laden
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Sentry from '@sentry/react-native';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';
import { containsBlockedWord } from './liveModerationWords';

export type LiveSession = {
  id: string;
  host_id: string;
  title: string | null;
  status: 'active' | 'ended';
  viewer_count: number;
  peak_viewers: number;
  like_count: number;
  comment_count: number;
  room_name: string | null;
  started_at: string;
  ended_at: string | null;
  replay_url: string | null;
  is_replayable: boolean;
  thumbnail_url: string | null;
  category: string | null;
  // ── Moderation ──────────────────────────────────────────────────────────────
  moderation_enabled: boolean;
  moderation_words: string[];
  /** Phase 6: Sekunden Cool-Down zwischen Messages pro User (0 = aus) */
  slow_mode_seconds: number;
  /** Nur-Follower-Chat: wenn true können nur Follower des Hosts kommentieren */
  followers_only_chat: boolean;
  /** Host-Einstellung: ob Zuschauer kommentieren dürfen */
  allow_comments: boolean;
  /** Host-Einstellung: ob Zuschauer Geschenke senden dürfen */
  allow_gifts: boolean;
  /** Women-Only Stream: nur verifizierte Frauen können beitreten */
  women_only: boolean;
  profiles: {
    username: string;
    avatar_url: string | null;
  } | null;
};

export type LiveComment = {
  id: string;
  session_id: string;
  user_id: string;
  text: string;
  created_at: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  } | null;
};

export type LiveReaction = {
  id: string;
  emoji: string;
  user_id: string;
};

// ─── Aktive Lives laden (für StoriesRow im Feed — TikTok/Instagram Stil) ──────
export function useActiveLiveSessions() {
  const queryClient = useQueryClient();

  // Realtime: sofort reagieren wenn ein Live startet / endet
  useEffect(() => {
    const channel = supabase
      .channel('live-sessions-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_sessions' },
        () => {
          // Cache invalidieren → Query lädt neu mit frischen Daten
          queryClient.invalidateQueries({ queryKey: ['live-sessions-active'] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return useQuery<LiveSession[]>({
    queryKey: ['live-sessions-active'],
    queryFn: async () => {
      // FK explizit (host_id) — sonst HTTP 300 Multiple Choices, weil live_cohosts
      // zusätzliche live_sessions↔profiles Relationships erzeugt (user_id, invited_by).
      const { data, error } = await supabase
        .from('live_sessions')
        .select('*, profiles!host_id(username, avatar_url)')
        .eq('status', 'active')
        .gte('started_at', new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()) // max 8h alte Sessions
        .order('viewer_count', { ascending: false })
        .limit(20);
      if (error) throw error;
      // Deduplizierung nach host_id
      const seen = new Set<string>();
      const unique = (data ?? []).filter((s) => {
        if (seen.has(s.host_id)) return false;
        seen.add(s.host_id);
        return true;
      });
      // 🔥 Verbesserter Heat Score Algorithmus (Research-Based):
      // - viewer_count ×5: stärkstes Signal (Echtzeit-Nachfrage)
      // - comment_count ×3: aktive Teilnahme > Likes (YouTube/Twitch research)
      // - like_count ×1: passives Signal, niedrigste Gewichtung
      // - Early Boost ×1.5: TikTok-Prinzip: erste 15 Min bekommen Boost
      // - Time Decay ÷√(alter+1): Hacker News Prinzip — neue Lives haben Chance
      const now = Date.now();
      return unique
        .slice(0, 10)
        .map((session) => {
          const ageMinutes = (now - new Date(session.started_at).getTime()) / 60_000;
          const earlyBoost = ageMinutes < 15 ? 1.5 : 1.0;
          const engagement =
            (session.viewer_count ?? 0) * 5 +
            (session.comment_count ?? 0) * 3 +
            (session.like_count ?? 0) * 1;
          const heatScore = (engagement * earlyBoost) / Math.sqrt(ageMinutes + 1);
          return { ...session, _heatScore: heatScore };
        })
        .sort((a, b) => b._heatScore - a._heatScore) as LiveSession[];
    },
    staleTime: 30_000,           // 30s frisch — Realtime übernimmt primär
    refetchInterval: 30_000,     // Backup: alle 30s neu laden falls Realtime-Event verloren geht
    refetchIntervalInBackground: false,
  });
}

// ─── Einzelne Live-Session laden ──────────────────────────────────────────────
export function useLiveSession(sessionId: string | null) {
  const queryClient = useQueryClient();

  // Realtime: sofort reagieren wenn Session-Status oder viewer_count sich ändert
  // (z.B. Host beendet Live → Zuschauer wird sofort navigiert)
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`live-session-status-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_sessions',
          filter: `id=eq.${sessionId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['live-session', sessionId] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, queryClient]);

  return useQuery<LiveSession | null>({
    queryKey: ['live-session', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      // FK explizit (host_id) — sonst HTTP 300 Multiple Choices, weil live_cohosts
      // zusätzliche live_sessions↔profiles Relationships erzeugt (user_id, invited_by).
      // maybeSingle() statt single() — kein 406 wenn Row (z.B. wegen RLS) fehlt.
      const { data, error } = await supabase
        .from('live_sessions')
        .select('*, profiles!host_id(username, avatar_url)')
        .eq('id', sessionId)
        .maybeSingle();
      if (error) {
        Sentry.captureMessage('useLiveSession query failed', {
          level: 'error',
          tags: { area: 'live-session-query' },
          extra: { sessionId, code: (error as any)?.code, message: error.message, details: (error as any)?.details, hint: (error as any)?.hint },
        });
        return null;
      }
      // Phase 6: Default für slow_mode_seconds falls Column auf alter DB fehlt
      // (Grace-Period für frisch migrierte Prod-DB).
      if (data && typeof (data as any).slow_mode_seconds !== 'number') {
        (data as any).slow_mode_seconds = 0;
      }
      return (data as LiveSession) ?? null;
    },
    enabled: !!sessionId,
    // staleTime: 5s → Realtime-Events innerhalb von 5s lösen nur einen einzigen
    // Refetch aus statt jeden Event direkt in eine DB-Query umzuwandeln.
    // Host schreibt viewer_count alle 5s → ohne staleTime = 1 Refetch/5s per Viewer,
    // mit 5s staleTime = identisches Ergebnis aber robuster gegen Event-Floods.
    staleTime: 5_000,
    // Retry alle 3s wenn room_name noch null ist (Race-Condition: Viewer schneller als DB-Insert)
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && !data.room_name) return 3_000;  // warte auf room_name
      return false; // Realtime übernimmt sobald room_name da ist
    },
  });
}

// ─── Zuschauer-Anzahl (Wrapper um useLiveSession für den Host-Screen) ──────────
export function useViewerCount(sessionId: string | null) {
  const { data: session } = useLiveSession(sessionId);
  return {
    viewerCount: session?.viewer_count ?? 0,
    peakViewers: session?.peak_viewers ?? 0,
  };
}


// ─── LiveKit Token via Supabase Edge Function abrufen ────────────────────────
export async function fetchLiveKitToken(
  roomName: string,
  isHost: boolean,
  isCoHost = false,
): Promise<{ token: string; url: string } | null> {
  // Session holen — refreshSession() erneuert abgelaufene Tokens
  let { data: { session } } = await supabase.auth.getSession();

  // Falls abgelaufen: neu anfordern
  if (!session?.access_token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    session = refreshed.session;
  }
  if (!session?.access_token) {
    session = useAuthStore.getState().session;
  }
  if (!session?.access_token) {
    throw new Error('Keine Auth-Session – bitte neu einloggen');
  }

  const supabaseUrl     = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

  // DIAG: Request-Start loggen (Sentry Breadcrumb + console)
  Sentry.addBreadcrumb({
    category: 'livekit.token',
    level: 'info',
    message: 'fetchLiveKitToken → POST /functions/v1/livekit-token',
    data: { roomName, isHost, isCoHost, hasSupabaseUrl: !!supabaseUrl, hasAnonKey: !!supabaseAnonKey },
  });
  __DEV__ && console.log('[LK TOKEN FETCH]', JSON.stringify({ roomName, isHost, isCoHost, hasUrl: !!supabaseUrl, hasKey: !!supabaseAnonKey }));

  // Supabase Edge Gateway hat gelegentliche Cold-Start-Misses (502/503/504 ohne
  // dass unsere Function überhaupt aufgerufen wird — execution_id: null, 13ms).
  // Daher 1× automatisch retryen bei diesen transienten Gateway-Fehlern.
  const doFetch = () =>
    fetch(`${supabaseUrl}/functions/v1/livekit-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Supabase Gateway braucht BEIDE Header:
        'Authorization': `Bearer ${session!.access_token}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({ roomName, isHost, isCoHost }),
    });

  let res = await doFetch();

  // Transiente Gateway-Fehler (502/503/504) → 1× retryen nach 600ms.
  // Bei 4xx (Auth/Validation) oder 200 NICHT retryen — sonst maskieren wir echte Bugs.
  const isTransient = res.status === 502 || res.status === 503 || res.status === 504;
  if (isTransient) {
    Sentry.addBreadcrumb({
      category: 'livekit.token',
      level: 'warning',
      message: `Transient gateway ${res.status} — retrying in 600ms`,
      data: { roomName, isHost, isCoHost, status: res.status },
    });
    __DEV__ && console.log('[LK TOKEN RETRY]', res.status, '→ retry in 600ms');
    await new Promise((r) => setTimeout(r, 600));
    res = await doFetch();
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '(kein Body)');
    const errMsg = `Edge Function Fehler ${res.status}: ${body}`;
    // DIAG: Edge Function Fehler nach Sentry
    Sentry.captureMessage(errMsg, {
      level: 'error',
      tags: { area: 'livekit-token', status: String(res.status), retried: String(isTransient) },
      extra: { roomName, isHost, isCoHost, body },
    });
    __DEV__ && console.log('[LK TOKEN HTTP ERROR]', res.status, body);
    throw new Error(errMsg);
  }

  const result = await res.json();

  // DIAG: Response-Shape loggen (hasToken, tokenLength, url-Format)
  const diag = {
    hasToken: !!result?.token,
    tokenLength: result?.token?.length ?? 0,
    url: result?.url ?? null,
    urlIsWss: typeof result?.url === 'string' && result.url.startsWith('wss://'),
  };
  Sentry.addBreadcrumb({
    category: 'livekit.token',
    level: 'info',
    message: 'fetchLiveKitToken ← response',
    data: diag,
  });
  __DEV__ && console.log('[LK TOKEN RESULT]', JSON.stringify(diag));

  if (!diag.hasToken || !diag.urlIsWss) {
    Sentry.captureMessage('fetchLiveKitToken returned invalid payload', {
      level: 'error',
      tags: { area: 'livekit-token' },
      extra: { roomName, isHost, isCoHost, diag },
    });
  }

  return result;
}

// ─── Host: Session erstellen & beenden ────────────────────────────────────────
export function useLiveHost() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [lkToken, setLkToken] = useState<string | null>(null);
  const [lkUrl, setLkUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const startSession = async (
    title: string,
    options?: { allowComments?: boolean; allowGifts?: boolean; womenOnly?: boolean }
  ): Promise<{ sessionId: string; token: string; url: string } | null> => {
    if (!profile) return null;
    setLoading(true);
    try {
      // Eindeutiger Room-Name
      const room = `vibes-live-${profile.id}-${Date.now()}`;

      // ── Zombie-Sessions bereinigen: alle aktiven Sessions dieses Hosts beenden ──
      // Verhindert mehrfache LIVE-Kreise falls eine vorherige Session nie sauber beendet wurde
      await supabase
        .from('live_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString(), viewer_count: 0 })
        .eq('host_id', profile.id)
        .eq('status', 'active');

      // Session in DB anlegen BEVOR Token geholt wird —
      // SEC-1 Check in Edge Function prüft ob aktive Session für diesen Room existiert.
      const { data, error } = await supabase
        .from('live_sessions')
        .insert({
          host_id:        profile.id,
          title:          title.trim() || null,
          room_name:      room,
          // WARN 6 Fix: Einstellungen aus Start-Screen speichern
          allow_comments: options?.allowComments ?? true,
          allow_gifts:    options?.allowGifts ?? true,
          women_only:     options?.womenOnly ?? false,
        })
        .select('id')
        .single();
      if (error) throw error;

      // LiveKit-Token NACH DB-Insert holen — jetzt findet der SEC-1-Check die Session
      const lk = await fetchLiveKitToken(room, true);
      if (!lk) {
        // Token-Fehler: angelegte Session wieder bereinigen
        await supabase.from('live_sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', data.id);
        throw new Error('LiveKit Token konnte nicht generiert werden');
      }

      setSessionId(data.id);
      setRoomName(room);
      setLkToken(lk.token);
      setLkUrl(lk.url);
      queryClient.invalidateQueries({ queryKey: ['live-sessions-active'] });

      // Follower benachrichtigen (fire & forget)
      supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', profile.id)
        .then(({ data: followers }) => {
          if (!followers?.length) return;
          const notifications = followers.map((f) => ({
            recipient_id: f.follower_id,
            sender_id: profile.id,
            type: 'live',
            session_id: data.id,
            comment_text: title.trim() || null,
          }));
          supabase.from('notifications').insert(notifications).then();
        });

      return { sessionId: data.id, token: lk.token, url: lk.url };
    } finally {
      setLoading(false);
    }
  };

  const endSession = async (overrideSessionId?: string) => {
    const id = overrideSessionId ?? sessionId;
    if (!id) return;

    // Versuche zuerst via RPC (SECURITY DEFINER — setzt status='ended' + viewer_count=0)
    const { error: rpcError } = await supabase.rpc('end_live_session', { p_session_id: id });

    if (rpcError) {
      // Fallback: direktes UPDATE falls RPC nicht deployed oder fehlschlägt
      __DEV__ && console.warn('[endSession] RPC fehlgeschlagen, direktes UPDATE:', rpcError.message);
      await supabase
        .from('live_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString(), viewer_count: 0 })
        .eq('id', id);
    }

    queryClient.invalidateQueries({ queryKey: ['live-session', id] });
    queryClient.invalidateQueries({ queryKey: ['live-sessions-active'] });
    setSessionId(null);
    setRoomName(null);
    setLkToken(null);
  };

  /** replay_url setzen — macht das Live als Replay abrufbar */
  const saveReplayUrl = async (sid: string, url: string) => {
    await supabase
      .from('live_sessions')
      .update({ replay_url: url, is_replayable: true })
      .eq('id', sid);
    queryClient.invalidateQueries({ queryKey: ['live-session', sid] });
  };

  /**
   * Moderationseinstellungen für eine Session aktualisieren.
   * Host kann Chat-Filter an-/ausschalten und eigene Wörter verwalten.
   * @param sid       Session-ID
   * @param enabled   true = Filter aktiv
   * @param words     Host-eigene geblockte Wörter (z.B. Tschetschenisch später)
   */
  const updateModeration = async (
    sid: string,
    enabled: boolean,
    words: string[]
  ): Promise<void> => {
    await supabase
      .from('live_sessions')
      .update({ moderation_enabled: enabled, moderation_words: words })
      .eq('id', sid);
    queryClient.invalidateQueries({ queryKey: ['live-session', sid] });
    queryClient.invalidateQueries({ queryKey: ['live-sessions-active'] });
  };

  return { sessionId, roomName, lkToken, lkUrl, startSession, endSession, saveReplayUrl, updateModeration, loading };
}

// ─── Zuschauer: Session beitreten & verlassen ─────────────────────────────────
export function useLiveViewer(sessionId: string | null) {
  const joined = useRef(false);

  useEffect(() => {
    if (!sessionId) return;
    if (joined.current) return;
    joined.current = true;

    supabase.rpc('join_live_session', { p_session_id: sessionId })
      .then(({ error }) => {
        if (error) __DEV__ && console.warn('[useLiveViewer] join_live_session failed:', error.message);
      });

    return () => {
      supabase.rpc('leave_live_session', { p_session_id: sessionId })
        .then(({ error }) => {
          if (error) __DEV__ && console.warn('[useLiveViewer] leave_live_session failed:', error.message);
        });
      joined.current = false;
    };
  }, [sessionId]);
}

// ─── Echtzeit-Kommentare (via Supabase Broadcast) ─────────────────────────────

/**
 * @param sessionId         ID der Live-Session
 * @param moderationEnabled true wenn Host-Moderation aktiv ist
 * @param hostBlockedWords  Host-eigene Wortliste (aus live_sessions.moderation_words)
 * @param slowModeSeconds   Phase 6: Cool-Down zwischen eigenen Messages in Sekunden (0 = aus)
 */
export function useLiveComments(
  sessionId: string | null,
  moderationEnabled = false,
  hostBlockedWords: string[] = [],
  slowModeSeconds = 0,
) {
  const [comments, setComments] = useState<LiveComment[]>([]);
  // Phase 6: getimeoutete User dieser Session. Keys = user_ids, Values = ms-Timestamp bis wann Mute gilt.
  // Wir halten das in einem Ref (keine Re-Renders bei jeder Map-Mutation nötig), aber exposen
  // `selfTimeoutUntil` als State für UI-Feedback.
  const timeoutsRef = useRef<Map<string, number>>(new Map());
  const [selfTimeoutUntil, setSelfTimeoutUntil] = useState<number | null>(null);
  // Slow-Mode: letzter eigener Send-Timestamp (ms)
  const lastSendAtRef = useRef<number>(0);
  // Kanalreferenz für direkte Broadcasts ohne neuen Channel-Overhead
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Initiale Kommentare laden (letzte 50)
  useEffect(() => {
    if (!sessionId) return;
    supabase
      .from('live_comments')
      .select('*, profiles(username, avatar_url)')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setComments(((data ?? []) as LiveComment[]).reverse());
      });
  }, [sessionId]);

  // Phase 6: Initiale Timeouts laden + live updates via Realtime.
  // So sieht auch ein frisch verbundener Viewer laufende Mutes und filtert korrekt.
  useEffect(() => {
    if (!sessionId) return;
    const myUid = useAuthStore.getState().profile?.id ?? null;

    // Initial-Fetch
    supabase
      .from('live_chat_timeouts')
      .select('user_id, until_at')
      .eq('session_id', sessionId)
      .gt('until_at', new Date().toISOString())
      .then(({ data }) => {
        if (!data) return;
        const m = new Map<string, number>();
        for (const row of data as { user_id: string; until_at: string }[]) {
          const untilMs = new Date(row.until_at).getTime();
          if (untilMs > Date.now()) m.set(row.user_id, untilMs);
        }
        timeoutsRef.current = m;
        // Self-Timeout setzen falls ich drin bin
        if (myUid && m.has(myUid)) {
          setSelfTimeoutUntil(m.get(myUid) ?? null);
        }
      });

    // Auto-Cleanup für abgelaufene Einträge (pro Minute aufräumen)
    const cleanup = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [uid, until] of timeoutsRef.current) {
        if (until <= now) {
          timeoutsRef.current.delete(uid);
          changed = true;
          if (myUid === uid) setSelfTimeoutUntil(null);
        }
      }
      if (changed && __DEV__) console.log('[ChatMod] cleaned up expired timeouts');
    }, 30_000);
    return () => clearInterval(cleanup);
  }, [sessionId]);

  // Realtime-Subscription via Broadcast (vermeidet DB Traffic & N+1 Queries)
  useEffect(() => {
    if (!sessionId) return;
    const myUid = useAuthStore.getState().profile?.id ?? null;

    const channel = supabase
      .channel(`live-comments-${sessionId}`)
      .on(
        'broadcast',
        { event: 'new-comment' },
        (payload) => {
          const comment = payload.payload as LiveComment;
          // Phase 6: Messages von getimeouteten Usern droppen (Shadow-Ban für alle).
          // Der betroffene User hat eigene lokale Kopie bereits gesehen (Optimistic UI).
          const until = timeoutsRef.current.get(comment.user_id);
          if (until && until > Date.now()) {
            __DEV__ && console.log('[ChatMod] dropping comment from timed-out user');
            return;
          }
          setComments((prev) => [...prev.slice(-99), comment]);
        }
      )
      .on(
        'broadcast',
        { event: 'delete-comment' },
        (payload) => {
          const { commentId } = payload.payload as { commentId: string };
          setComments((prev) => prev.filter((c) => c.id !== commentId));
        }
      )
      .on(
        'broadcast',
        { event: 'chat-timeout' },
        (payload) => {
          // Phase 6: Host hat einen User gemutet. Map updaten + lokale UI filtern.
          const data = payload.payload as { userId: string; untilTs: number };
          const until = Number(data.untilTs);
          if (!data.userId || !until || until <= Date.now()) return;
          timeoutsRef.current.set(data.userId, until);
          if (myUid === data.userId) setSelfTimeoutUntil(until);
          // Historische Messages von dem User aus der aktuellen Ansicht filtern
          setComments((prev) => prev.filter((c) => c.user_id !== data.userId));
        }
      )
      .on(
        'broadcast',
        { event: 'chat-untimeout' },
        (payload) => {
          const data = payload.payload as { userId: string };
          if (!data.userId) return;
          timeoutsRef.current.delete(data.userId);
          if (myUid === data.userId) setSelfTimeoutUntil(null);
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId]);

  // Phase 6: sendComment liefert jetzt ggf. einen Block-Grund zurück,
  // damit die UI "Slow-Mode: warte 3s" oder "Du bist gemutet (2min)" anzeigen kann.
  const sendComment = async (
    text: string,
  ): Promise<{ blocked: true; reason: string } | void> => {
    const { profile } = useAuthStore.getState();
    if (!profile || !sessionId || !text.trim()) return;

    // ── Timeout-Check: bist du gerade gemutet? ─────────────────────────────
    const myTimeout = timeoutsRef.current.get(profile.id);
    if (myTimeout && myTimeout > Date.now()) {
      const remainSec = Math.ceil((myTimeout - Date.now()) / 1000);
      return { blocked: true, reason: `Du bist für ${remainSec}s gemutet.` };
    }

    // ── Slow-Mode-Check ───────────────────────────────────────────────────
    if (slowModeSeconds > 0) {
      const sinceLast = Date.now() - lastSendAtRef.current;
      const cooldownMs = slowModeSeconds * 1000;
      if (sinceLast < cooldownMs) {
        const waitSec = Math.ceil((cooldownMs - sinceLast) / 1000);
        return { blocked: true, reason: `Slow-Mode: Warte noch ${waitSec}s.` };
      }
    }

    const commentData: LiveComment = {
      // WARN 4 Fix: Timestamp + voller Random-String verhindert Kollision bei vielen Kommentaren
      id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
      session_id: sessionId,
      user_id: profile.id,
      text: text.trim(),
      created_at: new Date().toISOString(),
      profiles: {
        username: profile.username,
        avatar_url: profile.avatar_url,
      },
    };

    // ── Moderation: Shadow-Ban bei geblockten Wörtern ──────────────────────
    // Sender sieht seinen Kommentar, aber er wird NICHT an andere gesendet.
    if (moderationEnabled && containsBlockedWord(text.trim(), hostBlockedWords)) {
      // Nur lokal anzeigen (Sender merkt nichts)
      setComments((prev) => [...prev.slice(-99), commentData]);
      // Slow-Mode Timer trotzdem triggern, damit Spam-Attacks nicht 1 Nachricht pro ms senden
      lastSendAtRef.current = Date.now();
      __DEV__ && console.log('[Moderation] Kommentar geblockt (Shadow-Ban):', text.slice(0, 30));
      return; // Kein Broadcast, kein DB-Insert
    }

    // 1. Sofort lokales Update (optimistic UI)
    setComments((prev) => [...prev.slice(-99), commentData]);
    // Slow-Mode Timer nach erfolgreichem Send
    lastSendAtRef.current = Date.now();

    // 2. Broadcast via bestehenden Channel
    // Falls Channel null ist (kurze Unterbrechung) → Kommentar nur lokal + DB-Fallback
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'new-comment',
        payload: commentData,
      });
    } else {
      __DEV__ && console.warn('[useLiveComments] Channel nicht verbunden — nur DB-Fallback');
    }

    // 3. DB-Speichern (auch wenn Broadcast scheitert, Kommentar bleibt persistent)
    supabase.from('live_comments').insert({
      session_id: sessionId,
      user_id: profile.id,
      text: text.trim(),
    }).then(({ error }) => {
      if (error) __DEV__ && console.warn('[useLiveComments] insert failed:', error.message);
    });
  };


  const sendSystemEvent = (text: string) => {
    const sysEvent: LiveComment = {
      id: `sys-${Date.now()}-${Math.random()}`,
      session_id: sessionId ?? '',
      user_id: 'system',
      text,
      created_at: new Date().toISOString(),
      profiles: null,
      isSystem: true,
    } as any;
    setComments((prev) => [...prev.slice(-99), sysEvent]);
    // Auch an andere Zuschauer broadcasten
    channelRef.current?.send({
      type: 'broadcast',
      event: 'new-comment',
      payload: sysEvent,
    });
  };

  const deleteComment = (commentId: string) => {
    // 1. Lokal entfernen
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    // 2. An alle Zuschauer broadcasten (Echtzeit-Entfernung)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'delete-comment',
      payload: { commentId },
    });
  };

  return { comments, sendComment, sendSystemEvent, deleteComment, selfTimeoutUntil };
}

// ─── Phase 6: Host-seitige Chat-Moderations-Aktionen ─────────────────────────
// Timeouts + Slow-Mode setzen/entfernen. Broadcast geht an den gleichen
// live-comments-{sessionId} Channel — die bestehende `useLiveComments`
// Subscription hört darauf und filtert entsprechend.
export function useChatModeration(sessionId: string | null) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    // Reuse des gleichen Channel-Namens, damit Broadcasts hier sofort bei allen
    // Viewern (die auf demselben Channel sitzen) landen.
    const channel = supabase.channel(`live-comments-${sessionId}`).subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId]);

  const timeoutUser = useCallback(
    async (userId: string, seconds: number, reason?: string): Promise<boolean> => {
      if (!sessionId) return false;
      try {
        const { data, error } = await supabase.rpc('timeout_chat_user', {
          p_session_id: sessionId,
          p_user_id:    userId,
          p_seconds:    seconds,
          p_reason:     reason ?? null,
        });
        if (error) throw error;
        const untilTs =
          typeof data === 'string'
            ? new Date(data).getTime()
            : Date.now() + seconds * 1000;
        channelRef.current?.send({
          type:    'broadcast',
          event:   'chat-timeout',
          payload: { userId, untilTs, reason: reason ?? null },
        });
        return true;
      } catch (err) {
        __DEV__ && console.warn('[ChatMod] timeout_chat_user failed:', err);
        return false;
      }
    },
    [sessionId],
  );

  const untimeoutUser = useCallback(async (userId: string): Promise<boolean> => {
    if (!sessionId) return false;
    try {
      const { error } = await supabase.rpc('untimeout_chat_user', {
        p_session_id: sessionId,
        p_user_id:    userId,
      });
      if (error) throw error;
      channelRef.current?.send({
        type:    'broadcast',
        event:   'chat-untimeout',
        payload: { userId },
      });
      return true;
    } catch (err) {
      __DEV__ && console.warn('[ChatMod] untimeout_chat_user failed:', err);
      return false;
    }
  }, [sessionId]);

  const setSlowMode = useCallback(async (seconds: number): Promise<boolean> => {
    if (!sessionId) return false;
    try {
      const { error } = await supabase.rpc('set_live_slow_mode', {
        p_session_id: sessionId,
        p_seconds:    Math.max(0, Math.min(300, Math.floor(seconds))),
      });
      if (error) throw error;
      return true;
    } catch (err) {
      __DEV__ && console.warn('[ChatMod] set_live_slow_mode failed:', err);
      return false;
    }
  }, [sessionId]);

  return { timeoutUser, untimeoutUser, setSlowMode };
}

// Helper: Erstellt ein Fake-Comment-Objekt für System-Nachrichten
export function makeSystemEvent(text: string): LiveComment {
  return {
    id: `sys-${Date.now()}-${Math.random()}`,
    session_id: '',
    user_id: 'system',
    text,
    created_at: new Date().toISOString(),
    profiles: null,
    isSystem: true,
  } as any;
}

// ─── Echtzeit-Reaktionen (via Supabase Broadcast) ─────────────────────────────
export function useLiveReactions(sessionId: string | null) {
  // Max. 15 Reaktionen gleichzeitig auf dem Screen → verhindert Render-Lag bei vielen Zuschauern
  const MAX_CONCURRENT_REACTIONS = 15;
  const [reactions, setReactions] = useState<LiveReaction[]>([]);
  const pendingTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Kanalreferenz für direkte Broadcasts ohne neuen Channel-Overhead
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Debounce-Ref für increment_live_likes: sammelt Klicks 2s lang, dann ein DB-Call
  const likesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLikesRef  = useRef(0);  // Anzahl gebatchter Likes

  // Cleanup aller Timeouts beim Unmount
  useEffect(() => {
    return () => {
      pendingTimers.current.forEach(clearTimeout);
      pendingTimers.current = [];
      if (likesDebounceRef.current) clearTimeout(likesDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`live-reactions-${sessionId}`)
      .on(
        'broadcast',
        { event: 'new-reaction' },
        (payload) => {
          const reaction = payload.payload as LiveReaction;
          // Max. MAX_CONCURRENT_REACTIONS — älteste rauswerfen wenn voll
          setReactions((prev) => {
            const next = prev.length >= MAX_CONCURRENT_REACTIONS
              ? [...prev.slice(-(MAX_CONCURRENT_REACTIONS - 1)), reaction]
              : [...prev, reaction];
            return next;
          });
          const timer = setTimeout(() => {
            setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
            pendingTimers.current = pendingTimers.current.filter((t) => t !== timer);
          }, 3000);
          pendingTimers.current.push(timer);
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId]);

  /**
   * Sendet eine Reaktion (Emoji) an alle Viewer im Stream.
   *
   * @param emoji     z.B. '❤️', '🔥', '👏'
   * @param options   skipLocal: true → KEIN lokaler FloatingHeart, nur Broadcast.
   *                  Wird vom Screen-Tap benutzt: das TapHeart am Finger-Punkt
   *                  ersetzt den bottom-right FloatingHeart für den Sender.
   */
  const sendReaction = async (emoji: string, options?: { skipLocal?: boolean }) => {
    const { profile } = useAuthStore.getState();
    if (!profile || !sessionId) return;

    const reactionData: LiveReaction = {
      id: Math.random().toString(36).substring(7),
      user_id: profile.id,
      emoji,
    };

    // 1. Lokales Update (optimistic UI) — außer der Caller will nur broadcasten
    if (!options?.skipLocal) {
      setReactions((prev) => {
        const next = prev.length >= MAX_CONCURRENT_REACTIONS
          ? [...prev.slice(-(MAX_CONCURRENT_REACTIONS - 1)), reactionData]
          : [...prev, reactionData];
        return next;
      });
      const timer = setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== reactionData.id));
        pendingTimers.current = pendingTimers.current.filter((t) => t !== timer);
      }, 3000);
      pendingTimers.current.push(timer);
    }

    // 2. Broadcast via bestehenden Channel
    channelRef.current?.send({
      type: 'broadcast',
      event: 'new-reaction',
      payload: reactionData,
    });

    // 3. ❤️-Reaktion: DEBOUNCED increment_live_likes
    //    Statt 1 DB-Call pro Klick → sammelt alle Klicks 2s lang, dann 1 Call
    if (emoji === '❤️') {
      pendingLikesRef.current += 1;
      if (likesDebounceRef.current) clearTimeout(likesDebounceRef.current);
      likesDebounceRef.current = setTimeout(() => {
        const count = pendingLikesRef.current;
        pendingLikesRef.current = 0;
        if (count > 0 && sessionId) {
          supabase.rpc('increment_live_likes', { p_session_id: sessionId }).then();
        }
      }, 2000); // 2s sammeln → max 1 DB-Call alle 2s statt 1 pro Tap
    }

    // 4. Optional in DB speichern für Analytics (fire & forget)
    supabase.from('live_reactions').insert({
      session_id: sessionId,
      user_id: profile.id,
      emoji,
    }).then(({ error }) => {
      if (error) __DEV__ && console.warn('[useLiveReactions] insert failed:', error.message);
    });
  };

  return { reactions, sendReaction };
}


// ─── Kommentar anpinnen (Host) ────────────────────────────────────────────────
export function usePinComment(sessionId: string | null) {
  const [pinnedComment, setPinnedComment] = useState<LiveComment | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    // Aktuellen gepinnten Kommentar aus DB laden
    supabase
      .from('live_sessions')
      .select('pinned_comment')
      .eq('id', sessionId)
      .single()
      .then(({ data }) => {
        if (data?.pinned_comment) setPinnedComment(data.pinned_comment as LiveComment);
      });

    const channel = supabase
      .channel(`live-pin-${sessionId}`)
      .on('broadcast', { event: 'pin-comment' }, (payload) => {
        setPinnedComment(payload.payload as LiveComment | null);
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  }, [sessionId]);

  const pinComment = async (comment: LiveComment | null) => {
    setPinnedComment(comment);
    // Broadcast an alle Zuschauer
    channelRef.current?.send({
      type: 'broadcast',
      event: 'pin-comment',
      payload: comment,
    });
    // In DB speichern (persistent auch für neue Viewer).
    // v1.23: Via SECURITY-DEFINER-RPC, damit auch Session-Moderatoren pinnen
    // können (der direkte UPDATE-Pfad fällt weg — RLS erlaubt das sonst nur
    // dem Host).
    if (sessionId) {
      if (comment) {
        supabase
          .rpc('pin_live_comment', {
            p_session_id: sessionId,
            p_comment:    comment as unknown as Record<string, unknown>,
          })
          .then(({ error }) => {
            if (error) __DEV__ && console.warn('[usePinComment] pin_live_comment failed:', error.message);
          });
      } else {
        supabase
          .rpc('unpin_live_comment', { p_session_id: sessionId })
          .then(({ error }) => {
            if (error) __DEV__ && console.warn('[usePinComment] unpin_live_comment failed:', error.message);
          });
      }
    }
  };

  return { pinnedComment, pinComment };
}

// ─── Live melden (Viewer) ─────────────────────────────────────────────────────
export async function reportLive(
  sessionId: string,
  reason: 'inappropriate' | 'spam' | 'violence' | 'other'
): Promise<{ error: string | null }> {
  const { profile } = useAuthStore.getState();
  if (!profile) return { error: 'Nicht eingeloggt' };
  const { error } = await supabase.from('live_reports').insert({
    session_id: sessionId,
    reporter_id: profile.id,
    reason,
  });
  return { error: error?.message ?? null };
}

// ─── Follower Shoutout (Host-seitig) ─────────────────────────────────────────
/**
 * Lauscht auf neue Follows für den Host während des Livestreams.
 * Sendet automatisch einen "🎉 @xyz folgt jetzt!" System-Event in den Chat.
 *
 * sendSystemEvent wird als Ref gespeichert → verhindert ständiges Re-Subscribe
 * wenn die Funktion bei jedem Render neu erstellt wird.
 */
export function useFollowerShoutout(
  hostId: string | null,
  sessionId: string | null,
  sendSystemEvent: (text: string) => void
): void {
  // Ref hält immer die neueste Version der Funktion ohne den Effect neu zu triggern
  const sendRef = useRef(sendSystemEvent);
  useEffect(() => { sendRef.current = sendSystemEvent; }, [sendSystemEvent]);

  useEffect(() => {
    if (!hostId || !sessionId) return;

    const channel = supabase
      .channel(`follower-shoutout-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'follows',
          filter: `following_id=eq.${hostId}`,
        },
        async (payload) => {
          const followerId: string = (payload.new as { follower_id: string }).follower_id;
          if (!followerId) return;

          const { data } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', followerId)
            .maybeSingle();

          const username = data?.username ?? 'Jemand';
          sendRef.current(`🎉 @${username} folgt jetzt!`);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [hostId, sessionId]); // sendSystemEvent bewusst ausgelassen — via Ref stabil
}

// ─── Nur-Follower-Chat ─────────────────────────────────────────────────────────

/**
 * Host-seitig: schaltet "Nur Follower dürfen kommentieren" an/aus.
 * Das Setting wird in live_sessions.followers_only_chat gespeichert und
 * via Realtime (useLiveSession) an alle Viewer synchronisiert.
 */
export function useFollowersOnlyChat(sessionId: string | null) {
  const [isToggling, setIsToggling] = useState(false);

  const toggle = async (enabled: boolean) => {
    if (!sessionId) return;
    setIsToggling(true);
    try {
      await supabase.rpc('toggle_followers_only_chat', {
        p_session_id: sessionId,
        p_enabled:    enabled,
      });
    } finally {
      setIsToggling(false);
    }
  };

  return { toggle, isToggling };
}

/**
 * Viewer-seitig: prüft ob der aktuelle User dem Host folgt.
 * Wird benötigt wenn followers_only_chat aktiv ist.
 * Aktualisiert sich wenn der User dem Host folgt/entfolgt.
 */
export function useIsFollowingHost(sessionId: string | null, hostId: string | null) {
  const user = useAuthStore((s) => s.user);
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null); // null = loading

  useEffect(() => {
    if (!sessionId || !hostId || !user?.id) {
      setIsFollowing(null);
      return;
    }
    // Ich bin der Host — ich bin immer erlaubt
    if (user.id === hostId) {
      setIsFollowing(true);
      return;
    }

    // Initial-Check via RPC
    (async () => {
      const { data } = await supabase.rpc('is_following_host', {
        p_session_id: sessionId,
      });
      setIsFollowing(data ?? false);
    })();

    // Realtime: wenn User folgt/entfolgt während er zuhaut
    const channel = supabase
      .channel(`follow-status-${user.id}-${hostId}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'follows',
          filter: `follower_id=eq.${user.id}`,
        },
        async () => {
          const { data } = await supabase.rpc('is_following_host', { p_session_id: sessionId });
          setIsFollowing(data ?? false);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId, hostId, user?.id]);

  return isFollowing; // null = loading, true/false = result
}
