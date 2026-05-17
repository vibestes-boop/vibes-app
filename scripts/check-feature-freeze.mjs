import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_SITE_URL = 'https://serlo-web.vercel.app';

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
const northStarZeroWeeks = readPositiveInt(
  args.northStarZeroWeeks ?? process.env.FEATURE_FREEZE_NORTH_STAR_ZERO_WEEKS,
  1,
);

const blockers = [];
const warnings = [];

console.log('Feature freeze guard');
console.log('No secret values are printed.');

if (!supabaseUrl) blockers.push('[env] Missing NEXT_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL.');
if (!anonKey) blockers.push('[env] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY.');

if (blockers.length === 0) {
  const [integrity, product, cost, moderation, pushFeed, feedEndpoint] = await Promise.all([
    fetchRpc('production_integrity_snapshot'),
    fetchRpc('product_health_snapshot'),
    fetchRpc('cost_health_snapshot'),
    fetchRpc('moderation_health_snapshot'),
    fetchRpc('push_feed_health_snapshot'),
    fetchFeedEndpoint(),
  ]);

  evaluateIntegrity(integrity);
  evaluateProduct(product);
  evaluateCost(cost);
  evaluateModeration(moderation);
  evaluatePushFeed(pushFeed, feedEndpoint);
}

if (warnings.length > 0) {
  console.log('');
  console.log('Warnings:');
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (blockers.length > 0) {
  console.log('');
  console.error('Feature freeze active. Block broad feature rollout until these are resolved:');
  for (const blocker of blockers) console.error(`  - ${blocker}`);
  process.exit(1);
}

console.log('');
console.log('No feature freeze blockers detected.');

async function fetchRpc(name) {
  const response = await fetchWithTimeout(`${supabaseUrl}/rest/v1/rpc/${name}`, {
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
  if (!response.ok) return { ok: false, status: response.status, error: summarize(text), data: null };
  try {
    return { ok: true, status: response.status, data: JSON.parse(text), error: '' };
  } catch {
    return { ok: false, status: response.status, error: 'invalid JSON', data: null };
  }
}

async function fetchFeedEndpoint() {
  const url = withBudgetBust(`${siteUrl}/api/feed/explore?offset=0&limit=12&sort=forYou`);
  try {
    const response = await fetchWithTimeout(url, {
      headers: { accept: 'application/json', 'user-agent': 'SerloFeatureFreezeGuard/1.0' },
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
    return { ok: false, status: 0, posts: 0, error: error.message };
  }
}

function evaluateIntegrity(result) {
  if (!result.ok) {
    blockers.push(`[Data Lifecycle] production_integrity_snapshot failed: ${result.error}`);
    return;
  }

  const queue = result.data?.r2_delete_queue || {};
  const posts = result.data?.posts || {};
  const cron = result.data?.cron || {};
  const jobs = Array.isArray(cron.jobs) ? cron.jobs : [];
  const r2DeleteCronActive = jobs.some((job) => job.jobname === 'r2-delete-queue' && job.active);

  if (Number(queue.error || 0) > 0) {
    blockers.push(`[Data Lifecycle] R2 delete queue has ${number(queue.error)} error row(s).`);
  }
  if (Number(queue.pending || 0) > 10) {
    blockers.push(`[Data Lifecycle] R2 delete queue has ${number(queue.pending)} pending row(s).`);
  }
  if (Number(posts.empty_content || 0) > 0) {
    blockers.push(`[Data Lifecycle] ${number(posts.empty_content)} post(s) have empty content/media.`);
  }
  if (!cron.available || !r2DeleteCronActive) {
    blockers.push('[Data Lifecycle] r2-delete-queue cron is not active.');
  }

  console.log(
    `  - Data Lifecycle: queue pending/error ${number(queue.pending)}/${number(queue.error)}, empty posts ${number(posts.empty_content)}, cron ${r2DeleteCronActive ? 'ok' : 'missing'}`,
  );
}

function evaluateProduct(result) {
  if (!result.ok) {
    warnings.push(`[Product Metrics] product_health_snapshot failed: ${result.error}`);
    return;
  }

  const northStar = result.data?.north_star || {};
  const audience = result.data?.audience || {};
  const retention = result.data?.retention || {};
  const value = Number(northStar.value || 0);

  if (value <= 0 && northStarZeroWeeks >= 2) {
    blockers.push(
      `[Product Metrics] North Star is 0 for ${northStarZeroWeeks} weekly review(s); pause non-activation features.`,
    );
  } else if (value <= 0) {
    warnings.push('[Product Metrics] North Star is 0; one more zero week should freeze non-activation features.');
  }

  console.log(
    `  - Product Metrics: north star ${number(value)}, WAU/MAU ${number(audience.wau)}/${number(audience.mau)}, D7 ${number(retention.d7_retained)}/${number(retention.d7_cohort)}`,
  );
}

function evaluateCost(result) {
  if (!result.ok) {
    blockers.push(`[Cost Monitoring] cost_health_snapshot failed: ${result.error}`);
    return;
  }

  const data = result.data || {};
  const unit = data.unit_economics || {};
  const live = data.live || {};
  const media = data.media || {};
  const budgets = [
    ['tracked monthly cost', unit.tracked_cost_cents_month, 2500],
    ['cost per MAU', unit.tracked_cost_cents_per_mau, 200],
    ['live minutes', live.minutes_month, 1000],
    ['recording minutes', live.recording_minutes_month, 300],
    ['media uploads', media.media_uploads_month, 1000],
    ['referenced R2 objects', media.referenced_media_objects, 10000],
  ];
  const over = budgets.filter(([, actual, budget]) => ratio(actual, budget) >= 0.9);
  for (const [label, actual, budget] of over) {
    blockers.push(`[Cost Monitoring] ${label} is at ${percent(ratio(actual, budget))} of budget.`);
  }

  console.log(
    `  - Cost Monitoring: tracked ${money(unit.tracked_cost_cents_month)}, live minutes ${number(live.minutes_month)}, R2 objects ${number(media.referenced_media_objects)}`,
  );
}

function evaluateModeration(result) {
  if (!result.ok) {
    blockers.push(`[Moderation/Trust] moderation_health_snapshot failed: ${result.error}`);
    return;
  }

  const reports = result.data?.content_reports || {};
  const legacy = result.data?.legacy_unqueued || {};
  if (Number(reports.pending_over_sla || 0) > 0) {
    blockers.push(`[Moderation/Trust] ${number(reports.pending_over_sla)} report(s) are over the 24h SLA.`);
  }
  if (Number(legacy.total || 0) > 0) {
    blockers.push(`[Moderation/Trust] ${number(legacy.total)} legacy report(s) are not in the review queue.`);
  }
  if (Number(reports.pending || 0) > 0) {
    warnings.push(`[Moderation/Trust] ${number(reports.pending)} report(s) are pending review.`);
  }

  console.log(
    `  - Moderation/Trust: pending ${number(reports.pending)}, over SLA ${number(reports.pending_over_sla)}, legacy ${number(legacy.total)}`,
  );
}

function evaluatePushFeed(result, feedEndpoint) {
  if (!result.ok) {
    blockers.push(`[Push/Feed] push_feed_health_snapshot failed: ${result.error}`);
    return;
  }

  const push = result.data?.push || {};
  const feed = result.data?.feed || {};
  const native = push.native_tokens || {};
  const web = push.web_subscriptions || {};
  const notifications = push.notifications || {};
  const triggers = push.triggers || {};

  if (Number(feed.public_posts_total || 0) < 3) {
    blockers.push(`[Push/Feed] Public feed has only ${number(feed.public_posts_total)} post(s).`);
  }
  if (Number(feed.public_video_posts_without_thumbnail || 0) > 0) {
    blockers.push(
      `[Push/Feed] ${number(feed.public_video_posts_without_thumbnail)} public video post(s) are missing thumbnails.`,
    );
  }
  if (!notifications.available) {
    blockers.push('[Push/Feed] Notification signals are unavailable.');
  }
  if (web.available && Number(web.total || 0) > 0 && !triggers.messages_web_push_trigger) {
    blockers.push('[Push/Feed] Web push subscriptions exist but the message trigger is missing.');
  }
  if (!feedEndpoint.ok || Number(feedEndpoint.posts || 0) < 3) {
    blockers.push(`[Push/Feed] Explore feed endpoint is unhealthy: ${feedEndpoint.status} ${feedEndpoint.error}`.trim());
  }
  if (Number(notifications.unread_total || 0) > 500) {
    warnings.push(`[Push/Feed] ${number(notifications.unread_total)} unread notification(s) need cleanup or product review.`);
  }
  if (native.available && Number(native.total || 0) > 0 && Number(native.active_30d || 0) === 0) {
    warnings.push('[Push/Feed] Native push has tokens but no active 30d token.');
  }

  console.log(
    `  - Push/Feed: feed ${number(feedEndpoint.posts)} posts, unread ${number(notifications.unread_total)}, native active ${number(native.active_30d)}/${number(native.total)}`,
  );
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
  parsed.searchParams.set('freeze_bust', String(Date.now()));
  return parsed.toString();
}

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function ratio(actual, budget) {
  const a = Number(actual || 0);
  const b = Number(budget || 0);
  return Number.isFinite(a) && Number.isFinite(b) && b > 0 ? a / b : 0;
}

function number(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(numeric) : 'n/a';
}

function money(cents) {
  const numeric = Number(cents || 0);
  if (!Number.isFinite(numeric)) return 'n/a';
  return `$${(numeric / 100).toFixed(2)}`;
}

function percent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function summarize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function printHelp() {
  console.log(`
Usage: node scripts/check-feature-freeze.mjs [options]

Fails when production health signals require a broad feature rollout freeze.

Options:
  --site-url <url>                 Web app URL (default ${DEFAULT_SITE_URL})
  --timeout-ms <n>                 Request timeout (default ${DEFAULT_TIMEOUT_MS})
  --north-star-zero-weeks <n>      Freeze non-activation features at 2+ zero weeks
`);
}
