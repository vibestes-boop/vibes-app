import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SITE_URL = 'https://serlo-web.vercel.app';
const DEFAULT_LIMIT = 12;
const DEFAULT_MIN_POSTS = 3;
const DEFAULT_TIMEOUT_MS = 8000;
const SORTS = ['forYou', 'trending', 'newest'];

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = loadEnv(repoRoot);
const siteUrl = normalizeBase(args.siteUrl || process.env.STABILITY_SITE_URL || DEFAULT_SITE_URL);
const limit = readPositiveInt(args.limit, DEFAULT_LIMIT);
const minPosts = readNonNegativeInt(args.minPosts, DEFAULT_MIN_POSTS);
const timeoutMs = readPositiveInt(args.timeoutMs, DEFAULT_TIMEOUT_MS);
const failures = [];
const warnings = [];
const checkedFeeds = [];
const checkedSupabase = [];

console.log(`API contract check: ${siteUrl}`);
console.log(`Budget: ${SORTS.join(', ')} feeds, limit ${limit}, minimum ${minPosts} posts per feed.`);

const feedTargets = args.feedUrl
  ? [{ label: 'custom', url: withBudgetBust(args.feedUrl) }]
  : SORTS.map((sort) => ({
      label: sort,
      url: withBudgetBust(`${siteUrl}/api/feed/explore?offset=0&limit=${limit}&sort=${sort}`),
    }));

for (const target of feedTargets) {
  const result = await fetchJsonWithHeaders(target.url, timeoutMs);
  if (!result.ok) {
    failures.push(`[${target.label}] Request failed: ${result.error}`);
    continue;
  }

  const { data, headers, status } = result;
  const cacheControl = headers.get('cache-control') ?? '';
  const validation = validateExploreFeedContract(target.label, data, {
    minPosts,
    requireAnonCache: !args.feedUrl,
  });

  failures.push(...validation.failures);
  warnings.push(...validation.warnings);

  if (!hasPublicCache(cacheControl)) {
    failures.push(`[${target.label}] Missing public anonymous cache header: ${cacheControl || '(missing)'}.`);
  } else if (!hasSharedMaxAge(cacheControl)) {
    warnings.push(`[${target.label}] Anonymous cache header is public but has no s-maxage: ${cacheControl}.`);
  }

  checkedFeeds.push({
    label: target.label,
    status,
    posts: validation.postCount,
    cacheControl,
  });
}

if (!args.feedUrl) {
  const pageTwoUrl = withBudgetBust(`${siteUrl}/api/feed/explore?offset=${limit}&limit=${limit}&sort=forYou`);
  const pageTwo = await fetchJsonWithHeaders(pageTwoUrl, timeoutMs);
  if (!pageTwo.ok) {
    failures.push(`[pagination] Request failed: ${pageTwo.error}`);
  } else {
    const validation = validateExploreFeedContract('pagination', pageTwo.data, {
      minPosts: 0,
      requireAnonCache: true,
    });
    failures.push(...validation.failures);
    warnings.push(...validation.warnings);

    const cacheControl = pageTwo.headers.get('cache-control') ?? '';
    if (!hasPublicCache(cacheControl)) {
      failures.push(`[pagination] Missing public anonymous cache header: ${cacheControl || '(missing)'}.`);
    } else if (!hasSharedMaxAge(cacheControl)) {
      warnings.push(`[pagination] Anonymous cache header is public but has no s-maxage: ${cacheControl}.`);
    }

    checkedFeeds.push({
      label: 'pagination',
      status: pageTwo.status,
      posts: validation.postCount,
      cacheControl,
    });
  }
}

if (!args.skipSupabase) {
  await runSupabaseAnonSmoke(env);
}

console.log('');
console.log('Checked feeds:');
for (const item of checkedFeeds) {
  console.log(`  - ${item.label}: ${item.status}, ${item.posts} posts, cache=${item.cacheControl || '(missing)'}`);
}

if (checkedSupabase.length > 0) {
  console.log('');
  console.log('Checked Supabase anon REST:');
  for (const item of checkedSupabase) {
    console.log(`  - ${item.label}: ${item.status}, ${item.rows} row(s)`);
  }
}

