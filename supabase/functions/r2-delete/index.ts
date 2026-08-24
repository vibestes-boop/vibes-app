/**
 * Supabase Edge Function: r2-delete
 *
 * Best-effort cleanup for Cloudflare R2 objects after the owning post was
 * deleted from the database.
 *
 * ── Drei Wege hinein, mit absichtlich verschiedenen Rechten ──────────────────
 *
 *   { processQueue: true }   Der 5-Minuten-Cron. Arbeitet `r2_delete_queue` ab.
 *                            Ohne eigene Anmeldung — die Tabelle IST die
 *                            Vertrauensgrenze (RLS an, keine Policy, kein
 *                            Grant), also kann kein Client hineinschreiben.
 *
 *   { keys | urls }          Ein angemeldeter Nutzer löscht seine EIGENEN
 *                            Dateien. `assertAllowedKey` vergleicht die Kennung
 *                            im Pfad mit der aus dem JWT.
 *
 *   { prefix }               Ein ganzer Ordner. NUR Admin (Service-Role oder
 *                            `x-cleanup-secret`) und NUR `highlights/<uuid>/`.
 *
 * ⚠️ Zum Nachlesen, bevor jemand `ALLOWED_ROOTS` „vervollständigt": Der Kommentar
 * an der Konstante erklärt, warum `highlights` dort NICHT stehen darf.
 *
 * Required secrets:
 * - R2_ACCOUNT_ID
 * - R2_ACCESS_KEY_ID
 * - R2_SECRET_ACCESS_KEY
 * - R2_BUCKET_NAME
 * - R2_PUBLIC_URL
 * - R2_CLEANUP_SECRET (optional; enables admin cleanup with x-cleanup-secret)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type DeleteRequest = {
  keys?: string[];
  urls?: string[];
  prefix?: string;
  processQueue?: boolean;
  selfTest?: boolean;
  limit?: number;
};

type QueueRow = {
  id: string;
  media_url: string | null;
  thumbnail_url: string | null;
  prefix: string | null;
  attempts: number;
};

/**
 * Pfade, die der ALLGEMEINE Aufräumweg anfassen darf — der Post-Trigger, die
 * Warteschlange, der Admin-Weg.
 *
 * ⚠️ `highlights` STEHT HIER BEWUSST NICHT UND DARF NIE DAZU. Das ist kein
 * Versehen, sondern der Mechanismus, der Highlights den Story-Ablauf überleben
 * lässt: `highlight-copy-media` kopiert dorthin, GERADE WEIL dieser Aufräumer
 * den Pfad nicht erreicht. Wer `highlights` hier einträgt, baut den Fehler
 * wieder ein, gegen den die Kopie gebaut wurde — leeres Cover, kein Inhalt.
 */
const ALLOWED_ROOTS = new Set(['posts', 'thumbnails', 'avatars']);

/**
 * Pfade, die AUSSCHLIESSLICH ihrem Eigentümer gehören.
 *
 * Sie sind für den allgemeinen Weg oben weiterhin unerreichbar. Nur zwei Türen
 * führen hinein, und beide verlangen einen Nachweis:
 *   • ein angemeldeter Nutzer, der seine EIGENE Datei löscht (`assertAllowedKey`)
 *   • ein Ordner-Auftrag aus der Warteschlange, den nur `delete_own_account()`
 *     schreiben kann (RLS an, keine Policy, kein Grant → kein Client kommt ran)
 *
 * Damit bleibt die Garantie oben unangetastet: Ein versehentlich eingereihter
 * Post/Story-Datensatz kann `highlights/` nach wie vor nicht treffen.
 */
const OWNER_ONLY_ROOTS = new Set(['highlights']);

/** Ein Ordner-Auftrag ist immer `highlights/<uuid>/` — nie weniger, nie mehr. */
const PREFIX_PATTERN =
  /^highlights\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/$/;

