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
  room_name: string | null;
  started_at: string;
  ended_at: string | null;
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

// ─── Aktive Lives laden (für LiveBanner im Feed) ──────────────────────────────
export function useActiveLiveSessions() {
  return useQuery<LiveSession[]>({
    queryKey: ['live-sessions-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_sessions')
        .select('*, profiles(username, avatar_url)')
        .eq('status', 'active')
        .order('viewer_count', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as LiveSession[];
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

// ─── Einzelne Live-Session laden ──────────────────────────────────────────────
export function useLiveSession(sessionId: string | null) {
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
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
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
  const queryClient  = useQueryClient();
  const [sessionId,  setSessionId]  = useState<string | null>(null);
  const [roomName,   setRoomName]   = useState<string | null>(null);
  const [lkToken,    setLkToken]    = useState<string | null>(null);
  const [lkUrl,      setLkUrl]      = useState<string | null>(null);
  const [loading,    setLoading]    = useState(false);

  const startSession = async (title: string): Promise<{ sessionId: string; token: string; url: string } | null> => {
    if (!profile) return null;
    setLoading(true);
    try {
      // Eindeutiger Room-Name
      const room = `vibes-live-${profile.id}-${Date.now()}`;

      // LiveKit-Token holen (bevor Session in DB angelegt wird)
      const lk = await fetchLiveKitToken(room, true);
      if (!lk) throw new Error('LiveKit Token konnte nicht generiert werden');

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
            user_id: f.follower_id,
            actor_id: profile.id,
            type: 'live',
            message: title.trim() || null,
            session_id: data.id,
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
    await supabase.rpc('end_live_session', { p_session_id: id });
    setSessionId(null);
    setRoomName(null);
    setLkToken(null);
    queryClient.invalidateQueries({ queryKey: ['live-sessions-active'] });
  };

  return { sessionId, roomName, lkToken, lkUrl, startSession, endSession, loading };
}

// ─── Zuschauer: Session beitreten & verlassen ─────────────────────────────────
export function useLiveViewer(sessionId: string | null) {
  const joined = useRef(false);

  useEffect(() => {
    if (!sessionId) return;
    if (joined.current) return;
    joined.current = true;

    supabase.rpc('join_live_session', { p_session_id: sessionId });

    return () => {
      supabase.rpc('leave_live_session', { p_session_id: sessionId });
      joined.current = false;
    };
  }, [sessionId]);
}

// ─── Echtzeit-Kommentare ──────────────────────────────────────────────────────
export function useLiveComments(sessionId: string | null) {
  const [comments, setComments] = useState<LiveComment[]>([]);

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

  // Realtime-Subscription
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`live-comments-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_comments',
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          // Profil für neuen Kommentar nachladen
          const { data: profileData } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', payload.new.user_id)
            .single();

          const newComment: LiveComment = {
            ...(payload.new as LiveComment),
            profiles: profileData ?? null,
          };
          setComments((prev) => [...prev.slice(-99), newComment]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  const sendComment = async (text: string) => {
    const { profile } = useAuthStore.getState();
    if (!profile || !sessionId || !text.trim()) return;
    await supabase.from('live_comments').insert({
      session_id: sessionId,
      user_id: profile.id,
      text: text.trim(),
    });
  };

  return { comments, sendComment };
}

// ─── Echtzeit-Reaktionen ──────────────────────────────────────────────────────
export function useLiveReactions(sessionId: string | null) {
  const [reactions, setReactions] = useState<LiveReaction[]>([]);

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`live-reactions-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_reactions',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const reaction: LiveReaction = {
            id: payload.new.id as string,
            emoji: payload.new.emoji as string,
            user_id: payload.new.user_id as string,
          };
          setReactions((prev) => [...prev, reaction]);
          // Reaktion nach 3s wieder entfernen (Animation)
          setTimeout(() => {
            setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
          }, 3000);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  const sendReaction = async (emoji: string) => {
    const { profile } = useAuthStore.getState();
    if (!profile || !sessionId) return;
    await supabase.from('live_reactions').insert({
      session_id: sessionId,
      user_id: profile.id,
      emoji,
    });
  };

  return { reactions, sendReaction };
}
