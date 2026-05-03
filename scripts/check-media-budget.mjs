const DEFAULT_SITE_URL = 'https://serlo-web.vercel.app';
const DEFAULT_LIMIT = 24;
const DEFAULT_MAX_TOTAL_MB = 5;
const DEFAULT_MAX_ITEM_MB = 1;
const DEFAULT_TIMEOUT_MS = 8000;

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const limit = readPositiveInt(args.limit, DEFAULT_LIMIT);
const maxTotalBytes = mbToBytes(readPositiveNumber(args.maxTotalMb, DEFAULT_MAX_TOTAL_MB));
const maxItemBytes = mbToBytes(readPositiveNumber(args.maxItemMb, DEFAULT_MAX_ITEM_MB));
const timeoutMs = readPositiveInt(args.timeoutMs, DEFAULT_TIMEOUT_MS);
const feedUrl = buildFeedUrl(args.feedUrl, limit);

const failures = [];
const warnings = [];

console.log(`Media budget check: ${feedUrl}`);
console.log(
  `Budget: first ${limit} posts, total <= ${formatBytes(maxTotalBytes)}, ` +
    `item <= ${formatBytes(maxItemBytes)}.`,
);

const feed = await fetchJson(feedUrl, timeoutMs);
const posts = Array.isArray(feed.posts) ? feed.posts : Array.isArray(feed) ? feed : [];

if (posts.length === 0) {
  failures.push('Feed returned 0 posts.');
}

let totalBytes = 0;
const checked = [];

for (const post of posts.slice(0, limit)) {
  const mediaType = post.media_type ?? post.mediaType ?? null;
  const thumbnailUrl = post.thumbnail_url ?? post.thumbnailUrl ?? null;
  const mediaUrl = post.media_url ?? post.mediaUrl ?? post.video_url ?? post.videoUrl ?? null;
  const url = thumbnailUrl || mediaUrl;

  if (mediaType === 'video' && !thumbnailUrl) {
    failures.push(`Post ${post.id ?? '(unknown)'} is video but has no thumbnail_url.`);
  }

  if (!url) {
    failures.push(`Post ${post.id ?? '(unknown)'} has no thumbnail/media URL.`);
    continue;
  }

  const head = await headMedia(url, timeoutMs);
  if (!head.ok) {
    failures.push(`HEAD failed for post ${post.id ?? '(unknown)'}: ${head.status ?? head.error}`);
    continue;
  }

  if (!head.contentLength) {
    failures.push(`Missing Content-Length for post ${post.id ?? '(unknown)'}: ${url}`);
    continue;
  }

  const bytes = Number(head.contentLength);
  totalBytes += bytes;

  if (bytes > maxItemBytes) {
    failures.push(
      `Post ${post.id ?? '(unknown)'} media is ${formatBytes(bytes)}, over ${formatBytes(maxItemBytes)}.`,
    );
  }

  if (!hasStrongCacheControl(head.cacheControl)) {
    failures.push(
      `Post ${post.id ?? '(unknown)'} media lacks strong Cache-Control: ${head.cacheControl ?? '(missing)'}.`,
    );
  }

  checked.push({
    id: post.id ?? '(unknown)',
    type: mediaType ?? '(unknown)',
    bytes,
    cacheControl: head.cacheControl,
    url,
  });
}

if (totalBytes > maxTotalBytes) {
  failures.push(
    `Total checked media is ${formatBytes(totalBytes)}, over ${formatBytes(maxTotalBytes)}.`,
  );
}

const largest = [...checked].sort((a, b) => b.bytes - a.bytes).slice(0, 5);

console.log('');
console.log(`Checked posts: ${checked.length}/${posts.length}`);
console.log(`Total media: ${formatBytes(totalBytes)}`);
console.log('Largest media:');
for (const item of largest) {
  console.log(`  - ${item.id} ${item.type} ${formatBytes(item.bytes)} ${shortUrl(item.url)}`);
}

if (warnings.length > 0) {
  console.log('');
  console.log('Warnings:');
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (failures.length > 0) {
  console.log('');
  console.error('Media budget failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('');
console.log('Media budget passed.');

async function fetchJson(url, timeout) {
  const response = await fetchWithTimeout(url, { headers: { accept: 'application/json' } }, timeout);
  if (!response.ok) {
    throw new Error(`Feed request failed: ${response.status} ${await safeText(response)}`);
  }
  return response.json();
}

async function headMedia(url, timeout) {
  try {
    const response = await fetchWithTimeout(url, { method: 'HEAD' }, timeout);
    return {
      ok: response.ok,
      status: response.status,
      contentLength: response.headers.get('content-length'),
      cacheControl: response.headers.get('cache-control'),
    };
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

function buildFeedUrl(value, limitValue) {
  const raw =
    value ||
    process.env.STABILITY_FEED_URL ||
    `${normalizeBase(process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL)}/api/feed/explore?offset=0&limit=${limitValue}&sort=forYou`;
  const url = new URL(raw);
  if (!url.searchParams.has('limit')) url.searchParams.set('limit', String(limitValue));
  url.searchParams.set('budget_bust', String(Date.now()));
  return url.toString();
}

function hasStrongCacheControl(value) {
  if (!value) return false;
  const lower = value.toLowerCase();
  return lower.includes('max-age=31536000') && lower.includes('immutable');
}

function parseArgs(rawArgs) {
  const parsed = {
    feedUrl: undefined,
    help: false,
    limit: undefined,
    maxItemMb: undefined,
    maxTotalMb: undefined,
    timeoutMs: undefined,
  };

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (arg === '--feed-url') parsed.feedUrl = rawArgs[++i];
    else if (arg === '--help' || arg === '-h') parsed.help = true;
    else if (arg === '--limit') parsed.limit = rawArgs[++i];
    else if (arg === '--max-item-mb') parsed.maxItemMb = rawArgs[++i];
    else if (arg === '--max-total-mb') parsed.maxTotalMb = rawArgs[++i];
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

function readPositiveNumber(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected positive number, got ${value}`);
  }
  return parsed;
}

function mbToBytes(value) {
  return Math.round(value * 1024 * 1024);
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function shortUrl(value) {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}`;
  } catch {
    return value;
  }
}

function normalizeBase(value) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

async function safeText(response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function printHelp() {
  console.log(`
Usage:
  npm run stability:media-budget -- [options]

Options:
  --feed-url <url>       Feed API URL to inspect (default: production Explore feed)
  --limit <n>            Number of first posts to inspect (default: ${DEFAULT_LIMIT})
  --max-total-mb <n>     Max total media bytes for inspected posts (default: ${DEFAULT_MAX_TOTAL_MB})
  --max-item-mb <n>      Max media bytes for one inspected item (default: ${DEFAULT_MAX_ITEM_MB})
  --timeout-ms <n>       Per-request timeout in ms (default: ${DEFAULT_TIMEOUT_MS})

Checks:
  - video posts must have thumbnail_url
  - selected grid media must expose Content-Length
  - selected grid media must have immutable Cache-Control
  - total and per-item byte budgets must stay below thresholds
`);
}