/** Obergrenze je Ordner-Auftrag. Ein Schaufenster hat 12 Bilder, nicht 5000. */
const PREFIX_MAX_OBJECTS = 500;

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing secret: ${name}`);
  return value;
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function encodePath(path: string): string {
  return path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function yyyymmdd(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function amzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

async function hmac(key: ArrayBuffer | Uint8Array | string, data: string): Promise<ArrayBuffer> {
  const keyBytes =
    typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const rawKey =
    keyBytes instanceof Uint8Array
      ? new Uint8Array(keyBytes).buffer
      : keyBytes;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return toHex(digest);
}

async function signingKey(secret: string, date: string): Promise<ArrayBuffer> {
  const kDate = await hmac(`AWS4${secret}`, date);
  const kRegion = await hmac(kDate, 'auto');
  const kService = await hmac(kRegion, 's3');
  return hmac(kService, 'aws4_request');
}

function assertAllowedKey(key: string, userId: string): void {
  if (
    !key ||
    key.startsWith('/') ||
    key.includes('..') ||
    key.includes('\\') ||
    key.length > 512
  ) {
    throw new Error('Invalid object key.');
  }

  const parts = key.split('/');
  const [root, maybeTypeOrUser, maybeUser] = parts;
  // ⚠️ `OWNER_ONLY_ROOTS` ist hier UND NUR hier zusätzlich erlaubt: Dieser Weg
  // verlangt ein Nutzer-JWT und vergleicht gleich darunter die Kennung im Pfad.
  // Der Admin-Weg und die Warteschlange benutzen `assertAllowedRoot` und kommen
  // damit weiterhin nicht an `highlights/` heran.
  if (!ALLOWED_ROOTS.has(root) && !OWNER_ONLY_ROOTS.has(root)) {
    throw new Error('Object path is not allowed.');
  }

  const ownerId =
    root === 'posts'
      ? maybeUser
      : maybeTypeOrUser;

  if (ownerId !== userId) throw new Error('Object path does not match the current user.');
}

/**
 * Ein Ordner-Auftrag. Streng, weil ein zu weiter Präfix nicht auffällt, sondern
 * still fremde Dateien mitnimmt: `highlights/` allein wäre der Ordner ALLER
 * Nutzer, und ein leerer Präfix der ganze Eimer.
 *
 * Dieselbe Form steht als CHECK-Constraint auf `r2_delete_queue.prefix`
 * (`20260824120000`) — zwei Schlösser an derselben Tür.
 */
function assertAllowedPrefix(prefix: string): void {
  if (!prefix || prefix.includes('..') || prefix.includes('\\') || prefix.length > 256) {
    throw new Error('Invalid prefix.');
  }
  if (!PREFIX_PATTERN.test(prefix)) {
    throw new Error('Prefix is not allowed. Expected `highlights/<uuid>/`.');
  }
}

function assertAllowedRoot(key: string): void {
  if (
    !key ||
    key.startsWith('/') ||
    key.includes('..') ||
    key.includes('\\') ||
    key.length > 512
  ) {
    throw new Error('Invalid object key.');
  }

  const [root] = key.split('/');
  if (!ALLOWED_ROOTS.has(root)) throw new Error('Object path is not allowed.');
}

function keyFromUrl(url: string): string | null {
  const publicBaseUrl = env('R2_PUBLIC_URL').replace(/\/+$/, '');
  if (!url.startsWith(`${publicBaseUrl}/`)) return null;
  return decodeURIComponent(url.slice(publicBaseUrl.length + 1));
}

async function getUserId(req: Request): Promise<string> {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('Missing authorization header.');
  }

  const supabaseUrl = env('SUPABASE_URL');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const userJwt = authHeader.slice(7).trim();

  const authResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${userJwt}`,
      'apikey': serviceRoleKey,
    },
  });

  if (!authResp.ok) throw new Error('Unauthorized.');
  const authData = await authResp.json();
  const userId = authData?.id;
  if (typeof userId !== 'string' || !userId) throw new Error('Unauthorized.');
  return userId;
}

