// Run from apps/berkat: node --test scripts/tests/saved-search-filters.cjs
// Pure helpers from lib/useSavedSearches.ts; no backend, no React.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
// Rueckgaben entstehen im vm-Realm; `deepStrictEqual` verlangt Referenz-
// gleiche Prototypen und scheitert sonst trotz gleichen Inhalts.
const plain = (value) => JSON.parse(JSON.stringify(value));

function load() {
  const source = fs.readFileSync(path.join(root, 'lib/useSavedSearches.ts'), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const deps = {
    '@tanstack/react-query': { useMutation: () => ({}), useQuery: () => ({}), useQueryClient: () => ({}) },
    './supabase': { supabase: {} },
  };
  const context = vm.createContext({ exports: {}, require: (name) => deps[name] });
  vm.runInContext(code, context);
  return context.exports;
}

const lib = load();
const row = (over = {}) => ({
  id: 'r1', query: 'abaya', created_at: '2026-09-21T00:00:00Z', last_notified_at: null,
  ...lib.NO_SAVED_FILTERS, ...over,
});

// Bis zum 21.09.2026 verglich shop.tsx nur den Text. Mit Filtern haette das
// Lesezeichen bei „Abaya" als gesetzt gegolten, obwohl „Abaya in Groesse 38"
// gespeichert war -- und ein zweiter Tipp haette die falsche Zeile geloescht.
test('a saved search is the same one only when text AND filters match', () => {
  const stored = row({ size: '38', color: 'Schwarz' });
  const same = { ...lib.NO_SAVED_FILTERS, size: '38', color: 'Schwarz' };
  assert.equal(lib.sameSavedSearch(stored, 'abaya', same), true);
  // Gleicher Text, keine Filter -> eine ANDERE Suche.
  assert.equal(lib.sameSavedSearch(stored, 'abaya', lib.NO_SAVED_FILTERS), false);
  // Gleicher Text, ein Filter abweichend.
  assert.equal(lib.sameSavedSearch(stored, 'abaya', { ...same, size: '40' }), false);
  // Anderer Text, gleiche Filter.
  assert.equal(lib.sameSavedSearch(stored, 'hijab', same), false);
  // Gross-/Kleinschreibung und Leerraum wie im eindeutigen Index der
  // Datenbank (`lower(btrim(...))`) -- sonst sagt der Client „noch nicht
  // gespeichert", das INSERT scheitert mit 23505, und der Nutzer liest
  // „hast du schon" direkt nach „speichern".
  assert.equal(lib.sameSavedSearch(stored, '  ABAYA ', { ...same, color: ' schwarz ' }), true);
  // Leerer String und null sind dasselbe „nicht gesetzt".
  assert.equal(lib.sameSavedSearch(row({ brand: null }), 'abaya',
    { ...lib.NO_SAVED_FILTERS, brand: '   ' }), true);
});

test('price bounds count as one filter and compare exactly', () => {
  assert.equal(lib.savedFilterCount(lib.NO_SAVED_FILTERS), 0);
  assert.equal(lib.savedFilterCount({ ...lib.NO_SAVED_FILTERS, minPriceCents: 1000, maxPriceCents: 5000 }), 1);
  assert.equal(lib.savedFilterCount({ ...lib.NO_SAVED_FILTERS, size: '38', maxPriceCents: 5000 }), 2);
  const stored = row({ minPriceCents: 1000 });
  assert.equal(lib.sameSavedSearch(stored, 'abaya', { ...lib.NO_SAVED_FILTERS, minPriceCents: 1000 }), true);
  assert.equal(lib.sameSavedSearch(stored, 'abaya', { ...lib.NO_SAVED_FILTERS, minPriceCents: 1001 }), false);
});

// Der Sprung aus der Merkliste muss die Suche VOLLSTAENDIG wieder aufmachen.
// Faellt unterwegs ein Filter weg, zeigt die Liste mehr als die Zeile
// verspricht -- zwei Wahrheiten ueber dieselbe gespeicherte Suche.
test('href and params are exact inverses, including characters that need escaping', () => {
  const stored = row({
    query: 'schwarze abaya & co', category: 'mode', condition: 'neu',
    color: 'Schwarz', brand: 'Zara/Home', size: '38', city: 'Frankfurt am Main',
    minPriceCents: 1000, maxPriceCents: 5000,
  });
  const href = lib.savedSearchHref(stored);
  assert.ok(href.startsWith('/shop?q='));
  const params = Object.fromEntries(
    new URLSearchParams(href.slice(href.indexOf('?') + 1)).entries(),
  );
  assert.equal(params.q, stored.query);
  assert.deepEqual(plain(lib.savedFiltersFromParams(params)), {
    category: 'mode', condition: 'neu', color: 'Schwarz', brand: 'Zara/Home',
    size: '38', city: 'Frankfurt am Main', minPriceCents: 1000, maxPriceCents: 5000,
  });
});

test('a search without filters carries only the words', () => {
  const href = lib.savedSearchHref(row());
  assert.equal(href, '/shop?q=abaya');
  assert.deepEqual(plain(lib.savedFiltersFromParams({})), plain(lib.NO_SAVED_FILTERS));
});

// Ein Parameter aus einer Adresszeile ist Fremdeingabe, auch wenn wir ihn
// selbst geschrieben haben -- und die Spalte ist `integer`.
test('price parameters accept only plain whole numbers', () => {
  const bad = ['-5', '1.5', '1e3', '12,50', '1234567890', '', 'abc'];
  for (const value of bad) {
    assert.equal(lib.savedFiltersFromParams({ min: value }).minPriceCents, null, value);
  }
  assert.equal(lib.savedFiltersFromParams({ min: '0' }).minPriceCents, 0);
  // Leerraum wird abgeschnitten, bevor geprueft wird -- " 10 " ist eine Zahl.
  assert.equal(lib.savedFiltersFromParams({ min: ' 10 ' }).minPriceCents, 10);
  assert.equal(lib.savedFiltersFromParams({ max: '999999999' }).maxPriceCents, 999999999);
  // Mehrfach gesetzter Parameter: der erste gilt.
  assert.equal(lib.savedFiltersFromParams({ size: ['38', '40'] }).size, '38');
});
