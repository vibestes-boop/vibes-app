'use server';

import { revalidateTag } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { containsBlockedWord } from '@shared/moderation/words';

// -----------------------------------------------------------------------------
// Live-Server-Actions — Viewer/Host/Moderator Interaktionen für `/live/[id]`.
//
// Design-Prinzipien:
//  1. Cross-Platform-Parität: Web nutzt exakt DIESELBEN Supabase-Channel-Namen
//     wie Native (`live-comments-{id}`, `live:{id}`, `co-host-signals-{id}`),
//     damit iOS- und Web-Viewer Chat/Geschenke/Reactions gemeinsam sehen.
//  2. Native-RPCs als Single-Source-of-Truth für atomare Flows (send_gift,
//     vote_on_poll, join_live_session, etc.). Keine Reimplementierung.
//  3. Moderation: Shadow-Ban-Pattern wie Native — Blocked-Comments werden
//     erfolgreich "gesendet" zurückgemeldet, aber landen nie im Broadcast
//     noch in der DB. Der Troll sieht seinen eigenen Kommentar nicht in
//     den Feeds anderer.
//  4. Rate-Limits: In-Memory pro Server-Instanz (reicht für Web, bei
//     horizontaler Skalierung → Redis/Upstash-Migration).
// -----------------------------------------------------------------------------

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function getViewerId(): Promise<{ id: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id } : null;
}

// -----------------------------------------------------------------------------
// In-Memory-Rate-Limits — pro Server-Instanz. Bei Multi-Node-Deploy sollte das
// auf Redis wandern. Für jetzt: reicht.
// -----------------------------------------------------------------------------

const COMMENT_COOLDOWN_MS = 1000; // 1s Grundschutz (Slow-Mode kommt on-top via RPC-Check)
const REACTION_COOLDOWN_MS = 250; // max 4 Reactions/Sek
const GIFT_COOLDOWN_MS = 150; // kein Spam, aber Combos möglich
const REPORT_COOLDOWN_MS = 30_000; // max 1 Report alle 30s pro User

const lastComment = new Map<string, number>();
const lastReaction = new Map<string, number>();
const lastGift = new Map<string, number>();
const lastReport = new Map<string, number>();

function checkCooldown(map: Map<string, number>, key: string, cooldownMs: number): boolean {
  const now = Date.now();
  const last = map.get(key) ?? 0;
  if (now - last < cooldownMs) return false;
  map.set(key, now);
  // FIFO-Cap bei 5000 Einträgen (Garbage-Collection)
  if (map.size > 5000) {
    const firstKey = map.keys().next().value;
    if (firstKey !== undefined) map.delete(firstKey);
  }
  return true;
}

// -----------------------------------------------------------------------------
// joinLiveSession / leaveLiveSession — delegiert an Native-RPCs mit Dedup
// (Phase-2-Hotfix v1.27.0: `live_session_viewers` verhindert Viewer-Inflation).
// -----------------------------------------------------------------------------

