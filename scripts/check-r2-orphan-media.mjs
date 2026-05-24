import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ENV_FILES = ['.env', '.env.local', 'apps/web/.env.local'];
const REGION = 'auto';
const SERVICE = 's3';
const DEFAULT_MAX_ORPHANS = 0;
const DEFAULT_MAX_SCANNED = 5000;
const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_PREFIXES = ['posts/', 'products/', 'thumbnails/'];
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

for (const file of ENV_FILES) loadEnvFile(path.join(repoRoot, file));

const env = {
  supabaseUrl: normalizeBase(readEnv('NEXT_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL', 'SUPABASE_URL')),
  serviceRoleKey: readEnv('SUPABASE_SERVICE_ROLE_KEY'),
  r2AccountId: readEnv('CF_R2_ACCOUNT_ID', 'R2_ACCOUNT_ID'),
  r2AccessKeyId: readEnv('CF_R2_ACCESS_KEY_ID', 'R2_ACCESS_KEY_ID'),
  r2SecretAccessKey: readEnv('CF_R2_SECRET_ACCESS_KEY', 'R2_SECRET_ACCESS_KEY'),
  r2Bucket: readEnv('CF_R2_BUCKET', 'R2_BUCKET_NAME'),
  r2PublicUrl: normalizeBase(readEnv('CF_R2_PUBLIC_URL', 'R2_PUBLIC_URL')),
};
const maxOrphans = readNonNegativeInt(args.maxOrphans, DEFAULT_MAX_ORPHANS);
const maxScanned = readPositiveInt(args.maxScanned, DEFAULT_MAX_SCANNED);
const timeoutMs = readPositiveInt(args.timeoutMs, DEFAULT_TIMEOUT_MS);
const prefixes = String(args.prefixes || DEFAULT_PREFIXES.join(','))
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const skipIfMissing = Boolean(args.skipIfMissing);
const apply = Boolean(args.apply);
const deleteLimit = readPositiveInt(args.deleteLimit, maxScanned);
const failures = [];

console.log('R2 orphan media check');
console.log('No secret values are printed.');
console.log(`Prefixes: ${prefixes.join(', ')}`);

const missing = missingEnv();
if (missing.length > 0) {
  const message = `[env] Missing ${missing.join(', ')}.`;
  if (skipIfMissing) {
    console.log(`${message} Skipping because --skip-if-missing is set.`);
    process.exit(0);
  }
  failures.push(message);
}

if (failures.length === 0) {
  const referencedKeys = await loadReferencedMediaKeys();
  const bucketKeys = await listBucketKeys();
  const orphans = bucketKeys.filter((key) => !referencedKeys.has(key));

  console.log('');
  console.log('Summary:');
  console.log(`  - referenced media keys: ${referencedKeys.size}`);
  console.log(`  - scanned R2 objects: ${bucketKeys.length}`);
  console.log(`  - orphan R2 objects: ${orphans.length}`);

  for (const key of orphans.slice(0, 20)) {
    console.log(`  - orphan: ${key}`);
  }

  if (apply && orphans.length > 0) {
    const toDelete = orphans.slice(0, deleteLimit);
    await deleteOrphans(toDelete);
    if (orphans.length > deleteLimit) {
      failures.push(`[r2] Deleted ${deleteLimit} orphan object(s), but ${orphans.length - deleteLimit} remain.`);
    }
  } else if (orphans.length > maxOrphans) {
    failures.push(`[r2] Orphan media objects ${orphans.length} > ${maxOrphans}.`);
  }

  if (bucketKeys.length >= maxScanned) {
    failures.push(`[r2] Scan reached max-scanned=${maxScanned}; increase limit before trusting the result.`);
  }
}

