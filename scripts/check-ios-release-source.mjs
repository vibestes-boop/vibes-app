import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const invocationCwd = path.resolve(process.cwd());
const args = parseArgs(process.argv.slice(2));

const EXPECTED_ROOT = '/Users/zaurhatuev/vibes-app';
const FORBIDDEN_ROOTS = ['/Users/zaurhatuev/Desktop/vibes-app'];
const EXPECTED_REMOTE = 'vibestes-boop/vibes-app';
const EXPECTED_OWNER = 'zaurhat';
const EXPECTED_PROJECT_ID = '02ab536a-5836-4560-a5ec-2dfd6e059f90';
const EXPECTED_IOS_BUNDLE_ID = 'com.vibesapp.vibes';
const EXPECTED_IOS_SCHEME = 'vibes';
const MIN_NEXT_STORE_VERSION = '1.26.5';
const MIN_NEXT_STORE_BUILD_NUMBER = 272;

if (args.help) {
  printHelp();
  process.exit(0);
}

const profile = String(args.profile || 'development');
const failures = [];
const warnings = [];

console.log('iOS release source guard');
console.log('No secret values are printed.');
console.log(`Root: ${repoRoot}`);
console.log(`CWD: ${invocationCwd}`);
console.log(`Profile: ${profile}`);

const appJson = readJson('app.json');
const easJson = readJson('eas.json');
const packageJson = readJson('package.json');
const gitRoot = git(['rev-parse', '--show-toplevel']);
const branch = git(['branch', '--show-current']);
const head = git(['log', '-1', '--oneline']);
const statusLines = splitLines(git(['status', '--short']));
const remotes = splitLines(git(['remote', '-v']));

checkSourceRoot();
checkGitContext();
checkExpoConfig(appJson?.expo || {});
checkEasProfile(easJson?.build?.[profile]);
checkNativeDependencies(packageJson?.dependencies || {});
checkStoreVersion(appJson?.expo || {});

console.log('');
console.log('Summary:');
console.log(`  - git root: ${gitRoot || 'unknown'}`);
console.log(`  - branch: ${branch || 'unknown'}`);
console.log(`  - head: ${head || 'unknown'}`);
console.log(`  - dirty files: ${statusLines.length}`);
console.log(`  - app: ${appJson?.expo?.name || 'unknown'} ${appJson?.expo?.version || 'unknown'} (${appJson?.expo?.ios?.buildNumber || 'unknown'})`);
console.log(`  - ios bundle: ${appJson?.expo?.ios?.bundleIdentifier || 'unknown'}`);
console.log(`  - eas project: ${appJson?.expo?.extra?.eas?.projectId || 'unknown'}`);

