const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const { QueryClient, QueryObserver } = require('@tanstack/query-core');
const root = path.resolve(__dirname, '../..');
const plain = value => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(resolve => setImmediate(resolve));
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const context = vm.createContext({ exports: {}, require: name => mocks[name] ?? {}, Date, Error, __DEV__: false });
  vm.runInContext(code, context); return context.exports;
}
function apiFixture(reply) {
  const calls = [];
  return { calls, api: { from(table) {
    const query = { table, filters: [] }, builder = { then(ok, fail) { calls.push(query); return Promise.resolve().then(() => reply(query)).then(ok, fail); } };
    for (const method of ['select', 'order', 'limit', 'retry', 'abortSignal']) builder[method] = (...args) => { query[method] = args.length === 1 ? args[0] : args; return builder; };
    builder.eq = (...args) => { query.filters.push(args); return builder; };
    builder.maybeSingle = () => builder;
    return builder;
  } } };
}
const row = (id, second = 0) => ({ id: String(id), user_id: 'viewer', text: `Comment ${id}`, created_at: new Date(2026, 8, 13, 0, 0, second).toISOString() });
function queryFixture(file, hook, args, reply) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const api = apiFixture(reply), effects = [], subscriptions = [];
  let options;
  const module = load(file, {
    react: { useMemo: fn => fn(), useEffect: fn => effects.push(fn) },
    '@tanstack/react-query': { useQuery: next => { options = next; return {}; }, useQueryClient: () => client },
    './supabase': { supabase: api.api },
    './realtime': { subscribeToTable: (...values) => { subscriptions.push(values); return () => {}; } },
  });
  module[hook](...args); effects.forEach(fn => fn());
  const observer = new QueryObserver(client, { ...options, queryKey: plain(options.queryKey), retry: false });
  const off = observer.subscribe(() => {});
  return { ...api, client, options, observer, subscriptions, dispose() { off(); client.clear(); } };
}
for (const outcome of ['failed', 'missing', 'ended']) test(`live session preserves ${outcome} as a distinct outcome`, async () => {
  const f = queryFixture('lib/useLiveSession.ts', 'useLiveSession', ['show', 'buyer'], () => outcome === 'failed' ? { error: Error('offline') } : { data: outcome === 'missing' ? null : { id: 'show', status: 'ended' } });
  try { await flush(); const q = f.observer.getCurrentResult(); assert.equal(q.isError, outcome === 'failed'); if (outcome !== 'failed') assert.equal(q.data?.status ?? null, outcome === 'ended' ? 'ended' : null); assert.deepEqual(plain(f.options.queryKey), ['berkat', 'session', 'show', 'buyer']); assert.ok(f.calls[0].abortSignal); } finally { f.dispose(); }
});
test('failed session refresh keeps previously confirmed data and a retry can recover', async () => {
  let failed = false;
  const f = queryFixture('lib/useLiveSession.ts', 'useLiveSession', ['show', 'buyer'], () => failed ? { error: Error('offline') } : { data: { id: 'show', status: 'active' } });
  try { await flush(); failed = true; await f.observer.refetch(); assert.equal(f.observer.getCurrentResult().isError, true); assert.equal(f.observer.getCurrentResult().data.status, 'active'); failed = false; await f.observer.refetch(); assert.equal(f.observer.getCurrentResult().isError, false); } finally { f.dispose(); }
});
test('hidden live room stops polling and leaving aborts its pending request', async () => {
  const hidden = queryFixture('lib/useLiveSession.ts', 'useLiveSession', ['show', 'buyer', false], () => assert.fail('hidden request'));
  try { await flush(); assert.equal(hidden.options.refetchInterval, false); assert.equal(hidden.calls.length, 0); } finally { hidden.dispose(); }
  let finish;
  const active = queryFixture('lib/useLiveSession.ts', 'useLiveSession', ['show', 'buyer'], () => new Promise(resolve => { finish = resolve; }));
  await flush(); active.observer.destroy(); assert.equal(active.calls[0].abortSignal.aborted, true); finish({ data: null }); active.dispose();
});
test('a late chat history response preserves concurrent realtime comments and deduplicates the same row', async () => {
  let finish;
  const f = queryFixture('lib/useLiveChat.ts', 'useLiveChat', ['show', 'buyer'], () => new Promise(resolve => { finish = resolve; }));
  try {
    await flush(); f.subscriptions[0][2]({ new: row('new', 2) }); finish({ data: [row('new', 2), row('old', 1)] }); await flush();
    assert.deepEqual(plain(f.observer.getCurrentResult().data).map(r => r.id), ['old', 'new']);
    assert.deepEqual(plain(f.options.queryKey), ['berkat', 'live-chat', 'show', 'buyer']); assert.equal(f.subscriptions[0][1].filter, 'session_id=eq.show');
  } finally { f.dispose(); }
});
test('chat merging is chronological and bounded to the latest 40 unique messages', () => {
  const { mergeLiveComments } = load('lib/useLiveChat.ts');
  const result = mergeLiveComments(Array.from({ length: 55 }, (_, i) => row(i, i)), [row(54, 54)]);
  assert.equal(result.length, 40); assert.equal(result[0].id, '15'); assert.equal(result[39].id, '54');
});
test('a chat read error remains an error instead of an empty successful conversation', async () => {
  const f = queryFixture('lib/useLiveChat.ts', 'useLiveChat', ['show', 'buyer'], () => ({ error: Error('offline') }));
  try { await flush(); assert.equal(f.observer.getCurrentResult().isError, true); assert.equal(f.observer.getCurrentResult().data, undefined); } finally { f.dispose(); }
});
test('hidden chat does not fetch or subscribe', async () => {
  const f = queryFixture('lib/useLiveChat.ts', 'useLiveChat', ['show', 'buyer', false], () => assert.fail('unexpected read'));
  try { await flush(); assert.equal(f.calls.length, 0); assert.equal(f.subscriptions.length, 0); } finally { f.dispose(); }
});
function draftFixture(send) {
  const slots = []; let cursor = 0;
  const react = { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => slots[i] = typeof value === 'function' ? value(slots[i]) : value]; }, useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; }, useCallback: fn => fn };
  const { useLiveChatDraft } = load('lib/useLiveChatDraft.ts', { react });
  return () => { cursor = 0; return useLiveChatDraft(send); };
}
for (const result of ['success', 'failure', 'throw']) test(`pending ${result} never overwrites later typing`, async () => {
  let resolve, reject, calls = 0;
  const render = draftFixture(() => { calls++; return new Promise((ok, fail) => { resolve = ok; reject = fail; }); });
  render().setDraft('Original'); const pending = render().submit(); await render().submit(); assert.equal(calls, 1); assert.equal(render().busy, true);
  render().setDraft('Edited while sending'); result === 'throw' ? reject(Error('offline')) : resolve(result === 'success'); await pending;
  assert.equal(render().draft, 'Edited while sending'); assert.equal(render().busy, false); assert.equal(Boolean(render().error), result !== 'success');
});
test('only confirmed success clears an untouched live draft; blank drafts are ignored', async () => {
  let ok = false, calls = 0; const render = draftFixture(async () => { calls++; return ok; });
  await render().submit(); assert.equal(calls, 0); render().setDraft('Question'); await render().submit(); assert.equal(render().draft, 'Question');
  ok = true; await render().submit(); assert.equal(render().draft, ''); assert.equal(render().error, null);
});
function accessFixture(body, error = false) {
  let options; const calls = [];
  const { useLiveAccess } = load('lib/useLiveVideo.ts', { '@tanstack/react-query': { useQuery: next => { options = next; return {}; } }, './session': { useSession: fn => fn({ userId: 'viewer' }) }, './supabase': { supabase: { functions: { invoke: async (...args) => { calls.push(args); return error ? { error: { context: { clone: () => ({ json: async () => body }) } } } : { data: body }; } } } } });
  useLiveAccess('room', false, true); return { options, calls };
}
for (const reason of ['women_only', 'followers_only']) test(`video access reads ${reason} from an HTTP Response body`, async () => {
  const f = accessFixture({ error: reason }, true); await assert.rejects(f.options.queryFn(), new RegExp(reason));
});
test('live access tokens are account scoped and ordinary failure makes no promise about audio', async () => {
  const f = accessFixture({ token: 'local-token', url: 'local-url' }); await f.options.queryFn(); assert.deepEqual(plain(f.options.queryKey), ['berkat', 'live-access', 'room', false, 'viewer']);
  const { liveAccessErrorText } = load('lib/useLiveVideo.ts'); assert.doesNotMatch(liveAccessErrorText('unavailable'), /Ton.*weiter/);
});
function miniFixture(reply) {
  const api = apiFixture(reply); let options, closes = 0; const effects = [];
  const state = { session: { id: 'show' }, minimized: true, close: () => closes++, restore() {} };
  const store = fn => fn(state); store.getState = () => state;
  const jsx = (type, props) => ({ type, props });
  const rn = new Proxy({ StyleSheet: { create: x => x } }, { get: (o, k) => o[k] ?? k });
  const module = load('components/MiniLivePlayer.tsx', { react: { useEffect: fn => effects.push(fn) }, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': rn, 'expo-router': { useRouter: () => ({}) }, '@tanstack/react-query': { useQuery: next => { options = next; return { data: undefined }; } }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) }, '../lib/livePlayer': { useLivePlayer: store }, '../lib/session': { useSession: fn => fn({ userId: 'viewer' }) }, '../lib/supabase': { supabase: api.api }, '../theme/tokens': { stage: {}, radius: {}, space: {} } });
  module.MiniLivePlayer(); effects.forEach(fn => fn()); return { ...api, options, closes: () => closes };
}
test('mini-player status propagates network failure instead of reporting an ended show', async () => {
  const f = miniFixture(() => ({ error: Error('offline') })); await assert.rejects(f.options.queryFn({ signal: new AbortController().signal }), /offline/); assert.equal(f.closes(), 0);
});
for (const status of ['active', 'ended']) test(`mini-player recognizes confirmed ${status} status`, async () => {
  const f = miniFixture(() => ({ data: { status } })); assert.equal(await f.options.queryFn({ signal: new AbortController().signal }), status === 'active');
});
test('stage renders only the named host camera, never an unrelated participant', () => {
  let tracks = [{ participant: { identity: 'other' } }]; const jsx = (type, props) => ({ type, props });
  const { StageVideo } = load('components/LiveStage.tsx', { '@livekit/react-native': { useTracks: () => tracks, VideoTrack: 'VideoTrack' }, 'livekit-client': { Track: { Source: { Camera: 'camera' } } }, 'react/jsx-runtime': { jsx } });
  assert.equal(StageVideo({ hostIdentity: 'host', style: {} }), null); const obs = { participant: { identity: 'host-host' } }; tracks.push(obs); assert.equal(StageVideo({ hostIdentity: 'host', style: {} }).props.trackRef, obs); tracks = [tracks[0]]; tracks.push({ participant: { identity: 'host' } }); assert.equal(StageVideo({ hostIdentity: 'host', style: {} }).props.trackRef, tracks[1]);
});

function sliderFixture() {
  const slots = [], pendingEffects = []; let cursor = 0, confirmations = 0, animations = 0, reduced = false, fontScale = 1;
  const equal = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => slots[i] = value]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useMemo(fn, deps) { const i = cursor++; if (!slots[i] || !equal(slots[i].deps, deps)) slots[i] = { deps, value: fn() }; return slots[i].value; },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || !equal(slots[i], deps)) { slots[i] = deps; pendingEffects.push(fn); } },
  };
  let responder;
  const native = { StyleSheet: { create: x => x }, useWindowDimensions: () => ({ fontScale }), View: 'View', Text: 'Text', PanResponder: { create: config => { responder = config; return { panHandlers: config }; } }, Animated: { View: 'AnimatedView', Value: class { setValue() {} }, spring: () => ({ start() { animations++; } }), timing: () => ({ start(done) { animations++; done?.(); } }) } };
  const jsx = (type, props, key) => ({ type, props, key });
  const { SlideToBid } = load('components/BidButton.tsx', { react, 'react-native': native, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'expo-haptics': { notificationAsync: async () => {}, NotificationFeedbackType: { Success: 'success' } }, '../lib/useReducedMotion': { useReducedMotion: () => reduced }, '../theme/tokens': { stage: {}, radius: {}, space: {} } });
  let props = { confirmationKey: 'article:1600', label: 'Gebot: 16 €', tone: 'gold', busy: false, onConfirm: () => confirmations++ };
  const render = changes => { props = { ...props, ...changes }; cursor = 0; const tree = SlideToBid(props); pendingEffects.splice(0).forEach(fn => fn()); return tree; };
  render().props.onLayout({ nativeEvent: { layout: { width: 300 } } }); render();
  return { render, pan: () => responder, count: () => confirmations, animations: () => animations, reduce: () => { reduced = true; render(); }, font: () => { fontScale = 1.8; return render(); } };
}
function drag(f, distance) { f.pan().onPanResponderGrant(); f.pan().onPanResponderMove(null, { dx: distance }); }
test('bid slider ignores taps, vertical gestures, short drags and cancelled gestures', () => {
  const f = sliderFixture(); assert.equal(f.pan().onMoveShouldSetPanResponder(null, { dx: 0, dy: 0 }), false); assert.equal(f.pan().onMoveShouldSetPanResponder(null, { dx: 10, dy: 60 }), false);
  drag(f, 50); f.pan().onPanResponderRelease(); drag(f, 220); f.pan().onPanResponderTerminate(); f.pan().onPanResponderRelease(); assert.equal(f.count(), 0);
});
test('a deliberate complete drag submits once even if release is delivered twice', () => {
  const f = sliderFixture(); drag(f, 220); f.pan().onPanResponderRelease(); f.pan().onPanResponderRelease(); assert.equal(f.count(), 1);
});
for (const change of ['price', 'article', 'busy', 'rotation']) test(`a mid-drag ${change} change cannot submit the old gesture`, () => {
  const f = sliderFixture(); drag(f, 220);
  if (change === 'price') f.render({ confirmationKey: 'article:1700' });
  if (change === 'article') f.render({ confirmationKey: 'other:1600' });
  if (change === 'busy') f.render({ busy: true });
  if (change === 'rotation') { f.render().props.onLayout({ nativeEvent: { layout: { width: 350 } } }); f.render(); }
  f.pan().onPanResponderRelease(); assert.equal(f.count(), 0);
});
test('reduced motion skips slider settle animations while preserving deliberate confirmation', () => {
  const f = sliderFixture(); f.reduce(); drag(f, 20); f.pan().onPanResponderRelease(); drag(f, 220); f.pan().onPanResponderRelease(); assert.equal(f.animations(), 0); assert.equal(f.count(), 1);
});
test('a font change updates the label without remounting or submitting the slider', () => {
  const f = sliderFixture(); drag(f, 220); const tree = f.font(); assert.equal(tree.key, undefined); assert.equal(f.count(), 0); f.pan().onPanResponderRelease(); assert.equal(f.count(), 1);
});
test('a busy cycle invalidates an already started bid gesture', () => {
  const f = sliderFixture(); drag(f, 220); f.render({ busy: true }); f.render({ busy: false });
  f.pan().onPanResponderRelease(); assert.equal(f.count(), 0);
});
test('a viewer becoming host must explicitly start publishing; ordinary refresh preserves the player', () => {
  const { useLivePlayer } = load('lib/livePlayer.ts', { zustand: require('zustand') });
  const info = { id: 'show', roomName: 'room', hostId: 'host', isHost: false, title: 'Show', thumbnailUrl: null };
  useLivePlayer.getState().open(info); assert.equal(useLivePlayer.getState().connected, true);
  useLivePlayer.getState().open({ ...info, isHost: true }); assert.equal(useLivePlayer.getState().connected, false);
  useLivePlayer.getState().goLive(); useLivePlayer.getState().minimize();
  useLivePlayer.getState().open({ ...info, isHost: true, title: 'Updated title' });
  assert.equal(useLivePlayer.getState().connected, true); assert.equal(useLivePlayer.getState().minimized, true);
  useLivePlayer.getState().restore(); assert.equal(useLivePlayer.getState().minimized, false);
  useLivePlayer.getState().close(); assert.equal(useLivePlayer.getState().connected, false);
});
function chatGestureFixture({ hidden = false, reduced = false } = {}) {
  let responder, target = 0, animations = 0;
  const changes = [], effects = [];
  const jsx = (type, props) => ({ type, props });
  const { LiveChatPanel } = load('components/LiveChatPanel.tsx', {
    react: { useRef: value => ({ current: value }), useMemo: fn => fn(), useCallback: fn => fn, useEffect: fn => effects.push(fn) },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { StyleSheet: { create: x => x }, useWindowDimensions: () => ({ width: 390, fontScale: 1 }), Keyboard: { dismiss() {} },
      PanResponder: { create: value => { responder = value; return { panHandlers: value }; } },
      Animated: { View: 'AnimatedView', Value: class { setValue(value) { target = value; } stopAnimation() {} }, spring: (_x, options) => ({ start() { animations++; target = options.toValue; } }) } },
    '../lib/useReducedMotion': { useReducedMotion: () => reduced },
    '../theme/tokens': { stage: {}, radius: {}, space: { lg: 16 } },
  });
  const tree = LiveChatPanel({ comments: [], profiles: {}, hidden, onHiddenChange: value => changes.push(value), inputRef: { current: null }, draft: 'Unsent draft', onChangeText() {}, onSend() { assert.fail('gesture must never send'); }, sending: false, sendDisabled: false });
  effects.forEach(fn => fn());
  return { responder, changes, tree, target: () => target, animations: () => animations };
}
test('chat swipe leaves vertical reading alone and only a deliberate left swipe hides comments', () => {
  const f = chatGestureFixture(); const capture = f.responder.onMoveShouldSetPanResponderCapture;
  assert.equal(capture(null, { dx: -8, dy: 0 }), false);
  assert.equal(capture(null, { dx: -20, dy: 80 }), false);
  assert.equal(capture(null, { dx: 90, dy: 0 }), false);
  assert.equal(capture(null, { dx: -90, dy: 2 }), true);
  f.responder.onPanResponderRelease(null, { dx: -35 }); assert.equal(f.changes.length, 0);
  f.responder.onPanResponderMove(null, { dx: -100 }); f.responder.onPanResponderTerminate();
  assert.equal(f.target(), 0); assert.equal(f.changes.length, 0);
  f.responder.onPanResponderRelease(null, { dx: -100 }); assert.deepEqual(f.changes, [true]);
});
test('hidden chat is absent from accessibility and reduced motion skips offscreen animation', () => {
  const f = chatGestureFixture({ hidden: true, reduced: true });
  const column = f.tree.props.children[0];
  assert.equal(column.props.accessibilityElementsHidden, true); assert.equal(column.props.pointerEvents, 'none');
  assert.equal(f.responder.onMoveShouldSetPanResponderCapture(null, { dx: -100, dy: 0 }), false);
  assert.equal(f.target(), -406); assert.equal(f.animations(), 0);
});