function isAdminCleanup(req: Request): boolean {
  const cleanupSecret = Deno.env.get('R2_CLEANUP_SECRET');
  if (cleanupSecret && req.headers.get('x-cleanup-secret') === cleanupSecret) {
    return true;
  }

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authHeader = req.headers.get('authorization') ?? '';
  return !!serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`;
}

function serviceHeaders(): HeadersInit {
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
  return {
    'Authorization': `Bearer ${serviceRoleKey}`,
    'apikey': serviceRoleKey,
    'Content-Type': 'application/json',
  };
}

async function updateQueueRow(
  id: string,
  body: Record<string, unknown>,
): Promise<void> {
  const supabaseUrl = env('SUPABASE_URL');
  const response = await fetch(`${supabaseUrl}/rest/v1/r2_delete_queue?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      ...serviceHeaders(),
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Queue update failed (${response.status}): ${text.substring(0, 200)}`);
  }
}

async function restRequest(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const supabaseUrl = env('SUPABASE_URL');
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...serviceHeaders(),
      ...(init.headers ?? {}),
    },
  });
}

async function deleteObject(key: string): Promise<void> {
  const accountId = env('R2_ACCOUNT_ID');
  const accessKeyId = env('R2_ACCESS_KEY_ID');
  const secretAccessKey = env('R2_SECRET_ACCESS_KEY');
  const bucket = env('R2_BUCKET_NAME');

  const now = new Date();
  const date = yyyymmdd(now);
  const timestamp = amzDate(now);
  const credentialScope = `${date}/auto/s3/aws4_request`;
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${bucket}/${encodePath(key)}`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${timestamp}\n`;

  const canonicalRequest = [
    'DELETE',
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    timestamp,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const signing = await signingKey(secretAccessKey, date);
  const signature = toHex(await hmac(signing, stringToSign));
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`https://${host}${canonicalUri}`, {
    method: 'DELETE',
    headers: {
      'Authorization': authorization,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': timestamp,
    },
  });

  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => '');
    throw new Error(`R2 delete failed (${response.status}): ${text.substring(0, 200)}`);
  }
}

/**
 * RFC-3986-Kodierung für die Signatur-Abfragezeichenkette.
 *
 * ⚠️ `encodeURIComponent` lässt `!'()*` stehen. AWS/R2 rechnen sie beim Prüfen
 * der Signatur aber kodiert — ein Präfix mit einer dieser Zeichen ergäbe sonst
 * `SignatureDoesNotMatch`. Bei UUID-Ordnern kommt das nie vor; die Funktion
 * bleibt trotzdem korrekt, damit sie es auch bei der nächsten Verwendung ist.
 */
