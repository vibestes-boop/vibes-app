const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const { QueryClient, QueryObserver } = require('@tanstack/query-core');
const root = path.resolve(__dirname, '../..');
const flush = () => new Promise(resolve => setImmediate(resolve));
const plain = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; };
function load(file, mocks = {}, clock = Date) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const context = vm.createContext({ exports: {}, Error, Date: clock, require: name => mocks[name] ?? {} });
  vm.runInContext(code, context); return context.exports;
}
// Event/state/effect harness. All mutations and camera tracks below are local doubles;
// native typography, keyboard and rendering are checked separately in Simulator.
function hooks() {
  const slots = [], effects = []; let cursor = 0;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => slots[i] = typeof value === 'function' ? value(slots[i]) : value]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useCallback: fn => fn, useMemo: fn => fn(),
    useEffect(fn, deps) { const i = cursor++; const old = slots[i]; if (!old || !deps?.every((value, index) => Object.is(value, old.deps[index]))) {
      effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
    } },
  };
  return { react, render(fn) { cursor = 0; const result = fn(); effects.splice(0).forEach(fn => fn()); return result; }, unmount() { slots.forEach(slot => slot?.cleanup?.()); } };
}
function draftFixture() { const h = hooks(); const { useSellerDraft } = load('lib/useSellerDraft.ts', { react: h.react }); return () => h.render(() => useSellerDraft({ title: '', image: null })); }
test('seller draft preserves title and cover on failure, clears only on confirmed success', async () => {
  const render = draftFixture(); render().setField('title', 'Mein Abend'); render().setField('image', 'local-cover');
  await render().submit(async () => { throw Error('offline'); }, () => 'Erneut prüfen');
  assert.deepEqual(plain(render().draft), { title: 'Mein Abend', image: 'local-cover' }); assert.equal(render().error, 'Erneut prüfen');
  await render().submit(async () => {}, () => 'error'); assert.deepEqual(plain(render().draft), { title: '', image: null }); assert.equal(render().error, null);
});
for (const success of [true, false]) test(`a late ${success ? 'success' : 'failure'} preserves later seller edits and ignores a double tap`, async () => {
  const render = draftFixture(), d = deferred(); let calls = 0;
  render().setField('title', 'First'); const before = render(); const save = () => { calls++; return d.promise; };
  const pending = before.submit(save, () => 'error'); await before.submit(save, () => 'error'); assert.equal(calls, 1); assert.equal(render().busy, true);
  render().setField('title', 'Later'); success ? d.resolve() : d.reject(Error('offline')); await pending;
  assert.equal(render().draft.title, 'Later'); assert.equal(render().busy, false);
});
const jsx = (type, props, key) => ({ type, props, key });
const find = (node, type) => !node ? [] : Array.isArray(node) ? node.flatMap(n => find(n, type)) : [...(node.type === type ? [node] : []), ...find(node.props?.children, type)];
function formFixture(kind) {
  // These cases test async saving. Keep today's default slot in the future,
  // independently of the test runner's current time or timezone.
  class FormClock extends Date {
    constructor(...args) { super(...(args.length ? args : [2026, 8, 19, 12, 0, 0, 0])); }
    static now() { return new Date(2026, 8, 19, 12).getTime(); }
  }
  const h = hooks(), pending = deferred(), upload = deferred(); let calls = 0, uploads = 0, retry = 0;
  const rn = new Proxy({ useWindowDimensions: () => ({ fontScale: 1.8 }), StyleSheet: { create: x => x }, Platform: { OS: 'ios' } }, { get: (obj, key) => obj[key] ?? key });
  const hooksModule = load('lib/useSellerDraft.ts', { react: h.react });
  const studio = load('lib/useStudio.ts', {}, FormClock);
  const props = { plan: { id: 'plan', title: 'Abend', scheduled_at: '2026-09-15T18:00:00Z' }, plans: [], items: [], busy: false, notice: null, userId: 'seller', onClose() {}, onCancel() {},
    onRetry() { retry++; }, onPlan() { calls++; return pending.promise; }, onPrepare() { calls++; return pending.promise; } };
  const component = load(`components/${kind}.tsx`, { react: h.react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': rn,
    '../lib/useSellerDraft': hooksModule, '../lib/useStudio': studio, '../lib/useReducedMotion': { useReducedMotion: () => false }, '../lib/keyboardKit': {},
    // `FormInput` ist seit dem 21.09.2026 das gemeinsame Feld (weiss, Haarlinie,
    // Fokus-Rahmen). Als Attrappe traegt es denselben Knotentyp wie ein nacktes
    // `TextInput` — so pruefen die bestehenden Zusicherungen weiter das
    // Verhalten und nicht die Verpackung.
    './FormInput': { FormInput: 'TextInput' },
    '../components/FormInput': { FormInput: 'TextInput' },
    '../../components/FormInput': { FormInput: 'TextInput' },
    '../lib/useSchedule': { formatSlot: x => x, MAX_WEEKS: 4, scheduleErrorText: () => 'Nicht bestätigt' }, '../lib/usePrepared': { prepareErrorText: () => 'Nicht bestätigt' },
    '../lib/useListings': { tidySize: x => x || null }, '../lib/usePrebid': { usePrebidCounts: () => ({}) }, '../lib/useReminders': { useReminderCounts: () => ({}) },
    '../lib/uploadImage': { pickAndUpload: () => { uploads++; return upload.promise; } }, './PressFeedback': { PressFeedback: 'Button' }, './ActionButton': { ActionButton: 'Action' }, './FeedbackState': { FeedbackState: 'Feedback' }, '../theme/tokens': { ui: {}, radius: {}, space: {} },
  }, FormClock)[kind === 'PrepareSheet' ? 'PrepareSheetForm' : kind];
  const render = changes => { Object.assign(props, changes); return h.render(() => component(props)); };
  const submit = tree => kind === 'PrepareSheet' ? find(tree, 'Action')[0] : find(tree, 'Button').find(n => n.props.accessibilityLabel === 'Termin eintragen');
  return { render, submit, pending, upload, calls: () => calls, uploads: () => uploads, retries: () => retry };
}
for (const kind of ['PrepareSheet', 'SchedulePlanner']) {
  test(`${kind} actual submit keeps input and shows a local error until confirmed`, async () => {
    const f = formFixture(kind); find(f.render(), 'TextInput')[0].props.onChangeText('Mein Abend');
    const button = f.submit(f.render()); button.props.onPress(); button.props.onPress(); assert.equal(f.calls(), 1);
    assert.equal(find(f.render(), 'TextInput')[0].props.value, 'Mein Abend'); assert.equal(f.submit(f.render()).props.disabled, true);
    f.pending.reject(Error('offline')); await flush();
    assert.equal(find(f.render(), 'TextInput')[0].props.value, 'Mein Abend'); assert.equal(find(f.render(), 'Feedback').at(-1).props.body, 'Nicht bestätigt');
  });
  test(`${kind} confirmed submit clears title and closing alone leaves the draft intact`, async () => {
    const f = formFixture(kind); find(f.render(), 'TextInput')[0].props.onChangeText('Mein Abend');
    f.render({ plan: null }); assert.equal(find(f.render(), 'TextInput')[0].props.value, 'Mein Abend'); assert.equal(f.calls(), 0);
    const tree = f.render({ plan: { id: 'plan', title: 'Abend', scheduled_at: '2026-09-15T18:00:00Z' } }); f.submit(tree).props.onPress(); f.pending.resolve(); await flush();
    assert.equal(find(f.render(), 'TextInput')[0].props.value, '');
  });
  test(`${kind} synchronous upload blocks even an already captured submit callback`, () => {
    const f = formFixture(kind); find(f.render(), 'TextInput')[0].props.onChangeText('Mein Abend'); const tree = f.render();
    const upload = find(tree, 'Button').find(n => ['Bild wählen', 'Titelbild hinzufügen'].includes(n.props.accessibilityLabel));
    assert.ok(upload); upload.props.onPress(); upload.props.onPress(); f.submit(tree).props.onPress(); assert.equal(f.calls(), 0); assert.equal(f.uploads(), 1);
  });
}
test('prepared read failure blocks submit and offers a functioning retry', () => {
  const f = formFixture('PrepareSheet'); find(f.render(), 'TextInput')[0].props.onChangeText('Mein Abend'); const tree = f.render({ readError: true });
  f.submit(tree).props.onPress(); assert.equal(f.calls(), 0); assert.equal(f.submit(tree).props.disabled, true);
  find(tree, 'Feedback')[0].props.action.onPress(); assert.equal(f.retries(), 1);
});
function cameraFixture() {
  const h = hooks(), requests = [], events = [], switchResult = deferred();
  const { useCameraPreview } = load('lib/useCameraPreview.ts', { react: h.react });
  const create = facing => { const d = deferred(); requests.push({ ...d, facing }); return d.promise; };
  const track = { stop: () => events.push('stop'), restartTrack: options => { events.push(options.facingMode); return switchResult.promise; } };
  const render = () => h.render(() => useCameraPreview(create, facing => events.push(`start:${facing}`), () => events.push('close')));
  render(); return { render, requests, track, events, switchResult, unmount: h.unmount, async ready() { requests.at(-1).resolve(track); await flush(); } };
}
test('camera cannot start while opening or after failure; retry owns a fresh attempt', async () => {
  const f = cameraFixture(); f.render().start(); assert.deepEqual(f.events, []); f.requests[0].reject(Error('permission')); await flush();
  assert.ok(f.render().error); f.render().start(); assert.deepEqual(f.events, []);
  const stale = f.render(); stale.retry(); stale.retry(); f.render(); assert.equal(f.requests.length, 2);
  await f.ready(); assert.equal(f.render().error, null); assert.equal(f.render().track, f.track);
});
test('explicit start stops preview first and starts exactly once using the selected camera', async () => {
  const f = cameraFixture(); await f.ready(); const switching = f.render().switchCamera(); f.render().start(); assert.deepEqual(f.events, ['user']);
  f.switchResult.resolve(); await switching; const ready = f.render(); ready.start(); ready.start();
  assert.deepEqual(f.events, ['user', 'stop', 'start:user']); f.unmount(); assert.deepEqual(f.events, ['user', 'stop', 'start:user']);
});
test('failed camera switch closes the invalid preview and blocks transmission', async () => {
  const f = cameraFixture(); await f.ready(); const switching = f.render().switchCamera(); f.switchResult.reject(Error('camera')); await switching;
  assert.equal(f.render().track, null); assert.ok(f.render().error); f.render().start(); assert.deepEqual(f.events, ['user', 'stop']);
});
for (const exit of ['close', 'unmount']) test(`camera finishing after ${exit} is stopped and never published`, async () => {
  const f = cameraFixture(); if (exit === 'close') { const view = f.render(); view.close(); view.close(); } else f.unmount(); await f.ready();
  assert.deepEqual(f.events, exit === 'close' ? ['close', 'stop'] : ['stop']);
});
test('a camera switch finishing after exit releases the restarted track again', async () => {
  const f = cameraFixture(); await f.ready(); const pending = f.render().switchCamera(); f.render().close(); f.switchResult.resolve(); await pending;
  assert.deepEqual(f.events, ['user', 'stop', 'close', 'stop']);
});
test('host camera choice survives minimize and refresh, and resets for a new show', () => {
  const { useLivePlayer } = load('lib/livePlayer.ts', { zustand: require('zustand') }); const show = { id: 'show', isHost: true };
  useLivePlayer.getState().open(show); assert.equal(useLivePlayer.getState().connected, false); useLivePlayer.getState().goLive('user');
  useLivePlayer.getState().minimize(); useLivePlayer.getState().open(show); assert.equal(useLivePlayer.getState().cameraFacing, 'user'); assert.equal(useLivePlayer.getState().connected, true);
  useLivePlayer.getState().open({ id: 'other', isHost: true }); assert.equal(useLivePlayer.getState().cameraFacing, 'environment'); assert.equal(useLivePlayer.getState().connected, false);
});
function showQuery(reply, enabled = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }); const calls = []; let options;
  const supabase = { from(table) { const query = { table }, builder = { then(ok, fail) { calls.push(query); return Promise.resolve().then(() => reply(query)).then(ok, fail); } };
    for (const key of ['select', 'eq', 'order', 'limit', 'abortSignal', 'retry']) builder[key] = (...args) => { query[key] = args[0]; return builder; }; return builder; } };
  load('lib/useStudio.ts', { '@tanstack/react-query': { useQuery: next => { options = next; } }, './supabase': { supabase } }).useMyActiveShow('seller', enabled);
  const observer = new QueryObserver(client, { ...options, retry: false }); const off = observer.subscribe(() => {});
  return { calls, options, observer, dispose() { off(); client.clear(); } };
}
test('seller show fetch failure stays an error and explicit retry recovers', async () => {
  let fail = true; const f = showQuery(() => fail ? { error: Error('offline') } : { data: [] });
  try { await flush(); assert.equal(f.observer.getCurrentResult().isError, true); assert.equal(f.observer.getCurrentResult().data, undefined);
    fail = false; await f.observer.refetch(); assert.equal(f.observer.getCurrentResult().data, null); assert.equal(f.observer.getCurrentResult().isError, false);
  } finally { f.dispose(); }
});
test('a failed seller show refresh retains its confirmed show', async () => {
  let fail = false; const f = showQuery(() => fail ? { error: Error('offline') } : { data: [{ id: 'show', status: 'active' }] });
  try { await flush(); fail = true; await f.observer.refetch(); assert.equal(f.observer.getCurrentResult().data.id, 'show'); assert.equal(f.observer.getCurrentResult().isError, true); } finally { f.dispose(); }
});
test('hidden seller stops polling and leaving aborts the pending read', async () => {
  const hidden = showQuery(() => assert.fail('hidden fetch'), false); await flush(); assert.equal(hidden.calls.length, 0); assert.equal(hidden.options.refetchInterval, false); hidden.dispose();
  const d = deferred(), active = showQuery(() => d.promise); await flush(); active.observer.destroy(); assert.equal(active.calls[0].abortSignal.aborted, true); d.resolve({ data: [] }); active.dispose();
});
