import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_TIMEOUT_MS = 12000;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const timeoutMs = readPositiveInt(args.timeoutMs || process.env.PROVIDER_BILLING_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
const outputDir = path.resolve(repoRoot, args.outputDir || process.env.PROVIDER_BILLING_OUTPUT_DIR || path.join(os.tmpdir(), 'vibes-provider-billing'));
const failures = [];
const warnings = [];

if (args.help) {
  printHelp();
  process.exit(0);
}

const sources = readSources();
if (sources.length === 0) {
  console.log('Provider billing fetch skipped: no provider billing sources configured.');
  if (args.githubEnv) console.log(`PROVIDER_BILLING_DIR=${outputDir}`);
  process.exit(0);
}

fs.mkdirSync(outputDir, { recursive: true });

console.log('Fetching provider billing exports');
console.log('No secret values are printed.');
console.log(`Output dir: ${outputDir}`);

for (const source of sources) {
  await fetchSource(source);
}

if (warnings.length > 0) {
  console.log('');
  console.log('Warnings:');
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (failures.length > 0) {
  console.log('');
  console.error('Provider billing fetch failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

if (args.githubEnv) {
  console.log(`PROVIDER_BILLING_DIR=${outputDir}`);
} else {
  console.log('');
  console.log('Provider billing fetch passed.');
}

function readSources() {
  const json = args.sourcesJson || process.env.PROVIDER_BILLING_SOURCES_JSON;
  if (json) {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) {
        failures.push('[provider-billing] PROVIDER_BILLING_SOURCES_JSON must be an array.');
        return [];
      }
      return parsed.map(normalizeSource).filter(Boolean);
    } catch (error) {
      failures.push(`[provider-billing] PROVIDER_BILLING_SOURCES_JSON is invalid JSON: ${error.message}`);
      return [];
    }
  }

  return [
    sourceFromEnv('cloudflare-r2', 'CLOUDFLARE_BILLING'),
    sourceFromEnv('supabase', 'SUPABASE_BILLING'),
    sourceFromEnv('vercel', 'VERCEL_BILLING'),
    sourceFromEnv('livekit', 'LIVEKIT_BILLING'),
    sourceFromEnv('ai', 'AI_BILLING'),
  ].filter(Boolean);
}

function sourceFromEnv(provider, prefix) {
  const url = process.env[`${prefix}_URL`];
  if (!url) return null;

  const headers = {};
  const bearer = process.env[`${prefix}_BEARER_TOKEN`];
  const apiKey = process.env[`${prefix}_API_KEY`];
  const accountId = process.env[`${prefix}_ACCOUNT_ID`];
  if (bearer) headers.authorization = `Bearer ${bearer}`;
  if (apiKey) headers['x-api-key'] = apiKey;
  if (accountId) headers['x-account-id'] = accountId;

  return normalizeSource({
    provider,
    url,
    method: process.env[`${prefix}_METHOD`] || 'GET',
    headers,
    body: process.env[`${prefix}_BODY`] || null,
    format: process.env[`${prefix}_FORMAT`] || null,
  });
}

function normalizeSource(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!raw.url || !raw.provider) {
    failures.push('[provider-billing] Each source needs provider and url.');
    return null;
  }
  return {
    provider: sanitizeName(raw.provider),
    url: String(raw.url),
    method: String(raw.method || 'GET').toUpperCase(),
    headers: normalizeHeaders(raw.headers || {}),
    body: raw.body ?? null,
    format: String(raw.format || '').replace(/^\./, '').toLowerCase(),
  };
}

async function fetchSource(source) {
  const response = await fetchWithTimeout(source.url, {
    method: source.method,
    headers: source.headers,
    body: source.body == null ? undefined : String(source.body),
  });
  const text = await response.text();

  if (!response.ok) {
    failures.push(`[provider-billing] ${source.provider} returned ${response.status}: ${summarize(text)}`);
    return;
  }

  const contentType = response.headers.get('content-type') || '';
  const extension = source.format || (contentType.includes('csv') ? 'csv' : 'json');
  const file = path.join(outputDir, `${source.provider}.${extension}`);
  fs.writeFileSync(file, text);
  console.log(`  - ${source.provider}: fetched ${extension} export`);
}

async function fetchWithTimeout(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    failures.push(`[provider-billing] Fetch failed for ${scrubUrl(url)}: ${error.message}`);
    return new Response('', { status: 599 });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeHeaders(headers) {
  if (typeof headers === 'string') {
    try {
      headers = JSON.parse(headers);
    } catch {
      return {};
    }
  }
  return Object.fromEntries(
    Object.entries(headers)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key.toLowerCase(), String(value)]),
  );
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--github-env') {
      parsed.githubEnv = true;
    } else if (arg.startsWith('--sources-json=')) {
      parsed.sourcesJson = arg.slice('--sources-json='.length);
    } else if (arg === '--sources-json' && argv[index + 1]) {
      parsed.sourcesJson = argv[index + 1];
      index += 1;
    } else if (arg.startsWith('--output-dir=')) {
      parsed.outputDir = arg.slice('--output-dir='.length);
    } else if (arg === '--output-dir' && argv[index + 1]) {
      parsed.outputDir = argv[index + 1];
      index += 1;
    } else if (arg.startsWith('--timeout-ms=')) {
      parsed.timeoutMs = arg.slice('--timeout-ms='.length);
    } else if (arg === '--timeout-ms' && argv[index + 1]) {
      parsed.timeoutMs = argv[index + 1];
      index += 1;
    }
  }
  return parsed;
}

function sanitizeName(value) {
  return String(value || 'provider')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'provider';
}

function scrubUrl(value) {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    url.search = '';
    return url.toString();
  } catch {
    return 'configured provider URL';
  }
}

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function summarize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function printHelp() {
  console.log(`
Usage: node scripts/fetch-provider-billing.mjs [options]

Options:
  --sources-json <json>     Array of { provider, url, method, headers, body, format }
  --output-dir <path>       Directory for downloaded JSON/CSV exports
  --github-env              Print PROVIDER_BILLING_DIR=... for GitHub Actions
  --timeout-ms <n>          Per-provider timeout, default ${DEFAULT_TIMEOUT_MS}

Env shorthands:
  CLOUDFLARE_BILLING_URL, SUPABASE_BILLING_URL, VERCEL_BILLING_URL,
  LIVEKIT_BILLING_URL, AI_BILLING_URL plus optional *_BEARER_TOKEN,
  *_API_KEY, *_ACCOUNT_ID, *_METHOD, *_BODY, *_FORMAT.
`);
}
