import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const profile = String(args.profile || 'development');

if (args.help) {
  printHelp();
  process.exit(0);
}

console.log('Guarded iOS EAS build');
console.log('No secret values are printed.');
console.log(`Root: ${repoRoot}`);
console.log(`Profile: ${profile}`);

const guardArgs = ['scripts/check-ios-release-source.mjs', '--profile', profile];

if (args.allowDirty) guardArgs.push('--allow-dirty');

if (profile === 'production') {
  if (!args.expectedVersion || !args.expectedBuildNumber) {
    console.error('');
    console.error('Production iOS builds must pin the intended App Store version and build number.');
    console.error('Example:');
    console.error('  npm run native:build:production');
    process.exit(1);
  }

  guardArgs.push('--expected-version', String(args.expectedVersion));
  guardArgs.push('--expected-build-number', String(args.expectedBuildNumber));
}

run('node', guardArgs);

if (args.checkOnly) {
  console.log('');
  console.log('Guard check passed. Build was not started because --check-only was provided.');
  process.exit(0);
}

const easArgs = ['eas', 'build', '--platform', 'ios', '--profile', profile, ...args.easArgs];
console.log('');
console.log(`Starting: npx ${easArgs.join(' ')}`);
run('npx', easArgs);

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) process.exit(result.status || 1);
}

function parseArgs(parts) {
  const parsed = {
    easArgs: [],
  };

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];

    if (part === '--') {
      parsed.easArgs.push(...parts.slice(index + 1));
      break;
    } else if (part === '--help' || part === '-h') {
      parsed.help = true;
    } else if (part === '--check-only') {
      parsed.checkOnly = true;
    } else if (part === '--allow-dirty') {
      parsed.allowDirty = true;
    } else if (part === '--profile') {
      parsed.profile = parts[++index];
    } else if (part?.startsWith('--profile=')) {
      parsed.profile = part.slice('--profile='.length);
    } else if (part === '--expected-version') {
      parsed.expectedVersion = parts[++index];
    } else if (part?.startsWith('--expected-version=')) {
      parsed.expectedVersion = part.slice('--expected-version='.length);
    } else if (part === '--expected-build-number') {
      parsed.expectedBuildNumber = parts[++index];
    } else if (part?.startsWith('--expected-build-number=')) {
      parsed.expectedBuildNumber = part.slice('--expected-build-number='.length);
    } else {
      parsed.easArgs.push(part);
    }
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/run-eas-ios-build.mjs [options] [-- eas-build-options]

Runs the iOS release source guard before starting an EAS iOS build.

Options:
  --profile <name>                 EAS build profile (default: development)
  --expected-version <version>      Required app.json expo.version for production
  --expected-build-number <number>  Required app.json ios.buildNumber for production
  --allow-dirty                    Allow dirty tree for non-production local checks
  --check-only                     Run the guard without starting EAS
  -h, --help                       Show this help

Examples:
  npm run native:build:development
  npm run native:build:development:check
  npm run native:build:production:check
  npm run native:build:production
`);
}
