// Actual hook options with QueryObserver. No backend access.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { QueryClient, QueryObserver } = require('@tanstack/query-core');
const root = path.resolve(__dirname, '../..');
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const plain = value => JSON.parse(JSON.stringify(value));

function options(file, name, args, request = async () => ({ data: [], error: null })) {
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  const code = ts.transpileModule(declaration.getText(source).replace(/^export /, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const configs = [];
  function builder(table) {
    const call = { table, filters: [] };
    const api = { then: (resolve, reject) => request(call).then(resolve, reject) };
    api.abortSignal = value => { call.signal = value; return api; };
    api.retry = value => { call.retry = value; return api; };
    api.maybeSingle = () => ({ then: api.then, retry: value => { call.retry = value; return { then: api.then }; } });
    for (const key of ['select', 'eq', 'in', 'gt', 'order', 'limit']) api[key] = (...values) => { call.filters.push([key, ...values]); return api; };
    return api;
  }
  const context = vm.createContext({ args, __DEV__: false, useQuery: config => { configs.push(config); return {}; },
    supabase: { from: builder, rpc: builder }, shelfQuery: () => builder('live_auctions'), asListings: value => value });
  vm.runInContext(`${code}\n${name}(...args)`, context);
  return configs.map(config => ({ ...config, queryKey: plain(config.queryKey) }));
}

const cases = [
  ['lib/useSellerProfile.ts', 'useSellerProfile', ['seller'], 0],
  ['lib/useSellerProfile.ts', 'useSellerLiveShow', ['seller'], 0],
  ['lib/useSellerProfile.ts', 'useSellerSoldItems', ['seller'], 0],
  ['lib/useSellerReviews.ts', 'useSellerReviews', ['seller'], 0],
  ['lib/useListings.ts', 'useSellerListings', ['seller'], 0],
  ['lib/useSellerShows.ts', 'useSellerShows', ['seller'], 0],
  ['lib/useSellerShows.ts', 'useSellerShows', ['seller'], 1],
];

for (const [file, name, args, index] of cases) {
  test(`${name}[${index}]: failed refresh preserves cache, retry recovers, cancellation reaches HTTP`, async () => {
    let fail = true, last;
    const config = options(file, name, args, async call => { last = call; return fail ? { data: null, error: new Error('offline') } : { data: [], error: null }; })[index];
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const cached = [{ id: 'cached' }];
    client.setQueryData(config.queryKey, cached);
    const observer = new QueryObserver(client, config), stop = observer.subscribe(() => {});
    try {
      await observer.refetch();
      assert.equal(observer.getCurrentResult().isError, true);
      assert.equal(observer.getCurrentResult().data, cached);
      assert.ok(last.signal); assert.equal(last.retry, false);
      fail = false; await observer.refetch(); assert.equal(observer.getCurrentResult().isError, false);
      if (last.table === 'live_sessions' || last.table === 'scheduled_lives') {
        assert.ok(last.filters.some(filter => filter[0] === 'eq' && filter[1] === 'app' && filter[2] === 'berkat'));
      }
    } finally { stop(); client.clear(); }
  });
}

test('show schedule stays available while past shows remain lazy; focus does not change keys', () => {
  const all = options('lib/useSellerShows.ts', 'useSellerShows', ['seller']);
  const scheduleOnly = options('lib/useSellerShows.ts', 'useSellerShows', ['seller', true, false]);
  const hidden = options('lib/useSellerShows.ts', 'useSellerShows', ['seller', false]);
  assert.deepEqual(all.map(x => x.enabled), [true, true]);
  assert.deepEqual(scheduleOnly.map(x => x.enabled), [false, true]);
  assert.deepEqual(hidden.map(x => x.enabled), [false, false]);
  assert.deepEqual(all.map(x => x.queryKey), hidden.map(x => x.queryKey));
});

test('profile request failure differs from missing profile and a switched ID cancels the old request', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  let oldSignal, release;
  const old = options('lib/useSellerProfile.ts', 'useSellerProfile', ['old'], call => {
    oldSignal = call.signal; return new Promise(resolve => { release = resolve; });
  })[0];
  const missing = options('lib/useSellerProfile.ts', 'useSellerProfile', ['missing'], async () => ({ data: null, error: null }))[0];
  const observer = new QueryObserver(client, old), stop = observer.subscribe(() => {});
  try {
    await flush(); observer.setOptions(missing); await flush();
    assert.equal(oldSignal.aborted, true);
    assert.equal(observer.getCurrentResult().isSuccess, true);
    assert.equal(observer.getCurrentResult().data, null);
    release({ data: { id: 'old' }, error: null }); await flush();
    assert.equal(observer.getCurrentResult().data, null);
    const failed = options('lib/useSellerProfile.ts', 'useSellerProfile', ['failed'], async () => ({ data: null, error: new Error('offline') }))[0];
    observer.setOptions(failed); await flush();
    assert.equal(observer.getCurrentResult().isError, true);
    assert.equal(observer.getCurrentResult().data, undefined);
  } finally { stop(); client.clear(); }
});

test('seller schedule loads its real cover with the existing account, app and future boundaries', async () => {
  let call;
  const schedule = options('lib/useSellerShows.ts', 'useSellerShows', ['host'], async request => { call = request; return { data: [{ id: 'plan', cover_url: 'https://example.test/cover.png' }], error: null }; })[1];
  const result = await schedule.queryFn({ signal: new AbortController().signal });
  assert.equal(result[0].cover_url, 'https://example.test/cover.png');
  assert.ok(call.filters.some(f => f[0] === 'select' && f[1].split(', ').includes('cover_url')));
  assert.ok(call.filters.some(f => f[0] === 'eq' && f[1] === 'host_id' && f[2] === 'host'));
  assert.ok(call.filters.some(f => f[0] === 'eq' && f[1] === 'app' && f[2] === 'berkat'));
  assert.ok(call.filters.some(f => f[0] === 'in' && f[1] === 'status' && JSON.stringify(f[2]) === '["scheduled","reminded"]'));
  assert.ok(call.filters.some(f => f[0] === 'gt' && f[1] === 'scheduled_at'));
  assert.ok(call.filters.some(f => f[0] === 'limit' && f[1] === 10));
});
