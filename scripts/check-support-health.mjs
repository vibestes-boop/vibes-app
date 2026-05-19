import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fetchRest,
  loadEnv,
  normalizeBase,
  number,
  parseArgs,
  readEnv,
  readPositiveInt,
} from './lib/supabase-health.mjs';

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_OPEN = 25;
const DEFAULT_MAX_OVER_SLA = 0;
const DEFAULT_MAX_OLDEST_OPEN_HOURS = 24;

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
const maxOpen = readPositiveInt(args.maxOpen, DEFAULT_MAX_OPEN);
const maxOverSla = Number.parseInt(String(args.maxOverSla ?? DEFAULT_MAX_OVER_SLA), 10);
const maxOldestOpenHours = readPositiveInt(args.maxOldestOpenHours, DEFAULT_MAX_OLDEST_OPEN_HOURS);
const failures = [];

console.log('Support health check');
console.log('No secret values are printed.');

if (!supabaseUrl) failures.push('[env] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL.');
if (!serviceKey) failures.push('[env] Missing SUPABASE_SERVICE_ROLE_KEY.');

let rows = [];
if (failures.length === 0) {
  const result = await fetchRest({
    supabaseUrl,
    key: serviceKey,
    path: 'admin_support_threads?select=id,status,priority,created_at,last_message_at&status=in.(open,pending)&limit=1000',
    timeoutMs,
  });
  if (!result.ok) {
    failures.push(`[snapshot] admin_support_threads failed: ${result.status} ${result.error}`);
  } else {
    rows = Array.isArray(result.data) ? result.data : [];
    printSnapshot(rows);
    evaluate(rows);
  }
}

if (failures.length > 0) {
  console.log('');
  console.error('Support health check failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('');
console.log('Support health check passed.');

function printSnapshot(items) {
  const open = items.filter((item) => item.status === 'open').length;
  const pending = items.filter((item) => item.status === 'pending').length;
  const high = items.filter((item) => item.priority === 'high').length;
  const overSla = countOverSla(items);
  const oldestAge = oldestAgeSeconds(items);

  console.log('');
  console.log('Support Threads:');
  console.log(`  - open: ${number(open)}`);
  console.log(`  - pending: ${number(pending)}`);
  console.log(`  - high priority: ${number(high)}`);
  console.log(`  - over SLA: ${number(overSla)}`);
  console.log(`  - oldest open age: ${formatAge(oldestAge)}`);
}

function evaluate(items) {
  if (items.length > maxOpen) failures.push(`[support] Open/pending support threads ${items.length} > ${maxOpen}.`);
  const overSla = countOverSla(items);
  if (overSla > maxOverSla) failures.push(`[sla] Support threads over SLA ${overSla} > ${maxOverSla}.`);
  const oldest = oldestAgeSeconds(items);
  if (oldest > maxOldestOpenHours * 60 * 60) {
    failures.push(`[sla] Oldest open support thread is ${formatAge(oldest)} old (limit ${maxOldestOpenHours}h).`);
  }
}

function countOverSla(items) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return items.filter((item) => new Date(item.created_at).getTime() < cutoff).length;
}

function oldestAgeSeconds(items) {
  if (items.length === 0) return 0;
  const oldest = Math.min(...items.map((item) => new Date(item.created_at).getTime()).filter(Number.isFinite));
  return Math.max(0, Math.floor((Date.now() - oldest) / 1000));
}

function formatAge(seconds) {
  if (!seconds) return 'none';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

function printHelp() {
  console.log(`
Usage: node scripts/check-support-health.mjs [options]

Checks open support threads and SLA state.

Options:
  --max-open <n>                Max open/pending threads (default ${DEFAULT_MAX_OPEN})
  --max-over-sla <n>            Max threads older than 24h (default ${DEFAULT_MAX_OVER_SLA})
  --max-oldest-open-hours <n>   Max oldest open thread age (default ${DEFAULT_MAX_OLDEST_OPEN_HOURS})
`);
}
