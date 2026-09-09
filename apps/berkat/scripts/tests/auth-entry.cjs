// Isolated event/request tests. No real authentication, registration or email.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const jsx = (type, props, key) => ({ type, props, key });
const find = (node, type) => !node ? [] : Array.isArray(node) ? node.flatMap(n => find(n, type)) : [...(node.type === type ? [node] : []), ...find(node.props?.children, type)];
const text = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join('') : text(node?.props?.children ?? '');
const flush = async () => { for (let i = 0; i < 25; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function fixture(api = {}) {
  let cursor = 0, fontScale = 1, focus, blur;
  const slots = [], calls = [];
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], v => { slots[i] = typeof v === 'function' ? v(slots[i]) : v; }]; },
    useRef(value) { const i = cursor++; if (!(i in slots)) slots[i] = { current: value }; return slots[i]; },
    useCallback: fn => fn,
  };
  const fail = () => { throw new Error('Unexpected API request'); };
  const deps = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', Text: 'Text', TextInput: 'Input', Pressable: 'Button', ScrollView: 'Scroll', KeyboardAvoidingView: 'Keyboard',
      ActivityIndicator: 'Spinner', Platform: { OS: 'ios' }, StyleSheet: { create: s => s }, useWindowDimensions: () => ({ fontScale }) },
    'expo-router': { useFocusEffect(fn) { if (!focus) { focus = fn; blur = fn(); } } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 40, bottom: 30 }) },
    'lucide-react-native': {}, '../components/BerkatMark': { BerkatMark: 'Mark' }, '../components/PressFeedback': { PressFeedback: 'Button' },
    '../theme/tokens': { ui: {}, radius: {}, space: {} }, '../lib/nav': { goBack: () => calls.push(['back']) },
    '../lib/supabase': { supabase: { auth: {
      signInWithPassword: args => { calls.push(['login', args]); return (api.login ?? fail)(args); },
      signUp: args => { calls.push(['register', args]); return (api.register ?? fail)(args); },
    }, from(table) { assert.equal(table, 'profiles'); return { select() { return this; }, eq(_, name) { calls.push(['lookup', name]); return this; }, maybeSingle: api.lookup ?? fail }; } } },
  };
  const source = ts.transpileModule(fs.readFileSync(path.join(root, 'app/login.tsx'), 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const ctx = vm.createContext({ exports: {}, require(name) { assert.ok(name in deps, name); return deps[name]; } });
  vm.runInContext(source, ctx);
  const f = { calls, render() { cursor = 0; return ctx.exports.default(); },
    font(value) { fontScale = value; }, blur() { blur(); }, focus() { blur = focus(); },
    button(name) { return find(f.render(), 'Button').find(n => n.props.accessibilityLabel === name || text(n) === name); },
    input(name) { return find(f.render(), 'Input').find(n => n.props.accessibilityLabel === name); },
    type(name, value) { f.input(name).props.onChangeText(value); },
    press(name) { const node = f.button(name); assert.ok(node, name); node.props.onPress(); },
  };
  f.render(); return f;
}
function fill(f) { f.type('E-Mail', '  person@example.test  '); f.type('Passwort', 'local-test-password'); }
function register(f) { f.press('Neu bei Berkat? Konto anlegen'); fill(f); f.type('Profilname', 'local_guest'); }

test('empty login and invalid registration stay local with understandable errors', () => {
  const f = fixture(); f.press('Anmelden'); assert.match(text(f.render()), /E-Mail und Passwort/); assert.equal(f.calls.length, 0);
  register(f); f.type('Profilname', '?'); f.press('Konto anlegen'); assert.match(text(f.render()), /3 bis 24/); assert.equal(f.calls.length, 0);
  f.type('Profilname', 'valid'); f.type('Passwort', '123'); f.press('Konto anlegen'); assert.match(text(f.render()), /sechs Zeichen/); assert.equal(f.calls.length, 0);
});
test('keyboard and button submit share a synchronous lock; failed request keeps draft and unlocks retry', async () => {
  const request = deferred(); const f = fixture({ login: () => request.promise }); fill(f);
  const button = f.button('Anmelden'), keyboard = f.input('Passwort');
  button.props.onPress(); keyboard.props.onSubmitEditing(); button.props.onPress();
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0][1].email, 'person@example.test');
  assert.equal(f.button('Anmelden').props.accessibilityState.busy, true);
  assert.equal(f.input('E-Mail').props.editable, false);
  f.press('Neu bei Berkat? Konto anlegen'); assert.equal(f.input('Profilname'), undefined);
  request.reject(new Error('Network request failed')); await flush();
  assert.match(text(f.render()), /Keine Verbindung/); assert.equal(f.input('Passwort').props.value, 'local-test-password');
  assert.equal(f.button('Anmelden').props.disabled, false);
});
test('closing a pending sign-in never pops a later screen or leaks its failure into a new visit', async () => {
  const request = deferred(); const f = fixture({ login: () => request.promise }); fill(f); f.press('Anmelden');
  f.press('Schließen'); f.blur(); f.focus(); request.resolve({ error: { message: 'Invalid login credentials' } }); await flush();
  assert.equal(f.calls.filter(c => c[0] === 'back').length, 1);
  assert.doesNotMatch(text(f.render()), /stimmt nicht/); assert.equal(f.button('Anmelden').props.disabled, false);
});
test('normal login success navigates once and returned auth errors stay readable', async () => {
  const f = fixture({ login: async () => ({ error: null }) }); fill(f); f.press('Anmelden'); await flush();
  assert.equal(f.calls.filter(c => c[0] === 'back').length, 1);
  const bad = fixture({ login: async () => ({ error: { message: 'Email not confirmed' } }) }); fill(bad); bad.press('Anmelden'); await flush();
  assert.match(text(bad.render()), /Postfach/); assert.equal(bad.calls.filter(c => c[0] === 'back').length, 0);
});
test('closing during username lookup prevents registration from being dispatched', async () => {
  const lookup = deferred(); const f = fixture({ lookup: () => lookup.promise }); register(f); f.press('Konto anlegen');
  f.press('Ohne Anmeldung weiterschauen'); lookup.resolve({ data: null, error: null }); await flush();
  assert.equal(f.calls.filter(c => c[0] === 'register').length, 0);
});
test('duplicate names and lookup failures preserve registration fields without creating an account', async () => {
  for (const response of [{ data: { username: 'local_guest' }, error: null }, { data: null, error: { message: 'fetch failed' } }]) {
    const f = fixture({ lookup: async () => response }); register(f); f.press('Konto anlegen'); await flush();
    assert.equal(f.calls.filter(c => c[0] === 'register').length, 0); assert.equal(f.input('Profilname').props.value, 'local_guest');
    assert.equal(f.button('Konto anlegen').props.disabled, false); assert.match(text(f.render()), /vergeben|Verbindung/);
  }
});
test('registration confirmation clears password and returns to login with its email', async () => {
  const f = fixture({ lookup: async () => ({ data: null, error: null }), register: async () => ({ data: { session: null }, error: null }) });
  register(f); f.press('Konto anlegen'); await flush();
  assert.match(text(f.render()), /Schau in dein Postfach/); assert.equal(f.input('Passwort'), undefined);
  f.press('Zur Anmeldung'); assert.equal(f.input('Passwort').props.value, ''); assert.equal(f.input('E-Mail').props.value.trim(), 'person@example.test');
  assert.equal(f.calls.filter(c => c[0] === 'register').length, 1);
});
test('registration with a session returns to the originating screen', async () => {
  const f = fixture({ lookup: async () => ({ data: null, error: null }), register: async () => ({ data: { session: { user: 'fixture' } }, error: null }) });
  register(f); f.press('Konto anlegen'); await flush(); assert.equal(f.calls.filter(c => c[0] === 'back').length, 1);
});
test('font changes and password visibility keep entered fields; switching mode hides the password', () => {
  const f = fixture(); register(f); const inputKey = f.input('Passwort').key;
  f.press('Passwort anzeigen'); assert.equal(f.input('Passwort').props.secureTextEntry, false);
  for (const size of [2.4, 1]) { f.font(size); assert.equal(f.input('Passwort').key, inputKey); assert.equal(f.input('Passwort').props.value, 'local-test-password'); assert.equal(f.input('Profilname').props.value, 'local_guest'); }
  f.press('Schon dabei? Anmelden'); assert.equal(f.input('Passwort').props.secureTextEntry, true); assert.equal(f.calls.length, 0);
});
