const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { createStore } = require('zustand/vanilla');

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const session = id => id ? { user: { id } } : null;
const profile = id => ({ id, username: id, avatar_url: null, women_only_verified: false });

function setup() {
  const initial = deferred(), requests = [], timers = new Map();
  let subscriber, effect, nextTimer = 0, unsubscribed = false;
  const source = fs.readFileSync(path.resolve(__dirname, '../../lib/session.ts'), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const supabase = {
    auth: {
      getSession: () => initial.promise,
      onAuthStateChange(fn) {
        subscriber = fn;
        return { data: { subscription: { unsubscribe() { unsubscribed = true; } } } };
      },
    },
    from(table) {
      assert.equal(table, 'profiles');
      const pending = deferred(), request = { ...pending, userId: null, signal: null };
      const query = {
        select() { return query; },
        eq(column, value) { assert.equal(column, 'id'); request.userId = value; return query; },
        abortSignal(signal) { request.signal = signal; return query; },
        maybeSingle() { requests.push(request); return pending.promise; },
      };
      return query;
    },
  };
  const context = vm.createContext({
    exports: {}, __DEV__: false, AbortController, console,
    setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    require(name) {
      if (name === 'react') return { useEffect(fn) { effect = fn; } };
      if (name === 'zustand') return { create(init) {
        const store = createStore(init), hook = selector => selector(store.getState());
        return Object.assign(hook, store);
      } };
      if (name === './supabase') return { supabase };
      throw Error(`Unexpected dependency: ${name}`);
    },
  });
  vm.runInContext(code, context);
  context.exports.useSessionBootstrap();
  const cleanup = effect();
  return {
    initial, requests, state: () => context.exports.useSession.getState(),
    emit(event, id) { return subscriber(event, session(id)); },
    async tick() {
      await flush();
      for (const [id, fn] of [...timers]) { timers.delete(id); fn(); }
      await flush();
    },
    cleanup, unsubscribed: () => unsubscribed,
  };
}

test('known session becomes usable while its profile request is still pending', async () => {
  const h = setup();
  h.initial.resolve({ data: { session: session('alice') } });
  await h.tick();
  assert.equal(h.state().userId, 'alice');
  assert.equal(h.state().loading, false, 'auth readiness must not await profile network response');
  assert.equal(h.state().profile, null);
  assert.equal(h.requests.length, 1);
  h.cleanup();
});

test('initial auth event and getSession share one profile request; callback returns synchronously', async () => {
  const h = setup();
  assert.equal(h.emit('INITIAL_SESSION', 'alice'), undefined);
  h.initial.resolve({ data: { session: session('alice') } });
  await h.tick();
  assert.equal(h.requests.length, 1);
  h.requests[0].resolve({ data: profile('alice'), error: null });
  await h.tick();
  assert.equal(h.state().profile.id, 'alice');
  h.emit('TOKEN_REFRESHED', 'alice'); await h.tick();
  assert.equal(h.requests.length, 1, 'token refresh must not reload unchanged profile');
  h.cleanup();
});

test('sign-out cancels profile work and ignores a late successful response', async () => {
  const h = setup();
  h.initial.resolve({ data: { session: session('alice') } }); await h.tick();
  const old = h.requests[0];
  h.emit('SIGNED_OUT', null); await h.tick();
  old.resolve({ data: profile('alice'), error: null }); await h.tick();
  assert.equal(h.state().userId, null);
  assert.equal(h.state().profile, null);
  assert.equal(old.signal?.aborted, true);
  h.cleanup();
});

test('a newer sign-in wins over an older getSession snapshot', async () => {
  const h = setup();
  h.emit('SIGNED_IN', 'bob'); await h.tick();
  h.initial.resolve({ data: { session: session('alice') } }); await h.tick();
  assert.equal(h.state().userId, 'bob');
  assert.deepEqual(h.requests.map(r => r.userId), ['bob']);
  h.cleanup();
});

test('switching accounts cannot publish an earlier account profile', async () => {
  const h = setup();
  h.initial.resolve({ data: { session: session('alice') } }); await h.tick();
  h.emit('SIGNED_IN', 'bob'); await h.tick();
  h.requests[1].resolve({ data: profile('bob'), error: null }); await h.tick();
  h.requests[0].resolve({ data: profile('alice'), error: null }); await h.tick();
  assert.equal(h.state().profile.id, 'bob');
  h.cleanup();
});

test('unmount aborts in-flight work and ignores late profile results', async () => {
  const h = setup();
  h.initial.resolve({ data: { session: session('alice') } }); await h.tick();
  const before = h.state(); h.cleanup();
  h.requests[0].resolve({ data: profile('alice'), error: null }); await h.tick();
  assert.equal(h.state(), before);
  assert.equal(h.requests[0].signal?.aborted, true);
  assert.equal(h.unsubscribed(), true);
});

test('profile failure leaves auth ready and a later sign-in event can retry', async () => {
  const h = setup();
  h.emit('INITIAL_SESSION', 'alice'); await h.tick();
  h.emit('SIGNED_IN', 'alice'); await h.tick();
  assert.equal(h.requests.length, 1, 'sign-in shares the pending initial request');
  h.requests[0].reject(Error('offline')); await h.tick();
  assert.equal(h.state().loading, false);
  assert.equal(h.state().userId, 'alice');
  assert.equal(h.state().profile, null);
  h.emit('SIGNED_IN', 'alice'); await h.tick();
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve({ data: profile('alice'), error: null }); await h.tick();
  assert.equal(h.state().profile.id, 'alice');
  h.cleanup();
});

test('profile update replaces a pending response without clearing the displayed profile', async () => {
  const h = setup();
  h.emit('INITIAL_SESSION', 'alice'); await h.tick();
  h.requests[0].resolve({ data: profile('alice'), error: null }); await h.tick();
  h.emit('SIGNED_IN', 'alice'); await h.tick();
  h.emit('USER_UPDATED', 'alice'); await h.tick();
  assert.equal(h.requests[1].signal.aborted, true);
  assert.equal(h.state().profile.username, 'alice');
  h.requests[2].resolve({ data: { ...profile('alice'), username: 'New name' }, error: null });
  await h.tick();
  h.requests[1].resolve({ data: profile('alice'), error: null }); await h.tick();
  assert.equal(h.state().profile.username, 'New name');
  h.cleanup();
});

test('sign-out or unmount before the deferred fetch prevents any profile request', async () => {
  for (const stop of ['sign-out', 'unmount']) {
    const h = setup(); h.emit('INITIAL_SESSION', 'alice');
    if (stop === 'sign-out') h.emit('SIGNED_OUT', null); else h.cleanup();
    await h.tick();
    assert.equal(h.requests.length, 0);
    if (stop === 'sign-out') h.cleanup();
  }
});

test('a failed initial session read ends loading but cannot overwrite a newer auth event', async () => {
  const guest = setup(); guest.initial.reject(Error('storage unavailable')); await guest.tick();
  assert.equal(guest.state().loading, false);
  assert.equal(guest.state().userId, null); guest.cleanup();
  const signedIn = setup(); signedIn.emit('SIGNED_IN', 'alice');
  signedIn.initial.reject(Error('old snapshot failed')); await signedIn.tick();
  assert.equal(signedIn.state().userId, 'alice'); signedIn.cleanup();
});
