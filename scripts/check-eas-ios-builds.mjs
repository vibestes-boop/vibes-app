import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));

const EXPECTED_PROJECT_ID = '02ab536a-5836-4560-a5ec-2dfd6e059f90';
const EXPECTED_OWNER = 'zaurhat';
const SAFE_DEVELOPMENT_BUILD_ID = '7dfddc84-2240-4a7e-b6db-efb91c56e113';
const SAFE_DEVELOPMENT_COMMIT = 'b8f89e2854bde5682145a066e45f56c4801751ef';
const SAFE_DEVELOPMENT_VERSION = '1.26.3';
const SAFE_DEVELOPMENT_BUILD_NUMBER = '268';
const KNOWN_INVALID_STORE_BUILD_IDS = new Set(['242c5893-d2b5-460e-b6b7-9edb72121132']);
const TESTFLIGHT_FALLBACK_VERSION = '1.26.3';
const TESTFLIGHT_FALLBACK_BUILD_NUMBER = '268';
const NEXT_STORE_VERSION = '1.26.6';
const NEXT_STORE_BUILD_NUMBER = '274';

if (args.help) {
  printHelp();
  process.exit(0);
}

const failures = [];
const warnings = [];
const limit = Number(args.limit || 8);

console.log('EAS iOS build audit');
console.log('No secret values are printed.');
console.log(`Root: ${repoRoot}`);
console.log(`Limit: ${limit}`);

const builds = fetchBuilds(limit);
if (builds.length === 0) {
  failures.push('No iOS builds returned by EAS.');
} else {
  auditProject(builds);
  auditDevelopmentBuild(builds);
  auditStoreBuilds(builds);
}

console.log('');
console.log('Recent iOS builds:');
for (const build of builds) {
  const marker = KNOWN_INVALID_STORE_BUILD_IDS.has(build.id) ? ' known-invalid' : '';
  console.log(
    `  - ${shortId(build.id)} ${build.distribution || 'unknown'} ${build.buildProfile || 'unknown'} ` +
      `${build.appVersion || 'unknown'} (${build.appBuildVersion || 'unknown'}) ` +
      `${shortSha(build.gitCommitHash)} ${formatDate(build.createdAt)}${marker}`,
  );
}

