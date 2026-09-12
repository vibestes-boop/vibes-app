// Real query/mutation observers around the app hook. All requests are local fakes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const { QueryClient, QueryObserver, MutationObserver } = require('@tanstack/query-core');
const flush = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { resolve, promise }; };
const key = (user = 'me', target = 'seller') => ['berkat', 'follows', user, target];
const plain = x => JSON.parse(JSON.stringify(x));
const source = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../lib/useFollow.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function fixture(request, initial = false) {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  if (initial !== undefined && initial !== null) client.setQueryData(key(), initial);
  let query, mutation, stopQuery, stopMutation, user = 'me', target = 'seller';
  const calls = [], ref = { current: false };
  const api = { from(table) {
    const call = { table, filters: [] }; calls.push(call);
    const builder = { then: (resolve, reject) => Promise.resolve().then(() => request(call)).then(resolve, reject) };
    for (const method of ['select', 'insert', 'delete', 'eq', 'abortSignal', 'retry']) builder[method] = (...args) => {
      if (['select', 'insert', 'delete'].includes(method)) { call.kind = method; call.value = args[0]; }
      else if (method === 'eq') call.filters.push(args);
      else call[method] = args[0];
      return builder;
    };
    return builder;
  } };
  const deps = { react: { useRef: () => ref }, './supabase': { supabase: api }, '@tanstack/react-query': {
    useQueryClient: () => client,
    useQuery(options) {
      if (!query) { query = new QueryObserver(client, options); stopQuery = query.subscribe(() => {}); }
      else query.setOptions(options);
      return query.getCurrentResult();
    },
    useMutation(options) {
      if (!mutation) { mutation = new MutationObserver(client, options); stopMutation = mutation.subscribe(() => {}); }
      else mutation.setOptions(options);
      return { ...mutation.getCurrentResult(), mutateAsync: vars => mutation.mutate(vars) };
    },
  } };
  const ctx = vm.createContext({ exports: {}, require: name => { assert.ok(name in deps, name); return deps[name]; } });
  vm.runInContext(source, ctx);
  const f = { client, calls, render: () => ctx.exports.useFollow(target, user),
    switchTo: (nextUser, nextTarget) => { user = nextUser; target = nextTarget; return f.render(); },
    stop: () => { stopQuery?.(); stopMutation?.(); client.clear(); },
  };
  f.render(); return f;
}

test('unknown status cannot issue a follow; read completes before an explicit second tap', async () => {
  const pending = deferred(); const f = fixture(c => c.kind === 'select' ? pending.promise : { error: null }, null);
  try {
    assert.equal(f.render().busy, true); const tap = f.render().toggle(); await flush();
    assert.equal(f.calls.filter(c => c.kind === 'insert').length, 0);
    pending.resolve({ count: 1, error: null }); await tap; await flush();
    assert.equal(f.render().label, 'Du folgst'); assert.equal(f.render().busy, false);
    assert.deepEqual(plain(f.calls[0].filters), [['follower_id', 'me'], ['following_id', 'seller']]);
    assert.equal(f.calls[0].retry, false); assert.ok(f.calls[0].abortSignal);
  } finally { f.stop(); }
});

test('failed initial state offers a read retry without creating a relationship', async () => {
  const f = fixture(() => ({ count: 0, error: null }), null);
  try {
    await flush();
    // Force the exhausted query-error state without waiting for retry timers.
    f.client.getQueryCache().find({ queryKey: key() }).setState({ data: undefined, status: 'error', error: Error('offline'), fetchStatus: 'idle' });
    const before = f.calls.length; const action = f.render();
    assert.match(action.error, /geladen/); assert.equal(action.label, 'Erneut laden');
    await action.toggle(); await flush();
    assert.equal(f.calls.length, before + 1); assert.equal(f.calls.at(-1).kind, 'select');
    assert.equal(f.render().error, null); assert.equal(f.render().label, 'Folgen');
  } finally { f.stop(); }
});

