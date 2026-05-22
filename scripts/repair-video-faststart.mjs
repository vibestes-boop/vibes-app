import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ENV_FILES = ['apps/web/.env.local', '.env.local', '.env'];
const REGION = 'auto';
const SERVICE = 's3';
const DEFAULT_SITE_URL = 'https://serlo-web.vercel.app';
const DEFAULT_LIMIT = 12;
const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const SCAN_BYTES = 2 * 1024 * 1024;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

for (const file of ENV_FILES) loadEnvFile(path.join(repoRoot, file));

const dryRun = !args.apply;
const limit = readPositiveInt(args.limit, DEFAULT_LIMIT);
const timeoutMs = readPositiveInt(args.timeoutMs, DEFAULT_TIMEOUT_MS);
const keepTemp = Boolean(args.keepTemp);
const cacheControl = process.env.R2_MEDIA_CACHE_CONTROL || DEFAULT_CACHE_CONTROL;
const env = {
  supabaseUrl: normalizeBase(readEnv('NEXT_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL', 'SUPABASE_URL')),
  serviceRoleKey: readEnv('SUPABASE_SERVICE_ROLE_KEY'),
  r2AccountId: readEnv('CF_R2_ACCOUNT_ID', 'R2_ACCOUNT_ID'),
  r2AccessKeyId: readEnv('CF_R2_ACCESS_KEY_ID', 'R2_ACCESS_KEY_ID'),
  r2SecretAccessKey: readEnv('CF_R2_SECRET_ACCESS_KEY', 'R2_SECRET_ACCESS_KEY'),
  r2Bucket: readEnv('CF_R2_BUCKET', 'R2_BUCKET_NAME'),
  r2PublicUrl: normalizeBase(readEnv('CF_R2_PUBLIC_URL', 'R2_PUBLIC_URL')),
};

const missing = missingEnv();
if (missing.length > 0) {
  console.error(`Missing required env: ${missing.join(', ')}`);
  process.exit(1);
}

if (!dryRun) await assertBinary('ffmpeg');

const supabase = createClient(env.supabaseUrl, env.serviceRoleKey, {
  auth: { persistSession: false },
});

const feedUrl = buildFeedUrl(args.feedUrl, limit);
const candidates = await loadSlowStartCandidates(feedUrl);

console.log('Video fast-start repair');
console.log('No secret values are printed.');
console.log(`Mode: ${dryRun ? 'dry-run' : 'apply'}`);
console.log(`Feed: ${feedUrl}`);
console.log(`Candidates: ${candidates.length}`);

if (candidates.length === 0) {
  console.log('No slow-start videos found.');
  process.exit(0);
}

let repaired = 0;
let failed = 0;

