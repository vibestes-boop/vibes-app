import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_WARN_RATIO = 0.7;
const DEFAULT_FAIL_RATIO = 0.9;
const DEFAULTS = {
  aiBudgetCents: 1000,
  trackedBudgetCents: 2500,
  liveMinutesBudget: 1000,
  recordingMinutesBudget: 300,
  mediaUploadsBudget: 1000,
  r2ObjectsBudget: 10000,
  edgeDbEventsBudget: 50000,
  costPerMauBudgetCents: 200,
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
const timeoutMs = readPositiveInt(args.timeoutMs, DEFAULT_TIMEOUT_MS);
const warnRatio = readRatio(args.warnRatio, DEFAULT_WARN_RATIO);
const failRatio = readRatio(args.failRatio, DEFAULT_FAIL_RATIO);
const budgets = readBudgets();
const failures = [];
const warnings = [];

console.log('Cost health check');
console.log('No secret values are printed.');

if (!supabaseUrl) failures.push('[env] Missing NEXT_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL.');
if (!anonKey) failures.push('[env] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY.');

let snapshot = null;
if (failures.length === 0) {
  snapshot = await fetchSnapshot();
  if (snapshot) {
    printSnapshot(snapshot);
    evaluateBudgets(snapshot);
  }
}

if (warnings.length > 0) {
  console.log('');
  console.log('Warnings:');
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (failures.length > 0) {
  console.log('');
  console.error('Cost health check failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('');
console.log('Cost health check passed.');

async function fetchSnapshot() {
  const response = await fetchWithTimeout(`${supabaseUrl}/rest/v1/rpc/cost_health_snapshot`, {
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
    failures.push(`[snapshot] cost_health_snapshot failed: ${response.status} ${summarize(text)}`.trim());
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    failures.push('[snapshot] cost_health_snapshot returned invalid JSON.');
    return null;
  }
}

function printSnapshot(data) {
  const ai = data.ai || {};
  const media = data.media || {};
  const live = data.live || {};
  const edgeDb = data.edge_db_proxies || {};
  const unit = data.unit_economics || {};
  const audience = data.audience || {};

  console.log('');
  console.log(`Generated: ${data.generated_at}`);
  console.log(`Month: ${data.month_start}`);

  console.log('');
  console.log('Tracked Spend:');
  console.log(`  - tracked cost: ${money(unit.tracked_cost_cents_month)}`);
  console.log(`  - tracked cost / MAU: ${unit.tracked_cost_cents_per_mau == null ? 'n/a' : money(unit.tracked_cost_cents_per_mau)}`);
  console.log(`  - MAU: ${number(audience.mau)}`);

  console.log('');
  console.log('AI:');
  console.log(`  - image generations: ${number(ai.image_generations_month)}`);
  console.log(`  - cost: ${money(ai.cost_cents_month)}`);
  console.log(`  - cost / generation: ${unit.ai_cost_cents_per_generation == null ? 'n/a' : money(unit.ai_cost_cents_per_generation)}`);
  console.log(`  - errors: ${number(ai.errors_month)}`);

  console.log('');
  console.log('Media/R2:');
  console.log(`  - media uploads: ${number(media.media_uploads_month)}`);
  console.log(`  - thumbnail uploads: ${number(media.thumbnail_uploads_month)}`);
  console.log(`  - referenced media objects: ${number(media.referenced_media_objects)}`);
  console.log(`  - image/video posts: ${number(media.image_posts_month)}/${number(media.video_posts_month)}`);

  console.log('');
  console.log('Live:');
  console.log(`  - sessions: ${number(live.sessions_month)}`);
  console.log(`  - live minutes: ${number(live.minutes_month)}`);
  console.log(`  - recordings: ${number(live.recordings_month)}`);
  console.log(`  - recording minutes: ${number(live.recording_minutes_month)}`);
  console.log(`  - peak viewers: ${number(live.peak_viewers_month)}`);

  console.log('');
  console.log('Edge/DB Proxies:');
  console.log(`  - R2 queue rows/errors: ${number(edgeDb.r2_queue_rows_month)}/${number(edgeDb.r2_queue_errors_month)}`);
  console.log(`  - post views: ${number(edgeDb.post_views_month)}`);
  console.log(`  - posts/comments/likes/bookmarks/follows: ${number(edgeDb.posts_month)}/${number(edgeDb.comments_month)}/${number(edgeDb.likes_month)}/${number(edgeDb.bookmarks_month)}/${number(edgeDb.follows_month)}`);
}

function evaluateBudgets(data) {
  const ai = data.ai || {};
  const media = data.media || {};
  const live = data.live || {};
  const edgeDb = data.edge_db_proxies || {};
  const unit = data.unit_economics || {};

  checkBudget('AI image cost', ai.cost_cents_month, budgets.aiBudgetCents, 'cents');
  checkBudget('Tracked product cost', unit.tracked_cost_cents_month, budgets.trackedBudgetCents, 'cents');
  checkBudget('Tracked cost per MAU', unit.tracked_cost_cents_per_mau, budgets.costPerMauBudgetCents, 'cents');
  checkBudget('Live minutes', live.minutes_month, budgets.liveMinutesBudget, 'count');
  checkBudget('Recording minutes', live.recording_minutes_month, budgets.recordingMinutesBudget, 'count');
  checkBudget('Media uploads', media.media_uploads_month, budgets.mediaUploadsBudget, 'count');
  checkBudget('Referenced R2 media objects', media.referenced_media_objects, budgets.r2ObjectsBudget, 'count');

  const edgeDbEvents =
    Number(edgeDb.r2_queue_rows_month || 0) +
    Number(edgeDb.post_views_month || 0) +
    Number(edgeDb.posts_month || 0) +
    Number(edgeDb.comments_month || 0) +
    Number(edgeDb.likes_month || 0) +
    Number(edgeDb.bookmarks_month || 0) +
    Number(edgeDb.follows_month || 0);
  checkBudget('Edge/DB event proxy', edgeDbEvents, budgets.edgeDbEventsBudget, 'count');

  if (Number(edgeDb.r2_queue_errors_month || 0) > 0) {
    failures.push(`[budget] R2 queue errors this month: ${edgeDb.r2_queue_errors_month}.`);
  }
}

function checkBudget(label, rawActual, rawBudget, kind) {
  const actual = Number(rawActual || 0);
  const budget = Number(rawBudget || 0);
  if (!Number.isFinite(actual) || !Number.isFinite(budget) || budget <= 0) return;

  const ratio = actual / budget;
  const formattedActual = kind === 'cents' ? money(actual) : number(actual);
  const formattedBudget = kind === 'cents' ? money(budget) : number(budget);
  const line = `${label}: ${formattedActual}/${formattedBudget} (${Math.round(ratio * 100)}%)`;

  if (ratio >= failRatio) {
    failures.push(`[budget] ${line}`);
  } else if (ratio >= warnRatio) {
    warnings.push(`[budget] ${line}`);
  }
}

function readBudgets() {
  return {
    aiBudgetCents: readPositiveInt(args.aiBudgetCents || process.env.COST_AI_BUDGET_CENTS, DEFAULTS.aiBudgetCents),
    trackedBudgetCents: readPositiveInt(args.trackedBudgetCents || process.env.COST_TRACKED_BUDGET_CENTS, DEFAULTS.trackedBudgetCents),
    liveMinutesBudget: readPositiveInt(args.liveMinutesBudget || process.env.COST_LIVE_MINUTES_BUDGET, DEFAULTS.liveMinutesBudget),
    recordingMinutesBudget: readPositiveInt(args.recordingMinutesBudget || process.env.COST_RECORDING_MINUTES_BUDGET, DEFAULTS.recordingMinutesBudget),
    mediaUploadsBudget: readPositiveInt(args.mediaUploadsBudget || process.env.COST_MEDIA_UPLOADS_BUDGET, DEFAULTS.mediaUploadsBudget),
    r2ObjectsBudget: readPositiveInt(args.r2ObjectsBudget || process.env.COST_R2_OBJECTS_BUDGET, DEFAULTS.r2ObjectsBudget),
    edgeDbEventsBudget: readPositiveInt(args.edgeDbEventsBudget || process.env.COST_EDGE_DB_EVENTS_BUDGET, DEFAULTS.edgeDbEventsBudget),
    costPerMauBudgetCents: readPositiveInt(args.costPerMauBudgetCents || process.env.COST_PER_MAU_BUDGET_CENTS, DEFAULTS.costPerMauBudgetCents),
  };
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

function readRatio(value, fallback) {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1 ? parsed : fallback;
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

function summarize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function printHelp() {
  console.log(`
Usage: node scripts/check-cost-health.mjs [options]

Defaults warn at ${Math.round(DEFAULT_WARN_RATIO * 100)}% and fail at ${Math.round(DEFAULT_FAIL_RATIO * 100)}% of budget.

Budget options:
  --ai-budget-cents <n>             AI image monthly budget (default ${DEFAULTS.aiBudgetCents})
  --tracked-budget-cents <n>        Total tracked monthly budget (default ${DEFAULTS.trackedBudgetCents})
  --cost-per-mau-budget-cents <n>   Tracked cost per MAU budget (default ${DEFAULTS.costPerMauBudgetCents})
  --live-minutes-budget <n>         Live monthly minutes budget (default ${DEFAULTS.liveMinutesBudget})
  --recording-minutes-budget <n>    Recording monthly minutes budget (default ${DEFAULTS.recordingMinutesBudget})
  --media-uploads-budget <n>        Media uploads monthly budget (default ${DEFAULTS.mediaUploadsBudget})
  --r2-objects-budget <n>           Referenced R2 media objects budget (default ${DEFAULTS.r2ObjectsBudget})
  --edge-db-events-budget <n>       Edge/DB event proxy budget (default ${DEFAULTS.edgeDbEventsBudget})
  --warn-ratio <n>                  Warning ratio 0-1 (default ${DEFAULT_WARN_RATIO})
  --fail-ratio <n>                  Failure ratio 0-1 (default ${DEFAULT_FAIL_RATIO})
`);
}
