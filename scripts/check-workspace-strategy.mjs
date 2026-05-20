import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const webRoot = path.resolve(args.webRoot || process.env.SERLO_WEB_REPO || repoRoot);
const nativeRoot = path.resolve(
  args.nativeRoot || process.env.SERLO_NATIVE_REPO || repoRoot,
);
const legacyNativeRoot = path.resolve(
  args.legacyNativeRoot || process.env.SERLO_LEGACY_NATIVE_REPO || '/Users/zaurhatuev/Desktop/vibes-app',
);
const failOnWarnings = args.failOnWarnings === true;

const failures = [];
const warnings = [];

console.log('Workspace strategy check');
console.log('No secret values are printed.');
console.log(`Web/Ops root: ${webRoot}`);
console.log(`Native root:  ${nativeRoot}`);

const web = inspectRepo('web', webRoot);
const native = inspectRepo('native', nativeRoot);
const legacyNative = legacyNativeRoot !== nativeRoot ? inspectRepo('legacy-native', legacyNativeRoot) : null;

printRepo('Web/Ops repo', web);
printRepo('Native repo', native);
if (legacyNative?.exists) printRepo('Legacy Native checkout (quarantined)', legacyNative);

validateRoles(web, native, legacyNative);
compareEnv(webRoot, nativeRoot);
printDecision();

