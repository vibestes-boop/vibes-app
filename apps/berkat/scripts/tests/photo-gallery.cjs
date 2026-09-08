const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const jsx = (type, props, key) => ({ type, props, key });
const plain = value => JSON.parse(JSON.stringify(value));
const find = (v, type) => !v ? [] : Array.isArray(v) ? v.flatMap(i => find(i, type)) : [...(v.type === type ? [v] : []), ...find(v.props?.children, type)];
function load(file, deps = {}, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const ctx = vm.createContext({ exports: {}, ...globals, require: name => deps[name] ?? (name === '../lib/useReducedMotion' ? { useReducedMotion: () => false } : name === './PressFeedback' ? { PressFeedback: 'Button' } : {}) });
  vm.runInContext(code, ctx); return ctx.exports;
}
// Small event/state harness, not a native renderer. Layout is checked in Simulator.
function harness() {
  let cursor = 0, dirty = false, pending = []; const slots = [], timers = new Set();
  const react = {
    useState(initial) { const n = cursor++; if (!slots[n]) slots[n] = { value: initial };
      return [slots[n].value, next => { slots[n].value = typeof next === 'function' ? next(slots[n].value) : next; dirty = true; }]; },
    useRef(initial) { const n = cursor++; return slots[n] ??= { current: initial }; },
    useEffect(effect, deps) { const n = cursor++, old = slots[n];
      if (!old || deps.some((v, i) => !Object.is(v, old.deps[i]))) pending.push(() => { old?.cleanup?.(); slots[n] = { deps, cleanup: effect() }; }); },
  };
  return { react, timers, globals: { setTimeout: fn => { timers.add(fn); return fn; }, clearTimeout: fn => timers.delete(fn) },
    render(fn, props) { let tree, attempts = 0; do { dirty = false; cursor = 0; tree = fn(props); const effects = pending; pending = []; effects.forEach(fn => fn()); if (++attempts > 10) throw Error('Unstable state'); } while (dirty); return tree; },
    tick() { for (const fn of [...timers]) { timers.delete(fn); fn(); } },
    close() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}
const native = { View: 'View', Text: 'Text', Pressable: 'Button', ScrollView: 'Scroll', ActivityIndicator: 'Spinner',
  StyleSheet: { create: s => s, absoluteFill: {}, absoluteFillObject: {} }, useWindowDimensions: () => ({ width: 402, fontScale: 1.118 }) };
const theme = { ui: {}, radius: {}, space: { lg: 20 } };
function photo() {
  const h = harness(); const lib = load('components/ProductPhoto.tsx', {
    react: h.react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': native, 'expo-image': { Image: 'Image' },
    'lucide-react-native': { Camera: 'Camera' }, '../theme/tokens': theme,
  }, h.globals);
  const props = { uri: 'https://example.test/photo.jpg', retry: true, style: {}, accessibilityLabel: 'Produktfoto 2 von 8' };
  const outer = lib.ProductPhoto(props); const attempt = h.render(outer.type, props);
  // Retrieve PhotoAttempt without retaining the parent hook storage.
  const separate = harness();
  const attemptLib = load('components/ProductPhoto.tsx', { react: separate.react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': native,
    'expo-image': { Image: 'Image' }, 'lucide-react-native': { Camera: 'Camera' }, '../theme/tokens': theme }, separate.globals);
  const parentElement = attemptLib.ProductPhoto(props);
  // Calling Photo once only retrieves its child; discard its hook storage afterward.
  const tmpState = separate.react.useState; separate.react.useState = () => [0, () => {}];
  const element = parentElement.type(props); separate.react.useState = tmpState;
  return { h: separate, props, render: extra => separate.render(element.type, { ...props, onRetry() {}, ...extra }), outer, parent: h, parentType: outer.type, attempt };
}

test('photo cache is shared by URI and a warm image has no loading flash', () => {
  const p = photo(); let v = p.render(); const img = find(v, 'Image')[0];
  assert.equal(img.props.cachePolicy, 'memory-disk'); assert.equal(img.props.recyclingKey, p.props.uri);
  assert.equal(img.props.transition, 0); assert.equal(img.props.allowDownscaling, true); assert.equal(find(v, 'Spinner').length, 0);
  img.props.onDisplay(); v = p.render(); p.h.tick(); v = p.render();
  assert.equal(find(v, 'Spinner').length, 0); assert.equal(find(v, 'Image')[0].props.accessible, true); assert.equal(p.h.timers.size, 0);
});
test('slow detail image announces loading, then clears feedback on display', () => {
  const p = photo(); p.render(); p.h.tick(); let v = p.render(); assert.equal(find(v, 'Spinner').length, 1);
  const busy = find(v, 'View').find(n => n.props.accessibilityRole === 'progressbar'); assert.equal(busy.props.accessibilityState.busy, true);
  find(v, 'Image')[0].props.onDisplay(); v = p.render(); assert.equal(find(v, 'Spinner').length, 0);
});
test('list thumbnail loading has no spinner or extra action', () => {
  const p = photo(); p.render({ compact: true, retry: false }); p.h.tick(); const v = p.render({ compact: true, retry: false });
  assert.equal(find(v, 'Spinner').length, 0); assert.equal(find(v, 'Button').length, 0); assert.equal(find(v, 'Camera').length, 1);
});
test('failure is local to the photo; retry has its page label and starts a fresh attempt', () => {
  const p = photo(); const img = find(p.render(), 'Image')[0]; img.props.onError(); img.props.onDisplay();
  let retries = 0; const v = p.render({ onRetry: () => retries++ }); assert.equal(find(v, 'Image').length, 0);
  const button = find(v, 'Button')[0]; assert.equal(button.props.accessibilityLabel, 'Produktfoto 2 von 8 erneut laden');
  button.props.onPress(); assert.equal(retries, 1);
  p.attempt.props.onRetry(); const next = p.parent.render(p.parentType, p.props); assert.notEqual(next.key, p.attempt.key);
});
test('source changes isolate load state and missing photos never offer retry', () => {
  const p = photo(); assert.equal(p.outer.key, p.props.uri); const v = p.render({ uri: null });
  assert.equal(find(v, 'Image').length, 0); assert.equal(find(v, 'Button').length, 0); assert.equal(p.h.timers.size, 0);
});
test('unmount cancels the delayed loading indicator', () => { const p = photo(); p.render(); assert.equal(p.h.timers.size, 1); p.h.close(); assert.equal(p.h.timers.size, 0); });

const selection = load('lib/gallerySelection.ts');
test('gallery keeps photo identity when list order changes', () => {
  assert.equal(selection.galleryIndex(['c', 'a', 'b'], { uri: 'b', index: 1 }), 2);
  assert.equal(selection.galleryIndex(['a', 'b'], { uri: 'b', index: 1 }), 1);
});
test('removed photo falls back to nearest remaining position; empty starts at zero', () => {
  assert.equal(selection.galleryIndex(['a'], { uri: 'b', index: 7 }), 0);
  assert.equal(selection.galleryIndex(['a', 'c'], { uri: 'b', index: 1 }), 1);
  assert.equal(selection.galleryIndex([], { uri: 'a', index: 0 }), 0);
});
test('overscroll and invalid geometry never create out of range pages', () => {
  for (const [x, w, n, expected] of [[-90, 362, 8, 0], [9000, 362, 8, 7], [362, 362, 8, 1], [200, 0, 8, 0], [NaN, 362, 8, 0], [200, 362, 0, 0]]) assert.equal(selection.galleryPage(x, w, n), expected);
});
test('gallery mounts only current and immediate neighboring photos, with one accessible page', () => {
  const h = harness(); const lib = load('components/ListingGallery.tsx', { react: h.react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': native,
    'lucide-react-native': {}, '../lib/gallerySelection': selection, '../theme/tokens': theme, './ProductPhoto': { ProductPhoto: 'Photo' } });
  const props = { images: ['a','b','c','d','e','f','g','h'], womenOnly: false };
  let v = h.render(lib.ListingGallery, props); assert.deepEqual(find(v, 'Photo').map(n => n.props.uri), ['a','b']);
  for (let i = 0; i < 4; i++) { find(v, 'Button')[1].props.onPress(); v = h.render(lib.ListingGallery, props); }
  assert.deepEqual(find(v, 'Photo').map(n => n.props.uri), ['d','e','f']);
  assert.equal(find(v, 'Photo').find(n => n.props.priority === 'high').props.uri, 'e');
  assert.equal(find(v, 'View').filter(n => n.props.accessibilityElementsHidden === false).length, 1);
  v = h.render(lib.ListingGallery, { ...props, active: false }); assert.deepEqual(find(v, 'Photo').map(n => n.props.uri), ['e']);
  v = h.render(lib.ListingGallery, { ...props, images: ['e','a'] }); assert.equal(find(v, 'Text')[0].props.children[0], 1);
});
test('empty and single photo galleries have no paging buttons', () => {
  const h = harness(); const lib = load('components/ListingGallery.tsx', { react: h.react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': native,
    'lucide-react-native': {}, '../lib/gallerySelection': selection, '../theme/tokens': theme });
  for (const images of [[], ['a']]) assert.equal(find(h.render(lib.ListingGallery, { images }), 'Button').length, 0);
});
test('scrolling advances the loading window before momentum ends', () => {
  const h = harness(); const lib = load('components/ListingGallery.tsx', { react: h.react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': native,
    'lucide-react-native': {}, '../lib/gallerySelection': selection, '../theme/tokens': theme, './ProductPhoto': { ProductPhoto: 'Photo' } });
  const props = { images: ['a','b','c','d','e','f','g','h'] };
  let v = h.render(lib.ListingGallery, props);
  find(v, 'Scroll')[0].props.onScroll({ nativeEvent: { contentOffset: { x: 5 * 362 }, layoutMeasurement: { width: 362 } } });
  v = h.render(lib.ListingGallery, props);
  assert.deepEqual(find(v, 'Photo').map(n => n.props.uri), ['e','f','g']);
  assert.equal(find(v, 'Photo').find(n => n.props.priority === 'high').props.uri, 'f');
});
test('width changes reposition the selected image instead of resetting to first', () => {
  let width = 402; const calls = [], h = harness();
  const lib = load('components/ListingGallery.tsx', { react: h.react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { ...native, useWindowDimensions: () => ({ width, fontScale: 1.118 }) },
    'lucide-react-native': {}, '../lib/gallerySelection': selection, '../theme/tokens': theme, './ProductPhoto': { ProductPhoto: 'Photo' } });
  const props = { images: ['a','b','c'] }; let v = h.render(lib.ListingGallery, props);
  find(v, 'Scroll')[0].props.ref.current = { scrollTo: value => calls.push(plain(value)) };
  find(v, 'Button')[1].props.onPress(); v = h.render(lib.ListingGallery, props);
  width = 800; v = h.render(lib.ListingGallery, props);
  assert.deepEqual(calls.at(-1), { x: 760, animated: false });
  assert.equal(find(v, 'Photo').find(n => n.props.priority === 'high').props.uri, 'b');
});
test('empty and duplicate image entries do not create blank or duplicate pages', () => {
  const lib = load('lib/useListings.ts');
  assert.deepEqual(plain(lib.listingImages({ image_url: 'cover', image_urls: ['a', '', 'a', 'b', '  '] })), ['a', 'b']);
  assert.deepEqual(plain(lib.listingImages({ image_url: 'cover', image_urls: [''] })), ['cover']);
  assert.deepEqual(plain(lib.listingImages({ image_url: null, image_urls: [] })), []);
  assert.deepEqual(plain(lib.listingImages({ image_url: '  ', image_urls: [] })), []);
});
test('reduced motion gallery keeps selection and moves without animated scrolling', () => {
  const h = harness(), calls = [];
  const lib = load('components/ListingGallery.tsx', { react: h.react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': native,
    'lucide-react-native': {}, '../lib/gallerySelection': selection, '../theme/tokens': theme, './ProductPhoto': { ProductPhoto: 'Photo' },
    '../lib/useReducedMotion': { useReducedMotion: () => true } });
  const props = { images: ['a','b'] }; let v = h.render(lib.ListingGallery, props);
  find(v, 'Scroll')[0].props.ref.current = { scrollTo: value => calls.push(plain(value)) };
  find(v, 'Button')[1].props.onPress(); v = h.render(lib.ListingGallery, props);
  assert.deepEqual(calls.at(-1), { x: 362, animated: false });
  assert.equal(find(v, 'Photo').find(n => n.props.priority === 'high').props.uri, 'b');
  assert.equal(find(v, 'Button')[1].props.disabled, true);
});
