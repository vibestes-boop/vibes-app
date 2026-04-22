'use server';

import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from './live';

// -----------------------------------------------------------------------------
// Live-Host-Server-Actions — alles was nur der Host (oder ein autorisierter
// Moderator) tun darf. Strikt getrennt von Viewer-Actions (live.ts), damit
// RLS-Checks klarer bleiben und Bundle-Splitting funktioniert.
//
// Die meisten Actions delegieren an Native-RPCs, die bereits atomar + RLS-
// geschützt sind (Phase-2-Hotfixes v1.27.0 & v1.27.2 & v1.27.3):
//  • startLiveSession      — direct INSERT auf live_sessions (Native-Parity,
//                             kein RPC — `create_live_session` existiert nicht)
//  • end_live_session      — setzt status='ended' + ended_at + purged viewers
//  • heartbeat_live_session — hält updated_at frisch gegen Zombie-Cleanup-Cron
//  • accept_cohost_request — CoHost-Row + Slot-Index anlegen
//  • revoke_cohost         — CoHost-Row deaktivieren (kick)
//  • create_live_poll      — Poll einfügen (+ One-Active-Poll-Invariant)
//  • close_live_poll       — Poll schließen (closed_at setzen)
// -----------------------------------------------------------------------------

async function getHost(): Promise<{ id: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id } : null;
}

// -----------------------------------------------------------------------------
// startLiveSession — erzeugt eine neue Session. Der Host ist automatisch
// host_id via RPC (identity aus JWT). room_name wird serverseitig generiert
// (nanoid-like, collision-safe). Title/Category/Thumbnail sind optional und
// können via `updateLiveSession` nachgereicht werden.
// -----------------------------------------------------------------------------

export interface StartLiveSessionInput {
  title?: string;
  category?: string;
  thumbnailUrl?: string;
  moderationEnabled?: boolean;
  moderationWords?: string[];
}

export interface StartLiveSessionResult {
  sessionId: string;
  roomName: string;
}

export async function startLiveSession(
  input: StartLiveSessionInput = {},
): Promise<ActionResult<StartLiveSessionResult>> {
  const host = await getHost();
  if (!host) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();

  // 1) Zombie-Cleanup: Falls dieser Host noch eine alte 'active'-Session
  //    liegen hat (Crash, App-Kill während Stream), vorher sauber beenden.
  //    Native macht das in `lib/useLiveSession.ts:startSession` identisch.
  await supabase
    .from('live_sessions')
    .update({
      status: 'ended',
      ended_at: new Date().toISOString(),
      viewer_count: 0,
    })
    .eq('host_id', host.id)
    .eq('status', 'active');

  // 2) Room-Name generieren (Collision-Safe genug: host_id + ms-Timestamp).
  //    LiveKit-Edge-Function akzeptiert beliebige Room-Namen, deduped
  //    serverseitig über host_id+room_name.
  const roomName = `vibes-live-${host.id}-${Date.now()}`;

  // 3) Insert. RLS-Policy `live_sessions_insert` erlaubt nur
  //    `auth.uid() = host_id` — wir setzen host_id explizit für Klarheit.
  const insertPayload: Record<string, unknown> = {
    host_id: host.id,
    room_name: roomName,
    title: input.title?.trim().slice(0, 120) || null,
    moderation_enabled: input.moderationEnabled ?? true,
    moderation_words: input.moderationWords ?? [],
  };
  if (input.category !== undefined) insertPayload.category = input.category;
  if (input.thumbnailUrl !== undefined)
    insertPayload.thumbnail_url = input.thumbnailUrl;

  const { data, error } = await supabase
    .from('live_sessions')
    .insert(insertPayload)
    .select('id, room_name')
    .single();

  if (error) return { ok: false, error: error.message };
  if (!data?.id || !data?.room_name)
    return { ok: false, error: 'Session konnte nicht erstellt werden.' };

  return {
    ok: true,
    data: { sessionId: data.id as string, roomName: data.room_name as string },
  };
}

// -----------------------------------------------------------------------------
// updateLiveSession — Titel/Thumbnail/Kategorie/Moderation-Flags im Stream
// anpassen. Nur der Host darf (RLS).
// -----------------------------------------------------------------------------

