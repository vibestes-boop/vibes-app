import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_SITE_URL = 'https://serlo-web.vercel.app';
const DEFAULT_LIMIT = 2;
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_SETTLE_MS = 3500;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = path.join(repoRoot, 'apps/web');
const args = parseArgs(process.argv.slice(2));
const env = loadEnv(repoRoot);
const failures = [];
const warnings = [];
const checked = [];

if (args.help) {
  printHelp();
  process.exit(0);
}

const siteUrl = normalizeBase(args.siteUrl || process.env.STABILITY_SITE_URL || DEFAULT_SITE_URL);
const limit = readPositiveInt(args.limit, DEFAULT_LIMIT);
const timeoutMs = readPositiveInt(args.timeoutMs, DEFAULT_TIMEOUT_MS);
const settleMs = readPositiveInt(args.settleMs, DEFAULT_SETTLE_MS);
const supabaseUrl = readEnv(['NEXT_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL']);
const serviceRoleKey = readEnv(['SUPABASE_SERVICE_ROLE_KEY']);

console.log(`Live runtime smoke: ${siteUrl}`);
console.log('No secret values are printed.');
console.log(`Loaded env files: ${env.loaded.length > 0 ? env.loaded.join(', ') : '(none)'}`);

requireEnv('NEXT_PUBLIC_SUPABASE_URL | EXPO_PUBLIC_SUPABASE_URL', supabaseUrl);
requireEnv('SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey);

let sessions = [];
if (failures.length === 0) {
  sessions = args.sessionId
    ? [{ id: args.sessionId, source: 'argument' }]
    : await fetchActiveLiveSessions(supabaseUrl.value, serviceRoleKey.value, limit);
}

if (failures.length === 0 && sessions.length === 0) {
  sessions = await fetchRecentLiveSessions(supabaseUrl.value, serviceRoleKey.value, limit);
  if (sessions.length > 0) {
    warnings.push('No active live sessions found; checked recent live sessions instead.');
  }
}

if (failures.length === 0 && sessions.length === 0) {
  console.log('');
  console.log('Live runtime smoke skipped: no active or recent live sessions found.');
  process.exit(0);
}

if (failures.length === 0) {
  await runBrowserSmoke(sessions);
}

console.log('');
console.log('Checked live runtime:');
for (const item of checked) console.log(`  [OK] ${item}`);

if (warnings.length > 0) {
  console.log('');
  console.log('Warnings:');
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (failures.length > 0) {
  console.log('');
  console.error('Live runtime smoke failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(args.noFail ? 0 : 1);
}

console.log('');
console.log('Live runtime smoke passed.');

async function fetchActiveLiveSessions(url, key, maxRows) {
  const service = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'x-serlo-stability-check': 'live-runtime',
      },
    },
  });

  const { data, error } = await service
    .from('live_sessions')
    .select('id,status,title,started_at,updated_at')
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(maxRows);

  if (error) {
    failures.push(`[live_sessions] Could not fetch active sessions: ${error.message}`);
    return [];
  }

  return (data ?? []).map((row) => ({ ...row, source: 'active' }));
}

async function fetchRecentLiveSessions(url, key, maxRows) {
  const service = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'x-serlo-stability-check': 'live-runtime-recent',
      },
    },
  });

  const { data, error } = await service
    .from('live_sessions')
    .select('id,status,title,started_at,updated_at')
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(maxRows);

  if (error) {
    failures.push(`[live_sessions] Could not fetch recent sessions: ${error.message}`);
    return [];
  }

  return (data ?? []).map((row) => ({ ...row, source: 'recent' }));
}

async function runBrowserSmoke(sessions) {
  const { chromium } = loadPlaywright();
  const browser = await launchChromium(chromium);

  try {
    for (const session of sessions) {
      await smokeOneSession(browser, session);
    }
  } finally {
    await browser.close();
  }
}

async function smokeOneSession(browser, session) {
  const pageErrors = [];
  const consoleErrors = [];
  const url = `${siteUrl}/live/${session.id}`;
  const context = await browser.newContext({
    userAgent: 'SerloLiveRuntimeSmoke/1.0',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  page.on('pageerror', (error) => {
    pageErrors.push(formatError(error));
  });
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    consoleErrors.push(message.text());
  });

  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });
    await page.waitForTimeout(settleMs);

    const status = response?.status() ?? 0;
    const bodyText = await page.locator('body').innerText({ timeout: 2000 }).catch(() => '');
    const actionableErrors = [...pageErrors, ...consoleErrors].filter(isActionableLiveError);

    if (!response || status >= 500) {
      failures.push(`[live:${session.id}] Navigation failed with status ${status || 'unknown'}.`);
    } else if (status === 404) {
      warnings.push(`[live:${session.id}] Session returned 404; it may have ended before the smoke completed.`);
    } else if (/Application error: a client-side exception/i.test(bodyText)) {
      failures.push(`[live:${session.id}] Rendered the Next.js client-side exception screen.`);
    } else if (actionableErrors.length > 0) {
      failures.push(`[live:${session.id}] Browser error(s): ${dedupe(actionableErrors).join(' | ')}`);
    } else {
      const label = session.source === 'recent' ? `recent ${session.status || 'unknown'}` : session.source;
      checked.push(`/live/${session.id} ${status} (${label})`);
    }

    const noisyRealtimeErrors = [...pageErrors, ...consoleErrors].filter(isNoisyRealtimeWarning);
    if (noisyRealtimeErrors.length > 0) {
      warnings.push(`[live:${session.id}] Realtime warning(s): ${dedupe(noisyRealtimeErrors).slice(0, 2).join(' | ')}`);
    }
  } catch (error) {
    failures.push(`[live:${session.id}] Smoke failed: ${formatError(error)}`);
  } finally {
    await context.close();
  }
}