if (warnings.length > 0) {
  console.log('');
  console.log('Warnings:');
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (failures.length > 0) {
  console.log('');
  console.error('API contract check failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('');
console.log('API contract check passed.');

async function runSupabaseAnonSmoke(loadedEnv) {
  const webUrl = findFirstSet(loadedEnv, ['NEXT_PUBLIC_SUPABASE_URL']);
  const nativeUrl = findFirstSet(loadedEnv, ['EXPO_PUBLIC_SUPABASE_URL']);
  const supabaseUrl = webUrl?.value || nativeUrl?.value;
  const supabaseKey =
    findFirstSet(loadedEnv, ['NEXT_PUBLIC_SUPABASE_ANON_KEY'])?.value ||
    findFirstSet(loadedEnv, ['EXPO_PUBLIC_SUPABASE_ANON_KEY'])?.value;

  if (webUrl?.value && nativeUrl?.value && normalizeBase(webUrl.value) !== normalizeBase(nativeUrl.value)) {
    failures.push(
      `[supabase] Web and Native Supabase URLs differ (${webUrl.source} vs ${nativeUrl.source}).`,
    );
  }

  if (!supabaseUrl || !supabaseKey) {
    warnings.push('[supabase] Skipped anon RLS smoke: public Supabase URL/key not available in env.');
    return;
  }

  if (isPlaceholder(supabaseUrl) || isPlaceholder(supabaseKey)) {
    warnings.push('[supabase] Skipped anon RLS smoke: Supabase env value is a placeholder.');
    return;
  }

  const postsUrl =
    `${normalizeBase(supabaseUrl)}/rest/v1/posts` +
    '?select=id,author_id,media_url,media_type,thumbnail_url,privacy,created_at' +
    '&privacy=eq.public&order=created_at.desc&limit=1';
  const profilesUrl =
    `${normalizeBase(supabaseUrl)}/rest/v1/profiles` +
    '?select=id,username,is_verified&limit=1';

  const [posts, profiles] = await Promise.all([
    fetchSupabaseRest(postsUrl, supabaseKey, timeoutMs),
    fetchSupabaseRest(profilesUrl, supabaseKey, timeoutMs),
  ]);

  validateSupabaseRest('posts', posts, { minRows: 1 });
  validateSupabaseRest('profiles', profiles, { minRows: 1 });
}

function validateSupabaseRest(label, result, { minRows }) {
  if (!result.ok) {
    failures.push(`[supabase:${label}] Request failed: ${result.error}`);
    return;
  }

  if (!Array.isArray(result.data)) {
    failures.push(`[supabase:${label}] Expected array response.`);
    return;
  }

  if (result.data.length < minRows) {
    failures.push(`[supabase:${label}] Expected at least ${minRows} row(s), got ${result.data.length}.`);
  }

  checkedSupabase.push({
    label,
    status: result.status,
    rows: result.data.length,
  });
}

function validateExploreFeedContract(label, data, options) {
  const localFailures = [];
  const localWarnings = [];

  if (!isPlainObject(data)) {
    return {
      failures: [`[${label}] Expected JSON object response.`],
      warnings: [],
      postCount: 0,
    };
  }

  if (!Array.isArray(data.posts)) {
    localFailures.push(`[${label}] Missing posts array.`);
    return { failures: localFailures, warnings: localWarnings, postCount: 0 };
  }

  if (typeof data.hasMore !== 'boolean') {
    localFailures.push(`[${label}] hasMore must be boolean.`);
  }

  if (data.posts.length < options.minPosts) {
    localFailures.push(`[${label}] Expected at least ${options.minPosts} posts, got ${data.posts.length}.`);
  }

  const ids = new Set();
  for (const [index, post] of data.posts.slice(0, limit).entries()) {
    const prefix = `[${label}] post[${index}]`;
    validatePost(prefix, post, localFailures, localWarnings);

    if (isPlainObject(post) && typeof post.id === 'string') {
      if (ids.has(post.id)) localFailures.push(`${prefix} duplicate id ${post.id}.`);
      ids.add(post.id);
    }
  }

  return {
    failures: localFailures,
    warnings: localWarnings,
    postCount: data.posts.length,
  };
}

function validatePost(prefix, post, localFailures, localWarnings) {
  if (!isPlainObject(post)) {
    localFailures.push(`${prefix} must be an object.`);
    return;
  }

  requireString(prefix, post, 'id', localFailures);
  requireString(prefix, post, 'user_id', localFailures);
  requireString(prefix, post, 'created_at', localFailures);
  requireStringOrNull(prefix, post, 'caption', localFailures);
  requireNumber(prefix, post, 'view_count', localFailures);
  requireNumber(prefix, post, 'like_count', localFailures);
  requireNumber(prefix, post, 'comment_count', localFailures);
  requireBoolean(prefix, post, 'allow_comments', localFailures);
  requireBoolean(prefix, post, 'allow_duet', localFailures);
  requireBoolean(prefix, post, 'allow_download', localFailures);
  requireBoolean(prefix, post, 'liked_by_me', localFailures);
  requireBoolean(prefix, post, 'saved_by_me', localFailures);
  requireBoolean(prefix, post, 'following_author', localFailures);
  requireBoolean(prefix, post, 'reposted_by_me', localFailures);

  if (!Array.isArray(post.hashtags)) {
    localFailures.push(`${prefix}.hashtags must be an array.`);
  }

  if (!['image', 'video', null].includes(post.media_type)) {
    localFailures.push(`${prefix}.media_type must be image, video, or null.`);
  }

  if (!['public', 'friends', 'private'].includes(post.privacy)) {
    localFailures.push(`${prefix}.privacy must be public, friends, or private.`);
  }

  if (!['portrait', 'landscape', 'square'].includes(post.aspect_ratio)) {
    localFailures.push(`${prefix}.aspect_ratio must be portrait, landscape, or square.`);
  }

  if (typeof post.created_at === 'string' && Number.isNaN(Date.parse(post.created_at))) {
    localFailures.push(`${prefix}.created_at must be parseable ISO datetime.`);
  }

  if (post.media_type === 'video' && !isHttpUrl(post.thumbnail_url)) {
    localFailures.push(`${prefix} is video but thumbnail_url is missing or invalid.`);
  }

  if (!isHttpUrl(post.video_url)) {
    localFailures.push(`${prefix}.video_url must be an absolute HTTP URL.`);
  }

  if (!isPlainObject(post.author)) {
    localFailures.push(`${prefix}.author must be an object.`);
  } else {
    requireString(`${prefix}.author`, post.author, 'id', localFailures);
    requireString(`${prefix}.author`, post.author, 'username', localFailures);
    requireStringOrNull(`${prefix}.author`, post.author, 'display_name', localFailures);
    requireStringOrNull(`${prefix}.author`, post.author, 'avatar_url', localFailures);
    requireBoolean(`${prefix}.author`, post.author, 'verified', localFailures);

    if (typeof post.user_id === 'string' && typeof post.author.id === 'string' && post.user_id !== post.author.id) {
      localFailures.push(`${prefix}.user_id must match author.id.`);
    }
  }

  const mediaHost = getUrlHost(post.video_url);
  const thumbHost = getUrlHost(post.thumbnail_url);
  if (post.media_type === 'video' && mediaHost && thumbHost && mediaHost !== thumbHost) {
    localWarnings.push(`${prefix} video and thumbnail use different hosts (${mediaHost} vs ${thumbHost}).`);
  }
}

async function fetchJsonWithHeaders(url, timeout) {
  try {
    const response = await fetchWithTimeout(url, { headers: { accept: 'application/json' } }, timeout);
    const text = await response.text();
    if (!response.ok) {
      return { ok: false, error: `${response.status} ${text.slice(0, 300)}` };
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, error: `Invalid JSON (${text.slice(0, 120)})` };
    }

    return { ok: true, data, headers: response.headers, status: response.status };
  } catch (error) {
    return { ok: false, error: formatError(error) };
  }
}

async function fetchSupabaseRest(url, key, timeout) {
  const headers = {
    accept: 'application/json',
    apikey: key,
  };
  if (key.startsWith('eyJ')) headers.authorization = `Bearer ${key}`;

  return fetchJsonWithHeadersWithInit(url, { headers }, timeout);
}

async function fetchJsonWithHeadersWithInit(url, init, timeout) {
  try {
    const response = await fetchWithTimeout(url, init, timeout);
    const text = await response.text();
    if (!response.ok) {
      return { ok: false, error: `${response.status} ${text.slice(0, 300)}` };
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, error: `Invalid JSON (${text.slice(0, 120)})` };
    }

    return { ok: true, data, headers: response.headers, status: response.status };
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

function requireString(prefix, object, key, localFailures) {
  if (typeof object[key] !== 'string' || object[key].length === 0) {
    localFailures.push(`${prefix}.${key} must be a non-empty string.`);
  }
}

function requireStringOrNull(prefix, object, key, localFailures) {
  if (!(typeof object[key] === 'string' || object[key] === null)) {
    localFailures.push(`${prefix}.${key} must be string or null.`);
  }
}

function requireNumber(prefix, object, key, localFailures) {
  if (typeof object[key] !== 'number' || !Number.isFinite(object[key])) {
    localFailures.push(`${prefix}.${key} must be a finite number.`);
  }
}

function requireBoolean(prefix, object, key, localFailures) {
  if (typeof object[key] !== 'boolean') {
    localFailures.push(`${prefix}.${key} must be boolean.`);
  }
}

function hasPublicCache(value) {
  if (!value) return false;
  const lower = value.toLowerCase();
  return lower.includes('public') && !lower.includes('private') && !lower.includes('no-store');
}

function hasSharedMaxAge(value) {
  if (!value) return false;
  return value.toLowerCase().includes('s-maxage=');
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isHttpUrl(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function getUrlHost(value) {
  if (!isHttpUrl(value)) return null;
  return new URL(value).host;
}

function withBudgetBust(value) {
  const url = new URL(value);
  url.searchParams.set('contract_bust', String(Date.now()));
  return url.toString();
}

function normalizeBase(value) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function loadEnv(root) {
  const loaded = new Map();
  const files = ['.env', '.env.local', 'apps/web/.env', 'apps/web/.env.local'];

  for (const file of files) {
    const absolutePath = path.join(root, file);
    if (!fs.existsSync(absolutePath)) continue;
    const text = fs.readFileSync(absolutePath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const name = match[1];
      if (loaded.has(name)) continue;
      loaded.set(name, {
        value: normalizeEnvValue(match[2]),
        source: file,
      });
    }
  }

  for (const [name, value] of Object.entries(process.env)) {
    if (!loaded.has(name) && value) {
      loaded.set(name, { value, source: 'process.env' });
    }
  }

  return loaded;
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

function findFirstSet(loadedEnv, names) {
  for (const name of names) {
    const entry = loadedEnv.get(name);
    if (entry?.value) return entry;
  }
  return null;
}

function isPlaceholder(value) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === '' ||
    normalized === 'your_key_here' ||
    normalized === 'hier_dein_neuer_cloudflare_token' ||
    normalized.includes('<project>') ||
    normalized.includes('<domain>') ||
    normalized.includes('example') ||
    normalized.includes('changeme')
  );
}

function parseArgs(rawArgs) {
  const parsed = {
    feedUrl: undefined,
    help: false,
    limit: undefined,
    minPosts: undefined,
    siteUrl: undefined,
    skipSupabase: false,
    timeoutMs: undefined,
  };

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (arg === '--feed-url') parsed.feedUrl = rawArgs[++i];
    else if (arg === '--help' || arg === '-h') parsed.help = true;
    else if (arg === '--limit') parsed.limit = rawArgs[++i];
    else if (arg === '--min-posts') parsed.minPosts = rawArgs[++i];
    else if (arg === '--site-url') parsed.siteUrl = rawArgs[++i];
    else if (arg === '--skip-supabase') parsed.skipSupabase = true;
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

function readNonNegativeInt(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Expected non-negative integer, got ${value}`);
  }
  return parsed;
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function printHelp() {
  console.log(`
Usage:
  npm run stability:api-contracts -- [options]

Options:
  --site-url <url>       Site base URL (default: ${DEFAULT_SITE_URL})
  --feed-url <url>       Exact feed API URL to validate instead of all Explore sorts
  --limit <n>            Number of posts requested per feed (default: ${DEFAULT_LIMIT})
  --min-posts <n>        Minimum posts expected per primary feed (default: ${DEFAULT_MIN_POSTS})
  --skip-supabase        Skip optional direct Supabase anon/RLS smoke
  --timeout-ms <n>       Per-request timeout in ms (default: ${DEFAULT_TIMEOUT_MS})

Checks:
  - Explore API returns stable JSON: { posts, hasMore }
  - Post rows keep the web/native feed contract fields
  - Anonymous responses keep CDN cache headers
  - Optional Supabase anon REST smoke catches RLS/env drift when env is available
`);
}
