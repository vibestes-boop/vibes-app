// Guest/session transitions use the production header, without real accounts.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => typeof type === 'function' ? type(props) : { type, props };
const deps = {
  'react/jsx-runtime': { jsx, jsxs: jsx },
  'react-native': { View: 'View', Text: 'Text', StyleSheet: { create: value => value } },
  'lucide-react-native': { Heart: 'Heart', Bell: 'Bell', MessageSquare: 'MessageSquare' },
  './PressFeedback': { PressFeedback: 'Button' },
  '../theme/tokens': { ui: {}, radius: {}, space: {} },
};
const context = vm.createContext({ exports: {}, require(name) { assert.ok(name in deps, name); return deps[name]; } });
vm.runInContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../components/HomeAccountActions.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText, context);
const find = (node, type) => Array.isArray(node) ? node.flatMap(n => find(n, type)) : !node ? [] : [
  ...(node.type === type ? [node] : []), ...find(node.props?.children, type),
];
const text = node => typeof node === 'number' ? String(node) : typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join('') : text(node?.props?.children ?? '');
function fixture() {
  const calls = [];
  const props = { loading: false, signedIn: false, unread: 0, unreadMessages: 0,
    onLogin: () => calls.push('login'), onSaved: () => calls.push('saved'),
    onMessages: () => calls.push('messages'), onNotifications: () => calls.push('notifications'),
  };
  return { props, calls, render: () => context.exports.HomeAccountActions(props) };
}

test('guest header offers explicit sign-in and does not expose account-only tools or badges', () => {
  const f = fixture(); f.props.unread = 7; f.props.unreadMessages = 12;
  const tree = f.render(), buttons = find(tree, 'Button');
  assert.deepEqual(buttons.map(b => b.props.accessibilityLabel), ['Anmelden']);
  buttons[0].props.onPress(); assert.deepEqual(f.calls, ['login']);
  assert.doesNotMatch(text(tree), /7|9\+/);
});

test('session bootstrap never flashes a sign-in prompt or tools from a previous account', () => {
  const f = fixture(); f.props.loading = true;
  for (const signedIn of [false, true]) {
    f.props.signedIn = signedIn;
    assert.equal(find(f.render(), 'Button').length, 0);
  }
  f.props.loading = false; f.props.signedIn = true;
  assert.equal(find(f.render(), 'Button').length, 3);
  f.props.signedIn = false;
  assert.deepEqual(find(f.render(), 'Button').map(b => b.props.accessibilityLabel), ['Anmelden']);
});

test('known account keeps all destinations and full accessible unread counts', () => {
  const f = fixture(); Object.assign(f.props, { signedIn: true, unread: 17, unreadMessages: 2 });
  const tree = f.render(), buttons = find(tree, 'Button');
  assert.deepEqual(buttons.map(b => b.props.accessibilityLabel), ['Merkliste öffnen', 'Nachrichten, 2 ungelesen', 'Meldungen, 17 neue']);
  for (const button of buttons) button.props.onPress();
  assert.deepEqual(f.calls, ['saved', 'messages', 'notifications']);
  assert.equal(text(tree), '29+');
});
