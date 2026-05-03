import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ENV_FILES = ['.env', '.env.local', 'apps/web/.env.local'];
const REGION = 'auto';
const SERVICE = 's3';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CACHE_CONTROL = 'public, max-age=31536000, immutable';

process.on('uncaughtException', (error) => {
  console.error(`R2 cache-control fix failed: ${formatError(error)}`);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error(`R2 cache-control fix failed: ${formatError(error)}`);
  process.exit(1);
});

for (const file of ENV_FILES) loadEnvFile(path.join(REPO_ROOT, file));

const args = parseArgs(process.argv.slice(2));
const dryRun = !args.apply;
const limit = readPositiveInt(args.limit, 50);
const scanLimit = readPositiveInt(args.scanLimit, Math.max(limit * 4, 200));

const env = {
  supabaseUrl: readOptionalEnv('NEXT_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL'),
  serviceRoleKey: readOptionalEnv('SUPABASE_SERVICE_ROLE_KEY'),
  anonKey: readOptionalEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'),
  r2AccountId: readOptionalEnv('CF_R2_ACCOUNT_ID', 'R2_ACCOUNT_ID'),
  r2AccessKeyId: readOptionalEnv('CF_R2_ACCESS_KEY_ID', 'R2_ACCESS_KEY_ID'),
  r2SecretAccessKey: readOptionalEnv('CF_R2_SECRET_ACCESS_KEY', 'R2_SECRET_ACCESS_KEY'),
  r2Bucket: readOptionalEnv('CF_R2_BUCKET', 'R2_BUCKET_NAME'),
  r2PublicUrl: normalizePublicBase(readOptionalEnv('CF_R2_PUBLIC_URL', 'R2_PUBLIC_URL')),
  cacheControl: readOptionalEnv('R2_MEDIA_CACHE_CONTROL') || DEFAULT_CACHE_CONTROL,
};

if (args.help) {
  printHelp();
  process.exit(0);
}

assertCoreEnv();
if (!dryRun) assertApplyEnv();

const supabaseKey = env.serviceRoleKey || env.anonKey;
const supabase = createClient(env.supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const candidates = await loadCandidateObjects();

if (candidates.length === 0) {
  console.log('No R2 media objects need cache-control repair.');
  process.exit(0);
}

console.log(
  `R2 cache-control repair: ${dryRun ? 'dry-run' : 'apply'} mode, ` +
    `${candidates.length} object(s), limit ${limit}, scanned ${scanLimit}.`,
);

let processed = 0;
let skipped = 0;
let failed = 0;

for (const object of candidates) {
  console.log(`\nOBJECT ${object.key}`);
  console.log(`  url:   ${stripQuery(object.url)}`);
  console.log(`  type:  ${object.contentType || '(unknown)'}`);
  console.log(`  bytes: ${object.contentLength || '(unknown)'}`);

  if (dryRun) {
    processed += 1;
    continue;
  }

  try {
    await copyObjectToSelf(object.key, {
      'cache-control': env.cacheControl,
      'content-type': object.contentType || contentTypeForKey(object.key),
    });
    processed += 1;
    console.log('  status: updated');
  } catch (error) {
    failed += 1;
    console.error(`  status: failed: ${formatError(error)}`);
  }
}

console.log(
  `\nSummary: processed ${processed}, skipped ${skipped}, failed ${failed}, mode ${dryRun ? 'dry-run' : 'apply'}.`,
);

if (failed > 0) process.exit(1);

async function loadCandidateObjects() {
  const { data, error } = await supabase
    .from('posts')
    .select('id, media_url, thumbnail_url, created_at')
    .order('created_at', { ascending: false })
    .limit(scanLimit);

  if (error) throw new Error(`Supabase posts query failed: ${error.message}`);

  const seen = new Set();
  const urls = [];
  for (const post of data ?? []) {
    for (const url of [post.thumbnail_url, post.media_url]) {
      const key = decodeR2KeyFromPublicUrl(url);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      urls.push({ key, url });
    }
  }

  const candidates = [];
  for (const item of urls) {
    if (candidates.length >= limit) break;
    const head = await headPublicObject(item.url);
    if (!head.ok) continue;
    if (hasStrongCacheControl(head.cacheControl)) continue;
    candidates.push({ ...item, ...head });
  }

  return candidates;
}

async function headPublicObject(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok) return { ok: false };
    return {
      ok: true,
      cacheControl: response.headers.get('cache-control'),
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
    };
  } catch {
    return { ok: false };
  }
}

function hasStrongCacheControl(value) {
  if (!value) return false;
  const lower = value.toLowerCase();
  return lower.includes('max-age=31536000') && lower.includes('immutable');
}

async function copyObjectToSelf(key, extraHeaders) {
  const host = `${env.r2AccountId}.r2.cloudflarestorage.com`;
  const encodedKey = key.split('/').map(rfc3986).join('/');
  const url = `https://${host}/${env.r2Bucket}/${encodedKey}`;
  const copySource = `/${env.r2Bucket}/${encodedKey}`;
  const response = await signedFetch('PUT', url, Buffer.alloc(0), {
    ...extraHeaders,
    'x-amz-copy-source': copySource,
    'x-amz-metadata-directive': 'REPLACE',
  }, host);

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`R2 CopyObject failed: ${response.status} ${redact(text)}`);
  }
}

function decodeR2KeyFromPublicUrl(value) {
  const url = safeUrl(value);
  if (!url) return null;
  if (env.r2PublicUrl && !url.toString().startsWith(env.r2PublicUrl)) return null;
  return decodeR2Key(url.pathname);
}

