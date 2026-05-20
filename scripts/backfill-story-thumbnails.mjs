import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ENV_FILES = ['.env', '.env.local', 'apps/web/.env.local'];
const REGION = 'auto';
const SERVICE = 's3';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CACHE_CONTROL = 'public, max-age=31536000, immutable';

for (const file of ENV_FILES) loadEnvFile(path.join(REPO_ROOT, file));

const args = parseArgs(process.argv.slice(2));
const dryRun = !args.apply;
const limit = readPositiveInt(args.limit, 50);
const seekSeconds = readPositiveNumber(args.seek, 0.5);
const maxWidth = readPositiveInt(args.maxWidth, 720);
const keepTemp = args.keepTemp;

const env = {
  supabaseUrl: readOptionalEnv('NEXT_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL'),
  serviceRoleKey: readOptionalEnv('SUPABASE_SERVICE_ROLE_KEY'),
  anonKey: readOptionalEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'),
  r2AccountId: readOptionalEnv('CF_R2_ACCOUNT_ID', 'R2_ACCOUNT_ID'),
  r2AccessKeyId: readOptionalEnv('CF_R2_ACCESS_KEY_ID', 'R2_ACCESS_KEY_ID'),
  r2SecretAccessKey: readOptionalEnv('CF_R2_SECRET_ACCESS_KEY', 'R2_SECRET_ACCESS_KEY'),
  r2Bucket: readOptionalEnv('CF_R2_BUCKET', 'R2_BUCKET_NAME'),
  r2PublicUrl: normalizePublicBase(readOptionalEnv('CF_R2_PUBLIC_URL', 'R2_PUBLIC_URL')),
  cacheControl: readOptionalEnv('R2_THUMBNAIL_CACHE_CONTROL') || DEFAULT_CACHE_CONTROL,
};

if (args.help) {
  printHelp();
  process.exit(0);
}

assertCoreEnv();
if (!dryRun) {
  assertApplyEnv();
  await assertBinary('ffmpeg');
}

const supabase = createClient(env.supabaseUrl, env.serviceRoleKey || env.anonKey, {
  auth: { persistSession: false },
});

const stories = await loadCandidateStories();

if (stories.length === 0) {
  console.log('No stories without thumbnail_url found.');
  process.exit(0);
}

console.log(
  `Story thumbnail backfill: ${dryRun ? 'dry-run' : 'apply'} mode, ${stories.length} candidate(s), limit ${limit}.`,
);

let processed = 0;
let skipped = 0;
let failed = 0;

for (const story of stories) {
  console.log(`\nSTORY ${story.id}`);
  console.log(`  type:      ${story.media_type || '(unknown)'}`);
  console.log(`  media:     ${stripQuery(story.media_url)}`);

  if (story.media_type === 'image') {
    console.log(`  thumb url: ${stripQuery(story.media_url)}`);
    if (!dryRun) await updateStoryThumbnail(story.id, story.media_url);
    processed += 1;
    continue;
  }

  if (story.media_type !== 'video') {
    skipped += 1;
    console.log('  status:    skipped unsupported media_type');
    continue;
  }

  const plan = buildThumbnailPlan(story);
  if (!plan) {
    skipped += 1;
    console.log('  status:    skipped unusable media_url');
    continue;
  }

  console.log(`  thumb key: ${plan.key}`);
  console.log(`  thumb url: ${plan.publicUrl}`);

  if (dryRun) {
    processed += 1;
    continue;
  }

  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vibes-story-thumb-'));
  const outputPath = path.join(tempDir, `${story.id}.jpg`);

  try {
    await renderThumbnail(story.media_url, outputPath);
    const bytes = await fs.promises.readFile(outputPath);
    await putR2Object(plan.key, bytes, {
      'content-type': 'image/jpeg',
      'cache-control': env.cacheControl,
    });
    await updateStoryThumbnail(story.id, plan.publicUrl);
    processed += 1;
    console.log('  status:    updated');
  } catch (error) {
    failed += 1;
    console.error(`  status:    failed: ${formatError(error)}`);
  } finally {
    if (!keepTemp) await fs.promises.rm(tempDir, { recursive: true, force: true });
    else console.log(`  temp:      ${tempDir}`);
  }
}

console.log(
  `\nSummary: processed ${processed}, skipped ${skipped}, failed ${failed}, mode ${dryRun ? 'dry-run' : 'apply'}.`,
);

if (failed > 0) process.exit(1);

