/**
 * r2-sign — Supabase Edge Function
 *
 * Generates an S3-presigned PUT URL for Cloudflare R2.
 * Called by the app before uploading a video.
 * Credentials are stored as Supabase secrets — never in the client.
 *
 * POST body: { key: string, contentType: string }
 * Response:  { uploadUrl: string, publicUrl: string }
 */

import { corsHeaders } from '../_shared/cors.ts';

const R2_ACCOUNT_ID     = Deno.env.get('R2_ACCOUNT_ID')!;
const R2_ACCESS_KEY_ID  = Deno.env.get('R2_ACCESS_KEY_ID')!;
const R2_SECRET_KEY     = Deno.env.get('R2_SECRET_ACCESS_KEY')!;
const R2_BUCKET         = Deno.env.get('R2_BUCKET_NAME') ?? 'vibes-media';
const R2_PUBLIC_URL     = Deno.env.get('R2_PUBLIC_URL')!;

// S3 Presigned URL via AWS Signature V4
async function sign(key: Uint8Array, msg: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return new Uint8Array(sig);
}

function toHex(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(msg: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return toHex(new Uint8Array(buf));
}

async function generatePresignedUrl(
  key: string,
  contentType: string,
  expiresIn = 3600,
): Promise<string> {
  const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';

  const now = new Date();
  const dateStr = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 8);
  const datetimeStr = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';

  const credentialScope = `${dateStr}/${region}/${service}/aws4_request`;
  const credential = `${R2_ACCESS_KEY_ID}/${credentialScope}`;

  const params = new URLSearchParams({
    'X-Amz-Algorithm':     'AWS4-HMAC-SHA256',
    'X-Amz-Credential':    credential,
    'X-Amz-Date':          datetimeStr,
    'X-Amz-Expires':       String(expiresIn),
    'X-Amz-SignedHeaders': 'content-type;host',
  });
  params.sort();

  const canonicalRequest = [
    'PUT',
    `/${key}`,
    params.toString(),
    `content-type:${contentType}\nhost:${host}\n`,
    'content-type;host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    datetimeStr,
    credentialScope,
    await sha256(canonicalRequest),
  ].join('\n');

  const signingKey = await sign(
    await sign(
      await sign(
        await sign(new TextEncoder().encode(`AWS4${R2_SECRET_KEY}`), dateStr),
        region,
      ),
      service,
    ),
    'aws4_request',
  );

  const signature = toHex(await sign(signingKey, stringToSign));

  return `${endpoint}/${R2_BUCKET}/${key}?${params.toString()}&X-Amz-Signature=${signature}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { key, contentType } = await req.json() as { key: string; contentType: string };

    if (!key || !contentType) {
      return new Response(JSON.stringify({ error: 'key and contentType required' }), {
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
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
