const DEFAULT_SITE_URL = 'https://serlo-web.vercel.app';
const DEFAULT_LIMIT = 12;
const DEFAULT_TIMEOUT_MS = 10000;
const SCAN_BYTES = 2 * 1024 * 1024;

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const limit = readPositiveInt(args.limit, DEFAULT_LIMIT);
const timeoutMs = readPositiveInt(args.timeoutMs, DEFAULT_TIMEOUT_MS);
const feedUrl = buildFeedUrl(args.feedUrl, limit);
const failures = [];
const warnings = [];
const checked = [];

console.log('Media playback health check');
console.log('No secret values are printed.');
console.log(`Feed: ${feedUrl}`);
console.log(`Budget: first ${limit} posts, video start scan <= ${formatBytes(SCAN_BYTES)}.`);

const feed = await fetchJson(feedUrl, timeoutMs);
const posts = Array.isArray(feed.posts) ? feed.posts : Array.isArray(feed) ? feed : [];

if (posts.length === 0) failures.push('Feed returned 0 posts.');

for (const post of posts.slice(0, limit)) {
  const mediaType = post.media_type ?? post.mediaType ?? null;
  if (mediaType !== 'video') continue;

  const id = post.id ?? '(unknown)';
  const mediaUrl = post.media_url ?? post.mediaUrl ?? post.video_url ?? post.videoUrl ?? null;
  const thumbnailUrl = post.thumbnail_url ?? post.thumbnailUrl ?? null;

  if (!mediaUrl) {
    failures.push(`Video post ${id} has no media_url.`);
    continue;
  }
  if (!thumbnailUrl) {
    failures.push(`Video post ${id} has no thumbnail_url.`);
  }

  const head = await headMedia(mediaUrl, timeoutMs);
  if (!head.ok) {
    failures.push(`HEAD failed for video post ${id}: ${head.status ?? head.error}`);
    continue;
  }

  const contentType = (head.contentType || '').toLowerCase();
  if (contentType && !contentType.includes('video') && !contentType.includes('mp4') && !contentType.includes('quicktime')) {
    failures.push(`Video post ${id} media content-type is not video-like: ${head.contentType}`);
  }

  const range = await fetchRange(mediaUrl, timeoutMs);
  if (!range.ok) {
    failures.push(`Range scan failed for video post ${id}: ${range.status ?? range.error}`);
    continue;
  }

  if (range.status !== 206) {
    warnings.push(`Video post ${id} did not return HTTP 206 for range request (got ${range.status}).`);
  }

  const inspection = inspectMp4FastStart(new Uint8Array(range.bytes), contentType);
  if (inspection.status === 'slow-start') {
    failures.push(`Video post ${id} is slow-start (${inspection.reason}). Re-encode/re-upload it.`);
  } else if (inspection.status === 'not-mp4') {
    warnings.push(`Video post ${id} is not mp4-like (${inspection.reason}).`);
  } else if (inspection.status === 'unknown') {
    warnings.push(`Video post ${id} playback start is unknown (${inspection.reason}).`);
  }

  checked.push({
    id,
    status: inspection.status,
    reason: inspection.reason,
    bytes: range.bytes.byteLength,
    url: mediaUrl,
  });
}

console.log('');
console.log(`Checked feed posts: ${posts.length}`);
console.log(`Checked videos: ${checked.length}`);
for (const item of checked.slice(0, 8)) {
  console.log(`  - ${item.id}: ${item.status}, ${item.reason}, scanned ${formatBytes(item.bytes)} (${shortUrl(item.url)})`);
}

if (warnings.length > 0) {
  console.log('');
  console.log('Warnings:');
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (failures.length > 0) {
  console.log('');
  console.error('Media playback health failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('');
console.log('Media playback health check passed.');

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
      contentType: response.headers.get('content-type'),
    };
  } catch (error) {
    return { ok: false, error: formatError(error) };
  }
}

