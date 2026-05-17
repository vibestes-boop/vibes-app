import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_TIMEOUT_MS = 8000;
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
const timeoutMs = readPositiveInt(args.timeoutMs, DEFAULT_TIMEOUT_MS);
const failures = [];

console.log('Product health check');
console.log('No secret values are printed.');

if (!supabaseUrl) failures.push('[env] Missing NEXT_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL.');
if (!anonKey) failures.push('[env] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY.');

let snapshot = null;
if (failures.length === 0) {
  snapshot = await fetchSnapshot();
  if (snapshot) {
    printSnapshot(snapshot);
    validateSnapshot(snapshot);
  }
}

if (failures.length > 0) {
  console.log('');
  console.error('Product health check failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('');
console.log('Product health check passed.');

async function fetchSnapshot() {
  const response = await fetchWithTimeout(`${supabaseUrl}/rest/v1/rpc/product_health_snapshot`, {
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
    failures.push(`[snapshot] product_health_snapshot failed: ${response.status} ${summarize(text)}`.trim());
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    failures.push('[snapshot] product_health_snapshot returned invalid JSON.');
    return null;
  }
}

function printSnapshot(data) {
  const northStar = data.north_star || {};
  const audience = data.audience || {};
  const retention = data.retention || {};
  const engagement = data.engagement_7d || {};
  const speed = data.activation_speed || {};

  console.log('');
  console.log(`Generated: ${data.generated_at}`);
  console.log('');
  console.log('North Star:');
  console.log(`  - ${northStar.name || 'weekly_active_creators_with_meaningful_engagement'}: ${number(northStar.value)}`);
  console.log(`  - active creators 7d: ${number(northStar.active_creators_7d)}`);
  console.log(`  - creator activation rate: ${percent(northStar.activation_rate)}`);
  console.log(`  - posts with meaningful engagement 7d: ${number(northStar.posts_with_meaningful_engagement_7d)}`);

  console.log('');
  console.log('Audience:');
  console.log(`  - WAU: ${number(audience.wau)}`);
  console.log(`  - MAU: ${number(audience.mau)}`);
  console.log(`  - WAU/MAU: ${percent(audience.wau_mau)}`);
  console.log(`  - new users 7d: ${number(audience.new_users_7d)}`);
  console.log(`  - new users 30d: ${number(audience.new_users_30d)}`);

  console.log('');
  console.log('Retention:');
  console.log(`  - D1: ${number(retention.d1_retained)}/${number(retention.d1_cohort)} (${percent(retention.d1_rate)})`);
  console.log(`  - D7: ${number(retention.d7_retained)}/${number(retention.d7_cohort)} (${percent(retention.d7_rate)})`);

  console.log('');
  console.log('Engagement 7d:');
  console.log(`  - posts: ${number(engagement.posts)}`);
  console.log(`  - views: ${number(engagement.views)}`);
  console.log(`  - dwell events: ${number(engagement.dwell_events)}`);
  console.log(`  - likes/comments/bookmarks/follows: ${number(engagement.likes)}/${number(engagement.comments)}/${number(engagement.bookmarks)}/${number(engagement.follows)}`);
  console.log(`  - engagement per view: ${ratio(engagement.engagement_per_view)}`);
  console.log(`  - comment per view: ${ratio(engagement.comment_per_view)}`);

  console.log('');
  console.log('Activation Speed:');
  console.log(`  - median time to first post: ${duration(speed.median_time_to_first_post_seconds)}`);
  console.log(`  - median time to first meaningful interaction: ${duration(speed.median_time_to_first_meaningful_interaction_seconds)}`);
}

function validateSnapshot(data) {
  const northStar = data.north_star || {};
  const audience = data.audience || {};
  const engagement = data.engagement_7d || {};

  checkMin('north-star value', northStar.value, args.minNorthStar);
  checkMin('active creators 7d', northStar.active_creators_7d, args.minActiveCreators);
  checkMin('WAU', audience.wau, args.minWau);
  checkMin('MAU', audience.mau, args.minMau);
  checkMin('posts 7d', engagement.posts, args.minPosts);
}

function checkMin(label, actual, expected) {
  if (expected === undefined) return;
  const min = Number(expected);
  const value = Number(actual || 0);
  if (Number.isFinite(min) && value < min) {
    failures.push(`[metric] ${label} ${value} < ${min}.`);
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

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function number(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? new Intl.NumberFormat('en-US').format(numeric) : 'n/a';
}

function percent(value) {
  if (value === null || value === undefined) return 'n/a';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${Math.round(numeric * 1000) / 10}%` : 'n/a';
}

function ratio(value) {
  if (value === null || value === undefined) return 'n/a';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(4) : 'n/a';
}

function duration(seconds) {
  const value = Number(seconds || 0);
  if (!Number.isFinite(value) || value <= 0) return 'n/a';
  if (value < 60) return `${Math.round(value)}s`;
  if (value < 3600) return `${Math.round(value / 60)}m`;
  if (value < 86400) return `${Math.round(value / 3600)}h`;
  return `${Math.round(value / 86400)}d`;
}

function summarize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function printHelp() {
  console.log(`
Usage: node scripts/check-product-health.mjs [options]

Options:
  --min-north-star <n>       Fail if weekly active creators with engagement is lower
  --min-active-creators <n>  Fail if active creators 7d is lower
  --min-wau <n>              Fail if WAU is lower
  --min-mau <n>              Fail if MAU is lower
  --min-posts <n>            Fail if posts in the last 7d is lower
  --timeout-ms <n>           Request timeout (default ${DEFAULT_TIMEOUT_MS})
`);
}
