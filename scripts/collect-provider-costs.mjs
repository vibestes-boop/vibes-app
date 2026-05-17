import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readProviderBillingDir } from './lib/provider-costs.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const failures = [];
const warnings = [];

if (args.help || !args.dir) {
  printHelp();
  process.exit(args.help ? 0 : 1);
}

const costs = readProviderBillingDir({
  repoRoot,
  billingDir: args.dir,
  failures,
  warnings,
});

if (warnings.length > 0 && !args.quiet) {
  for (const warning of warnings) console.error(`Warning: ${warning}`);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

const json = JSON.stringify(costs);
if (args.githubEnv) {
  console.log(`PROVIDER_COSTS_JSON=${json}`);
} else {
  console.log(JSON.stringify(costs, null, 2));
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--github-env') {
      parsed.githubEnv = true;
    } else if (arg === '--quiet') {
      parsed.quiet = true;
    } else if (arg === '--dir' && argv[index + 1]) {
      parsed.dir = argv[index + 1];
      index += 1;
    } else if (arg.startsWith('--dir=')) {
      parsed.dir = arg.slice('--dir='.length);
    }
  }
  return parsed;
}

function printHelp() {
  console.log(`
Usage: node scripts/collect-provider-costs.mjs --dir <billing-export-dir> [--github-env]

Reads JSON/CSV billing exports and emits normalized provider costs for
PROVIDER_COSTS_JSON. Provider is inferred from the filename or row provider
field: Cloudflare/R2, Supabase, Vercel, LiveKit, OpenAI/AI, or other.
`);
}
