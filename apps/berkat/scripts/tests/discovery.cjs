// Recommendation behavior, real query observers and account-bound storage; no backend writes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { QueryClient, QueryObserver, MutationObserver } = require('@tanstack/query-core');
const root = path.resolve(__dirname, '../..');
const plain = value => JSON.parse(JSON.stringify(value));
const flush = async () => { for (let i = 0; i < 50; i++) await Promise.resolve(); };
function load(file, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const context = vm.createContext({ exports: {}, AbortController, setTimeout, clearTimeout, require: name => dependencies[name] ?? {} });
  vm.runInContext(code, context);
  return context.exports;
}
const logic = load('lib/discovery.ts');
const listing = (id, seller = 'seller', category = 'mode', date = '2026-09-01') => ({
  id, seller_id: seller, category, created_at: date, status: 'listed', show: null,
});
const ids = result => plain(result.items.map(item => item.id));

test('general discovery stays chronological, deduplicated and bounded without false personal labels', () => {
  const recent = [listing('old'), listing('new', 's', 'mode', '2026-09-09'), listing('old')];
  const result = logic.selectDiscovery(recent, [], [], 'me');
  assert.deepEqual(ids(result), ['new', 'old']);
  assert.deepEqual(plain(result.reasons), {});
  assert.equal(logic.selectDiscovery(recent, [], [], null, 1).items.length, 1);
  assert.deepEqual(ids(logic.selectDiscovery([], [], [], null)), []);
});

test('older followed and interest matches lead, with a new find in the third slot', () => {
  const result = logic.selectDiscovery(
    [listing('new', 'third', 'books', '2026-09-09')],
    [listing('interest', 'second', 'mode', '2026-07-01')],
    [listing('followed', 'first', 'books', '2026-06-01')], 'me',
  );
  assert.deepEqual(ids(result), ['followed', 'interest', 'new']);
  assert.deepEqual(plain(result.reasons), { followed: 'following', interest: 'interest' });
});

test('overlapping sources never duplicate a card and explain both signals', () => {
  const shared = listing('both');
  const result = logic.selectDiscovery([shared, listing('new', 'other')], [shared], [shared], 'me');
  assert.deepEqual(ids(result), ['both', 'new']);
  assert.equal(result.reasons.both, 'both');
});

test('own listings are not personal recommendations; diversity does not hide a lone seller', () => {
  const result = logic.selectDiscovery([listing('own', 'me')], [listing('own', 'me')], [], 'me');
  assert.deepEqual(plain(result.reasons), {});
  const pool = [listing('a', 's', 'mode', '2026-09-09'), listing('b', 's'), listing('c', 'other')];
  assert.deepEqual(ids(logic.selectDiscovery([], pool, [], null)), ['a', 'c', 'b']);
  assert.equal(logic.selectDiscovery([], Array.from({ length: 12 }, (_, i) => listing(String(i))), [], null).items.length, 8);
});

test('selected parents include active children; unknown and removed categories do not become filters', () => {
  assert.deepEqual(plain(logic.expandInterests(['mode', 'removed', 'mode'], [
    { slug: 'mode', children: [{ slug: 'abaya' }, { slug: 'kleider' }] }, { slug: 'books', children: [] },
  ])), ['abaya', 'kleider', 'mode']);
});

test('storage defaults, explicit empty selection, corruption and size bounds', () => {
  assert.deepEqual(plain(logic.decodePreferences(null)), { categorySlugs: [], useFollowing: true });
  assert.deepEqual(plain(logic.decodePreferences('{"version":1,"categorySlugs":[],"useFollowing":false}')),
    { categorySlugs: [], useFollowing: false });
  for (const raw of ['oops', '{}', 'null', '{"version":2,"categorySlugs":[],"useFollowing":true}']) {
    assert.throws(() => logic.decodePreferences(raw));
  }
  const normalized = logic.normalizePreferences({ categorySlugs: ['mode', 'mode', 'wrong.slug', 42, ...Array.from({ length: 99 }, (_, i) => `category-${i}`)], useFollowing: true });
  assert.equal(normalized.categorySlugs.length, 24);
  assert.ok(Buffer.byteLength(JSON.stringify({ version: 1, ...normalized })) < 1800);
});