if (failures.length > 0) {
  console.log('');
  console.error('R2 orphan media check failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('');
console.log('R2 orphan media check passed.');

async function loadReferencedMediaKeys() {
  const keys = new Set();

  await loadPostMediaKeys(keys);
  await loadStoryMediaKeys(keys);
  await loadStoryHighlightMediaKeys(keys);
  await loadProductMediaKeys(keys);

  return keys;
}

async function loadPostMediaKeys(keys) {
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const url =
      `${env.supabaseUrl}/rest/v1/posts?select=id,media_url,thumbnail_url` +
      `&or=(media_url.not.is.null,thumbnail_url.not.is.null)` +
      `&order=created_at.desc&limit=${pageSize}&offset=${offset}`;
    const response = await fetchWithTimeout(url, {
      headers: {
        accept: 'application/json',
        apikey: env.serviceRoleKey,
        authorization: `Bearer ${env.serviceRoleKey}`,
      },
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Supabase posts query failed (${response.status}): ${summarize(text)}`);
    }

    const rows = JSON.parse(text);
    for (const row of rows) {
      for (const value of [row.media_url, row.thumbnail_url]) {
        const key = keyFromPublicUrl(value);
        if (key) keys.add(key);
      }
    }

    if (rows.length < pageSize) break;
    offset += rows.length;
  }
}

async function loadStoryMediaKeys(keys) {
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const url =
      `${env.supabaseUrl}/rest/v1/stories?select=id,media_url,thumbnail_url` +
      `&or=(media_url.not.is.null,thumbnail_url.not.is.null)` +
      `&order=created_at.desc&limit=${pageSize}&offset=${offset}`;
    const response = await fetchWithTimeout(url, {
      headers: {
        accept: 'application/json',
        apikey: env.serviceRoleKey,
        authorization: `Bearer ${env.serviceRoleKey}`,
      },
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Supabase stories query failed (${response.status}): ${summarize(text)}`);
    }

    const rows = JSON.parse(text);
    for (const row of rows) {
      for (const value of [row.media_url, row.thumbnail_url]) {
        const key = keyFromPublicUrl(value);
        if (key) keys.add(key);
      }
    }

    if (rows.length < pageSize) break;
    offset += rows.length;
  }
}

async function loadStoryHighlightMediaKeys(keys) {
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const url =
      `${env.supabaseUrl}/rest/v1/story_highlights?select=id,media_url,thumbnail_url,items` +
      `&order=created_at.desc&limit=${pageSize}&offset=${offset}`;
    const response = await fetchWithTimeout(url, {
      headers: {
        accept: 'application/json',
        apikey: env.serviceRoleKey,
        authorization: `Bearer ${env.serviceRoleKey}`,
      },
    });

    const text = await response.text();
    if (!response.ok) {
      // Older deployments may not have story_highlights yet; do not make the
      // orphan scanner destructive just because an optional surface is absent.
      if (response.status === 404) return;
      throw new Error(`Supabase story_highlights query failed (${response.status}): ${summarize(text)}`);
    }

    const rows = JSON.parse(text);
    for (const row of rows) {
      for (const value of [row.media_url, row.thumbnail_url]) {
        const key = keyFromPublicUrl(value);
        if (key) keys.add(key);
      }
      addKeysFromJsonMedia(row.items, keys);
    }

    if (rows.length < pageSize) break;
    offset += rows.length;
  }
}

async function loadProductMediaKeys(keys) {
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const url =
      `${env.supabaseUrl}/rest/v1/products?select=id,cover_url,image_urls,file_url` +
      `&order=created_at.desc&limit=${pageSize}&offset=${offset}`;
    const response = await fetchWithTimeout(url, {
      headers: {
        accept: 'application/json',
        apikey: env.serviceRoleKey,
        authorization: `Bearer ${env.serviceRoleKey}`,
      },
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Supabase products query failed (${response.status}): ${summarize(text)}`);
    }

    const rows = JSON.parse(text);
    for (const row of rows) {
      for (const value of [row.cover_url, row.file_url, ...(Array.isArray(row.image_urls) ? row.image_urls : [])]) {
        const key = keyFromPublicUrl(value);
        if (key) keys.add(key);
      }
    }

    if (rows.length < pageSize) break;
    offset += rows.length;
  }
}

function addKeysFromJsonMedia(value, keys) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) addKeysFromJsonMedia(item, keys);
    return;
  }
  if (typeof value !== 'object') return;

  for (const key of ['media_url', 'thumbnail_url', 'url']) {
    const mediaKey = keyFromPublicUrl(value[key]);
    if (mediaKey) keys.add(mediaKey);
  }

  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object') addKeysFromJsonMedia(nested, keys);
  }
}

async function listBucketKeys() {
  const keys = [];
  for (const prefix of prefixes) {
    let continuationToken = '';
    do {
      const search = new URLSearchParams({
        'list-type': '2',
        prefix,
        'max-keys': '1000',
      });
      if (continuationToken) search.set('continuation-token', continuationToken);

      const url = `https://${env.r2AccountId}.r2.cloudflarestorage.com/${env.r2Bucket}?${search}`;
      const response = await signedFetch('GET', url, Buffer.alloc(0), {}, `${env.r2AccountId}.r2.cloudflarestorage.com`);
      const xml = await response.text();

      if (!response.ok) {
        throw new Error(`R2 ListObjectsV2 failed (${response.status}): ${summarize(xml)}`);
      }

      for (const key of parseXmlTags(xml, 'Key')) {
        if (keys.length >= maxScanned) return keys;
        keys.push(decodeXml(key));
      }

      const [next] = parseXmlTags(xml, 'NextContinuationToken');
      continuationToken = next ? decodeXml(next) : '';
    } while (continuationToken && keys.length < maxScanned);
  }
  return keys;
}

