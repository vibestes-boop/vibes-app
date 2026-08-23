/**
 * r2-sign — Supabase Edge Function
 *
 * Generates an S3-presigned PUT URL for Cloudflare R2.
 * Called by the app before uploading media (images, videos, avatars).
 * Credentials are stored as Supabase secrets — never exposed to the client.
 * Requires a valid Supabase user JWT. The requested object key must live inside
 * the caller's own user folder.
 *
 * POST body: { key, contentType, cacheControl?, contentLength? }
 * Response:  { uploadUrl, publicUrl, uploadHeaders }
 *
 * ⚠️ Die Identität wird GEPRÜFT, nicht gelesen (seit 23.08.2026, siehe
 * `_shared/auth.ts`). Wer hier etwas ändert, darf nicht zum bequemen
 * Weg zurück — den `sub`-Anspruch eines JWT ungeprüft zu übernehmen gibt
 * Schreibrecht im Ordner eines fremden Nutzers.
 *
 * Hardening (Defense-in-Depth, zusätzlich zu Auth + Owner-Key-Check):
 *   • Content-Type/Extension-Denylist gegen aktive Inhalte (SVG/HTML/XML/JS),
 *     die R2 von der pub-*.r2.dev-Origin als ausführbares Dokument ausliefern
 *     würde → Stored-XSS. Bild-Prefixes erzwingen image/*.
 *   • contentLength (optional): serverseitige Größen-Guardrail pro Kategorie.
 *     Deklarativ — voll kryptografisch erzwingbar via signiertem Content-Length
 *     (unsere Clients senden fixe-Länge-Bodies, daher safe) ODER Pflichtfeld,
 *     sobald alte App-Versionen (< 1.26.9, ohne contentLength) ausgelaufen sind.
 *
 * AWS Signature V4 spec:
 *   https://docs.aws.amazon.com/general/latest/gr/sigv4-create-canonical-request.html
 */

// @ts-ignore — Deno runtime globals are available in Supabase Edge Functions
/// <reference types="https://deno.land/x/types/index.d.ts" />

import { corsHeaders } from '../_shared/cors.ts';
import { getVerifiedUserId } from '../_shared/auth.ts';

const R2_ACCOUNT_ID    = Deno.env.get('R2_ACCOUNT_ID')!;
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID')!;
const R2_SECRET_KEY    = Deno.env.get('R2_SECRET_ACCESS_KEY')!;
const R2_BUCKET        = Deno.env.get('R2_BUCKET_NAME') ?? 'vibes-media';
const R2_PUBLIC_URL    = Deno.env.get('R2_PUBLIC_URL')!;

const ALLOWED_OWNED_PREFIXES = [
  'posts/videos',
  'posts/images',
  'products/images',
  'thumbnails',
  'avatars',
  'voice-samples',
] as const;

// Prefixes deren Objekte als Bild eingebettet/angezeigt werden — hier MUSS der
// Content-Type ein Bild sein (kein Video/Audio/sonstwas).
const IMAGE_ONLY_PREFIXES = ['posts/images', 'products/images', 'thumbnails', 'avatars'] as const;

// Aktive Inhalte, die der Browser beim direkten Aufruf der R2-URL als
// ausführbares Dokument rendert (Stored-XSS-Vektor auf der r2.dev-Origin).
// Denylist statt Allowlist, weil Audio/Video viele legitime MIME-Varianten
// haben (z.B. `audio/webm;codecs=opus`) — die aktive-Content-Menge ist
// dagegen klein und bekannt.
const DANGEROUS_CONTENT_TYPES = [
  'image/svg+xml',
  'text/html',
  'application/xhtml+xml',
  'text/xml',
  'application/xml',
  'application/javascript',
  'text/javascript',
  'application/x-php',
  'text/x-php',
];
const DANGEROUS_EXTENSIONS = [
  'svg', 'svgz', 'html', 'htm', 'xhtml', 'xml', 'js', 'mjs',
  'php', 'phtml', 'php5', 'phar', 'jsp', 'asp', 'aspx', 'htaccess',
];

// Datei-Größen-Obergrenzen pro Kategorie (serverseitige Guardrail).
const MAX_BYTES_VIDEO = 200 * 1024 * 1024; // 200 MB
const MAX_BYTES_AUDIO = 30 * 1024 * 1024;  // 30 MB
const MAX_BYTES_IMAGE = 50 * 1024 * 1024;  // 50 MB

function maxBytesForKey(key: string): number {
  if (key.startsWith('posts/videos/')) return MAX_BYTES_VIDEO;
  if (key.startsWith('voice-samples/')) return MAX_BYTES_AUDIO;
  return MAX_BYTES_IMAGE;
}

// Content-Type ohne Parameter (`audio/webm;codecs=opus` → `audio/webm`).
function baseContentType(ct: string): string {
  return ct.split(';')[0].trim().toLowerCase();
}

