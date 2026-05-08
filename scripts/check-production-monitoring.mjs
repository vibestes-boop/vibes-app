import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SITE_URL = 'https://serlo-web.vercel.app';
const DEFAULT_SINCE = '45m';
const DEFAULT_LOG_LIMIT = 100;
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_ROUTE_WARN_MS = 1500;
const KNOWN_SCANNER_PATHS = [
  /^\/\.env(?:$|[/?#])/,
  /^\/wp-/i,
  /^\/wordpress(?:\/|$)/i,
  /^\/phpmyadmin(?:\/|$)/i,
];

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = path.join(repoRoot, 'apps/web');
const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const siteUrl = normalizeBase(args.siteUrl || process.env.STABILITY_SITE_URL || DEFAULT_SITE_URL);
const since = args.since || DEFAULT_SINCE;
const logLimit = readPositiveInt(args.limit, DEFAULT_LOG_LIMIT);
const timeoutMs = readPositiveInt(args.timeoutMs, DEFAULT_TIMEOUT_MS);
const routeWarnMs = readPositiveInt(args.routeWarnMs, DEFAULT_ROUTE_WARN_MS);
const failures = [];
const warnings = [];

console.log(`Production monitoring check: ${siteUrl}`);
console.log(`Window: last ${since}, logs limit ${logLimit}, route warn ${routeWarnMs}ms.`);

const routeResults = await runRouteSmoke();
const logResult = args.skipLogs ? null : runVercelLogProbe();

printRouteResults(routeResults);
printLogResults(logResult);

if (warnings.length > 0) {
  console.log('');
  console.log('Warnings:');
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (failures.length > 0) {
  console.log('');
  console.error('Production monitoring check failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('');
console.log('Production monitoring check passed.');

async function runRouteSmoke() {
  const specs = [
    { label: 'home', path: '/', statuses: [200] },
    { label: 'explore', path: '/explore', statuses: [200] },
    { label: 'create', path: '/create', statuses: [200, 302, 307, 308], redirectPath: '/login' },
    { label: 'login', path: '/login', statuses: [200] },
    { label: 'legacy-profile-zaur', path: '/@zaur', statuses: [307, 308], redirectPath: '/u/zaur' },
    { label: 'legacy-profile-mansurh', path: '/@mansurh', statuses: [307, 308], redirectPath: '/u/mansurh' },
    { label: 'profile-zaur', path: '/u/zaur', statuses: [200] },
    { label: 'profile-mansurh', path: '/u/mansurh', statuses: [200] },
    { label: 'manifest', path: '/manifest.webmanifest', statuses: [200], contentType: 'manifest' },
  ];

  const results = [];

  for (const spec of specs) {
    const url = `${siteUrl}${spec.path}`;
    const startedAt = performance.now();

    try {
      const response = await fetchWithTimeout(
        url,
        {
          redirect: 'manual',
          headers: {
            accept: spec.contentType ? 'application/manifest+json,text/plain,*/*' : 'text/html,*/*',
            'user-agent': 'SerloProductionMonitor/1.0',
          },
        },
        timeoutMs,
      );
      const durationMs = Math.round(performance.now() - startedAt);
      const location = response.headers.get('location') || '';
      const contentType = response.headers.get('content-type') || '';
      const cacheControl = response.headers.get('cache-control') || '';
      const ok = validateRouteResponse(spec, response.status, location, contentType);

      results.push({
        ...spec,
        status: response.status,
        durationMs,
        location,
        contentType,
        cacheControl,
        ok,
      });

      if (!ok) {
        failures.push(
          `[route:${spec.label}] ${spec.path} returned ${response.status}` +
            `${location ? ` -> ${location}` : ''}.`,
        );
      } else if (durationMs > routeWarnMs) {
        warnings.push(`[route:${spec.label}] ${spec.path} took ${durationMs}ms (warn>${routeWarnMs}ms).`);
      }
    } catch (error) {
      const durationMs = Math.round(performance.now() - startedAt);
      results.push({
        ...spec,
        status: 'FETCH_ERROR',
        durationMs,
        location: '',
        contentType: '',
        cacheControl: '',
        ok: false,
        error: formatError(error),
      });
      failures.push(`[route:${spec.label}] ${spec.path} failed: ${formatError(error)}.`);
    }
  }

  return results;
}

function validateRouteResponse(spec, status, location, contentType) {
  if (!spec.statuses.includes(status)) return false;

  if (spec.redirectPath) {
    if (status === 200) return true;
    const redirectUrl = resolveMaybeRelativeUrl(location);
    return redirectUrl?.pathname === spec.redirectPath;
  }

  if (spec.contentType === 'manifest') {
    return /manifest|json/i.test(contentType);
  }

  return true;
}

function runVercelLogProbe() {
  const cliArgs = [
    'vercel',
    'logs',
    siteUrl,
    '--environment',
    'production',
    '--since',
    since,
    '--no-follow',
    '--no-branch',
    '--limit',
    String(logLimit),
    '--json',
  ];

  const result = spawnSync('npx', cliArgs, {
    cwd: webRoot,
    encoding: 'utf8',
    env: process.env,
    timeout: Math.max(timeoutMs * 2, 20000),
  });

  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const records = parseJsonLines(stdout);

  if (result.status !== 0) {
    warnings.push(
      `Vercel logs could not be fetched (${result.status ?? 'unknown'}): ${firstLine(stderr || stdout) || 'no output'}`,
    );
    return {
      ok: false,
      records,
      error: firstLine(stderr || stdout),
      exitCode: result.status,
      hotspots: [],
      statusCounts: new Map(),
      errorRecords: [],
      clientErrorRecords: [],
      knownScannerRecords: [],
      actionableClientErrorRecords: [],
    };
  }

  const statusCounts = new Map();
  const timingRows = [];
  const errorRecords = [];
  const clientErrorRecords = [];

  for (const record of records) {
    const status = Number(record.responseStatusCode);
    if (Number.isFinite(status)) {
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
      if (status >= 500) {
        errorRecords.push(record);
      } else if (status >= 400) {
        clientErrorRecords.push(record);
      }
    }

    if (isErrorLevel(record.level)) {
      errorRecords.push(record);
    }

    for (const log of collectRecordMessages(record)) {
      if (isErrorLog(log)) {
        errorRecords.push({ ...record, message: log.message, level: log.level });
      }
      const timing = parseTimingLog(log.message);
      if (timing) timingRows.push(timing);
    }
  }

  const hotspots = summarizeTiming(timingRows);
  const knownScannerRecords = clientErrorRecords.filter(isKnownScannerRecord);
  const actionableClientErrorRecords = clientErrorRecords.filter((record) => !isKnownScannerRecord(record));
  const fiveXxCount = Array.from(statusCounts.entries())
    .filter(([status]) => status >= 500)
    .reduce((sum, [, count]) => sum + count, 0);

  if (fiveXxCount > 0) failures.push(`[logs] Found ${fiveXxCount} 5xx response(s) in production logs.`);
  if (errorRecords.length > 0) failures.push(`[logs] Found ${errorRecords.length} error-level log record(s).`);
  if (actionableClientErrorRecords.length > 0) {
    warnings.push(
      `[logs] Found ${actionableClientErrorRecords.length} app-facing 4xx response(s): ${summarizeRequestPaths(
        actionableClientErrorRecords,
      )}`,
    );
  }

  return {
    ok: true,
    records,
    hotspots,
    statusCounts,
    errorRecords,
    clientErrorRecords,
    knownScannerRecords,
    actionableClientErrorRecords,
    exitCode: result.status,
  };
}

function parseJsonLines(text) {
  const records = [];

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      records.push(JSON.parse(trimmed));
    } catch {
      warnings.push(`Could not parse Vercel JSON log line: ${trimmed.slice(0, 120)}`);
    }
  }

  return records;
}

function collectRecordMessages(record) {
  const rows = [];

  if (typeof record.message === 'string') {
    rows.push({ level: record.level, message: record.message });
  }

  if (Array.isArray(record.logs)) {
    for (const log of record.logs) {
      if (typeof log?.message === 'string') {
        rows.push({ level: log.level, message: log.message });
      }
    }
  }

  return rows;
}

function parseTimingLog(message) {
  if (typeof message !== 'string') return null;

  const marker = message.includes('[supabase:timing]')
    ? '[supabase:timing]'
    : message.includes('[action:timing]')
      ? '[action:timing]'
      : null;
  if (!marker) return null;

  const jsonStart = message.indexOf('{', message.indexOf(marker));
  if (jsonStart === -1) return null;

  try {
    const payload = JSON.parse(message.slice(jsonStart));
    return {
      marker,
      endpoint: payload.endpoint || payload.action || 'unknown',
      durationMs: Number(payload.durationMs) || 0,
      status: payload.status ?? '',
      ok: payload.ok,
      slow: Boolean(payload.slow),
      path: payload.path || '',
    };
  } catch {
    return null;
  }
}

function summarizeTiming(rows) {
  const byEndpoint = new Map();

  for (const row of rows) {
    const key = `${row.marker}:${row.endpoint}`;
    const bucket = byEndpoint.get(key) ?? {
      marker: row.marker,
      endpoint: row.endpoint,
      count: 0,
      totalMs: 0,
      maxMs: 0,
      slow: 0,
      errors: 0,
      statuses: new Map(),
    };

    bucket.count += 1;
    bucket.totalMs += row.durationMs;
    bucket.maxMs = Math.max(bucket.maxMs, row.durationMs);
    if (row.slow) bucket.slow += 1;
    if (row.ok === false) bucket.errors += 1;
    if (row.status !== '') bucket.statuses.set(row.status, (bucket.statuses.get(row.status) ?? 0) + 1);
    byEndpoint.set(key, bucket);
  }

  return Array.from(byEndpoint.values())
    .map((bucket) => ({
      ...bucket,
      avgMs: Math.round(bucket.totalMs / Math.max(bucket.count, 1)),
    }))
    .sort((a, b) => b.maxMs - a.maxMs)
    .slice(0, 8);
}

function isErrorLevel(level) {
  return ['error', 'fatal'].includes(String(level || '').toLowerCase());
}

function isErrorLog(log) {
  if (isErrorLevel(log.level)) return true;
  return /\b(error|exception|unhandled|failed|timeout)\b/i.test(log.message || '');
}

function isKnownScannerRecord(record) {
  const pathName = String(record.requestPath || '/');
  return KNOWN_SCANNER_PATHS.some((pattern) => pattern.test(pathName));
}

function printRouteResults(results) {
  console.log('');
  console.log('Route smoke:');
  for (const result of results) {
    const route = `${result.path.padEnd(22)} ${String(result.status).padEnd(4)} ${String(result.durationMs).padStart(4)}ms`;
    const suffix = result.location ? ` -> ${result.location}` : '';
    console.log(`  - ${result.ok ? 'OK ' : 'BAD'} ${route}${suffix}`);
  }
}

function printLogResults(result) {
  console.log('');
  console.log('Vercel production logs:');

  if (!result) {
    console.log('  - skipped by --skip-logs');
    return;
  }

  if (!result.ok) {
    console.log('  - WARN logs unavailable');
    return;
  }

  const statusText =
    Array.from(result.statusCounts.entries())
      .sort(([a], [b]) => a - b)
      .map(([status, count]) => `${status}:${count}`)
      .join(', ') || 'none';

  console.log(`  - records: ${result.records.length}`);
  console.log(`  - status counts: ${statusText}`);
  console.log(`  - error records: ${result.errorRecords.length}`);
  console.log(`  - 4xx records: ${result.clientErrorRecords.length}`);

  if (result.clientErrorRecords.length > 0) {
    console.log(`  - 4xx top paths: ${summarizeRequestPaths(result.clientErrorRecords)}`);
  }

  if (result.knownScannerRecords.length > 0) {
    console.log(`  - known scanner 4xx: ${summarizeRequestPaths(result.knownScannerRecords)}`);
  }

  if (result.actionableClientErrorRecords.length > 0) {
    console.log(`  - app-facing 4xx: ${summarizeRequestPaths(result.actionableClientErrorRecords)}`);
  }

  if (result.hotspots.length > 0) {
    console.log('  - timing hotspots:');
    for (const item of result.hotspots) {
      console.log(
        `    ${item.endpoint}: count=${item.count}, avg=${item.avgMs}ms, max=${item.maxMs}ms, slow=${item.slow}`,
      );
    }
  } else {
    console.log('  - timing hotspots: none found in this window');
  }
}

async function fetchWithTimeout(url, init, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function resolveMaybeRelativeUrl(value) {
  if (!value) return null;
  try {
    return new URL(value, siteUrl);
  } catch {
    return null;
  }
}

function normalizeBase(value) {
  return String(value).replace(/\/+$/, '');
}

function readPositiveInt(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected positive integer, got ${value}`);
  }
  return parsed;
}

function summarizeRequestPaths(records) {
  const counts = new Map();

  for (const record of records) {
    const method = String(record.requestMethod || 'GET').toUpperCase();
    const pathName = String(record.requestPath || '/');
    const key = `${method} ${pathName}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([pathName, count]) => `${pathName} x${count}`)
    .join(', ');
}

function parseArgs(rawArgs) {
  const parsed = {
    help: false,
    limit: undefined,
    skipLogs: false,
    since: undefined,
    siteUrl: undefined,
    timeoutMs: undefined,
    routeWarnMs: undefined,
  };

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (arg === '--help' || arg === '-h') parsed.help = true;
    else if (arg === '--limit') parsed.limit = rawArgs[++i];
    else if (arg === '--skip-logs') parsed.skipLogs = true;
    else if (arg === '--since') parsed.since = rawArgs[++i];
    else if (arg === '--site-url') parsed.siteUrl = rawArgs[++i];
    else if (arg === '--timeout-ms') parsed.timeoutMs = rawArgs[++i];
    else if (arg === '--route-warn-ms') parsed.routeWarnMs = rawArgs[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function firstLine(text) {
  return String(text || '').split(/\r?\n/).find(Boolean) || '';
}

function formatError(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function printHelp() {
  console.log(`Usage: node scripts/check-production-monitoring.mjs [options]

Options:
  --site-url <url>     Production site URL (default: ${DEFAULT_SITE_URL})
  --since <window>     Vercel logs window, e.g. 45m or 2h (default: ${DEFAULT_SINCE})
  --limit <n>          Max Vercel log records to inspect (default: ${DEFAULT_LOG_LIMIT})
  --skip-logs          Only run route smoke; do not call Vercel logs
  --timeout-ms <n>     Per-request timeout (default: ${DEFAULT_TIMEOUT_MS})
  --route-warn-ms <n>  Warn when a route smoke request is slower (default: ${DEFAULT_ROUTE_WARN_MS})
  -h, --help           Show this help
`);
}
