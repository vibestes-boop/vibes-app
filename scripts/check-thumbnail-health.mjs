import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fetchRest,
  loadEnv,
  normalizeBase,
  number,
  parseArgs,
  readEnv,
  readPositiveInt,
} from './lib/supabase-health.mjs';

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_SAMPLE_LIMIT = 8;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

loadEnv(repoRoot);

const supabaseUrl = normalizeBase(args.supabaseUrl || readEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'));
const serviceKey = args.serviceRoleKey || readEnv('SUPABASE_SERVICE_ROLE_KEY');
const timeoutMs = readPositiveInt(args.timeoutMs, DEFAULT_TIMEOUT_MS);
const sampleLimit = readPositiveInt(args.sampleLimit, DEFAULT_SAMPLE_LIMIT);
const failures = [];

console.log('Media thumbnail health check');
console.log('No secret values are printed.');

if (!supabaseUrl) failures.push('[env] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL.');
if (!serviceKey) failures.push('[env] Missing SUPABASE_SERVICE_ROLE_KEY.');

let posts = [];
let stories = [];

if (failures.length === 0) {
  const [postResult, storyResult] = await Promise.all([
    fetchRest({
      supabaseUrl,
      key: serviceKey,
      path: `posts?select=id,media_type,media_url,thumbnail_url,created_at&media_url=not.is.null&limit=5000`,
      timeoutMs,
    }),
    fetchRest({
      supabaseUrl,
      key: serviceKey,
      path: `stories?select=id,media_type,media_url,thumbnail_url,archived,created_at&media_url=not.is.null&archived=eq.false&limit=5000`,
      timeoutMs,
    }),
  ]);

  if (!postResult.ok) failures.push(`[posts] query failed: ${postResult.status} ${postResult.error}`);
  else posts = Array.isArray(postResult.data) ? postResult.data : [];

  if (!storyResult.ok) failures.push(`[stories] query failed: ${storyResult.status} ${storyResult.error}`);
  else stories = Array.isArray(storyResult.data) ? storyResult.data : [];
}

if (failures.length === 0) {
  const postIssues = inspectRows(posts, 'post');
  const storyIssues = inspectRows(stories, 'story');

  printSnapshot('Posts', posts, postIssues);
  printSnapshot('Stories', stories, storyIssues);

  for (const issue of [...postIssues, ...storyIssues]) {
    failures.push(issue.message);
  }
}

if (failures.length > 0) {
  console.log('');
  console.error('Media thumbnail health check failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('');
console.log('Media thumbnail health check passed.');

function inspectRows(rows, label) {
  const missing = rows
    .filter((row) => isRelevant(row) && hasMedia(row) && !hasThumbnail(row))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return missing.slice(0, sampleLimit).map((row) => ({
    id: row.id,
    message: `[${label}] ${row.id} (${row.media_type || 'unknown'}) has media_url but no thumbnail_url.`,
  }));
}

function printSnapshot(label, rows, issues) {
  const withMedia = rows.filter((row) => isRelevant(row) && hasMedia(row));
  const imageMissing = withMedia.filter((row) => row.media_type === 'image' && !hasThumbnail(row)).length;
  const videoMissing = withMedia.filter((row) => row.media_type === 'video' && !hasThumbnail(row)).length;
  const unknownMissing = withMedia.filter((row) => row.media_type !== 'image' && row.media_type !== 'video' && !hasThumbnail(row)).length;

  console.log('');
  console.log(`${label}:`);
  console.log(`  - media rows: ${number(withMedia.length)}`);
  console.log(`  - image thumbnails missing: ${number(imageMissing)}`);
  console.log(`  - video thumbnails missing: ${number(videoMissing)}`);
  console.log(`  - unknown-type thumbnails missing: ${number(unknownMissing)}`);
  if (issues.length > 0) {
    console.log(`  - sample failures: ${issues.map((issue) => issue.id).join(', ')}`);
  }
}

function hasMedia(row) {
  return typeof row.media_url === 'string' && row.media_url.length > 0;
}

function isRelevant(row) {
  return row.archived !== true;
}

function hasThumbnail(row) {
  return typeof row.thumbnail_url === 'string' && row.thumbnail_url.length > 0;
}

function printHelp() {
  console.log(`
Usage: node scripts/check-thumbnail-health.mjs [options]

Checks that media rows used by feeds/admin dashboards expose explicit thumbnail_url values.

Options:
  --sample-limit <n>  Max failing IDs printed per table (default ${DEFAULT_SAMPLE_LIMIT})
`);
}