for (const initial of [false, true]) test(`save failure preserves ${initial ? 'followed' : 'unfollowed'} state and retry succeeds`, async () => {
  let fails = true; const f = fixture(() => fails ? { error: { code: 'offline' } } : { error: null }, initial);
  try {
    await f.render().toggle(); await flush();
    assert.equal(f.client.getQueryData(key()), initial); assert.match(f.render().error, /gespeichert/);
    assert.equal(f.render().label, 'Erneut versuchen'); assert.equal(f.render().busy, false);
    fails = false; await f.render().toggle(); await flush();
    assert.equal(f.client.getQueryData(key()), !initial); assert.equal(f.render().error, null);
    assert.deepEqual(f.calls.map(c => c.kind), [initial ? 'delete' : 'insert', initial ? 'delete' : 'insert']);
    if (initial) assert.deepEqual(plain(f.calls[0].filters), [['follower_id', 'me'], ['following_id', 'seller']]);
    else assert.deepEqual(plain(f.calls[0].value), { follower_id: 'me', following_id: 'seller' });
  } finally { f.stop(); }
});

test('same-frame taps share a lock and show pending until the server confirms', async () => {
  const pending = deferred(); const f = fixture(() => pending.promise);
  try {
    const action = f.render(); const first = action.toggle(); action.toggle(); action.toggle(); await flush();
    assert.equal(f.calls.length, 1); assert.equal(f.render().busy, true);
    assert.equal(f.client.getQueryData(key()), false);
    pending.resolve({ error: null }); await first; await flush();
    assert.equal(f.render().busy, false); assert.equal(f.render().label, 'Du folgst');
  } finally { f.stop(); }
});

test('late success updates only the originating account/profile after navigation', async () => {
  const pending = deferred(); const f = fixture(() => pending.promise);
  f.client.setQueryData(key('other', 'next'), false);
  try {
    const first = f.render().toggle(); await flush(); f.switchTo('other', 'next');
    pending.resolve({ error: null }); await first; await flush();
    assert.equal(f.client.getQueryData(key()), true); assert.equal(f.client.getQueryData(key('other', 'next')), false);
    assert.equal(f.render().isFollowing, false); assert.equal(f.render().error, null);
  } finally { f.stop(); }
});

test('late failure does not appear on a different profile', async () => {
  const pending = deferred(); const f = fixture(() => pending.promise);
  f.client.setQueryData(key('me', 'next'), false);
  try {
    const first = f.render().toggle(); await flush(); f.switchTo('me', 'next');
    pending.resolve({ error: { code: 'offline' } }); await first; await flush();
    assert.equal(f.render().error, null); assert.equal(f.render().label, 'Folgen');
  } finally { f.stop(); }
});

for (const code of ['23505', '42501']) test(`only unique-constraint ${code} counts as an already existing follow`, async () => {
  const f = fixture(() => ({ error: { code, message: 'duplicate wording is not proof of success' } }));
  try { await f.render().toggle(); await flush(); assert.equal(f.render().isFollowing, code === '23505'); }
  finally { f.stop(); }
});

test('guests and self profiles cannot dispatch writes through the hook', async () => {
  const f = fixture(() => { throw new Error('No request expected'); });
  try {
    await f.switchTo(null, 'seller').toggle(); await f.switchTo('me', 'me').toggle();
    assert.equal(f.calls.length, 0); assert.equal(f.render().canFollow, false);
  } finally { f.stop(); }
});

test('a refresh racing a successful write is cancelled before it can restore the old state', async () => {
  const write = deferred(), refresh = deferred(); const f = fixture(() => write.promise); let signal;
  try {
    const tap = f.render().toggle(); await flush();
    const oldRead = f.client.fetchQuery({ queryKey: key(), queryFn: ctx => { signal = ctx.signal; return refresh.promise; } }).catch(() => {});
    await flush(); write.resolve({ error: null }); await tap;
    assert.equal(signal.aborted, true); refresh.resolve(false); await oldRead; await flush();
    assert.equal(f.client.getQueryData(key()), true);
  } finally { f.stop(); }
});