async function deleteOrphans(keys) {
  console.log('');
  console.log(`Deleting orphan media through r2-delete: ${keys.length} object(s)`);

  for (let index = 0; index < keys.length; index += 50) {
    const chunk = keys.slice(index, index + 50);
    const response = await fetchWithTimeout(`${env.supabaseUrl}/functions/v1/r2-delete`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.serviceRoleKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ keys: chunk }),
    });
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`r2-delete failed (${response.status}): ${summarize(text)}`);
    }

    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`r2-delete returned invalid JSON: ${summarize(text)}`);
    }

    console.log(`  - chunk ${Math.floor(index / 50) + 1}: deleted=${body.deleted ?? 'unknown'}`);
    if (body.ok !== true) {
      throw new Error(`r2-delete returned ok=false: ${summarize(text)}`);
    }
  }
}

function keyFromPublicUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('http')) return null;
  const url = safeUrl(value);
  if (!url) return null;
  if (env.r2PublicUrl && !normalizeBase(url.origin + url.pathname).startsWith(`${env.r2PublicUrl}/`)) {
    return null;
  }
  return decodeURIComponent(url.pathname.replace(/^\/+/, ''));
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
  const signature = hmacHex(getSigningKey(dateStamp, REGION, SERVICE), stringToSign);
  const requestHeaders = Object.fromEntries(Object.entries(headers).filter(([name]) => name !== 'host'));
  requestHeaders.authorization =
    `AWS4-HMAC-SHA256 Credential=${env.r2AccessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetchWithTimeout(target, {
    method,
    headers: requestHeaders,
    body: method === 'GET' || method === 'HEAD' ? undefined : payload,
  });
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

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalQuery(searchParams) {
  return [...searchParams.entries()]
    .map(([key, value]) => [rfc3986(key), rfc3986(value)])
    .sort(([aKey, aValue], [bKey, bValue]) => (aKey === bKey ? aValue.localeCompare(bValue) : aKey.localeCompare(bKey)))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

function rfc3986(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function lowercaseHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function parseXmlTags(xml, tagName) {
  const matcher = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'g');
  return [...xml.matchAll(matcher)].map((match) => match[1]);
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = normalizeEnvValue(match[2]);
  }
}

function normalizeEnvValue(raw) {
  const withoutComment = raw.replace(/\s+#.*$/, '').trim();
  if (
    (withoutComment.startsWith('"') && withoutComment.endsWith('"')) ||
    (withoutComment.startsWith("'") && withoutComment.endsWith("'"))
  ) {
    return withoutComment.slice(1, -1);
  }
  return withoutComment;
}

function readEnv(...names) {
  for (const name of names) {
    if (process.env[name]) return process.env[name];
  }
  return '';
}

function missingEnv() {
  const missing = [];
  if (!env.supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!env.serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!env.r2AccountId) missing.push('CF_R2_ACCOUNT_ID');
  if (!env.r2AccessKeyId) missing.push('CF_R2_ACCESS_KEY_ID');
  if (!env.r2SecretAccessKey) missing.push('CF_R2_SECRET_ACCESS_KEY');
  if (!env.r2Bucket) missing.push('CF_R2_BUCKET');
  if (!env.r2PublicUrl) missing.push('CF_R2_PUBLIC_URL');
  return missing;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }
    if (!arg.startsWith('--')) continue;
    const [rawKey, inlineValue] = arg.slice(2).split(/=(.*)/s, 2);
    const key = rawKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    if (inlineValue !== undefined) {
      parsed[key] = inlineValue;
    } else if (argv[index + 1] && !argv[index + 1].startsWith('--')) {
      parsed[key] = argv[index + 1];
      index += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}

function normalizeBase(value) {
  return String(value || '').replace(/\/+$/, '');
}

function safeUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readNonNegativeInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function summarize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function printHelp() {
  console.log(`
Usage: node scripts/check-r2-orphan-media.mjs [options]

Options:
  --prefixes <csv>          R2 prefixes to scan (default ${DEFAULT_PREFIXES.join(',')})
  --max-orphans <n>         Max orphan objects allowed (default ${DEFAULT_MAX_ORPHANS})
  --max-scanned <n>         Max R2 objects to scan before failing (default ${DEFAULT_MAX_SCANNED})
  --apply                   Delete orphan objects through the r2-delete Edge Function
  --delete-limit <n>        Max orphan objects to delete in one apply run (default max-scanned)
  --timeout-ms <n>          Request timeout (default ${DEFAULT_TIMEOUT_MS})
  --skip-if-missing         Exit 0 when required secrets are missing
`);
}
