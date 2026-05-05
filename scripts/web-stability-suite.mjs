import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = path.join(repoRoot, 'apps/web');
const args = new Set(process.argv.slice(2));

const steps = [
  {
    name: 'Env Doctor (web)',
    cmd: 'node',
    args: ['scripts/env-doctor.mjs', '--scope', 'web'],
    cwd: repoRoot,
  },
  {
    name: 'TypeScript',
    cmd: 'npm',
    args: ['run', 'typecheck'],
    cwd: repoRoot,
  },
  {
    name: 'Web lint',
    cmd: 'npm',
    args: ['run', 'lint'],
    cwd: webRoot,
  },
  ...(args.has('--skip-build')
    ? []
    : [
        {
          name: 'Web build',
          cmd: 'npm',
          args: ['run', 'build'],
          cwd: webRoot,
        },
      ]),
  {
    name: 'API contracts',
    cmd: 'npm',
    args: ['run', 'stability:api-contracts'],
    cwd: repoRoot,
  },
  {
    name: 'Media budget',
    cmd: 'npm',
    args: ['run', 'stability:media-budget'],
    cwd: repoRoot,
  },
];

for (const step of steps) {
  console.log(`\n▶ ${step.name}`);
  await runStep(step);
}

console.log('\nWeb stability suite passed.');

function runStep(step) {
  return new Promise((resolve, reject) => {
    const child = spawn(step.cmd, step.args, {
      cwd: step.cwd,
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      const reason = signal ? `signal ${signal}` : `exit code ${code}`;
      reject(new Error(`${step.name} failed with ${reason}`));
    });
  });
}
