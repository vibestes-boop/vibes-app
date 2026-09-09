const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { QueryClient, QueryObserver } = require('@tanstack/query-core');
const root = path.resolve(__dirname, '../..');
const plain = value => JSON.parse(JSON.stringify(value));
const flush = async () => { for (let i = 0; i < 70; i++) await Promise.resolve(); };
function load(file, deps = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const ctx = vm.createContext({ exports: {}, AbortController, setTimeout, clearTimeout,
    require: name => deps[name] ?? (name === './discoveryRequest' ? load('lib/discoveryRequest.ts') : {}) });
  vm.runInContext(code, ctx); return ctx.exports;
}
const schedule = load('lib/useSchedule.ts');
const selection = load('lib/showDiscovery.ts', { './useSchedule': schedule });
const now = Date.parse('2026-09-09T12:00:00Z');
const live = (id, host_id = 'host', viewer_count = 10) => ({ id, host_id, viewer_count, category: 'mode', women_only: false });
const plan = (id, hours, host_id = id, title = id) => ({ id, host_id, title, scheduled_at: new Date(now + hours * 3600000).toISOString(), status: 'scheduled', host: null, women_only: false });
const sources = (general = [], interest = [], following = []) => ({ general, interest, following, partial: false });
const ids = result => plain(result.items.map(s => s.next?.id ?? s.id));
const clientFor = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });

test('live selection prefers actual personal matches beyond the popular page, deduplicates and excludes own reasons', () => {
  const popular = Array.from({ length: 60 }, (_, i) => live(`popular-${i}`, 'public', 100));
  const matched = live('matched', 'seller', 1);
  const result = selection.selectLiveShows(sources(popular, [matched, live('own', 'me')], [matched]), 'me');
  assert.equal(result.items.length, 60); assert.equal(result.items[0].id, 'matched');
  assert.equal(result.reasons.matched, 'both'); assert.equal(result.reasons.own, undefined);
  assert.equal(new Set(ids(result)).size, 60);
  assert.deepEqual(ids(selection.selectLiveShows(sources([live('low', 'h', null), live('high', 'h', 20)]), null)), ['high', 'low']);
});

test('nearby dates stay chronological; later relevant shows lead the rest', () => {
  const a = plan('soon', 1), b = plan('follow-soon', 4), c = plan('tomorrow', 24), d = plan('interest', 30), e = plan('follow', 48);
  const result = selection.selectUpcomingShows(sources([c, b, a], [d], [e, b]), 'me', now);
  assert.deepEqual(ids(result), ['soon', 'follow-soon', 'follow', 'interest', 'tomorrow']);
  assert.deepEqual(ids(selection.selectUpcomingShows(sources([d, c, a]), 'me', now)), ['soon', 'tomorrow', 'interest']);
});

test('series collapse by earliest visible occurrence without copying a later interest reason', () => {
  const early = plan('early', 12, 'seller', 'Duftabend'), later = plan('later', 48, 'seller', 'Duftabend');
  const result = selection.selectUpcomingShows(sources([early, later], [later], []), 'me', now);
  assert.deepEqual(ids(result), ['early']); assert.equal(result.items[0].count, 2);
  assert.equal(result.reasons.early, undefined);
});

test('expired, cancelled, live and invalid dates disappear; empty selection and cap remain honest', () => {
  const rows = [plan('old', -1), { ...plan('cancelled', 2), status: 'cancelled' }, { ...plan('live', 2), status: 'live' },
    { ...plan('bad', 2), scheduled_at: 'invalid' }, plan('grace', -0.1)];
  assert.deepEqual(ids(selection.selectUpcomingShows(sources(rows), null, now)), ['grace']);
  assert.deepEqual(ids(selection.selectUpcomingShows(sources(rows), null, now + 3600000)), []);
  assert.equal(selection.selectUpcomingShows(sources(Array.from({ length: 30 }, (_, i) => plan(`plan-${i}`, i + 1))), null, now).items.length, 12);
});

