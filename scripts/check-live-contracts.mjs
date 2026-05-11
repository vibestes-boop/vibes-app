import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const env = loadEnv(repoRoot);
const failures = [];
const warnings = [];
const checked = [];

if (args.help) {
  printHelp();
  process.exit(0);
}

const supabaseUrl = readEnv(['NEXT_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL']);
const anonKey = readEnv(['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']);
const serviceRoleKey = readEnv(['SUPABASE_SERVICE_ROLE_KEY']);

for (const item of [supabaseUrl, anonKey, serviceRoleKey]) {
  if (!item.value) {
    failures.push(`[env] Missing ${item.names.join(' | ')}.`);
  }
}

console.log('Live contract check');
console.log('No secret values are printed.');
console.log(`Loaded env files: ${env.loaded.length > 0 ? env.loaded.join(', ') : '(none)'}`);

if (failures.length === 0) {
  const service = createSupabaseClient(supabaseUrl.value, serviceRoleKey.value);
  const anon = createSupabaseClient(supabaseUrl.value, anonKey.value);

  await checkTableColumns(service, {
    label: 'live_comments columns',
    table: 'live_comments',
    columns: ['id', 'session_id', 'user_id', 'text', 'pinned', 'created_at'],
    migration: '20260510123500_live_comments_pinned_column.sql',
  });

  await checkTableColumns(service, {
    label: 'live_polls columns',
    table: 'live_polls',
    columns: ['id', 'session_id', 'host_id', 'question', 'options', 'closed_at', 'created_at'],
    migration: '20260509190000_live_polls.sql',
  });

  await checkTableColumns(service, {
    label: 'live_poll_votes columns',
    table: 'live_poll_votes',
    columns: ['poll_id', 'user_id', 'option_index', 'created_at'],
    migration: '20260509190000_live_polls.sql',
  });

  await checkTableColumns(service, {
    label: 'gift_transactions columns',
    table: 'gift_transactions',
    columns: [
      'id',
      'sender_id',
      'recipient_id',
      'live_session_id',
      'gift_id',
      'coin_cost',
      'diamond_value',
      'created_at',
    ],
    migration: '20260508190000_live_gift_transactions_viewer_realtime.sql',
  });

  await checkTableColumns(service, {
    label: 'gift_catalog columns',
    table: 'gift_catalog',
    columns: ['id', 'name', 'emoji', 'coin_cost', 'diamond_value', 'sort_order'],
    migration: '20260508184500_live_gifts_and_wallets.sql',
  });

  await checkTableColumns(service, {
    label: 'coins_wallets columns',
    table: 'coins_wallets',
    columns: ['user_id', 'coins', 'diamonds', 'total_gifted', 'updated_at'],
    migration: '20260508184500_live_gifts_and_wallets.sql',
  });

  await checkTableColumns(service, {
    label: 'follows columns',
    table: 'follows',
    columns: ['follower_id', 'following_id', 'created_at'],
    migration: 'existing social graph migration',
  });

  await checkRpc(anon, {
    label: 'vote_on_poll rpc',
    name: 'vote_on_poll',
    params: {
      p_poll_id: '00000000-0000-0000-0000-000000000000',
      p_option_index: 0,
    },
    migration: '20260509193000_live_vote_on_poll_rpc.sql',
  });

  await checkRpc(anon, {
    label: 'send_gift rpc',
    name: 'send_gift',
    params: {
      p_recipient_id: '00000000-0000-0000-0000-000000000000',
      p_live_session_id: '00000000-0000-0000-0000-000000000000',
      p_gift_id: '__contract_probe__',
    },
    migration: '20260508184500_live_gifts_and_wallets.sql',
  });

  await checkRpc(anon, {
    label: 'get_active_poll rpc',
    name: 'get_active_poll',
    params: {
      p_session_id: '00000000-0000-0000-0000-000000000000',
    },
    migration: '20260509190000_live_polls.sql',
  });
}

console.log('');
console.log('Checked live contracts:');
for (const item of checked) {
  console.log(`  [OK] ${item}`);
}

if (warnings.length > 0) {
  console.log('');
  console.log('Warnings:');
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (failures.length > 0) {
  console.log('');
  console.error('Live contract check failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error('');
  console.error('Likely fix: apply the missing Supabase migrations, then reload PostgREST schema.');
  process.exit(args.noFail ? 0 : 1);
}

console.log('');
console.log('Live contract check passed.');

async function checkTableColumns(client, spec) {
  const select = spec.columns.join(',');
  const { error } = await client.from(spec.table).select(select).limit(1);
  if (error) {
    failures.push(formatFailure(spec.label, error, spec.migration));
    return;
  }
  checked.push(`${spec.label} (${spec.table}.${spec.columns.join(',')})`);
}

async function checkRpc(client, spec) {
  const { error } = await client.rpc(spec.name, spec.params);
  if (!error) {
    checked.push(spec.label);
    return;
  }

  if (isMissingRpcError(error)) {
    failures.push(formatFailure(spec.label, error, spec.migration));
    return;
  }

  checked.push(`${spec.label} (exists; probe returned ${describeExpectedError(error)})`);
}

function formatFailure(label, error, migration) {
  const code = error.code ? `${error.code}: ` : '';
  return `[${label}] ${code}${error.message} (migration: ${migration})`;
}

function describeExpectedError(error) {
  return error.code || error.message || 'expected auth/data error';
}

function isMissingRpcError(error) {
  const message = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`;
  return (
    error.code === 'PGRST202' ||
    /Could not find the function/i.test(message) ||
    /schema cache/i.test(message)
  );
}

function createSupabaseClient(url, key) {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'x-serlo-stability-check': 'live-contracts',
      },
    },
  });
}

function readEnv(names) {
  for (const name of names) {
    const value = process.env[name];
    if (value && !isPlaceholder(value)) return { names, name, value };
  }
  return { names, name: null, value: '' };
}

function isPlaceholder(value) {
  return /^(your_|replace_|todo|changeme|placeholder)/i.test(value.trim());
}

function loadEnv(root) {
  const files = [
    '.env',
    '.env.local',
    'apps/web/.env',
    'apps/web/.env.local',
  ];
  const loaded = [];

  for (const file of files) {
    const fullPath = path.join(root, file);
    if (!fs.existsSync(fullPath)) continue;
    loaded.push(file);
    const raw = fs.readFileSync(fullPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      if (process.env[parsed.key] === undefined) {
        process.env[parsed.key] = parsed.value;
      }
    }
  }

  return { loaded };
}

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const equals = trimmed.indexOf('=');
  if (equals <= 0) return null;
  const key = trimmed.slice(0, equals).trim();
  let value = trimmed.slice(equals + 1).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

function parseArgs(argv) {
  const parsed = {
    help: false,
    noFail: false,
  };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') parsed.help = true;
    if (arg === '--no-fail') parsed.noFail = true;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/check-live-contracts.mjs [--no-fail]

Checks the production Supabase live feature contract without printing secrets.
It validates required live tables/columns and RPC presence for comments, polls,
gifts, coins, and follows.`);
}
