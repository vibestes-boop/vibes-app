/**
 * Supabase Edge Function: livekit-token
 * Zero external dependencies — only deno.land/std für serve().
 * Auth via nativer Fetch-Call zur Supabase Auth API.
 * JWT via Web Crypto (kein npm, kein esm.sh).
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Base64url Encoding ───────────────────────────────────────────────────────
function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : input;
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// ─── LiveKit JWT via HS256 ────────────────────────────────────────────────────
async function livekitToken(
  apiKey: string,
  apiSecret: string,
  identity: string,
  roomName: string,
  canPublish: boolean
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: apiKey,
    sub: identity,
    iat: now,
    nbf: 0,
    exp: now + 8 * 3600, // 8h — ausreichend für lange Streams
    video: {
      roomJoin:       true,
      room:           roomName,
      canPublish,
      canSubscribe:   true,
      canPublishData: true,
    },
  }));
  const data = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${b64url(new Uint8Array(sig))}`;
}

// ─── Handler ─────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const userJwt = authHeader.slice(7).trim();

    // Supabase Auth über nativen Fetch-Call verifizieren (kein supabase-js nötig)
    const supabaseUrl     = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${userJwt}`,
        'apikey': serviceRoleKey,
      },
    });
    if (!authResp.ok) {
      const detail = await authResp.text().catch(() => '');
      return new Response(
        JSON.stringify({ error: 'Nicht autorisiert', detail }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const authData = await authResp.json();
    const userId = authData?.id as string;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Kein User in Auth-Antwort' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Request Body
    const { roomName, isHost, isCoHost } = await req.json() as {
      roomName: string;
      isHost: boolean;
      isCoHost?: boolean;
    };

    if (!roomName || typeof roomName !== 'string') {
      return new Response(
        JSON.stringify({ error: 'roomName fehlt oder ungültig' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── SEC 1: Host-Token nur wenn User wirklich Host dieser aktiven Session ist
    if (isHost) {
      const sessionResp = await fetch(
        `${supabaseUrl}/rest/v1/live_sessions?room_name=eq.${encodeURIComponent(roomName)}&status=eq.active&select=host_id&limit=1`,
        {
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
        }
      );
      const sessions = await sessionResp.json() as { host_id: string }[];
      const session = sessions?.[0];
      if (!session || session.host_id !== userId) {
        return new Response(
          JSON.stringify({ error: 'Nicht autorisiert als Host für diesen Room' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── SEC 2: Co-Host-Token nur wenn User auf Whitelist (live_cohosts) ──────
    // Vorher reichte isCoHost=true vom Client — jeder konnte Publisher-Rechte
    // für fremde Streams holen. Jetzt: Session suchen, dann prüfen ob User
    // aktiver (nicht-revoked) Co-Host dieser Session ist.
    let coHostApproved = false;
    if (isCoHost && !isHost) {
      const sessionResp = await fetch(
        `${supabaseUrl}/rest/v1/live_sessions?room_name=eq.${encodeURIComponent(roomName)}&status=eq.active&select=id&limit=1`,
        {
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
        }
      );
      const sessions = await sessionResp.json() as { id: string }[];
      const sessionId = sessions?.[0]?.id;
      if (!sessionId) {
        return new Response(
          JSON.stringify({ error: 'Session nicht aktiv oder nicht gefunden' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const cohostResp = await fetch(
        `${supabaseUrl}/rest/v1/live_cohosts`
        + `?session_id=eq.${sessionId}`
        + `&user_id=eq.${userId}`
        + `&revoked_at=is.null`
        + `&select=user_id&limit=1`,
        {
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
        }
      );
      const cohosts = await cohostResp.json() as { user_id: string }[];
      if (!cohosts?.[0]) {
        return new Response(
          JSON.stringify({ error: 'Nicht als Co-Host für diesen Room zugelassen' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      coHostApproved = true;
    }

    const apiKey    = Deno.env.get('LIVEKIT_API_KEY')!;
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET')!;
    const lkUrl     = Deno.env.get('LIVEKIT_URL')!;

    // Publish-Rechte strikt: nur verifizierter Host ODER verifizierter Co-Host.
    // Alles andere ist Viewer → nur Subscribe.
    const canPublish = (isHost === true) || coHostApproved;
    const token = await livekitToken(apiKey, apiSecret, userId, roomName, canPublish);


    return new Response(
      JSON.stringify({ token, url: lkUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