for (const candidate of candidates) {
  console.log('');
  console.log(`POST ${candidate.id}`);
  console.log(`  status: ${candidate.inspection.status} (${candidate.inspection.reason})`);
  console.log(`  media:  ${shortUrl(candidate.mediaUrl)}`);

  const plan = buildRepairPlan(candidate);
  if (!plan) {
    failed += 1;
    console.error('  repair: skipped, media_url key could not be decoded');
    continue;
  }

  console.log(`  new:    ${plan.newKey}`);

  if (dryRun) continue;

  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vibes-faststart-'));
  const inputPath = path.join(tempDir, `${candidate.id}-input.mp4`);
  const outputPath = path.join(tempDir, `${candidate.id}-faststart.mp4`);

  try {
    await downloadFile(candidate.mediaUrl, inputPath, timeoutMs);
    await remuxFastStart(inputPath, outputPath);
    const bytes = await fs.promises.readFile(outputPath);
    const after = inspectMp4FastStart(new Uint8Array(bytes), 'video/mp4');
    if (after.status !== 'fast-start') {
      throw new Error(`ffmpeg output is not fast-start (${after.status}: ${after.reason})`);
    }
    await putR2Object(plan.newKey, bytes, {
      'content-type': 'video/mp4',
      'cache-control': cacheControl,
    });
    await updatePostMedia(candidate.id, candidate.mediaUrl, plan.publicUrl);
    await deleteR2Object(plan.oldKey);
    repaired += 1;
    console.log('  repair: updated');
  } catch (error) {
    failed += 1;
    console.error(`  repair: failed: ${formatError(error)}`);
  } finally {
    if (keepTemp) console.log(`  temp:   ${tempDir}`);
    else await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
}

console.log('');
console.log(`Summary: repaired ${repaired}, failed ${failed}, mode ${dryRun ? 'dry-run' : 'apply'}.`);
if (failed > 0) process.exit(1);

async function loadSlowStartCandidates(feedUrl) {
  const feed = await fetchJson(feedUrl, timeoutMs);
  const posts = Array.isArray(feed.posts) ? feed.posts : Array.isArray(feed) ? feed : [];
  const candidates = [];

  for (const post of posts.slice(0, limit)) {
    const mediaType = post.media_type ?? post.mediaType ?? null;
    if (mediaType !== 'video') continue;

    const id = post.id ?? null;
    const mediaUrl = post.media_url ?? post.mediaUrl ?? post.video_url ?? post.videoUrl ?? null;
    if (!id || !mediaUrl) continue;

    const range = await fetchRange(mediaUrl, timeoutMs);
    if (!range.ok) continue;
    const inspection = inspectMp4FastStart(new Uint8Array(range.bytes), 'video/mp4');
    if (inspection.status !== 'slow-start') continue;

    const dbPost = await loadPost(id);
    if (!dbPost?.media_url) continue;

    candidates.push({
      id,
      authorId: dbPost.author_id,
      mediaUrl: dbPost.media_url,
      inspection,
    });
  }

  return candidates;
}

async function loadPost(id) {
  const { data, error } = await supabase
    .from('posts')
    .select('id,author_id,media_url,media_type,thumbnail_url')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Supabase read failed for ${id}: ${error.message}`);
  return data;
}

function buildRepairPlan(candidate) {
  const oldKey = decodeR2Key(candidate.mediaUrl);
  if (!oldKey) return null;
  const filename = oldKey.split('/').pop() || `${candidate.id}.mp4`;
  const stem = filename.replace(/\.[^.]+$/, '');
  const owner = candidate.authorId || oldKey.split('/')[2] || 'unknown';
  const newKey = `posts/videos/${owner}/${safeSegment(stem)}-faststart-${Date.now()}.mp4`;
  const publicUrl = `${env.r2PublicUrl}/${newKey.split('/').map(rfc3986).join('/')}`;
  return { oldKey, newKey, publicUrl };
}

async function downloadFile(url, targetPath, timeout) {
  const response = await fetchWithTimeout(url, { headers: { accept: '*/*' } }, timeout);
  if (!response.ok) throw new Error(`download failed: ${response.status} ${await safeText(response)}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.promises.writeFile(targetPath, bytes);
}

async function remuxFastStart(inputPath, outputPath) {
  await runProcess('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    inputPath,
    '-c',
    'copy',
    '-movflags',
    '+faststart',
    outputPath,
  ]);
}

async function putR2Object(key, bytes, extraHeaders) {
  const host = `${env.r2AccountId}.r2.cloudflarestorage.com`;
  const encodedKey = key.split('/').map(rfc3986).join('/');
  const url = `https://${host}/${env.r2Bucket}/${encodedKey}`;
  const response = await signedFetch('PUT', url, bytes, extraHeaders, host);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`R2 PUT failed: ${response.status} ${redact(text)}`);
  }
}

