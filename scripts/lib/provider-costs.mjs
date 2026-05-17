import fs from 'node:fs';
import path from 'node:path';

const PROVIDER_FIELDS = [
  'cloudflare_r2_cents',
  'supabase_cents',
  'vercel_cents',
  'livekit_cents',
  'ai_cents',
  'other_cents',
];

const MONEY_KEYS = [
  'total_cents',
  'amount_cents',
  'cost_cents',
  'usage_cents',
  'subtotal_cents',
  'total',
  'amount',
  'cost',
  'usage_cost',
  'subtotal',
  'invoice_total',
  'spend',
];

export function readProviderCosts({ repoRoot, args = {}, env = process.env, failures = [], warnings = [] }) {
  const raw = args.providerCostsJson || env.PROVIDER_COSTS_JSON || readProviderCostsFile({ repoRoot, args, env, failures });
  if (raw) {
    try {
      return normalizeProviderCosts(JSON.parse(raw), 'provider-costs-input');
    } catch (error) {
      failures.push(`[provider-costs] PROVIDER_COSTS_JSON is invalid JSON: ${error.message}`);
      return emptyProviderCosts();
    }
  }

  const billingDir = args.providerBillingDir || env.PROVIDER_BILLING_DIR;
  if (billingDir) {
    return readProviderBillingDir({ repoRoot, billingDir, failures, warnings });
  }

  return emptyProviderCosts();
}

export function readProviderBillingDir({ repoRoot, billingDir, failures = [], warnings = [] }) {
  const absolute = path.isAbsolute(billingDir) ? billingDir : path.join(repoRoot, billingDir);
  if (!fs.existsSync(absolute)) {
    failures.push(`[provider-costs] PROVIDER_BILLING_DIR does not exist: ${billingDir}`);
    return emptyProviderCosts();
  }

  const stat = fs.statSync(absolute);
  if (!stat.isDirectory()) {
    failures.push(`[provider-costs] PROVIDER_BILLING_DIR is not a directory: ${billingDir}`);
    return emptyProviderCosts();
  }

  const files = listBillingFiles(absolute);
  if (files.length === 0) {
    warnings.push(`[provider-costs] PROVIDER_BILLING_DIR has no JSON/CSV billing exports: ${billingDir}`);
    return emptyProviderCosts();
  }

  const costs = emptyProviderCosts({
    available: true,
    generated_at: new Date().toISOString(),
    source: `provider-billing-dir:${billingDir}`,
  });

  for (const file of files) {
    const relative = path.relative(absolute, file);
    const fileCosts = parseBillingFileCosts(file, failures, relative);
    for (const field of PROVIDER_FIELDS) {
      costs[field] += fileCosts[field] || 0;
    }
  }

  costs.total_cents = sumProviderFields(costs);
  return costs;
}

export function normalizeProviderCosts(parsed, fallbackSource = 'provider-costs-input') {
  if (Array.isArray(parsed)) {
    const costs = emptyProviderCosts({
      available: true,
      generated_at: new Date().toISOString(),
      source: fallbackSource,
    });
    for (const row of parsed) {
      const provider = providerFromValue(row?.provider || row?.service || row?.product || row?.source || '');
      costs[provider] += readRowCents(row);
    }
    costs.total_cents = sumProviderFields(costs);
    return costs;
  }

  const costs = emptyProviderCosts({
    available: true,
    generated_at: parsed?.generated_at || null,
    source: parsed?.source || fallbackSource,
  });

  for (const field of PROVIDER_FIELDS) {
    costs[field] = readNonNegativeNumber(parsed?.[field]);
  }

  costs.total_cents = readOptionalNonNegativeNumber(parsed?.total_cents) ?? sumProviderFields(costs);
  return costs;
}

export function emptyProviderCosts(overrides = {}) {
  return {
    available: false,
    generated_at: null,
    source: null,
    cloudflare_r2_cents: 0,
    supabase_cents: 0,
    vercel_cents: 0,
    livekit_cents: 0,
    ai_cents: 0,
    other_cents: 0,
    total_cents: 0,
    ...overrides,
  };
}

function readProviderCostsFile({ repoRoot, args, env, failures }) {
  const file = args.providerCostsFile || env.PROVIDER_COSTS_FILE;
  if (!file) return '';
  const absolute = path.isAbsolute(file) ? file : path.join(repoRoot, file);
  if (!fs.existsSync(absolute)) {
    failures.push(`[provider-costs] PROVIDER_COSTS_FILE does not exist: ${file}`);
    return '';
  }
  return fs.readFileSync(absolute, 'utf8');
}

function listBillingFiles(root) {
  const files = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
      } else if (/\.(json|csv)$/i.test(entry.name)) {
        files.push(absolute);
      }
    }
  }
  return files.sort();
}

function parseBillingFileCosts(file, failures, label) {
  const fallbackProvider = providerFromFile(file);
  const costs = emptyProviderCosts({ available: true });
  const text = fs.readFileSync(file, 'utf8');
  if (/\.json$/i.test(file)) {
    try {
      const parsed = JSON.parse(text);
      const rows = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.items)
          ? parsed.items
          : Array.isArray(parsed?.line_items)
            ? parsed.line_items
            : Array.isArray(parsed?.data)
              ? parsed.data
              : [parsed];
      return sumRowsByProvider(rows, fallbackProvider);
    } catch (error) {
      failures.push(`[provider-costs] Could not parse JSON billing export ${label}: ${error.message}`);
      return costs;
    }
  }

  const rows = parseCsv(text);
  return sumRowsByProvider(rows, fallbackProvider);
}

function sumRowsByProvider(rows, fallbackProvider) {
  const costs = emptyProviderCosts({ available: true });
  for (const row of rows) {
    const explicitProvider = row?.provider || row?.service || row?.product || row?.source || '';
    const provider = explicitProvider ? providerFromValue(explicitProvider) : fallbackProvider;
    costs[provider] += readRowCents(row);
  }
  return costs;
}

function readRowCents(row) {
  if (!row || typeof row !== 'object') return 0;
  for (const key of MONEY_KEYS) {
    if (!(key in row)) continue;
    const value = readMoneyValue(row[key]);
    if (!Number.isFinite(value) || value < 0) continue;
    return key.endsWith('_cents') ? Math.round(value) : Math.round(value * 100);
  }
  return 0;
}

function parseCsv(text) {
  const rows = text.trim().split(/\r?\n/).filter(Boolean).map(parseCsvLine);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => normalizeHeader(header));
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values.map((value) => value.trim());
}

function normalizeHeader(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function providerFromFile(file) {
  return providerFromValue(path.basename(file).toLowerCase());
}

function providerFromValue(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('cloudflare') || text.includes('r2')) return 'cloudflare_r2_cents';
  if (text.includes('supabase')) return 'supabase_cents';
  if (text.includes('vercel')) return 'vercel_cents';
  if (text.includes('livekit')) return 'livekit_cents';
  if (text.includes('openai') || text.includes('ai')) return 'ai_cents';
  return 'other_cents';
}

function sumProviderFields(costs) {
  return PROVIDER_FIELDS.reduce((sum, field) => sum + readNonNegativeNumber(costs[field]), 0);
}

function readNonNegativeNumber(value) {
  return readOptionalNonNegativeNumber(value) ?? 0;
}

function readOptionalNonNegativeNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = readMoneyValue(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

function readMoneyValue(value) {
  if (typeof value === 'number') return value;
  return Number(String(value || '').replace(/[$,\s]/g, ''));
}
