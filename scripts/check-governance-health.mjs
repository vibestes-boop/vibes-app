import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const warnings = [];

const REQUIRED_AREAS = [
  'Data Lifecycle',
  'Web/Mobile Parity',
  'Feed/Algorithmus',
  'Push/Notifications',
  'R2/Media',
  'Release/CI',
  'Moderation/Trust',
  'Cost Monitoring',
  'Product Metrics',
];

const REQUIRED_OWNER_FIELDS = ['area', 'owner', 'dashboard', 'alert', 'runbook', 'weekly_status'];
const REVIEW_REQUIRED_TEXT = [
  'npm run integrity:weekly',
  'npm run product:health',
  'npm run cost:health',
  'npm run moderation:health',
  'npm run governance:health',
  'npm run push-feed:health',
  'npm run health:dashboard',
  'npm run feature:freeze',
  'Keep',
  'Improve',
  'Kill',
  'Feature freeze',
];
const INTAKE_REQUIRED_TEXT = [
  'Owner:',
  'Expected user value:',
  'Target metric:',
  'Cost risk:',
  'Rollback plan:',
  'Monitoring signal:',
  'Feature flag:',
  'Feature freeze result:',
];

console.log('Governance health check');

const ownership = readJson('docs/stability/ownership.json');
if (ownership) validateOwnership(ownership);

validateTextFile('docs/stability/weekly-review.md', REVIEW_REQUIRED_TEXT);
validateTextFile('docs/stability/feature-intake.md', INTAKE_REQUIRED_TEXT);
validateTextFile('docs/stability/alerts.md', [
  'stability-alert',
  'GitHub issue',
  'continue-on-error',
  'SLACK_WEBHOOK_URL',
  'RESEND_API_KEY',
  'HEALTH_ALERT_EMAIL_TO',
  'HEALTH_ALERT_EMAIL_FROM',
]);
validateTextFile('docs/stability/push-feed-health.md', [
  'npm run push-feed:health',
  'Push Signals',
  'Feed Signals',
  'X-Feed-Data-Source',
  'Feed RPC fallback',
]);
validateTextFile('docs/stability/health-dashboard.md', ['npm run health:dashboard', 'Green', 'Yellow', 'Red']);
validateTextFile('docs/stability/product-metrics.md', ['Keep', 'Improve', 'Kill', 'target metric', 'rollback plan']);
validateTextFile('docs/stability/cost-controls.md', [
  'feature flag',
  'monthly budget',
  'rollback owner',
  'Runtime Feature Flags',
  'live_recording_enabled',
  '100%',
  'PROVIDER_COSTS_JSON',
  'PROVIDER_BILLING_DIR',
  'cost:fetch-providers',
  'COST_PROVIDER_BUDGET_CENTS',
]);
validateTextFile('scripts/fetch-provider-billing.mjs', ['PROVIDER_BILLING_SOURCES_JSON', 'CLOUDFLARE_BILLING_URL', 'No secret values are printed']);
validateTextFile('scripts/collect-provider-costs.mjs', ['--dir', 'PROVIDER_COSTS_JSON', 'readProviderBillingDir']);
validateTextFile('scripts/lib/provider-costs.mjs', ['PROVIDER_BILLING_DIR', 'cloudflare_r2_cents', 'livekit_cents']);
validateTextFile('docs/stability/trust-safety.md', ['SLA', 'admin_audit_log', 'content_reports', '/admin/reports', 'copyright', 'nsfw']);
validateTextFile('apps/web/lib/moderation/report-reasons.ts', ['POST_REPORT_REASONS', 'copyright', 'nsfw']);
validateTextFile('apps/web/lib/feature-flags/server.ts', [
  'RUNTIME_FEATURE_FLAGS',
  'live_streaming_enabled',
  'live_whip_ingress_enabled',
  'live_recording_enabled',
  'live_shop_enabled',
  'is_feature_enabled',
]);
validateTextFile('apps/web/app/admin/reports/page.tsx', ['getModerationHealth', 'AdminReportsClient']);
validateTextFile('apps/web/app/admin/reports/admin-reports-client.tsx', [
  'ModerationHealthPanel',
  'Moderation-Health',
  'SLA',
  'adminEnforceReport',
]);
validateTextFile('supabase/migrations/20260517214000_admin_enforcement_actions.sql', [
  'admin_enforce_content_report',
  'admin_audit_log',
  'r2_delete_queue',
]);
validateTextFile('supabase/migrations/20260517223000_extended_admin_enforcement_actions.sql', [
  'restrict_profile',
  'shadowban_profile',
  'mute_live_host',
  'admin_audit_log',
]);
validateTextFile('supabase/migrations/20260517224000_moderation_enforcement_health.sql', [
  'enforcement',
  'profile_restrict_columns',
  'profile_shadowban_column',
  'live_mute_table',
]);
validateTextFile('supabase/migrations/20260517225000_hide_moderated_authors_from_public_feeds.sql', [
  'get_public_feed_web',
  'get_public_feed_web_anon',
  'get_public_feed_web_anon_first_page',
  'get_public_explore_feed_web',
  'get_public_post_web',
  'is_banned',
  'is_shadow_banned',
]);
validateTextFile('supabase/migrations/20260517230000_hide_moderated_profiles_from_public_discovery.sql', [
  'get_public_profile_web',
  'search_public_profiles_web',
  'get_public_discover_people_web',
  'is_banned',
  'is_shadow_banned',
]);
validateTextFile('supabase/migrations/20260517220000_runtime_feature_flags.sql', [
  'live_streaming_enabled',
  'live_whip_ingress_enabled',
  'live_recording_enabled',
  'live_shop_enabled',
]);
validateTextFile('scripts/check-feature-freeze.mjs', ['Feature freeze guard', 'north-star-zero-weeks']);
validateTextFile('.github/ISSUE_TEMPLATE/feature_request.yml', [
  'Feature request',
  'Owner',
  'Expected user value',
  'Target metric',
  'Feature freeze result',
]);
validateTextFile('.github/pull_request_template.md', [
  'Feature Governance',
  'npm run governance:health',
  'npm run feature:freeze',
  'Feature freeze result',
]);
validateWorkflow();

