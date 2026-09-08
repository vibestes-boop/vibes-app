const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function moduleFrom(file, requireFn = () => { throw new Error('Unexpected runtime dependency'); }) {
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const context = vm.createContext({ exports: {}, require: requireFn });
  vm.runInContext(code, context);
  return context.exports;
}
const { sellerShopRows } = moduleFrom('lib/sellerShopRows.ts');
const items = n => Array.from({ length: n }, (_, i) => Object.freeze({ id: `item-${i}`, title: `Item ${i}` }));
const realCells = (rows, kind) => rows.filter(r => r.rowType === kind).flatMap(r => r.cells).filter(Boolean);

for (const count of [0, 1, 2, 3, 59, 60]) test(`${count} offers keep their order, identity and two equal-width cells per row`, () => {
  const offers = Object.freeze(items(count));
  const rows = sellerShopRows(offers, [], false);
  const grid = rows.filter(r => r.rowType === 'listings');
  assert.equal(grid.length, Math.ceil(count / 2));
  assert.ok(grid.every(r => r.cells.length === 2));
  realCells(rows, 'listings').forEach((item, i) => assert.equal(item, offers[i]));
  assert.equal(realCells(rows, 'listings').length, count);
  assert.equal(rows.filter(r => r.rowType === 'shop-footer').length, count ? 1 : 0);
  assert.equal(rows.at(-1).rowType, 'history');
  if (count % 2) assert.equal(grid.at(-1).cells[1], null);
});

test('cached sales stay hidden while history is collapsed', () => {
  assert.equal(realCells(sellerShopRows(items(2), items(30), false), 'sold').length, 0);
});
for (const count of [0, 1, 2, 3, 4, 30]) test(`${count} sales follow the history control in padded three-column rows`, () => {
  const sold = items(count);
  const rows = sellerShopRows(items(3), sold, true);
  const kinds = Array.from(rows, r => r.rowType);
  assert.deepEqual(kinds.slice(0, 4), ['listings', 'listings', 'shop-footer', 'history']);
  assert.ok(kinds.slice(4).every(kind => kind === 'sold'));
  assert.equal(rows.filter(r => r.rowType === 'sold').length, Math.ceil(count / 3));
  assert.ok(rows.filter(r => r.rowType === 'sold').every(r => r.cells.length === 3));
  realCells(rows, 'sold').forEach((item, i) => assert.equal(item, sold[i]));
  assert.equal(realCells(rows, 'sold').length, count);
  assert.equal(new Set(rows.map(r => r.id)).size, rows.length, 'section IDs cannot collide with offer/sale IDs');
});

test('appending and opening history preserve existing row keys', () => {
  const offers = items(5);
  const before = sellerShopRows(offers, [], false);
  const after = sellerShopRows([...offers, { id: 'next' }], items(3), true);
  before.forEach((row, i) => assert.equal(after[i].id, row.id));
});

const jsx = (type, props) => ({ type, props });
const navigation = [];
const { SellerListingRow, SellerSoldRow } = moduleFrom('components/SellerShopRow.tsx', name => {
  if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
  if (name === 'react') return { memo: fn => fn };
  if (name === 'expo-router') return { router: { push: route => navigation.push(route) } };
  if (name === 'react-native') return { View: 'View', Text: 'Text', StyleSheet: { create: s => s } };
  if (name === 'expo-image') return { Image: 'Image' };
  if (name.includes('ListingCard')) return { ListingCard: 'ListingCard' };
  if (name.includes('useAuction')) return { formatEuro: cents => `${cents / 100} €` };
  return { radius: {}, ratio: {}, space: {}, stage: {}, ui: {} };
});
const collect = (view, type) => !view ? [] : Array.isArray(view) ? view.flatMap(v => collect(v, type)) : [
  ...(view.type === type ? [view] : []), ...collect(view.props?.children, type),
];
test('virtual offer rows preserve card identity, ownership, saved state and separate actions', () => {
  const offers = items(2), toggles = [];
  const row = SellerListingRow({ cells: offers, mine: false, savedIds: new Set([offers[1].id]), onToggleSaved: (...args) => toggles.push(args) });
  const cards = collect(row, 'ListingCard');
  assert.equal(cards.length, 2);
  assert.equal(cards[0].props.listing, offers[0]);
  assert.equal(cards[0].props.mine, false);
  assert.equal(cards[0].props.saved, false);
  assert.equal(cards[1].props.saved, true);
  cards[1].props.onToggleSaved();
  assert.deepEqual(toggles, [[offers[1].id, true]]);
  assert.equal(navigation.length, 0);
  cards[0].props.onPress();
  assert.deepEqual(navigation, [`/listing/${offers[0].id}`]);
  const own = SellerListingRow({ cells: [offers[0], null], mine: true, onToggleSaved: () => {} });
  assert.equal(collect(own, 'ListingCard')[0].props.mine, true);
  assert.equal(collect(own, 'ListingCard').length, 1);
});
test('sold history retains placeholders and remains noninteractive', () => {
  const row = SellerSoldRow({ cells: [{ id: 'sold', title: 'Sold', current_bid_cents: 500, image_url: null }, null, null] });
  assert.equal(row.props.children.length, 3);
  assert.equal(collect(row, 'Text').length, 2);
  const walk = v => { if (!v) return; if (Array.isArray(v)) return v.forEach(walk); assert.equal(v.props?.onPress, undefined); walk(v.props?.children); };
  walk(row);
});
