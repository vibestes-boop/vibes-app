// Run from apps/berkat: node --test scripts/tests/query-focus.cjs
// Uses the real hook options and QueryObserver, with an isolated clock and no API calls.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { QueryClient, QueryObserver, timeoutManager, environmentManager, focusManager } = require('@tanstack/query-core');
const root = path.resolve(__dirname, '../..');

const cases = [
  ['lib/useMyBids.ts', 'useMyBids', ['user']],
  ['lib/useActivity.ts', 'useActivity', ['user']],
  ['lib/useStudio.ts', 'useMyActiveShow', ['user']],
  ['lib/useOffers.ts', 'useOpenOfferCount', ['user']],
  ['lib/useOffers.ts', 'useMyOpenOffers', ['user']],
  ['lib/useSellerOrders.ts', 'useOpenOrderCount', ['user']],
  ['lib/useNotifications.ts', 'useUnreadCount', ['user']],
  ['lib/useDirectMessages.ts', 'useUnreadMessageCount', ['user']],
  ['lib/useCategories.ts', 'useCategories', []],
  ['lib/useAuction.ts', 'useShowPreviews', [['show'], () => 0]],
  ['lib/useMyOrders.ts', 'useMyOrders', ['user']],
  ['lib/useRewards.ts', 'useMyRewards', ['user']],
  ['lib/useLiveShows.ts', 'useLiveShows', []],
  ['lib/useSellerProfile.ts', 'useSellerProfile', ['seller']],
  ['lib/useSellerProfile.ts', 'useSellerLiveShow', ['seller']],
  ['lib/useSellerProfile.ts', 'useSellerSoldItems', ['seller']],
  ['lib/useSellerReviews.ts', 'useSellerReviews', ['seller', 20]],
  ['lib/useListings.ts', 'useSellerListings', ['seller']],
  ['lib/usePrepared.ts', 'usePreparedByPlan', [['plan']]],
  ['lib/useListings.ts', 'useCategoryListings', [['mode']]],
  ['app/(tabs)/account.tsx', 'useLiveSellers', [['seller']]],
  ['app/(tabs)/account.tsx', 'useMyCarts', ['user']],
];

function optionsFor(file, name, args, enabled) {
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  assert.ok(declaration, name);
  const code = ts.transpileModule(declaration.getText(source).replace(/^export /, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  let options;
  const context = vm.createContext({
    args: enabled === undefined ? args : [...args, enabled],
    useMemo: fn => fn(),
    keepPreviousData: data => data,
    EMPTY_PREVIEWS: {},
    useQuery: value => { options = value; return { data: undefined }; },
  });
  vm.runInContext(`${code}\n${name}(...args);`, context);
  assert.ok(options, name);
  // Normalize arrays from the VM; do not run its network query function.
  return { ...options, queryKey: JSON.parse(JSON.stringify(options.queryKey)) };
}

let now = 1_000_000;
let nextId = 0;
const timers = new Map();
const schedule = (fn, ms, repeat) => { const id = ++nextId; timers.set(id, { fn, at: now + ms, repeat }); return id; };
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
async function advance(ms) {
  const end = now + ms;
  while (true) {
    const due = [...timers.entries()].filter(([,t]) => t.at <= end).sort((a,b) => a[1].at - b[1].at)[0];
    if (!due) break;
    const [id,timer] = due; now = timer.at;
    if (timer.repeat) timer.at += timer.repeat; else timers.delete(id);
    timer.fn(); await flush();
  }
  now = end; await flush();
}

// Single parent test keeps global clock changes strictly sequential and restores them.
test('screen query focus lifecycle', async t => {
  const realNow = Date.now;
  Date.now = () => now;
  environmentManager.setIsServer(() => false);
  timeoutManager.setTimeoutProvider({
    setTimeout: (fn, ms) => schedule(fn, ms, 0), clearTimeout: id => timers.delete(id),
    setInterval: (fn, ms) => schedule(fn, ms, ms), clearInterval: id => timers.delete(id),
  });
  focusManager.setFocused(true);
  try {
    for (const [file,name,args] of cases) {
      await t.test(`${name}: pauses, preserves cache, resumes once`, async () => {
        const on = optionsFor(file, name, args, true);
        const off = optionsFor(file, name, args, false);
        assert.equal(on.enabled, true);
        assert.equal(off.enabled, false);
        assert.deepEqual(off.queryKey, on.queryKey, 'focus must not create a new cache key');
        if (file.startsWith('lib/')) {
          assert.equal(optionsFor(file, name, args).enabled, true, 'existing callers keep their default');
        }
        let calls = 0;
        let release;
        const queryFn = () => { calls++; return new Promise(resolve => { release = resolve; }); };
        const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
        const active = { ...on, queryFn };
        const hidden = { ...off, queryFn };
        const observer = new QueryObserver(client, hidden);
        const unsubscribe = observer.subscribe(() => {});
        assert.equal(calls, 0, 'hidden mount must not fetch');
        observer.setOptions(active); await flush();
        assert.equal(calls, 1);
        release('cached'); await flush();
        observer.setOptions(hidden);
        await advance(120_000);
        assert.equal(calls, 1, 'hidden observer must not poll');
        assert.equal(observer.getCurrentResult().data, 'cached');
        observer.setOptions(active); await flush();
        const focusRefresh = observer.refetch({ cancelRefetch: false });
        await flush();
        assert.equal(calls, 2, 'focus refresh must share in-flight request');
        release('fresh'); await focusRefresh; await flush();
        assert.equal(observer.getCurrentResult().data, 'fresh');
        if (on.refetchInterval) {
          await advance(on.refetchInterval);
          assert.equal(calls, 3, 'visible polling must resume');
          release('polled'); await flush();
          focusManager.setFocused(false);
          await advance(on.refetchInterval * 2);
          assert.equal(calls, 3, 'app background must not poll');
          focusManager.setFocused(true);
        }
        unsubscribe(); client.clear();
      });
    }
    await t.test('hidden subscriber keeps receiving shared badge updates', async () => {
      const active = optionsFor('lib/useSellerOrders.ts', 'useOpenOrderCount', ['user'], true);
      const hidden = optionsFor('lib/useSellerOrders.ts', 'useOpenOrderCount', ['user'], false);
      let calls = 0;
      const queryFn = async () => ++calls;
      const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
      const badge = new QueryObserver(client, { ...active, queryFn });
      const screen = new QueryObserver(client, { ...hidden, queryFn });
      const a = badge.subscribe(() => {}), b = screen.subscribe(() => {});
      await flush(); assert.equal(calls, 1); assert.equal(screen.getCurrentResult().data, 1);
      await advance(active.refetchInterval); assert.equal(calls, 2); assert.equal(screen.getCurrentResult().data, 2);
      a(); b(); client.clear();
    });
  } finally {
    timers.clear(); Date.now = realNow; focusManager.setFocused(undefined);
    environmentManager.setIsServer(() => true);
  }
});
