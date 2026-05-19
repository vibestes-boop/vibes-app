import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fetchRest,
  loadEnv,
  money,
  normalizeBase,
  number,
  parseArgs,
  readEnv,
  readPositiveInt,
} from './lib/supabase-health.mjs';

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_FAILED = 0;
const DEFAULT_MAX_ACTIVE_WITHOUT_METRICS = 0;

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
const maxFailed = Number.parseInt(String(args.maxFailed ?? DEFAULT_MAX_FAILED), 10);
const maxActiveWithoutMetrics = Number.parseInt(String(args.maxActiveWithoutMetrics ?? DEFAULT_MAX_ACTIVE_WITHOUT_METRICS), 10);
const failures = [];

console.log('Campaign health check');
console.log('No secret values are printed.');

if (!supabaseUrl) failures.push('[env] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL.');
if (!serviceKey) failures.push('[env] Missing SUPABASE_SERVICE_ROLE_KEY.');

let campaigns = [];
let metrics = [];
if (failures.length === 0) {
  const [campaignResult, metricsResult] = await Promise.all([
    fetchRest({
      supabaseUrl,
      key: serviceKey,
      path: 'admin_campaigns?select=id,title,status,budget_cents,spend_cents,updated_at&limit=1000',
      timeoutMs,
    }),
    fetchRest({
      supabaseUrl,
      key: serviceKey,
      path: `admin_campaign_daily_metrics?select=campaign_id,metric_date,impressions,clicks,conversions,revenue_cents,spend_cents&metric_date=gte.${thirtyDaysAgo()}&limit=5000`,
      timeoutMs,
    }),
  ]);
  if (!campaignResult.ok) failures.push(`[snapshot] admin_campaigns failed: ${campaignResult.status} ${campaignResult.error}`);
  if (!metricsResult.ok) failures.push(`[snapshot] admin_campaign_daily_metrics failed: ${metricsResult.status} ${metricsResult.error}`);
  campaigns = Array.isArray(campaignResult.data) ? campaignResult.data : [];
  metrics = Array.isArray(metricsResult.data) ? metricsResult.data : [];
  if (failures.length === 0) {
    printSnapshot(campaigns, metrics);
    evaluate(campaigns, metrics);
  }
}

if (failures.length > 0) {
  console.log('');
  console.error('Campaign health check failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('');
console.log('Campaign health check passed.');

function printSnapshot(items, metricRows) {
  const active = items.filter((item) => item.status === 'active').length;
  const paused = items.filter((item) => item.status === 'paused').length;
  const failed = items.filter((item) => item.status === 'failed').length;
  const spend = metricRows.reduce((sum, item) => sum + Number(item.spend_cents || 0), 0);
  const conversions = metricRows.reduce((sum, item) => sum + Number(item.conversions || 0), 0);
  const activeWithoutMetrics = countActiveWithoutMetrics(items, metricRows);

  console.log('');
  console.log('Campaigns:');
  console.log(`  - total: ${number(items.length)}`);
  console.log(`  - active/paused/failed: ${number(active)}/${number(paused)}/${number(failed)}`);
  console.log(`  - active without 30d metrics: ${number(activeWithoutMetrics)}`);
  console.log(`  - spend 30d: ${money(spend)}`);
  console.log(`  - conversions 30d: ${number(conversions)}`);
}

function evaluate(items, metricRows) {
  const failed = items.filter((item) => item.status === 'failed').length;
  if (failed > maxFailed) failures.push(`[campaigns] Failed campaigns ${failed} > ${maxFailed}.`);
  const activeWithoutMetrics = countActiveWithoutMetrics(items, metricRows);
  if (activeWithoutMetrics > maxActiveWithoutMetrics) {
    failures.push(`[campaigns] Active campaigns without 30d metrics ${activeWithoutMetrics} > ${maxActiveWithoutMetrics}.`);
  }
}

function countActiveWithoutMetrics(items, metricRows) {
  const metricCampaigns = new Set(metricRows.map((row) => row.campaign_id));
  return items.filter((item) => item.status === 'active' && !metricCampaigns.has(item.id)).length;
}

function thirtyDaysAgo() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 30);
  return date.toISOString().slice(0, 10);
}

function printHelp() {
  console.log(`
Usage: node scripts/check-campaign-health.mjs [options]

Checks campaign status and whether active campaigns have recent metrics.

Options:
  --max-failed <n>                  Max failed campaigns (default ${DEFAULT_MAX_FAILED})
  --max-active-without-metrics <n>  Max active campaigns with no 30d metrics (default ${DEFAULT_MAX_ACTIVE_WITHOUT_METRICS})
`);
}
