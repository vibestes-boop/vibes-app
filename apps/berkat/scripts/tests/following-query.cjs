// Real hook + InfiniteQueryObserver; local fixtures, no backend reads or writes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { QueryClient, InfiniteQueryObserver } = require('@tanstack/query-core');
const root = path.resolve(__dirname, '../..');
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const normalize = value => JSON.parse(JSON.stringify(value));

function load(file, query, api) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = vm.createContext({ exports: {}, require: name => name === '@tanstack/react-query' ? query : { supabase: api } });
  vm.runInContext(code, context);
  return context.exports;
}
function options(userId, enabled, request) {
  let config;
  const api = { from: table => {
    const call = { table, orders: [], filters: [] };
    const builder = { then: (resolve, reject) => request(call).then(resolve, reject) };
    builder.select = value => { call.select = value; return builder; };
    builder.eq = (...value) => { call.filters.push(value); return builder; };
    builder.order = (...value) => { call.orders.push(value); return builder; };
    builder.range = (...value) => { call.range = value; return builder; };
    builder.abortSignal = value => { call.signal = value; return builder; };
    builder.retry = value => { call.retry = value; return builder; };
    return builder;
  } };
  load('lib/useFollowing.ts', { useInfiniteQuery: value => { config = value; } }, api).useFollowing(userId, enabled);
  return { ...config, queryKey: normalize(config.queryKey) };
}
const clientFor = () => new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
const records = count => Array.from({ length: count }, (_, i) => ({ id: `follow-${i}`, following_id: `person-${i}`, profile: i === 2 ? null : { id: `person-${i}`, username: `name-${i}`, avatar_url: null } }));

test('guest and hidden directory make no request; cache key separates accounts', async () => {
  let calls = 0;
  const request = async () => { calls++; return { data: [], error: null }; };
  const client = clientFor();
  const guest = options(null, true, request), hidden = options('me', false, request);
  const a = new InfiniteQueryObserver(client, guest), b = new InfiniteQueryObserver(client, hidden);
  const ua = a.subscribe(() => {}), ub = b.subscribe(() => {});
  try {
    await flush(); assert.equal(calls, 0);
    assert.deepEqual(hidden.queryKey, options('me', true, request).queryKey);
    assert.notDeepEqual(hidden.queryKey, options('other', true, request).queryKey);
  } finally { ua(); ub(); client.clear(); }
});

test('pagination preserves the boundary row, unavailable profiles and the last page', async () => {
  const all = records(61), calls = [];
  const config = options('me', true, async call => {
    calls.push(call);
    return { data: all.slice(call.range[0], call.range[1] + 1), error: null };
  });
  const client = clientFor(), observer = new InfiniteQueryObserver(client, config);
  const stop = observer.subscribe(() => {});
  try {
    await flush(); assert.equal(observer.getCurrentResult().data.pages[0].rows.length, 30);
    assert.equal(observer.getCurrentResult().hasNextPage, true);
    await observer.fetchNextPage(); await observer.fetchNextPage();
    const result = observer.getCurrentResult();
    assert.deepEqual(normalize(result.data.pages.flatMap(page => page.rows)), all);
    assert.equal(result.hasNextPage, false);
    assert.deepEqual(calls.map(call => normalize(call.range)), [[0, 30], [30, 60], [60, 90]]);
    for (const call of calls) {
      assert.equal(call.table, 'follows');
      assert.deepEqual(normalize(call.filters), [['follower_id', 'me']]);
      assert.deepEqual(normalize(call.orders), [['created_at', { ascending: false }], ['id', { ascending: false }]]);
      assert.equal(call.retry, false);
      assert.ok(call.signal);
      assert.equal(call.select, 'id, following_id, profile:profiles!follows_following_id_fkey(id, username, avatar_url)');
    }
  } finally { stop(); client.clear(); }
});

test('an exactly full final page does not offer another fetch', async () => {
  const client = clientFor(), config = options('me', true, async () => ({ data: records(30), error: null }));
  const observer = new InfiniteQueryObserver(client, config), stop = observer.subscribe(() => {});
  try { await flush(); assert.equal(observer.getCurrentResult().hasNextPage, false); }
  finally { stop(); client.clear(); }
});

