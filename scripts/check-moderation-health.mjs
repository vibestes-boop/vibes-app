import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_PENDING = 25;
const DEFAULT_MAX_OVER_SLA = 0;
const DEFAULT_MAX_OLDEST_PENDING_HOURS = 24;
const DEFAULT_MAX_LEGACY_UNQUEUED = 0;

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
const maxPending = readNonNegativeInt(args.maxPending, DEFAULT_MAX_PENDING);
const maxOverSla = readNonNegativeInt(args.maxOverSla, DEFAULT_MAX_OVER_SLA);
const maxOldestPendingHours = readNonNegativeInt(
  args.maxOldestPendingHours,
  DEFAULT_MAX_OLDEST_PENDING_HOURS,
);
const maxLegacyUnqueued = readNonNegativeInt(args.maxLegacyUnqueued, DEFAULT_MAX_LEGACY_UNQUEUED);
const failures = [];
const warnings = [];

console.log('Moderation health check');
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

if (warnings.length > 0) {
  console.log('');
  console.log('Warnings:');
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (failures.length > 0) {
  console.log('');
  console.error('Moderation health check failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('');
console.log('Moderation health check passed.');

async function fetchSnapshot() {
  const response = await fetchWithTimeout(`${supabaseUrl}/rest/v1/rpc/moderation_health_snapshot`, {
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
    failures.push(`[snapshot] moderation_health_snapshot failed: ${response.status} ${summarize(text)}`.trim());
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    failures.push('[snapshot] moderation_health_snapshot returned invalid JSON.');
    return null;
  }
}

function printSnapshot(data) {
  const reports = data.content_reports || {};
  const legacy = data.legacy_unqueued || {};
  const audit = data.admin_audit || {};
  const enforcement = data.enforcement || {};
  const byType = reports.by_target_type || {};

  console.log('');
  console.log(`Generated: ${data.generated_at}`);
  console.log(`SLA: ${data.sla_hours}h`);

  console.log('');
  console.log('Content Reports:');
  console.log(`  - total: ${number(reports.total)}`);
  console.log(`  - pending: ${number(reports.pending)}`);
  console.log(`  - pending over SLA: ${number(reports.pending_over_sla)}`);
  console.log(`  - oldest pending age: ${formatAge(reports.oldest_pending_age_seconds)}`);
  console.log(`  - reviewed 7d: ${number(reports.reviewed_7d)}`);
  console.log(`  - pending by target: ${formatByType(byType)}`);

  console.log('');
  console.log('Legacy Unqueued:');
  console.log(`  - post/user/live: ${number(legacy.post_reports)}/${number(legacy.user_reports)}/${number(legacy.live_reports)}`);
  console.log(`  - total: ${number(legacy.total)}`);

  console.log('');
  console.log('Admin Audit:');
  console.log(`  - events 7d: ${number(audit.events_7d)}`);
  console.log(`  - moderation events 7d: ${number(audit.moderation_events_7d)}`);

  console.log('');
  console.log('Enforcement Readiness:');
  console.log(`  - RPC: ${booleanLabel(enforcement.rpc_available)}`);
  console.log(`  - profile ban column: ${booleanLabel(enforcement.profile_ban_column)}`);
  console.log(`  - profile restrict columns: ${booleanLabel(enforcement.profile_restrict_columns)}`);
  console.log(`  - profile shadowban column: ${booleanLabel(enforcement.profile_shadowban_column)}`);
  console.log(`  - live mute table: ${booleanLabel(enforcement.live_mute_table)}`);
  console.log(`  - audit log table: ${booleanLabel(enforcement.audit_log_table)}`);
}

function evaluateSnapshot(data) {
  const reports = data.content_reports || {};
  const legacy = data.legacy_unqueued || {};
  const enforcement = data.enforcement || {};

  if (Number(reports.pending || 0) > maxPending) {
    failures.push(`[reports] Pending reports ${reports.pending} > ${maxPending}.`);
  }

  if (Number(reports.pending_over_sla || 0) > maxOverSla) {
    failures.push(`[sla] Reports older than ${data.sla_hours || 24}h: ${reports.pending_over_sla} > ${maxOverSla}.`);
  }

  const oldestAgeSeconds = Number(reports.oldest_pending_age_seconds);
  if (
    Number.isFinite(oldestAgeSeconds) &&
    oldestAgeSeconds > maxOldestPendingHours * 60 * 60
  ) {
    failures.push(
      `[sla] Oldest pending report is ${formatAge(oldestAgeSeconds)} old ` +
        `(limit ${maxOldestPendingHours}h).`,
    );
  }

  if (Number(legacy.total || 0) > maxLegacyUnqueued) {
    failures.push(`[legacy] Unqueued legacy reports ${legacy.total} > ${maxLegacyUnqueued}.`);
  }

  for (const [key, value] of Object.entries(enforcement)) {
    if (value !== true) {
      failures.push(`[enforcement] ${key} is not ready.`);
    }
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

function readNonNegativeInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function number(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? new Intl.NumberFormat('en-US').format(numeric) : 'n/a';
}

function booleanLabel(value) {
  return value === true ? 'yes' : 'no';
}

function formatAge(seconds) {
  if (seconds === null || seconds === undefined) return 'none';
  const numeric = Number(seconds);
  if (!Number.isFinite(numeric)) return 'none';
  if (numeric < 60) return `${Math.round(numeric)}s`;
  if (numeric < 3600) return `${Math.round(numeric / 60)}m`;
  return `${Math.round(numeric / 3600)}h`;
}

function formatByType(value) {
  const entries = Object.entries(value || {});
  if (entries.length === 0) return 'none';
  return entries.map(([key, count]) => `${key}=${count}`).join(', ');
}

function summarize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function printHelp() {
  console.log(`
Usage: node scripts/check-moderation-health.mjs [options]

Options:
  --max-pending <n>                 Pending report budget (default ${DEFAULT_MAX_PENDING})
  --max-over-sla <n>                Reports older than SLA allowed (default ${DEFAULT_MAX_OVER_SLA})
  --max-oldest-pending-hours <n>    Oldest pending report age limit (default ${DEFAULT_MAX_OLDEST_PENDING_HOURS})
  --max-legacy-unqueued <n>         Legacy reports missing content_reports row (default ${DEFAULT_MAX_LEGACY_UNQUEUED})
  --timeout-ms <n>                  Request timeout (default ${DEFAULT_TIMEOUT_MS})
`);
}
