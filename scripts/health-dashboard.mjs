import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_SITE_URL = 'https://serlo-web.vercel.app';
const MEDIA_SCAN_BYTES = 2 * 1024 * 1024;
const GOVERNANCE_REQUIRED_AREAS = 10;
const STATUS_ORDER = { Green: 0, Yellow: 1, Red: 2 };

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

loadEnv(repoRoot);

const supabaseUrl = normalizeBase(
  args.supabaseUrl ||
    readEnv('NEXT_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'),
);
const anonKey =
  args.anonKey ||
  readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');
const serviceKey = args.serviceRoleKey || readEnv('SUPABASE_SERVICE_ROLE_KEY');
const siteUrl = normalizeBase(args.siteUrl || process.env.STABILITY_SITE_URL || DEFAULT_SITE_URL);
const timeoutMs = readPositiveInt(args.timeoutMs, DEFAULT_TIMEOUT_MS);
const rpcRetries = readPositiveInt(args.rpcRetries, 2);
const rows = [];
const failures = [];
const observability = checkObservabilityEnv();

console.log('Production health dashboard');
console.log('No secret values are printed.');

if (!supabaseUrl) failures.push('[env] Missing NEXT_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL.');
if (!anonKey) failures.push('[env] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY.');
if (!serviceKey) failures.push('[env] Missing SUPABASE_SERVICE_ROLE_KEY for support/campaign/region guards.');

if (failures.length === 0) {
  const [
    integrity,
    product,
    activation,
    cost,
    moderation,
    support,
    campaigns,
    regions,
    thumbnails,
    productMedia,
    pushFeed,
    governance,
    feedEndpoint,
  ] = await Promise.all([
    fetchRpc('production_integrity_snapshot'),
    fetchRpc('product_health_snapshot'),
    fetchServiceRpc('creator_activation_recovery_snapshot'),
    fetchRpc('cost_health_snapshot'),
    fetchRpc('moderation_health_snapshot'),
    fetchAdminTable('admin_support_threads?select=id,status,priority,created_at,last_message_at&status=in.(open,pending)&limit=1000'),
    fetchAdminTable('admin_campaigns?select=id,title,status,budget_cents,spend_cents,updated_at&limit=1000'),
    fetchAdminTable(`admin_region_daily_metrics?select=country_code,country_name,metric_date,active_users,views,reports&metric_date=gte.${thirtyDaysAgo()}&limit=5000`),
    fetchThumbnailTables(),
    fetchProductMediaHealth(),
    fetchRpc('push_feed_health_snapshot'),
    checkGovernanceFiles(),
    fetchFeedEndpoint(),
  ]);

  addIntegrity(integrity);
  addProduct(product);
  addLaunchReadiness(product, activation, pushFeed, thumbnails, feedEndpoint);
  addObservability(observability);
  addCost(cost);
  addModeration(moderation);
  addSupport(support);
  addCampaigns(campaigns);
  addRegions(regions);
  addMediaPlayback(feedEndpoint);
  addThumbnails(thumbnails);
  addProductMedia(productMedia);
  addPushFeed(pushFeed, feedEndpoint);
  addGovernance(governance);
}

if (rows.length > 0) printRows(rows);