if (warnings.length > 0) {
  console.log('');
  console.log('Warnings:');
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (failures.length > 0 || (failOnWarnings && warnings.length > 0)) {
  console.log('');
  console.error('Workspace strategy check failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  if (failOnWarnings && warnings.length > 0) {
    console.error('  - Warnings are treated as failures because --fail-on-warnings is set.');
  }
  process.exit(1);
}

console.log('');
console.log('Workspace strategy check passed.');

function inspectRepo(label, root) {
  const exists = fs.existsSync(root);
  const gitRoot = exists ? git(root, ['rev-parse', '--show-toplevel']) : null;
  const branch = exists ? git(root, ['branch', '--show-current']) : null;
  const head = exists ? git(root, ['log', '-1', '--oneline']) : null;
  const status = exists ? git(root, ['status', '--short']) : null;
  const remotes = exists ? git(root, ['remote', '-v']) : null;
  const packageJson = readJsonIfExists(path.join(root, 'package.json'));

  return {
    label,
    root,
    exists,
    gitRoot,
    branch,
    head,
    statusLines: splitLines(status),
    remotes: splitLines(remotes),
    packageName: packageJson?.name || null,
    packageScripts: packageJson?.scripts || {},
    markers: {
      appsWeb: fs.existsSync(path.join(root, 'apps/web/package.json')),
      nativeAppJson: fs.existsSync(path.join(root, 'app.json')),
      topLevelApp: fs.existsSync(path.join(root, 'app')),
      supabase: fs.existsSync(path.join(root, 'supabase')),
      opsScripts: fs.existsSync(path.join(root, 'scripts/check-production-monitoring.mjs')),
    },
  };
}

function printRepo(title, repo) {
  console.log('');
  console.log(`${title}:`);

  if (!repo.exists) {
    console.log('  - missing');
    failures.push(`[${repo.label}] root does not exist: ${repo.root}`);
    return;
  }

  console.log(`  - git root: ${repo.gitRoot || 'unknown'}`);
  console.log(`  - branch: ${repo.branch || 'unknown'}`);
  console.log(`  - head: ${repo.head || 'unknown'}`);
  console.log(`  - package: ${repo.packageName || 'unknown'}`);
  console.log(`  - dirty files: ${repo.statusLines.length}`);
  console.log(`  - remotes: ${summarizeRemotes(repo.remotes)}`);
  console.log(
    `  - markers: apps/web=${yesNo(repo.markers.appsWeb)}, native=${yesNo(repo.markers.nativeAppJson)}, supabase=${yesNo(repo.markers.supabase)}, ops=${yesNo(repo.markers.opsScripts)}`,
  );
}

function validateRoles(web, native, legacyNative) {
  console.log('');
  console.log('Role validation:');

  const consolidated = Boolean(web.gitRoot && native.gitRoot && web.gitRoot === native.gitRoot);

  requireMarker(web, 'appsWeb', 'apps/web package');
  requireMarker(web, 'supabase', 'Supabase migrations');
  requireMarker(web, 'opsScripts', 'production/stability scripts');
  requireMarker(native, 'nativeAppJson', 'Expo app.json');
  requireMarker(native, 'topLevelApp', 'Expo app routes');

  if (consolidated) {
    console.log('  - source model: consolidated Web/Ops + Native checkout');
  } else {
    console.log('  - source model: split Web/Ops and Native checkouts');
  }

  if (!consolidated && web.remotes.join('\n') === native.remotes.join('\n')) {
    warnings.push('[roles] Both roots report the same remotes; verify whether the split is still intended.');
  }

  if (!consolidated && (web.markers.nativeAppJson || web.markers.topLevelApp)) {
    warnings.push(
      '[roles] Web/Ops repo also contains top-level native files. Treat apps/web, supabase and scripts as the active web/backend surface until the repos are intentionally consolidated.',
    );
  }

  if (!consolidated && (native.markers.appsWeb || native.markers.opsScripts)) {
    warnings.push('[roles] Native repo contains web/ops markers. Keep deployments from the Web/Ops root only.');
  }

  if (legacyNative?.exists) {
    warnings.push(
      `[legacy-native] ${legacyNative.root} is quarantined for App Store builds. Do not run EAS production builds from this checkout.`,
    );
    if (legacyNative.statusLines.length > 0) {
      warnings.push(
        `[legacy-native] Quarantined checkout has ${legacyNative.statusLines.length} uncommitted file(s); preserve it, but do not deploy from it.`,
      );
    }
  }

  if (web.statusLines.length > 0) {
    warnings.push(`[web] Web/Ops repo has ${web.statusLines.length} uncommitted file(s). Commit before deploying.`);
  }

  if (!consolidated && native.statusLines.length > 0) {
    warnings.push(
      `[native] Native repo has ${native.statusLines.length} uncommitted file(s). Do not overwrite, reset or merge it without an explicit backup.`,
    );
  }

  console.log('  - web/backend source: apps/web + supabase + scripts in /Users/zaurhatuev/vibes-app');
  console.log('  - native source: Expo app in /Users/zaurhatuev/vibes-app');
  console.log('  - deploy rule: Vercel and EAS builds run only from /Users/zaurhatuev/vibes-app');
  console.log('  - quarantine rule: /Users/zaurhatuev/Desktop/vibes-app is not an App Store build source');
}

function compareEnv(webRootPath, nativeRootPath) {
  const webEnv = loadEnvFiles(webRootPath, ['.env', '.env.local', 'apps/web/.env', 'apps/web/.env.local']);
  const nativeEnv = loadEnvFiles(nativeRootPath, ['.env', '.env.local']);

  const webSupabaseUrl = firstEnv(webEnv, ['NEXT_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL']);
  const nativeSupabaseUrl = firstEnv(nativeEnv, ['EXPO_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']);
  const webAnonKey = firstEnv(webEnv, ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']);
  const nativeAnonKey = firstEnv(nativeEnv, ['EXPO_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']);
  const webR2PublicUrl = firstEnv(webEnv, ['CF_R2_PUBLIC_URL', 'EXPO_PUBLIC_R2_PUBLIC_URL']);
  const nativeR2PublicUrl = firstEnv(nativeEnv, ['EXPO_PUBLIC_R2_PUBLIC_URL', 'CF_R2_PUBLIC_URL']);
  const webGiphyKey = firstEnv(webEnv, ['NEXT_PUBLIC_GIPHY_API_KEY', 'EXPO_PUBLIC_GIPHY_API_KEY']);
  const nativeGiphyKey = firstEnv(nativeEnv, ['EXPO_PUBLIC_GIPHY_API_KEY', 'NEXT_PUBLIC_GIPHY_API_KEY']);

  console.log('');
  console.log('Backend/env parity:');
  comparePublic('Supabase URL', webSupabaseUrl, nativeSupabaseUrl, true);
  compareSecret('Supabase anon key', webAnonKey, nativeAnonKey, true);
  comparePublic('R2 public URL', webR2PublicUrl, nativeR2PublicUrl, false);
  compareSecret('Giphy key', webGiphyKey, nativeGiphyKey, false);
}

function printDecision() {
  console.log('');
  console.log('Operational decision:');
  console.log('  - Use /Users/zaurhatuev/vibes-app as the single source for Web/Ops and Native releases.');
  console.log('  - Treat /Users/zaurhatuev/Desktop/vibes-app as quarantined legacy context only.');
  console.log('  - Run npm run workspace:doctor before deploys or cross-checkout work.');
  console.log('  - Run npm run native:release-guard before any EAS iOS build.');
}

function requireMarker(repo, marker, label) {
  if (!repo.markers[marker]) failures.push(`[${repo.label}] Missing ${label} marker in ${repo.root}.`);
}

function comparePublic(label, webEntry, nativeEntry, required) {
  if (!webEntry?.value || !nativeEntry?.value) {
    const message = `${label}: ${!webEntry?.value ? 'web missing' : 'web ok'}, ${!nativeEntry?.value ? 'native missing' : 'native ok'}`;
    console.log(`  - ${required ? message : `${label}: SKIP optional (${message})`}`);
    if (required) failures.push(`[env] ${message}.`);
    return;
  }

  const ok = normalizeBaseMaybe(webEntry.value) === normalizeBaseMaybe(nativeEntry.value);
  console.log(`  - ${label}: ${ok ? 'OK' : 'DIFF'} (web=${webEntry.source}, native=${nativeEntry.source})`);
  if (!ok) failures.push(`[env] ${label} differs between Web/Ops and Native.`);
}

function compareSecret(label, webEntry, nativeEntry, required) {
  if (!webEntry?.value || !nativeEntry?.value) {
    const message = `${label}: ${!webEntry?.value ? 'web missing' : 'web ok'}, ${!nativeEntry?.value ? 'native missing' : 'native ok'}`;
    console.log(`  - ${required ? message : `${label}: SKIP optional (${message})`}`);
    if (required) failures.push(`[env] ${message}.`);
    return;
  }

  const webFingerprint = fingerprint(webEntry.value);
  const nativeFingerprint = fingerprint(nativeEntry.value);
  const ok = webEntry.value === nativeEntry.value;
  console.log(
    `  - ${label}: ${ok ? 'OK' : 'DIFF'} (web=${webEntry.source}#${webFingerprint}, native=${nativeEntry.source}#${nativeFingerprint})`,
  );
  if (!ok) failures.push(`[env] ${label} differs between Web/Ops and Native.`);
}

function loadEnvFiles(root, files) {
  const result = new Map();
  for (const relativePath of files) {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) continue;

    const text = fs.readFileSync(absolutePath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const name = match[1];
      if (result.has(name)) continue;
      result.set(name, {
        value: normalizeEnvValue(match[2]),
        source: relativePath,
      });
    }
  }
  return result;
}

function firstEnv(map, names) {
  for (const name of names) {
    const entry = map.get(name);
    if (entry?.value) return entry;
  }
  return null;
}

function normalizeEnvValue(raw) {
  const withoutComment = raw.replace(/\s+#.*$/, '').trim();
  if (
    (withoutComment.startsWith('"') && withoutComment.endsWith('"')) ||
    (withoutComment.startsWith("'") && withoutComment.endsWith("'"))
  ) {
    return withoutComment.slice(1, -1);
  }
  return withoutComment;
}

function git(cwd, gitArgs) {
  const result = spawnSync('git', gitArgs, {
    cwd,
    encoding: 'utf8',
    timeout: 5000,
  });
  if (result.status !== 0) return '';
  return result.stdout.trim();
}

function summarizeRemotes(remotes) {
  const names = new Set();
  for (const line of remotes) {
    const [name, url] = line.split(/\s+/);
    if (name && url) names.add(`${name}=${sanitizeRemote(url)}`);
  }
  return names.size ? Array.from(names).join(', ') : 'none';
}

function sanitizeRemote(url) {
  return url.replace(/https:\/\/[^/@]+@/, 'https://');
}

function readJsonIfExists(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    warnings.push(`[json] Could not parse ${file}.`);
    return null;
  }
}

function splitLines(value) {
  return value ? value.split(/\r?\n/).filter(Boolean) : [];
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 10);
}