function keyExtension(key: string): string {
  const dot = key.lastIndexOf('.');
  return dot >= 0 ? key.slice(dot + 1).toLowerCase() : '';
}

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

// Identität: geprüft, nicht gelesen — die Begründung steht in `_shared/auth.ts`.
// Kurz: Der `sub`-Anspruch eines JWT ist ohne Signaturprüfung frei erfundener
// Text, und dieselbe Abkürzung stand hier UND in `bunny-ingest`.

function isOwnedUploadKey(key: string, userId: string): boolean {
  return ALLOWED_OWNED_PREFIXES.some((prefix) => key.startsWith(`${prefix}/${userId}/`));
}

// ── Presigned URL generator ─────────────────────────────────────────────────
async function generatePresignedUrl(
  key: string,
  contentType: string,
  cacheControl?: string,
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

  // Keep the presigned URL tolerant of platform header normalization.
  // React Native/iOS can subtly rewrite Content-Type during binary PUTs, and
  // signing that header causes SignatureDoesNotMatch even when the user is
  // allowed to upload to this key. The auth/key checks above enforce ownership;
  // the content headers are returned as guidance but not part of the signature.
  const signedHeaders = 'host';

  // Canonical query string — must be sorted and RFC-3986 encoded
  const queryParams: Record<string, string> = {
    'X-Amz-Algorithm':     'AWS4-HMAC-SHA256',
    'X-Amz-Credential':    credential,
    'X-Amz-Date':          datetimeStr,
    'X-Amz-Expires':       String(expiresIn),
    'X-Amz-SignedHeaders': signedHeaders,
  };
  const canonicalQueryString = buildCanonicalQueryString(queryParams);

  // Canonical headers — must be trimmed lowercase, sorted alphabetically.
  const canonicalHeaders = `host:${host}\n`;

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,             // Signed headers list
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
    const userId = await getVerifiedUserId(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json() as {
      key?: unknown;
      contentType?: unknown;
      cacheControl?: unknown;
      contentLength?: unknown;
    };
    const key         = typeof body.key === 'string'         ? body.key.trim()         : '';
    const contentType = typeof body.contentType === 'string' ? body.contentType.trim() : '';
    const cacheControl =
      typeof body.cacheControl === 'string' ? body.cacheControl.trim() : undefined;

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

    if (!isOwnedUploadKey(key, userId)) {
      return new Response(JSON.stringify({ error: 'Forbidden upload key' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── A) Content-Type / Extension Hardening (Defense-in-Depth gegen
    //       Stored-XSS via SVG/HTML, die R2 von der pub-*.r2.dev-Origin
    //       als aktives Dokument ausliefern würde) ────────────────────────────
    const baseCt = baseContentType(contentType);
    const ext    = keyExtension(key);

    if (DANGEROUS_CONTENT_TYPES.includes(baseCt) || DANGEROUS_EXTENSIONS.includes(ext)) {
      return new Response(JSON.stringify({ error: 'Disallowed content type' }), {
        status: 415,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Bild-Prefixes (Avatar/Post-Bild/Produkt-Bild/Thumbnail) dürfen NUR Bilder
    // sein — schließt aus, dass z.B. ein Avatar als text/* oder application/*
    // hochgeladen wird.
    const isImagePrefix = IMAGE_ONLY_PREFIXES.some((p) => key.startsWith(`${p}/`));
    if (isImagePrefix && !baseCt.startsWith('image/')) {
      return new Response(JSON.stringify({ error: 'Image content type required' }), {
        status: 415,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── B) Größen-Guardrail: wenn der Client die Datei-Größe deklariert,
    //       gegen die Kategorie-Obergrenze prüfen. Optional, damit bereits
    //       ausgelieferte App-Versionen (ohne contentLength) weiter funktionieren.
    //       Hinweis: rein deklarativ — kryptografische Erzwingung via signiertem
    //       Content-Length ist der dokumentierte Folgeschritt (siehe Kopf-Doku).
    let contentLength: number | undefined;
    if (body.contentLength !== undefined && body.contentLength !== null) {
      const n = Number(body.contentLength);
      if (!Number.isInteger(n) || n <= 0) {
        return new Response(JSON.stringify({ error: 'Invalid contentLength' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (n > maxBytesForKey(key)) {
        return new Response(JSON.stringify({ error: 'File too large' }), {
          status: 413,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      contentLength = n;
    }

    if (cacheControl && (cacheControl.length > 255 || /[\r\n]/.test(cacheControl))) {
      return new Response(JSON.stringify({ error: 'Invalid cacheControl' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const uploadUrl = await generatePresignedUrl(key, contentType, cacheControl);
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;
    const uploadHeaders: Record<string, string> = { 'Content-Type': contentType };
    if (cacheControl) uploadHeaders['Cache-Control'] = cacheControl;

    return new Response(JSON.stringify({ uploadUrl, publicUrl, uploadHeaders }), {
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
