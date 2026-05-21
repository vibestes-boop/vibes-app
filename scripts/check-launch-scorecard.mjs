import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SITE_URL = 'https://serlo-web.vercel.app';
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_RETRIES = 2;

const TARGETS = {
  feedPosts: 12,
  nativeActiveTokens: 1,
  maxMissingThumbnails: 0,
  northStar: 1,
  activeCreators7d: 2,
  wau: 5,
  firstPostRate: 0.4,
  minRetentionCohort: 3,
  d1Rate: 0.25,
};

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
const serviceKey = args.serviceRoleKey || readEnv('SUPABASE_SERVICE_ROLE_KEY');
const siteUrl = normalizeBase(args.siteUrl || process.env.STABILITY_SITE_URL || DEFAULT_SITE_URL);
const timeoutMs = readPositiveInt(args.timeoutMs, DEFAULT_TIMEOUT_MS);
const retries = readPositiveInt(args.retries, DEFAULT_RETRIES);
const failures = [];

console.log('Launch readiness scorecard');
console.log('No secret values are printed.');

if (!supabaseUrl) failures.push('[env] Missing NEXT_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL.');
if (!anonKey) failures.push('[env] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY.');
if (!serviceKey) failures.push('[env] Missing SUPABASE_SERVICE_ROLE_KEY.');

let scorecard = null;
if (failures.length === 0) {
  const [product, activation, pushFeed, thumbnails, feedEndpoint] = await Promise.all([
    fetchRpc('product_health_snapshot', anonKey),
    fetchRpc('creator_activation_recovery_snapshot', serviceKey),
    fetchRpc('push_feed_health_snapshot', anonKey),
    fetchThumbnailTables(),
    fetchFeedEndpoint(),
  ]);

  scorecard = buildScorecard({ product, activation, pushFeed, thumbnails, feedEndpoint });
  printScorecard(scorecard);
}