function encodeQueryComponent(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * ListObjectsV2 — eine Seite. Gibt die Schlüssel und, falls es weitergeht, das
 * Fortsetzungs-Merkmal zurück.
 */
async function listObjectsPage(
  prefix: string,
  continuationToken: string | null,
): Promise<{ keys: string[]; nextToken: string | null }> {
  const accountId = env('R2_ACCOUNT_ID');
  const accessKeyId = env('R2_ACCESS_KEY_ID');
  const secretAccessKey = env('R2_SECRET_ACCESS_KEY');
  const bucket = env('R2_BUCKET_NAME');

  const now = new Date();
  const date = yyyymmdd(now);
  const timestamp = amzDate(now);
  const credentialScope = `${date}/auto/s3/aws4_request`;
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${bucket}`;
  const payloadHash = 'UNSIGNED-PAYLOAD';
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

  // ⚠️ SigV4 verlangt die Parameter nach Namen SORTIERT. Die Reihenfolge hier
  // ist alphabetisch (continuation-token < list-type < max-keys < prefix) und
  // muss es bleiben.
  const params: Array<[string, string]> = [];
  if (continuationToken) params.push(['continuation-token', continuationToken]);
  params.push(['list-type', '2']);
  params.push(['max-keys', '1000']);
  params.push(['prefix', prefix]);
  const canonicalQuery = params
    .map(([k, v]) => `${encodeQueryComponent(k)}=${encodeQueryComponent(v)}`)
    .join('&');

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${timestamp}\n`;

  const canonicalRequest = [
    'GET',
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    timestamp,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const signing = await signingKey(secretAccessKey, date);
  const signature = toHex(await hmac(signing, stringToSign));
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`https://${host}${canonicalUri}?${canonicalQuery}`, {
    method: 'GET',
    headers: {
      'Authorization': authorization,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': timestamp,
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`R2 list failed (${response.status}): ${text.substring(0, 200)}`);
  }

  const xml = await response.text();
  // Nur die <Key> aus <Contents> — <Prefix> und <NextContinuationToken> tragen
  // eigene Namen und geraten damit nicht in die Liste.
  const keys = [...xml.matchAll(/<Contents>[\s\S]*?<Key>([\s\S]*?)<\/Key>/g)]
    .map((m) => decodeXmlEntities(m[1]));

  const truncated = /<IsTruncated>\s*true\s*<\/IsTruncated>/i.test(xml);
  const tokenMatch = xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/);
  const nextToken = truncated && tokenMatch ? decodeXmlEntities(tokenMatch[1]) : null;

  return { keys, nextToken };
}

/**
 * Einen ganzen Ordner leeren.
 *
 * ⚠️ Bewusst `ListObjectsV2` + einzelne DELETE statt `DeleteObjects`. Der
 * Sammel-Aufruf verlangt ein `Content-MD5` über den XML-Rumpf, und MD5 gibt es
 * in `crypto.subtle` nicht — es käme eine fremde Bibliothek dazu, für einen
 * Ordner mit typischerweise unter einem Dutzend Dateien. Nicht wert.
 *
 * Jeder Schlüssel läuft nochmal durch `assertAllowedPrefix`-Logik: Was R2
 * auflistet, muss auch wirklich unter dem angefragten Ordner liegen.
 */
async function deletePrefix(prefix: string): Promise<number> {
  assertAllowedPrefix(prefix);

  let token: string | null = null;
  let deleted = 0;

  do {
    const page: { keys: string[]; nextToken: string | null } =
      await listObjectsPage(prefix, token);

    const keys = page.keys.filter((key) => key.startsWith(prefix));
    if (keys.length !== page.keys.length) {
      throw new Error('R2 returned an object outside the requested prefix.');
    }

    if (deleted + keys.length > PREFIX_MAX_OBJECTS) {
      throw new Error(
        `Prefix holds more than ${PREFIX_MAX_OBJECTS} objects; refusing to sweep.`,
      );
    }

    await Promise.all(keys.map(deleteObject));
    deleted += keys.length;
    token = page.nextToken;
  } while (token);

  return deleted;
}

async function processDeleteQueue(limit: number): Promise<{
  processed: number;
  deleted: number;
  failed: number;
}> {
  const supabaseUrl = env('SUPABASE_URL');
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 20, 1), 100);
  const queueUrl =
    `${supabaseUrl}/rest/v1/r2_delete_queue?` +
    `status=eq.pending&select=id,media_url,thumbnail_url,prefix,attempts&order=created_at.asc&limit=${safeLimit}`;

  const response = await fetch(queueUrl, { headers: serviceHeaders() });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Queue fetch failed (${response.status}): ${text.substring(0, 200)}`);
  }

  const rows = await response.json() as QueueRow[];
  let deleted = 0;
  let failed = 0;

  for (const row of rows) {
    const keys = Array.from(
      new Set(
        [row.media_url, row.thumbnail_url]
          .map((url) => (url ? keyFromUrl(url) : null))
          .filter((key): key is string => !!key),
      ),
    );

    try {
      let removed: number;

      if (row.prefix) {
        // Ordner-Auftrag. Er kann nur aus `delete_own_account()` stammen — die
        // Tabelle hat RLS an, keine Policy und keinen Grant, also schreibt kein
        // Client hinein. `deletePrefix` prüft die Form trotzdem noch einmal.
        removed = await deletePrefix(row.prefix);
      } else {
        // ⚠️ `assertAllowedRoot` und NICHT `assertAllowedKey`: Der allgemeine
        // Weg bleibt auf posts/thumbnails/avatars beschränkt. Eine versehentlich
        // eingereihte `highlights/`-Adresse fällt hier durch — genau so soll es
        // sein (siehe Kommentar an `ALLOWED_ROOTS`).
        for (const key of keys) assertAllowedRoot(key);
        await Promise.all(keys.map(deleteObject));
        removed = keys.length;
      }

      await updateQueueRow(row.id, {
        status: 'deleted',
        attempts: row.attempts + 1,
        last_error: null,
        processed_at: new Date().toISOString(),
      });
      deleted += removed;
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      await updateQueueRow(row.id, {
        status: 'error',
        attempts: row.attempts + 1,
        last_error: message.substring(0, 500),
        processed_at: new Date().toISOString(),
      });
    }
  }

  return { processed: rows.length, deleted, failed };
}

async function runSelfTest(): Promise<{
  postDeleted: boolean;
  queueRows: number;
  queueProcessed: number;
  queueFailed: number;
}> {
  const authorResponse = await restRequest('profiles?select=id&limit=1');
  if (!authorResponse.ok) {
    const text = await authorResponse.text().catch(() => '');
    throw new Error(`Self-test author fetch failed (${authorResponse.status}): ${text.substring(0, 200)}`);
  }

  const authors = await authorResponse.json() as Array<{ id: string }>;
  const authorId = authors[0]?.id;
  if (!authorId) throw new Error('Self-test needs at least one profile.');

  const testId = crypto.randomUUID();
  const publicBaseUrl = env('R2_PUBLIC_URL').replace(/\/+$/, '');
  const mediaUrl = `${publicBaseUrl}/posts/images/${authorId}/self-test-${testId}.webp`;

  const postResponse = await restRequest('posts', {
    method: 'POST',
    headers: { 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      id: testId,
      author_id: authorId,
      caption: 'r2 cleanup self-test',
      media_url: mediaUrl,
      thumbnail_url: mediaUrl,
      media_type: 'image',
    }),
  });
  if (!postResponse.ok) {
    const text = await postResponse.text().catch(() => '');
    throw new Error(`Self-test post insert failed (${postResponse.status}): ${text.substring(0, 200)}`);
  }

  const deleteResponse = await restRequest(`posts?id=eq.${testId}`, {
    method: 'DELETE',
    headers: { 'Prefer': 'return=minimal' },
  });
  if (!deleteResponse.ok) {
    const text = await deleteResponse.text().catch(() => '');
    await restRequest(`posts?id=eq.${testId}`, { method: 'DELETE' });
    throw new Error(`Self-test post delete failed (${deleteResponse.status}): ${text.substring(0, 200)}`);
  }

  const queueResponse = await restRequest(
    `r2_delete_queue?post_id=eq.${testId}&select=id,status`,
  );
  if (!queueResponse.ok) {
    const text = await queueResponse.text().catch(() => '');
    throw new Error(`Self-test queue fetch failed (${queueResponse.status}): ${text.substring(0, 200)}`);
  }

  const rows = await queueResponse.json() as Array<{ id: string; status: string }>;
  const result = await processDeleteQueue(10);

  return {
    postDeleted: true,
    queueRows: rows.length,
    queueProcessed: result.processed,
    queueFailed: result.failed,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    const body = await req.json() as DeleteRequest;

    if (body.processQueue) {
      const result = await processDeleteQueue(body.limit ?? 20);
      return new Response(
        JSON.stringify({ ok: true, ...result }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const adminCleanup = isAdminCleanup(req);
    if (body.selfTest) {
      if (!adminCleanup) throw new Error('Unauthorized.');
      const result = await runSelfTest();
      return new Response(
        JSON.stringify({ ok: true, ...result }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Ordner-Auftrag von Hand ──────────────────────────────────────────────
    //
    // Nur für den Admin-Weg (Service-Role-Schlüssel oder `x-cleanup-secret`).
    // Der REGELFALL läuft über die Warteschlange — dieser Zweig ist für das
    // Nachräumen von Hand da, etwa der beiden Dateien, die beim Prüfen der
    // Highlights am 24.08.2026 verwaist liegen geblieben sind.
    //
    // ⚠️ Ein angemeldeter Nutzer bekommt das NICHT. Er löscht seine eigenen
    // Dateien einzeln über `keys`/`urls`; dort vergleicht `assertAllowedKey` die
    // Kennung im Pfad mit seiner eigenen. Ein Ordner-Auftrag pro Nutzer wäre
    // bequemer und würde bei der ersten Unachtsamkeit in der Pfad-Prüfung zum
    // Werkzeug, mit dem man fremde Ordner leert.
    if (body.prefix) {
      if (!adminCleanup) throw new Error('Unauthorized.');
      const removed = await deletePrefix(body.prefix);
      return new Response(
        JSON.stringify({ ok: true, deleted: removed, prefix: body.prefix }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const userId = adminCleanup ? null : await getUserId(req);
    const keysFromUrls = (body.urls ?? [])
      .map(keyFromUrl)
      .filter((key): key is string => !!key);
    const keys = Array.from(new Set([...(body.keys ?? []), ...keysFromUrls]));

    for (const key of keys) {
      if (adminCleanup) {
        assertAllowedRoot(key);
      } else {
        assertAllowedKey(key, userId!);
      }
    }
    await Promise.all(keys.map(deleteObject));

    return new Response(
      JSON.stringify({ ok: true, deleted: keys.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message === 'Unauthorized.' || message === 'Missing authorization header.'
      ? 401
      : 400;
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
