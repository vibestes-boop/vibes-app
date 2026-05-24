import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fetchRest,
  fetchWithTimeout,
  loadEnv,
  normalizeBase,
  number,
  parseArgs,
  readEnv,
  readPositiveInt,
  summarize,
} from './lib/supabase-health.mjs';

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_SAMPLE_LIMIT = 8;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

loadEnv(repoRoot);

const supabaseUrl = normalizeBase(args.supabaseUrl || readEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'));
const serviceKey = args.serviceRoleKey || readEnv('SUPABASE_SERVICE_ROLE_KEY');
const timeoutMs = readPositiveInt(args.timeoutMs, DEFAULT_TIMEOUT_MS);
const sampleLimit = readPositiveInt(args.sampleLimit, DEFAULT_SAMPLE_LIMIT);
const failures = [];

console.log('Product media health check');
console.log('No secret values are printed.');

if (!supabaseUrl) failures.push('[env] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL.');
if (!serviceKey) failures.push('[env] Missing SUPABASE_SERVICE_ROLE_KEY.');

let products = [];

if (failures.length === 0) {
  const result = await fetchRest({
    supabaseUrl,
    key: serviceKey,
    path: 'products?select=id,title,category,cover_url,image_urls,is_active,created_at&is_active=eq.true&limit=5000',
    timeoutMs,
  });

  if (!result.ok) failures.push(`[products] query failed: ${result.status} ${result.error}`);
  else products = Array.isArray(result.data) ? result.data : [];
}

let summary = {
  activeProducts: 0,
  productsWithoutMedia: 0,
  mediaUrls: 0,
  brokenUrls: [],
};

if (failures.length === 0) {
  summary = await inspectProductMedia(products);

  console.log('');
  console.log('Products:');
  console.log(`  - active products: ${number(summary.activeProducts)}`);
  console.log(`  - products without media: ${number(summary.productsWithoutMedia)}`);
  console.log(`  - checked media URLs: ${number(summary.mediaUrls)}`);
  console.log(`  - broken media URLs: ${number(summary.brokenUrls.length)}`);

  if (summary.brokenUrls.length > 0) {
    console.log('  - sample failures:');
    for (const issue of summary.brokenUrls.slice(0, sampleLimit)) {
      console.log(`    - ${issue.productId} ${issue.kind}: ${issue.status} ${issue.url}`);
    }
  }

  for (const issue of summary.brokenUrls) {
    failures.push(`[product] ${issue.productId} ${issue.kind} is not reachable (${issue.status}).`);
  }
}

if (failures.length > 0) {
  console.log('');
  console.error('Product media health check failed:');
  for (const failure of failures.slice(0, sampleLimit)) console.error(`  - ${failure}`);
  if (failures.length > sampleLimit) {
    console.error(`  - ... ${failures.length - sampleLimit} more`);
  }
  process.exit(1);
}

console.log('');
console.log('Product media health check passed.');

async function inspectProductMedia(rows) {
  const issues = [];
  const mediaItems = [];
  let withoutMedia = 0;

  for (const row of rows) {
    const urls = collectProductUrls(row);
    if (urls.length === 0) {
      withoutMedia += 1;
      continue;
    }

    mediaItems.push(...urls.map((item) => ({ ...item, productId: row.id })));
  }

  const checks = await Promise.all(mediaItems.map(checkMediaUrl));
  for (const check of checks) {
    if (!check.ok) issues.push(check);
  }

  return {
    activeProducts: rows.length,
    productsWithoutMedia: withoutMedia,
    mediaUrls: mediaItems.length,
    brokenUrls: issues,
  };
}

function collectProductUrls(row) {
  const items = [];
  if (isHttpUrl(row.cover_url)) items.push({ kind: 'cover', url: row.cover_url });
  for (const url of parseUrlArray(row.image_urls)) {
    if (isHttpUrl(url) && url !== row.cover_url) items.push({ kind: 'gallery', url });
  }
  return items;
}

async function checkMediaUrl(item) {
  try {
    const head = await fetchWithTimeout(item.url, {
      method: 'HEAD',
      headers: { accept: 'image/*,*/*;q=0.8', 'user-agent': 'SerloProductMediaHealth/1.0' },
    }, timeoutMs);
    if (head.ok) return { ok: true, ...item };

    if (![403, 405, 501].includes(head.status)) {
      return { ok: false, status: head.status, url: sanitizeUrl(item.url), ...item };
    }

    const get = await fetchWithTimeout(item.url, {
      headers: {
        accept: 'image/*,*/*;q=0.8',
        range: 'bytes=0-0',
        'user-agent': 'SerloProductMediaHealth/1.0',
      },
    }, timeoutMs);
    return get.ok
      ? { ok: true, ...item }
      : { ok: false, status: get.status, url: sanitizeUrl(item.url), ...item };
  } catch (error) {
    return { ok: false, status: summarize(error.message || 'request failed'), url: sanitizeUrl(item.url), ...item };
  }
}

function parseUrlArray(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string' && item.length > 0);
  if (typeof value !== 'string' || value.length === 0) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item.length > 0) : [];
  } catch {
    return [value];
  }
}

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function sanitizeUrl(value) {
  try {
    const parsed = new URL(value);
    return `${parsed.hostname}${parsed.pathname}`.slice(0, 160);
  } catch {
    return String(value || '').slice(0, 160);
  }
}

function printHelp() {
  console.log(`
Usage: node scripts/check-product-media-health.mjs [options]

Checks active shop products for broken public cover/gallery image URLs.

Options:
  --sample-limit <n>  Max failing IDs printed (default ${DEFAULT_SAMPLE_LIMIT})
  --timeout-ms <n>    Per-request timeout (default ${DEFAULT_TIMEOUT_MS})
`);
}
