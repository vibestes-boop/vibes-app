const BILLING_SOURCE_ENV = [
  'PROVIDER_COSTS_JSON',
  'PROVIDER_COSTS_FILE',
  'PROVIDER_BILLING_DIR',
  'PROVIDER_BILLING_SOURCES_JSON',
  'CLOUDFLARE_BILLING_URL',
  'SUPABASE_BILLING_URL',
  'VERCEL_BILLING_URL',
  'LIVEKIT_BILLING_URL',
  'AI_BILLING_URL',
];

const PROVIDER_URLS = [
  'CLOUDFLARE_BILLING_URL',
  'SUPABASE_BILLING_URL',
  'VERCEL_BILLING_URL',
  'LIVEKIT_BILLING_URL',
  'AI_BILLING_URL',
];

const TOKEN_PAIRS = [
  ['CLOUDFLARE_BILLING_URL', ['CLOUDFLARE_BILLING_BEARER_TOKEN', 'CLOUDFLARE_BILLING_API_KEY']],
  ['SUPABASE_BILLING_URL', ['SUPABASE_BILLING_BEARER_TOKEN', 'SUPABASE_BILLING_API_KEY']],
  ['VERCEL_BILLING_URL', ['VERCEL_BILLING_BEARER_TOKEN', 'VERCEL_BILLING_API_KEY']],
  ['LIVEKIT_BILLING_URL', ['LIVEKIT_BILLING_BEARER_TOKEN', 'LIVEKIT_BILLING_API_KEY']],
  ['AI_BILLING_URL', ['AI_BILLING_BEARER_TOKEN', 'AI_BILLING_API_KEY']],
];

const args = parseArgs(process.argv.slice(2));
const failures = [];
const warnings = [];

console.log('Provider billing secrets check');
console.log('No secret values are printed.');

const configuredSources = BILLING_SOURCE_ENV.filter((name) => hasEnv(name));
const configuredProviderUrls = PROVIDER_URLS.filter((name) => hasEnv(name));

console.log('');
console.log('Configured billing inputs:');
console.log(`  - any input configured: ${configuredSources.length > 0 ? 'yes' : 'no'}`);
console.log(`  - provider URL count: ${configuredProviderUrls.length}`);
for (const name of configuredProviderUrls) {
  console.log(`  - ${name}: set`);
}

if (configuredSources.length === 0) {
  failures.push(
    '[provider-billing] No provider billing input is configured. Set PROVIDER_COSTS_JSON, PROVIDER_COSTS_FILE, PROVIDER_BILLING_DIR, PROVIDER_BILLING_SOURCES_JSON, or provider billing URL secrets.',
  );
}

for (const [urlName, tokenNames] of TOKEN_PAIRS) {
  if (!hasEnv(urlName)) continue;
  if (!tokenNames.some(hasEnv)) {
    warnings.push(`[provider-billing] ${urlName} is set without a matching bearer token or API key secret.`);
  }
}

if (hasEnv('PROVIDER_BILLING_SOURCES_JSON')) {
  try {
    const sources = JSON.parse(process.env.PROVIDER_BILLING_SOURCES_JSON);
    if (!Array.isArray(sources) || sources.length === 0) {
      failures.push('[provider-billing] PROVIDER_BILLING_SOURCES_JSON must be a non-empty array.');
    }
  } catch (error) {
    failures.push(`[provider-billing] PROVIDER_BILLING_SOURCES_JSON is invalid JSON: ${error.message}`);
  }
}

if (warnings.length > 0) {
  console.log('');
  console.log('Warnings:');
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (failures.length > 0) {
  console.log('');
  console.error('Provider billing secrets check failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  if (args.noFail) {
    process.exit(0);
  }
  process.exit(1);
}

console.log('');
console.log('Provider billing secrets check passed.');

function hasEnv(name) {
  return String(process.env[name] || '').trim().length > 0;
}

function parseArgs(argv) {
  return {
    noFail: argv.includes('--no-fail'),
  };
}
