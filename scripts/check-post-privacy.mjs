import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SITE_URL = 'https://serlo-web.vercel.app';
const DEFAULT_TIMEOUT_MS = 8000;

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = loadEnv(repoRoot);
const siteUrl = normalizeBase(args.siteUrl || process.env.STABILITY_SITE_URL || DEFAULT_SITE_URL);
const timeoutMs = readPositiveInt(args.timeoutMs, DEFAULT_TIMEOUT_MS);
const publicUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const failures = [];
const warnings = [];
const checked = [];

console.log(`Post privacy check: ${siteUrl}`);
console.log('No secret values are printed.');

if (!publicUrl || !anonKey) {
  console.error('Missing Supabase public env: NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const anonHeaders = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  accept: 'application/json',
  'Content-Type': 'application/json',
};

const serviceHeaders = serviceKey
  ? {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      accept: 'application/json',
      'Content-Type': 'application/json',
    }
  : null;

await checkAnonHiddenRows('anon non-public posts', 'posts?select=id,privacy,women_only&privacy=neq.public&limit=5');
await checkAnonHiddenRows('anon women-only posts', 'posts?select=id,privacy,women_only&women_only=eq.true&limit=5');
await checkPublicRows();
await checkExploreFeed();
await checkProfilePostsRpc();
await checkServiceRoleCanary();

console.log('');
console.log('Checked privacy surfaces:');
for (const item of checked) {
  console.log(`  - ${item.label}: ${item.status}, ${item.rows} row(s), ${item.durationMs}ms`);
}

if (warnings.length > 0) {
  console.log('');
  console.log('Warnings:');
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (failures.length > 0) {
  console.log('');
  console.error('Post privacy check failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('');
console.log('Post privacy check passed.');

async function checkAnonHiddenRows(label, restPath) {
  const result = await supabaseGet(restPath, anonHeaders, label);
  if (!result.ok) {
    failures.push(`[${label}] Request failed: ${result.error}`);
    return;
  }

  if (result.rows.length !== 0) {
    failures.push(`[${label}] Expected 0 anon-visible rows, got ${result.rows.length}.`);
  }

  checked.push({
    label,
    status: result.status,
    rows: result.rows.length,
    durationMs: result.durationMs,
  });
}

async function checkPublicRows() {
  const label = 'anon public posts';
  const result = await supabaseGet(
    'posts?select=id,privacy,women_only&privacy=eq.public&women_only=eq.false&limit=5',
    anonHeaders,
    label,
  );
  if (!result.ok) {
    failures.push(`[${label}] Request failed: ${result.error}`);
    return;
  }
  if (result.rows.length === 0) warnings.push(`[${label}] No sample public posts found.`);
  checked.push({ label, status: result.status, rows: result.rows.length, durationMs: result.durationMs });
}

async function checkExploreFeed() {
  const label = 'public explore feed';
  const result = await fetchJson(
    `${siteUrl}/api/feed/explore?offset=0&limit=12&sort=forYou&privacy_bust=${Date.now()}`,
    label,
  );
  if (!result.ok) {
    failures.push(`[${label}] Request failed: ${result.error}`);
    return;
  }

  const posts = Array.isArray(result.data?.posts)
    ? result.data.posts
    : Array.isArray(result.data)
      ? result.data
      : [];

  for (const post of posts) {
    if (post?.privacy && post.privacy !== 'public') {
      failures.push(`[${label}] Post ${post.id ?? '(unknown)'} exposes privacy=${post.privacy}.`);
    }
    if (post?.women_only === true || post?.womenOnly === true) {
      failures.push(`[${label}] Post ${post.id ?? '(unknown)'} exposes women_only=true to anon.`);
    }
  }

  checked.push({ label, status: result.status, rows: posts.length, durationMs: result.durationMs });
}

async function checkProfilePostsRpc() {
  const sample = await supabaseGet(
    'posts?select=author_id&privacy=eq.public&women_only=eq.false&limit=1',
    anonHeaders,
    'profile rpc sample',
  );
  if (!sample.ok || sample.rows.length === 0) {
    warnings.push('[profile posts rpc] Skipped: no public post sample available.');
    return;
  }

  const label = 'profile posts rpc';
  const authorId = sample.rows[0].author_id;
  const result = await supabaseRpc(
    'get_profile_posts_web',
    {
      p_user_id: authorId,
      result_limit: 24,
      result_offset: 0,
      before_ts: null,
      sort_key: 'newest',
    },
    anonHeaders,
    label,
  );
  if (!result.ok) {
    failures.push(`[${label}] Request failed: ${result.error}`);
    return;
  }

  for (const post of result.rows) {
    if (post?.women_only === true) {
      failures.push(`[${label}] Post ${post.id ?? '(unknown)'} exposes women_only=true to anon.`);
    }
  }

  checked.push({ label, status: result.status, rows: result.rows.length, durationMs: result.durationMs });
}

async function checkServiceRoleCanary() {
  if (!serviceHeaders) {
    warnings.push('[service canary] Skipped: SUPABASE_SERVICE_ROLE_KEY is not set.');
    return;
  }

  const candidates = [
    ['service private/friends candidate', 'posts?select=id,privacy,women_only&privacy=neq.public&limit=1'],
    ['service women-only candidate', 'posts?select=id,privacy,women_only&women_only=eq.true&limit=1'],
  ];

  for (const [candidateLabel, restPath] of candidates) {
    const candidate = await supabaseGet(restPath, serviceHeaders, candidateLabel);
    if (!candidate.ok) {
      warnings.push(`[${candidateLabel}] Skipped: ${candidate.error}`);
      continue;
    }
    if (candidate.rows.length === 0) continue;

    const row = candidate.rows[0];
    const label = `anon hidden canary ${row.id}`;
    const anon = await supabaseGet(
      `posts?select=id,privacy,women_only&id=eq.${encodeURIComponent(row.id)}&limit=1`,
      anonHeaders,
      label,
    );
    if (!anon.ok) {
      failures.push(`[${label}] Request failed: ${anon.error}`);
      continue;
    }
    if (anon.rows.length !== 0) {
      failures.push(`[${label}] Expected hidden row to stay invisible, got ${anon.rows.length}.`);
    }
    checked.push({ label, status: anon.status, rows: anon.rows.length, durationMs: anon.durationMs });
  }
}

async function supabaseGet(restPath, headers, label) {
  return fetchJson(`${normalizeBase(publicUrl)}/rest/v1/${restPath}`, label, { headers });
}

async function supabaseRpc(name, body, headers, label) {
  return fetchJson(`${normalizeBase(publicUrl)}/rest/v1/rpc/${name}`, label, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

async function fetchJson(url, label, init = {}) {
  const start = Date.now();
  try {
    const response = await fetchWithTimeout(url, init, timeoutMs);
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return {
        ok: false,
        status: response.status,
        durationMs: Date.now() - start,
        error: `${response.status} non-JSON response for ${label}`,
      };
    }
    return {
      ok: response.ok,
      status: response.status,
      durationMs: Date.now() - start,
      data,
      rows: Array.isArray(data) ? data : [],
      error: response.ok ? null : `${response.status} ${safeMessage(data)}`,
    };
  } catch (error) {
    return { ok: false, status: 0, durationMs: Date.now() - start, error: formatError(error) };
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

function loadEnv(root) {
  const loaded = {};
  for (const rel of ['.env', '.env.local', 'apps/web/.env.local']) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (loaded[key] === undefined) loaded[key] = value;
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
  return { ...loaded, ...process.env };
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

function readPositiveInt(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected positive integer, got ${value}`);
  }
  return parsed;
}

function normalizeBase(value) {
  return String(value).replace(/\/+$/, '');
}

function safeMessage(data) {
  if (data && typeof data === 'object' && typeof data.message === 'string') return data.message;
  return 'request failed';
}

function formatError(error) {
  if (error?.name === 'AbortError') return `timeout after ${timeoutMs}ms`;
  return error instanceof Error ? error.message : String(error);
}

function printHelp() {
  console.log(`Usage: npm run stability:privacy -- [options]

Options:
  --site-url <url>      Site URL to check (default: ${DEFAULT_SITE_URL})
  --timeout-ms <ms>     Request timeout (default: ${DEFAULT_TIMEOUT_MS})
  -h, --help            Show this help
`);
}
