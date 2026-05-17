import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_PENDING = 10;
const DEFAULT_MAX_ERROR = 0;
const DEFAULT_MAX_PENDING_AGE_MINUTES = 15;
const DEFAULT_MAX_EMPTY_POSTS = 0;
const DEFAULT_MAX_BROKEN_MEDIA = 0;
const DEFAULT_MEDIA_SAMPLE = 12;
const REQUIRED_CRON_JOBS = ['r2-delete-queue'];

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
const maxError = readNonNegativeInt(args.maxError, DEFAULT_MAX_ERROR);
const maxPendingAgeMinutes = readNonNegativeInt(
  args.maxPendingAgeMinutes,
  DEFAULT_MAX_PENDING_AGE_MINUTES,
);
const maxEmptyPosts = readNonNegativeInt(args.maxEmptyPosts, DEFAULT_MAX_EMPTY_POSTS);
const maxBrokenMedia = readNonNegativeInt(args.maxBrokenMedia, DEFAULT_MAX_BROKEN_MEDIA);
const mediaSample = readNonNegativeInt(args.mediaSample, DEFAULT_MEDIA_SAMPLE);
const requiredCronJobs = (args.requiredCronJobs || REQUIRED_CRON_JOBS.join(','))
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const failures = [];
const warnings = [];

console.log('Production integrity monitor');
console.log('No secret values are printed.');

if (!supabaseUrl) failures.push('[env] Missing NEXT_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL.');
if (!anonKey) failures.push('[env] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY.');

let snapshot = null;
if (failures.length === 0) {
  snapshot = await fetchIntegritySnapshot();
  if (snapshot) validateSnapshot(snapshot);
}

if (failures.length === 0 && !args.skipFunctions) {
  await checkEdgeFunctions();
}

if (failures.length === 0 && mediaSample > 0) {
  await checkRecentMediaReferences();
}

