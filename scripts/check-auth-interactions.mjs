import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_SITE_URL = 'https://serlo-web.vercel.app';
const DEFAULT_LIMIT = 24;
const DEFAULT_TIMEOUT_MS = 10000;

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = loadEnv(repoRoot);
const siteUrl = normalizeBase(args.siteUrl || readEnv('STABILITY_SITE_URL') || DEFAULT_SITE_URL);
const timeoutMs = readPositiveInt(args.timeoutMs, DEFAULT_TIMEOUT_MS);
const limit = readPositiveInt(args.limit, DEFAULT_LIMIT);
const failures = [];
const warnings = [];
const checks = [];
const cleanup = [];

const supabaseUrl = readFirstEnv(['NEXT_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL']);
const supabaseAnonKey = readFirstEnv(['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']);
const authEmail = args.email || readEnv('STABILITY_AUTH_EMAIL');
const authPassword = args.password || readEnv('STABILITY_AUTH_PASSWORD');
const requestedPostId = args.postId || readEnv('STABILITY_POST_ID');

const missing = [];
if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
if (!supabaseAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
if (!authEmail) missing.push('STABILITY_AUTH_EMAIL');
if (!authPassword) missing.push('STABILITY_AUTH_PASSWORD');

if (missing.length > 0) {
  const message = `Auth interaction check missing env: ${missing.join(', ')}.`;
  if (args.skipIfMissing) {
    console.log(`${message} Skipped because --skip-if-missing is set.`);
    process.exit(0);
  }
  console.error(message);
  console.error('Set a disposable production test user, then run: npm run stability:auth');
  process.exit(1);
}

if (hasPlaceholder(supabaseUrl) || hasPlaceholder(supabaseAnonKey)) {
  const message = 'Auth interaction check skipped: Supabase URL/key still look like placeholders.';
  if (args.skipIfMissing) {
    console.log(message);
    process.exit(0);
  }
  console.error(message);
  process.exit(1);
}

console.log(`Auth interaction check: ${siteUrl}`);
console.log('No secret values are printed.');

try {
  const authClient = createSupabaseClient(supabaseUrl, supabaseAnonKey);
  const signIn = await measure('auth.signInWithPassword', () =>
    authClient.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    }),
  );

  if (signIn.error || !signIn.data.session?.access_token || !signIn.data.user?.id) {
    fail(`auth.signInWithPassword failed: ${signIn.error?.message ?? 'missing session'}`);
    await finish();
    process.exit(1);
  }

  const viewerId = signIn.data.user.id;
  const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, signIn.data.session.access_token);

  const viewerProfile = await getViewerProfile(supabase, viewerId);
  if (!viewerProfile) {
    fail(`profiles lookup failed for signed-in user ${viewerId}.`);
    await finish();
    process.exit(1);
  }

  check('viewer profile', `${viewerProfile.username} (${shortId(viewerId)})`);

  const targetPost = await findTargetPost(supabase, viewerId);
  if (!targetPost) {
    fail('No public commentable post found for auth interaction check.');
    await finish();
    process.exit(1);
  }

  check(
    'target post',
    `${shortId(targetPost.id)} by ${targetPost.authorUsername ?? shortId(targetPost.authorId)}`,
  );

  await smokePostPage(targetPost.id);

  const comment = await createAndVerifyComment(supabase, targetPost.id, viewerId);
  if (comment?.id) {
    cleanup.push(async () => {
      await supabase.from('comment_likes').delete().eq('comment_id', comment.id).eq('user_id', viewerId);
      await supabase.from('comments').delete().eq('id', comment.id).eq('user_id', viewerId);
    });
    await createAndVerifyCommentLike(supabase, comment.id, viewerId);
  }

  await createAndVerifyPostLike(supabase, targetPost.id, viewerId);
  await createAndVerifyBookmark(supabase, targetPost.id, viewerId);

  await finish();
} catch (error) {
  fail(`Unhandled auth interaction error: ${formatError(error)}`);
  await finish();
  process.exit(1);
}

async function getViewerProfile(supabase, viewerId) {
  const result = await measure('profiles.viewer', () =>
    supabase
      .from('profiles')
      .select('id, username, display_name')
      .eq('id', viewerId)
      .maybeSingle(),
  );

  if (result.error) {
    fail(`profiles.viewer failed: ${result.error.message}`);
    return null;
  }

  return result.data;
}