export async function joinLiveSession(sessionId: string): Promise<ActionResult<null>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('join_live_session', { p_session_id: sessionId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function leaveLiveSession(sessionId: string): Promise<ActionResult<null>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('leave_live_session', { p_session_id: sessionId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// -----------------------------------------------------------------------------
// sendLiveComment — Shadow-Ban + Slow-Mode + Broadcast + optional DB-Persist.
//
// Reihenfolge:
//  1. Auth + Cooldown
//  2. Session-State laden (moderation_enabled, moderation_words, slow_mode_seconds)
//  3. containsBlockedWord() → wenn true: silent-drop, `{ ok: true }` zurück
//     (Troll sieht seinen eigenen Comment lokal, aber niemand anders).
//  4. Slow-Mode-Check gegen letzten Comment des Users via RPC
//  5. DB-Insert nach `live_comments` (Trigger broadcastet automatisch via
//     Native-Realtime-Pipeline — wir müssen NICHT manuell broadcasten,
//     das passiert über den existierenden `live-comments-{id}`-Channel-Flow).
// -----------------------------------------------------------------------------

const COMMENT_MAX_LEN = 200;

export async function sendLiveComment(
  sessionId: string,
  rawText: string,
): Promise<ActionResult<{ id: string | null; shadowBanned: boolean }>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const text = rawText.trim();
  if (text.length === 0) return { ok: false, error: 'Kommentar ist leer.' };
  if (text.length > COMMENT_MAX_LEN)
    return { ok: false, error: `Maximal ${COMMENT_MAX_LEN} Zeichen.` };

  const cooldownKey = `${viewer.id}:${sessionId}`;
  if (!checkCooldown(lastComment, cooldownKey, COMMENT_COOLDOWN_MS)) {
    return { ok: false, error: 'Bitte kurz warten.' };
  }

  const supabase = await createClient();

  // Session laden: Moderation + Slow-Mode
  const { data: session, error: sessionErr } = await supabase
    .from('live_sessions')
    .select('id, status, moderation_enabled, moderation_words, slow_mode_seconds, host_id')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessionErr || !session) return { ok: false, error: 'Session nicht gefunden.' };
  if (session.status !== 'active') return { ok: false, error: 'Session ist bereits beendet.' };

  // Shadow-Ban-Check
  if (session.moderation_enabled) {
    const hostWords = Array.isArray(session.moderation_words) ? session.moderation_words : [];
    if (containsBlockedWord(text, hostWords)) {
      // Silent-drop: User bekommt `ok: true` zurück, Kommentar wird NICHT
      // persistiert/gebroadcastet. Das Client-UI zeigt ihn lokal in der
      // eigenen View (optimistic update), aber kein anderer sieht ihn.
      return { ok: true, data: { id: null, shadowBanned: true } };
    }
  }

  // Slow-Mode-Check gegen letzten Comment
  const slow = typeof session.slow_mode_seconds === 'number' ? session.slow_mode_seconds : 0;
  if (slow > 0) {
    const since = new Date(Date.now() - slow * 1000).toISOString();
    const { data: recent } = await supabase
      .from('live_comments')
      .select('id, created_at')
      .eq('session_id', sessionId)
      .eq('user_id', viewer.id)
      .gte('created_at', since)
      .limit(1)
      .maybeSingle();
    if (recent) return { ok: false, error: `Slow-Mode: max 1 Nachricht alle ${slow}s.` };
  }

  // Timeout-Check
  const { data: timeout } = await supabase
    .from('live_chat_timeouts')
    .select('until')
    .eq('session_id', sessionId)
    .eq('user_id', viewer.id)
    .gte('until', new Date().toISOString())
    .maybeSingle();
  if (timeout) {
    return { ok: false, error: 'Du bist im Chat momentan gesperrt.' };
  }

  // Insert — Postgres-Trigger schickt den Broadcast.
  const { data: inserted, error: insertErr } = await supabase
    .from('live_comments')
    .insert({ session_id: sessionId, user_id: viewer.id, body: text })
    .select('id')
    .single();

  if (insertErr || !inserted)
    return { ok: false, error: insertErr?.message ?? 'Kommentar konnte nicht gesendet werden.' };

  return { ok: true, data: { id: inserted.id as string, shadowBanned: false } };
}

// -----------------------------------------------------------------------------
// sendLiveReaction — Broadcast-only auf `live:{id}`-Channel (keine DB).
//
// Native nutzt für Reactions denselben `live:{id}`-Channel wie für Gifts,
// Event-Name `reaction`. Web repliziert das 1:1. Payload ist minimal weil
// Reactions ephemer sind (Animation läuft durch, dann weg).
// -----------------------------------------------------------------------------

const ALLOWED_REACTIONS = new Set(['heart', 'fire', 'clap', 'laugh', 'wow', 'sad']);

export async function sendLiveReaction(
  sessionId: string,
  reaction: string,
): Promise<ActionResult<null>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  if (!ALLOWED_REACTIONS.has(reaction)) return { ok: false, error: 'Unbekannte Reaction.' };

  const cooldownKey = `${viewer.id}:${sessionId}`;
  if (!checkCooldown(lastReaction, cooldownKey, REACTION_COOLDOWN_MS)) {
    // Reaction-Spam silent droppen — kein sichtbarer Fehler, der User tapt
    // halt zu schnell. Next-Tap geht dann wieder durch.
    return { ok: true, data: null };
  }

  const supabase = await createClient();
  const channel = supabase.channel(`live:${sessionId}`);
  await channel.subscribe();
  const res = await channel.send({
    type: 'broadcast',
    event: 'reaction',
    payload: { reaction, user_id: viewer.id, ts: Date.now() },
  });
  // Channel sofort wieder schließen — für Broadcast reicht 1-shot.
  await supabase.removeChannel(channel);

  if (res !== 'ok') return { ok: false, error: 'Reaction konnte nicht gesendet werden.' };
  return { ok: true, data: null };
}

// -----------------------------------------------------------------------------
// sendLiveGift — delegiert an Native-RPC `send_gift`. Die RPC übernimmt:
//   • Coin-Abbuchung vom Sender (atomar)
//   • Coin-Credit an Receiver (70/30 Split)
//   • Insert nach `live_gifts`
//   • DB-Notify → Trigger broadcastet auf `live:{id}` Event `gift`
//   • Update `live_gift_goals` Progress (wenn aktiv)
// -----------------------------------------------------------------------------

export interface GiftSendResult {
  giftLogId: string;
  newBalance: number;
  comboKey: string | null;
}

const GIFT_ERROR_MESSAGES: Record<string, string> = {
  insufficient_coins: 'Nicht genug Coins. Lade dein Guthaben auf.',
  no_wallet: 'Dein Coin-Konto ist noch nicht initialisiert.',
  cannot_gift_self: 'Du kannst dir nicht selbst ein Geschenk machen.',
  gift_not_found: 'Geschenk ist nicht mehr verfügbar.',
  session_not_active: 'Session ist bereits beendet.',
  recipient_not_in_session: 'Empfänger ist nicht Teil dieser Session.',
};

export async function sendLiveGift(
  sessionId: string,
  recipientId: string,
  giftId: string,
  comboKey: string | null = null,
): Promise<ActionResult<GiftSendResult>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const cooldownKey = `${viewer.id}:${sessionId}`;
  if (!checkCooldown(lastGift, cooldownKey, GIFT_COOLDOWN_MS)) {
    return { ok: false, error: 'Einen Moment.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('send_gift', {
    p_session_id: sessionId,
    p_recipient_id: recipientId,
    p_gift_id: giftId,
    p_combo_key: comboKey,
  });

  if (error) {
    const msg = error.message ?? '';
    for (const [key, humanMsg] of Object.entries(GIFT_ERROR_MESSAGES)) {
      if (msg.includes(key)) return { ok: false, error: humanMsg };
    }
    return { ok: false, error: 'Geschenk konnte nicht gesendet werden.' };
  }

  const row = (data as { gift_log_id: string; new_balance: number; combo_key: string | null } | null) ?? null;
  if (!row) return { ok: false, error: 'Kein Rückgabewert von send_gift.' };

  return {
    ok: true,
    data: {
      giftLogId: row.gift_log_id,
      newBalance: row.new_balance,
      comboKey: row.combo_key ?? null,
    },
  };
}