function queryOptions(userId, interests, follow, enabled, request) {
  let options;
  const api = { from: table => {
    const call = { table, filters: [], orders: [] };
    const builder = { then: (resolve, reject) => Promise.resolve().then(() => request(call)).then(resolve, reject) };
    for (const name of ['select', 'limit', 'abortSignal', 'retry']) builder[name] = value => { call[name] = value; return builder; };
    for (const name of ['is', 'or', 'eq', 'neq', 'in']) builder[name] = (...values) => { call.filters.push([name, ...values]); return builder; };
    builder.order = (...values) => { call.orders.push(values); return builder; };
    return builder;
  } };
  const listings = load('lib/useListings.ts', { './supabase': { supabase: api } });
  load('lib/useDiscoveryListings.ts', {
    '@tanstack/react-query': { useQuery: config => { options = config; return {}; } },
    './useListings': listings, './discovery': logic,
  }).useDiscoveryListings(userId, interests, follow, enabled);
  return { ...options, queryKey: plain(options.queryKey) };
}
const clientFor = () => new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });

test('bounded sources preserve browse/RLS boundaries, nested follow filter, own exclusion and abort signal', async () => {
  const calls = [], signal = new AbortController().signal;
  const config = queryOptions('me', ['mode'], true, true, call => {
    calls.push(call);
    return { data: [listing('hidden-show', 'other'), { ...listing('invisible'), status: 'scheduled', show: null }], error: null };
  });
  const result = await config.queryFn({ signal });
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.equal(call.table, 'live_auctions');
    assert.equal(call.limit, 16);
    assert.equal(call.abortSignal.aborted, false);
    assert.equal(call.retry, false);
    assert.ok(call.filters.some(f => f[0] === 'is' && f[1] === 'session_id' && f[2] === null));
    assert.ok(call.filters.some(f => f[0] === 'or' && f[1] === 'and(status.eq.listed,buy_now_cents.not.is.null),status.eq.scheduled'));
    assert.deepEqual(plain(call.orders), [['created_at', { ascending: false }], ['id', { ascending: false }]]);
  }
  assert.match(calls[2].select, /seller:profiles!live_auctions_seller_id_fkey!inner\(followers:follows!follows_following_id_fkey!inner/);
  assert.ok(calls[2].filters.some(f => f[1] === 'seller.followers.follower_id' && f[2] === 'me'));
  assert.ok(calls[1].filters.some(f => f[0] === 'in' && f[1] === 'category'));
  for (const call of calls.slice(1)) assert.ok(call.filters.some(f => f[0] === 'neq' && f[1] === 'seller_id' && f[2] === 'me'));
  assert.ok(!result.items.some(item => item.id === 'invisible'));
});

test('guest and following opt-out skip the follow request; hidden discovery makes no request', async () => {
  for (const [owner, follow] of [[null, true], ['me', false]]) {
    let calls = 0;
    await queryOptions(owner, [], follow, true, () => { calls++; return { data: [], error: null }; }).queryFn({ signal: new AbortController().signal });
    assert.equal(calls, 1);
  }
  const client = clientFor(); let calls = 0;
  const observer = new QueryObserver(client, queryOptions('me', [], true, false, () => { calls++; return { data: [] }; }));
  const stop = observer.subscribe(() => {});
  try { await flush(); assert.equal(calls, 0); } finally { stop(); client.clear(); }
});

test('source failures preserve useful results with a notice; total failure and cancellation stay errors', async () => {
  const config = queryOptions('me', ['mode'], true, true, call => call.filters.some(f => f[0] === 'in')
    ? { data: [listing('match')], error: null } : { data: null, error: new Error('offline') });
  const result = await config.queryFn({ signal: new AbortController().signal });
  assert.deepEqual(ids(result), ['match']); assert.equal(result.partial, true);
  const failed = queryOptions(null, [], false, true, () => ({ data: null, error: new Error('offline') }));
  await assert.rejects(failed.queryFn({ signal: new AbortController().signal }), /offline/);
  const aborted = new AbortController(); aborted.abort();
  await assert.rejects(config.queryFn({ signal: aborted.signal }), /aborted/);
});

test('a stalled source times out and cancels its request; parent cancellation also settles promptly', async () => {
  const { withDiscoveryDeadline } = load('lib/useDiscoveryListings.ts');
  let requestSignal;
  await assert.rejects(withDiscoveryDeadline(new AbortController().signal, signal => {
    requestSignal = signal; return new Promise(() => {});
  }, 1), /timeout/);
  assert.equal(requestSignal.aborted, true);
  const parent = new AbortController();
  const pending = withDiscoveryDeadline(parent.signal, signal => { requestSignal = signal; return new Promise(() => {}); });
  parent.abort(); await assert.rejects(pending, /aborted/);
  assert.equal(requestSignal.aborted, true);
});

