// Presentational callbacks and responsive identity; no live session or server requests.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props, key) => ({ type, props, key });
const nodes = (tree, type) => !tree ? [] : Array.isArray(tree) ? tree.flatMap(n => nodes(n, type)) : [...(tree.type === type ? [tree] : []), ...nodes(tree.props?.children, type)];
const content = tree => typeof tree === 'string' ? tree : Array.isArray(tree) ? tree.map(content).join('') : content(tree?.props?.children ?? '');
function fixture(settings = {}) {
  let measured = null;
  const actions = [], viewport = { width: 393, fontScale: 1, ...settings };
  const deps = {
    react: { useState: () => [measured, value => { measured = value; }] },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', Text: 'Text', StyleSheet: { create: s => s }, useWindowDimensions: () => viewport },
    'lucide-react-native': {}, '../theme/tokens': { radius: {}, space: {}, stage: {} },
    './Avatar': { Avatar: 'Avatar' }, './PressFeedback': { PressFeedback: 'Button' },
  };
  const source = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../components/LiveSellerHeader.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const ctx = vm.createContext({ exports: {}, require: name => { assert.ok(name in deps, name); return deps[name]; } });
  vm.runInContext(source, ctx);
  const props = {
    name: 'Ein langer Verkäufername', vouch: 'Amir und Ruslan bürgen', viewerCount: 1284, isHost: false,
    follow: { canFollow: true, isFollowing: false, busy: false, label: 'Folgen', error: null, toggle: async () => actions.push('follow') },
    onSeller: () => actions.push('seller'), onViewers: () => actions.push('viewers'), onMinimize: () => actions.push('minimize'),
    onLayout: event => actions.push(event.nativeEvent.layout.height),
  };
  return { actions, props, viewport, render: () => ctx.exports.LiveSellerHeader(props) };
}

test('seller, follow and minimize remain separate actions; viewers are read-only for guests', () => {
  const f = fixture(); const tree = f.render();
  const buttons = nodes(tree, 'Button');
  buttons.find(n => n.props.accessibilityLabel?.startsWith('Mehr über')).props.onPress();
  buttons.find(n => content(n) === 'Folgen').props.onPress();
  buttons.find(n => n.props.accessibilityLabel === 'Show verkleinern').props.onPress();
  assert.deepEqual(f.actions, ['seller', 'follow', 'minimize']);
  assert.equal(buttons.some(n => n.props.accessibilityLabel?.includes('Liste öffnen')), false);
  assert.ok(nodes(tree, 'View').some(n => n.props.accessibilityLabel === '1284 schauen zu'));
  f.props.isHost = true; f.props.follow.canFollow = false;
  const host = nodes(f.render(), 'Button');
  assert.equal(host.some(n => content(n) === 'Folgen'), false);
  host.find(n => n.props.accessibilityLabel?.includes('Liste öffnen')).props.onPress();
  assert.equal(f.actions.at(-1), 'viewers');
});

test('pending, failed and selected states retain their visible and accessible feedback', () => {
  const f = fixture();
  for (const state of [
    { label: 'Einen Moment …', busy: true, error: null, isFollowing: false },
    { label: 'Erneut laden', busy: false, error: 'Bitte erneut laden.', isFollowing: false },
    { label: 'Erneut versuchen', busy: false, error: 'Bitte erneut versuchen.', isFollowing: false },
    { label: 'Du folgst', busy: false, error: null, isFollowing: true },
  ]) {
    Object.assign(f.props.follow, state); const tree = f.render();
    const button = nodes(tree, 'Button').find(n => content(n) === state.label);
    assert.equal(button.props.disabled, state.busy);
    assert.equal(button.props.accessibilityState.busy, state.busy);
    assert.equal(button.props.accessibilityState.selected, state.isFollowing);
    assert.equal(button.props.accessibilityHint, state.error ?? undefined);
    assert.equal(nodes(tree, 'Text').some(n => n.props.accessibilityLiveRegion === 'polite'), Boolean(state.error));
  }
});

test('measured narrow width, large fonts and errors keep the full identity; total height reaches the room', () => {
  const f = fixture(); const name = tree => nodes(tree, 'Text').find(n => content(n) === f.props.name);
  assert.equal(name(f.render()).props.numberOfLines, 1);
  f.render().props.onLayout({ nativeEvent: { layout: { width: 320, height: 163 } } });
  assert.equal(name(f.render()).props.numberOfLines, undefined); assert.deepEqual(f.actions, [163]);
  const large = fixture({ fontScale: 2 }); assert.equal(name(large.render()).props.numberOfLines, undefined);
  const failure = fixture(); failure.props.follow.error = 'Bitte erneut laden.';
  assert.equal(name(failure.render()).props.numberOfLines, undefined);
  assert.ok(nodes(failure.render(), 'Text').some(n => content(n) === failure.props.vouch));
});
