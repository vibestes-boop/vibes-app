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
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

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
      const { data, error } = await supabase
        .from('live_sessions')
        .select('*, profiles(username, avatar_url)')
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
      const { data, error } = await supabase
        .from('live_sessions')
        .select('*, profiles(username, avatar_url)')
        .eq('id', sessionId)
        .single();
      if (error) return null;
      return data as LiveSession;
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
  isHost: boolean
): Promise<{ token: string; url: string } | null> {
  // supabase.auth.getSession() refresht automatisch abgelaufene Tokens.
  // Fallback auf authStore falls supabase-Proxy noch initialisiert wird.
  let { data: { session } } = await supabase.auth.getSession();
  if (!session) session = useAuthStore.getState().session;
  if (!session) throw new Error('Keine Auth-Session – bitte neu einloggen');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const res = await fetch(`${supabaseUrl}/functions/v1/livekit-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ roomName, isHost }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '(kein Body)');
    throw new Error(`Edge Function Fehler ${res.status}: ${body}`);
  }
  return res.json();
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

  const startSession = async (title: string): Promise<{ sessionId: string; token: string; url: string } | null> => {
    if (!profile) return null;
    setLoading(true);
    try {
      // Eindeutiger Room-Name
      const room = `vibes-live-${profile.id}-${Date.now()}`;

      // LiveKit-Token holen (bevor Session in DB angelegt wird)
      const lk = await fetchLiveKitToken(room, true);
      if (!lk) throw new Error('LiveKit Token konnte nicht generiert werden');

      // ── Zombie-Sessions bereinigen: alle aktiven Sessions dieses Hosts beenden ──
      // Verhindert mehrfache LIVE-Kreise falls eine vorherige Session nie sauber beendet wurde
      await supabase
        .from('live_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString(), viewer_count: 0 })
        .eq('host_id', profile.id)
        .eq('status', 'active');

      const { data, error } = await supabase
        .from('live_sessions')
        .insert({ host_id: profile.id, title: title.trim() || null, room_name: room })
        .select('id')
        .single();
      if (error) throw error;

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

  return { sessionId, roomName, lkToken, lkUrl, startSession, endSession, saveReplayUrl, loading };
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
export function useLiveComments(sessionId: string | null) {
  const [comments, setComments] = useState<LiveComment[]>([]);
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

  // Realtime-Subscription via Broadcast (vermeidet DB Traffic & N+1 Queries)
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`live-comments-${sessionId}`)
      .on(
        'broadcast',
        { event: 'new-comment' },
        (payload) => {
          setComments((prev) => [...prev.slice(-99), payload.payload as LiveComment]);
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
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId]);

  const sendComment = async (text: string) => {
    const { profile } = useAuthStore.getState();
    if (!profile || !sessionId || !text.trim()) return;

    const commentData: LiveComment = {
      id: Math.random().toString(36).substring(7),
      session_id: sessionId,
      user_id: profile.id,
      text: text.trim(),
      created_at: new Date().toISOString(),
      profiles: {
        username: profile.username,
        avatar_url: profile.avatar_url,
      },
    };

    // 1. Sofort lokales Update (optimistic UI)
    setComments((prev) => [...prev.slice(-99), commentData]);

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

  return { comments, sendComment, sendSystemEvent, deleteComment };
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
  const [reactions, setReactions] = useState<LiveReaction[]>([]);
  const pendingTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Kanalreferenz für direkte Broadcasts ohne neuen Channel-Overhead
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Cleanup aller Timeouts beim Unmount
  useEffect(() => {
    return () => {
      pendingTimers.current.forEach(clearTimeout);
      pendingTimers.current = [];
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
          setReactions((prev) => [...prev, reaction]);
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

  const sendReaction = async (emoji: string) => {
    const { profile } = useAuthStore.getState();
    if (!profile || !sessionId) return;

    const reactionData: LiveReaction = {
      id: Math.random().toString(36).substring(7),
      user_id: profile.id,
      emoji,
    };

    // 1. Lokales Update (optimistic UI)
    setReactions((prev) => [...prev, reactionData]);
    const timer = setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== reactionData.id));
      pendingTimers.current = pendingTimers.current.filter((t) => t !== timer);
    }, 3000);
    pendingTimers.current.push(timer);

    // 2. Broadcast via bestehenden Channel
    channelRef.current?.send({
      type: 'broadcast',
      event: 'new-reaction',
      payload: reactionData,
    });

    // 3. ❤️-Reaktion erhöht den Heat Score des Lives → mehr Verbreitung im Feed
    if (emoji === '❤️') {
      supabase.rpc('increment_live_likes', { p_session_id: sessionId }).then();
    }

    // 4. Optional in DB speichern für Analytics
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
    // In DB speichern (persistent auch für neue Viewer)
    if (sessionId) {
      supabase.from('live_sessions')
        .update({ pinned_comment: comment })
        .eq('id', sessionId)
        .then();
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
