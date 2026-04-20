/**
 * Supabase Edge Function: livekit-egress
 *
 * v1.18.0 — Live-Replay / VOD
 *
 * Drei Endpoints (alle POST, action im Body):
 *
 *   { action: "start",  sessionId, roomName }
 *     → Erstellt einen RoomComposite-Egress in LiveKit, schreibt Zeile in
 *       `live_recordings` (status=recording) und setzt
 *       `live_sessions.recording_id` + `recording_enabled=true`.
 *
 *   { action: "stop",   sessionId }
 *     → Stoppt den laufenden Egress über LiveKit-API; Webhook updated dann
 *       Status (processing → ready / failed).
 *
 *   { action: "webhook" } + LiveKit-Auth-Header
 *     → LiveKit ruft das auf, sobald sich der Egress-Status ändert. Wir
 *       persistieren `file_url`, `duration_secs` und `status`.
 *
 * Storage:
 *   File landet in Supabase Storage Bucket `live-recordings` unter
 *   `<host_id>/<session_id>.mp4`. Wir nutzen das S3-kompatible Interface
 *   von Supabase Storage — die nötigen Credentials kommen aus den
 *   Env-Variablen STORAGE_S3_ACCESS_KEY / STORAGE_S3_SECRET_KEY.
 *
 * Hinweis: Die LiveKit-Egress Konfiguration wird auf Cloud-Seite über das
 * Project-Setting → Egress eingerichtet. Diese Function ist der Glue-Code
 * zwischen App, LiveKit und Storage.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ─── Base64url Encoding (gleich wie livekit-token) ───────────────────────────
function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : input;
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ─── LiveKit Server-API Token (HS256) ────────────────────────────────────────
async function livekitServerToken(apiKey: string, apiSecret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: apiKey,
    sub: apiKey,
    iat: now,
    exp: now + 600,
    video: {
      roomAdmin:  true,
      roomCreate: true,
      roomList:   true,
      // egress*-Permissions sind Teil von roomAdmin in aktuellen LK-Versionen
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

async function getUserIdFromAuth(req: Request, supabaseUrl: string, anonKey: string): Promise<string | null> {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const userJwt = authHeader.slice(7).trim();
  const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${userJwt}`, apikey: anonKey },
  });
  if (!userResp.ok) return null;
  const user = await userResp.json() as { id?: string };
  return user.id ?? null;
}

// ─── start: Egress starten + DB-Zeile anlegen ────────────────────────────────
async function handleStart(body: any, env: Env, userId: string) {
  const { sessionId, roomName } = body as { sessionId: string; roomName: string };
  if (!sessionId || !roomName) return jsonResponse({ error: 'sessionId + roomName erforderlich' }, 400);

  // Session laden + Authority prüfen
  const sessResp = await fetch(
    `${env.supabaseUrl}/rest/v1/live_sessions?id=eq.${sessionId}&select=id,host_id,room_name`,
    { headers: { apikey: env.serviceRoleKey, Authorization: `Bearer ${env.serviceRoleKey}` } },
  );
  const sessions = await sessResp.json() as Array<{ id: string; host_id: string; room_name: string }>;
  const session = sessions?.[0];
  if (!session) return jsonResponse({ error: 'Session nicht gefunden' }, 404);
  if (session.host_id !== userId) return jsonResponse({ error: 'Nicht autorisiert' }, 403);

  // Pfad in Storage: <host_id>/<session_id>.mp4
  const storagePath = `${userId}/${sessionId}.mp4`;
  const publicUrl = `${env.supabaseUrl}/storage/v1/object/public/live-recordings/${storagePath}`;

  // LiveKit-API-Call: Room-Composite Egress starten
  // → in der Cloud-Console muss S3-Sink mit Supabase Storage konfiguriert sein
  // (Endpoint: <PROJECT-REF>.storage.supabase.co, Bucket: live-recordings).
  let egressId: string | null = null;
  try {
    const lkToken = await livekitServerToken(env.lkApiKey, env.lkApiSecret);
    const egressResp = await fetch(`${env.lkUrl.replace(/^wss?:\/\//, 'https://')}/twirp/livekit.Egress/StartRoomCompositeEgress`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lkToken}` },
      body: JSON.stringify({
        room_name: roomName,
        layout:    'speaker',
        audio_only: false,
        file_outputs: [{
          filepath: storagePath,
          s3: {
            access_key:  env.s3AccessKey,
            secret:      env.s3SecretKey,
            region:      env.s3Region,
            bucket:      'live-recordings',
            endpoint:    env.s3Endpoint,
            force_path_style: true,
          },
        }],
      }),
    });
    if (egressResp.ok) {
      const eg = await egressResp.json() as { egress_id?: string };
      egressId = eg.egress_id ?? null;
    } else {
      const text = await egressResp.text();
      console.warn('[livekit-egress.start] LK error:', egressResp.status, text);
    }
  } catch (e) {
    console.warn('[livekit-egress.start] LK fetch failed:', String(e));
  }

  // DB: Zeile in live_recordings + live_sessions update
  const insertResp = await fetch(`${env.supabaseUrl}/rest/v1/live_recordings`, {
    method: 'POST',
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      session_id: sessionId,
      host_id:    userId,
      egress_id:  egressId,
      status:     egressId ? 'recording' : 'failed',
      file_path:  storagePath,
      file_url:   publicUrl,
      error_message: egressId ? null : 'LiveKit-Egress konnte nicht gestartet werden',
    }),
  });
  const created = await insertResp.json() as Array<{ id: string }>;
  const recordingId = created?.[0]?.id;

  if (recordingId) {
    await fetch(`${env.supabaseUrl}/rest/v1/live_sessions?id=eq.${sessionId}`, {
      method: 'PATCH',
      headers: {
        apikey: env.serviceRoleKey,
        Authorization: `Bearer ${env.serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recording_enabled: true, recording_id: recordingId }),
    });
  }

  return jsonResponse({
    recording_id: recordingId ?? null,
    egress_id:    egressId,
    status:       egressId ? 'recording' : 'failed',
  });
}

// ─── stop: Egress beenden ────────────────────────────────────────────────────
async function handleStop(body: any, env: Env, userId: string) {
  const { sessionId } = body as { sessionId: string };
  if (!sessionId) return jsonResponse({ error: 'sessionId erforderlich' }, 400);

  // Recording laden
  const recResp = await fetch(
    `${env.supabaseUrl}/rest/v1/live_recordings?session_id=eq.${sessionId}&select=id,host_id,egress_id,status`,
    { headers: { apikey: env.serviceRoleKey, Authorization: `Bearer ${env.serviceRoleKey}` } },
  );
  const recs = await recResp.json() as Array<{ id: string; host_id: string; egress_id: string | null; status: string }>;
  const rec  = recs?.[0];
  if (!rec) return jsonResponse({ error: 'Kein Recording aktiv' }, 404);
  if (rec.host_id !== userId) return jsonResponse({ error: 'Nicht autorisiert' }, 403);

  if (rec.egress_id && rec.status === 'recording') {
    try {
      const lkToken = await livekitServerToken(env.lkApiKey, env.lkApiSecret);
      await fetch(`${env.lkUrl.replace(/^wss?:\/\//, 'https://')}/twirp/livekit.Egress/StopEgress`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lkToken}` },
        body:    JSON.stringify({ egress_id: rec.egress_id }),
      });
    } catch (e) {
      console.warn('[livekit-egress.stop] LK fetch failed:', String(e));
    }
  }

  // Optimistisch auf processing setzen — Webhook setzt später final
  await fetch(`${env.supabaseUrl}/rest/v1/live_recordings?id=eq.${rec.id}`, {
    method: 'PATCH',
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'processing', finished_at: new Date().toISOString() }),
  });

  return jsonResponse({ status: 'processing' });
}

// ─── webhook: LiveKit ruft uns mit aktuellem Egress-State ────────────────────
// LiveKit signiert Webhook-Bodies mit JWT (Header `Authorization: Bearer ...`).
// Wir verifizieren die Signatur über das gleiche API-Secret.
async function verifyLiveKitWebhook(authHeader: string, body: string, apiSecret: string): Promise<boolean> {
  if (!authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [h, p, s] = parts;

  // SHA256 Hash des Bodies muss dem `sha256` Claim entsprechen
  const data = new TextEncoder().encode(body);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hashBuf)));

  try {
    const payload = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.sha256 !== hashB64) return false;
  } catch {
    return false;
  }

  // Signatur prüfen
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const sigBytes = Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const ok = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    new TextEncoder().encode(`${h}.${p}`),
  );
  return ok;
}

async function handleWebhook(req: Request, env: Env) {
  const rawBody = await req.text();
  const authHeader = req.headers.get('authorization') ?? '';

  const valid = await verifyLiveKitWebhook(authHeader, rawBody, env.lkApiSecret);
  if (!valid) {
    console.warn('[livekit-egress.webhook] invalid signature');
    return jsonResponse({ error: 'invalid signature' }, 401);
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: 'invalid json' }, 400);
  }

  // LiveKit Webhook Events: ingress_started, egress_started, egress_updated, egress_ended
  const event = payload.event as string | undefined;
  if (!event || !event.startsWith('egress_')) {
    return jsonResponse({ ok: true });
  }

  const egressInfo = payload.egress_info as any;
  if (!egressInfo?.egress_id) return jsonResponse({ ok: true });

  // status: EGRESS_STARTING=0, ACTIVE=1, ENDING=2, COMPLETE=3, FAILED=4, ABORTED=5
  const lkStatus = egressInfo.status as number;
  let dbStatus: string;
  switch (lkStatus) {
    case 0: case 1: dbStatus = 'recording'; break;
    case 2:         dbStatus = 'processing'; break;
    case 3:         dbStatus = 'ready'; break;
    case 4: case 5: dbStatus = 'failed'; break;
    default:        dbStatus = 'recording';
  }

  // Datei-Resultate auswerten
  const fileResults = egressInfo.file_results as Array<{ filename?: string; size?: number; duration?: number }> | undefined;
  const file = fileResults?.[0];

  const patch: Record<string, any> = { status: dbStatus };
  if (file?.size)     patch.file_size_bytes = Number(file.size);
  if (file?.duration) patch.duration_secs   = Math.round(Number(file.duration) / 1_000_000_000); // LK liefert ns
  if (egressInfo.error) patch.error_message = String(egressInfo.error);
  if (dbStatus === 'ready' || dbStatus === 'failed') patch.finished_at = new Date().toISOString();

  await fetch(`${env.supabaseUrl}/rest/v1/live_recordings?egress_id=eq.${egressInfo.egress_id}`, {
    method: 'PATCH',
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  });

  return jsonResponse({ ok: true, status: dbStatus });
}

// ─── ENV-Bundle ──────────────────────────────────────────────────────────────
interface Env {
  supabaseUrl:    string;
  serviceRoleKey: string;
  anonKey:        string;
  lkApiKey:       string;
  lkApiSecret:    string;
  lkUrl:          string;
  s3AccessKey:    string;
  s3SecretKey:    string;
  s3Region:       string;
  s3Endpoint:     string;
}

function loadEnv(): Env {
  return {
    supabaseUrl:    Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    anonKey:        Deno.env.get('SUPABASE_ANON_KEY')!,
    lkApiKey:       Deno.env.get('LIVEKIT_API_KEY')!,
    lkApiSecret:    Deno.env.get('LIVEKIT_API_SECRET')!,
    lkUrl:          Deno.env.get('LIVEKIT_URL')!,
    s3AccessKey:    Deno.env.get('STORAGE_S3_ACCESS_KEY') ?? '',
    s3SecretKey:    Deno.env.get('STORAGE_S3_SECRET_KEY') ?? '',
    s3Region:       Deno.env.get('STORAGE_S3_REGION')     ?? 'us-east-1',
    s3Endpoint:     Deno.env.get('STORAGE_S3_ENDPOINT')   ?? '',
  };
}

// ─── Main Handler ────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return jsonResponse({ error: 'POST only' }, 405);

  const env = loadEnv();

  // Webhook-Path: weder Body noch Auth-Header sind im üblichen User-Format,
  // daher zuerst checken
  const url = new URL(req.url);
  if (url.pathname.endsWith('/webhook')) {
    return handleWebhook(req, env);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid json' }, 400);
  }

  if (body.action === 'webhook') {
    return handleWebhook(new Request(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(body) }), env);
  }

  const userId = await getUserIdFromAuth(req, env.supabaseUrl, env.anonKey);
  if (!userId) return jsonResponse({ error: 'Nicht eingeloggt' }, 401);

  switch (body.action) {
    case 'start': return handleStart(body, env, userId);
    case 'stop':  return handleStop(body, env, userId);
    default:      return jsonResponse({ error: 'Unbekannte action' }, 400);
  }
});