function decodeR2Key(pathname) {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const knownPrefixIndex = parts.findIndex((part, index) => {
    const next = parts[index + 1];
    return (
      (part === 'posts' && (next === 'images' || next === 'videos')) ||
      part === 'thumbnails' ||
      part === 'avatars' ||
      part === 'voice-samples'
    );
  });
  if (knownPrefixIndex < 0) return null;
  return parts.slice(knownPrefixIndex).join('/');
}

async function signedFetch(method, url, body = Buffer.alloc(0), extraHeaders = {}, host) {
  const target = new URL(url);
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const payloadHash = sha256Hex(payload);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const dateStamp = amzDate.slice(0, 8);

  const headers = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...lowercaseHeaders(extraHeaders),
  };
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((name) => `${name}:${String(headers[name]).trim()}\n`)
    .join('');
  const canonicalRequest = [
    method,
    target.pathname,
    canonicalQuery(target.searchParams),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const signingKey = getSigningKey(dateStamp, REGION, SERVICE);
  const signature = hmacHex(signingKey, stringToSign);

  const requestHeaders = Object.fromEntries(
    Object.entries(headers).filter(([name]) => name !== 'host'),
  );
  requestHeaders.authorization =
    `AWS4-HMAC-SHA256 Credential=${env.r2AccessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(target, {
    method,
    headers: requestHeaders,
    body: method === 'GET' || method === 'HEAD' ? undefined : payload,
  });
}

function assertCoreEnv() {
  const missing = [];
  if (!env.supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!env.serviceRoleKey && !env.anonKey) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  if (!env.r2PublicUrl) missing.push('CF_R2_PUBLIC_URL');
  if (missing.length > 0) {
    throw new Error(`Missing env for scan: ${missing.join(', ')}`);
  }
}

function assertApplyEnv() {
  const missing = [];
  if (!env.serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!env.r2AccountId) missing.push('CF_R2_ACCOUNT_ID');
  if (!env.r2AccessKeyId) missing.push('CF_R2_ACCESS_KEY_ID');
  if (!env.r2SecretAccessKey) missing.push('CF_R2_SECRET_ACCESS_KEY');
  if (!env.r2Bucket) missing.push('CF_R2_BUCKET');

  if (missing.length > 0) {
    throw new Error(
      `Missing env for --apply: ${missing.join(', ')}. ` +
        'Dry-run works with fewer credentials; apply needs DB admin and R2 S3 write credentials.',
    );
  }
}

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function readOptionalEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return '';
}

function parseArgs(rawArgs) {
  const parsed = {
    apply: false,
    help: false,
    limit: undefined,
    scanLimit: undefined,
  };

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (arg === '--apply') parsed.apply = true;
    else if (arg === '--dry-run') parsed.apply = false;
    else if (arg === '--help' || arg === '-h') parsed.help = true;
    else if (arg === '--limit') parsed.limit = rawArgs[++i];
    else if (arg === '--scan-limit') parsed.scanLimit = rawArgs[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function readPositiveInt(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected positive integer, got ${value}`);
  }
  return parsed;
}

function normalizePublicBase(value) {
  if (!value) return '';
  return value.endsWith('/') ? value : `${value}/`;
}

function safeUrl(value) {
  try {
    return value ? new URL(value) : null;
  } catch {
    return null;
  }
}

function stripQuery(value) {
  const url = safeUrl(value);
  if (!url) return value;
  url.search = '';
  url.hash = '';
  return url.toString();
}

function contentTypeForKey(key) {
  if (/\.avif$/i.test(key)) return 'image/avif';
  if (/\.gif$/i.test(key)) return 'image/gif';
  if (/\.jpe?g$/i.test(key)) return 'image/jpeg';
  if (/\.png$/i.test(key)) return 'image/png';
  if (/\.webp$/i.test(key)) return 'image/webp';
  if (/\.mov$/i.test(key)) return 'video/quicktime';
  if (/\.webm$/i.test(key)) return 'video/webm';
  if (/\.mp4$/i.test(key)) return 'video/mp4';
  return 'application/octet-stream';
}

function canonicalQuery(params) {
  return [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${rfc3986(key)}=${rfc3986(value)}`)
    .join('&');
}

function lowercaseHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
}

function getSigningKey(dateStamp, region, service) {
  const kDate = hmac(Buffer.from(`AWS4${env.r2SecretAccessKey}`, 'utf8'), dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function hmacHex(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest('hex');
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function rfc3986(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function redact(text) {
  return String(text).replace(/[A-Za-z0-9_./+=:-]{32,}/g, '<redacted>');
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function printHelp() {
  console.log(`
Usage:
  npm run r2:cache-control -- [options]

Options:
  --dry-run              List public R2 media objects missing strong cache headers (default)
  --apply                Copy each object to itself with immutable Cache-Control metadata
  --limit <n>            Number of objects to process (default: 50)
  --scan-limit <n>       Number of recent posts to inspect (default: max(limit*4, 200))

Required for dry-run:
  NEXT_PUBLIC_SUPABASE_URL, CF_R2_PUBLIC_URL, and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY

Required for --apply:
  SUPABASE_SERVICE_ROLE_KEY, CF_R2_ACCOUNT_ID, CF_R2_ACCESS_KEY_ID,
  CF_R2_SECRET_ACCESS_KEY, CF_R2_BUCKET.
`);
}
