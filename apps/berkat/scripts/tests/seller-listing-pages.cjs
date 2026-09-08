// Real hook options and InfiniteQueryObserver; local responses only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { QueryClient, InfiniteQueryObserver } = require('@tanstack/query-core');
const root = path.resolve(__dirname, '../..');
const plain = value => JSON.parse(JSON.stringify(value));
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
function load(file, deps) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const context = vm.createContext({ exports: {}, require: name => deps[name] ?? {} });
  vm.runInContext(code, context);
  return context.exports;
}
function options(sellerId, enabled, request, name = 'useSellerListingPages') {
  let config;
  const api = { from: table => {
    const call = { table, filters: [], orders: [] };
    const builder = { then: (yes, no) => request(call).then(yes, no) };
    builder.select = value => { call.select = value; return builder; };
    for (const op of ['eq', 'is']) builder[op] = (...args) => { call.filters.push([op, ...args]); return builder; };
    builder.order = (...args) => { call.orders.push(args); return builder; };
    for (const op of ['or', 'limit', 'retry']) builder[op] = value => { call[op] = value; return builder; };
    builder.abortSignal = signal => { call.signal = signal; return builder; };
    return builder;
  } };
  const capture = value => { config = value; return {}; };
  load('lib/useListings.ts', { '@tanstack/react-query': { useQuery: capture, useInfiniteQuery: capture }, './supabase': { supabase: api } })[name](sellerId, enabled);
  return { ...config, queryKey: plain(config.queryKey) };
}
const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
const records = count => Array.from({ length: count }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(10000 - i).padStart(12, '0')}`,
  created_at: `2026-09-08T14:00:${String(59 - Math.floor(i / 35)).padStart(2, '0')}.123456+00:00`,
  title: `Local ${i + 1}`, show: null,
}));
function afterCursor(rows, call) {
  if (!call.or) return rows.slice(0, call.limit);
  const match = call.or.match(/^created_at\.lt\.(.*),and\(created_at\.eq\.(.*),id\.lt\.(.*)\)$/);
  assert.ok(match, 'compound cursor filter must be complete');
  assert.equal(match[1], match[2]);
  return rows.filter(row => row.created_at < match[1] || row.created_at === match[1] && row.id < match[3]).slice(0, call.limit);
}
async function observe(config, run) {
  const client = makeClient(), observer = new InfiniteQueryObserver(client, config), stop = observer.subscribe(() => {});
  try { await flush(); await run(observer, client); }
  finally { stop(); client.clear(); }
}

test('hidden or absent seller does not load; cache identity separates seller and legacy array', async () => {
  let calls = 0;
  const request = async () => { calls++; return { data: [], error: null }; };
  for (const [seller, enabled] of [[undefined, true], ['seller', false]]) {
    await observe(options(seller, enabled, request), async () => { assert.equal(calls, 0); });
  }
  const active = options('seller', true, request), hidden = options('seller', false, request);
  assert.deepEqual(active.queryKey, hidden.queryKey);
  assert.deepEqual(active.queryKey, ['berkat', 'standing', 'seller', 'pages']);
  assert.notDeepEqual(active.queryKey, options('other', true, request).queryKey);
  assert.deepEqual(options('seller', true, request, 'useSellerListings').queryKey, ['berkat', 'standing', 'seller']);
});

for (const count of [0, 1, 30, 31, 60, 65, 95]) test(`${count} offers: all pages in order, ties and microseconds preserved, no extra final request`, async () => {
  const all = records(count), calls = [];
  const config = options('seller', true, async call => { calls.push(call); return { data: afterCursor(all, call), error: null }; });
  await observe(config, async observer => {
    while (observer.getCurrentResult().hasNextPage) await observer.fetchNextPage({ cancelRefetch: false });
    const result = observer.getCurrentResult();
    assert.deepEqual(plain(result.data.listings), all);
    assert.equal(result.hasNextPage, false);
    assert.equal(calls.length, Math.max(1, Math.ceil(count / 30)));
    for (const call of calls) {
      assert.equal(call.limit, 31); assert.equal(call.table, 'live_auctions');
      assert.deepEqual(plain(call.filters), [['is', 'session_id', null], ['eq', 'status', 'listed'], ['eq', 'seller_id', 'seller']]);
      assert.deepEqual(plain(call.orders), [['created_at', { ascending: false }], ['id', { ascending: false }]]);
      assert.equal(call.retry, false); assert.ok(call.signal);
      assert.match(call.select, /created_at/); assert.match(call.select, /show:scheduled_lives!planned_for/);
    }
    if (count > 30) assert.match(calls[1].or, /\.123456\+00:00/);
  });
});

test('insertions and removals ahead of the cursor do not skip the next surviving offer', async () => {
  let all = records(65);
  await observe(options('seller', true, async call => ({ data: afterCursor(all, call), error: null })), async observer => {
    const initial = all.slice(0, 30), remainder = all.slice(30);
    all = [{ ...all[0], id: 'new', created_at: '2026-09-09T00:00:00.000000+00:00' }, ...all.slice(3)];
    await observer.fetchNextPage(); await observer.fetchNextPage();
    assert.deepEqual(plain(observer.getCurrentResult().data.listings), [...initial, ...remainder]);
    await observer.refetch();
    assert.deepEqual(plain(observer.getCurrentResult().data.listings), all);
  });
});

test('failed next page retains cards and retries the same cursor', async () => {
  const all = records(35), cursors = []; let fail = true;
  const config = options('seller', true, async call => {
    cursors.push(call.or);
    return call.or && fail ? { data: null, error: new Error('offline') } : { data: afterCursor(all, call), error: null };
  });
  await observe({ ...config, retry: false }, async observer => {
    await observer.fetchNextPage(); const failed = observer.getCurrentResult();
    assert.equal(failed.isFetchNextPageError, true); assert.equal(failed.data.listings.length, 30); assert.equal(failed.hasNextPage, true);
    fail = false; await observer.fetchNextPage();
    assert.equal(cursors[1], cursors[2]); assert.equal(observer.getCurrentResult().isError, false);
    assert.deepEqual(plain(observer.getCurrentResult().data.listings), all);
  });
});

test('double next-page requests share one in-flight response', async () => {
  const all = records(35); let release, requests = 0;
  await observe(options('seller', true, call => {
    requests++;
    if (call.or) return new Promise(resolve => { release = () => resolve({ data: afterCursor(all, call), error: null }); });
    return Promise.resolve({ data: afterCursor(all, call), error: null });
  }), async observer => {
    const first = observer.fetchNextPage({ cancelRefetch: false });
    const second = observer.fetchNextPage({ cancelRefetch: false });
    await flush(); assert.equal(requests, 2); release(); await Promise.all([first, second]);
    assert.equal(observer.getCurrentResult().data.listings.length, 35);
  });
});

test('refresh re-derives every cursor and stops early when the shop shrinks', async () => {
  let all = records(65); const cursors = [];
  await observe(options('seller', true, async call => { cursors.push(call.or); return { data: afterCursor(all, call), error: null }; }), async observer => {
    await observer.fetchNextPage(); await observer.fetchNextPage();
    all = all.slice(0, 4); cursors.length = 0;
    await observer.refetch();
    assert.deepEqual(cursors, [undefined]);
    assert.equal(observer.getCurrentResult().data.pages.length, 1);
    assert.deepEqual(plain(observer.getCurrentResult().data.listings), all);
  });
});

test('refresh failure preserves all pages instead of converting them to an empty shop', async () => {
  const all = records(35); let fail = false;
  const config = options('seller', true, async call => fail ? { data: null, error: new Error('offline') } : { data: afterCursor(all, call), error: null });
  await observe({ ...config, retry: false }, async observer => {
    await observer.fetchNextPage(); fail = true; await observer.refetch();
    const result = observer.getCurrentResult(); assert.equal(result.isRefetchError, true); assert.equal(result.isFetchNextPageError, false);
    assert.deepEqual(plain(result.data.listings), all);
    fail = false; await observer.refetch(); assert.equal(observer.getCurrentResult().isError, false);
  });
});

test('initial error remains distinct from a successfully empty shop', async () => {
  let fail = true;
  const config = options('seller', true, async () => fail ? { data: null, error: new Error('offline') } : { data: [], error: null });
  await observe({ ...config, retry: false }, async observer => {
    assert.equal(observer.getCurrentResult().isError, true); assert.equal(observer.getCurrentResult().data, undefined);
    fail = false; await observer.refetch();
    assert.equal(observer.getCurrentResult().isSuccess, true); assert.equal(observer.getCurrentResult().data.listings.length, 0);
  });
});

test('switching sellers aborts the old request and does not show its response', async () => {
  let release, signal;
  const old = options('old', true, call => { signal = call.signal; return new Promise(resolve => { release = resolve; }); });
  await observe(old, async observer => {
    observer.setOptions(options('new', true, async () => ({ data: [], error: null }))); await flush();
    assert.equal(signal.aborted, true); release({ data: records(31), error: null }); await flush();
    assert.equal(observer.getCurrentResult().data.listings.length, 0);
  });
});

test('duplicate page records are presented once without changing stored cursor metadata', () => {
  const config = options('seller', true, async () => ({ data: [], error: null }));
  const all = records(3), pages = [{ rows: all.slice(0, 2), next: { createdAt: all[1].created_at, id: all[1].id } }, { rows: all.slice(1), next: undefined }];
  const data = { pages, pageParams: [null, pages[0].next] }, selected = config.select(data);
  assert.deepEqual(plain(selected.listings), all); assert.equal(selected.pages, pages); assert.equal(selected.pageParams, data.pageParams);
});

test('existing shelf invalidation reaches the paged profile without changing the legacy cache shape', () => {
  const client = makeClient();
  const old = ['berkat', 'standing', 'seller'], paged = [...old, 'pages'];
  const rows = records(2), data = { pages: [{ rows }], pageParams: [null] };
  client.setQueryData(old, rows); client.setQueryData(paged, data);
  try {
    load('lib/useStanding.ts', {}).invalidateShelfSurfaces(client);
    assert.equal(client.getQueryState(old).isInvalidated, true); assert.equal(client.getQueryState(paged).isInvalidated, true);
    assert.deepEqual(client.getQueryData(old), rows); assert.deepEqual(client.getQueryData(paged), data);
  } finally { client.clear(); }
});

test('permissions never retry and transient errors retry only once', () => {
  const config = options('seller', true, async () => ({ data: [], error: null }));
  assert.equal(config.retry(0, { code: '42501' }), false);
  assert.equal(config.retry(0, new Error('offline')), true); assert.equal(config.retry(1, new Error('offline')), false);
});