if (warnings.length > 0) {
  console.log('');
  console.log('Warnings:');
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (failures.length > 0) {
  console.log('');
  console.error('Production integrity monitor failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('');
console.log('Production integrity monitor passed.');

async function fetchIntegritySnapshot() {
  const result = await fetchJson(`${supabaseUrl}/rest/v1/rpc/production_integrity_snapshot`, {
    method: 'POST',
    headers: supabaseHeaders(),
    body: '{}',
  });

  if (!result.ok) {
    failures.push(
      `[snapshot] RPC production_integrity_snapshot failed: ${result.status} ${result.error || ''}`.trim(),
    );
    return null;
  }

  console.log('');
  console.log('Database snapshot:');
  console.log(`  - generated_at: ${result.data.generated_at}`);

  return result.data;
}

function validateSnapshot(data) {
  const queue = data.r2_delete_queue || {};
  const posts = data.posts || {};
  const cron = data.cron || {};
  const jobs = Array.isArray(cron.jobs) ? cron.jobs : [];

  console.log(
    `  - r2_delete_queue: total=${queue.total ?? 0}, pending=${queue.pending ?? 0}, ` +
      `error=${queue.error ?? 0}, oldest_age=${formatAge(queue.oldest_pending_age_seconds)}`,
  );
  console.log(
    `  - posts: empty_content=${posts.empty_content ?? 0}, media_references=${posts.media_references ?? 0}`,
  );
  console.log(
    `  - cron: available=${Boolean(cron.available)}, jobs=${
      jobs.map((job) => `${job.jobname}:${job.active ? 'active' : 'inactive'}`).join(', ') || 'none'
    }`,
  );

  if ((queue.pending ?? 0) > maxPending) {
    failures.push(`[queue] Pending R2 deletes ${queue.pending} > ${maxPending}.`);
  }

  if ((queue.error ?? 0) > maxError) {
    failures.push(`[queue] Failed R2 deletes ${queue.error} > ${maxError}: ${queue.latest_error || 'no detail'}.`);
  }

  const oldestAgeSeconds = Number(queue.oldest_pending_age_seconds);
  if (Number.isFinite(oldestAgeSeconds) && oldestAgeSeconds > maxPendingAgeMinutes * 60) {
    failures.push(
      `[queue] Oldest pending R2 delete is ${Math.round(oldestAgeSeconds / 60)}m old ` +
        `(limit ${maxPendingAgeMinutes}m).`,
    );
  }

  if ((posts.empty_content ?? 0) > maxEmptyPosts) {
    failures.push(`[integrity] Empty posts ${posts.empty_content} > ${maxEmptyPosts}.`);
  }

  if (!cron.available) {
    failures.push('[cron] pg_cron job table is not visible to production_integrity_snapshot.');
  }

  for (const jobName of requiredCronJobs) {
    const job = jobs.find((item) => item.jobname === jobName);
    if (!job) {
      failures.push(`[cron] Required job "${jobName}" is not registered.`);
    } else if (!job.active) {
      failures.push(`[cron] Required job "${jobName}" is registered but inactive.`);
    }
  }
}

async function checkEdgeFunctions() {
  console.log('');
  console.log('Edge functions:');

  const processQueue = await fetchJson(`${supabaseUrl}/functions/v1/r2-delete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ processQueue: true, limit: 1 }),
  });
  printFunctionResult('r2-delete processQueue', processQueue);
  if (!processQueue.ok || processQueue.data?.ok !== true) {
    failures.push(
      `[function:r2-delete] processQueue failed: ${processQueue.status} ${processQueue.error || ''}`.trim(),
    );
  } else if ((processQueue.data.failed ?? 0) > 0) {
    failures.push(`[function:r2-delete] processQueue returned failed=${processQueue.data.failed}.`);
  }

  const r2SignOptions = await fetchText(`${supabaseUrl}/functions/v1/r2-sign`, {
    method: 'OPTIONS',
  });
  console.log(`  - r2-sign OPTIONS: ${r2SignOptions.status}`);
  if (!r2SignOptions.ok) {
    failures.push(`[function:r2-sign] OPTIONS failed: ${r2SignOptions.status}.`);
  }
}

async function checkRecentMediaReferences() {
  const path =
    '/rest/v1/posts?select=id,media_url,thumbnail_url,created_at' +
    '&or=(media_url.not.is.null,thumbnail_url.not.is.null)' +
    `&order=created_at.desc&limit=${mediaSample}`;
  const result = await fetchJson(`${supabaseUrl}${path}`, {
    headers: supabaseHeaders(),
  });

  console.log('');
  console.log('Recent media references:');

  if (!result.ok) {
    failures.push(`[media] Could not fetch recent media references: ${result.status} ${result.error || ''}`.trim());
    return;
  }

  const urls = Array.from(
    new Set(
      result.data
        .flatMap((row) => [row.media_url, row.thumbnail_url])
        .filter((value) => typeof value === 'string' && /^https?:\/\//.test(value)),
    ),
  ).slice(0, mediaSample);

  console.log(`  - sampled posts=${result.data.length}, urls=${urls.length}`);

  const broken = [];
  for (const url of urls) {
    const probe = await fetchText(url, {
      method: 'HEAD',
      headers: { 'user-agent': 'SerloProductionIntegrity/1.0' },
    });
    if (!probe.ok) broken.push({ url, status: probe.status, error: probe.error });
  }

  console.log(`  - broken=${broken.length}`);
  if (broken.length > maxBrokenMedia) {
    failures.push(
      `[media] Broken media references ${broken.length} > ${maxBrokenMedia}: ` +
        broken.slice(0, 3).map((item) => `${item.status} ${item.url}`).join(', '),
    );
  }
}

function printFunctionResult(label, result) {
  const detail = result.data ? ` ${JSON.stringify(result.data)}` : result.error ? ` ${result.error}` : '';
  console.log(`  - ${label}: ${result.status}${detail}`);
}

function supabaseHeaders() {
  return {
    accept: 'application/json',
    apikey: anonKey,
    authorization: `Bearer ${anonKey}`,
    'content-type': 'application/json',
  };
}

async function fetchJson(url, init = {}) {
  const response = await fetchText(url, init);
  if (!response.ok) return response;

  try {
    return {
      ...response,
      data: response.text ? JSON.parse(response.text) : null,
      error: null,
    };
  } catch {
    return {
      ...response,
      ok: false,
      error: 'Invalid JSON response',
      data: null,
    };
  }
}

async function fetchText(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      text,
      data: null,
      error: response.ok ? null : summarizeError(text),
    };
  } catch (error) {
    return {
      ok: false,
      status: 'FETCH_ERROR',
      text: '',
      data: null,
      error: formatError(error),
    };
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
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
  }
}

function readEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
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

function formatAge(seconds) {
  if (seconds === null || seconds === undefined) return 'none';
  const value = Number(seconds);
  if (!Number.isFinite(value)) return 'unknown';
  if (value < 60) return `${value}s`;
  return `${Math.round(value / 60)}m`;
}

function summarizeError(text) {
  if (!text) return '';
  try {
    const parsed = JSON.parse(text);
    return parsed.message || parsed.error || parsed.msg || text.slice(0, 160);
  } catch {
    return text.slice(0, 160).replace(/\s+/g, ' ').trim();
  }
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function printHelp() {
  console.log(`
Usage: node scripts/check-production-integrity.mjs [options]

Options:
  --supabase-url <url>            Override Supabase URL
  --anon-key <key>                Override Supabase anon key
  --max-pending <n>               Max pending R2 cleanup rows (default ${DEFAULT_MAX_PENDING})
  --max-error <n>                 Max errored R2 cleanup rows (default ${DEFAULT_MAX_ERROR})
  --max-pending-age-minutes <n>   Max age for oldest pending row (default ${DEFAULT_MAX_PENDING_AGE_MINUTES})
  --max-empty-posts <n>           Max posts with no media and no caption (default ${DEFAULT_MAX_EMPTY_POSTS})
  --max-broken-media <n>          Max broken recent media URLs (default ${DEFAULT_MAX_BROKEN_MEDIA})
  --media-sample <n>              Recent media URL sample size (default ${DEFAULT_MEDIA_SAMPLE})
  --required-cron-jobs <csv>      Required pg_cron jobs (default ${REQUIRED_CRON_JOBS.join(',')})
  --skip-functions                Skip Edge Function probes
  --timeout-ms <n>                Request timeout (default ${DEFAULT_TIMEOUT_MS})
`);
}
