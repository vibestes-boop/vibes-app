// Actual hook + shared query/mutation cache. Local requests only; no real reminders.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { QueryClient, QueryObserver, MutationObserver, onlineManager } = require('@tanstack/query-core');
const flush = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { resolve, promise }; };
const key = user => ['berkat', 'show-reminders', user];
const source = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../lib/useShowReminders.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function fixture(initial = [], request) {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  const server = new Set(initial ?? []), calls = [], cards = [];
  if (initial !== null) client.setQueryData(key('me'), new Set(initial));
  let active;
  const deps = { react: { useRef: () => active.ref }, './supabase': { supabase: { from(table) {
    const call = { table, filters: [] }; const builder = { then: (resolve, reject) => Promise.resolve().then(async () => {
      calls.push(call); const result = request ? await request(call) : undefined;
      if (result !== undefined) return result;
      if (call.kind === 'select') return { data: [...server].map(schedule_id => ({ schedule_id })), error: null };
      if (call.kind === 'upsert') server.add(call.value.schedule_id);
      else server.delete(call.filters.find(([field]) => field === 'schedule_id')[1]);
      return { error: null };
    }).then(resolve, reject) };
    for (const method of ['select', 'upsert', 'delete', 'eq', 'abortSignal', 'retry']) builder[method] = (...args) => {
      if (['select', 'upsert', 'delete'].includes(method)) { call.kind = method; call.value = args[0]; call.options = args[1]; }
      else if (method === 'eq') call.filters.push(args);
      else call[method] = args[0];
      return builder;
    };
    return builder;
  } } }, '@tanstack/react-query': {
    useQueryClient: () => client,
    useIsMutating: options => client.isMutating(options),
    useMutationState: ({ filters, select }) => client.getMutationCache().findAll(filters).map(select),
    useQuery(config) {
      // Exercise exhausted failure states without timer delays; retain actual config for assertions.
      active.config = config; const options = { ...config, retry: false };
      if (!active.query) { active.query = new QueryObserver(client, options); active.stopQuery = active.query.subscribe(() => {}); }
      else active.query.setOptions(options);
      return active.query.getCurrentResult();
    },
    useMutation(options) {
      if (!active.mutation) { active.mutation = new MutationObserver(client, options); active.stopMutation = active.mutation.subscribe(() => {}); }
      else active.mutation.setOptions(options);
      const observer = active.mutation;
      return { ...observer.getCurrentResult(), mutateAsync: variables => observer.mutate(variables) };
    },
  } };
  const ctx = vm.createContext({ exports: {}, require: name => { assert.ok(name in deps, name); return deps[name]; } });
  vm.runInContext(source, ctx);
  return { client, calls, server, card(scheduleId = 'plan', userId = 'me') {
    const card = { ref: { current: false }, userId, scheduleId,
      render() { active = card; return ctx.exports.useShowReminder(card.scheduleId, card.userId); },
    };
    cards.push(card); card.render(); return card;
  }, stop() { for (const c of cards) { c.stopQuery?.(); c.stopMutation?.(); } client.clear(); } };
}

test('unknown status is loaded once for both cards; tapping cannot create a reminder', async () => {
  const pending = deferred(); const f = fixture(null, () => pending.promise); const a = f.card(), b = f.card();
  try {
    const tap = a.render().flip(); await flush();
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0].kind, 'select'); assert.equal(b.render().busy, true);
    pending.resolve({ data: [{ schedule_id: 'plan' }], error: null }); await tap; await flush();
    assert.equal(a.render().on, true); assert.equal(b.render().label, 'Vorgemerkt');
    assert.equal(f.calls.length, 1); assert.equal(a.config.retry, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0].filters)), [['user_id', 'me']]);
    assert.ok(f.calls[0].abortSignal); assert.equal(f.calls[0].retry, false);
  } finally { f.stop(); }
});

test('read failure is visible; retry only loads and does not silently mark the event', async () => {
  let fail = true; const f = fixture(null, () => fail ? { data: null, error: Error('offline') } : undefined); const a = f.card();
  try {
    await flush(); assert.equal(a.render().label, 'Erneut laden'); assert.match(a.render().error, /geladen/);
    fail = false; await a.render().flip(); await flush();
    assert.equal(a.render().error, null); assert.equal(a.render().on, false);
    assert.deepEqual(f.calls.map(c => c.kind), ['select', 'select']);
  } finally { f.stop(); }
});