const redRows = rows.filter((row) => row.status === 'Red');
if (failures.length > 0 || redRows.length > 0) {
  console.log('');
  console.error('Production health dashboard failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  for (const row of redRows) console.error(`  - [${row.area}] ${row.summary}`);
  process.exit(1);
}

console.log('');
console.log('Production health dashboard passed.');

async function fetchRpc(name) {
  return fetchRpcWithKey(name, anonKey);
}

async function fetchServiceRpc(name) {
  return fetchRpcWithKey(name, serviceKey);
}

async function fetchRpcWithKey(name, key) {
  let lastResult = { ok: false, status: 0, error: 'not attempted', data: null };

  for (let attempt = 1; attempt <= rpcRetries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(`${supabaseUrl}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          apikey: key,
          authorization: `Bearer ${key}`,
          'content-type': 'application/json',
        },
        body: '{}',
      });
      const text = await response.text();
      if (!response.ok) {
        lastResult = { ok: false, status: response.status, error: summarize(text), data: null };
      } else {
        try {
          return { ok: true, status: response.status, data: JSON.parse(text), error: '' };
        } catch {
          lastResult = { ok: false, status: response.status, error: 'invalid JSON', data: null };
        }
      }
    } catch (error) {
      lastResult = { ok: false, status: 0, error: error.message || 'request failed', data: null };
    }

    if (attempt < rpcRetries && isRetryableRpcError(lastResult)) {
      await sleep(250 * attempt);
      continue;
    }
    break;
  }

  return lastResult;
}

async function fetchFeedEndpoint() {
  const url = withBudgetBust(`${siteUrl}/api/feed/explore?offset=0&limit=12&sort=forYou`);
  try {
    const response = await fetchWithTimeout(url, {
      headers: { accept: 'application/json', 'user-agent': 'SerloHealthDashboard/1.0' },
    });
    const text = await response.text();
    if (!response.ok) return { ok: false, status: response.status, posts: 0, error: summarize(text) };
    const data = JSON.parse(text);
    const posts = Array.isArray(data?.posts) ? data.posts : [];
    const playback = await inspectFeedPlayback(posts);
    return {
      ok: true,
      status: response.status,
      posts: posts.length,
      playback,
      error: '',
    };
  } catch (error) {
    return { ok: false, status: 0, posts: 0, error: error.message };
  }
}

async function inspectFeedPlayback(posts) {
  const summary = {
    videos: 0,
    slowVideos: 0,
    scanErrors: 0,
    missingThumbnails: 0,
  };

  for (const post of posts) {
    const mediaType = post.media_type ?? post.mediaType ?? null;
    if (mediaType !== 'video') continue;
    summary.videos += 1;

    const thumbnailUrl = post.thumbnail_url ?? post.thumbnailUrl ?? null;
    const mediaUrl = post.media_url ?? post.mediaUrl ?? post.video_url ?? post.videoUrl ?? null;
    if (!thumbnailUrl) summary.missingThumbnails += 1;
    if (!mediaUrl) {
      summary.scanErrors += 1;
      continue;
    }

    try {
      const response = await fetchWithTimeout(mediaUrl, {
        headers: { range: `bytes=0-${MEDIA_SCAN_BYTES - 1}`, accept: '*/*' },
      });
      if (!response.ok) {
        summary.scanErrors += 1;
        continue;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      const inspection = inspectMp4FastStart(bytes);
      if (inspection.status === 'slow-start') summary.slowVideos += 1;
      else if (inspection.status === 'unknown') summary.scanErrors += 1;
    } catch {
      summary.scanErrors += 1;
    }
  }

  return summary;
}

async function fetchAdminTable(path) {
  const response = await fetchWithTimeout(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      accept: 'application/json',
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
    },
  });
  const text = await response.text();
  if (!response.ok) return { ok: false, status: response.status, error: summarize(text), data: null };
  try {
    return { ok: true, status: response.status, data: JSON.parse(text), error: '' };
  } catch {
    return { ok: false, status: response.status, error: 'invalid JSON', data: null };
  }
}

async function fetchThumbnailTables() {
  const [posts, stories] = await Promise.all([
    fetchAdminTable('posts?select=id,media_type,media_url,thumbnail_url,created_at&media_url=not.is.null&limit=5000'),
    fetchAdminTable('stories?select=id,media_type,media_url,thumbnail_url,archived,created_at&media_url=not.is.null&archived=eq.false&limit=5000'),
  ]);
  if (!posts.ok) return { ok: false, error: `posts failed: ${posts.error}`, posts: [], stories: [] };
  if (!stories.ok) return { ok: false, error: `stories failed: ${stories.error}`, posts: [], stories: [] };
  return {
    ok: true,
    posts: Array.isArray(posts.data) ? posts.data : [],
    stories: Array.isArray(stories.data) ? stories.data : [],
  };
}

async function fetchProductMediaHealth() {
  const result = await fetchAdminTable('products?select=id,title,category,cover_url,image_urls,is_active,created_at&is_active=eq.true&limit=5000');
  if (!result.ok) return { ok: false, error: result.error };

  const products = Array.isArray(result.data) ? result.data : [];
  const mediaItems = [];
  let withoutMedia = 0;

  for (const product of products) {
    const urls = collectProductMediaUrls(product);
    if (urls.length === 0) {
      withoutMedia += 1;
      continue;
    }
    mediaItems.push(...urls.map((item) => ({ ...item, productId: product.id })));
  }

  const checks = await Promise.all(mediaItems.map(checkProductMediaUrl));
  return {
    ok: true,
    activeProducts: products.length,
    productsWithoutMedia: withoutMedia,
    mediaUrls: mediaItems.length,
    brokenUrls: checks.filter((item) => !item.ok),
  };
}

async function checkGovernanceFiles() {
  const required = [
    'docs/stability/ownership.json',
    'docs/stability/weekly-review.md',
    'docs/stability/feature-intake.md',
    'docs/stability/alerts.md',
  ];
  const missing = required.filter((relativePath) => !fs.existsSync(path.join(repoRoot, relativePath)));
  let ownerAreas = 0;
  try {
    const ownership = JSON.parse(fs.readFileSync(path.join(repoRoot, 'docs/stability/ownership.json'), 'utf8'));
    ownerAreas = Array.isArray(ownership.areas) ? ownership.areas.length : 0;
  } catch {
    missing.push('docs/stability/ownership.json:invalid');
  }
  return { ok: missing.length === 0, missing, ownerAreas };
}

function checkObservabilityEnv() {
  const runtimeDsn = Boolean(readEnv('NEXT_PUBLIC_SENTRY_DSN', 'SENTRY_DSN'));
  const sourceMapKeys = ['SENTRY_AUTH_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECT'];
  const missingSourceMapKeys = sourceMapKeys.filter((key) => !readEnv(key));
  const sourceMapState =
    missingSourceMapKeys.length === 0
      ? 'complete'
      : missingSourceMapKeys.length === sourceMapKeys.length
        ? 'missing'
        : 'partial';
  const edgeEnabled = process.env.SENTRY_ENABLE_EDGE === '1';
  const posthogState =
    readEnv('NEXT_PUBLIC_POSTHOG_KEY') && readEnv('NEXT_PUBLIC_POSTHOG_HOST')
      ? 'complete'
      : readEnv('NEXT_PUBLIC_POSTHOG_KEY', 'NEXT_PUBLIC_POSTHOG_HOST')
        ? 'partial'
        : 'missing';
  const timingLogs = Boolean(
    readEnv(
      'SUPABASE_QUERY_TIMING',
      'NEXT_PUBLIC_SUPABASE_QUERY_TIMING',
      'SERLO_TIMING_LOGS',
      'SERVER_ACTION_TIMING',
    ),
  );

  return {
    runtimeDsn,
    sourceMapState,
    missingSourceMapKeys,
    edgeEnabled,
    posthogState,
    timingLogs,
  };
}

function addIntegrity(result) {
  if (!result.ok) return addRow('Data Lifecycle', 'Red', `integrity RPC failed: ${result.error}`, 'production_integrity_snapshot');
  const data = result.data || {};
  const queue = data.r2_delete_queue || {};
  const posts = data.posts || {};
  const cron = data.cron || {};
  const jobs = Array.isArray(cron.jobs) ? cron.jobs : [];
  const missingCron = !jobs.some((job) => job.jobname === 'r2-delete-queue' && job.active);
  const red =
    Number(queue.pending || 0) > 10 ||
    Number(queue.error || 0) > 0 ||
    Number(posts.empty_content || 0) > 0 ||
    !cron.available ||
    missingCron;
  addRow(
    'Data Lifecycle',
    red ? 'Red' : 'Green',
    `queue pending/error ${number(queue.pending)}/${number(queue.error)}, empty posts ${number(posts.empty_content)}, cron ${missingCron ? 'missing' : 'ok'}`,
    'npm run integrity:weekly',
  );
}

function addProduct(result) {
  if (!result.ok) return addRow('Product Metrics', 'Red', `product RPC failed: ${result.error}`, 'npm run product:health');
  const data = result.data || {};
  const northStar = data.north_star || {};
  const audience = data.audience || {};
  const retention = data.retention || {};
  const value = Number(northStar.value || 0);
  const status = value <= 0 ? 'Yellow' : 'Green';
  addRow(
    'Product Metrics',
    status,
    `north star ${number(value)}, WAU/MAU ${number(audience.wau)}/${number(audience.mau)}, D7 ${number(retention.d7_retained)}/${number(retention.d7_cohort)}`,
    'npm run product:health',
  );
}

function addLaunchReadiness(productResult, activationResult, pushFeedResult, thumbnailsResult, feedEndpoint) {
  if (!productResult.ok) {
    return addRow('Launch Readiness', 'Red', `product RPC failed: ${productResult.error}`, 'npm run launch:scorecard');
  }
  if (!activationResult.ok) {
    return addRow('Launch Readiness', 'Red', `activation RPC failed: ${activationResult.error}`, 'npm run launch:scorecard');
  }
  if (!pushFeedResult.ok) {
    return addRow('Launch Readiness', 'Red', `push/feed RPC failed: ${pushFeedResult.error}`, 'npm run launch:scorecard');
  }
  if (!thumbnailsResult.ok) {
    return addRow('Launch Readiness', 'Red', `thumbnail tables failed: ${thumbnailsResult.error}`, 'npm run launch:scorecard');
  }

  const product = productResult.data || {};
  const activation = activationResult.data || {};
  const pushFeed = pushFeedResult.data || {};
  const northStar = product.north_star || {};
  const audience = product.audience || {};
  const summary = activation.summary || {};
  const native = pushFeed.push?.native_tokens || {};
  const rows = [...thumbnailsResult.posts, ...thumbnailsResult.stories].filter((item) => item.media_url && item.archived !== true);
  const missingThumbnails = rows.filter((item) => !item.thumbnail_url).length;
  const slowVideos = Number(feedEndpoint.playback?.slowVideos || 0);
  const newUsers = Number(summary.new_users_30d || 0);
  const withoutFirstPost = Number(summary.users_without_first_post_30d || 0);
  const firstPostUsers = Math.max(newUsers - withoutFirstPost, 0);
  const firstPostRate = newUsers > 0 ? firstPostUsers / newUsers : 0;
  const activeCreators = Number(northStar.active_creators_7d || 0);
  const northStarValue = Number(northStar.value || 0);
  const wau = Number(audience.wau || 0);
  const nativeActive = Number(native.active_30d || 0);
  const feedPosts = Number(feedEndpoint.posts || 0);

  const blockers = [];
  if (!feedEndpoint.ok || feedPosts < 12) blockers.push(`feed ${number(feedPosts)}/12`);
  if (slowVideos > 0) blockers.push(`slow videos ${number(slowVideos)}`);
  if (missingThumbnails > 0) blockers.push(`missing media ${number(missingThumbnails)}`);
  if (nativeActive < 1) blockers.push(`native push ${number(nativeActive)}/1`);

  const risks = [];
  if (northStarValue < 1) risks.push(`north star ${number(northStarValue)}/1`);
  if (activeCreators < 2) risks.push(`creators ${number(activeCreators)}/2`);
  if (firstPostRate < 0.4) risks.push(`first post ${formatPercent(firstPostRate)}/40%`);
  if (wau < 5) risks.push(`WAU ${number(wau)}/5`);

  const status = blockers.length > 0 ? 'Red' : risks.length > 0 ? 'Yellow' : 'Green';
  const decision = blockers.length > 0
    ? 'blocked'
    : risks.length > 0
      ? 'invite gate closed'
      : 'private cohort ready';
  const context = blockers.length > 0 ? blockers.join(', ') : risks.join(', ');

  addRow(
    'Launch Readiness',
    status,
    `${decision}: first-post ${number(firstPostUsers)}/${number(newUsers)} (${formatPercent(firstPostRate)}), creators ${number(activeCreators)}, WAU ${number(wau)}${context ? `; ${context}` : ''}`,
    'npm run launch:scorecard',
  );
}

function addObservability(result) {
  const red = result.edgeEnabled && !result.runtimeDsn;
  const yellow =
    !red &&
    (!result.runtimeDsn ||
      result.sourceMapState !== 'complete' ||
      result.edgeEnabled ||
      result.posthogState === 'partial');
  const warnings = [];

  if (!result.runtimeDsn) warnings.push('Sentry DSN missing');
  if (result.sourceMapState !== 'complete') warnings.push(`source maps ${result.sourceMapState}`);
  if (result.edgeEnabled) warnings.push('Edge Sentry enabled');
  if (result.posthogState === 'partial') warnings.push('PostHog partial');

  addRow(
    'Observability',
    red ? 'Red' : yellow ? 'Yellow' : 'Green',
    `local env ${warnings.length ? warnings.join(', ') : 'Sentry runtime/source maps configured'}, timing logs ${result.timingLogs ? 'on' : 'off'}`,
    'npm run observability:health',
  );
}

function addCost(result) {
  if (!result.ok) return addRow('Cost Monitoring', 'Red', `cost RPC failed: ${result.error}`, 'npm run cost:health');
  const data = result.data || {};
  const unit = data.unit_economics || {};
  const live = data.live || {};
  const media = data.media || {};
  const ratios = [
    ratio(unit.tracked_cost_cents_month, 2500),
    ratio(unit.tracked_cost_cents_per_mau, 200),
    ratio(live.minutes_month, 1000),
    ratio(live.recording_minutes_month, 300),
    ratio(media.media_uploads_month, 1000),
    ratio(media.referenced_media_objects, 10000),
  ];
  const maxRatio = Math.max(...ratios.filter(Number.isFinite), 0);
  const status = maxRatio >= 0.9 ? 'Red' : maxRatio >= 0.7 ? 'Yellow' : 'Green';
  addRow(
    'Cost Monitoring',
    status,
    `tracked ${money(unit.tracked_cost_cents_month)}, live minutes ${number(live.minutes_month)}, R2 objects ${number(media.referenced_media_objects)}`,
    'npm run cost:health',
  );
}

function addModeration(result) {
  if (!result.ok) return addRow('Moderation/Trust', 'Red', `moderation RPC failed: ${result.error}`, 'npm run moderation:health');
  const reports = result.data?.content_reports || {};
  const legacy = result.data?.legacy_unqueued || {};
  const red = Number(reports.pending_over_sla || 0) > 0 || Number(legacy.total || 0) > 0;
  const yellow = Number(reports.pending || 0) > 0;
  addRow(
    'Moderation/Trust',
    red ? 'Red' : yellow ? 'Yellow' : 'Green',
    `pending ${number(reports.pending)}, over SLA ${number(reports.pending_over_sla)}, legacy unqueued ${number(legacy.total)}`,
    'npm run moderation:health',
  );
}

function addSupport(result) {
  if (!result.ok) return addRow('Support Inbox', 'Red', `support table failed: ${result.error}`, 'npm run support:health');
  const items = Array.isArray(result.data) ? result.data : [];
  const overSla = items.filter((item) => new Date(item.created_at).getTime() < Date.now() - 24 * 60 * 60 * 1000).length;
  const high = items.filter((item) => item.priority === 'high').length;
  const status = overSla > 0 ? 'Red' : high > 0 || items.length > 10 ? 'Yellow' : 'Green';
  addRow(
    'Support Inbox',
    status,
    `open/pending ${number(items.length)}, over SLA ${number(overSla)}, high ${number(high)}`,
    'npm run support:health',
  );
}

function addCampaigns(result) {
  if (!result.ok) return addRow('Campaigns', 'Red', `campaign table failed: ${result.error}`, 'npm run campaigns:health');
  const items = Array.isArray(result.data) ? result.data : [];
  const active = items.filter((item) => item.status === 'active').length;
  const failed = items.filter((item) => item.status === 'failed').length;
  const status = failed > 0 ? 'Red' : active > 0 ? 'Yellow' : 'Green';
  addRow(
    'Campaigns',
    status,
    `total ${number(items.length)}, active ${number(active)}, failed ${number(failed)}`,
    'npm run campaigns:health',
  );
}

function addRegions(result) {
  if (!result.ok) return addRow('Regional Activity', 'Red', `region table failed: ${result.error}`, 'npm run regions:health');
  const items = Array.isArray(result.data) ? result.data : [];
  const countries = new Set(items.map((item) => item.country_code)).size;
  const reports = items.reduce((sum, item) => sum + Number(item.reports || 0), 0);
  const active = items.reduce((sum, item) => sum + Number(item.active_users || 0), 0);
  const reportRate = active > 0 ? reports / active : 0;
  const status = reportRate > 0.2 ? 'Red' : reports > 0 ? 'Yellow' : 'Green';
  addRow(
    'Regional Activity',
    status,
    `countries ${number(countries)}, active ${number(active)}, reports ${number(reports)}`,
    'npm run regions:health',
  );
}

function addThumbnails(result) {
  if (!result.ok) return addRow('Media Thumbnails', 'Red', `thumbnail tables failed: ${result.error}`, 'npm run media:thumbnail-health');
  const rows = [...result.posts, ...result.stories].filter((item) => item.media_url && item.archived !== true);
  const missing = rows.filter((item) => !item.thumbnail_url);
  const videoMissing = missing.filter((item) => item.media_type === 'video').length;
  const imageMissing = missing.filter((item) => item.media_type === 'image').length;
  const status = missing.length > 0 ? 'Red' : 'Green';
  addRow(
    'Media Thumbnails',
    status,
    `media rows ${number(rows.length)}, missing ${number(missing.length)} (video ${number(videoMissing)}, image ${number(imageMissing)})`,
    'npm run media:thumbnail-health',
  );
}

function addProductMedia(result) {
  if (!result.ok) return addRow('Shop Media', 'Red', `product media failed: ${result.error}`, 'npm run shop:media-health');
  const broken = result.brokenUrls || [];
  const withoutMedia = Number(result.productsWithoutMedia || 0);
  const status = broken.length > 0 ? 'Red' : withoutMedia > 0 ? 'Yellow' : 'Green';
  const brokenSummary = broken.length > 0
    ? `, broken sample ${broken.slice(0, 3).map((item) => item.productId).join(', ')}`
    : '';
  addRow(
    'Shop Media',
    status,
    `active ${number(result.activeProducts)}, media URLs ${number(result.mediaUrls)}, missing media ${number(withoutMedia)}, broken ${number(broken.length)}${brokenSummary}`,
    'npm run shop:media-health',
  );
}

function addMediaPlayback(feedEndpoint) {
  if (!feedEndpoint.ok) {
    return addRow('Media Playback', 'Red', `feed endpoint failed: ${feedEndpoint.error}`, 'npm run media:playback-health');
  }
  const playback = feedEndpoint.playback || {};
  const videos = Number(playback.videos || 0);
  const slowVideos = Number(playback.slowVideos || 0);
  const scanErrors = Number(playback.scanErrors || 0);
  const missingThumbnails = Number(playback.missingThumbnails || 0);
  const status =
    slowVideos > 0 || scanErrors > 0 || missingThumbnails > 0
      ? 'Red'
      : videos === 0
        ? 'Yellow'
        : 'Green';
  addRow(
    'Media Playback',
    status,
    `videos ${number(videos)}, slow ${number(slowVideos)}, scan errors ${number(scanErrors)}, missing thumbnails ${number(missingThumbnails)}`,
    'npm run media:playback-health',
  );
}

function addPushFeed(result, feedEndpoint) {
  if (!result.ok) return addRow('Push/Feed', 'Red', `push/feed RPC failed: ${result.error}`, 'npm run push-feed:health');
  const push = result.data?.push || {};
  const feed = result.data?.feed || {};
  const native = push.native_tokens || {};
  const web = push.web_subscriptions || {};
  const notifications = push.notifications || {};
  const triggers = push.triggers || {};
  const backlog = notifications.recipient_backlog || {};
  const hasBacklogDiagnostics =
    notifications.unread_60d_plus !== undefined &&
    backlog.max_unread_for_one_user !== undefined;
  const red =
    Number(feed.public_posts_total || 0) < 3 ||
    Number(feed.public_video_posts_without_thumbnail || 0) > 0 ||
    !notifications.available ||
    (web.available && Number(web.total || 0) > 0 && !triggers.messages_web_push_trigger) ||
    !feedEndpoint.ok ||
    Number(feedEndpoint.posts || 0) < 3;
  const yellow =
    !red &&
    (Number(notifications.unread_total || 0) > 500 ||
      (hasBacklogDiagnostics && Number(notifications.unread_60d_plus || 0) > 0) ||
      (hasBacklogDiagnostics && Number(backlog.max_unread_for_one_user || 0) > 100) ||
      (native.available && Number(native.total || 0) > 0 && Number(native.active_30d || 0) === 0));
  const backlogSummary = hasBacklogDiagnostics
    ? ` (${number(notifications.unread_60d_plus)} older 60d, max/user ${number(backlog.max_unread_for_one_user)})`
    : '';
  addRow(
    'Push/Feed',
    red ? 'Red' : yellow ? 'Yellow' : 'Green',
    `feed ${number(feedEndpoint.posts)} posts, unread ${number(notifications.unread_total)}${backlogSummary}, native active ${number(native.active_30d)}/${number(native.total)}`,
    'npm run push-feed:health',
  );
}

function addGovernance(result) {
  const status = result.ok && result.ownerAreas >= GOVERNANCE_REQUIRED_AREAS ? 'Green' : 'Red';
  addRow(
    'Governance',
    status,
    `owner areas ${number(result.ownerAreas)}/${GOVERNANCE_REQUIRED_AREAS}${result.missing?.length ? `, missing ${result.missing.join(', ')}` : ''}`,
    'npm run governance:health',
  );
}

function addRow(area, status, summary, command) {
  rows.push({ area, status, summary, command });
}

function printRows(items) {
  const sorted = [...items].sort((a, b) => STATUS_ORDER[b.status] - STATUS_ORDER[a.status]);
  const widths = {
    area: Math.max('Area'.length, ...sorted.map((row) => row.area.length)),
    status: Math.max('Status'.length, ...sorted.map((row) => row.status.length)),
    command: Math.max('Command'.length, ...sorted.map((row) => row.command.length)),
  };
  console.log('');
  console.log(`${pad('Area', widths.area)}  ${pad('Status', widths.status)}  ${pad('Command', widths.command)}  Summary`);
  console.log(`${'-'.repeat(widths.area)}  ${'-'.repeat(widths.status)}  ${'-'.repeat(widths.command)}  ${'-'.repeat(42)}`);
  for (const row of sorted) {
    console.log(`${pad(row.area, widths.area)}  ${pad(row.status, widths.status)}  ${pad(row.command, widths.command)}  ${row.summary}`);
  }
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function collectProductMediaUrls(row) {
  const items = [];
  if (isHttpUrl(row.cover_url)) items.push({ kind: 'cover', url: row.cover_url });
  for (const url of parseUrlArray(row.image_urls)) {
    if (isHttpUrl(url) && url !== row.cover_url) items.push({ kind: 'gallery', url });
  }
  return items;
}

async function checkProductMediaUrl(item) {
  try {
    const head = await fetchWithTimeout(item.url, {
      method: 'HEAD',
      headers: { accept: 'image/*,*/*;q=0.8', 'user-agent': 'SerloHealthDashboard/1.0' },
    });
    if (head.ok) return { ok: true, ...item };
    if (![403, 405, 501].includes(head.status)) {
      return { ok: false, status: head.status, url: sanitizeUrl(item.url), ...item };
    }

    const get = await fetchWithTimeout(item.url, {
      headers: {
        accept: 'image/*,*/*;q=0.8',
        range: 'bytes=0-0',
        'user-agent': 'SerloHealthDashboard/1.0',
      },
    });
    return get.ok
      ? { ok: true, ...item }
      : { ok: false, status: get.status, url: sanitizeUrl(item.url), ...item };
  } catch (error) {
    return { ok: false, status: summarize(error.message || 'request failed'), url: sanitizeUrl(item.url), ...item };
  }
}

function parseUrlArray(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string' && item.length > 0);
  if (typeof value !== 'string' || value.length === 0) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item.length > 0) : [];
  } catch {
    return [value];
  }
}

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function sanitizeUrl(value) {
  try {
    const parsed = new URL(value);
    return `${parsed.hostname}${parsed.pathname}`.slice(0, 160);
  } catch {
    return String(value || '').slice(0, 160);
  }
}

function inspectMp4FastStart(bytes) {
  const scannedBytes = Math.min(bytes.byteLength, MEDIA_SCAN_BYTES);
  if (scannedBytes < 16) return { status: 'unknown', reason: 'file too small' };

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  let moovOffset = null;
  let mdatOffset = null;

  while (offset + 8 <= scannedBytes) {
    const box = readMp4Box(view, offset, scannedBytes);
    if (!box) break;
    if (box.type === 'moov') moovOffset = offset;
    if (box.type === 'mdat') mdatOffset = offset;
    if (moovOffset !== null && mdatOffset !== null) break;
    offset += box.size;
  }

  if (moovOffset !== null && (mdatOffset === null || moovOffset < mdatOffset)) {
    return { status: 'fast-start', reason: 'moov before mdat' };
  }
  if (mdatOffset !== null && (moovOffset === null || mdatOffset < moovOffset)) {
    return { status: 'slow-start', reason: 'mdat before moov' };
  }
  return { status: 'unknown', reason: 'moov/mdat not found' };
}

function readMp4Box(view, offset, scannedBytes) {
  const size32 = view.getUint32(offset, false);
  const type = readAscii(view, offset + 4, 4);
  if (!type) return null;
  if (size32 === 0) return { type, size: scannedBytes - offset };
  if (size32 === 1) {
    if (offset + 16 > scannedBytes) return null;
    const high = view.getUint32(offset + 8, false);
    const low = view.getUint32(offset + 12, false);
    return { type, size: high > 0 ? scannedBytes - offset : low };
  }
  if (size32 < 8) return null;
  return { type, size: size32 };
}

function readAscii(view, offset, length) {
  if (offset + length > view.byteLength) return null;
  let out = '';
  for (let index = 0; index < length; index += 1) out += String.fromCharCode(view.getUint8(offset + index));
  return out;
}

function isRetryableRpcError(result) {
  if (!result) return true;
  const error = String(result.error || '').toLowerCase();
  return (
    result.status === 0 ||
    result.status >= 500 ||
    error.includes('57014') ||
    error.includes('statement timeout') ||
    error.includes('canceling statement')
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadEnv(root) {
  for (const relative of ['apps/web/.env.local', '.env.local', '.env']) {
    const file = path.join(root, relative);
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = normalizeEnvValue(match[2]);
    }
  }
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

function readEnv(...names) {
  for (const name of names) {
    if (process.env[name]) return process.env[name];
  }
  return '';
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

function normalizeBase(value) {
  return String(value || '').replace(/\/+$/, '');
}

function withBudgetBust(url) {
  const parsed = new URL(url);
  parsed.searchParams.set('dashboard_bust', String(Date.now()));
  return parsed.toString();
}

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function ratio(actual, budget) {
  const a = Number(actual || 0);
  const b = Number(budget || 0);
  return Number.isFinite(a) && Number.isFinite(b) && b > 0 ? a / b : 0;
}

function thirtyDaysAgo() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 30);
  return date.toISOString().slice(0, 10);
}

function pad(value, width) {
  return String(value).padEnd(width, ' ');
}

function number(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(numeric) : 'n/a';
}

function formatPercent(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${Math.round(numeric * 1000) / 10}%` : 'n/a';
}

function money(cents) {
  const numeric = Number(cents || 0);
  if (!Number.isFinite(numeric)) return 'n/a';
  return `$${(numeric / 100).toFixed(2)}`;
}

function summarize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function printHelp() {
  console.log(`
Usage: node scripts/health-dashboard.mjs [options]

Builds a traffic-light production health dashboard from existing health snapshots.

Options:
  --site-url <url>      Web app URL (default ${DEFAULT_SITE_URL})
  --timeout-ms <n>      Request timeout (default ${DEFAULT_TIMEOUT_MS})
  --rpc-retries <n>     Retry transient Supabase RPC failures (default 2)
`);
}