async function findTargetPost(supabase, viewerId) {
  if (requestedPostId) {
    const direct = await loadPostById(supabase, requestedPostId);
    if (!direct) fail(`STABILITY_POST_ID ${requestedPostId} was not readable.`);
    return direct;
  }

  const feedUrl = withBust(`${siteUrl}/api/feed/explore?offset=0&limit=${limit}&sort=newest`);
  const feed = await measure('site.feed.candidates', () => fetchJson(feedUrl, timeoutMs));
  if (!feed.ok) {
    warnings.push(`site.feed.candidates failed: ${feed.error}`);
  } else if (Array.isArray(feed.data.posts)) {
    for (const post of feed.data.posts) {
      const authorId = post.user_id || post.author?.id || null;
      const candidate = {
        id: post.id,
        authorId,
        authorUsername: post.author?.username ?? null,
        allowComments: post.allow_comments !== false,
      };
      if (
        typeof candidate.id === 'string' &&
        typeof candidate.authorId === 'string' &&
        candidate.allowComments &&
        candidate.authorId !== viewerId
      ) {
        return candidate;
      }
    }
  }

  const fallback = await measure('posts.targetFallback', () =>
    supabase
      .from('posts')
      .select('id, author_id, allow_comments, privacy, author:profiles!posts_author_id_fkey(username)')
      .or('privacy.eq.public,privacy.is.null')
      .or('allow_comments.eq.true,allow_comments.is.null')
      .neq('author_id', viewerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  );

  if (fallback.error) {
    fail(`posts.targetFallback failed: ${fallback.error.message}`);
    return null;
  }

  if (!fallback.data) {
    const ownFallback = await measure('posts.ownTargetFallback', () =>
      supabase
        .from('posts')
        .select('id, author_id, allow_comments, privacy, author:profiles!posts_author_id_fkey(username)')
        .eq('author_id', viewerId)
        .eq('allow_comments', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    );

    if (ownFallback.error) fail(`posts.ownTargetFallback failed: ${ownFallback.error.message}`);
    if (!ownFallback.data) return null;
    return normalizeDbPost(ownFallback.data);
  }

  return normalizeDbPost(fallback.data);
}

async function loadPostById(supabase, postId) {
  const result = await measure('posts.requestedTarget', () =>
    supabase
      .from('posts')
      .select('id, author_id, allow_comments, privacy, author:profiles!posts_author_id_fkey(username)')
      .eq('id', postId)
      .maybeSingle(),
  );

  if (result.error || !result.data) return null;
  if (result.data.allow_comments === false) {
    fail(`Requested post ${postId} has allow_comments=false.`);
    return null;
  }
  return normalizeDbPost(result.data);
}

async function smokePostPage(postId) {
  const result = await measure('site.postPage', () =>
    fetchText(withBust(`${siteUrl}/p/${encodeURIComponent(postId)}`), timeoutMs),
  );

  if (!result.ok) {
    fail(`site.postPage failed for ${postId}: ${result.error}`);
    return;
  }

  if (!result.text.includes(postId)) {
    warnings.push(`site.postPage returned 200 but did not include post id ${shortId(postId)} in HTML.`);
  }
}

async function createAndVerifyComment(supabase, postId, viewerId) {
  const text = `[stability-auth ${new Date().toISOString()} ${randomUUID().slice(0, 8)}]`;
  const insert = await measure('comments.insert', () =>
    supabase
      .from('comments')
      .insert({ post_id: postId, user_id: viewerId, text })
      .select('id, post_id, user_id, text, created_at')
      .single(),
  );

  if (insert.error || !insert.data) {
    fail(`comments.insert failed: ${insert.error?.message ?? 'missing row'}`);
    return null;
  }

  const rpc = await measure('comments.rpc.verify', () =>
    supabase.rpc('get_post_comments_web', {
      p_post_id: postId,
      p_limit: 30,
      p_viewer_id: viewerId,
    }),
  );

  if (rpc.error) {
    fail(`comments.rpc.verify failed: ${rpc.error.message}`);
  } else {
    const found = (rpc.data ?? []).some((row) => row.id === insert.data.id || row.body === text);
    if (!found) fail(`comments.rpc.verify did not return the inserted comment ${insert.data.id}.`);
  }

  check('comment insert+read', shortId(insert.data.id));
  return insert.data;
}

async function createAndVerifyCommentLike(supabase, commentId, viewerId) {
  const existing = await selectExisting(
    'comment_likes.existing',
    supabase
      .from('comment_likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', viewerId)
      .maybeSingle(),
  );

  if (!existing) {
    const insert = await measure('comment_likes.insert', () =>
      supabase
        .from('comment_likes')
        .insert({ comment_id: commentId, user_id: viewerId })
        .select('id')
        .single(),
    );
    if (insert.error || !insert.data) {
      fail(`comment_likes.insert failed: ${insert.error?.message ?? 'missing row'}`);
      return;
    }
  }

  const verify = await measure('comment_likes.verify', () =>
    supabase
      .from('comment_likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', viewerId)
      .maybeSingle(),
  );

  if (verify.error || !verify.data) {
    fail(`comment_likes.verify failed: ${verify.error?.message ?? 'missing row'}`);
    return;
  }

  check('comment like insert+read', shortId(verify.data.id));
}

async function createAndVerifyPostLike(supabase, postId, viewerId) {
  const existing = await selectExisting(
    'likes.existing',
    supabase.from('likes').select('id').eq('post_id', postId).eq('user_id', viewerId).maybeSingle(),
  );
  let cleanupInserted = false;

  if (!existing) {
    const insert = await measure('likes.insert', () =>
      supabase.from('likes').insert({ post_id: postId, user_id: viewerId }).select('id').single(),
    );
    if (insert.error || !insert.data) {
      fail(`likes.insert failed: ${insert.error?.message ?? 'missing row'}`);
      return;
    }
    cleanupInserted = true;
  }

  const verify = await measure('likes.verify', () =>
    supabase.from('likes').select('id').eq('post_id', postId).eq('user_id', viewerId).maybeSingle(),
  );
  if (verify.error || !verify.data) {
    fail(`likes.verify failed: ${verify.error?.message ?? 'missing row'}`);
    return;
  }

  if (cleanupInserted) {
    cleanup.push(async () => {
      await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', viewerId);
    });
  }

  check('post like insert+read', cleanupInserted ? shortId(verify.data.id) : 'already existed');
}

async function createAndVerifyBookmark(supabase, postId, viewerId) {
  const existing = await selectExisting(
    'bookmarks.existing',
    supabase.from('bookmarks').select('id').eq('post_id', postId).eq('user_id', viewerId).maybeSingle(),
  );
  let cleanupInserted = false;

  if (!existing) {
    const insert = await measure('bookmarks.insert', () =>
      supabase.from('bookmarks').insert({ post_id: postId, user_id: viewerId }).select('id').single(),
    );
    if (insert.error || !insert.data) {
      fail(`bookmarks.insert failed: ${insert.error?.message ?? 'missing row'}`);
      return;
    }
    cleanupInserted = true;
  }

  const verify = await measure('bookmarks.verify', () =>
    supabase.from('bookmarks').select('id').eq('post_id', postId).eq('user_id', viewerId).maybeSingle(),
  );
  if (verify.error || !verify.data) {
    fail(`bookmarks.verify failed: ${verify.error?.message ?? 'missing row'}`);
    return;
  }

  if (cleanupInserted) {
    cleanup.push(async () => {
      await supabase.from('bookmarks').delete().eq('post_id', postId).eq('user_id', viewerId);
    });
  }

  check('bookmark insert+read', cleanupInserted ? shortId(verify.data.id) : 'already existed');
}

async function selectExisting(label, query) {
  const result = await measure(label, () => query);
  if (result.error) {
    fail(`${label} failed: ${result.error.message}`);
    return null;
  }
  return result.data ?? null;
}

async function finish() {
  for (const task of cleanup.reverse()) {
    const result = await measure('cleanup', task);
    if (result?.error) warnings.push(`cleanup returned error: ${result.error.message}`);
  }

  console.log('');
  console.log('Checked auth interactions:');
  for (const item of checks) {
    console.log(`  - ${item.label}: ${item.detail}`);
  }

  if (warnings.length > 0) {
    console.log('');
    console.log('Warnings:');
    for (const warning of warnings) console.log(`  - ${warning}`);
  }

  if (failures.length > 0) {
    console.log('');
    console.error('Auth interaction check failed:');
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  console.log('');
  console.log('Auth interaction check passed.');
}

function createSupabaseClient(url, key, accessToken) {
  const options = {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  };

  if (accessToken) {
    options.global = {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    };
  }

  return createClient(normalizeBase(url), key, options);
}

async function measure(label, fn) {
  const start = performance.now();
  try {
    const value = await fn();
    checks.push({ label, detail: `${Math.round(performance.now() - start)}ms` });
    return value;
  } catch (error) {
    checks.push({ label, detail: `${Math.round(performance.now() - start)}ms error` });
    throw error;
  }
}

async function fetchJson(url, timeout) {
  const response = await fetchWithTimeout(url, { headers: { accept: 'application/json' } }, timeout);
  const text = await response.text();
  if (!response.ok) {
    return { ok: false, error: `${response.status} ${text.slice(0, 200)}` };
  }
  try {
    return { ok: true, data: JSON.parse(text), status: response.status };
  } catch {
    return { ok: false, error: `Invalid JSON (${text.slice(0, 120)})` };
  }
}

async function fetchText(url, timeout) {
  const response = await fetchWithTimeout(url, { headers: { accept: 'text/html' } }, timeout);
  const text = await response.text();
  if (!response.ok) return { ok: false, error: `${response.status} ${text.slice(0, 200)}` };
  return { ok: true, text, status: response.status };
}

async function fetchWithTimeout(url, init, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeDbPost(row) {
  const author = Array.isArray(row.author) ? row.author[0] : row.author;
  return {
    id: row.id,
    authorId: row.author_id,
    authorUsername: author?.username ?? null,
    allowComments: row.allow_comments !== false,
  };
}

function check(label, detail) {
  checks.push({ label, detail });
}

function fail(message) {
  failures.push(message);
}

function withBust(value) {
  const url = new URL(value);
  url.searchParams.set('stability_bust', String(Date.now()));
  return url.toString();
}

function normalizeBase(value) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function readFirstEnv(names) {
  for (const name of names) {
    const value = readEnv(name);
    if (value) return value;
  }
  return '';
}

function readEnv(name) {
  return env.get(name)?.value || process.env[name] || '';
}

function loadEnv(root) {
  const loaded = new Map();
  const files = ['.env', '.env.local', 'apps/web/.env', 'apps/web/.env.local'];

  for (const file of files) {
    const absolutePath = path.join(root, file);
    if (!fs.existsSync(absolutePath)) continue;
    const text = fs.readFileSync(absolutePath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const name = match[1];
      if (loaded.has(name)) continue;
      loaded.set(name, {
        value: normalizeEnvValue(match[2]),
        source: file,
      });
    }
  }

  return loaded;
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

function hasPlaceholder(value) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === '' ||
    normalized.includes('your_') ||
    normalized.includes('<project>') ||
    normalized.includes('<domain>') ||
    normalized.includes('example') ||
    normalized.includes('changeme')
  );
}

function readPositiveInt(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected positive integer, got ${value}`);
  }
  return parsed;
}

function shortId(value) {
  return typeof value === 'string' && value.length > 8 ? value.slice(0, 8) : String(value);
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function parseArgs(rawArgs) {
  const parsed = {
    email: undefined,
    help: false,
    limit: undefined,
    password: undefined,
    postId: undefined,
    siteUrl: undefined,
    skipIfMissing: false,
    timeoutMs: undefined,
  };

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (arg === '--email') parsed.email = rawArgs[++i];
    else if (arg === '--help' || arg === '-h') parsed.help = true;
    else if (arg === '--limit') parsed.limit = rawArgs[++i];
    else if (arg === '--password') parsed.password = rawArgs[++i];
    else if (arg === '--post-id') parsed.postId = rawArgs[++i];
    else if (arg === '--site-url') parsed.siteUrl = rawArgs[++i];
    else if (arg === '--skip-if-missing') parsed.skipIfMissing = true;
    else if (arg === '--timeout-ms') parsed.timeoutMs = rawArgs[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`
Usage:
  npm run stability:auth -- [options]

Required env:
  STABILITY_AUTH_EMAIL       Disposable production test-user email
  STABILITY_AUTH_PASSWORD    Password for that test user
  NEXT_PUBLIC_SUPABASE_URL   Web Supabase URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY

Options:
  --site-url <url>           Site base URL (default: ${DEFAULT_SITE_URL})
  --post-id <uuid>           Use a specific commentable post
  --limit <n>                Feed candidates to inspect (default: ${DEFAULT_LIMIT})
  --timeout-ms <n>           Request timeout (default: ${DEFAULT_TIMEOUT_MS})
  --skip-if-missing          Exit 0 instead of failing when auth env is absent
`);
}