// -----------------------------------------------------------------------------
// voteOnLivePoll — delegiert an `vote_on_poll`. RPC übernimmt Dedup via
// `live_poll_votes` PK + Broadcast der aktualisierten Aggregation.
// -----------------------------------------------------------------------------

export async function voteOnLivePoll(
  pollId: string,
  optionIndex: number,
): Promise<ActionResult<null>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 3)
    return { ok: false, error: 'Ungültige Option.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('vote_on_poll', {
    p_poll_id: pollId,
    p_option_index: optionIndex,
  });

  if (error) {
    if (error.message?.includes('already_voted'))
      return { ok: false, error: 'Du hast schon abgestimmt.' };
    if (error.message?.includes('poll_closed'))
      return { ok: false, error: 'Umfrage ist bereits geschlossen.' };
    return { ok: false, error: error.message };
  }

  return { ok: true, data: null };
}

// -----------------------------------------------------------------------------
// CoHost-Signals — Request / Cancel / Leave via `co-host-signals-{id}` Channel.
//
// Native pattern: Viewer sendet Broadcast, Host-UI hört mit und zeigt Request
// in Queue. Host akzeptiert → separate RPC `accept_cohost_request` (nicht hier,
// das ist Host-Seite). Für den Viewer reicht Broadcast-send.
// -----------------------------------------------------------------------------

