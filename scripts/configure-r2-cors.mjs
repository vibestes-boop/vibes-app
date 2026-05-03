import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ENV_FILES = ['apps/web/.env.local', '.env.local', '.env'];
const REGION = 'auto';
const SERVICE = 's3';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

process.on('uncaughtException', (error) => {
  console.error(`R2 CORS konnte nicht gesetzt werden: ${formatError(error)}`);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error(`R2 CORS konnte nicht gesetzt werden: ${formatError(error)}`);
  process.exit(1);
});

const corsPolicy = {
  rules: [
    {
      allowed: {
        origins: [
          'https://serlo-web.vercel.app',
          'http://localhost:3000',
          'http://localhost:3001',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:3001',
        ],
        methods: ['GET', 'HEAD', 'PUT'],
        headers: ['content-type', 'cache-control'],
      },
      exposeHeaders: ['ETag'],
      maxAgeSeconds: 86400,
    },
  ],
};

const origins = corsPolicy.rules[0].allowed.origins;
const methods = corsPolicy.rules[0].allowed.methods;
const allowedHeaders = corsPolicy.rules[0].allowed.headers;
const exposeHeaders = corsPolicy.rules[0].exposeHeaders;
const maxAgeSeconds = corsPolicy.rules[0].maxAgeSeconds;

for (const file of ENV_FILES) loadEnvFile(path.join(REPO_ROOT, file));

const cloudflare = {
  accountId: readOptionalEnv('CLOUDFLARE_ACCOUNT_ID', 'CF_ACCOUNT_ID', 'CF_R2_ACCOUNT_ID'),
  apiToken: readOptionalEnv('CLOUDFLARE_API_TOKEN', 'CF_API_TOKEN'),
  bucket: readOptionalEnv('CF_R2_BUCKET', 'R2_BUCKET_NAME'),
};

const r2S3 = {
  accountId: readOptionalEnv('CF_R2_ACCOUNT_ID', 'R2_ACCOUNT_ID'),
  accessKeyId: readOptionalEnv('CF_R2_ACCESS_KEY_ID', 'R2_ACCESS_KEY_ID'),
  secretAccessKey: readOptionalEnv('CF_R2_SECRET_ACCESS_KEY', 'R2_SECRET_ACCESS_KEY'),
  bucket: readOptionalEnv('CF_R2_BUCKET', 'R2_BUCKET_NAME'),
};

if (process.argv.includes('--print-json')) {
  console.log(JSON.stringify(corsPolicy, null, 2));
  process.exit(0);
}

const corsXml = buildCorsXml();

if (process.argv.includes('--print-xml')) {
  console.log(corsXml);
  process.exit(0);
}

if (cloudflare.accountId && cloudflare.apiToken && cloudflare.bucket) {
  await configureViaCloudflareApi();
} else if (
  r2S3.accountId &&
  r2S3.accessKeyId &&
  r2S3.secretAccessKey &&
  r2S3.bucket
) {
  await configureViaS3Api();
} else {
  throw new Error(
    'Missing credentials. Set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID ' +
      '(recommended), or CF_R2_ACCOUNT_ID + CF_R2_ACCESS_KEY_ID + ' +
      'CF_R2_SECRET_ACCESS_KEY.',
  );
}

async function configureViaCloudflareApi() {
  const endpoint =
    `https://api.cloudflare.com/client/v4/accounts/${cloudflare.accountId}` +
    `/r2/buckets/${encodeURIComponent(cloudflare.bucket)}/cors`;
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${cloudflare.apiToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(corsPolicy),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Cloudflare CORS update failed: ${response.status} ${redact(body)}`);
  }

  console.log(`R2 CORS configured via Cloudflare API for bucket "${cloudflare.bucket}".`);
  printSummary();
}

async function configureViaS3Api() {
  const host = `${r2S3.accountId}.r2.cloudflarestorage.com`;
  const baseUrl = `https://${host}/${r2S3.bucket}`;

  await signedFetch('PUT', `${baseUrl}?cors`, corsXml, {
    'content-type': 'application/xml',
  }, host);

  const verify = await signedFetch('GET', `${baseUrl}?cors`, '', {}, host);
  const deployedXml = await verify.text();

  if (!verify.ok) {
    throw new Error(`R2 CORS verification failed: ${verify.status} ${deployedXml}`);
  }

  console.log(`R2 CORS configured via S3 API for bucket "${r2S3.bucket}".`);
  printSummary();
}

function printSummary() {
  console.log(`Allowed origins: ${origins.join(', ')}`);
  console.log(`Allowed methods: ${methods.join(', ')}`);
  console.log(`Allowed headers: ${allowedHeaders.join(', ')}`);
}

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function readOptionalEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return '';
}

function buildCorsXml() {
  return [
    '<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">',
    '  <CORSRule>',
    ...origins.map((origin) => `    <AllowedOrigin>${escapeXml(origin)}</AllowedOrigin>`),
    ...methods.map((method) => `    <AllowedMethod>${method}</AllowedMethod>`),
    ...allowedHeaders.map((header) => `    <AllowedHeader>${header}</AllowedHeader>`),
    ...exposeHeaders.map((header) => `    <ExposeHeader>${header}</ExposeHeader>`),
    `    <MaxAgeSeconds>${maxAgeSeconds}</MaxAgeSeconds>`,
    '  </CORSRule>',
    '</CORSConfiguration>',
  ].join('\n');
}

async function signedFetch(method, url, body = '', extraHeaders = {}, host) {
  const target = new URL(url);
  const payload = typeof body === 'string' ? body : '';
  const payloadHash = sha256Hex(payload);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const dateStamp = amzDate.slice(0, 8);

  const headers = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...lowercaseHeaders(extraHeaders),
  };
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((name) => `${name}:${String(headers[name]).trim()}\n`)
    .join('');
  const canonicalRequest = [
    method,
    target.pathname,
    canonicalQuery(target.searchParams),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const signingKey = getSigningKey(dateStamp, REGION, SERVICE);
  const signature = hmacHex(signingKey, stringToSign);

  const requestHeaders = Object.fromEntries(
    Object.entries(headers).filter(([name]) => name !== 'host'),
  );
  requestHeaders.authorization =
    `AWS4-HMAC-SHA256 Credential=${r2S3.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(target, {
    method,
    headers: requestHeaders,
    body: method === 'GET' || method === 'HEAD' ? undefined : payload,
  });

  if (!response.ok && method !== 'GET') {
    const text = await response.text().catch(() => '');
    throw new Error(`R2 CORS ${method} failed: ${response.status} ${text}`);
  }
  return response;
}

function canonicalQuery(params) {
  return [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${rfc3986(key)}=${rfc3986(value)}`)
    .join('&');
}

function lowercaseHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
}

function getSigningKey(dateStamp, region, service) {
  const kDate = hmac(Buffer.from(`AWS4${r2S3.secretAccessKey}`, 'utf8'), dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function hmacHex(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest('hex');
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function rfc3986(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function redact(text) {
  return text.replace(/[A-Za-z0-9_=-]{24,}/g, '<redacted>');
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}
