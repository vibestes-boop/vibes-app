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
];

console.log('Governance health check');

const ownership = readJson('docs/stability/ownership.json');
if (ownership) validateOwnership(ownership);

validateTextFile('docs/stability/weekly-review.md', REVIEW_REQUIRED_TEXT);
validateTextFile('docs/stability/feature-intake.md', INTAKE_REQUIRED_TEXT);
validateTextFile('docs/stability/product-metrics.md', ['Keep', 'Improve', 'Kill', 'target metric', 'rollback plan']);
validateTextFile('docs/stability/cost-controls.md', ['feature flag', 'monthly budget', 'rollback owner']);
validateTextFile('docs/stability/trust-safety.md', ['SLA', 'admin_audit_log', 'content_reports']);
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
  ]) {
    if (!workflow.includes(command)) {
      failures.push(`[workflow] Missing weekly command: ${command}.`);
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
