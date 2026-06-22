/**
 * Supabase Edge Function: highlight-copy-media
 *
 * Macht Highlights dauerhaft: kopiert die referenzierten Story/Post-Medien per
 * S3 CopyObject auf einen permanenten R2-Pfad `highlights/{userId}/…`, den der
 * R2-Cleanup-Cron NIE anfasst (ALLOWED_ROOTS = posts/thumbnails/avatars).
 *
 * Hintergrund: Ein Highlight speicherte bisher nur die `media_url` der Story.
 * Läuft die Story ab → wird die Story-Row gelöscht → Trigger enqueued die
 * R2-Datei → Cleanup löscht sie → Highlight zeigte auf tote URL (leeres Cover,
 * kein Inhalt). Durch die Kopie überlebt das Highlight den Story-Ablauf.
 *
 * Benötigte Secrets (dieselben wie r2-delete/r2-sign):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET_NAME, R2_PUBLIC_URL + SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Body:  { items: [{ media_url, media_type, thumbnail_url? }] }
 * Reply: { items: [{ media_url, media_type, thumbnail_url }] }  (permanente URLs)
 *
 * Best-effort: Schlägt eine Kopie fehl (oder ist die URL keine R2-URL), bleibt
 * die Original-URL erhalten — die Highlight-Erstellung wird nie blockiert.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing secret: ${name}`);
  return v;
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function encodePath(path: string): string {
  return path.split('/').map((p) => encodeURIComponent(p)).join('/');
}
function yyyymmdd(d: Date): string { return d.toISOString().slice(0, 10).replace(/-/g, ''); }
function amzDate(d: Date): string { return d.toISOString().replace(/[:-]|\.\d{3}/g, ''); }

async function hmac(key: ArrayBuffer | Uint8Array | string, data: string): Promise<ArrayBuffer> {
  const keyBytes = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const rawKey = keyBytes instanceof Uint8Array ? new Uint8Array(keyBytes).buffer : keyBytes;
  const cryptoKey = await crypto.subtle.importKey('raw', rawKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}
async function sha256Hex(input: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)));
}
async function signingKey(secret: string, date: string): Promise<ArrayBuffer> {
  const kDate = await hmac(`AWS4${secret}`, date);
  const kRegion = await hmac(kDate, 'auto');
  const kService = await hmac(kRegion, 's3');
  return hmac(kService, 'aws4_request');
}

/** Extrahiert den R2-Object-Key aus einer öffentlichen URL — oder null, wenn keine R2-URL. */
function keyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const base = env('R2_PUBLIC_URL').replace(/\/+$/, '');
  if (!url.startsWith(`${base}/`)) return null;
  const key = decodeURIComponent(url.slice(base.length + 1));
  if (!key || key.startsWith('/') || key.includes('..') || key.includes('\\') || key.length > 512) return null;
  return key;
}

async function getUserId(req: Request): Promise<string> {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) throw new Error('Missing authorization header.');
  const supabaseUrl = env('SUPABASE_URL');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { 'Authorization': authHeader, 'apikey': serviceRoleKey },
  });
  if (!resp.ok) throw new Error('Unauthorized.');
  const data = await resp.json();
  const userId = data?.id;
  if (typeof userId !== 'string' || !userId) throw new Error('Unauthorized.');
  return userId;
}

/** S3 CopyObject: kopiert {bucket}/{srcKey} → {bucket}/{destKey} (SigV4-signiert). */
async function copyObject(srcKey: string, destKey: string): Promise<void> {
  const accountId = env('R2_ACCOUNT_ID');
  const accessKeyId = env('R2_ACCESS_KEY_ID');
  const secretAccessKey = env('R2_SECRET_ACCESS_KEY');
  const bucket = env('R2_BUCKET_NAME');

  const now = new Date();
  const date = yyyymmdd(now);
  const timestamp = amzDate(now);
  const credentialScope = `${date}/auto/s3/aws4_request`;
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${bucket}/${encodePath(destKey)}`;
  const copySource = `/${bucket}/${encodePath(srcKey)}`;
  const payloadHash = 'UNSIGNED-PAYLOAD';
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-copy-source;x-amz-date';

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-copy-source:${copySource}\n` +
    `x-amz-date:${timestamp}\n`;

  const canonicalRequest = ['PUT', canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', timestamp, credentialScope, await sha256Hex(canonicalRequest)].join('\n');
  const signing = await signingKey(secretAccessKey, date);
  const signature = toHex(await hmac(signing, stringToSign));
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`https://${host}${canonicalUri}`, {
    method: 'PUT',
    headers: {
      'Authorization': authorization,
      'x-amz-content-sha256': payloadHash,
      'x-amz-copy-source': copySource,
      'x-amz-date': timestamp,
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`R2 copy failed (${response.status}): ${text.substring(0, 200)}`);
  }
}

function extOf(key: string): string {
  const dot = key.lastIndexOf('.');
  const slash = key.lastIndexOf('/');
  if (dot > slash && dot < key.length - 1) {
    const ext = key.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (ext.length <= 5) return ext;
  }
  return 'bin';
}

type Item = { media_url: string; media_type: 'image' | 'video'; thumbnail_url?: string | null };

/** Kopiert eine einzelne R2-URL nach highlights/{userId}/… → neue URL (oder Original bei Fehler/Nicht-R2). */
async function copyToHighlights(url: string | null | undefined, userId: string, base: string, suffix: string): Promise<string | null> {
  if (!url) return url ?? null;
  const srcKey = keyFromUrl(url);
  if (!srcKey) return url; // externe / bereits permanente URL → unverändert lassen
  if (srcKey.startsWith('highlights/')) return url; // schon kopiert
  const destKey = `highlights/${userId}/${crypto.randomUUID()}${suffix}.${extOf(srcKey)}`;
  try {
    await copyObject(srcKey, destKey);
    return `${base}/${encodePath(destKey)}`;
  } catch (_e) {
    return url; // best-effort: Original behalten
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const userId = await getUserId(req);
    const base = env('R2_PUBLIC_URL').replace(/\/+$/, '');
    const { items } = await req.json() as { items: Item[] };
    if (!Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'items fehlen' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const out: Item[] = [];
    for (const it of items) {
      const newMedia = (await copyToHighlights(it.media_url, userId, base, '')) ?? it.media_url;
      // Thumbnail: wenn identisch mit media_url → kopierte media_url wiederverwenden, sonst separat kopieren
      let newThumb: string | null = it.thumbnail_url ?? null;
      if (it.thumbnail_url) {
        newThumb = it.thumbnail_url === it.media_url
          ? newMedia
          : (await copyToHighlights(it.thumbnail_url, userId, base, '_t')) ?? it.thumbnail_url;
      }
      out.push({ media_url: newMedia, media_type: it.media_type, thumbnail_url: newThumb });
    }

    return new Response(JSON.stringify({ items: out }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