function options(kind, settings, respond) {
  let config;
  const api = { from: table => {
    const call = { table, filters: [], orders: [] };
    const builder = { then: (resolve, reject) => Promise.resolve().then(() => respond(call)).then(resolve, reject) };
    for (const method of ['select', 'limit', 'abortSignal', 'retry']) builder[method] = value => { call[method] = value; return builder; };
    for (const method of ['eq', 'in', 'is', 'gt', 'neq']) builder[method] = (...values) => { call.filters.push([method, ...values]); return builder; };
    builder.order = (...values) => { call.orders.push(values); return builder; }; return builder;
  } };
  const lib = load('lib/useShowDiscovery.ts', {
    react: { useMemo: fn => fn() }, '@tanstack/react-query': { useQuery: value => { config = value; return {}; } },
    './showDiscovery': selection, './useLiveShows': load('lib/useLiveShows.ts', { './supabase': { supabase: api } }),
    './useSchedule': load('lib/useSchedule.ts', { './supabase': { supabase: api } }),
  });
  lib[kind === 'live' ? 'useLiveDiscovery' : 'useUpcomingDiscovery']({ userId: 'me', interests: ['mode'], useFollowing: true, enabled: true, ...settings });
  return { ...config, queryKey: plain(config.queryKey) };
}

for (const kind of ['live', 'upcoming']) test(`${kind}: sources use bounded joins, app/visibility boundaries and direct category filters`, async () => {
  const calls = [], config = options(kind, { categoryFilter: kind === 'live' ? ['mode', 'abaya'] : [] }, call => { calls.push(call); return { data: [], error: null }; });
  await config.queryFn({ signal: new AbortController().signal }); assert.equal(calls.length, 3);
  for (const [index, call] of calls.entries()) {
    assert.ok(call.filters.some(f => f[1] === 'app' && f[2] === 'berkat'));
    assert.equal(call.limit, kind === 'live' && index === 0 ? 60 : 24);
    assert.equal(call.retry, false); assert.equal(call.abortSignal.aborted, false);
    if (index > 0) assert.ok(call.filters.some(f => f[0] === 'neq' && f[1] === 'host_id' && f[2] === 'me'));
    if (kind === 'live') {
      assert.equal(call.table, 'live_sessions');
      assert.ok(call.filters.some(f => f[1] === 'status' && f[2] === 'active'));
      assert.ok(call.filters.some(f => f[0] === 'in' && f[1] === 'category' && f[2].includes('abaya')));
    } else {
      assert.equal(call.table, 'scheduled_lives');
      assert.ok(call.filters.some(f => f[0] === 'in' && f[1] === 'status' && f[2].join(',') === 'scheduled,reminded'));
      assert.ok(call.filters.some(f => f[0] === 'gt' && f[1] === 'scheduled_at'));
    }
  }
  assert.match(calls[2].select, /followers:follows!follows_following_id_fkey!inner/);
  assert.ok(calls[2].filters.some(f => f[1].endsWith('followers.follower_id') && f[2] === 'me'));
  if (kind === 'upcoming') {
    assert.match(calls[1].select, /prepared:live_auctions!planned_for!inner/);
    assert.ok(calls[1].filters.some(f => f[1] === 'prepared.category'));
    assert.ok(calls[1].filters.some(f => f[1] === 'prepared.status' && f[2] === 'scheduled'));
    assert.ok(calls[1].filters.some(f => f[1] === 'prepared.session_id' && f[2] === null));
    assert.ok(calls[1].filters.every(f => f[1] !== 'category'), 'planned shows have no own category column');
  }
});

for (const kind of ['live', 'upcoming']) test(`${kind}: guests and opt-out skip follows; disabled views do not poll`, async () => {
  for (const settings of [{ userId: null }, { useFollowing: false }]) {
    let calls = 0;
    await options(kind, { ...settings, interests: [] }, () => { calls++; return { data: [] }; }).queryFn({ signal: new AbortController().signal });
    assert.equal(calls, 1);
  }
  const client = clientFor(); let calls = 0;
  const config = options(kind, { enabled: false }, () => { calls++; return { data: [] }; });
  assert.equal(config.refetchInterval, kind === 'live' ? 20000 : 60000);
  const observer = new QueryObserver(client, config), stop = observer.subscribe(() => {});
  try { await flush(); assert.equal(calls, 0); } finally { stop(); client.clear(); }
});

test('partial failures preserve successful sources; total failure stays an error and refetch can recover', async () => {
  const config = options('live', {}, call => call.select.includes('followers:') ? { error: Error('offline') } : { data: [live('visible')] });
  const result = await config.queryFn({ signal: new AbortController().signal });
  assert.equal(result.partial, true); assert.equal(result.general[0].id, 'visible'); assert.equal(result.following.length, 0);
  const client = clientFor(); let failed = true;
  const observer = new QueryObserver(client, options('upcoming', {}, () => failed ? { error: Error('offline') } : { data: [] }));
  const stop = observer.subscribe(() => {});
  try { await flush(); assert.equal(observer.getCurrentResult().isError, true); failed = false; await observer.refetch(); assert.equal(observer.getCurrentResult().isSuccess, true); }
  finally { stop(); client.clear(); }
});

