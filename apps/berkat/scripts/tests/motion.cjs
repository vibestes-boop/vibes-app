const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const jsx = (type, props) => ({ type, props });
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function load(file, deps) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const ctx = vm.createContext({ exports: {}, require: name => deps[name] ?? {} }); vm.runInContext(code, ctx); return ctx.exports;
}
function preference() {
  const events = new Map(), requests = []; let api, added = 0, removed = 0;
  const listen = (name, fn) => { added++; events.set(name, fn); return { remove() { removed++; events.delete(name); } }; };
  const lib = load('lib/useReducedMotion.ts', { react: { useSyncExternalStore(subscribe, read, server) { api = { subscribe, read, server }; return read(); } },
    'react-native': { AccessibilityInfo: { addEventListener: listen, isReduceMotionEnabled: () => new Promise((resolve, reject) => requests.push({ resolve, reject })) }, AppState: { addEventListener: listen } } });
  lib.useReducedMotion(); return { api, events, requests, counts: () => ({ added, removed }) };
}
test('motion defaults to reduced until the native setting is available', async () => {
  const p = preference(); assert.equal(p.api.read(), true); assert.equal(p.api.server(), true);
  let updates = 0; const stop = p.api.subscribe(() => updates++); p.requests[0].resolve(false); await flush();
  assert.equal(p.api.read(), false); assert.equal(updates, 1); stop();
});
test('many press targets share one pair of native listeners and clean up at the last unsubscribe', () => {
  const p = preference(), stops = Array.from({ length: 100 }, () => p.api.subscribe(() => {}));
  assert.deepEqual(p.counts(), { added: 2, removed: 0 }); assert.equal(p.requests.length, 1);
  stops.slice(0, 99).forEach(stop => stop()); assert.equal(p.counts().removed, 0);
  stops[99](); assert.equal(p.counts().removed, 2);
});
test('a newer system event wins over a late initial response', async () => {
  const p = preference(), stop = p.api.subscribe(() => {}); p.events.get('reduceMotionChanged')(true);
  p.requests[0].resolve(false); await flush(); assert.equal(p.api.read(), true); stop();
});
test('returning from Settings refreshes the native preference without remounting subscribers', async () => {
  const p = preference(), stop = p.api.subscribe(() => {}); p.requests[0].resolve(false); await flush();
  p.events.get('change')('background'); assert.equal(p.requests.length, 1);
  p.events.get('change')('active'); p.requests[1].resolve(true); await flush(); assert.equal(p.api.read(), true);
  p.events.get('reduceMotionChanged')(false); assert.equal(p.api.read(), false); stop();
});
test('failed reads keep motion off and can recover on the next foreground read', async () => {
  const p = preference(), stop = p.api.subscribe(() => {}); p.requests[0].reject(Error('unavailable')); await flush(); assert.equal(p.api.read(), true);
  p.events.get('change')('active'); p.requests[1].resolve(false); await flush(); assert.equal(p.api.read(), false); stop();
});
test('unsubscribed reads cannot overwrite the next subscription', async () => {
  const p = preference(), stop = p.api.subscribe(() => {}); stop(); const stop2 = p.api.subscribe(() => {});
  p.requests[1].resolve(true); await flush(); p.requests[0].resolve(false); await flush(); assert.equal(p.api.read(), true); stop2();
});
test('stack overrides cannot restore slide transitions when motion is reduced', () => {
  function Stack() {} Stack.Screen = 'StackScreen';
  const find = v => !v ? [] : Array.isArray(v) ? v.flatMap(find) : [v, ...find(v.props?.children)];
  for (const reduced of [true, false]) {
    const lib = load('app/_layout.tsx', {
      react: { useState: initial => [initial(), () => {}], useEffect() {} }, 'react/jsx-runtime': { jsx, jsxs: jsx },
      'expo-router': { Stack }, '@tanstack/react-query': { QueryClient: class {} },
      '../lib/useReducedMotion': { useReducedMotion: () => reduced }, '../theme/tokens': { ui: {} },
    });
    const nodes = find(lib.default()), stack = nodes.find(n => n.type === Stack);
    assert.equal(stack.props.screenOptions.animation, reduced ? 'none' : 'slide_from_right');
    for (const screen of nodes.filter(n => n.type === 'StackScreen' && n.props.options?.animation))
      assert.equal(screen.props.options.animation, reduced ? 'none' : 'slide_from_bottom');
  }
});

