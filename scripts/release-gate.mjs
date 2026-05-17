import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = path.join(repoRoot, 'apps/web');
const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const phase = String(args.phase || 'all');
if (!['pre', 'post', 'all'].includes(phase)) {
  console.error(`Unknown phase "${phase}". Use pre, post, or all.`);
  process.exit(1);
}

const failures = [];
const startedAt = Date.now();

console.log(`Release gate (${phase})`);
console.log('No secret values are printed.');
console.log(`Root: ${repoRoot}`);

if (phase === 'pre' || phase === 'all') {
  await runPreDeployGate();
}

if (phase === 'post' || phase === 'all') {
  await runPostDeployGate();
}

if (failures.length > 0) {
  console.log('');
  console.error('Release gate failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

const seconds = Math.round((Date.now() - startedAt) / 1000);
console.log('');
console.log(`Release gate passed in ${seconds}s.`);

async function runPreDeployGate() {
  console.log('');
  console.log('Pre-deploy gate');

  runStep('Workspace ownership/parity', 'npm', ['run', 'workspace:doctor'], repoRoot);
  runStep('Web post mutation audit', 'npm', ['run', 'audit:web-post-mutations'], repoRoot);
  runStep('Web typecheck', 'npm', ['--prefix', 'apps/web', 'run', 'typecheck'], repoRoot);
  runStep('Web lint', 'npm', ['--prefix', 'apps/web', 'run', 'lint'], repoRoot);

  if (!args.skipDbDryRun) {
    runSupabaseDryRun();
  }

  if (args.full) {
    runStep('Web build', 'npm', ['--prefix', 'apps/web', 'run', 'build'], repoRoot);
  }
}

async function runPostDeployGate() {
  console.log('');
  console.log('Post-deploy production gate');

  runStep('Production route/log monitor', 'npm', [
    'run',
    'monitor:prod',
    '--',
    ...(args.withLogs ? [] : ['--skip-logs']),
  ], repoRoot);
  runStep('Production API contracts', 'npm', [
    'run',
    'stability:api-contracts',
    '--',
    '--skip-supabase',
    '--require-cdn-cache',
    '--require-public-endpoint-cdn-cache',
  ], repoRoot);
  runStep('Production media budget', 'npm', ['run', 'stability:media-budget'], repoRoot);
  runStep('Production backend integrity', 'npm', ['run', 'monitor:integrity'], repoRoot);
  runStep('Authenticated production smoke', 'npm', [
    'run',
    'stability:auth',
    '--',
    '--skip-if-missing',
  ], repoRoot);
}

function runSupabaseDryRun() {
  const cli = spawnSync('supabase', ['--version'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (cli.status !== 0) {
    failures.push('[SQL migrations] Supabase CLI is not available; cannot verify migration drift.');
    return;
  }

  const result = spawnSync('supabase', ['db', 'push', '--dry-run'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
    timeout: 120000,
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;

  process.stdout.write(output);

  if (result.status !== 0) {
    failures.push(`[SQL migrations] supabase db push --dry-run failed with exit code ${result.status}.`);
    return;
  }

  if (/Would push these migrations:/i.test(output)) {
    failures.push('[SQL migrations] Pending migrations detected. Run supabase db push before deploying the app.');
  }
}

function runStep(name, cmd, stepArgs, cwd) {
  console.log('');
  console.log(`▶ ${name}`);
  const result = spawnSync(cmd, stepArgs, {
    cwd,
    stdio: 'inherit',
    env: process.env,
    timeout: args.stepTimeoutMs ? Number(args.stepTimeoutMs) : undefined,
  });

  if (result.error) {
    failures.push(`[${name}] ${result.error.message}`);
    return;
  }

  if (result.status !== 0) {
    failures.push(`[${name}] exited with ${result.status}.`);
  }
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

function printHelp() {
  console.log(`
Usage: npm run release:gate -- [options]

Options:
  --phase pre|post|all     Run pre-deploy, post-deploy, or both (default all)
  --full                   Include production web build in the pre-deploy gate
  --with-logs              Include Vercel production log inspection in monitor:prod
  --skip-db-dry-run        Skip supabase db push --dry-run migration drift check
  --step-timeout-ms <n>    Per-step timeout in milliseconds

Recommended:
  npm run release:gate -- --phase pre
  # deploy SQL/functions/app
  npm run release:gate -- --phase post
`);
}