test('account changes abort old sources and never retain another account selection', async () => {
  const client = clientFor(); const signals = [];
  const observer = new QueryObserver(client, options('live', {}, call => { signals.push(call.abortSignal); return new Promise(() => {}); }));
  const stop = observer.subscribe(() => {});
  try {
    await flush(); observer.setOptions(options('live', { userId: 'second', interests: [], useFollowing: false }, () => ({ data: [live('second')] })));
    assert.ok(signals.every(signal => signal.aborted)); assert.equal(observer.getCurrentResult().data, undefined);
    await flush(); assert.equal(observer.getCurrentResult().data.general[0].id, 'second');
  } finally { stop(); client.clear(); }
});

test('show invalidation prefixes reach personal sources and keep accounts distinct', () => {
  const client = clientFor();
  const keys = [options('live', {}, () => {}).queryKey, options('upcoming', {}, () => {}).queryKey,
    options('live', { userId: 'other' }, () => {}).queryKey];
  keys.forEach(key => client.setQueryData(key, sources()));
  let mutation;
  const follow = load('lib/useFollow.ts', { '@tanstack/react-query': {
    useQueryClient: () => client, useQuery: () => ({ data: false }), useMutation: config => { mutation = config; return {}; },
  } });
  try {
    follow.useFollow('seller', 'me'); mutation.onSuccess(true);
    assert.equal(client.getQueryState(keys[0]).isInvalidated, true); assert.equal(client.getQueryState(keys[1]).isInvalidated, true);
    assert.equal(client.getQueryState(keys[2]).isInvalidated, false);
    assert.deepEqual(options('live', { interests: ['mode', 'beauty'] }, () => {}).queryKey,
      options('live', { interests: ['beauty', 'mode', 'mode'] }, () => {}).queryKey);
  } finally { client.clear(); }
});

const jsx = (type, props, key) => ({ type, props, key });
function cardModule(owner, reminder = {}) {
  const actions = { profiles: [], routes: [], flips: 0, errors: 0 };
  const module = load('components/UpcomingStrip.tsx', {
    react: { useMemo: fn => fn() }, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Tap', ScrollView: 'Scroll', StyleSheet: { create: value => value },
      useWindowDimensions: () => ({ fontScale: 2.35, width: 390 }), Alert: { alert: () => actions.errors++ } },
    'expo-image': { Image: 'Image' }, 'expo-router': { router: { push: route => actions.routes.push(route) } },
    '../lib/useSchedule': { formatSlot: () => 'Heute, 20:00', formatUntil: () => 'in 2 Std.' },
    '../lib/showDiscovery': selection, '../lib/session': { useSession: read => read({ userId: owner }) },
    '../lib/useShowReminders': { useShowReminder: () => ({ on: false, busy: false, flip: async () => { actions.flips++; if (reminder.fail) throw Error('offline'); }, ...reminder }) },
    '../theme/tokens': { ui: {}, radius: {}, space: {} },
  });
  return { module, actions };
}
test('the reminder is separate from the profile tap; reason and large text remain available', () => {
  const { module, actions } = cardModule('me');
  const reminder = jsx('Reminder', {}), show = plan('show', 2);
  const card = module.UpcomingShowCard({ series: { next: show, count: 1 }, prepared: [], reason: 'following', wide: true,
    onSelect: id => actions.profiles.push(id), reminder });
  assert.equal(card.props.children[1], reminder);
  const open = card.props.children[0]; assert.equal(open.type, 'Tap');
  assert.match(open.props.accessibilityLabel, /Du folgst dem Gastgeber/);
  open.props.onPress(); assert.deepEqual(actions.profiles, ['show']); assert.equal(actions.flips, 0);
});
test('reminders reuse the existing action; guests sign in, own shows hide it, and errors are visible', async () => {
  const show = plan('show', 2, 'host');
  const guest = cardModule(null); guest.module.ReminderBell({ show }).props.onPress();
  assert.deepEqual(guest.actions.routes, ['/login']); assert.equal(guest.actions.flips, 0);
  assert.equal(cardModule('host').module.ReminderBell({ show }), null);
  const failure = cardModule('me', { fail: true }); failure.module.ReminderBell({ show }).props.onPress(); await flush();
  assert.equal(failure.actions.flips, 1); assert.equal(failure.actions.errors, 1); assert.deepEqual(failure.actions.profiles, []);
  const busy = cardModule('me', { busy: true }).module.ReminderBell({ show });
  assert.equal(busy.props.disabled, true); assert.equal(busy.props.accessibilityState.busy, true);
});
