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
const DEFAULT_MAX_REPORT_RATE = 0.2;
const DEFAULT_MAX_STALE_DAYS = 14;

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
const maxReportRate = Number(args.maxReportRate ?? DEFAULT_MAX_REPORT_RATE);
const maxStaleDays = readPositiveInt(args.maxStaleDays, DEFAULT_MAX_STALE_DAYS);
const failures = [];

console.log('Region health check');
console.log('No secret values are printed.');

if (!supabaseUrl) failures.push('[env] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL.');
if (!serviceKey) failures.push('[env] Missing SUPABASE_SERVICE_ROLE_KEY.');

let metrics = [];
if (failures.length === 0) {
  const result = await fetchRest({
    supabaseUrl,
    key: serviceKey,
    path: `admin_region_daily_metrics?select=country_code,country_name,metric_date,active_users,new_registrations,posts,views,reports,source&metric_date=gte.${thirtyDaysAgo()}&limit=5000`,
    timeoutMs,
  });
  if (!result.ok) {
    failures.push(`[snapshot] admin_region_daily_metrics failed: ${result.status} ${result.error}`);
  } else {
    metrics = Array.isArray(result.data) ? result.data : [];
    printSnapshot(metrics);
    evaluate(metrics);
  }
}

if (failures.length > 0) {
  console.log('');
  console.error('Region health check failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('');
console.log('Region health check passed.');

function printSnapshot(items) {
  const countries = groupByCountry(items);
  const active = items.reduce((sum, item) => sum + Number(item.active_users || 0), 0);
  const views = items.reduce((sum, item) => sum + Number(item.views || 0), 0);
  const reports = items.reduce((sum, item) => sum + Number(item.reports || 0), 0);

  console.log('');
  console.log('Regions:');
  console.log(`  - countries 30d: ${number(countries.size)}`);
  console.log(`  - active users 30d: ${number(active)}`);
  console.log(`  - views 30d: ${number(views)}`);
  console.log(`  - reports 30d: ${number(reports)}`);
  console.log(`  - report rate: ${formatRate(reports, Math.max(active, 1))}`);
}

function evaluate(items) {
  if (items.length === 0) return;
  const countries = groupByCountry(items);
  const cutoff = Date.now() - maxStaleDays * 24 * 60 * 60 * 1000;
  for (const [code, rows] of countries) {
    const latest = Math.max(...rows.map((row) => new Date(row.metric_date).getTime()).filter(Number.isFinite));
    if (latest < cutoff) failures.push(`[regions] ${code} latest metric older than ${maxStaleDays}d.`);
    const active = rows.reduce((sum, row) => sum + Number(row.active_users || 0), 0);
    const reports = rows.reduce((sum, row) => sum + Number(row.reports || 0), 0);
    const reportRate = active > 0 ? reports / active : 0;
    if (reportRate > maxReportRate) {
      failures.push(`[regions] ${code} report rate ${formatRate(reports, active)} > ${Math.round(maxReportRate * 100)}%.`);
    }
  }
}

function groupByCountry(items) {
  const grouped = new Map();
  for (const item of items) {
    const code = item.country_code || '??';
    if (!grouped.has(code)) grouped.set(code, []);
    grouped.get(code).push(item);
  }
  return grouped;
}

function thirtyDaysAgo() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 30);
  return date.toISOString().slice(0, 10);
}

function formatRate(numerator, denominator) {
  if (!denominator) return 'n/a';
  return `${Math.round((numerator / denominator) * 1000) / 10}%`;
}

function printHelp() {
  console.log(`
Usage: node scripts/check-region-health.mjs [options]

Checks regional metrics freshness and report-rate spikes.

Options:
  --max-report-rate <n>  Max reports / active users per region (default ${DEFAULT_MAX_REPORT_RATE})
  --max-stale-days <n>   Max latest metric age per region (default ${DEFAULT_MAX_STALE_DAYS})
`);
}
