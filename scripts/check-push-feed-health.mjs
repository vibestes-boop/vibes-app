import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SITE_URL = 'https://serlo-web.vercel.app';
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_FEED_LIMIT = 12;
const DEFAULT_MIN_FEED_POSTS = 3;
const DEFAULT_MAX_STALE_PUSH_TOKENS = 50;
const DEFAULT_MAX_STALE_WEB_SUBS = 50;
const DEFAULT_MAX_VIDEO_WITHOUT_THUMBNAIL = 0;
const DEFAULT_MAX_LATEST_PUBLIC_POST_AGE_DAYS = 30;
const FEED_TARGETS = [
  { label: 'explore.forYou', path: '/api/feed/explore?offset=0&limit={limit}&sort=forYou', shape: 'explore' },
  { label: 'explore.trending', path: '/api/feed/explore?offset=0&limit={limit}&sort=trending', shape: 'explore' },
  { label: 'explore.newest', path: '/api/feed/explore?offset=0&limit={limit}&sort=newest', shape: 'explore' },
  { label: 'feed.foryou', path: '/api/feed/foryou?limit={limit}', shape: 'array' },
];

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

loadEnv(repoRoot);

const supabaseUrl = normalizeBase(
  args.supabaseUrl ||
    readEnv('NEXT_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'),
);
const anonKey =
  args.anonKey ||
  readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');
const siteUrl = normalizeBase(args.siteUrl || process.env.STABILITY_SITE_URL || DEFAULT_SITE_URL);
const timeoutMs = readPositiveInt(args.timeoutMs, DEFAULT_TIMEOUT_MS);
const feedLimit = readPositiveInt(args.feedLimit, DEFAULT_FEED_LIMIT);
const minFeedPosts = readNonNegativeInt(args.minFeedPosts, DEFAULT_MIN_FEED_POSTS);
const maxStalePushTokens = readNonNegativeInt(args.maxStalePushTokens, DEFAULT_MAX_STALE_PUSH_TOKENS);
const maxStaleWebSubs = readNonNegativeInt(args.maxStaleWebSubs, DEFAULT_MAX_STALE_WEB_SUBS);
const maxVideoWithoutThumbnail = readNonNegativeInt(
  args.maxVideoWithoutThumbnail,
  DEFAULT_MAX_VIDEO_WITHOUT_THUMBNAIL,
);
const maxLatestPublicPostAgeDays = readPositiveInt(
  args.maxLatestPublicPostAgeDays,
  DEFAULT_MAX_LATEST_PUBLIC_POST_AGE_DAYS,
);
const failures = [];
const warnings = [];
const checkedFeeds = [];

console.log('Push/feed health check');
console.log('No secret values are printed.');

if (!supabaseUrl) failures.push('[env] Missing NEXT_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL.');
if (!anonKey) failures.push('[env] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY.');

let snapshot = null;
if (failures.length === 0) {
  snapshot = await fetchSnapshot();
  if (snapshot) {
    printSnapshot(snapshot);
    evaluateSnapshot(snapshot);
  }
}

if (failures.length === 0 && !args.skipFeedEndpoints) {
  await checkFeedEndpoints();
}

if (checkedFeeds.length > 0) {
  console.log('');
  console.log('Feed Endpoints:');
  for (const item of checkedFeeds) {
    console.log(`  - ${item.label}: ${item.status}, posts=${item.posts}, cache=${item.cache || '(missing)'}`);
  }
}