function normalizeBaseMaybe(value) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname.replace(/\/$/, '')}`;
  } catch {
    return value.trim().replace(/\/$/, '');
  }
}

function yesNo(value) {
  return value ? 'yes' : 'no';
}

function parseArgs(parts) {
  const parsed = {};
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part === '--help' || part === '-h') parsed.help = true;
    else if (part === '--fail-on-warnings') parsed.failOnWarnings = true;
    else if (part === '--web-root') parsed.webRoot = parts[++i];
    else if (part?.startsWith('--web-root=')) parsed.webRoot = part.slice('--web-root='.length);
    else if (part === '--native-root') parsed.nativeRoot = parts[++i];
    else if (part?.startsWith('--native-root=')) parsed.nativeRoot = part.slice('--native-root='.length);
    else if (part === '--legacy-native-root') parsed.legacyNativeRoot = parts[++i];
    else if (part?.startsWith('--legacy-native-root=')) parsed.legacyNativeRoot = part.slice('--legacy-native-root='.length);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/check-workspace-strategy.mjs [options]

Checks that the Web/Ops checkout and the Native checkout are intentionally
separate, point at the expected backend, and are safe to work with.

Options:
  --web-root <path>       Web/Ops checkout. Default: current repository root.
  --native-root <path>    Native checkout. Default: current repository root.
  --legacy-native-root <path>
                           Quarantined legacy checkout to warn about.
                           Default: /Users/zaurhatuev/Desktop/vibes-app.
  --fail-on-warnings      Treat role/dirty-state warnings as failures.
  -h, --help              Show this help.
`);
}
