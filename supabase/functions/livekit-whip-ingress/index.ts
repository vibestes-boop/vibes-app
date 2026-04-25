/**
 * Supabase Edge Function: livekit-whip-ingress
 *
 * v1.w.UI.35 — OBS-WHIP-Ingest (Phase 6b der WEB_ROADMAP.md)
 *
 * Lässt externe Streaming-Software (OBS Studio 30+, vMix, Streamlabs) via
 * WHIP-Protokoll nach LiveKit publishen, statt im Browser. Pro-Streamer
 * kriegen damit:
 *   - Echte 1080p60 (Browser ist auf ~720p limitiert)
 *   - Multi-Source-Setups (Cam + Screenshare + Mic-Mix)
 *   - Bessere Encoder (NVENC/AMD/AppleVTH264)
 *   - Workflow den sie aus Twitch/YouTube schon kennen
 *
 * Drei Endpoints (alle POST, action im Body):
 *
 *   { action: "create", title, privacy? }
 *     → Erstellt eine neue live_session-Row + WHIP-Ingress bei LiveKit.
 *       Persistiert ingress_id/url/stream_key in der Row.
 *       Returnt sessionId, ingress_url, ingress_stream_key.
 *
 *   { action: "delete", sessionId }
 *     → Löscht den Ingress bei LiveKit + cleared die ingress_*-Spalten +
 *       setzt session.status='ended'. Idempotent: doppel-DELETE schadet
 *       nicht (LiveKit gibt 404 oder schon-gelöscht zurück, wir ignorieren).
 *
 *   { action: "status", sessionId }
 *     → Prüft via LiveKit-Ingress-API ob der Ingress aktuell empfangsbereit
 *       ist (state.status === ENDPOINT_PUBLISHING). Returnt is_publishing
 *       boolean. Wird vom UI gepollt um den „warte auf OBS-Stream" → „Live!"
 *       Übergang zu erkennen.
 *
 * Auth: Caller muss authentifiziert sein. Bei action=delete/status wird
 * zusätzlich geprüft dass caller_id === session.host_id ist.
 *
 * LiveKit API: Twirp-RPC auf <LIVEKIT_HTTP_URL>/twirp/livekit.Ingress/<Method>
 * (CreateIngress / DeleteIngress / ListIngress). Admin-JWT mit
 * `video.ingressAdmin: true`, kurz lebig (60s). Wir nutzen die JSON-Variante
 * von Twirp (Content-Type: application/json) — die Proto-Variante wäre
 * fragmentaler ohne externe Lib.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ─── Base64url ───────────────────────────────────────────────────────────────
function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ─── Admin-JWT für LiveKit-Ingress-API ───────────────────────────────────────
// Permissions: ingressAdmin (manage Ingresses) + roomAdmin (Room-Mgmt).
// Kurz lebig (60s) damit ein potenziell geleakter Token kaum Schaden anrichten
// kann — die Function lebt eh nur Millisekunden bevor sie zurück gibt.
async function liveKitAdminJwt(apiKey: string, apiSecret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      iss: apiKey,
      sub: apiKey,
      iat: now,
      exp: now + 60,
      video: {
        ingressAdmin: true,
        roomAdmin: true,
        roomCreate: true,
      },
    }),
  );
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getUserIdFromAuth(
  req: Request,
  supabaseUrl: string,
  anonKey: string,
): Promise<string | null> {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const userJwt = authHeader.slice(7).trim();
  const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${userJwt}`, apikey: anonKey },
  });
  if (!userResp.ok) return null;
  const user = (await userResp.json()) as { id?: string };
  return user.id ?? null;
}

// LiveKit-URL kommt als wss://... aus dem Native-App-Env. Für die Server-API
// brauchen wir https://... — wir mappen automatisch.
function liveKitHttpUrl(rawUrl: string): string {
  if (rawUrl.startsWith('wss://')) return 'https://' + rawUrl.slice(6);
  if (rawUrl.startsWith('ws://')) return 'http://' + rawUrl.slice(5);
  return rawUrl;
}

interface Env {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  liveKitUrl: string;
  liveKitApiKey: string;
  liveKitApiSecret: string;
}

function loadEnv(): Env | { error: string } {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const liveKitUrl = Deno.env.get('LIVEKIT_URL') ?? '';
  const liveKitApiKey = Deno.env.get('LIVEKIT_API_KEY') ?? '';
  const liveKitApiSecret = Deno.env.get('LIVEKIT_API_SECRET') ?? '';
  if (
    !supabaseUrl ||
    !anonKey ||
    !serviceRoleKey ||
    !liveKitUrl ||
    !liveKitApiKey ||
    !liveKitApiSecret
  ) {
    return { error: 'Server-Env unvollständig' };
  }
  return {
    supabaseUrl,
    anonKey,
    serviceRoleKey,
    liveKitUrl: liveKitHttpUrl(liveKitUrl),
    liveKitApiKey,
    liveKitApiSecret,
  };
}

// ─── action: create ──────────────────────────────────────────────────────────
async function handleCreate(body: { title?: string; privacy?: string }, env: Env, userId: string) {
  const title = (body.title ?? '').toString().trim().slice(0, 140) || 'Live Stream';
  const privacy = body.privacy === 'private' ? 'private' : 'public';

  // Schritt 1: Live-Session-Row anlegen (ohne Ingress-Felder erstmal — die
  // füllen wir nach erfolgreichem LiveKit-Call). room_name wird nach dem
  // Pattern host-{userId}-{sessionId} generiert.
  const sessionId = crypto.randomUUID();
  const roomName = `obs-${userId.slice(0, 8)}-${sessionId.slice(0, 8)}`;

  const insertResp = await fetch(`${env.supabaseUrl}/rest/v1/live_sessions`, {
    method: 'POST',
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      id: sessionId,
      host_id: userId,
      title,
      status: 'active',
      room_name: roomName,
    }),
  });
  if (!insertResp.ok) {
    const errBody = await insertResp.text();
    return jsonResponse({ error: 'Session-Insert fehlgeschlagen', detail: errBody }, 500);
  }

  // Schritt 2: LiveKit CreateIngress aufrufen
  const adminJwt = await liveKitAdminJwt(env.liveKitApiKey, env.liveKitApiSecret);
  const ingressBody = {
    input_type: 1, // WHIP_INPUT (proto enum)
    name: `WHIP-${sessionId}`,
    room_name: roomName,
    participant_identity: `host-${userId}`,
    participant_name: title,
    // bypass_transcoding=true → Stream wird ohne Re-Encode an den Room
    // weitergereicht. Niedrigere Latenz, höhere Quality, aber Viewer-Browser
    // muss die Encoder-Codecs (typisch H264 + Opus) supporten — was alle
    // modernen Browser tun.
    bypass_transcoding: true,
  };

  const ingressResp = await fetch(`${env.liveKitUrl}/twirp/livekit.Ingress/CreateIngress`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminJwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(ingressBody),
  });

  if (!ingressResp.ok) {
    const errBody = await ingressResp.text();
    // Cleanup: Session wieder löschen damit kein verwaister Eintrag bleibt
    await fetch(`${env.supabaseUrl}/rest/v1/live_sessions?id=eq.${sessionId}`, {
      method: 'DELETE',
      headers: { apikey: env.serviceRoleKey, Authorization: `Bearer ${env.serviceRoleKey}` },
    });
    return jsonResponse({ error: 'LiveKit-Ingress-Create fehlgeschlagen', detail: errBody }, 502);
  }

  const ingress = (await ingressResp.json()) as {
    ingress_id?: string;
    url?: string;
    stream_key?: string;
  };

  if (!ingress.ingress_id || !ingress.url || !ingress.stream_key) {
    await fetch(`${env.supabaseUrl}/rest/v1/live_sessions?id=eq.${sessionId}`, {
      method: 'DELETE',
      headers: { apikey: env.serviceRoleKey, Authorization: `Bearer ${env.serviceRoleKey}` },
    });
    return jsonResponse({ error: 'LiveKit-Response unvollständig', got: ingress }, 502);
  }

  // Schritt 3: Ingress-Felder zurück in die Row schreiben
  await fetch(`${env.supabaseUrl}/rest/v1/live_sessions?id=eq.${sessionId}`, {
    method: 'PATCH',
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ingress_id: ingress.ingress_id,
      ingress_url: ingress.url,
      ingress_stream_key: ingress.stream_key,
      ingress_type: 'whip',
    }),
  });

  return jsonResponse({
    sessionId,
    roomName,
    ingressUrl: ingress.url,
    ingressStreamKey: ingress.stream_key,
    ingressId: ingress.ingress_id,
  });
}

// ─── action: delete ──────────────────────────────────────────────────────────
async function handleDelete(body: { sessionId?: string }, env: Env, userId: string) {
  const sessionId = body.sessionId;
  if (!sessionId) return jsonResponse({ error: 'sessionId erforderlich' }, 400);

  // Session laden + Ownership prüfen + ingress_id rauslesen
  const sessResp = await fetch(
    `${env.supabaseUrl}/rest/v1/live_sessions?id=eq.${sessionId}&select=id,host_id,ingress_id`,
    {
      headers: {
        apikey: env.serviceRoleKey,
        Authorization: `Bearer ${env.serviceRoleKey}`,
      },
    },
  );
  const sessions = (await sessResp.json()) as Array<{
    id: string;
    host_id: string;
    ingress_id: string | null;
  }>;
  const session = sessions?.[0];
  if (!session) return jsonResponse({ error: 'Session nicht gefunden' }, 404);
  if (session.host_id !== userId) return jsonResponse({ error: 'Nicht autorisiert' }, 403);

  // LiveKit DeleteIngress (idempotent — wenn schon weg ist, ignorieren wir 404)
  if (session.ingress_id) {
    const adminJwt = await liveKitAdminJwt(env.liveKitApiKey, env.liveKitApiSecret);
    await fetch(`${env.liveKitUrl}/twirp/livekit.Ingress/DeleteIngress`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminJwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ingress_id: session.ingress_id }),
    });
    // Wir prüfen `ok` nicht hart — falls der Ingress schon weg ist (404) oder
    // LiveKit gerade hickst, soll der DB-Cleanup trotzdem laufen. Ein
    // verwaister Ingress bei LiveKit ist weniger schlimm als eine UI die
    // kein Ende-Stream-Knopf hat.
  }

  // DB-Cleanup: Session beenden + Ingress-Felder leeren
  await fetch(`${env.supabaseUrl}/rest/v1/live_sessions?id=eq.${sessionId}`, {
    method: 'PATCH',
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status: 'ended',
      ended_at: new Date().toISOString(),
      ingress_id: null,
      ingress_url: null,
      ingress_stream_key: null,
      ingress_type: null,
    }),
  });

  return jsonResponse({ ok: true });
}

// ─── action: status ──────────────────────────────────────────────────────────
// Prüft via ListIngress mit ingress_id-Filter ob der Stream gerade publishet.
async function handleStatus(body: { sessionId?: string }, env: Env, userId: string) {
  const sessionId = body.sessionId;
  if (!sessionId) return jsonResponse({ error: 'sessionId erforderlich' }, 400);

  const sessResp = await fetch(
    `${env.supabaseUrl}/rest/v1/live_sessions?id=eq.${sessionId}&select=id,host_id,ingress_id`,
    {
      headers: {
        apikey: env.serviceRoleKey,
        Authorization: `Bearer ${env.serviceRoleKey}`,
      },
    },
  );
  const sessions = (await sessResp.json()) as Array<{
    id: string;
    host_id: string;
    ingress_id: string | null;
  }>;
  const session = sessions?.[0];
  if (!session) return jsonResponse({ error: 'Session nicht gefunden' }, 404);
  if (session.host_id !== userId) return jsonResponse({ error: 'Nicht autorisiert' }, 403);
  if (!session.ingress_id) {
    return jsonResponse({ isPublishing: false, reason: 'no-ingress' });
  }

  const adminJwt = await liveKitAdminJwt(env.liveKitApiKey, env.liveKitApiSecret);
  const listResp = await fetch(`${env.liveKitUrl}/twirp/livekit.Ingress/ListIngress`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminJwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ingress_id: session.ingress_id }),
  });

  if (!listResp.ok) {
    return jsonResponse({ isPublishing: false, reason: 'list-failed' });
  }

  const list = (await listResp.json()) as {
    items?: Array<{ state?: { status?: number | string } }>;
  };
  const item = list.items?.[0];
  // ENDPOINT_PUBLISHING = 1 in proto enum (0=INACTIVE, 1=PUBLISHING, ...)
  // Auch String-Form abfangen falls Twirp JSON-encoded das Enum als String.
  const status = item?.state?.status;
  const isPublishing = status === 1 || status === 'ENDPOINT_PUBLISHING';
  return jsonResponse({ isPublishing });
}

// ─── Main Handler ────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const env = loadEnv();
  if ('error' in env) return jsonResponse({ error: env.error }, 500);

  const userId = await getUserIdFromAuth(req, env.supabaseUrl, env.anonKey);
  if (!userId) return jsonResponse({ error: 'Nicht authentifiziert' }, 401);

  let body: { action?: string; [k: string]: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Body muss JSON sein' }, 400);
  }

  switch (body.action) {
    case 'create':
      return handleCreate(body as { title?: string; privacy?: string }, env, userId);
    case 'delete':
      return handleDelete(body as { sessionId?: string }, env, userId);
    case 'status':
      return handleStatus(body as { sessionId?: string }, env, userId);
    default:
      return jsonResponse({ error: 'Unbekannte action' }, 400);
  }
});
