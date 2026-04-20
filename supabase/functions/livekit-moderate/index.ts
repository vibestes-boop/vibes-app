/**
 * Supabase Edge Function: livekit-moderate
 *
 * v1.27.3 — Serverseitige Mute-Durchsetzung für aktive CoHosts
 *
 * Problem (vor v1.27.3):
 *   `muteCoHost` in `lib/useCoHost.ts` war broadcast-only. Der Host schickte
 *   `co-host-muted { audio: true }` per Supabase-Realtime und erwartete, dass
 *   der CoHost-Client das freundlich respektiert und sein Mikro ausschaltet.
 *   Ein manipulierter / modifizierter Client konnte das Event ignorieren und
 *   einfach weiter audio-publishen — der Host sah „Mikro aus" in seiner UI,
 *   der Stream hörte aber weiter den CoHost. Klassische Client-Trust-Lücke.
 *
 * Lösung:
 *   Diese Function ruft auf der LiveKit-Server-API direkt
 *   `RoomService/MutePublishedTrack` — der Track wird serverseitig gemuted,
 *   unabhängig davon was der Client-Code tut. Client-Broadcast bleibt
 *   parallel als UI-Sync für den CoHost-Client selbst (Mute-Knopf-Status
 *   zeigen, etc.), aber die Autorität liegt beim Server.
 *
 * Endpoint:
 *   POST /functions/v1/livekit-moderate
 *   Auth: Bearer JWT (Supabase Auth)
 *   Body: {
 *     sessionId:    string,    // live_sessions.id (UUID)
 *     targetUserId: string,    // CoHost's auth user-id
 *     mute: {
 *       audio?: boolean,       // true=mute, false=unmute, undefined=skip
 *       video?: boolean,
 *     }
 *   }
 *   Response: {
 *     muted: { audio?: boolean; video?: boolean },
 *     tracksFound: { audio: boolean, video: boolean },
 *   }
 *
 * Authorisierung:
 *   - Caller MUSS Host der Session sein (live_sessions.host_id).
 *     Keine Moderatoren/CoHosts hier erlaubt — Mute-Kompetenz ist host-only.
 *     (Mods können timeout/pin/slow-mode, aber das Steuern fremder Mikros
 *      bleibt beim Haupthost — wie auf TikTok.)
 *   - Target MUSS aktiver CoHost der Session sein (live_cohosts, revoked_at IS NULL).
 *     Schutz gegen „Host mutet zufällige Viewer" via direkter API-Call.
 *   - Session MUSS status='active' sein.
 *
 * Env-Variablen:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ─── Base64url ────────────────────────────────────────────────────────────────
function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : input;
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ─── LiveKit Server-Admin JWT (roomAdmin, room-scoped) ───────────────────────
async function livekitAdminToken(
  apiKey: string,
  apiSecret: string,
  roomName: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: apiKey,
    sub: apiKey,
    iat: now,
    exp: now + 60, // 1min reicht — Function lebt kurz
    video: {
      roomAdmin: true,
      room:      roomName,
    },
  }));
  const data = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${b64url(new Uint8Array(sig))}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type TrackInfo = { sid: string; type: string; source?: string };
type ParticipantInfo = { identity: string; tracks?: TrackInfo[] };

// ─── Handler ──────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Auth-Header prüfen ────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing authorization header' }, 401);
    }
    const userJwt = authHeader.slice(7).trim();

    // ── 2. Env laden ─────────────────────────────────────────────────────────
    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lkUrlRaw       = Deno.env.get('LIVEKIT_URL')!;
    const lkApiKey       = Deno.env.get('LIVEKIT_API_KEY')!;
    const lkApiSecret    = Deno.env.get('LIVEKIT_API_SECRET')!;
    const lkHttpBase     = lkUrlRaw.replace(/^wss?:\/\//, 'https://');

    // ── 3. Caller-Identität via Supabase Auth ────────────────────────────────
    const authResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${userJwt}`,
        apikey:        serviceRoleKey,
      },
    });
    if (!authResp.ok) {
      return jsonResponse({ error: 'Nicht autorisiert' }, 401);
    }
    const authData = await authResp.json() as { id?: string };
    const callerUserId = authData.id;
    if (!callerUserId) {
      return jsonResponse({ error: 'Kein User in Auth-Antwort' }, 401);
    }

    // ── 4. Body parsen ───────────────────────────────────────────────────────
    const body = await req.json() as {
      sessionId?:    string;
      targetUserId?: string;
      mute?: { audio?: boolean; video?: boolean };
    };
    const sessionId    = body.sessionId;
    const targetUserId = body.targetUserId;
    const mute         = body.mute ?? {};
    if (!sessionId || !targetUserId) {
      return jsonResponse({ error: 'sessionId und targetUserId sind pflicht' }, 400);
    }
    if (typeof mute.audio !== 'boolean' && typeof mute.video !== 'boolean') {
      return jsonResponse({ error: 'mute.audio oder mute.video muss gesetzt sein' }, 400);
    }
    if (callerUserId === targetUserId) {
      return jsonResponse({ error: 'Self-mute via Server-API nicht erlaubt' }, 400);
    }

    // ── 5. Session laden + Host-Guard ────────────────────────────────────────
    const sessionResp = await fetch(
      `${supabaseUrl}/rest/v1/live_sessions`
      + `?id=eq.${encodeURIComponent(sessionId)}`
      + `&status=eq.active`
      + `&select=id,host_id,room_name&limit=1`,
      {
        headers: {
          apikey:        serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    );
    if (!sessionResp.ok) {
      return jsonResponse({ error: 'Session-Lookup fehlgeschlagen' }, 500);
    }
    const sessions = await sessionResp.json() as Array<{
      id: string; host_id: string; room_name: string;
    }>;
    const session = sessions[0];
    if (!session) {
      return jsonResponse({ error: 'Session nicht aktiv oder nicht gefunden' }, 404);
    }
    if (session.host_id !== callerUserId) {
      return jsonResponse({ error: 'Nur der Host darf CoHosts muten' }, 403);
    }

    // ── 6. Target muss aktiver CoHost sein ───────────────────────────────────
    const cohostResp = await fetch(
      `${supabaseUrl}/rest/v1/live_cohosts`
      + `?session_id=eq.${sessionId}`
      + `&user_id=eq.${targetUserId}`
      + `&revoked_at=is.null`
      + `&select=user_id&limit=1`,
      {
        headers: {
          apikey:        serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    );
    if (!cohostResp.ok) {
      return jsonResponse({ error: 'CoHost-Lookup fehlgeschlagen' }, 500);
    }
    const cohosts = await cohostResp.json() as Array<{ user_id: string }>;
    if (!cohosts[0]) {
      return jsonResponse({ error: 'Target ist kein aktiver CoHost dieser Session' }, 403);
    }

    // ── 7. Admin-JWT für LiveKit, scoped auf den Room ────────────────────────
    const adminToken = await livekitAdminToken(lkApiKey, lkApiSecret, session.room_name);

    // ── 8. ListParticipants → Target-Tracks finden ───────────────────────────
    const listResp = await fetch(
      `${lkHttpBase}/twirp/livekit.RoomService/ListParticipants`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ room: session.room_name }),
      }
    );
    if (!listResp.ok) {
      const detail = await listResp.text().catch(() => '');
      return jsonResponse({ error: 'LiveKit ListParticipants fehlgeschlagen', detail }, 502);
    }
    const listJson = await listResp.json() as { participants?: ParticipantInfo[] };
    const participant = (listJson.participants ?? []).find(
      (p) => p.identity === targetUserId,
    );
    if (!participant) {
      // CoHost ist in DB, aber nicht im Room — vermutlich gerade disconnected.
      // Kein harter Fehler — Broadcast-Fallback im Frontend übernimmt.
      return jsonResponse({
        muted: mute,
        tracksFound: { audio: false, video: false },
        warning: 'Teilnehmer nicht im Room — nur Broadcast-Hinweis gültig',
      });
    }

    const tracks = participant.tracks ?? [];
    // LiveKit Twirp-JSON liefert `type` als Enum-String: "AUDIO" | "VIDEO" | "DATA"
    const audioTrack = tracks.find((t) => t.type === 'AUDIO');
    const videoTrack = tracks.find((t) => t.type === 'VIDEO');
    const tracksFound = { audio: !!audioTrack, video: !!videoTrack };

    // ── 9. MutePublishedTrack parallel für Audio + Video ─────────────────────
    const ops: Promise<Response>[] = [];
    const muted: { audio?: boolean; video?: boolean } = {};

    if (typeof mute.audio === 'boolean' && audioTrack) {
      muted.audio = mute.audio;
      ops.push(fetch(
        `${lkHttpBase}/twirp/livekit.RoomService/MutePublishedTrack`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({
            room:      session.room_name,
            identity:  targetUserId,
            track_sid: audioTrack.sid,
            muted:     mute.audio,
          }),
        }
      ));
    }
    if (typeof mute.video === 'boolean' && videoTrack) {
      muted.video = mute.video;
      ops.push(fetch(
        `${lkHttpBase}/twirp/livekit.RoomService/MutePublishedTrack`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({
            room:      session.room_name,
            identity:  targetUserId,
            track_sid: videoTrack.sid,
            muted:     mute.video,
          }),
        }
      ));
    }

    if (ops.length === 0) {
      // Nichts zu tun — aber kein harter Fehler (z.B. CoHost hat Mic schon aus)
      return jsonResponse({ muted, tracksFound });
    }

    const results = await Promise.all(ops);
    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      const details = await Promise.all(failed.map((r) => r.text().catch(() => '')));
      return jsonResponse({
        error: 'LiveKit MutePublishedTrack fehlgeschlagen',
        details,
        muted,
        tracksFound,
      }, 502);
    }

    return jsonResponse({ muted, tracksFound });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
