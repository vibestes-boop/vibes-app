import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { LiveSession } from '@shared/types';

// -----------------------------------------------------------------------------
// Live-Data-Layer — SSR-Reads für `/live` und `/live/[id]`. Client-Hooks
// (Realtime-Subscriptions, Comment-Broadcast) liegen in `hooks/use-live.ts`.
// -----------------------------------------------------------------------------

// HINWEIS: `peak_viewer_count:peak_viewers` — die tatsächliche DB-Spalte heißt
// `peak_viewers` (siehe `supabase/live_studio.sql` und Replay-Migration).
// Wir aliasen in Supabase selbst, damit alle TypeScript-Verbraucher weiter
// `peak_viewer_count` lesen können (shared/types/live.ts + host-deck + studio).
// Ohne Alias war die Spalte `peak_viewer_count` unbekannt → `data = null` →
// `notFound()` in `/live/host/[id]` → 404 beim Host-Deck.
const SESSION_COLUMNS =
  'id, host_id, room_name, title, thumbnail_url, category, status, viewer_count, peak_viewer_count:peak_viewers, started_at, ended_at, updated_at, moderation_enabled, moderation_words, slow_mode_seconds';

// HINWEIS: `verified:is_verified` — analog zu `peak_viewer_count:peak_viewers`.
// Die DB-Spalte heißt `is_verified` (Migration 20260407010000_creator_analytics),
// TypeScript-Verbraucher (LiveSessionWithHost.host.verified etc.) erwarten aber
// `verified`. Supabase-PostgREST-Alias macht das Mapping ohne Type-Rewrite.
// Ohne den Alias schlägt der Embed-Query still fehl → `data = null` →
// `getLiveSession` → `notFound()` → 404 auf `/live/host/[id]`.
const HOST_JOIN = 'host:profiles!live_sessions_host_id_fkey ( id, username, display_name, avatar_url, verified:is_verified )';

export interface LiveSessionWithHost extends LiveSession {
  slow_mode_seconds: number | null;
  host: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    verified: boolean;
  } | null;
}

function normalizeHost<T extends { host: unknown }>(row: T): T {
  return {
    ...row,
    host: Array.isArray(row.host) ? row.host[0] ?? null : row.host,
  };
}

// -----------------------------------------------------------------------------
// getActiveLiveSessions — Listing auf `/live`. Sortiert nach Viewer-Count desc,
// Tie-Break auf started_at asc (älteste Live-Streams zuerst bei gleichem Publikum).
// -----------------------------------------------------------------------------

export const getActiveLiveSessions = cache(
  async (limit = 30): Promise<LiveSessionWithHost[]> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from('live_sessions')
      .select(`${SESSION_COLUMNS}, ${HOST_JOIN}`)
      .eq('status', 'active')
      .order('viewer_count', { ascending: false })
      .order('started_at', { ascending: true })
      .limit(limit);

    if (!data) return [];
    return (data as unknown as LiveSessionWithHost[]).map((r) => normalizeHost(r));
  },
);

// -----------------------------------------------------------------------------
// getLiveSession — Detail-Fetch. Kein `.eq('status', 'active')` hier — eine
// Session die gerade endet soll nicht zu 404 werden, bevor der Viewer-Client
// das `status='ended'` realtime registriert und auf Replay umschaltet.
// -----------------------------------------------------------------------------

export const getLiveSession = cache(
  async (sessionId: string): Promise<LiveSessionWithHost | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from('live_sessions')
      .select(`${SESSION_COLUMNS}, ${HOST_JOIN}`)
      .eq('id', sessionId)
      .maybeSingle();

    if (!data) return null;
    return normalizeHost(data as unknown as LiveSessionWithHost);
  },
);

// -----------------------------------------------------------------------------
// getLiveComments — Initial-Load fürs Chat-Panel (letzten 50 persistierten
// Comments). Live-Updates danach via Supabase Broadcast-Channel
// `live-comments-{id}` (gleicher Name wie Native).
// -----------------------------------------------------------------------------

export interface LiveCommentWithAuthor {
  id: string;
  session_id: string;
  user_id: string;
  body: string;
  created_at: string;
  pinned: boolean;
  author: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    verified: boolean;
  } | null;
}

export const getLiveComments = cache(
  async (sessionId: string, limit = 50): Promise<LiveCommentWithAuthor[]> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from('live_comments')
      .select(
        // `verified:is_verified` — gleicher Alias wie in HOST_JOIN oben.
        // `body:text` — DB-Spalte heißt `text` (siehe `supabase/live_studio.sql:45`),
        // wir aliasen sie hier (und im Realtime-Mapping in live-chat.tsx) auf
        // `body`, damit der LiveCommentWithAuthor-Typ + UI-Components den
        // lesbareren Namen behalten. Ohne Alias schlägt der SELECT still
        // fehl und die Chat-Initial-Liste kommt leer.
        `id, session_id, user_id, body:text, created_at, pinned,
         author:profiles!live_comments_user_id_fkey ( id, username, display_name, avatar_url, verified:is_verified )`,
      )
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!data) return [];
    // Oldest-first für Chronologie im UI
    return (data as unknown as (LiveCommentWithAuthor & { author: unknown })[])
      .map((r) => ({
        ...r,
        pinned: r.pinned ?? false,
        author: Array.isArray(r.author)
          ? ((r.author[0] as LiveCommentWithAuthor['author']) ?? null)
          : (r.author as LiveCommentWithAuthor['author']),
      }))
      .reverse();
  },
);