export async function updateLiveSession(
  sessionId: string,
  patch: Partial<{
    title: string;
    thumbnailUrl: string;
    category: string;
    moderationEnabled: boolean;
    moderationWords: string[];
  }>,
): Promise<ActionResult<null>> {
  const host = await getHost();
  if (!host) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();

  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title.slice(0, 120);
  if (patch.thumbnailUrl !== undefined) update.thumbnail_url = patch.thumbnailUrl;
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.moderationEnabled !== undefined) update.moderation_enabled = patch.moderationEnabled;
  if (patch.moderationWords !== undefined) update.moderation_words = patch.moderationWords;

  if (Object.keys(update).length === 0) return { ok: true, data: null };

  const { error } = await supabase
    .from('live_sessions')
    .update(update)
    .eq('id', sessionId)
    .eq('host_id', host.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// -----------------------------------------------------------------------------
// endLiveSession — Session beenden. Trigger purged Viewer-Rows, Cleanup-Cron
// kann nicht mehr reingrätschen weil ended_at gesetzt ist.
// -----------------------------------------------------------------------------

export async function endLiveSession(sessionId: string): Promise<ActionResult<null>> {
  const host = await getHost();
  if (!host) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('end_live_session', {
    p_session_id: sessionId,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// -----------------------------------------------------------------------------
// heartbeatLiveSession — Zombie-Session-Cleanup-Prevention. Cron-Cleanup
// killt Sessions deren updated_at > 2 Min alt ist. Der Host-Client ruft
// diesen Heartbeat alle 30s mit aktueller Viewer-Count + Peak.
// -----------------------------------------------------------------------------

export async function heartbeatLiveSession(
  sessionId: string,
  viewerCount: number,
  peakCount: number,
): Promise<ActionResult<null>> {
  const host = await getHost();
  if (!host) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('heartbeat_live_session', {
    p_session_id: sessionId,
    p_viewer_count: viewerCount,
    // RPC-Parameter heißt `p_peak_viewers` (siehe Migration
    // 20260419230000_live_sessions_updated_at.sql) — nicht `p_peak_count`.
    p_peak_viewers: peakCount,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// -----------------------------------------------------------------------------
// CoHost-Queue-Management — accept, reject, kick.
// -----------------------------------------------------------------------------

export async function acceptCoHostRequest(
  sessionId: string,
  requesterId: string,
  slotIndex: number,
): Promise<ActionResult<null>> {
  const host = await getHost();
  if (!host) return { ok: false, error: 'Bitte einloggen.' };

  if (![1, 2, 3].includes(slotIndex))
    return { ok: false, error: 'Slot-Index muss 1, 2 oder 3 sein.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('accept_cohost_request', {
    p_session_id: sessionId,
    p_requester_id: requesterId,
    p_slot_index: slotIndex,
  });

  if (error) {
    if (error.message?.includes('slot_taken'))
      return { ok: false, error: 'Dieser Slot ist bereits belegt.' };
    if (error.message?.includes('not_host'))
      return { ok: false, error: 'Nur der Host kann CoHosts akzeptieren.' };
    return { ok: false, error: error.message };
  }

  return { ok: true, data: null };
}

export async function rejectCoHostRequest(
  sessionId: string,
  requesterId: string,
): Promise<ActionResult<null>> {
  const host = await getHost();
  if (!host) return { ok: false, error: 'Bitte einloggen.' };

  // Reject ist pure Broadcast-Antwort (kein DB-State), damit der Viewer-Client
  // seine pending-UI zurücksetzen kann.
  const supabase = await createClient();
  const channel = supabase.channel(`co-host-signals-${sessionId}`);
  await channel.subscribe();
  const res = await channel.send({
    type: 'broadcast',
    event: 'cohost-reject',
    payload: { user_id: requesterId, ts: Date.now() },
  });
  await supabase.removeChannel(channel);

  if (res !== 'ok') return { ok: false, error: 'Broadcast fehlgeschlagen.' };
  return { ok: true, data: null };
}

export async function kickCoHost(
  sessionId: string,
  targetUserId: string,
): Promise<ActionResult<null>> {
  const host = await getHost();
  if (!host) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('revoke_cohost', {
    p_session_id: sessionId,
    p_target_user_id: targetUserId,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// -----------------------------------------------------------------------------
// muteCoHost — v1.27.3 Server-enforced Mute via `livekit-moderate` Edge Function.
// Die Function mutet den CoHost-Track direkt auf LiveKit-Server-Seite, egal was
// der Client macht (keine Trust-Lücke).
// -----------------------------------------------------------------------------

export async function muteCoHost(
  sessionId: string,
  targetUserId: string,
  audio: boolean,
  video: boolean,
): Promise<ActionResult<{ audioMuted: boolean; videoMuted: boolean }>> {
  const host = await getHost();
  if (!host) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke('livekit-moderate', {
    body: {
      session_id: sessionId,
      target_user_id: targetUserId,
      mute_audio: audio,
      mute_video: video,
    },
  });

  if (error) return { ok: false, error: error.message ?? 'Mute fehlgeschlagen.' };

  const row = (data as { audio_muted?: boolean; video_muted?: boolean } | null) ?? null;
  return {
    ok: true,
    data: {
      audioMuted: row?.audio_muted ?? audio,
      videoMuted: row?.video_muted ?? video,
    },
  };
}

// -----------------------------------------------------------------------------
// Poll-Management — create + close.
// -----------------------------------------------------------------------------

export async function createLivePoll(
  sessionId: string,
  question: string,
  options: string[],
  durationSecs: number,
): Promise<ActionResult<{ pollId: string }>> {
  const host = await getHost();
  if (!host) return { ok: false, error: 'Bitte einloggen.' };

  const trimmedQuestion = question.trim();
  if (trimmedQuestion.length < 3 || trimmedQuestion.length > 140)
    return { ok: false, error: 'Frage muss 3-140 Zeichen haben.' };

  const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
  if (cleanOptions.length < 2 || cleanOptions.length > 4)
    return { ok: false, error: '2-4 Antwortoptionen.' };

  if (![60, 180, 300].includes(durationSecs))
    return { ok: false, error: 'Dauer muss 1, 3 oder 5 Minuten sein.' };

  const supabase = await createClient();

  // v1.27.4 Pattern: Pre-Close bestehender Poll session-wide statt nur auf host_id
  await supabase
    .from('live_polls')
    .update({ closed_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .is('closed_at', null);

  // NB: `live_polls` (Migration 20260418060000_live_polls.sql) hat KEINE
  // `duration_secs`-Spalte — nur id/session_id/host_id/question/options/
  // created_at/closed_at. Die Laufzeit (1/3/5 Min) ist nur ein Client-seitiges
  // UX-Signal für Auto-Close; wir validieren sie oben (60/180/300), schicken
  // sie aber NICHT in den Insert, sonst gibt PostgREST „Could not find the
  // 'duration_secs' column" zurück. Server-seitiges Auto-Close ist bewusst
  // nicht implementiert — der Host schließt manuell via `closeLivePoll`.
  const { data, error } = await supabase
    .from('live_polls')
    .insert({
      session_id: sessionId,
      host_id: host.id, // historischer Name — dient ab v1.27.4 als Author-ID
      question: trimmedQuestion,
      options: cleanOptions,
    })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? 'Poll fehlgeschlagen.' };
  return { ok: true, data: { pollId: data.id as string } };
}

export async function closeLivePoll(pollId: string): Promise<ActionResult<null>> {
  const host = await getHost();
  if (!host) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('live_polls')
    .update({ closed_at: new Date().toISOString() })
    .eq('id', pollId)
    .is('closed_at', null);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// -----------------------------------------------------------------------------
// createLiveGiftGoal — optional: Host setzt Coin-Ziel für Stream.
// -----------------------------------------------------------------------------

export async function createLiveGiftGoal(
  sessionId: string,
  targetCoins: number,
  label: string,
): Promise<ActionResult<{ goalId: string }>> {
  const host = await getHost();
  if (!host) return { ok: false, error: 'Bitte einloggen.' };

  if (targetCoins < 100 || targetCoins > 1_000_000)
    return { ok: false, error: 'Ziel muss zwischen 100 und 1.000.000 Coins sein.' };

  const supabase = await createClient();

  // Bestehende aktive Goals schließen
  await supabase
    .from('live_gift_goals')
    .update({ closed_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .is('closed_at', null);

  const { data, error } = await supabase
    .from('live_gift_goals')
    .insert({
      session_id: sessionId,
      host_id: host.id,
      target_coins: targetCoins,
      label: label.slice(0, 80),
    })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? 'Ziel fehlgeschlagen.' };
  return { ok: true, data: { goalId: data.id as string } };
}