async function loadCandidateStories() {
  const { data, error } = await supabase
    .from('stories')
    .select('id, user_id, media_url, media_type, thumbnail_url, created_at')
    .not('media_url', 'is', null)
    .neq('media_url', '')
    .eq('archived', false)
    .or('thumbnail_url.is.null,thumbnail_url.eq.')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Supabase candidate query failed: ${error.message}`);
  return data ?? [];
}

function buildThumbnailPlan(story) {
  const mediaUrl = safeUrl(story.media_url);
  if (!mediaUrl) return null;

  const keyFromMedia = decodeKeyFromMediaPath(mediaUrl.pathname);
  const ownerId = keyFromMedia?.ownerId ?? story.user_id;
  const stem = keyFromMedia?.stem ?? story.id;
  const key = `thumbnails/stories/${safeKeySegment(ownerId)}/${safeKeySegment(stem)}.jpg`;
  const publicBase = env.r2PublicUrl || `${mediaUrl.origin}/`;

  return {
    key,
    publicUrl: `${publicBase}${key.split('/').map(rfc3986).join('/')}`,
  };
}

function decodeKeyFromMediaPath(pathname) {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const postsIndex = parts.findIndex((part) => part === 'posts');
  if (postsIndex < 0) return null;
  const mediaKind = parts[postsIndex + 1];
  const ownerId = parts[postsIndex + 2];
  const filename = parts[postsIndex + 3];
  if (!['images', 'videos'].includes(mediaKind) || !ownerId || !filename) return null;
  return { ownerId, stem: filename.replace(/\.[^.]+$/, '') };
}

async function renderThumbnail(inputUrl, outputPath) {
  await runProcess('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-ss',
    String(seekSeconds),
    '-i',
    inputUrl,
    '-frames:v',
    '1',
    '-vf',
    `scale='min(${maxWidth},iw)':-2`,
    '-q:v',
    '4',
    outputPath,
  ]);
}

async function updateStoryThumbnail(storyId, thumbnailUrl) {
  const { error } = await supabase
    .from('stories')
    .update({ thumbnail_url: thumbnailUrl })
    .eq('id', storyId)
    .or('thumbnail_url.is.null,thumbnail_url.eq.');
  if (error) throw new Error(`Supabase update failed: ${error.message}`);
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
  const signature = hmacHex(getSigningKey(dateStamp), stringToSign);
  const requestHeaders = Object.fromEntries(Object.entries(headers).filter(([name]) => name !== 'host'));
  requestHeaders.authorization =
    `AWS4-HMAC-SHA256 Credential=${env.r2AccessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(target, { method, headers: requestHeaders, body: payload });
}

async function assertBinary(name) {
  await runProcess('which', [name]);
}

async function runProcess(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code}: ${stderr.trim()}`));
    });
  });
}

function assertCoreEnv() {
  const missing = [];
  if (!env.supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!env.serviceRoleKey && !env.anonKey) missing.push('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (missing.length > 0) throw new Error(`Missing env for scan: ${missing.join(', ')}`);
}

function assertApplyEnv() {
  const missing = [];
  if (!env.serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!env.r2AccountId) missing.push('CF_R2_ACCOUNT_ID');
  if (!env.r2AccessKeyId) missing.push('CF_R2_ACCESS_KEY_ID');
  if (!env.r2SecretAccessKey) missing.push('CF_R2_SECRET_ACCESS_KEY');
  if (!env.r2Bucket) missing.push('CF_R2_BUCKET');
  if (missing.length > 0) throw new Error(`Missing env for --apply: ${missing.join(', ')}`);
}

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].replace(/\s+#.*$/, '').trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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
  const parsed = { apply: false, help: false, keepTemp: false };
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === '--apply') parsed.apply = true;
    else if (arg === '--dry-run') parsed.apply = false;
    else if (arg === '--help' || arg === '-h') parsed.help = true;
    else if (arg === '--keep-temp') parsed.keepTemp = true;
    else if (arg === '--limit') parsed.limit = rawArgs[++index];
    else if (arg === '--max-width') parsed.maxWidth = rawArgs[++index];
    else if (arg === '--seek') parsed.seek = rawArgs[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function readPositiveInt(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Expected positive integer, got ${value}`);
  return parsed;
}

function readPositiveNumber(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Expected positive number, got ${value}`);
  return parsed;
}

function safeUrl(value) {
  try {
    return value ? new URL(value) : null;
  } catch {
    return null;
  }
}

function safeKeySegment(value) {
  return String(value)
    .replace(/\.[^.]+$/, '')
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || crypto.randomUUID();
}

function normalizePublicBase(value) {
  if (!value) return '';
  return value.endsWith('/') ? value : `${value}/`;
}

function stripQuery(value) {
  const url = safeUrl(value);
  if (!url) return value;
  url.search = '';
  url.hash = '';
  return url.toString();
}

function canonicalQuery(params) {
  return [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${rfc3986(key)}=${rfc3986(value)}`)
    .join('&');
}

function lowercaseHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
}

function getSigningKey(dateStamp) {
  const kDate = hmac(Buffer.from(`AWS4${env.r2SecretAccessKey}`, 'utf8'), dateStamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
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
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
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
  npm run stories:thumbnails:backfill -- [options]

Options:
  --dry-run              List candidate stories and planned thumbnail URLs (default)
  --apply                Generate/upload/write thumbnail_url
  --limit <n>            Number of candidate stories to scan (default: 50)
  --seek <seconds>       Video timestamp used for the frame (default: 0.5)
  --max-width <pixels>   Max generated JPEG width (default: 720)
  --keep-temp            Keep generated JPEGs in /tmp for inspection
`);
}
