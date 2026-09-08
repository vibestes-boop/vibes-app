const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => ({ type, props });
const source = fs.readFileSync(path.resolve(__dirname, '../../components/SellerShopMore.tsx'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const context = vm.createContext({ exports: {}, require: name => name === 'react/jsx-runtime' ? { jsx, jsxs: jsx } : name === 'react-native' ? {
  ActivityIndicator: 'Spinner', Pressable: 'Button', View: 'View', Text: 'Text', useWindowDimensions: () => ({ fontScale: 1.786 }), StyleSheet: { create: s => s },
} : { radius: {}, space: {}, ui: {} } });
vm.runInContext(code, context);
const more = context.exports.SellerShopMore;
const find = (v, type) => !v ? [] : Array.isArray(v) ? v.flatMap(i => find(i, type)) : [...(v.type === type ? [v] : []), ...find(v.props?.children, type)];
const props = { hasMore: true, fetching: false, loadingMore: false, failed: false, onLoad: () => {} };

test('completed shop has no empty or disabled pagination control', () => {
  assert.equal(more({ ...props, hasMore: false }), null);
});
test('ready control loads another page via its own action', () => {
  let calls = 0; const view = more({ ...props, onLoad: () => { calls++; } });
  const button = find(view, 'Button')[0];
  assert.equal(button.props.disabled, false); button.props.onPress(); assert.equal(calls, 1);
  assert.equal(find(view, 'Text')[0].props.children, 'Weitere Angebote laden');
});
test('next-page loading announces busy state and blocks repeated taps', () => {
  const view = more({ ...props, fetching: true, loadingMore: true });
  const button = find(view, 'Button')[0];
  assert.equal(button.props.disabled, true); assert.equal(button.props.accessibilityState.busy, true);
  assert.equal(find(view, 'Spinner').length, 1); assert.match(find(view, 'Text')[0].props.children, /werden geladen/);
});
test('background refresh blocks pagination without claiming it is loading a new page', () => {
  const view = more({ ...props, fetching: true });
  const button = find(view, 'Button')[0];
  assert.equal(button.props.disabled, true); assert.equal(button.props.accessibilityState.busy, false);
  assert.equal(find(view, 'Spinner').length, 0);
});
test('failure preserves a local retry action and explains that previous offers remain', () => {
  let retried = false; const view = more({ ...props, failed: true, onLoad: () => { retried = true; } });
  const labels = find(view, 'Text');
  assert.match(labels[0].props.children, /bisherigen Angebote bleiben sichtbar/);
  assert.equal(labels[0].props.accessibilityLiveRegion, 'polite');
  assert.equal(labels[1].props.children, 'Weitere Angebote erneut laden');
  find(view, 'Button')[0].props.onPress(); assert.equal(retried, true);
});
