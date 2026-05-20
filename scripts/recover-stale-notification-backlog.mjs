import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_OLDER_THAN_DAYS = 60;
const DEFAULT_LIMIT = 500;
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_TYPES = ['follow', 'like', 'comment', 'live', 'scheduled_live_reminder'];

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
const olderThanDays = readPositiveInt(args.olderThanDays, DEFAULT_OLDER_THAN_DAYS);
const limit = readPositiveInt(args.limit, DEFAULT_LIMIT);
const timeoutMs = readPositiveInt(args.timeoutMs, DEFAULT_TIMEOUT_MS);
const execute = Boolean(args.execute);
const types = parseTypes(args.types || DEFAULT_TYPES.join(','));
const failures = [];

console.log('Stale notification backlog recovery');
console.log('No secret values are printed.');
console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY RUN'}`);

if (!supabaseUrl) failures.push('[env] Missing NEXT_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL.');
if (!serviceKey) failures.push('[env] Missing SUPABASE_SERVICE_ROLE_KEY.');

let result = null;
if (failures.length === 0) {
  result = await callRecoveryRpc();
}

if (result) {
  console.log('');
  console.log(`Older than: ${result.older_than_days}d`);
  console.log(`Limit: ${result.limit}`);
  console.log(`Matched: ${number(result.matched)}`);
  console.log(`Updated: ${number(result.updated)}`);
  console.log(`Types: ${(result.types || []).join(', ')}`);
  if (result.by_type && Object.keys(result.by_type).length > 0) {
    console.log(`Matched by type: ${formatCounts(result.by_type)}`);
  }
  if (result.updated_by_type && Object.keys(result.updated_by_type).length > 0) {
    console.log(`Updated by type: ${formatCounts(result.updated_by_type)}`);
  }
  if (!execute && Number(result.matched || 0) > 0) {
    console.log('');
    console.log('Dry run only. Re-run with --execute to mark these old low-risk notifications as read.');
  }
}

if (failures.length > 0) {
  console.log('');
  console.error('Stale notification backlog recovery failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('');
console.log('Stale notification backlog recovery check passed.');

async function callRecoveryRpc() {
  const response = await fetchWithTimeout(`${supabaseUrl}/rest/v1/rpc/stale_notification_backlog_recovery`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      p_older_than_days: olderThanDays,
      p_limit: limit,
      p_execute: execute,
      p_types: types,
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    failures.push(`[rpc] stale_notification_backlog_recovery failed: ${response.status} ${summarize(text)}`.trim());
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    failures.push('[rpc] stale_notification_backlog_recovery returned invalid JSON.');
    return null;
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

function parseTypes(value) {
  const parsed = String(value || '')
    .split(',')
    .map((type) => type.trim().toLowerCase())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_TYPES;
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

function formatCounts(value) {
  return Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => `${key}=${number(count)}`)
    .join(', ');
}

function summarize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function printHelp() {
  console.log(`
Usage: node scripts/recover-stale-notification-backlog.mjs [options]

Dry-runs by default. Use --execute only after a product/ops decision.

Options:
  --older-than-days <n>  Target unread notifications older than n days (default ${DEFAULT_OLDER_THAN_DAYS})
  --limit <n>            Maximum rows to update/check in one run (default ${DEFAULT_LIMIT})
  --types <csv>          Allowed low-risk types to include (default ${DEFAULT_TYPES.join(',')})
  --execute              Mark matching old low-risk notifications as read
  --timeout-ms <n>       Request timeout (default ${DEFAULT_TIMEOUT_MS})
`);
}