if (failures.length > 0) {
  console.log('');
  console.error('Launch readiness scorecard failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

if (args.strict && scorecard?.decision !== 'PRIVATE_COHORT_READY') {
  console.log('');
  console.error(`Strict launch gate failed: ${scorecard?.decision || 'UNKNOWN'}.`);
  process.exit(1);
}

console.log('');
console.log('Launch readiness scorecard passed.');

function buildScorecard({ product, activation, pushFeed, thumbnails, feedEndpoint }) {
  const gates = [];

  addDependencyGate(gates, 'Product snapshot', product, 'product_health_snapshot');
  addDependencyGate(gates, 'Activation snapshot', activation, 'creator_activation_recovery_snapshot');
  addDependencyGate(gates, 'Push/feed snapshot', pushFeed, 'push_feed_health_snapshot');
  addDependencyGate(gates, 'Thumbnail tables', thumbnails, 'media thumbnail tables');
  addDependencyGate(gates, 'Feed endpoint', feedEndpoint, '/api/feed/explore');

  const productData = product.data || {};
  const activationData = activation.data || {};
  const pushData = pushFeed.data || {};
  const summary = activationData.summary || {};
  const northStar = productData.north_star || {};
  const audience = productData.audience || {};
  const retention = productData.retention || {};
  const push = pushData.push || {};
  const native = push.native_tokens || {};
  const feed = pushData.feed || {};
  const thumbnailRows = thumbnails.rows || [];
  const missingThumbnails = thumbnailRows.filter((item) => item.media_url && item.archived !== true && !item.thumbnail_url);

  const newUsers30d = numberValue(summary.new_users_30d);
  const usersWithoutFirstPost = numberValue(summary.users_without_first_post_30d);
  const firstPostUsers = Math.max(newUsers30d - usersWithoutFirstPost, 0);
  const firstPostRate = newUsers30d > 0 ? firstPostUsers / newUsers30d : null;
  const activeCreators7d = numberValue(northStar.active_creators_7d);
  const northStarValue = numberValue(northStar.value);
  const wau = numberValue(audience.wau);
  const d1Cohort = numberValue(retention.d1_cohort);
  const d1Rate = retention.d1_rate === null || retention.d1_rate === undefined ? null : Number(retention.d1_rate);
  const nativeActive = numberValue(native.active_30d);
  const nativeTotal = numberValue(native.total);
  const feedPosts = numberValue(feedEndpoint.posts);
  const publicPosts7d = numberValue(feed.public_posts_7d);

  gates.push(technicalGate(
    'Feed endpoint depth',
    feedPosts >= TARGETS.feedPosts,
    `${feedPosts}/${TARGETS.feedPosts} posts returned`,
  ));
  gates.push(technicalGate(
    'Media thumbnail reliability',
    missingThumbnails.length <= TARGETS.maxMissingThumbnails,
    `${missingThumbnails.length} missing thumbnail(s)`,
  ));
  gates.push(technicalGate(
    'Native push route',
    nativeActive >= TARGETS.nativeActiveTokens,
    `${nativeActive}/${nativeTotal} active native token(s)`,
  ));
  gates.push(productGate(
    'North Star floor',
    northStarValue >= TARGETS.northStar,
    `${northStarValue}/${TARGETS.northStar} weekly active creator(s) with engagement`,
  ));
  gates.push(productGate(
    'Creator supply',
    activeCreators7d >= TARGETS.activeCreators7d,
    `${activeCreators7d}/${TARGETS.activeCreators7d} active creator(s) in 7d`,
  ));
  gates.push(productGate(
    'First-post conversion',
    firstPostRate !== null && firstPostRate >= TARGETS.firstPostRate,
    `${firstPostUsers}/${newUsers30d} new users posted (${formatPercent(firstPostRate)})`,
  ));
  gates.push(productGate(
    'Weekly audience',
    wau >= TARGETS.wau,
    `${wau}/${TARGETS.wau} WAU`,
  ));

  if (d1Cohort < TARGETS.minRetentionCohort) {
    gates.push({
      area: 'D1 retention sample',
      status: 'Watch',
      summary: `${numberValue(retention.d1_retained)}/${d1Cohort} retained; wait for ${TARGETS.minRetentionCohort}+ users`,
    });
  } else {
    gates.push(productGate(
      'D1 retention',
      d1Rate !== null && d1Rate >= TARGETS.d1Rate,
      `${formatPercent(d1Rate)} retained (${numberValue(retention.d1_retained)}/${d1Cohort})`,
    ));
  }

  const blockers = gates.filter((gate) => gate.status === 'Blocked');
  const improvements = gates.filter((gate) => gate.status === 'Improve');
  const decision = blockers.length > 0
    ? 'BLOCKED_FIX_STABILITY'
    : improvements.length > 0
      ? 'INVITE_GATE_CLOSED'
      : 'PRIVATE_COHORT_READY';

  return {
    generated_at: new Date().toISOString(),
    decision,
    gates,
    metrics: {
      newUsers30d,
      firstPostUsers,
      usersWithoutFirstPost,
      firstPostRate,
      northStarValue,
      activeCreators7d,
      wau,
      publicPosts7d,
      feedPosts,
      nativeActive,
      nativeTotal,
      missingThumbnails: missingThumbnails.length,
      d1Cohort,
      d1Rate,
    },
  };
}

function printScorecard(scorecard) {
  console.log('');
  console.log(`Generated: ${scorecard.generated_at}`);
  console.log(`Decision: ${scorecard.decision}`);

  console.log('');
  console.log('Core metrics:');
  console.log(`  - first-post conversion: ${scorecard.metrics.firstPostUsers}/${scorecard.metrics.newUsers30d} (${formatPercent(scorecard.metrics.firstPostRate)})`);
  console.log(`  - users without first post: ${scorecard.metrics.usersWithoutFirstPost}`);
  console.log(`  - north star / active creators 7d: ${scorecard.metrics.northStarValue}/${scorecard.metrics.activeCreators7d}`);
  console.log(`  - WAU: ${scorecard.metrics.wau}`);
  console.log(`  - public posts 7d / feed endpoint posts: ${scorecard.metrics.publicPosts7d}/${scorecard.metrics.feedPosts}`);
  console.log(`  - native active tokens: ${scorecard.metrics.nativeActive}/${scorecard.metrics.nativeTotal}`);
  console.log(`  - missing thumbnails: ${scorecard.metrics.missingThumbnails}`);

  console.log('');
  console.log('Gates:');
  const widths = {
    area: Math.max('Gate'.length, ...scorecard.gates.map((gate) => gate.area.length)),
    status: Math.max('Status'.length, ...scorecard.gates.map((gate) => gate.status.length)),
  };
  console.log(`  ${pad('Gate', widths.area)}  ${pad('Status', widths.status)}  Signal`);
  console.log(`  ${'-'.repeat(widths.area)}  ${'-'.repeat(widths.status)}  ${'-'.repeat(36)}`);
  for (const gate of scorecard.gates) {
    console.log(`  ${pad(gate.area, widths.area)}  ${pad(gate.status, widths.status)}  ${gate.summary}`);
  }

  console.log('');
  console.log('Next action:');
  if (scorecard.decision === 'BLOCKED_FIX_STABILITY') {
    console.log('  - Do not invite users. Fix blocked technical gates first, then rerun npm run launch:scorecard.');
  } else if (scorecard.decision === 'INVITE_GATE_CLOSED') {
    console.log('  - Keep invite gate closed. Spend the next cycle on first-post prompts, creator replies, and 1:1 activation.');
  } else {
    console.log('  - Invite a tiny private cohort only: 5-10 people, measure D1, first post, and one real conversation.');
  }
}

function addDependencyGate(gates, area, result, label) {
  if (result.ok) return;
  gates.push({
    area,
    status: 'Blocked',
    summary: `${label} failed: ${result.error || result.status || 'unknown error'}`,
  });
}

function technicalGate(area, ok, summary) {
  return { area, status: ok ? 'Ready' : 'Blocked', summary };
}

function productGate(area, ok, summary) {
  return { area, status: ok ? 'Ready' : 'Improve', summary };
}

async function fetchRpc(name, key) {
  return withRetries(async () => {
    try {
      const response = await fetchWithTimeout(`${supabaseUrl}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          apikey: key,
          authorization: `Bearer ${key}`,
          'content-type': 'application/json',
        },
        body: '{}',
      });
      const text = await response.text();
      if (!response.ok) return { ok: false, status: response.status, error: summarize(text), data: null };
      try {
        return { ok: true, status: response.status, error: '', data: JSON.parse(text) };
      } catch {
        return { ok: false, status: response.status, error: 'invalid JSON', data: null };
      }
    } catch (error) {
      return { ok: false, status: 0, error: error.message || 'request failed', data: null };
    }
  });
}

async function fetchThumbnailTables() {
  const [posts, stories] = await Promise.all([
    fetchAdminTable('posts?select=id,media_type,media_url,thumbnail_url,created_at&media_url=not.is.null&limit=5000'),
    fetchAdminTable('stories?select=id,media_type,media_url,thumbnail_url,archived,created_at&media_url=not.is.null&archived=eq.false&limit=5000'),
  ]);
  if (!posts.ok) return { ok: false, error: `posts failed: ${posts.error}`, rows: [] };
  if (!stories.ok) return { ok: false, error: `stories failed: ${stories.error}`, rows: [] };
  return { ok: true, error: '', rows: [...posts.data, ...stories.data] };
}

async function fetchAdminTable(restPath) {
  return withRetries(async () => {
    try {
      const response = await fetchWithTimeout(`${supabaseUrl}/rest/v1/${restPath}`, {
        headers: {
          accept: 'application/json',
          apikey: serviceKey,
          authorization: `Bearer ${serviceKey}`,
        },
      });
      const text = await response.text();
      if (!response.ok) return { ok: false, status: response.status, error: summarize(text), data: [] };
      try {
        return { ok: true, status: response.status, error: '', data: JSON.parse(text) };
      } catch {
        return { ok: false, status: response.status, error: 'invalid JSON', data: [] };
      }
    } catch (error) {
      return { ok: false, status: 0, error: error.message || 'request failed', data: [] };
    }
  });
}

async function fetchFeedEndpoint() {
  return withRetries(async () => {
    try {
      const url = new URL(`${siteUrl}/api/feed/explore`);
      url.searchParams.set('offset', '0');
      url.searchParams.set('limit', String(TARGETS.feedPosts));
      url.searchParams.set('sort', 'forYou');
      url.searchParams.set('scorecard_bust', String(Date.now()));
      const response = await fetchWithTimeout(url.toString(), {
        headers: { accept: 'application/json', 'user-agent': 'SerloLaunchScorecard/1.0' },
      });
      const text = await response.text();
      if (!response.ok) return { ok: false, status: response.status, posts: 0, error: summarize(text) };
      const data = JSON.parse(text);
      return {
        ok: true,
        status: response.status,
        posts: Array.isArray(data?.posts) ? data.posts.length : 0,
        error: '',
      };
    } catch (error) {
      return { ok: false, status: 0, posts: 0, error: error.message || 'request failed' };
    }
  });
}

async function withRetries(operation) {
  let latest = { ok: false, status: 0, error: 'not attempted' };
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    latest = await operation();
    if (latest.ok || !isRetryable(latest) || attempt === retries) return latest;
    await sleep(250 * attempt);
  }
  return latest;
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

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }
    if (arg === '--strict') {
      parsed.strict = true;
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

function isRetryable(result) {
  const error = String(result?.error || '').toLowerCase();
  return (
    !result ||
    result.status === 0 ||
    result.status >= 500 ||
    error.includes('aborted') ||
    error.includes('57014') ||
    error.includes('statement timeout') ||
    error.includes('canceling statement')
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readEnv(...names) {
  for (const name of names) {
    if (process.env[name]) return process.env[name];
  }
  return '';
}

function normalizeBase(value) {
  return String(value || '').replace(/\/+$/, '');
}

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function numberValue(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatPercent(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'n/a';
  return `${Math.round(Number(value) * 1000) / 10}%`;
}

function summarize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function pad(value, width) {
  return String(value).padEnd(width, ' ');
}

function printHelp() {
  console.log(`
Usage: node scripts/check-launch-scorecard.mjs [options]

Decides whether Serlo should invite real users, stay in activation recovery, or
stop for technical fixes. The default mode prints the decision and exits 0 when
the scorecard can be generated. Use --strict to fail unless the private cohort
gate is ready.

Options:
  --site-url <url>      Web app URL (default ${DEFAULT_SITE_URL})
  --timeout-ms <n>      Request timeout (default ${DEFAULT_TIMEOUT_MS})
  --retries <n>         Retry transient production reads (default ${DEFAULT_RETRIES})
  --strict              Exit non-zero unless PRIVATE_COHORT_READY
  -h, --help            Show this help
`);
}