function loadPlaywright() {
  const requireFromWeb = createRequire(path.join(webRoot, 'package.json'));
  try {
    return requireFromWeb('@playwright/test');
  } catch (error) {
    throw new Error(`Playwright is not available from ${webRoot}: ${formatError(error)}`);
  }
}

async function launchChromium(chromium) {
  try {
    return await chromium.launch({ channel: 'chrome', headless: true });
  } catch (chromeError) {
    try {
      return await chromium.launch({ headless: true });
    } catch (bundledError) {
      throw new Error(
        `Could not launch Chromium. Chrome channel: ${formatError(chromeError)}; bundled: ${formatError(bundledError)}`,
      );
    }
  }
}

function isActionableLiveError(message) {
  return [
    /Application error/i,
    /Minified React error #310/i,
    /cannot add .*postgres_changes.*after `?subscribe/i,
    /live_comments\.pinned/i,
    /column .*live_comments.*pinned/i,
    /Could not find the function public\.vote_on_poll/i,
    /vote_on_poll.*schema cache/i,
    /my_coin_balance/i,
    /send_gift.*schema cache/i,
    /TypeError: Cannot assign to property 'default'/i,
  ].some((pattern) => pattern.test(message));
}

function isNoisyRealtimeWarning(message) {
  return /WebSocket connection .*closed before the connection is established/i.test(message);
}

function dedupe(items) {
  return Array.from(new Set(items.map((item) => item.replace(/\s+/g, ' ').trim()).filter(Boolean)));
}

function requireEnv(label, item) {
  if (!item.value) failures.push(`[env] Missing ${label}.`);
}

function readEnv(names) {
  for (const name of names) {
    const value = process.env[name];
    if (value && !isPlaceholder(value)) return { names, name, value };
  }
  return { names, name: null, value: '' };
}

function isPlaceholder(value) {
  return /^(your_|replace_|todo|changeme|placeholder)/i.test(value.trim());
}

function loadEnv(root) {
  const files = ['.env', '.env.local', 'apps/web/.env', 'apps/web/.env.local'];
  const loaded = [];

  for (const file of files) {
    const fullPath = path.join(root, file);
    if (!fs.existsSync(fullPath)) continue;
    loaded.push(file);
    const raw = fs.readFileSync(fullPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      if (process.env[parsed.key] === undefined) {
        process.env[parsed.key] = parsed.value;
      }
    }
  }

  return { loaded };
}

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const equals = trimmed.indexOf('=');
  if (equals <= 0) return null;
  const key = trimmed.slice(0, equals).trim();
  let value = trimmed.slice(equals + 1).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

function normalizeBase(value) {
  return String(value || '').replace(/\/+$/, '');
}

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseArgs(argv) {
  const parsed = {
    help: false,
    limit: DEFAULT_LIMIT,
    noFail: false,
    sessionId: process.env.STABILITY_LIVE_SESSION_ID || '',
    settleMs: DEFAULT_SETTLE_MS,
    siteUrl: '',
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') parsed.help = true;
    else if (arg === '--no-fail') parsed.noFail = true;
    else if (arg === '--site-url') parsed.siteUrl = argv[++index] || '';
    else if (arg === '--session-id') parsed.sessionId = argv[++index] || '';
    else if (arg === '--limit') parsed.limit = argv[++index] || DEFAULT_LIMIT;
    else if (arg === '--timeout-ms') parsed.timeoutMs = argv[++index] || DEFAULT_TIMEOUT_MS;
    else if (arg === '--settle-ms') parsed.settleMs = argv[++index] || DEFAULT_SETTLE_MS;
  }

  return parsed;
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function printHelp() {
  console.log(`Usage: node scripts/check-live-runtime.mjs [--session-id UUID] [--limit N] [--no-fail]

Opens active production /live/:id pages in a headless browser. When no stream
is active, it probes recent live pages so client-side exception screens still
get caught overnight. Fails on known live runtime errors such as React #310,
schema-cache misses, missing live_comments.pinned, and late postgres_changes
subscription crashes.`);
}