if (warnings.length > 0) {
  console.log('');
  console.log('Warnings:');
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (failures.length > 0) {
  console.log('');
  console.error('iOS release source guard failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('');
console.log('iOS release source guard passed.');

function checkSourceRoot() {
  if (invocationCwd !== EXPECTED_ROOT) {
    failures.push(`Run this guard from ${EXPECTED_ROOT}; current working directory is ${invocationCwd}.`);
  }

  if (path.resolve(repoRoot) !== EXPECTED_ROOT) {
    failures.push(`Run iOS builds only from ${EXPECTED_ROOT}; current root is ${repoRoot}.`);
  }

  for (const forbiddenRoot of FORBIDDEN_ROOTS) {
    if (path.resolve(repoRoot) === forbiddenRoot) {
      failures.push(`This checkout is quarantined for App Store builds: ${forbiddenRoot}.`);
    }
  }

  if (gitRoot && path.resolve(gitRoot) !== path.resolve(repoRoot)) {
    failures.push(`Script root and git root differ: script=${repoRoot}, git=${gitRoot}.`);
  }
}

function checkGitContext() {
  const remoteText = remotes.join('\n');
  if (!remoteText.includes(EXPECTED_REMOTE)) {
    failures.push(`Expected Git remote containing ${EXPECTED_REMOTE}.`);
  }

  if (/MyxcuH2025\/vibes-app|vibes-social\/vibes-app/.test(remoteText)) {
    failures.push('This checkout points at the old/stale native remotes; do not build iOS releases here.');
  }

  if (profile === 'production' && branch !== 'main') {
    failures.push(`Production iOS builds must run from main; current branch is ${branch || 'unknown'}.`);
  }

  if (statusLines.length > 0 && !args.allowDirty) {
    failures.push('Working tree is dirty. Commit or intentionally pass --allow-dirty for non-production local checks.');
  }

  if (profile === 'production' && args.allowDirty) {
    failures.push('Production iOS builds may not use --allow-dirty.');
  }
}

function checkExpoConfig(expo) {
  expectEqual('expo.owner', expo.owner, EXPECTED_OWNER);
  expectEqual('expo.slug', expo.slug, 'vibes');
  expectEqual('expo.scheme', expo.scheme, EXPECTED_IOS_SCHEME);
  expectEqual('expo.extra.eas.projectId', expo.extra?.eas?.projectId, EXPECTED_PROJECT_ID);
  expectEqual('expo.ios.bundleIdentifier', expo.ios?.bundleIdentifier, EXPECTED_IOS_BUNDLE_ID);

  if (expo.runtimeVersion?.policy !== 'appVersion') {
    failures.push('Expected runtimeVersion.policy to be appVersion for native release safety.');
  }

  if (!Array.isArray(expo.plugins) || !expo.plugins.includes('expo-apple-authentication')) {
    warnings.push('expo-apple-authentication plugin is not explicitly listed.');
  }
}

function checkEasProfile(profileConfig) {
  if (!profileConfig) {
    failures.push(`Missing eas.json build profile "${profile}".`);
    return;
  }

  if (profile === 'development') {
    if (profileConfig.developmentClient !== true) {
      failures.push('development profile must set developmentClient=true.');
    }
    if (profileConfig.distribution !== 'internal') {
      failures.push('development profile must use internal distribution.');
    }
  }

  if (profile === 'production') {
    if (profileConfig.developmentClient === true || profileConfig.distribution === 'internal') {
      failures.push('production profile must not be a development/internal build.');
    }
    if (profileConfig.channel !== 'production') {
      failures.push('production profile must set channel="production" so JS-only fixes can ship via EAS Update.');
    }
    if (profileConfig.autoIncrement !== true) {
      warnings.push('production profile does not autoIncrement; verify App Store build numbers manually.');
    }
  }
}

function checkNativeDependencies(dependencies) {
  const required = [
    '@react-native-async-storage/async-storage',
    'expo-screen-orientation',
    'expo-dev-client',
    'expo-apple-authentication',
  ];

  for (const name of required) {
    if (!dependencies[name]) failures.push(`Missing native dependency: ${name}.`);
  }
}

function checkStoreVersion(expo) {
  if (profile !== 'production') return;

  const version = String(expo.version || '');
  const buildNumber = Number(expo.ios?.buildNumber || 0);
  const expectedVersion = args.expectedVersion ? String(args.expectedVersion) : null;
  const expectedBuildNumber = args.expectedBuildNumber ? Number(args.expectedBuildNumber) : null;

  if (expectedVersion && version !== expectedVersion) {
    failures.push(`Expected app version ${expectedVersion}; app.json has ${version}.`);
  }

  if (expectedBuildNumber && buildNumber !== expectedBuildNumber) {
    failures.push(`Expected iOS build number ${expectedBuildNumber}; app.json has ${buildNumber}.`);
  }

  if (compareVersions(version, MIN_NEXT_STORE_VERSION) < 0) {
    failures.push(
      `Production build is blocked until app.json version is at least ${MIN_NEXT_STORE_VERSION}; current is ${version}.`,
    );
  }

  if (buildNumber < MIN_NEXT_STORE_BUILD_NUMBER) {
    failures.push(
      `Production build is blocked until iOS buildNumber is at least ${MIN_NEXT_STORE_BUILD_NUMBER}; current is ${buildNumber}.`,
    );
  }
}

function expectEqual(label, actual, expected) {
  if (actual !== expected) failures.push(`${label} expected ${expected}, got ${actual || 'missing'}.`);
}

function readJson(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    failures.push(`Could not read ${relativePath}: ${error.message}`);
    return null;
  }
}

function git(gitArgs) {
  const result = spawnSync('git', gitArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 5000,
  });
  if (result.status !== 0) return '';
  return result.stdout.trim();
}

function splitLines(value) {
  return value ? value.split(/\r?\n/).filter(Boolean) : [];
}

function compareVersions(a, b) {
  const left = String(a).split('.').map((part) => Number(part) || 0);
  const right = String(b).split('.').map((part) => Number(part) || 0);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const delta = (left[index] || 0) - (right[index] || 0);
    if (delta !== 0) return delta > 0 ? 1 : -1;
  }
  return 0;
}

function parseArgs(parts) {
  const parsed = {};
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (part === '--help' || part === '-h') parsed.help = true;
    else if (part === '--allow-dirty') parsed.allowDirty = true;
    else if (part === '--profile') parsed.profile = parts[++index];
    else if (part?.startsWith('--profile=')) parsed.profile = part.slice('--profile='.length);
    else if (part === '--expected-version') parsed.expectedVersion = parts[++index];
    else if (part?.startsWith('--expected-version=')) parsed.expectedVersion = part.slice('--expected-version='.length);
    else if (part === '--expected-build-number') parsed.expectedBuildNumber = parts[++index];
    else if (part?.startsWith('--expected-build-number=')) parsed.expectedBuildNumber = part.slice('--expected-build-number='.length);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/check-ios-release-source.mjs [options]

Checks that an iOS EAS build is about to run from the correct source checkout
and with the expected Expo/App Store identity.

Options:
  --profile <name>                 EAS build profile to check (default: development)
  --expected-version <version>      Required app.json expo.version for production
  --expected-build-number <number>  Required app.json ios.buildNumber for production
  --allow-dirty                    Allow dirty tree for non-production local checks
  -h, --help                       Show this help

Examples:
  npm run native:release-guard
  npm run native:release-guard -- --profile production --expected-version 1.26.5 --expected-build-number 272
`);
}
