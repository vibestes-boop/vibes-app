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
    exp: now + 4 * 3600,
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
    const { roomName, isHost } = await req.json() as { roomName: string; isHost: boolean };

    const apiKey    = Deno.env.get('LIVEKIT_API_KEY')!;
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET')!;
    const lkUrl     = Deno.env.get('LIVEKIT_URL')!;

    const token = await livekitToken(apiKey, apiSecret, userId, roomName, isHost === true);

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
