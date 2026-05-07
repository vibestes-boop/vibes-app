import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SITE_URL = 'https://serlo-web.vercel.app';
const DEFAULT_TIMEOUT_MS = 8000;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const timeoutMs = readPositiveInt(args.timeoutMs, DEFAULT_TIMEOUT_MS);
const siteUrl = normalizeBase(args.siteUrl || process.env.STABILITY_SITE_URL || DEFAULT_SITE_URL);
const loadedEnv = loadEnv(repoRoot);
const failures = [];
const warnings = [];

const webSupabaseUrl = findFirstSet(['NEXT_PUBLIC_SUPABASE_URL']);
const webAnonKey = findFirstSet(['NEXT_PUBLIC_SUPABASE_ANON_KEY']);
const nativeSupabaseUrl = findFirstSet(['EXPO_PUBLIC_SUPABASE_URL']);
const nativeAnonKey = findFirstSet(['EXPO_PUBLIC_SUPABASE_ANON_KEY']);
const publicR2Url = findFirstSet(['CF_R2_PUBLIC_URL']);

console.log('Native/Web backend parity check');
console.log('No secret values are printed.');
console.log(`Site: ${siteUrl}`);

requireEnv('NEXT_PUBLIC_SUPABASE_URL', webSupabaseUrl);
requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', webAnonKey);
requireEnv('EXPO_PUBLIC_SUPABASE_URL', nativeSupabaseUrl);
requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', nativeAnonKey);

if (failures.length === 0) {
  comparePublicValue('Supabase URL', webSupabaseUrl, nativeSupabaseUrl);
  compareSecretFingerprint('Supabase anon key', webAnonKey, nativeAnonKey);
}

if (failures.length === 0) {
  await runSupabaseRestParity();
  await runWebApiMediaParity();
}

if (warnings.length > 0) {
  console.log('');
  console.log('Warnings:');
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (failures.length > 0) {
  console.log('');
  console.error('Native/Web backend parity failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('');
console.log('Native/Web backend parity passed.');

async function runSupabaseRestParity() {
  const checks = [
    {
      label: 'latest public posts',
      path:
        '/rest/v1/posts?select=id,media_url,thumbnail_url,media_type,privacy,women_only,created_at' +
        '&privacy=eq.public&order=created_at.desc&limit=3',
      minRows: 1,
    },
    {
      label: 'public profiles',
      path: '/rest/v1/profiles?select=id,username,avatar_url,is_verified&order=created_at.desc&limit=3',
      minRows: 1,
    },
  ];

  console.log('');
  console.log('Supabase anon REST parity:');

  for (const check of checks) {
    const web = await fetchSupabaseJson(webSupabaseUrl.value, webAnonKey.value, check.path);
    const native = await fetchSupabaseJson(nativeSupabaseUrl.value, nativeAnonKey.value, check.path);

    printRestResult(`web.${check.label}`, web);
    printRestResult(`native.${check.label}`, native);

    validateRestResult(`web.${check.label}`, web, check.minRows);
    validateRestResult(`native.${check.label}`, native, check.minRows);

    if (web.ok && native.ok) {
      const webIds = extractIds(web.data);
      const nativeIds = extractIds(native.data);
      if (webIds.join(',') !== nativeIds.join(',')) {
        failures.push(
          `[supabase:${check.label}] Web and native anon reads returned different rows ` +
            `(web=${webIds.join(',') || 'none'}, native=${nativeIds.join(',') || 'none'}).`,
        );
      }
    }
  }
}

async function runWebApiMediaParity() {
  const url = `${siteUrl}/api/feed/explore?offset=0&limit=12&sort=forYou&parity_bust=${Date.now()}`;
  console.log('');
  console.log('Production feed/media parity:');

  const response = await fetchJsonWithTimeout(url, timeoutMs);
  if (!response.ok) {
    failures.push(`[web-api] Explore feed failed: ${response.status} ${response.error || ''}`.trim());
    console.log(`  - explore feed: ${response.status}`);
    return;
  }

  const posts = Array.isArray(response.data?.posts)
    ? response.data.posts
    : Array.isArray(response.data)
      ? response.data
      : [];

  console.log(`  - explore feed: ${response.status}, posts=${posts.length}`);

  if (posts.length < 3) {
    failures.push(`[web-api] Expected at least 3 public posts, got ${posts.length}.`);
  }

  if (publicR2Url?.value) {
    const expectedHost = safeUrl(publicR2Url.value)?.host;
    if (expectedHost) {
      const mediaUrls = posts
        .flatMap((post) => [post.thumbnail_url, post.thumbnailUrl, post.media_url, post.mediaUrl, post.video_url, post.videoUrl])
        .filter((value) => typeof value === 'string' && value.startsWith('http'));
      const mismatches = mediaUrls
        .map((value) => safeUrl(value))
        .filter(Boolean)
        .filter((urlObject) => urlObject.host !== expectedHost && !urlObject.host.endsWith('.supabase.co'));

      console.log(`  - media host: expected=${expectedHost}, checked=${mediaUrls.length}`);

      if (mismatches.length > 0) {
        failures.push(
          `[web-api] Media URLs include unexpected host(s): ${Array.from(new Set(mismatches.map((u) => u.host))).join(', ')}.`,
        );
      }
    }
  } else {
    warnings.push('CF_R2_PUBLIC_URL is missing, skipped production media host parity.');
  }
}

async function fetchSupabaseJson(baseUrl, anonKey, restPath) {
  const url = `${normalizeBase(baseUrl)}${restPath}`;

  try {
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          accept: 'application/json',
          apikey: anonKey,
          authorization: `Bearer ${anonKey}`,
        },
      },
      timeoutMs,
    );
    const text = await response.text();

    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return { ok: false, status: response.status, data: null, error: 'Invalid JSON response' };
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      error: response.ok ? null : summarizeSupabaseError(data),
    };
  } catch (error) {
    return { ok: false, status: 'FETCH_ERROR', data: null, error: formatError(error) };
  }
}