if (warnings.length > 0) {
  console.log('');
  console.log('Warnings:');
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (failures.length > 0) {
  console.log('');
  console.error('Governance health check failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('');
console.log('Governance health check passed.');

function validateOwnership(ownership) {
  if (!Array.isArray(ownership.areas)) {
    failures.push('[ownership] areas must be an array.');
    return;
  }

  const byArea = new Map(ownership.areas.map((entry) => [entry.area, entry]));
  for (const requiredArea of REQUIRED_AREAS) {
    if (!byArea.has(requiredArea)) {
      failures.push(`[ownership] Missing area: ${requiredArea}.`);
      continue;
    }

    const entry = byArea.get(requiredArea);
    for (const field of REQUIRED_OWNER_FIELDS) {
      if (!isNonEmptyString(entry[field])) {
        failures.push(`[ownership:${requiredArea}] Missing ${field}.`);
      }
    }

    if (/^(tbd|todo|unknown|unassigned)$/i.test(String(entry.owner || '').trim())) {
      failures.push(`[ownership:${requiredArea}] Owner cannot be ${entry.owner}.`);
    }

    for (const field of ['runbook', 'weekly_status']) {
      const value = entry[field];
      if (isNonEmptyString(value) && value.startsWith('docs/') && !fs.existsSync(path.join(repoRoot, value))) {
        failures.push(`[ownership:${requiredArea}] ${field} file does not exist: ${value}.`);
      }
    }
  }

  console.log(`  - ownership areas: ${ownership.areas.length}/${REQUIRED_AREAS.length}`);
}

function validateWorkflow() {
  const workflow = readText('.github/workflows/weekly-integrity.yml');
  if (!workflow) return;
  for (const command of [
    'npm run integrity:weekly',
    'npm run product:health',
    'npm run cost:health',
    'npm run moderation:health',
    'npm run governance:health',
    'npm run push-feed:health',
    'npm run health:dashboard',
    'npm run feature:freeze',
  ]) {
    if (!workflow.includes(command)) {
      failures.push(`[workflow] Missing weekly command: ${command}.`);
    }
  }
  for (const requiredText of [
    'issues: write',
    'actions/github-script',
    'stability-alert',
    'continue-on-error',
    'SLACK_WEBHOOK_URL',
    'RESEND_API_KEY',
    'HEALTH_ALERT_EMAIL_TO',
    'HEALTH_ALERT_EMAIL_FROM',
    'Send email weekly health alert',
  ]) {
    if (!workflow.includes(requiredText)) {
      failures.push(`[workflow] Missing alert wiring: ${requiredText}.`);
    }
  }
}

function validateTextFile(relativePath, requiredText) {
  const text = readText(relativePath);
  if (!text) return;
  for (const needle of requiredText) {
    if (!text.includes(needle)) {
      failures.push(`[${relativePath}] Missing required text: ${needle}.`);
    }
  }
  console.log(`  - ${relativePath}: ok`);
}

function readJson(relativePath) {
  const text = readText(relativePath);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    failures.push(`[${relativePath}] Invalid JSON: ${error.message}`);
    return null;
  }
}

function readText(relativePath) {
  const file = path.join(repoRoot, relativePath);
  if (!fs.existsSync(file)) {
    failures.push(`[${relativePath}] Missing file.`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}
