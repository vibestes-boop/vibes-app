/**
 * r2-sign — Supabase Edge Function
 *
 * Generates an S3-presigned PUT URL for Cloudflare R2.
 * Called by the app before uploading media (images, videos, avatars).
 * Credentials are stored as Supabase secrets — never exposed to the client.
 *
 * POST body: { key: string, contentType: string }
 * Response:  { uploadUrl: string, publicUrl: string }
 *
 * AWS Signature V4 spec:
 *   https://docs.aws.amazon.com/general/latest/gr/sigv4-create-canonical-request.html
 */

// @ts-ignore — Deno runtime globals are available in Supabase Edge Functions
/// <reference types="https://deno.land/x/types/index.d.ts" />

import { corsHeaders } from '../_shared/cors.ts';

const R2_ACCOUNT_ID    = Deno.env.get('R2_ACCOUNT_ID')!;
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID')!;
const R2_SECRET_KEY    = Deno.env.get('R2_SECRET_ACCESS_KEY')!;
const R2_BUCKET        = Deno.env.get('R2_BUCKET_NAME') ?? 'vibes-media';
const R2_PUBLIC_URL    = Deno.env.get('R2_PUBLIC_URL')!;

// ── HMAC-SHA256 signing helper ──────────────────────────────────────────────
async function hmacSign(key: Uint8Array, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key.buffer as ArrayBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

function toHex(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256hex(msg: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return toHex(new Uint8Array(buf));
}

// ── RFC-3986 percent-encoding ───────────────────────────────────────────────
// AWS Sig V4 requires strict RFC-3986 encoding (unreserved chars only unencoded).
// URLSearchParams is NOT RFC-3986 compliant (leaves * unencoded, uses + for space).
// We implement our own to be safe.
function rfc3986Encode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

// Build a canonical query string from a plain object, sorted by key name.
// Values are RFC-3986 encoded, keys are already safe ASCII.
function buildCanonicalQueryString(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map(k => `${k}=${rfc3986Encode(params[k])}`)
    .join('&');
}

// ── Key validation ──────────────────────────────────────────────────────────
function isValidKey(key: string): boolean {
  // Must not be empty, must not start or end with slash, no path traversal
  if (!key || key.startsWith('/') || key.endsWith('/')) return false;
  if (key.includes('..')) return false;
  if (key.length > 1024) return false;
  // Allow only safe characters: alphanumeric, slash, dot, dash, underscore
  return /^[a-zA-Z0-9/.\-_]+$/.test(key);
}

// ── Presigned URL generator ─────────────────────────────────────────────────
async function generatePresignedUrl(
  key: string,
  contentType: string,
  expiresIn = 3600,
): Promise<string> {
  const host    = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const region  = 'auto';
  const service = 's3';

  // Timestamps — both derived from the same Date object to avoid any clock skew
  const now         = new Date();
  const dateStr     = now.toISOString().slice(0, 10).replace(/-/g, '');          // YYYYMMDD
  const datetimeStr = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'); // YYYYMMDDTHHmmssZ

  const credentialScope = `${dateStr}/${region}/${service}/aws4_request`;
  const credential      = `${R2_ACCESS_KEY_ID}/${credentialScope}`;

  // Canonical URI — each path segment URI-encoded, slashes preserved as separators
  const encodedKey  = key.split('/').map(s => rfc3986Encode(s)).join('/');
  const canonicalUri = `/${R2_BUCKET}/${encodedKey}`;

  // Canonical query string — must be sorted and RFC-3986 encoded
  const queryParams: Record<string, string> = {
    'X-Amz-Algorithm':     'AWS4-HMAC-SHA256',
    'X-Amz-Credential':    credential,
    'X-Amz-Date':          datetimeStr,
    'X-Amz-Expires':       String(expiresIn),
    'X-Amz-SignedHeaders': 'content-type;host',
  };
  const canonicalQueryString = buildCanonicalQueryString(queryParams);

  // Canonical headers — must be trimmed lowercase, sorted alphabetically
  // content-type MUST exactly match what the client will send in the PUT request
  const canonicalHeaders = `content-type:${contentType.trim()}\nhost:${host}\n`;

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    'content-type;host',       // Signed headers list
    'UNSIGNED-PAYLOAD',        // Payload hash — presigned URLs use this literal
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    datetimeStr,
    credentialScope,
    await sha256hex(canonicalRequest),
  ].join('\n');

  // Derive the signing key: HMAC(HMAC(HMAC(HMAC("AWS4"+secret, date), region), service), "aws4_request")
  const signingKey = await hmacSign(
    await hmacSign(
      await hmacSign(
        await hmacSign(new TextEncoder().encode(`AWS4${R2_SECRET_KEY}`), dateStr),
        region,
      ),
      service,
    ),
    'aws4_request',
  );

  const signature = toHex(await hmacSign(signingKey, stringToSign));

  return `https://${host}/${R2_BUCKET}/${encodedKey}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

// ── Edge Function handler ───────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json() as { key?: unknown; contentType?: unknown };
    const key         = typeof body.key === 'string'         ? body.key.trim()         : '';
    const contentType = typeof body.contentType === 'string' ? body.contentType.trim() : '';

    if (!key || !contentType) {
      return new Response(JSON.stringify({ error: 'key and contentType are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate key to prevent path traversal / unexpected uploads
    if (!isValidKey(key)) {
      return new Response(JSON.stringify({ error: 'Invalid key format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const uploadUrl = await generatePresignedUrl(key, contentType);
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;

    return new Response(JSON.stringify({ uploadUrl, publicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // Log full error server-side, return safe message to client
    console.error('[r2-sign] Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