export async function requestCoHost(sessionId: string): Promise<ActionResult<null>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();

  // Profile für Displayname holen (Host-Queue zeigt Username + Avatar)
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url')
    .eq('id', viewer.id)
    .maybeSingle();

  const channel = supabase.channel(`co-host-signals-${sessionId}`);
  await channel.subscribe();
  const res = await channel.send({
    type: 'broadcast',
    event: 'cohost-request',
    payload: {
      user_id: viewer.id,
      username: profile?.username ?? null,
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      ts: Date.now(),
    },
  });
  await supabase.removeChannel(channel);

  if (res !== 'ok') return { ok: false, error: 'Request konnte nicht gesendet werden.' };
  return { ok: true, data: null };
}

export async function cancelCoHostRequest(sessionId: string): Promise<ActionResult<null>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const channel = supabase.channel(`co-host-signals-${sessionId}`);
  await channel.subscribe();
  const res = await channel.send({
    type: 'broadcast',
    event: 'cohost-cancel',
    payload: { user_id: viewer.id, ts: Date.now() },
  });
  await supabase.removeChannel(channel);

  if (res !== 'ok') return { ok: false, error: 'Cancel konnte nicht gesendet werden.' };
  return { ok: true, data: null };
}

// -----------------------------------------------------------------------------
// leaveCoHost — aktiver CoHost verlässt die Bühne. Ruft `leave_cohost` RPC
// die `live_cohosts.revoked_at` setzt → Track-Teardown via LiveKit passiert
// clientseitig, Web-Viewer brauchen das nicht (publisht eh nicht vom Web).
// Wir lassen die Action trotzdem hier für Parität, falls später ein
// Web-CoHost-Flow kommt.
// -----------------------------------------------------------------------------

export async function leaveCoHost(sessionId: string): Promise<ActionResult<null>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('leave_cohost', { p_session_id: sessionId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// -----------------------------------------------------------------------------
// fetchLiveKitToken — ruft Supabase Edge Function `livekit-token`. Die Function
// generiert ein JWT mit den richtigen Grants basierend auf der User-Identity
// und ob sie Host/CoHost/Viewer ist. Wir leiten nur weiter, keine Logik hier.
// -----------------------------------------------------------------------------

export interface LiveKitTokenResult {
  token: string;
  url: string;
  identity: string;
}

export async function fetchLiveKitToken(
  roomName: string,
  isCoHost = false,
): Promise<ActionResult<LiveKitTokenResult>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke('livekit-token', {
    body: { room_name: roomName, is_cohost: isCoHost },
  });

  if (error) return { ok: false, error: error.message ?? 'Token-Abruf fehlgeschlagen.' };

  const row = (data as { token?: string; url?: string; identity?: string } | null) ?? null;
  if (!row?.token || !row?.url)
    return { ok: false, error: 'Ungültige Antwort vom Token-Service.' };

  return {
    ok: true,
    data: {
      token: row.token,
      url: row.url,
      identity: row.identity ?? viewer.id,
    },
  };
}

// -----------------------------------------------------------------------------
// reportLiveSession — `live_reports`-Tabelle. RLS sorgt für 1 Report/User/Session.
// -----------------------------------------------------------------------------

const REPORT_REASONS = new Set([
  'nudity',
  'violence',
  'hate_speech',
  'harassment',
  'misinformation',
  'illegal',
  'self_harm',
  'other',
]);

export async function reportLiveSession(
  sessionId: string,
  reason: string,
  details?: string,
): Promise<ActionResult<null>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  if (!REPORT_REASONS.has(reason)) return { ok: false, error: 'Ungültiger Meldegrund.' };

  const cooldownKey = viewer.id;
  if (!checkCooldown(lastReport, cooldownKey, REPORT_COOLDOWN_MS))
    return { ok: false, error: 'Bitte kurz warten vor dem nächsten Report.' };

  const supabase = await createClient();
  const { error } = await supabase.from('live_reports').insert({
    session_id: sessionId,
    reporter_id: viewer.id,
    reason,
    details: details?.slice(0, 500) ?? null,
  });

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Du hast diese Session bereits gemeldet.' };
    return { ok: false, error: error.message };
  }

  return { ok: true, data: null };
}