if (warnings.length > 0) {
  console.log('');
  console.log('Warnings:');
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (failures.length > 0) {
  console.log('');
  console.error('EAS iOS build audit failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('');
console.log('EAS iOS build audit passed.');

function fetchBuilds(fetchLimit) {
  const result = spawnSync('npx', ['eas', 'build:list', '--platform', 'ios', '--limit', String(fetchLimit), '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 120000,
  });

  if (result.status !== 0) {
    failures.push(`eas build:list failed with exit code ${result.status || 1}.`);
    if (result.stderr?.trim()) warnings.push(cleanCliNoise(result.stderr.trim()));
    return [];
  }

  try {
    return JSON.parse(result.stdout || '[]');
  } catch (error) {
    failures.push(`Could not parse eas build:list JSON: ${error.message}`);
    return [];
  }
}

function auditProject(builds) {
  for (const build of builds) {
    if (build.project?.id !== EXPECTED_PROJECT_ID) {
      failures.push(`Build ${shortId(build.id)} has unexpected EAS project id ${build.project?.id || 'missing'}.`);
    }

    if (build.project?.ownerAccount?.name !== EXPECTED_OWNER) {
      failures.push(`Build ${shortId(build.id)} has unexpected EAS owner ${build.project?.ownerAccount?.name || 'missing'}.`);
    }
  }
}

function auditDevelopmentBuild(builds) {
  const latestDevelopment = builds.find(
    (build) =>
      build.status === 'FINISHED' &&
      build.distribution === 'INTERNAL' &&
      build.buildProfile === 'development' &&
      build.isForIosSimulator !== true,
  );

  if (!latestDevelopment) {
    failures.push('No finished non-simulator iOS development build found in recent EAS history.');
    return;
  }

  if (latestDevelopment.id !== SAFE_DEVELOPMENT_BUILD_ID) {
    failures.push(
      `Latest development build is ${shortId(latestDevelopment.id)}, expected ${shortId(SAFE_DEVELOPMENT_BUILD_ID)}.`,
    );
  }

  if (latestDevelopment.gitCommitHash !== SAFE_DEVELOPMENT_COMMIT) {
    failures.push(
      `Latest development build commit is ${shortSha(latestDevelopment.gitCommitHash)}, expected ${shortSha(SAFE_DEVELOPMENT_COMMIT)}.`,
    );
  }

  if (
    latestDevelopment.appVersion !== SAFE_DEVELOPMENT_VERSION ||
    latestDevelopment.appBuildVersion !== SAFE_DEVELOPMENT_BUILD_NUMBER
  ) {
    failures.push(
      `Latest development build is ${latestDevelopment.appVersion} (${latestDevelopment.appBuildVersion}), ` +
        `expected ${SAFE_DEVELOPMENT_VERSION} (${SAFE_DEVELOPMENT_BUILD_NUMBER}).`,
    );
  }

  console.log('');
  console.log('Development build:');
  console.log(`  - safe install build: ${latestDevelopment.id}`);
  console.log(`  - commit: ${shortSha(latestDevelopment.gitCommitHash)} ${latestDevelopment.gitCommitMessage || ''}`);
  console.log(`  - app: ${latestDevelopment.appVersion} (${latestDevelopment.appBuildVersion})`);
}

function auditStoreBuilds(builds) {
  const storeBuilds = builds.filter((build) => build.status === 'FINISHED' && build.distribution === 'STORE');
  const latestStore = storeBuilds[0];

  console.log('');
  console.log('Store/TestFlight builds:');

  if (!latestStore) {
    warnings.push('No finished iOS Store build found in recent EAS history.');
    return;
  }

  console.log(`  - latest store build: ${latestStore.appVersion} (${latestStore.appBuildVersion}) ${shortId(latestStore.id)}`);
  console.log(`  - current fallback: ${TESTFLIGHT_FALLBACK_VERSION} (${TESTFLIGHT_FALLBACK_BUILD_NUMBER})`);
  console.log(`  - current App Store Connect candidate: ${NEXT_STORE_VERSION} (${NEXT_STORE_BUILD_NUMBER})`);

  for (const build of storeBuilds) {
    if (KNOWN_INVALID_STORE_BUILD_IDS.has(build.id)) {
      warnings.push(
        `Known invalidated Store build is still visible in EAS history: ` +
          `${build.appVersion} (${build.appBuildVersion}) ${shortId(build.id)}. Do not assign or install it.`,
      );
    }
  }

  const fallback = storeBuilds.find(
    (build) =>
      build.appVersion === TESTFLIGHT_FALLBACK_VERSION &&
      build.appBuildVersion === TESTFLIGHT_FALLBACK_BUILD_NUMBER,
  );

  if (!fallback) {
    warnings.push(
      `Fallback build ${TESTFLIGHT_FALLBACK_VERSION} (${TESTFLIGHT_FALLBACK_BUILD_NUMBER}) was not found in recent EAS history.`,
    );
  }
}

function parseArgs(parts) {
  const parsed = {};
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (part === '--help' || part === '-h') parsed.help = true;
    else if (part === '--limit') parsed.limit = parts[++index];
    else if (part?.startsWith('--limit=')) parsed.limit = part.slice('--limit='.length);
  }
  return parsed;
}

function cleanCliNoise(value) {
  return value
    .split(/\r?\n/)
    .filter((line) => !line.includes('eas-cli@') && !line.includes('Proceeding with outdated version'))
    .join(' ')
    .trim();
}

function shortId(value) {
  return String(value || 'unknown').slice(0, 8);
}

function shortSha(value) {
  return String(value || 'unknown').slice(0, 7);
}

function formatDate(value) {
  if (!value) return 'unknown-date';
  return new Date(value).toISOString().replace('T', ' ').slice(0, 16);
}

function printHelp() {
  console.log(`Usage: node scripts/check-eas-ios-builds.mjs [options]

Audits recent iOS EAS builds so TestFlight/App Store work does not drift back
to stale or invalidated artifacts.

Options:
  --limit <count>  Number of recent iOS builds to fetch (default: 8)
  -h, --help       Show this help

Example:
  npm run native:builds:audit
`);
}
