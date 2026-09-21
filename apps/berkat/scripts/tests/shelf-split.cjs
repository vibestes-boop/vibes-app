// Wischreihe und Raster teilen sich EINEN Bestand. Reine Rechnung, kein Backend.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
function load(file) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = vm.createContext({ exports: {}, require: () => ({}) });
  vm.runInContext(code, context);
  return context.exports;
}
const { splitShelf, RAIL_PREVIEW, RAIL_MIN } = load('lib/shelfSplit.ts');

/** Rangfolge = Eingangsreihenfolge; `created_at` läuft bewusst GEGEN sie. */
const pool = (count, day = (i) => 30 - i) =>
  Array.from({ length: count }, (_, i) => ({
    id: `a${String(i).padStart(2, '0')}`,
    created_at: `2026-09-${String(day(i)).padStart(2, '0')}T10:00:00.000000Z`,
  }));
// `Array.from` und nicht `.map`: Die Zeilen kommen aus einem `vm`-Kontext,
// ihr Array-Prototyp ist ein anderer. `deepEqual` prueft den mit — ein
// `.map`-Ergebnis waere "same structure but not reference-equal".
const ids = (rows) => Array.from(rows, (row) => row.id);

test('kein Artikel steht zweimal auf der Startseite', () => {
  const { rail, grid } = splitShelf(pool(16), 8);
  assert.equal(rail.length, 8);
  assert.equal(grid.length, 8);
  const seen = new Set([...ids(rail), ...ids(grid)]);
  assert.equal(seen.size, 16, 'Reihe und Raster dürfen sich nicht überschneiden');
  // Das ist der ganze Zweck: Was die Reihe trägt, trägt das Raster nicht.
  for (const item of rail) assert.ok(!grid.some((g) => g.id === item.id));
});

test('das Raster verliert nie etwas — die Reihe bekommt nur den Überhang', () => {
  // Zwölf Artikel: acht fürs Raster wie bisher, vier für die Reihe.
  const twelve = splitShelf(pool(12), 8);
  assert.equal(twelve.grid.length, 8, 'Raster bleibt voll');
  assert.equal(twelve.rail.length, 4, 'Reihe bekommt genau den Überhang');

  // Auch bei viel Bestand bleibt das Raster bei acht, die Reihe bei acht.
  const many = splitShelf(pool(40), 8);
  assert.equal(many.grid.length, 8);
  assert.equal(many.rail.length, RAIL_PREVIEW);
});

test('zu wenig Überhang heißt keine Reihe, nicht eine kurze', () => {
  for (const count of [0, 1, 8, 9, 10, 11]) {
    const { rail, grid } = splitShelf(pool(count), 8);
    assert.deepEqual(ids(rail), [], `${count} Artikel dürfen keine Reihe ergeben`);
    assert.equal(grid.length, Math.min(count, 8));
  }
  // Genau an der Grenze kippt es — und zwar auf die volle Mindestlänge.
  assert.equal(splitShelf(pool(8 + RAIL_MIN), 8).rail.length, RAIL_MIN);
});

test('die Reihe zeigt das Neueste, das Raster behält seine Rangfolge', () => {
  // `created_at` läuft gegen die Rangfolge: a00 ist der ÄLTESTE, a15 der neueste.
  const rows = pool(16, (i) => i + 1);
  const { rail, grid } = splitShelf(rows, 8);
  assert.deepEqual(ids(rail), ['a15', 'a14', 'a13', 'a12', 'a11', 'a10', 'a09', 'a08']);
  // Das Raster bleibt in der Reihenfolge, in der es hereinkam — die Rangfolge
  // aus `selectDiscovery` überlebt das Aufteilen.
  assert.deepEqual(ids(grid), ['a00', 'a01', 'a02', 'a03', 'a04', 'a05', 'a06', 'a07']);
});

test('gleicher Zeitstempel ordnet sich fest, nicht nach Eingang', () => {
  const same = '2026-09-20T10:00:00.000000Z';
  const rows = [
    { id: 'b', created_at: same }, { id: 'd', created_at: same },
    { id: 'a', created_at: same }, { id: 'c', created_at: same },
    ...pool(8, () => 1),
  ];
  const first = splitShelf(rows, 8);
  // Rückwärts hereingereicht muss dieselbe Reihe herauskommen.
  const second = splitShelf([...rows].reverse(), 8);
  assert.deepEqual(ids(first.rail), ['d', 'c', 'b', 'a']);
  assert.deepEqual(ids(second.rail), ['d', 'c', 'b', 'a']);
});

test('der Vorrat selbst bleibt unangetastet', () => {
  const rows = pool(16);
  const before = ids(rows);
  splitShelf(rows, 8);
  // `sort` arbeitet an Ort und Stelle — eine Kopie ist Pflicht, sonst stünde
  // das Raster nach dem ersten Aufteilen in der Zeitreihenfolge.
  assert.deepEqual(ids(rows), before);
});