// -----------------------------------------------------------------------------
// createClipMarker — Viewer markiert Moment im Stream (Phase v1.18.0). Host
// sieht das später im Replay als Seek-Chip. 15s default Länge hinter `position`.
// -----------------------------------------------------------------------------

export async function createLiveClipMarker(
  sessionId: string,
  positionSecs: number,
  label?: string,
): Promise<ActionResult<{ id: string }>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  if (!Number.isFinite(positionSecs) || positionSecs < 0)
    return { ok: false, error: 'Ungültige Position.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('live_clip_markers')
    .insert({
      session_id: sessionId,
      user_id: viewer.id,
      position_secs: Math.floor(positionSecs),
      label: label?.slice(0, 60) ?? null,
    })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? 'Clip-Marker fehlgeschlagen.' };

  revalidateTag(`live-session:${sessionId}`);
  return { ok: true, data: { id: data.id as string } };
}

// -----------------------------------------------------------------------------
// toggleFollowHost — Reuse des Follow-Patterns aus engagement.ts, aber mit
// dediziertem Namen für CTA-Klarheit im Live-UI.
// -----------------------------------------------------------------------------

export async function toggleFollowHost(
  hostId: string,
  currentlyFollowing: boolean,
): Promise<ActionResult<{ following: boolean }>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };
  if (viewer.id === hostId) return { ok: false, error: 'Dir selbst folgen geht nicht.' };

  const supabase = await createClient();

  if (currentlyFollowing) {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', viewer.id)
      .eq('followed_id', hostId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { following: false } };
  }

  const { error } = await supabase.from('follows').upsert(
    { follower_id: viewer.id, followed_id: hostId },
    { onConflict: 'follower_id,followed_id', ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { following: true } };
}

// -----------------------------------------------------------------------------
// Moderator-Actions (CoHost v1.27.2 + Session-Mods): Timeout, Pin, Slow-Mode.
// Die RPCs prüfen selbst via `is_live_session_moderator`, ob der Caller
// überhaupt moderieren darf — wir delegieren und mappen Fehler.
// -----------------------------------------------------------------------------

export async function timeoutChatUser(
  sessionId: string,
  targetUserId: string,
  durationSecs: number,
): Promise<ActionResult<null>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  if (![60, 300, 600, 3600].includes(durationSecs))
    return { ok: false, error: 'Ungültige Timeout-Dauer.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('timeout_chat_user', {
    p_session_id: sessionId,
    p_target_user_id: targetUserId,
    p_duration_secs: durationSecs,
  });

  if (error) {
    if (error.message?.includes('not_a_moderator'))
      return { ok: false, error: 'Du darfst hier nicht moderieren.' };
    if (error.message?.includes('cannot_timeout_host'))
      return { ok: false, error: 'Host kann nicht getimeoutet werden.' };
    if (error.message?.includes('cannot_timeout_moderator'))
      return { ok: false, error: 'Moderator kann nicht getimeoutet werden.' };
    return { ok: false, error: error.message };
  }

  return { ok: true, data: null };
}

export async function untimeoutChatUser(
  sessionId: string,
  targetUserId: string,
): Promise<ActionResult<null>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('untimeout_chat_user', {
    p_session_id: sessionId,
    p_target_user_id: targetUserId,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function setLiveSlowMode(
  sessionId: string,
  seconds: number,
): Promise<ActionResult<null>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  if (![0, 5, 10, 30, 60].includes(seconds))
    return { ok: false, error: 'Ungültige Slow-Mode-Dauer.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_live_slow_mode', {
    p_session_id: sessionId,
    p_seconds: seconds,
  });

  if (error) {
    if (error.message?.includes('not_a_moderator'))
      return { ok: false, error: 'Du darfst hier nicht moderieren.' };
    return { ok: false, error: error.message };
  }

  return { ok: true, data: null };
}

export async function pinLiveComment(
  sessionId: string,
  commentId: string,
): Promise<ActionResult<null>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('pin_live_comment', {
    p_session_id: sessionId,
    p_comment_id: commentId,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function unpinLiveComment(
  sessionId: string,
): Promise<ActionResult<null>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('unpin_live_comment', {
    p_session_id: sessionId,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}