async function fetchJsonWithTimeout(url, timeout) {
  try {
    const response = await fetchWithTimeout(
      url,
      { headers: { accept: 'application/json', 'user-agent': 'SerloNativeBackendParity/1.0' } },
      timeout,
    );
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return { ok: false, status: response.status, data: null, error: 'Invalid JSON response' };
    }
    return { ok: response.ok, status: response.status, data, error: response.ok ? null : text.slice(0, 120) };
  } catch (error) {
    return { ok: false, status: 'FETCH_ERROR', data: null, error: formatError(error) };
  }
}

function printRestResult(label, result) {
  const rows = Array.isArray(result.data) ? result.data.length : 'n/a';
  const suffix = result.error ? ` (${result.error})` : '';
  console.log(`  - ${label}: ${result.status}, rows=${rows}${suffix}`);
}

function validateRestResult(label, result, minRows) {
  if (!result.ok) {
    failures.push(`[supabase:${label}] Request failed: ${result.status} ${result.error || ''}`.trim());
    return;
  }

  if (!Array.isArray(result.data)) {
    failures.push(`[supabase:${label}] Expected JSON array.`);
    return;
  }

  if (result.data.length < minRows) {
    failures.push(`[supabase:${label}] Expected at least ${minRows} row(s), got ${result.data.length}.`);
  }
}

function requireEnv(name, entry) {
  if (!entry?.value) failures.push(`[env] Missing ${name}.`);
}

function comparePublicValue(label, a, b) {
  console.log('');
  console.log('Environment parity:');
  console.log(`  - ${label}: web=${a.source}, native=${b.source}`);
  if (a.value !== b.value) failures.push(`[env] ${label} differs between web and native.`);
}

function compareSecretFingerprint(label, a, b) {
  console.log(`  - ${label}: web=${a.source}#${fingerprint(a.value)}, native=${b.source}#${fingerprint(b.value)}`);
  if (a.value !== b.value) failures.push(`[env] ${label} differs between web and native.`);
}

function findFirstSet(names) {
  for (const name of names) {
    const entry = loadedEnv.get(name);
    if (entry?.value) return entry;
  }
  return null;
}

function loadEnv(root) {
  const result = new Map();
  const files = ['.env', '.env.local', 'apps/web/.env', 'apps/web/.env.local'];

  for (const file of files) {
    const absolutePath = path.join(root, file);
    if (!fs.existsSync(absolutePath)) continue;

    const text = fs.readFileSync(absolutePath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const name = match[1];
      if (result.has(name)) continue;
      result.set(name, {
        value: normalizeEnvValue(match[2]),
        source: file,
      });
    }
  }

  for (const [name, value] of Object.entries(process.env)) {
    if (!result.has(name) && value) {
      result.set(name, { value, source: 'process.env' });
    }
  }

  return result;
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

function extractIds(value) {
  if (!Array.isArray(value)) return [];
  return value.map((row) => row?.id).filter((id) => typeof id === 'string');
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

function summarizeSupabaseError(data) {
  if (!data || typeof data !== 'object') return 'Supabase error';
  const code = typeof data.code === 'string' ? data.code : '';
  const message = typeof data.message === 'string' ? data.message : '';
  return [code, message].filter(Boolean).join(' ') || 'Supabase error';
}

function safeUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normalizeBase(value) {
  return String(value).replace(/\/+$/, '');
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 10);
}

function readPositiveInt(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected positive integer, got ${value}`);
  }
  return parsed;
}

function parseArgs(rawArgs) {
  const parsed = {
    help: false,
    siteUrl: undefined,
    timeoutMs: undefined,
  };

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (arg === '--help' || arg === '-h') parsed.help = true;
    else if (arg === '--site-url') parsed.siteUrl = rawArgs[++i];
    else if (arg === '--timeout-ms') parsed.timeoutMs = rawArgs[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function formatError(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function printHelp() {
  console.log(`Usage: node scripts/check-native-backend-parity.mjs [options]

Options:
  --site-url <url>     Production site URL (default: ${DEFAULT_SITE_URL})
  --timeout-ms <n>     Per-request timeout (default: ${DEFAULT_TIMEOUT_MS})
  -h, --help           Show this help
`);
}