if (warnings.length > 0) {
  console.log('');
  console.log('Warnings:');
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (failures.length > 0) {
  console.log('');
  console.error('Push/feed health check failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('');
console.log('Push/feed health check passed.');

async function fetchSnapshot() {
  const response = await fetchWithTimeout(`${supabaseUrl}/rest/v1/rpc/push_feed_health_snapshot`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
      'content-type': 'application/json',
    },
    body: '{}',
  });
  const text = await response.text();

  if (!response.ok) {
    failures.push(`[snapshot] push_feed_health_snapshot failed: ${response.status} ${summarize(text)}`.trim());
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    failures.push('[snapshot] push_feed_health_snapshot returned invalid JSON.');
    return null;
  }
}

function printSnapshot(data) {
  const push = data.push || {};
  const native = push.native_tokens || {};
  const web = push.web_subscriptions || {};
  const notifications = push.notifications || {};
  const triggers = push.triggers || {};
  const feed = data.feed || {};

  console.log('');
  console.log(`Generated: ${data.generated_at}`);

  console.log('');
  console.log('Push:');
  console.log(`  - native tokens: available=${Boolean(native.available)}, total=${number(native.total)}, active_30d=${number(native.active_30d)}, stale_90d=${number(native.stale_90d)}`);
  console.log(`  - web subs: available=${Boolean(web.available)}, total=${number(web.total)}, active_60d=${number(web.active_60d)}, stale_60d=${number(web.stale_60d)}`);
  console.log(`  - notifications: available=${Boolean(notifications.available)}, 24h=${number(notifications.created_24h)}, 7d=${number(notifications.created_7d)}, unread=${number(notifications.unread_total)}, oldest_unread=${formatAge(notifications.oldest_unread_age_seconds)}`);
  console.log(`  - triggers: notification=${Boolean(triggers.notifications_push_trigger)}, web_dm=${Boolean(triggers.messages_web_push_trigger)}, pg_net=${Boolean(triggers.pg_net_available)}`);

  console.log('');
  console.log('Feed DB:');
  console.log(`  - public posts total/7d: ${number(feed.public_posts_total)}/${number(feed.public_posts_7d)}`);
  console.log(`  - public media posts: ${number(feed.public_media_posts_total)}`);
  console.log(`  - public videos without thumbnail: ${number(feed.public_video_posts_without_thumbnail)}`);
  console.log(`  - latest public post age: ${formatAge(feed.latest_public_post_age_seconds)}`);
}

function evaluateSnapshot(data) {
  const push = data.push || {};
  const native = push.native_tokens || {};
  const web = push.web_subscriptions || {};
  const notifications = push.notifications || {};
  const triggers = push.triggers || {};
  const feed = data.feed || {};

  if (native.available && Number(native.stale_90d || 0) > maxStalePushTokens) {
    failures.push(`[push] Stale native push tokens ${native.stale_90d} > ${maxStalePushTokens}.`);
  }
  if (web.available && Number(web.stale_60d || 0) > maxStaleWebSubs) {
    failures.push(`[push] Stale web push subscriptions ${web.stale_60d} > ${maxStaleWebSubs}.`);
  }
  if (!notifications.available) {
    failures.push('[push] notifications table is not available.');
  }
  if (!triggers.notifications_push_trigger) {
    warnings.push('[push] notifications push trigger is not active.');
  }
  if (web.available && Number(web.total || 0) > 0 && !triggers.messages_web_push_trigger) {
    failures.push('[push] web push subscriptions exist but DM web push trigger is not active.');
  }
  if (Number(feed.public_posts_total || 0) < minFeedPosts) {
    failures.push(`[feed] Public posts ${feed.public_posts_total || 0} < ${minFeedPosts}.`);
  }
  if (Number(feed.public_video_posts_without_thumbnail || 0) > maxVideoWithoutThumbnail) {
    failures.push(
      `[feed] Public video posts without thumbnail ${feed.public_video_posts_without_thumbnail} > ${maxVideoWithoutThumbnail}.`,
    );
  }
  const latestAgeSeconds = Number(feed.latest_public_post_age_seconds);
  if (
    Number.isFinite(latestAgeSeconds) &&
    latestAgeSeconds > maxLatestPublicPostAgeDays * 24 * 60 * 60
  ) {
    warnings.push(
      `[feed] Latest public post is ${formatAge(latestAgeSeconds)} old ` +
        `(warn>${maxLatestPublicPostAgeDays}d).`,
    );
  }
}

async function checkFeedEndpoints() {
  for (const target of FEED_TARGETS) {
    const url = withBudgetBust(`${siteUrl}${target.path.replace('{limit}', String(feedLimit))}`);
    const response = await fetchWithTimeout(url, {
      headers: { accept: 'application/json', 'user-agent': 'SerloPushFeedHealth/1.0' },
    });
    const text = await response.text();
    if (!response.ok) {
      failures.push(`[feed:${target.label}] Request failed: ${response.status} ${summarize(text)}`.trim());
      continue;
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      failures.push(`[feed:${target.label}] Invalid JSON response.`);
      continue;
    }

    const posts = target.shape === 'array' ? data : data?.posts;
    if (!Array.isArray(posts)) {
      failures.push(`[feed:${target.label}] Expected ${target.shape === 'array' ? 'array' : 'object.posts array'}.`);
      continue;
    }
    if (posts.length < minFeedPosts) {
      failures.push(`[feed:${target.label}] Expected at least ${minFeedPosts} posts, got ${posts.length}.`);
    }
    if (posts.some((post) => !post || typeof post.id !== 'string')) {
      failures.push(`[feed:${target.label}] One or more posts are missing ids.`);
    }

    checkedFeeds.push({
      label: target.label,
      status: response.status,
      posts: posts.length,
      cache: response.headers.get('cache-control') || '',
    });
  }
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

function loadEnv(root) {
  for (const relative of ['apps/web/.env.local', '.env.local', '.env']) {
    const file = path.join(root, relative);
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = normalizeEnvValue(match[2]);
    }
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

function withBudgetBust(url) {
  const parsed = new URL(url);
  parsed.searchParams.set('health_bust', String(Date.now()));
  return parsed.toString();
}

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readNonNegativeInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function number(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? new Intl.NumberFormat('en-US').format(numeric) : 'n/a';
}

function formatAge(seconds) {
  if (seconds === null || seconds === undefined) return 'none';
  const numeric = Number(seconds);
  if (!Number.isFinite(numeric)) return 'none';
  if (numeric < 60) return `${Math.round(numeric)}s`;
  if (numeric < 3600) return `${Math.round(numeric / 60)}m`;
  if (numeric < 86400) return `${Math.round(numeric / 3600)}h`;
  return `${Math.round(numeric / 86400)}d`;
}

function summarize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function printHelp() {
  console.log(`
Usage: node scripts/check-push-feed-health.mjs [options]

Options:
  --site-url <url>                    Web app URL (default ${DEFAULT_SITE_URL})
  --feed-limit <n>                    Posts requested from each feed endpoint (default ${DEFAULT_FEED_LIMIT})
  --min-feed-posts <n>                Minimum posts expected from public feed endpoints (default ${DEFAULT_MIN_FEED_POSTS})
  --max-stale-push-tokens <n>         Native push tokens older than 90d allowed (default ${DEFAULT_MAX_STALE_PUSH_TOKENS})
  --max-stale-web-subs <n>            Web push subscriptions older than 60d allowed (default ${DEFAULT_MAX_STALE_WEB_SUBS})
  --max-video-without-thumbnail <n>   Public video posts without thumbnail allowed (default ${DEFAULT_MAX_VIDEO_WITHOUT_THUMBNAIL})
  --max-latest-public-post-age-days <n> Warn when latest public post is older than this (default ${DEFAULT_MAX_LATEST_PUBLIC_POST_AGE_DAYS})
  --skip-feed-endpoints               Only check the Supabase snapshot
`);
}
