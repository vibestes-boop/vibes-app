import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const scopeArg = readArg('--scope') ?? 'all';
const failOnMissing = !args.has('--no-fail');

const envFiles = [
  '.env',
  '.env.local',
  'apps/web/.env',
  'apps/web/.env.local',
];

const exampleFiles = [
  '.env.example',
  'apps/web/.env.local.example',
];

const groups = [
  {
    id: 'web',
    title: 'Web Core',
    required: true,
    keys: [
      ['NEXT_PUBLIC_SITE_URL'],
      ['NEXT_PUBLIC_SUPABASE_URL'],
      ['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    ],
  },
  {
    id: 'native',
    title: 'Native Core',
    required: true,
    keys: [
      ['EXPO_PUBLIC_SUPABASE_URL'],
      ['EXPO_PUBLIC_SUPABASE_ANON_KEY'],
    ],
  },
  {
    id: 'upload',
    title: 'Upload / R2',
    required: false,
    keys: [
      ['NEXT_PUBLIC_R2_UPLOAD_CACHE_CONTROL'],
      ['CF_R2_ACCOUNT_ID', 'R2_ACCOUNT_ID'],
      ['CF_R2_ACCESS_KEY_ID', 'R2_ACCESS_KEY_ID'],
      ['CF_R2_SECRET_ACCESS_KEY', 'R2_SECRET_ACCESS_KEY'],
      ['CF_R2_BUCKET', 'R2_BUCKET_NAME'],
      ['CF_R2_PUBLIC_URL'],
      ['SUPABASE_SERVICE_ROLE_KEY'],
    ],
  },
  {
    id: 'ops',
    title: 'Cloudflare CORS Automation',
    required: false,
    keys: [
      ['CLOUDFLARE_ACCOUNT_ID', 'CF_ACCOUNT_ID', 'CF_R2_ACCOUNT_ID'],
      ['CLOUDFLARE_API_TOKEN', 'CF_API_TOKEN'],
    ],
  },
  {
    id: 'observability',
    title: 'Observability',
    required: false,
    keys: [
      ['NEXT_PUBLIC_SENTRY_DSN'],
      ['SENTRY_DSN'],
      ['SENTRY_ORG'],
      ['SENTRY_PROJECT'],
      ['SENTRY_AUTH_TOKEN'],
      ['NEXT_PUBLIC_POSTHOG_KEY'],
      ['NEXT_PUBLIC_POSTHOG_HOST'],
    ],
  },
  {
    id: 'features',
    title: 'Feature Integrations',
    required: false,
    keys: [
      ['NEXT_PUBLIC_LIVEKIT_URL'],
      ['LIVEKIT_API_KEY'],
      ['LIVEKIT_API_SECRET'],
      ['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'],
      ['STRIPE_SECRET_KEY'],
      ['STRIPE_WEBHOOK_SECRET'],
      ['NEXT_PUBLIC_VAPID_PUBLIC_KEY'],
      ['NEXT_PUBLIC_GIPHY_API_KEY', 'EXPO_PUBLIC_GIPHY_API_KEY'],
    ],
  },
];

const loaded = new Map();
const examples = new Map();

for (const file of envFiles) {
  loadEnvFile(file, loaded);
}

for (const file of exampleFiles) {
  loadEnvFile(file, examples);
}

for (const [name, value] of Object.entries(process.env)) {
  if (!loaded.has(name) && value) {
    loaded.set(name, { value, source: 'process.env' });
  }
}

const selectedGroups =
  scopeArg === 'all'
    ? groups
    : groups.filter((group) => group.id === scopeArg);

if (selectedGroups.length === 0) {
  console.error(`Unknown scope "${scopeArg}". Valid scopes: all, ${groups.map((g) => g.id).join(', ')}`);
  process.exit(2);
}

console.log('Env Doctor');
console.log('No secret values are printed.\n');
console.log(`Loaded env files: ${envFiles.filter((file) => fs.existsSync(path.join(repoRoot, file))).join(', ') || 'none'}`);
console.log(`Loaded examples: ${exampleFiles.filter((file) => fs.existsSync(path.join(repoRoot, file))).join(', ') || 'none'}`);

let requiredMissing = 0;
let optionalMissing = 0;

for (const group of selectedGroups) {
  console.log(`\n${group.title}`);
  for (const names of group.keys) {
    const result = findFirstSet(names);
    const label = names.join(' | ');

    if (result) {
      const placeholder = isPlaceholder(result.value) ? ' placeholder' : '';
      const marker = placeholder ? 'WARN' : 'OK';
      console.log(`  [${marker}] ${label} (${result.source}${placeholder})`);
      if (placeholder && group.required) requiredMissing += 1;
      if (placeholder && !group.required) optionalMissing += 1;
      continue;
    }

    const example = findFirstExample(names);
    const suffix = example ? ` (example: ${example.source})` : '';
    const marker = group.required ? 'MISS' : 'SKIP';
    console.log(`  [${marker}] ${label}${suffix}`);

    if (group.required) requiredMissing += 1;
    else optionalMissing += 1;
  }
}

console.log('\nSummary');
console.log(`  Required missing: ${requiredMissing}`);
console.log(`  Optional missing: ${optionalMissing}`);

if (requiredMissing > 0 && failOnMissing) {
  console.log('\nRun with --no-fail to inspect without failing.');
  process.exit(1);
}

function readArg(name) {
  const parts = process.argv.slice(2);
  for (let i = 0; i < parts.length; i += 1) {
    if (parts[i] === name) return parts[i + 1];
    if (parts[i]?.startsWith(`${name}=`)) return parts[i].slice(name.length + 1);
  }
  return undefined;
}

function loadEnvFile(relativePath, target) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) return;

  const text = fs.readFileSync(absolutePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const name = match[1];
    if (target.has(name)) continue;
    target.set(name, {
      value: normalizeValue(match[2]),
      source: relativePath,
    });
  }
}

function normalizeValue(raw) {
  const withoutComment = raw.replace(/\s+#.*$/, '').trim();
  if (
    (withoutComment.startsWith('"') && withoutComment.endsWith('"')) ||
    (withoutComment.startsWith("'") && withoutComment.endsWith("'"))
  ) {
    return withoutComment.slice(1, -1);
  }
  return withoutComment;
}

function findFirstSet(names) {
  for (const name of names) {
    const entry = loaded.get(name);
    if (entry?.value) return entry;
  }
  return null;
}

function findFirstExample(names) {
  for (const name of names) {
    const entry = examples.get(name);
    if (entry) return entry;
  }
  return null;
}

function isPlaceholder(value) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === '' ||
    normalized === 'your_key_here' ||
    normalized === 'hier_dein_neuer_cloudflare_token' ||
    normalized.includes('<project>') ||
    normalized.includes('<domain>') ||
    normalized.includes('example') ||
    normalized.includes('changeme')
  );
}