async function fetchRange(url, timeout) {
  try {
    const response = await fetchWithTimeout(
      url,
      { headers: { range: `bytes=0-${SCAN_BYTES - 1}`, accept: '*/*' } },
      timeout,
    );
    if (!response.ok) {
      return { ok: false, status: response.status, error: await safeText(response) };
    }
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

function inspectMp4FastStart(bytes, mimeType = '') {
  const scannedBytes = Math.min(bytes.byteLength, SCAN_BYTES);
  const result = {
    status: 'unknown',
    reason: 'not enough data scanned',
    scannedBytes,
    ftypOffset: null,
    moovOffset: null,
    mdatOffset: null,
  };
  const mime = String(mimeType || '').toLowerCase();
  if (mime && !mime.includes('mp4') && !mime.includes('quicktime') && !mime.includes('video')) {
    return { ...result, status: 'not-mp4', reason: `mime ${mimeType} is not video/mp4-like` };
  }
  if (scannedBytes < 16) return { ...result, reason: 'file too small for mp4 boxes' };

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  let ftypOffset = null;
  let moovOffset = null;
  let mdatOffset = null;
  let sawMp4Brand = false;

  while (offset + 8 <= scannedBytes) {
    const box = readBox(view, offset, scannedBytes);
    if (!box) break;
    if (box.type === 'ftyp') {
      ftypOffset = offset;
      sawMp4Brand = hasMp4Brand(bytes, offset + box.headerSize, Math.min(offset + box.size, bytes.byteLength));
    }
    if (box.type === 'moov') moovOffset = offset;
    if (box.type === 'mdat') mdatOffset = offset;
    if (moovOffset !== null && mdatOffset !== null) break;
    offset += box.size;
  }

  if (ftypOffset !== null && !sawMp4Brand) {
    return { ...result, status: 'not-mp4', reason: 'ftyp brand is not recognized as mp4/quicktime', ftypOffset, moovOffset, mdatOffset };
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

function hasMp4Brand(bytes, start, end) {
  const known = new Set(['avc1', 'dash', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6', 'isom', 'm4v ', 'mp41', 'mp42', 'qt  ']);
  for (let offset = start; offset + 4 <= end; offset += 4) {
    let brand = '';
    for (let index = 0; index < 4; index += 1) brand += String.fromCharCode(bytes[offset + index] || 0);
    if (known.has(brand)) return true;
  }
  return false;
}

function buildFeedUrl(value, limitValue) {
  const raw =
    value ||
    process.env.STABILITY_FEED_URL ||
    `${normalizeBase(process.env.STABILITY_SITE_URL || DEFAULT_SITE_URL)}/api/feed/explore?offset=0&limit=${limitValue}&sort=forYou`;
  const url = new URL(raw);
  if (!url.searchParams.has('limit')) url.searchParams.set('limit', String(limitValue));
  url.searchParams.set('playback_bust', String(Date.now()));
  return url.toString();
}

function parseArgs(rawArgs) {
  const parsed = {
    feedUrl: undefined,
    help: false,
    limit: undefined,
    timeoutMs: undefined,
  };
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === '--feed-url') parsed.feedUrl = rawArgs[++index];
    else if (arg === '--help' || arg === '-h') parsed.help = true;
    else if (arg === '--limit') parsed.limit = rawArgs[++index];
    else if (arg === '--timeout-ms') parsed.timeoutMs = rawArgs[++index];
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

function normalizeBase(value) {
  return String(value || '').replace(/\/+$/, '');
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
    return String(value).slice(0, 80);
  }
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
Usage: npm run media:playback-health -- [options]

Options:
  --feed-url <url>        Feed API URL to inspect
  --limit <n>             Number of first feed posts to inspect (default ${DEFAULT_LIMIT})
  --timeout-ms <n>        Request timeout (default ${DEFAULT_TIMEOUT_MS})
`);
}