test('a failed next page retains loaded profiles and retries the same offset', async () => {
  const all = records(35), offsets = []; let fail = true;
  const config = options('me', true, async call => {
    offsets.push(call.range[0]);
    return call.range[0] && fail ? { data: null, error: new Error('offline') } : { data: all.slice(call.range[0], call.range[1] + 1), error: null };
  });
  const client = clientFor(), observer = new InfiniteQueryObserver(client, { ...config, retry: false }), stop = observer.subscribe(() => {});
  try {
    await flush(); await observer.fetchNextPage();
    assert.equal(observer.getCurrentResult().isFetchNextPageError, true);
    assert.equal(observer.getCurrentResult().data.pages[0].rows.length, 30);
    fail = false; await observer.fetchNextPage();
    assert.deepEqual(offsets, [0, 30, 30]);
    assert.equal(observer.getCurrentResult().isError, false);
    assert.equal(observer.getCurrentResult().data.pages.flatMap(page => page.rows).length, 35);
  } finally { stop(); client.clear(); }
});

test('refresh failure retains cache and is not an empty-success state', async () => {
  let fail = false;
  const config = options('me', true, async () => fail ? { data: null, error: new Error('offline') } : { data: records(2), error: null });
  const client = clientFor(), observer = new InfiniteQueryObserver(client, { ...config, retry: false }), stop = observer.subscribe(() => {});
  try {
    await flush(); fail = true; await observer.refetch();
    assert.equal(observer.getCurrentResult().isRefetchError, true);
    assert.equal(observer.getCurrentResult().data.pages[0].rows.length, 2);
    fail = false; await observer.refetch(); assert.equal(observer.getCurrentResult().isError, false);
  } finally { stop(); client.clear(); }
});

test('initial failure has no successful empty data; manual retry can recover to an empty list', async () => {
  let fail = true;
  const config = options('me', true, async () => fail ? { data: null, error: new Error('offline') } : { data: [], error: null });
  const client = clientFor(), observer = new InfiniteQueryObserver(client, { ...config, retry: false }), stop = observer.subscribe(() => {});
  try {
    await flush(); assert.equal(observer.getCurrentResult().isError, true);
    assert.equal(observer.getCurrentResult().data, undefined);
    fail = false; await observer.refetch();
    assert.equal(observer.getCurrentResult().isSuccess, true);
    assert.equal(observer.getCurrentResult().data.pages[0].rows.length, 0);
    assert.equal(observer.getCurrentResult().hasNextPage, false);
  } finally { stop(); client.clear(); }
});

test('account switch aborts old response and never shows the previous account list', async () => {
  let release, oldSignal;
  const old = options('old', true, call => { oldSignal = call.signal; return new Promise(resolve => { release = resolve; }); });
  const next = options('next', true, async () => ({ data: [], error: null }));
  const client = clientFor(), observer = new InfiniteQueryObserver(client, old), stop = observer.subscribe(() => {});
  try {
    await flush(); observer.setOptions(next); await flush();
    assert.equal(oldSignal.aborted, true);
    release({ data: records(10), error: null }); await flush();
    assert.equal(observer.getCurrentResult().data.pages[0].rows.length, 0);
  } finally { stop(); client.clear(); }
});

test('permission errors do not retry; transient errors retry only once', () => {
  const config = options('me', true, async () => ({ data: [], error: null }));
  assert.equal(config.retry(0, { code: '42501' }), false);
  assert.equal(config.retry(0, new Error('offline')), true);
  assert.equal(config.retry(1, new Error('offline')), false);
});

test('follow and unfollow success invalidate the current user directory, activity and discovery', () => {
  for (const following of [true, false]) {
    const client = clientFor(); let mutation;
    const keys = [['berkat', 'following', 'me'], ['berkat', 'activity', 'me'], ['berkat', 'following', 'other'], ['berkat', 'activity', 'other'], ['berkat', 'discovery', 'me', [], true], ['berkat', 'discovery', 'other', [], true]];
    keys.forEach(key => client.setQueryData(key, { existing: true }));
    const exports = load('lib/useFollow.ts', {
      useQueryClient: () => client, useQuery: () => ({ data: false }),
      useMutation: value => { mutation = value; return {}; },
    }, { from: () => { throw new Error('Mutation must never run during this test'); } });
    try {
      exports.useFollow('seller', 'me'); mutation.onSuccess(following);
      assert.equal(client.getQueryState(keys[0]).isInvalidated, true);
      assert.equal(client.getQueryState(keys[1]).isInvalidated, true);
      assert.equal(client.getQueryState(keys[2]).isInvalidated, false);
      assert.equal(client.getQueryState(keys[4]).isInvalidated, true);
      assert.equal(client.getQueryState(keys[5]).isInvalidated, false);
      assert.equal(client.getQueryState(keys[3]).isInvalidated, false);
      assert.equal(client.getQueryData(['berkat', 'follows', 'me', 'seller']), following);
    } finally { client.clear(); }
  }
});
