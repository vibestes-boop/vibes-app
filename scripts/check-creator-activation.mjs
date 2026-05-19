import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_TIMEOUT_MS = 10000;
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
const serviceKey = args.serviceRoleKey || readEnv('SUPABASE_SERVICE_ROLE_KEY');
const timeoutMs = readPositiveInt(args.timeoutMs, DEFAULT_TIMEOUT_MS);
const failures = [];

console.log('Creator activation recovery snapshot');
console.log('No secret values are printed.');

if (!supabaseUrl) failures.push('[env] Missing NEXT_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL.');
if (!serviceKey) failures.push('[env] Missing SUPABASE_SERVICE_ROLE_KEY.');

let snapshot = null;
if (failures.length === 0) {
  snapshot = await fetchSnapshot();
}

if (snapshot) {
  printSnapshot(snapshot);
}

if (failures.length > 0) {
  console.log('');
  console.error('Creator activation recovery snapshot failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('');
console.log('Creator activation recovery snapshot passed.');

async function fetchSnapshot() {
  const response = await fetchWithTimeout(`${supabaseUrl}/rest/v1/rpc/creator_activation_recovery_snapshot`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
    },
    body: '{}',
  });
  const text = await response.text();
  if (!response.ok) {
    failures.push(`[rpc] creator_activation_recovery_snapshot failed: ${response.status} ${summarize(text)}`.trim());
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    failures.push('[rpc] creator_activation_recovery_snapshot returned invalid JSON.');
    return null;
  }
}

function printSnapshot(data) {
  const summary = data.summary || {};
  const needFirstPost = Array.isArray(data.need_first_post) ? data.need_first_post : [];
  const needEngagement = Array.isArray(data.need_engagement) ? data.need_engagement : [];
  const nextActions = Array.isArray(data.next_actions) ? data.next_actions : [];

  console.log('');
  console.log(`Generated: ${data.generated_at}`);
  console.log('');
  console.log('Summary:');
  console.log(`  - new users 30d: ${number(summary.new_users_30d)}`);
  console.log(`  - users without first post 30d: ${number(summary.users_without_first_post_30d)}`);
  console.log(`  - posts 7d/30d: ${number(summary.posts_7d)}/${number(summary.posts_30d)}`);
  console.log(`  - active creators 7d: ${number(summary.active_creators_7d)}`);
  console.log(`  - creators with posts 30d: ${number(summary.creators_with_posts_30d)}`);
  console.log(`  - creators with zero engagement 30d: ${number(summary.creators_with_zero_engagement_30d)}`);
  console.log(`  - posts with meaningful engagement 30d: ${number(summary.posts_with_meaningful_engagement_30d)}`);
  console.log(`  - views / meaningful engagement 30d: ${number(summary.views_30d)} / ${number(summary.meaningful_engagement_30d)}`);

  console.log('');
  console.log('Needs first post:');
  printCandidateRows(needFirstPost, (row) =>
    `${handle(row)} signed up ${number(row.days_since_signup)}d ago`,
  );

  console.log('');
  console.log('Needs engagement:');
  printCandidateRows(needEngagement, (row) =>
    `${handle(row)} posts=${number(row.posts_30d)}, views=${number(row.views)}, likes/comments/bookmarks/follows=${number(row.likes)}/${number(row.comments)}/${number(row.bookmarks)}/${number(row.follows)}`,
  );

  if (nextActions.length > 0) {
    console.log('');
    console.log('Next actions:');
    for (const action of nextActions) console.log(`  - ${action}`);
  }
}

function printCandidateRows(rows, formatter) {
  if (rows.length === 0) {
    console.log('  - none');
    return;
  }
  for (const row of rows) console.log(`  - ${formatter(row)}`);
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

function handle(row) {
  if (row.username) return `@${row.username}`;
  if (row.display_name) return row.display_name;
  return row.user_id || 'unknown';
}

function readEnv(...names) {
  for (const name of names) {
    if (process.env[name]) return process.env[name];
  }
  return '';
}

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeBase(value) {
  return String(value || '').replace(/\/+$/, '');
}

function number(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? new Intl.NumberFormat('en-US').format(numeric) : 'n/a';
}

function summarize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function printHelp() {
  console.log(`
Usage: node scripts/check-creator-activation.mjs [options]

Shows admin/operator-only creator activation recovery signals for North Star 0.

Options:
  --timeout-ms <n>  Request timeout (default ${DEFAULT_TIMEOUT_MS})
`);
}
