import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const timeoutMs = readPositiveInt(args.timeoutMs, 60000);

if (args.help) {
  printHelp();
  process.exit(0);
}

console.log('Observability health check');
console.log('No secret values are printed.');

const localEnv = loadLocalEnv();
const local = assessEnvironment('Local env', localEnv);
const assessments = [local];

if (args.vercelProduction || args.vercel) {
  const vercelKeys = fetchVercelProductionEnv();
  assessments.push(assessEnvironment('Vercel production env', vercelKeys));
}

for (const assessment of assessments) printAssessment(assessment);

const worst = worstStatus(assessments.map((item) => item.status));
console.log('');
console.log(`Overall status: ${worst}`);

if (worst !== 'Green') {
  console.log('');
  console.log('Next actions:');
  const needsRuntimeDsn = assessments.some((item) => !item.runtimeDsn);
  const needsSourceMaps = assessments.some((item) => item.sourceMapState !== 'complete');
  const edgeEnabled = assessments.some((item) => item.edgeEnabled);
  if (needsRuntimeDsn) {
    console.log('  - Set NEXT_PUBLIC_SENTRY_DSN and SENTRY_DSN for Production and Preview.');
  }
  if (needsSourceMaps) {
    console.log('  - Add SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT after the Sentry project is confirmed.');
  }
  if (edgeEnabled) {
    console.log('  - Keep SENTRY_ENABLE_EDGE unset unless a preview deploy proves Edge Sentry is safe.');
  }
}

if ((args.strict || args.requireGreen) && worst !== 'Green') {
  console.log('');
  console.error('Strict observability health failed.');
  process.exit(1);
}

console.log('');
console.log('Observability health check passed.');

function assessEnvironment(label, keys) {
  const runtimeDsn = hasAny(keys, ['NEXT_PUBLIC_SENTRY_DSN', 'SENTRY_DSN']);
  const sourceMapKeys = ['SENTRY_AUTH_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECT'];
  const sourceMapPresent = sourceMapKeys.filter((key) => keys.has(key));
  const sourceMapState =
    sourceMapPresent.length === sourceMapKeys.length
      ? 'complete'
      : sourceMapPresent.length > 0
        ? 'partial'
        : 'missing';
  const edgeEnabled = keys.has('SENTRY_ENABLE_EDGE');
  const posthogState = hasAll(keys, ['NEXT_PUBLIC_POSTHOG_KEY', 'NEXT_PUBLIC_POSTHOG_HOST'])
    ? 'complete'
    : hasAny(keys, ['NEXT_PUBLIC_POSTHOG_KEY', 'NEXT_PUBLIC_POSTHOG_HOST'])
      ? 'partial'
      : 'missing';
  const timingLogs = hasAny(keys, [
    'SUPABASE_QUERY_TIMING',
    'NEXT_PUBLIC_SUPABASE_QUERY_TIMING',
    'SERLO_TIMING_LOGS',
    'SERVER_ACTION_TIMING',
  ]);

  const red = edgeEnabled && !runtimeDsn;
  const yellow =
    !red &&
    (!runtimeDsn ||
      sourceMapState !== 'complete' ||
      edgeEnabled ||
      posthogState === 'partial');

  return {
    label,
    status: red ? 'Red' : yellow ? 'Yellow' : 'Green',
    runtimeDsn,
    sourceMapState,
    sourceMapMissing: sourceMapKeys.filter((key) => !keys.has(key)),
    edgeEnabled,
    posthogState,
    timingLogs,
  };
}

function printAssessment(assessment) {
  console.log('');
  console.log(`${assessment.label}: ${assessment.status}`);
  console.log(`  - Sentry runtime DSN: ${assessment.runtimeDsn ? 'configured' : 'missing'}`);
  console.log(
    `  - Sentry source maps: ${assessment.sourceMapState}` +
      (assessment.sourceMapMissing.length ? ` (missing ${assessment.sourceMapMissing.join(', ')})` : ''),
  );
  console.log(`  - Edge Sentry: ${assessment.edgeEnabled ? 'enabled' : 'disabled'}`);
  console.log(`  - PostHog: ${assessment.posthogState}`);
  console.log(`  - Timing logs: ${assessment.timingLogs ? 'configured' : 'not configured'}`);
}

function fetchVercelProductionEnv() {
  const result = spawnSync('npx', ['-y', 'vercel@latest', 'env', 'ls', 'production'], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: timeoutMs,
  });

  if (result.status !== 0) {
    const message = summarize(`${result.stdout || ''} ${result.stderr || ''}`) || 'vercel env ls failed';
    console.log('');
    console.log(`Vercel production env: Yellow`);
    console.log(`  - Could not read Vercel env names: ${message}`);
    return new Set();
  }

  const keys = new Set();
  for (const line of String(result.stdout || '').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]{2,})\s+/);
    if (match) keys.add(match[1]);
  }
  return keys;
}

function loadLocalEnv() {
  const keys = new Set();
  for (const relativePath of ['.env', '.env.local', 'apps/web/.env', 'apps/web/.env.local']) {
    const file = path.join(repoRoot, relativePath);
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && normalizeEnvValue(match[2])) keys.add(match[1]);
    }
  }

  for (const [name, value] of Object.entries(process.env)) {
    if (value) keys.add(name);
  }

  return keys;
}

function hasAny(keys, names) {
  return names.some((name) => keys.has(name));
}

function hasAll(keys, names) {
  return names.every((name) => keys.has(name));
}

function worstStatus(statuses) {
  if (statuses.includes('Red')) return 'Red';
  if (statuses.includes('Yellow')) return 'Yellow';
  return 'Green';
}

function normalizeEnvValue(raw) {
  const withoutComment = String(raw || '').replace(/\s+#.*$/, '').trim();
  if (
    (withoutComment.startsWith('"') && withoutComment.endsWith('"')) ||
    (withoutComment.startsWith("'") && withoutComment.endsWith("'"))
  ) {
    return withoutComment.slice(1, -1);
  }
  return withoutComment;
}

function parseArgs(parts) {
  const parsed = {};
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (part === '--help' || part === '-h') parsed.help = true;
    else if (part === '--strict') parsed.strict = true;
    else if (part === '--require-green') parsed.requireGreen = true;
    else if (part === '--vercel' || part === '--vercel-production') parsed.vercelProduction = true;
    else if (part === '--timeout-ms') parsed.timeoutMs = parts[++index];
    else if (part?.startsWith('--timeout-ms=')) parsed.timeoutMs = part.slice('--timeout-ms='.length);
  }
  return parsed;
}

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function summarize(value) {
  return String(value || '')
    .split(/\r?\n/)
    .filter((line) => !line.includes('npm warn EBADENGINE'))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

function printHelp() {
  console.log(`
Usage: node scripts/check-observability-health.mjs [options]

Checks whether Web observability is actually configured. Secret values are never
printed; the script only reports whether expected env names are present.

Options:
  --vercel-production   Also inspect Vercel Production env names via Vercel CLI
  --strict              Fail unless every checked environment is Green
  --timeout-ms <n>      Vercel CLI timeout (default 60000)
  -h, --help            Show this help

Examples:
  npm run observability:health
  npm run observability:health -- --vercel-production
  npm run observability:health -- --vercel-production --strict
`);
}
