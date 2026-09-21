const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const jsx = (type, props, key) => ({ type, props, key });
const find = (node, type) => !node ? [] : Array.isArray(node) ? node.flatMap(n => find(n, type)) : [...(node.type === type ? [node] : []), ...find(node.props?.children, type)];
const label = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(label).join('') : label(node?.props?.children ?? '');
const byLabel = (tree, name) => find(tree, 'Button').find(n => n.props.accessibilityLabel === name || label(n) === name);
function uniqueKeys(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(uniqueKeys); return; }
  const children = [node.props?.children].flat(Infinity).filter(Boolean);
  const keys = children.filter(n => n.key != null).map(n => n.key);
  assert.equal(new Set(keys).size, keys.length, 'sibling keys must remain unique');
  children.forEach(uniqueKeys);
}
// Local event/state harness; native layout and actual iOS preference changes
// are checked separately in Simulator. No backend module is loaded here.
function fixture(file) {
  let cursor = 0, fontScale = 1.118, reduced = false, finishUpload;
  const slots = [], calls = [];
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useMemo(fn) { return fn(); }, useCallback(fn) { return fn; },
    // ⚠️ SOFORT ausfuehren, nicht verschlucken. `ChoiceSheet` klappt darin die
    // Gruppe des gewaehlten Kindes auf — ein Stub, der nichts tut, pruefte das
    // Geruest statt das Verhalten (Uebergabe: „Ein Test, der an einem
    // fehlenden Hook scheitert, prueft das Geruest").
    useEffect(fn) { fn(); },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
  };
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : ['2026-09-08T12:00:00'])); } static now() { return new Clock().getTime(); } }
  const deps = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', Text: 'Text', TextInput: 'Input', ScrollView: 'Scroll', Modal: 'Modal', ActivityIndicator: 'Spinner',
      useWindowDimensions: () => ({ fontScale, width: 402 }), StyleSheet: { create: s => s, hairlineWidth: 1 } },
    './PressFeedback': { PressFeedback: 'Button' }, '../lib/useReducedMotion': { useReducedMotion: () => reduced },
    // `FormInput` ist seit dem 21.09.2026 das gemeinsame Feld (weiss, Haarlinie,
    // Fokus-Rahmen). Als Attrappe traegt es denselben Knotentyp wie ein nacktes
    // `TextInput` — so pruefen die bestehenden Zusicherungen weiter das
    // Verhalten und nicht die Verpackung.
    './FormInput': { FormInput: 'Input' },
    '../components/FormInput': { FormInput: 'Input' },
    '../../components/FormInput': { FormInput: 'Input' },
    '../theme/tokens': { ui: {}, radius: {}, space: { xs: 4, sm: 8, md: 12, lg: 20, xl: 32 } },
    'expo-image': { Image: 'Image' }, 'lucide-react-native': {},
    '../lib/useSchedule': { MAX_WEEKS: 4, formatSlot: value => value, formatUntil: value => value, scheduleErrorText: value => value },
    './FeedbackState': { FeedbackState: 'Feedback' },
    '../lib/uploadImage': { pickAndUpload: () => new Promise(resolve => { finishUpload = resolve; }) },
    '../lib/useCategories': { useCategoryOptions: () => ({ groups: [{ slug: 'mode', name: 'Mode', children: [{ slug: 'kleider', name: 'Kleider' }] }] }) },
    // Seit dem 21.09.2026 liegt die Auswahl im Blatt, nicht mehr als Kachelwand
    // im Formular. `CategoryPicker` zeigt nur noch Zeile + Zusammenfassung; das
    // Verhalten der Liste wird an `ChoiceSheet` selbst geprueft.
    './SheetHeader': { SheetHeader: 'SheetHeader' },
    './ChoiceSheet': { ChoiceField: 'ChoiceField', ChoiceSheet: 'ChoiceSheet' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
  };
  const hook = ts.transpileModule(fs.readFileSync(path.join(root, 'lib/useSellerDraft.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const hookContext = vm.createContext({ exports: {}, require: name => { assert.equal(name, 'react'); return react; } });
  vm.runInContext(hook, hookContext);
  deps['../lib/useSellerDraft'] = hookContext.exports;
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const context = vm.createContext({ exports: {}, Date: Clock, require(name) { assert.ok(name in deps, `unexpected dependency: ${name}`); return deps[name]; } });
  vm.runInContext(code, context);
  const component = Object.values(context.exports)[0];
  return { calls, setFont: value => { fontScale = value; }, setReduced: value => { reduced = value; }, finishUpload: value => finishUpload(value),
    render(props) { cursor = 0; const tree = component(props); uniqueKeys(tree); return tree; } };
}
function planner() {
  const f = fixture('components/SchedulePlanner.tsx');
  const props = { plans: [], busy: false, onPlan: value => f.calls.push(value), onCancel: () => assert.fail('unexpected cancel') };
  return { ...f, props, render: extra => f.render({ ...props, ...extra }) };
}
test('empty or whitespace-only schedule stays disabled and a busy draft cannot submit', () => {
  const p = planner(); let tree = p.render();
  assert.equal(byLabel(tree, 'Termin eintragen').props.disabled, true);
  find(tree, 'Input')[0].props.onChangeText('   '); tree = p.render();
  assert.equal(byLabel(tree, 'Termin eintragen').props.accessibilityState.disabled, true);
  find(tree, 'Input')[0].props.onChangeText('UI Vorschau'); tree = p.render();
  assert.equal(byLabel(tree, 'Termin eintragen').props.disabled, false);
  const pending = byLabel(p.render({ busy: true }), 'Termin eintragen');
  assert.equal(pending.props.disabled, true); assert.equal(pending.props.accessibilityState.busy, true);
  assert.equal(p.calls.length, 0);
});
test('closing time selection preserves the draft and never announces a show', () => {
  const p = planner(); let tree = p.render(); find(tree, 'Input')[0].props.onChangeText('UI Vorschau'); tree = p.render();
  find(tree, 'Button').find(n => n.props.accessibilityLabel?.startsWith('Wann:')).props.onPress(); tree = p.render();
  assert.equal(find(tree, 'Modal')[0].props.visible, true);
  byLabel(tree, 'in 30 Min').props.onPress(); tree = p.render(); byLabel(tree, 'Auswahl übernehmen').props.onPress(); tree = p.render();
  assert.equal(find(tree, 'Modal')[0].props.visible, false); assert.equal(find(tree, 'Input')[0].props.value, 'UI Vorschau');
  assert.equal(p.calls.length, 0);
  find(tree, 'Button').find(n => n.props.accessibilityLabel?.startsWith('Wann:')).props.onPress(); tree = p.render();
  find(tree, 'Modal')[0].props.onRequestClose(); assert.equal(find(p.render(), 'Modal')[0].props.visible, false);
});
test('font and reduced-motion changes keep title, open sheet and selected time', () => {
  const p = planner(); let tree = p.render(); const inputKey = find(tree, 'Input')[0].key;
  find(tree, 'Input')[0].props.onChangeText('UI Vorschau'); tree = p.render();
  find(tree, 'Button').find(n => n.props.accessibilityLabel?.startsWith('Wann:')).props.onPress(); tree = p.render();
  byLabel(tree, 'in 1 Std').props.onPress(); tree = p.render();
  for (const [font, reduced] of [[1.786, true], [1.118, false]]) {
    p.setFont(font); p.setReduced(reduced); tree = p.render();
    assert.equal(find(tree, 'Input')[0].props.value, 'UI Vorschau'); assert.equal(find(tree, 'Input')[0].key, inputKey);
    assert.equal(find(tree, 'Modal')[0].props.visible, true); assert.equal(find(tree, 'Modal')[0].props.animationType, reduced ? 'none' : 'slide');
    assert.equal(byLabel(tree, 'in 1 Std').props.accessibilityState.selected, true);
  }
  assert.equal(p.calls.length, 0);
});
test('pending cover upload blocks announcement until its result belongs to the draft', async () => {
  const p = planner(); let tree = p.render(); find(tree, 'Input')[0].props.onChangeText('UI Vorschau'); tree = p.render();
  byLabel(tree, 'Titelbild hinzufügen').props.onPress(); tree = p.render();
  assert.equal(byLabel(tree, 'Termin eintragen').props.disabled, true); assert.equal(byLabel(tree, 'Termin eintragen').props.accessibilityState.busy, true);
  p.finishUpload('https://example.test/cover.jpg'); await new Promise(resolve => setImmediate(resolve)); tree = p.render();
  assert.equal(byLabel(tree, 'Termin eintragen').props.disabled, false);
  byLabel(tree, 'Termin eintragen').props.onPress(); assert.equal(p.calls.length, 1); assert.equal(p.calls[0].coverUrl, 'https://example.test/cover.jpg');
});
// ── Kategorie: Zeile + Blatt (seit 21.09.2026) ──────────────────────────────
// Vorher stand hier EIN Test ueber eine Kachelwand. Die Wand ist weg; das
// Verhalten liegt jetzt in zwei Bauteilen und wird in zwei Tests geprueft.
test('die Kategoriezeile nennt Ober- UND Unterkategorie und ueberlebt den Schriftwechsel', () => {
  const f = fixture('components/CategoryPicker.tsx');
  const props = { value: null, onChange: value => { props.value = value; } };

  // Ohne Wahl: der Platzhalter, nicht ein erfundener Wert.
  let field = find(f.render(props), 'ChoiceField')[0];
  assert.ok(field, 'die Zeile fehlt');
  assert.equal(field.props.value, null);
  assert.equal(field.props.placeholder, 'Kategorie wählen');

  // ⚠️ Ober- UND Unterkategorie. „Kleider" allein sagt nicht, ob der Artikel
  // unter Mode oder unter Sammeln liegt — und genau daran entscheidet sich,
  // wo ihn jemand findet.
  props.value = 'kleider';
  f.setFont(1.786);
  assert.equal(find(f.render(props), 'ChoiceField')[0].props.value, 'Mode · Kleider');

  // Die Oberkategorie allein ist eine gueltige Angabe.
  props.value = 'mode';
  assert.equal(find(f.render(props), 'ChoiceField')[0].props.value, 'Mode');
});

test('das Auswahlblatt verfeinert, klappt vorgewaehlte Gruppen auf und waehlt ab', () => {
  const f = fixture('components/ChoiceSheet.tsx');
  let closed = 0;
  const props = {
    visible: true, title: 'Kategorie', value: null, clearLabel: 'Keine Kategorie',
    onClose: () => { closed += 1; },
    onChange: value => { props.value = value; },
    options: [{ key: 'mode', label: 'Mode', children: [{ key: 'kleider', label: 'Kleider' }] },
              { key: 'schuhe', label: 'Schuhe' }],
  };

  // Ein Elternteil waehlt sich selbst UND klappt auf — es schliesst NICHT.
  let tree = f.render(props);
  byLabel(tree, 'Mode').props.onPress();
  tree = f.render(props);
  assert.equal(props.value, 'mode');
  assert.equal(closed, 0, 'ein Elternteil darf das Blatt nicht schliessen');
  assert.equal(byLabel(tree, 'Mode').props.accessibilityState.expanded, true);
  assert.ok(byLabel(tree, 'Mode, Kleider'), 'die Kinder fehlen');

  // Ein Kind waehlt und schliesst.
  byLabel(tree, 'Mode, Kleider').props.onPress();
  assert.equal(props.value, 'kleider');
  assert.equal(closed, 1);

  // ⚠️ Die Gruppe bleibt offen, nachdem ein Kind gewaehlt wurde. Der Effekt
  // darf NICHT bei jeder Wertaenderung neu zuklappen — genau das tat er im
  // ersten Anlauf, und die Kinder blitzten beim Tipp auf „Mode" nur auf.
  tree = f.render(props);
  assert.ok(byLabel(tree, 'Mode, Kleider'), 'die Gruppe des gewaehlten Kindes bleibt zu');
  assert.equal(byLabel(tree, 'Mode').props.accessibilityState.selected, true);

  // ⚠️ Und beim erneuten OEFFNEN klappt sie von selbst auf.
  // Zweimal rendern: Der React-Stub fuehrt Effekte waehrend des Renderns aus,
  // React danach — der erste Durchlauf liefert also noch den Baum von vorher.
  props.visible = false; f.render(props);
  props.visible = true; f.render(props); tree = f.render(props);
  assert.ok(byLabel(tree, 'Mode, Kleider'), 'beim Oeffnen bleibt die Gruppe des Kindes zu');

  // Ein Blatt ohne Kinder waehlt sofort und schliesst.
  byLabel(tree, 'Schuhe').props.onPress();
  assert.equal(props.value, 'schuhe');
  assert.equal(closed, 2);

  // ⚠️ Abwaehlen braucht eine eigene Zeile. Bei Kacheln waehlte ein zweiter
  // Tipp ab — in einer Liste erwartet das niemand.
  tree = f.render(props);
  byLabel(tree, 'Keine Kategorie').props.onPress();
  assert.equal(props.value, null);
  assert.equal(closed, 3);
});
