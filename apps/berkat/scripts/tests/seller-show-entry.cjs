// Interaction contracts of the stateless card; callbacks are local spies.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const file = path.resolve(__dirname, '../../components/SellerShowEntry.tsx');
const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const jsx = (type, props) => ({ type, props });
const context = vm.createContext({ exports: {}, require: name => {
  if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
  if (name === 'react-native') return { Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: s => s } };
  if (name === 'lucide-react-native') return {};
  if (name.includes('useSellerShows')) return { showWhen: () => 'morgen 18:00' };
  return { radius: {}, space: {}, ui: {} };
} });
vm.runInContext(code, context);
const card = context.exports.SellerShowEntry;
const planned = { id: 'plan', title: 'Morgen', women_only: true, scheduled_at: '2026-09-09T18:00:00Z' };

test('an active show takes priority over a schedule, including its title and audience', () => {
  let opened = null, scheduled = false;
  const view = card({ live: { id: 'live', title: null, women_only: false }, planned,
    onLive: id => { opened = id; }, onSchedule: () => { scheduled = true; } });
  assert.match(view.props.accessibilityLabel, /Jetzt live, Berkat-Show/);
  assert.doesNotMatch(view.props.accessibilityLabel, /Morgen|Nur Frauen/);
  view.props.onPress(); assert.equal(opened, 'live'); assert.equal(scheduled, false);
});
test('the next schedule announces its time and restriction, and opens the schedule section', () => {
  let scheduled = false;
  const view = card({ live: null, planned, onLive: () => assert.fail('must not enter a room'), onSchedule: () => { scheduled = true; } });
  assert.match(view.props.accessibilityLabel, /morgen 18:00, Morgen, Nur Frauen/);
  view.props.onPress(); assert.equal(scheduled, true);
});
test('without a show or schedule, no dead card is displayed', () => {
  assert.equal(card({ live: null, planned: null }), null);
});