async function deleteR2Object(key) {
  const host = `${env.r2AccountId}.r2.cloudflarestorage.com`;
  const encodedKey = key.split('/').map(rfc3986).join('/');
  const url = `https://${host}/${env.r2Bucket}/${encodedKey}`;
  const response = await signedFetch('DELETE', url, Buffer.alloc(0), {}, host);
  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => '');
    throw new Error(`R2 DELETE failed: ${response.status} ${redact(text)}`);
  }
}

async function updatePostMedia(postId, oldUrl, newUrl) {
  const { data, error } = await supabase
    .from('posts')
    .update({ media_url: newUrl })
    .eq('id', postId)
    .eq('media_url', oldUrl)
    .select('id')
    .maybeSingle();

  if (error) throw new Error(`Supabase update failed: ${error.message}`);
  if (!data) throw new Error('Supabase update skipped because media_url changed concurrently.');
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
  const signingKey = getSigningKey(env.r2SecretAccessKey, dateStamp, REGION, SERVICE);
  const signature = hmac(signingKey, stringToSign, 'hex');
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${env.r2AccessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return fetchWithTimeout(url, {
    method,
    headers: {
      ...headers,
      authorization,
    },
    body: method === 'DELETE' ? undefined : payload,
  }, timeoutMs);
}

async function fetchJson(url, timeout) {
  const response = await fetchWithTimeout(url, { headers: { accept: 'application/json' } }, timeout);
  if (!response.ok) throw new Error(`Feed request failed: ${response.status} ${await safeText(response)}`);
  return response.json();
}

async function fetchRange(url, timeout) {
  try {
    const response = await fetchWithTimeout(
      url,
      { headers: { range: `bytes=0-${SCAN_BYTES - 1}`, accept: '*/*' } },
      timeout,
    );
    if (!response.ok) return { ok: false, status: response.status, error: await safeText(response) };
    const bytes = await response.arrayBuffer();
    return { ok: true, status: response.status, bytes };
  } catch (error) {
    return { ok: false, error: formatError(error) };
  }
}

async function fetchWithTimeout(url, init, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function inspectMp4FastStart(bytes) {
  const scannedBytes = Math.min(bytes.byteLength, SCAN_BYTES);
  const result = {
    status: 'unknown',
    reason: 'not enough data scanned',
    scannedBytes,
    ftypOffset: null,
    moovOffset: null,
    mdatOffset: null,
  };
  if (scannedBytes < 16) return { ...result, reason: 'file too small for mp4 boxes' };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  let ftypOffset = null;
  let moovOffset = null;
  let mdatOffset = null;
  while (offset + 8 <= scannedBytes) {
    const box = readBox(view, offset, scannedBytes);
    if (!box) break;
    if (box.type === 'ftyp') ftypOffset = offset;
    if (box.type === 'moov') moovOffset = offset;
    if (box.type === 'mdat') mdatOffset = offset;
    if (moovOffset !== null && mdatOffset !== null) break;
    offset += box.size;
  }
  if (moovOffset !== null && (mdatOffset === null || moovOffset < mdatOffset)) {
    return { ...result, status: 'fast-start', reason: 'moov box is before mdat', ftypOffset, moovOffset, mdatOffset };
  }
  if (mdatOffset !== null && (moovOffset === null || mdatOffset < moovOffset)) {
    return {
      ...result,
      status: 'slow-start',
      reason: moovOffset === null ? 'mdat found before moov, moov not in first scan window' : 'mdat is before moov',
      ftypOffset,
      moovOffset,
      mdatOffset,
    };
  }
  return { ...result, reason: 'moov/mdat boxes not found in first scan window', ftypOffset, moovOffset, mdatOffset };
}

function readBox(view, offset, scannedBytes) {
  const size32 = view.getUint32(offset, false);
  const type = readAscii(view, offset + 4, 4);
  if (!type) return null;
  if (size32 === 0) return { type, size: scannedBytes - offset, headerSize: 8 };
  if (size32 === 1) {
    if (offset + 16 > scannedBytes) return null;
    const high = view.getUint32(offset + 8, false);
    const low = view.getUint32(offset + 12, false);
    return { type, size: high > 0 ? scannedBytes - offset : low, headerSize: 16 };
  }
  if (size32 < 8) return null;
  return { type, size: size32, headerSize: 8 };
}

function readAscii(view, offset, length) {
  if (offset + length > view.byteLength) return null;
  let out = '';
  for (let index = 0; index < length; index += 1) out += String.fromCharCode(view.getUint8(offset + index));
  return out;
}

function buildFeedUrl(value, limitValue) {
  const raw =
    value ||
    process.env.STABILITY_FEED_URL ||
    `${normalizeBase(process.env.STABILITY_SITE_URL || DEFAULT_SITE_URL)}/api/feed/explore?offset=0&limit=${limitValue}&sort=forYou`;
  const url = new URL(raw);
  if (!url.searchParams.has('limit')) url.searchParams.set('limit', String(limitValue));
  url.searchParams.set('faststart_repair_bust', String(Date.now()));
  return url.toString();
}

function decodeR2Key(value) {
  try {
    const url = new URL(value);
    if (env.r2PublicUrl && !normalizeBase(`${url.origin}${url.pathname}`).startsWith(`${env.r2PublicUrl}/`)) {
      return null;
    }
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const postsIndex = parts.findIndex((part) => part === 'posts');
    if (postsIndex < 0) return null;
    return parts.slice(postsIndex).join('/');
  } catch {
    return null;
  }
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === '--help' || arg === '-h') parsed.help = true;
    else if (arg === '--apply') parsed.apply = true;
    else if (arg === '--keep-temp') parsed.keepTemp = true;
    else if (arg === '--feed-url') parsed.feedUrl = rawArgs[++index];
    else if (arg === '--limit') parsed.limit = rawArgs[++index];
    else if (arg === '--timeout-ms') parsed.timeoutMs = rawArgs[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
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

function readPositiveInt(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Expected positive integer, got ${value}`);
  return parsed;
}

function safeSegment(value) {
  return String(value || 'video')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .slice(0, 80);
}

function shortUrl(value) {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}`;
  } catch {
    return String(value).slice(0, 80);
  }
}

function normalizeBase(value) {
  return String(value || '').replace(/\/+$/, '');
}

function rfc3986(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function redact(text) {
  return String(text || '')
    .replace(/(X-Amz-Credential=)[^&\s]+/gi, '$1[redacted]')
    .replace(/(X-Amz-Signature=)[a-f0-9]+/gi, '$1[redacted]')
    .slice(0, 500);
}

function lowercaseHeaders(headers) {
  const out = {};
  for (const [key, value] of Object.entries(headers)) out[key.toLowerCase()] = value;
  return out;
}

function canonicalQuery(searchParams) {
  return [...searchParams.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${rfc3986(key)}=${rfc3986(value)}`)
    .join('&');
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value).digest(encoding);
}

function getSigningKey(secret, dateStamp, region, service) {
  const kDate = hmac(Buffer.from(`AWS4${secret}`, 'utf8'), dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

function runProcess(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited ${code}: ${stderr.trim().slice(0, 500)}`));
    });
  });
}

async function assertBinary(name) {
  await runProcess(name, ['-version']);
}

async function safeText(response) {
  try {
    return (await response.text()).slice(0, 300);
  } catch {
    return '';
  }
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function printHelp() {
  console.log(`
Usage: npm run media:faststart-repair -- [options]

Options:
  --apply             Remux, upload, update DB, and delete old R2 object
  --feed-url <url>    Feed API URL to inspect
  --limit <n>         Number of first feed posts to inspect (default ${DEFAULT_LIMIT})
  --timeout-ms <n>    Request timeout (default ${DEFAULT_TIMEOUT_MS})
  --keep-temp         Keep downloaded/remuxed files for inspection

Default is dry-run.
`);
}