for (const initial of [[], ['plan']]) test(`save failure preserves ${initial.length ? 'marked' : 'unmarked'} state on both surfaces and retry recovers`, async () => {
  let fail = true; const f = fixture(initial, c => c.kind !== 'select' && fail ? { error: Error('offline') } : undefined);
  const a = f.card(), b = f.card();
  try {
    await a.render().flip(); await flush();
    assert.equal(a.render().on, Boolean(initial.length)); assert.equal(b.render().on, Boolean(initial.length));
    assert.equal(b.render().label, 'Erneut versuchen'); assert.match(b.render().error, /geändert/);
    fail = false; await b.render().flip(); await flush();
    assert.equal(a.render().on, !initial.length); assert.equal(a.render().error, null);
    const write = f.calls.find(c => c.kind !== 'select');
    if (initial.length) assert.deepEqual(JSON.parse(JSON.stringify(write.filters)), [['schedule_id', 'plan'], ['user_id', 'me']]);
    else { assert.equal(write.value.user_id, 'me'); assert.equal(write.options.ignoreDuplicates, true); }
  } finally { f.stop(); }
});

test('same-frame taps across two cards dispatch only one mutation and share pending state', async () => {
  const pending = deferred(); const f = fixture([], c => c.kind === 'upsert' ? pending.promise : undefined);
  const a = f.card(), b = f.card();
  try {
    const first = a.render().flip(); b.render().flip(); a.render().flip(); await flush();
    assert.equal(f.calls.length, 1); assert.equal(a.render().busy, true); assert.equal(b.render().busy, true);
    f.server.add('plan'); pending.resolve({ error: null }); await first; await flush();
    assert.equal(a.render().on, true); assert.equal(b.render().on, true);
  } finally { f.stop(); }
});

test('confirmed selection is immediately shared while the subsequent refresh is still pending', async () => {
  const refresh = deferred(); const f = fixture([], c => c.kind === 'select' ? refresh.promise : undefined);
  const a = f.card(), b = f.card();
  try {
    await a.render().flip(); await flush();
    assert.equal(a.render().on, true); assert.equal(b.render().label, 'Vorgemerkt'); assert.equal(b.render().busy, false);
    refresh.resolve({ data: [{ schedule_id: 'plan' }], error: null }); await flush();
  } finally { f.stop(); }
});

test('concurrent different event writes merge without losing other confirmed selections', async () => {
  const one = deferred(), two = deferred(), refresh = deferred();
  const f = fixture(['existing'], c => c.kind === 'select' ? refresh.promise : c.value.schedule_id === 'one' ? one.promise : two.promise);
  const a = f.card('one'), b = f.card('two');
  try {
    const first = a.render().flip(), second = b.render().flip(); await flush();
    two.resolve({ error: null }); await second; one.resolve({ error: null }); await first; await flush();
    assert.deepEqual([...f.client.getQueryData(key('me'))].sort(), ['existing', 'one', 'two']);
    refresh.resolve({ data: ['existing', 'one', 'two'].map(schedule_id => ({ schedule_id })), error: null }); await flush();
  } finally { f.stop(); }
});

test('late completion stays bound to its original account and does not invalidate another account', async () => {
  const pending = deferred(); const f = fixture([], c => c.kind === 'upsert' ? pending.promise : undefined); const a = f.card();
  f.client.setQueryData(key('other'), new Set());
  try {
    const tap = a.render().flip(); await flush(); a.userId = 'other'; a.render();
    f.server.add('plan'); pending.resolve({ error: null }); await tap; await flush();
    assert.equal(f.client.getQueryData(key('me')).has('plan'), true);
    assert.equal(f.client.getQueryData(key('other')).has('plan'), false);
    assert.equal(f.client.getQueryState(key('other')).isInvalidated, false);
    assert.equal(a.render().on, false); assert.equal(a.render().error, null);
  } finally { f.stop(); }
});

test('switching accounts cancels an old read and late data cannot select an event in the new account', async () => {
  const pending = deferred(); const f = fixture(null, c => c.filters.some(([field, value]) => field === 'user_id' && value === 'me') ? pending.promise : undefined);
  const a = f.card();
  try {
    await flush(); const old = f.calls[0]; a.userId = 'other'; a.render(); await flush();
    assert.equal(old.abortSignal.aborted, true); pending.resolve({ data: [{ schedule_id: 'plan' }], error: null }); await flush();
    assert.equal(a.render().on, false); assert.equal(f.calls[1].filters[0][1], 'other');
  } finally { f.stop(); }
});

test('offline writes fail visibly rather than waiting to run after reconnect', async () => {
  const f = fixture([], () => ({ error: Error('offline') })); const a = f.card();
  try {
    onlineManager.setOnline(false); await a.render().flip(); await flush();
    assert.equal(f.calls.length, 1); assert.equal(a.render().busy, false); assert.match(a.render().error, /geändert/);
  } finally { onlineManager.setOnline(true); f.stop(); }
});

test('guests do not fetch or mutate reminder data', async () => {
  const f = fixture(null); const guest = f.card('plan', null);
  try { await guest.render().flip(); await flush(); assert.equal(f.calls.length, 0); assert.equal(guest.render().label, 'Erinnern'); }
  finally { f.stop(); }
});