// Callback/state harness; native timing values are checked separately in Simulator.
function feedback() {
  let cursor = 0, dirty = false, reduced = false; const slots = [], effects = [], animations = [];
  const react = {
    useState(initial) { const i = cursor++; slots[i] ??= { value: initial }; return [slots[i].value, next => { const value = typeof next === 'function' ? next(slots[i].value) : next; if (!Object.is(value, slots[i].value)) { slots[i].value = value; dirty = true; } }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useEffect(fn, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((v, j) => !Object.is(v, old.deps[j]))) effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
  };
  class Value {
    constructor(value) { this.value = value; } stopAnimation() {} setValue(value) { this.value = value; }
    interpolate({ outputRange: [a, b] }) { return { read: () => a + (b - a) * this.value }; }
  }
  const flatten = v => Array.isArray(v) ? Object.assign({}, ...v.filter(Boolean).map(flatten)) : v ?? {};
  const read = v => typeof v === 'number' ? v : v.read();
  const Animated = { Value, createAnimatedComponent: () => 'NativePressable', multiply: (a, b) => ({ read: () => read(a) * read(b) }),
    timing(value, config) { const entry = { config, stopped: false }; animations.push(entry); return { start() { value.setValue(config.toValue); }, stop() { entry.stopped = true; } }; } };
  const motion = load('theme/motion.ts', {}).motion;
  const lib = load('components/PressFeedback.tsx', { react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': { Animated, Pressable: 'Pressable', Easing: { out: v => v, quad: 'quad' }, StyleSheet: { flatten } }, '../lib/useReducedMotion': { useReducedMotion: () => reduced }, '../theme/motion': { motion } });
  return { animations, read, setReduced: value => { reduced = value; }, render(props = {}) { let result; do { dirty = false; cursor = 0; result = lib.PressFeedback(props); effects.splice(0).forEach(fn => fn()); } while (dirty); return result; }, close() { slots.forEach(s => s.cleanup?.()); } };
}
test('normal press uses native non-blocking timing and releases to its original shape', () => {
  const h = feedback(), props = { kind: 'card', style: { flex: 1 } }; let v = h.render(props);
  assert.equal(h.animations.length, 0, 'mounting cards must not start idle animations');
  v.props.onPressIn({}); v = h.render(props); let last = h.animations.at(-1).config;
  assert.equal(last.useNativeDriver, true); assert.equal(last.isInteraction, false); assert.equal(last.duration, 80);
  assert.equal(v.props.style[0].flex, 1); assert.equal(h.read(v.props.style[1].transform.at(-1).scale), 0.985);
  v.props.onPressOut({}); v = h.render(props); assert.equal(h.animations.at(-1).config.duration, 160);
  assert.equal(h.read(v.props.style[1].transform.at(-1).scale), 1); h.close(); assert.equal(h.animations.at(-1).stopped, true);
});
test('enabling reduced motion during a press stops travel but preserves immediate feedback', () => {
  const h = feedback(); let v = h.render(); v.props.onPressIn({}); v = h.render(); const previous = h.animations.at(-1), count = h.animations.length;
  h.setReduced(true); v = h.render(); assert.equal(previous.stopped, true); assert.equal(h.animations.length, count);
  assert.equal(v.props.style[1].transform.at(-1).scale, 1); assert.equal(h.read(v.props.style[1].opacity), 0.86);
  v.props.onPressOut({}); v = h.render(); assert.equal(h.read(v.props.style[1].opacity), 1);
});
test('disabling a held target restores it and preserves caller opacity and semantics', () => {
  const h = feedback(); let events = 0; const props = { onPressIn: () => events++, accessibilityState: { selected: true }, style: { opacity: 0.4 } };
  let v = h.render(props); v.props.onPressIn({}); h.render(props); v = h.render({ ...props, disabled: true });
  assert.equal(v.props.disabled, true); assert.equal(v.props.accessibilityState.selected, true); assert.equal(h.read(v.props.style[1].opacity), 0.4);
  assert.equal(v.props.style[1].transform.at(-1).scale, 1); v.props.onPressIn({}); assert.equal(events, 1);
  v = h.render(props); assert.equal(h.read(v.props.style[1].opacity), 0.4);
});
test('cancellation only releases the target; navigation runs once on the real press callback', () => {
  const h = feedback(); let taps = 0, releases = 0; const props = { onPress: () => taps++, onPressOut: () => releases++ };
  let v = h.render(props); v.props.onPressIn({}); v = h.render(props); v.props.onPressOut({}); v = h.render(props);
  assert.equal(taps, 0); assert.equal(releases, 1); v.props.onPress({}); assert.equal(taps, 1);
});
test('hover callbacks and functional styles survive the shared press component', () => {
  const h = feedback(); let hovers = 0; const props = { style: ({ hovered, pressed }) => ({ borderWidth: hovered ? 2 : 0, padding: pressed ? 5 : 6 }), onHoverIn: () => hovers++ };
  let v = h.render(props); v.props.onHoverIn({}); v = h.render(props); assert.equal(hovers, 1); assert.equal(v.props.style[0].borderWidth, 2);
  v.props.onPressIn({}); v = h.render(props); assert.equal(v.props.style[0].padding, 5);
  v.props.onHoverOut({}); v = h.render(props); assert.equal(v.props.style[0].borderWidth, 0);
});
