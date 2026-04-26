/**
 * Supabase Edge Function: livekit-whip-ingress
 *
 * v1.w.UI.35 — OBS-WHIP-Ingest (Phase 6b der WEB_ROADMAP.md)
 * v1.w.UI.36 — Persistenter WHIP-Ingress (Bearer Token ändert sich nie)
 *
 * Lässt externe Streaming-Software (OBS Studio 30+, vMix, Streamlabs) via
 * WHIP-Protokoll nach LiveKit publishen, statt im Browser. Pro-Streamer
 * kriegen damit:
 *   - Echte 1080p60 (Browser ist auf ~720p limitiert)
 *   - Multi-Source-Setups (Cam + Screenshare + Mic-Mix)
 *   - Bessere Encoder (NVENC/AMD/AppleVTH264)
 *   - Workflow den sie aus Twitch/YouTube schon kennen
 *
 * v1.w.UI.36 Änderungen:
 *   - create: prüft ob der User bereits einen persistenten Ingress hat
 *     (user_whip_ingresses-Tabelle). Falls ja, wird nur eine neue
 *     live_sessions-Row angelegt und die gespeicherten Credentials
 *     zurückgegeben — kein neuer LiveKit-Ingress. Falls nein, wird ein
 *     neuer Ingress erstellt, in user_whip_ingresses gespeichert und
 *     in der Session-Row verlinkt.
 *   - delete: beendet nur die live_session (status='ended') — der
 *     LiveKit-Ingress bleibt erhalten damit OBS beim nächsten Stream
 *     dieselben Credentials nutzen kann.
 *   - rotate (neu): löscht den alten LiveKit-Ingress, erstellt einen
 *     neuen mit demselben room_name, aktualisiert user_whip_ingresses.
 *     Nützlich wenn der Stream-Key kompromittiert wurde.
 *
 * Vier Endpoints (alle POST, action im Body):
 *
 *   { action: "create", title, privacy? }
 *     → Erstellt eine neue live_session. Erstellt auch einen LiveKit-
 *       Ingress falls noch keiner existiert. Returnt sessionId,
 *       ingressUrl, ingressStreamKey (persistent).
 *
 *   { action: "delete", sessionId }
 *     → Beendet die live_session (status='ended'). Der LiveKit-Ingress
 *       bleibt erhalten.
 *
 *   { action: "status", sessionId }
 *     → Prüft via LiveKit-Ingress-API ob der Ingress aktuell empfangs-
 *       bereit ist (state.status === ENDPOINT_PUBLISHING). Returnt
 *       isPublishing boolean.
 *
 *   { action: "rotate" }
 *     → Löscht alten Ingress bei LiveKit, erstellt neuen mit gleichem
 *       room_name, aktualisiert user_whip_ingresses. Returnt neue
 *       ingressUrl + ingressStreamKey.
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

// ─── LiveKit CreateIngress ────────────────────────────────────────────────────
interface IngressResult {
  ingress_id: string;
  url: string;
  stream_key: string;
}

async function createLiveKitIngress(
  env: Env,
  roomName: string,
  userId: string,
  label: string,
): Promise<IngressResult | { error: string }> {
  const adminJwt = await liveKitAdminJwt(env.liveKitApiKey, env.liveKitApiSecret);
  const ingressBody = {
    input_type: 1, // WHIP_INPUT (proto enum)
    name: label,
    room_name: roomName,
    participant_identity: `host-${userId}`,
    participant_name: label,
    // bypass_transcoding=true → Stream wird ohne Re-Encode an den Room
    // weitergereicht. Niedrigere Latenz, höhere Quality, aber Viewer-Browser
    // muss die Encoder-Codecs (typisch H264 + Opus) supporten — was alle
    // modernen Browser tun.
    bypass_transcoding: true,
  };

  const resp = await fetch(`${env.liveKitUrl}/twirp/livekit.Ingress/CreateIngress`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminJwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(ingressBody),
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    return { error: `LiveKit CreateIngress fehlgeschlagen: ${errBody}` };
  }

  const data = (await resp.json()) as {
    ingress_id?: string;
    url?: string;
    stream_key?: string;
  };

  if (!data.ingress_id || !data.url || !data.stream_key) {
    return { error: `LiveKit-Response unvollständig: ${JSON.stringify(data)}` };
  }

  return { ingress_id: data.ingress_id, url: data.url, stream_key: data.stream_key };
}

// ─── action: create ──────────────────────────────────────────────────────────
// v1.w.UI.36: Prüft zuerst ob der User bereits einen persistenten Ingress hat.
// Falls ja: nur neue live_session anlegen, gespeicherte Credentials nutzen.
// Falls nein: neuen LiveKit-Ingress erstellen + in user_whip_ingresses speichern.
async function handleCreate(body: { title?: string; privacy?: string }, env: Env, userId: string) {
  const title = (body.title ?? '').toString().trim().slice(0, 140) || 'Live Stream';
  const privacy = body.privacy === 'private' ? 'private' : 'public';

  // ── Schritt 1: Prüfen ob persistenter Ingress bereits existiert ──────────
  const existingResp = await fetch(
    `${env.supabaseUrl}/rest/v1/user_whip_ingresses?user_id=eq.${userId}&select=ingress_id,ingress_url,stream_key,room_name`,
    {
      headers: {
        apikey: env.serviceRoleKey,
        Authorization: `Bearer ${env.serviceRoleKey}`,
      },
    },
  );

  let ingressData: IngressResult | null = null;
  let roomName: string;
  let isNew = false;

  if (existingResp.ok) {
    const existing = (await existingResp.json()) as Array<{
      ingress_id: string;
      ingress_url: string;
      stream_key: string;
      room_name: string;
    }>;
    const row = existing?.[0];
    if (row) {
      // Persistenter Ingress gefunden — wiederverwenden
      ingressData = { ingress_id: row.ingress_id, url: row.ingress_url, stream_key: row.stream_key };
      roomName = row.room_name;
    }
  }

  if (!ingressData) {
    // Noch kein Ingress → neuen erstellen
    // Stabiler room_name: obs-perm-{userId.slice(0,8)} — ändert sich nie
    roomName = `obs-perm-${userId.slice(0, 8)}`;
    console.log(`[create] no existing ingress for ${userId}, creating new one with room ${roomName}`);

    // Cleanup: Alle alten Ingresses dieses Users löschen bevor wir einen neuen
    // anlegen. Verhindert "total ingress object limit exceeded" bei LiveKit.
    // Wir listen alle Ingresses und filtern client-seitig nach participant_identity.
    try {
      const cleanupJwt = await liveKitAdminJwt(env.liveKitApiKey, env.liveKitApiSecret);
      const listResp = await fetch(`${env.liveKitUrl}/twirp/livekit.Ingress/ListIngress`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cleanupJwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (listResp.ok) {
        const list = (await listResp.json()) as {
          items?: Array<{ ingress_id: string; participant_identity?: string }>;
        };
        // LiveKit Twirp JSON kann snake_case oder camelCase zurückgeben — beide prüfen
        const toDelete = (list.items ?? []).filter((i) => {
          const raw = i as Record<string, unknown>;
          const pid = raw['participant_identity'] ?? raw['participantIdentity'];
          return pid === `host-${userId}`;
        });
        console.log(`[create] cleanup: found ${toDelete.length} old ingress(es) for user`);
        if (toDelete.length > 0) {
          const dJwt = await liveKitAdminJwt(env.liveKitApiKey, env.liveKitApiSecret);
          await Promise.all(
            toDelete.map((item) =>
              fetch(`${env.liveKitUrl}/twirp/livekit.Ingress/DeleteIngress`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${dJwt}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ ingress_id: item.ingress_id }),
              }),
            ),
          );
          // Kurz warten damit LiveKit die Deletions propagiert bevor wir CreateIngress rufen
          await new Promise((r) => setTimeout(r, 800));
        }
      }
    } catch (e) {
      // Cleanup-Fehler sind nicht kritisch — wir versuchen trotzdem einen neuen zu erstellen
      console.error(`[create] cleanup error (non-fatal):`, e);
    }

    const created = await createLiveKitIngress(env, roomName, userId, `WHIP-perm-${userId.slice(0, 8)}`);
    if ('error' in created) {
      console.error(`[create] LiveKit ingress creation failed:`, created.error);
      return jsonResponse({ error: created.error }, 502);
    }
    ingressData = created;
    isNew = true;
  }

  // ── Schritt 2: Neue live_sessions-Row anlegen ────────────────────────────
  const sessionId = crypto.randomUUID();

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
      room_name: roomName!,
      ingress_id: ingressData.ingress_id,
      ingress_url: ingressData.url,
      ingress_stream_key: ingressData.stream_key,
      ingress_type: 'whip',
    }),
  });

  if (!insertResp.ok) {
    const errBody = await insertResp.text();
    console.error(`[create] live_sessions insert failed (status ${insertResp.status}):`, errBody);
    // Wenn wir gerade erst einen neuen Ingress erstellt haben und der Session-
    // Insert scheitert, löschen wir den Ingress um keinen Zombie zu hinterlassen.
    // Bei wiederverwendetem Ingress nichts tun — er gehört dem User dauerhaft.
    if (isNew) {
      const jwt = await liveKitAdminJwt(env.liveKitApiKey, env.liveKitApiSecret);
      await fetch(`${env.liveKitUrl}/twirp/livekit.Ingress/DeleteIngress`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingress_id: ingressData.ingress_id }),
      });
    }
    return jsonResponse({ error: 'Session-Insert fehlgeschlagen', detail: errBody }, 500);
  }

  // ── Schritt 3: Bei neuem Ingress in user_whip_ingresses persistieren ─────
  if (isNew) {
    await fetch(`${env.supabaseUrl}/rest/v1/user_whip_ingresses`, {
      method: 'POST',
      headers: {
        apikey: env.serviceRoleKey,
        Authorization: `Bearer ${env.serviceRoleKey}`,
        'Content-Type': 'application/json',
        // Upsert falls der Row zwischen Schritt 1 und 3 durch Race-Condition
        // schon existiert (sehr unwahrscheinlich aber defensive).
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        user_id: userId,
        ingress_id: ingressData.ingress_id,
        ingress_url: ingressData.url,
        stream_key: ingressData.stream_key,
        room_name: roomName!,
      }),
    });
  }

  return jsonResponse({
    sessionId,
    roomName: roomName!,
    ingressUrl: ingressData.url,
    ingressStreamKey: ingressData.stream_key,
    ingressId: ingressData.ingress_id,
    isPersistent: true,
  });
}

// ─── action: delete ──────────────────────────────────────────────────────────
// v1.w.UI.36: Beendet nur die live_session — der LiveKit-Ingress bleibt
// erhalten damit OBS beim nächsten Stream dieselben Credentials nutzen kann.
async function handleDelete(body: { sessionId?: string }, env: Env, userId: string) {
  const sessionId = body.sessionId;
  if (!sessionId) return jsonResponse({ error: 'sessionId erforderlich' }, 400);

  // Session laden + Ownership prüfen
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

  // Session beenden — Ingress-Felder in der Session-Row leeren (sie stehen
  // dauerhaft in user_whip_ingresses), LiveKit-Ingress NICHT löschen.
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

  // Ingress-ID aus Session ODER aus user_whip_ingresses (falls Session-Row
  // bereits geleert wurde, was eigentlich nicht passieren sollte beim Polling,
  // aber defensive programmieren schadet nie).
  let ingressId = session.ingress_id;
  if (!ingressId) {
    const wiResp = await fetch(
      `${env.supabaseUrl}/rest/v1/user_whip_ingresses?user_id=eq.${userId}&select=ingress_id`,
      {
        headers: { apikey: env.serviceRoleKey, Authorization: `Bearer ${env.serviceRoleKey}` },
      },
    );
    if (wiResp.ok) {
      const wi = (await wiResp.json()) as Array<{ ingress_id: string }>;
      ingressId = wi?.[0]?.ingress_id ?? null;
    }
  }

  if (!ingressId) {
    return jsonResponse({ isPublishing: false, reason: 'no-ingress' });
  }

  const adminJwt = await liveKitAdminJwt(env.liveKitApiKey, env.liveKitApiSecret);
  const listResp = await fetch(`${env.liveKitUrl}/twirp/livekit.Ingress/ListIngress`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminJwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ingress_id: ingressId }),
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

// ─── action: rotate ──────────────────────────────────────────────────────────
// Löscht den alten LiveKit-Ingress, erstellt einen neuen mit demselben
// room_name, aktualisiert user_whip_ingresses.
// Nützlich wenn der Stream-Key kompromittiert wurde oder der User einfach
// frische Credentials will.
async function handleRotate(env: Env, userId: string) {
  // Bestehenden Ingress laden
  const wiResp = await fetch(
    `${env.supabaseUrl}/rest/v1/user_whip_ingresses?user_id=eq.${userId}&select=ingress_id,room_name`,
    {
      headers: { apikey: env.serviceRoleKey, Authorization: `Bearer ${env.serviceRoleKey}` },
    },
  );
  if (!wiResp.ok) return jsonResponse({ error: 'DB-Lesefehler' }, 500);

  const rows = (await wiResp.json()) as Array<{ ingress_id: string; room_name: string }>;
  const existing = rows?.[0];

  if (!existing) {
    return jsonResponse({ error: 'Kein persistenter Ingress gefunden. Erst einen Stream starten.' }, 404);
  }

  const { ingress_id: oldIngressId, room_name: roomName } = existing;

  // Alten Ingress bei LiveKit löschen (idempotent — 404 ignorieren)
  const adminJwt = await liveKitAdminJwt(env.liveKitApiKey, env.liveKitApiSecret);
  await fetch(`${env.liveKitUrl}/twirp/livekit.Ingress/DeleteIngress`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminJwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ingress_id: oldIngressId }),
  });
  // Fehler absichtlich ignoriert — neuen Ingress trotzdem erstellen.

  // Neuen Ingress erstellen
  const newIngress = await createLiveKitIngress(
    env,
    roomName,
    userId,
    `WHIP-perm-${userId.slice(0, 8)}`,
  );
  if ('error' in newIngress) {
    return jsonResponse({ error: newIngress.error }, 502);
  }

  // user_whip_ingresses aktualisieren
  await fetch(
    `${env.supabaseUrl}/rest/v1/user_whip_ingresses?user_id=eq.${userId}`,
    {
      method: 'PATCH',
      headers: {
        apikey: env.serviceRoleKey,
        Authorization: `Bearer ${env.serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ingress_id: newIngress.ingress_id,
        ingress_url: newIngress.url,
        stream_key: newIngress.stream_key,
        updated_at: new Date().toISOString(),
      }),
    },
  );

  return jsonResponse({
    ok: true,
    ingressUrl: newIngress.url,
    ingressStreamKey: newIngress.stream_key,
    ingressId: newIngress.ingress_id,
  });
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
    case 'rotate':
      return handleRotate(env, userId);
    default:
      return jsonResponse({ error: 'Unbekannte action' }, 400);
  }
});