test('discovery account switch cancels old work and never displays the previous account result', async () => {
  const client = clientFor(); let oldSignal, resolveOld;
  const old = queryOptions('first', ['mode'], false, true, call => { oldSignal = call.abortSignal; return new Promise(resolve => { resolveOld = resolve; }); });
  const next = queryOptions('second', [], false, true, () => ({ data: [listing('second')], error: null }));
  const observer = new QueryObserver(client, old), stop = observer.subscribe(() => {});
  try {
    await flush(); observer.setOptions(next);
    assert.equal(oldSignal.aborted, true);
    assert.equal(observer.getCurrentResult().data, undefined);
    resolveOld({ data: [listing('first')], error: null }); await flush();
    assert.deepEqual(ids(observer.getCurrentResult().data), ['second']);
    assert.notDeepEqual(old.queryKey, next.queryKey);
  } finally { stop(); client.clear(); }
});

function storageHooks(client, storage) {
  let queryOptions, mutationOptions;
  const hooks = load('lib/useDiscoveryPreferences.ts', {
    'react-native': { Platform: { OS: 'ios' } }, 'expo-secure-store': storage,
    './discovery': logic, '@tanstack/react-query': {
      useQuery: config => { queryOptions = config; }, useMutation: config => { mutationOptions = config; }, useQueryClient: () => client,
    },
  });
  return {
    ...hooks,
    read: (owner, enabled = true) => { hooks.useDiscoveryPreferences(owner, enabled); return { ...queryOptions, queryKey: plain(queryOptions.queryKey) }; },
    write: owner => { hooks.useSaveDiscoveryPreferences(owner); return mutationOptions; },
  };
}

test('preferences separate guest/accounts, persist before cache update and survive reread', async () => {
  const client = clientFor(), memory = new Map();
  const hooks = storageHooks(client, { getItemAsync: async key => memory.get(key) ?? null, setItemAsync: async (key, raw) => memory.set(key, raw) });
  try {
    const a = hooks.read('first'), b = hooks.read('second'), guest = hooks.read(null);
    assert.notDeepEqual(a.queryKey, b.queryKey); assert.notDeepEqual(a.queryKey, guest.queryKey);
    const mutation = new MutationObserver(client, hooks.write('first'));
    await mutation.mutate({ owner: 'first', preferences: { categorySlugs: ['mode'], useFollowing: false } });
    assert.deepEqual(plain(client.getQueryData(a.queryKey)), { categorySlugs: ['mode'], useFollowing: false });
    assert.equal(client.getQueryData(b.queryKey), undefined);
    client.removeQueries({ queryKey: a.queryKey });
    assert.deepEqual(plain(await client.fetchQuery(a)), { categorySlugs: ['mode'], useFollowing: false });
    assert.deepEqual(plain(await client.fetchQuery(guest)), { categorySlugs: [], useFollowing: true });
  } finally { client.clear(); }
});

test('failed preference write retains previous cache and invalidation uses the write owner after account switch', async () => {
  const client = clientFor(); let fail = true, finish;
  const hooks = storageHooks(client, { setItemAsync: async () => { if (fail) throw Error('locked'); await new Promise(resolve => { finish = resolve; }); } });
  const previous = { categorySlugs: ['mode'], useFollowing: true };
  client.setQueryData(hooks.preferenceKey('first'), previous);
  const mutation = new MutationObserver(client, hooks.write('first'));
  try {
    const variables = { owner: 'first', preferences: { categorySlugs: ['beauty'], useFollowing: false } };
    await assert.rejects(mutation.mutate(variables), /locked/);
    assert.deepEqual(client.getQueryData(hooks.preferenceKey('first')), previous);
    fail = false; const pending = mutation.mutate(variables); await flush();
    mutation.setOptions(hooks.write('second')); finish(); await pending;
    assert.deepEqual(plain(client.getQueryData(hooks.preferenceKey('first'))), variables.preferences);
    assert.equal(client.getQueryData(hooks.preferenceKey('second')), undefined);
  } finally { client.clear(); }
});

test('slow preference read cannot overwrite a successful save', async () => {
  const client = clientFor(); let finish;
  const hooks = storageHooks(client, { getItemAsync: () => new Promise(resolve => { finish = resolve; }), setItemAsync: async () => {} });
  const observer = new QueryObserver(client, hooks.read('first')), stop = observer.subscribe(() => {});
  try {
    await flush();
    await new MutationObserver(client, hooks.write('first')).mutate({ owner: 'first', preferences: { categorySlugs: ['mode'], useFollowing: true } });
    finish(null); await flush();
    assert.deepEqual(plain(observer.getCurrentResult().data), { categorySlugs: ['mode'], useFollowing: true });
  } finally { stop(); client.clear(); }
});

