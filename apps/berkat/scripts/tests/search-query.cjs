// Run from apps/berkat: node --test scripts/tests/search-query.cjs
// Real hook options + QueryObserver; no backend access.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { QueryClient, QueryObserver } = require('@tanstack/query-core');
const root = path.resolve(__dirname, '../..');

function hook(name, query, settled, enabled = true, snapshot = {}, request = () => Promise.resolve({ data: [], error: null })) {
  const file = name === 'useSellerSearch' ? 'lib/useSellerSearch.ts' : 'lib/useListings.ts';
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  const code = ts.transpileModule(declaration.getText(source).replace(/^export /, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  let options;
  function builder() {
    let signal, retries;
    const api = { abortSignal: value => { signal = value; return api; }, then: (resolve, reject) => request(signal, retries).then(resolve, reject) };
    api.retry = value => { retries = value; return api; };
    for (const method of ['ilike', 'order', 'limit']) api[method] = () => api;
    return api;
  }
  const context = vm.createContext({
    query, enabled, useDebounced: () => settled, SEARCH_MIN: 2,
    useQuery: value => { options = value; return snapshot; },
    supabase: { rpc: builder }, browseQuery: builder, asListings: data => data, withVisibleShow: data => data,
  });
  const result = vm.runInContext(`${code}\n${name}(query, enabled)`, context);
  return { result, options: { ...options, queryKey: JSON.parse(JSON.stringify(options.queryKey)) } };
}
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

for (const name of ['useSellerSearch', 'useListingSearch']) {
  test(`${name}: only settled, sufficiently long, visible searches run`, () => {
    assert.equal(hook(name, 'a', 'a').options.enabled, false);
    assert.equal(hook(name, '   ', '').options.enabled, false);
    assert.equal(hook(name, 'neu', 'alt').options.enabled, false);
    assert.equal(hook(name, 'neu', 'neu', false).options.enabled, false);
    assert.equal(hook(name, ' neu ', 'neu').options.enabled, true);
    assert.deepEqual(hook(name, 'neu', 'neu', false).options.queryKey, hook(name, 'neu', 'neu').options.queryKey);
  });
  test(`${name}: edits hide old data/errors during debounce`, () => {
    const rows = [{ id: 'old' }], error = new Error('old failure');
    const pending = hook(name, 'new', 'old', true, { data: rows, error }).result;
    assert.equal(pending.isDebouncing, true);
    assert.equal(pending.data, undefined);
    assert.equal(pending.error, null);
    const settled = hook(name, 'old', 'old', true, { data: rows, error }).result;
    assert.equal(settled.data, rows);
    assert.equal(settled.error, error);
  });
  test(`${name}: replaced request is aborted and late old reply cannot replace new results`, async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    let releaseOld, oldSignal;
    const old = hook(name, 'old', 'old', true, {}, (signal, retries) => {
      assert.equal(retries, false, 'only Query controls automatic retries');
      oldSignal = signal;
      return new Promise(resolve => { releaseOld = resolve; });
    }).options;
    const next = hook(name, 'new', 'new', true, {}, () => Promise.resolve({ data: [{ id: 'new' }], error: null })).options;
    const observer = new QueryObserver(client, { ...old, retry: false });
    const unsubscribe = observer.subscribe(() => {});
    try {
      await flush();
      observer.setOptions({ ...next, retry: false });
      await flush();
      assert.equal(oldSignal.aborted, true, 'Supabase must receive cancellation');
      assert.equal(observer.getCurrentResult().data[0].id, 'new');
      releaseOld({ data: [{ id: 'old' }], error: null });
      await flush();
      assert.equal(observer.getCurrentResult().data[0].id, 'new');
    } finally { unsubscribe(); client.clear(); }
  });
  test(`${name}: failed refresh retains same-query cache and reports error`, async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const { options } = hook(name, 'term', 'term', true, {}, () => Promise.resolve({ data: null, error: new Error('offline') }));
    client.setQueryData(options.queryKey, [{ id: 'cached' }]);
    const observer = new QueryObserver(client, { ...options, retry: false });
    const unsubscribe = observer.subscribe(() => {});
    try {
      await observer.refetch();
      const result = observer.getCurrentResult();
      assert.equal(result.data[0].id, 'cached');
      assert.equal(result.isError, true);
    } finally { unsubscribe(); client.clear(); }
  });
}

test('seller permission failures do not trigger an automatic retry', () => {
  const { options } = hook('useSellerSearch', 'name', 'name');
  assert.equal(options.retry(0, { code: '42501' }), false);
  assert.equal(options.retry(0, new Error('offline')), true);
  assert.equal(options.retry(1, new Error('offline')), false);
});