// -----------------------------------------------------------------------------
// getActiveLivePoll — Aktuelle offene Umfrage + Vote-Counts + mein-Vote.
// Nutzt den Native-RPC `get_active_poll(p_session_id)` → gleiches Shape.
// -----------------------------------------------------------------------------

export interface ActiveLivePollSSR {
  id: string;
  question: string;
  options: string[];
  created_at: string;
  closed_at: string | null;
  vote_counts: number[];
  total_votes: number;
  my_vote_index: number | null;
}

export const getActiveLivePoll = cache(
  async (sessionId: string): Promise<ActiveLivePollSSR | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_active_poll', {
      p_session_id: sessionId,
    });
    if (error || !data) return null;

    // RPC kann entweder Single-Object oder Array zurückgeben
    const row = Array.isArray(data) ? data[0] : (data as Record<string, unknown>);
    if (!row || !row.id) return null;

    return {
      id: row.id as string,
      question: (row.question as string) ?? '',
      options: (row.options as string[]) ?? [],
      created_at: (row.created_at as string) ?? new Date().toISOString(),
      closed_at: (row.closed_at as string | null) ?? null,
      vote_counts: (row.vote_counts as number[]) ?? [],
      total_votes: (row.total_votes as number) ?? 0,
      my_vote_index:
        (row.my_vote_index as number | null) ??
        (row.my_vote as number | null) ??
        null,
    };
  },
);

// -----------------------------------------------------------------------------
// getActiveCoHosts — aktive CoHosts (revoked_at IS NULL) mit Author-Join für
// Namen/Avatare. Sortiert auf slot_index.
// -----------------------------------------------------------------------------

export interface ActiveCoHostSSR {
  user_id: string;
  session_id: string;
  slot_index: number;
  approved_at: string;
  profile: {
    username: string;
    avatar_url: string | null;
  } | null;
}

export const getActiveCoHosts = cache(
  async (sessionId: string): Promise<ActiveCoHostSSR[]> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from('live_cohosts')
      .select(
        `user_id, session_id, slot_index, approved_at,
         profile:profiles!live_cohosts_user_id_fkey ( username, avatar_url )`,
      )
      .eq('session_id', sessionId)
      .is('revoked_at', null)
      .order('slot_index', { ascending: true });

    if (!data) return [];
    return (data as unknown as (ActiveCoHostSSR & { profile: unknown })[]).map((r) => ({
      ...r,
      profile: Array.isArray(r.profile)
        ? (r.profile[0] as ActiveCoHostSSR['profile']) ?? null
        : (r.profile as ActiveCoHostSSR['profile']),
    }));
  },
);

// -----------------------------------------------------------------------------
// Replay-Metadata. `live_recordings` hält den S3/Storage-URL + duration_secs +
// clip_markers kommen aus separater Tabelle.
// -----------------------------------------------------------------------------

export interface LiveRecordingSSR {
  id: string;
  session_id: string;
  host_id: string;
  playback_url: string | null;
  duration_secs: number | null;
  status: 'recording' | 'processing' | 'ready' | 'failed';
  finished_at: string | null;
}

export const getLiveRecording = cache(
  async (sessionId: string): Promise<LiveRecordingSSR | null> => {
    const supabase = await createClient();
    // Native-Schema nennt die Spalte `file_url`, wir aliasen auf `playback_url`
    // damit die Client-Komponenten semantisch klarer bleiben.
    const { data } = await supabase
      .from('live_recordings')
      .select('id, session_id, host_id, playback_url:file_url, duration_secs, status, finished_at')
      .eq('session_id', sessionId)
      .maybeSingle();
    if (!data) return null;
    return data as unknown as LiveRecordingSSR;
  },
);

export interface ClipMarker {
  id: string;
  session_id: string;
  user_id: string;
  position_secs: number;
  label: string | null;
  created_at: string;
}

export const getClipMarkers = cache(
  async (sessionId: string): Promise<ClipMarker[]> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from('live_clip_markers')
      .select('id, session_id, user_id, position_secs, label, created_at')
      .eq('session_id', sessionId)
      .order('position_secs', { ascending: true });
    if (!data) return [];
    return data as ClipMarker[];
  },
);

// -----------------------------------------------------------------------------
// Is-Following — ob der aktuelle Viewer dem Host folgt. Unauth → false,
// ohne Auth-Call (0ms Overhead auf Public-Pages).
// -----------------------------------------------------------------------------

export const getIsFollowingHost = cache(async (hostId: string): Promise<boolean> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  if (user.id === hostId) return false;

  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', user.id)
    .eq('followed_id', hostId)
    .maybeSingle();
  return !!data;
});

// -----------------------------------------------------------------------------
// My-Session-Moderator-Status — für Pin/Timeout-Action-Gates.
// Liefert `is_live_session_moderator`-RPC-Ergebnis (Helper seit v1.27.2 inkl.
// aktive CoHosts).
// -----------------------------------------------------------------------------

export const getIsSessionModerator = cache(async (sessionId: string): Promise<boolean> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase.rpc('is_live_session_moderator', {
    session_id: sessionId,
    user_id: user.id,
  });
  return !!data;
});