function editorFixture() {
  let cursor = 0, fontScale = 1, focusedCleanup, writes = [], backs = 0, complete;
  const slots = [], jsx = (type, props, key) => ({ type, props, key });
  const find = (v, type) => !v ? [] : Array.isArray(v) ? v.flatMap(n => find(n, type))
    : [...(v.type === type ? [v] : []), ...find(v.props?.children, type)];
  const session = { userId: 'me', loading: false };
  const useSession = selector => selector(session); useSession.getState = () => session;
  const react = {
    useCallback: fn => fn,
    useRef: value => { const i = cursor++; return slots[i] ??= { current: value }; },
    useState: value => { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], next => { slots[i] = next; }]; },
  };
  const save = { isPending: false, isError: false, reset() {}, mutateAsync: variables => {
    writes.push(plain(variables)); save.isPending = true;
    return new Promise(resolve => { complete = () => { save.isPending = false; resolve(); }; });
  } };
  const lib = load('app/interests.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Tap', ScrollView: 'Scroll', Switch: 'Switch',
      ActivityIndicator: 'Spinner', StyleSheet: { create: value => value }, useWindowDimensions: () => ({ fontScale }) },
    'expo-router': { useRouter: () => ({ back: () => backs++ }), useFocusEffect: fn => { if (!focusedCleanup) focusedCleanup = fn(); } },
    'expo-image': { Image: 'Image' }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
    '../lib/session': { useSession }, '../lib/discovery': logic,
    '../lib/useDiscoveryPreferences': { useDiscoveryPreferences: () => ({ data: logic.DEFAULT_DISCOVERY }), useSaveDiscoveryPreferences: () => save },
    '../lib/useCategories': { useCategoryOptions: () => ({ groups: [{ slug: 'mode', name: 'Mode' }, { slug: 'beauty', name: 'Beauty' }] }) },
    '../theme/categoryArt': { categoryArt: () => ({ photo: 'photo' }) }, '../theme/tokens': { ui: {}, radius: {}, space: {} },
  });
  let tree;
  return {
    render() { cursor = 0; const screen = lib.default(); tree = screen.type(screen.props); return tree; },
    tap(label) { const node = find(tree, 'Tap').find(n => n.props.accessibilityLabel === label || find(n, 'Text').some(t => t.props.children === label)); assert.ok(node, label); node.props.onPress(); },
    checked: label => find(tree, 'Tap').find(n => n.props.accessibilityLabel === label)?.props.accessibilityState.checked,
    setFont: value => { fontScale = value; }, writes: () => writes, backs: () => backs,
    complete: () => complete(), blur: () => focusedCleanup(),
  };
}

test('interest draft survives font changes, is explicitly saved, and cancel makes no write', () => {
  const editor = editorFixture(); editor.render(); editor.tap('Mode'); editor.setFont(2.35); editor.render();
  assert.equal(editor.checked('Mode'), true); assert.deepEqual(editor.writes(), []);
  editor.tap('Zurück'); assert.deepEqual(editor.writes(), []); assert.equal(editor.backs(), 1);
});

test('finishing a save after back or loss of focus never pops another screen', async () => {
  for (const leave of ['back', 'blur']) {
    const editor = editorFixture(); editor.render(); editor.tap('Mode'); editor.render(); editor.tap('Auswahl speichern');
    assert.deepEqual(editor.writes(), [{ owner: 'me', preferences: { categorySlugs: ['mode'], useFollowing: true } }]);
    if (leave === 'back') editor.tap('Zurück'); else editor.blur();
    editor.complete(); await flush();
    assert.equal(editor.backs(), leave === 'back' ? 1 : 0);
  }
});

test('shelf changes, show moves and seller changes invalidate discovery without discarding its preview', () => {
  for (const source of ['shelf', 'show', 'seller']) {
    const client = clientFor(), key = ['berkat', 'discovery', 'me', ['mode'], true];
    const cached = { items: [listing('before')], reasons: { before: 'interest' }, partial: false };
    client.setQueryData(key, cached);
    const deps = { react: { useCallback: fn => fn }, '@tanstack/react-query': {
      useQueryClient: () => client, useMutation: options => options,
    } };
    try {
      if (source === 'shelf') load('lib/useStanding.ts', deps).invalidateShelfSurfaces(client);
      if (source === 'show') load('lib/useShelfBridge.ts', deps).useShelfBridge().invalidate();
      if (source === 'seller') load('lib/useBerkatSeller.ts', deps).useDeclareSellerKind('me').onSuccess();
      assert.equal(client.getQueryState(key).isInvalidated, true);
      assert.deepEqual(client.getQueryData(key), cached);
    } finally { client.clear(); }
  }
});
