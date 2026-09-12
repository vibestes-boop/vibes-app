const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { QueryClient, QueryObserver } = require('@tanstack/query-core');
const root = path.resolve(__dirname, '../..');
const plain = value => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(resolve => setImmediate(resolve));
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const context = vm.createContext({ exports: {}, require: name => mocks[name] ?? {}, Date });
  vm.runInContext(code, context);
  return context.exports;
}
const lib = load('lib/usePurchaseStatus.ts');
const now = Date.parse('2026-09-12T12:00:00Z');
const auction = { id: 'won-item', seller_id: 'seller', cart_id: 'its-cart' };
const open = { id: 'its-cart', status: 'open', closes_at: '2026-09-13T12:00:00Z' };
const state = (cart = open, order = null) => ({ auction, cart, order });
for (const status of ['paid', 'shipped', 'delivered']) test(`${status}: the exact confirmed order wins over an old expired cart`, () => {
  const copy = lib.purchasePresentation(state({ ...open, status: 'expired' }, { id: 'its-order', status }), now);
  assert.equal(copy.target, '/order/its-order'); assert.equal(copy.action, 'Bestellung ansehen'); assert.equal(copy.tone, 'success');
});
for (const status of ['open', 'checkout_pending']) test(`${status}: payment goes through the matching package, never the seller's unrelated cart`, () => {
  const copy = lib.purchasePresentation(state({ ...open, status }), now);
  assert.equal(copy.target, '/purchases?auctionId=won-item'); assert.equal(copy.title, 'Zahlung offen');
  assert.equal(lib.canPayCart({ ...open, status }, now), true);
});
for (const cart of [{ ...open, closes_at: new Date(now).toISOString() }, { ...open, status: 'expired' }, { ...open, status: 'cancelled' }]) test(`${cart.status}/${cart.closes_at}: closed packages offer contact, not payment`, () => {
  const copy = lib.purchasePresentation(state(cart), now);
  assert.equal(copy.target, '/messages/seller?listing=won-item'); assert.equal(lib.canPayCart(cart, now), false);
});
for (const purchase of [state(null), state({ ...open, closes_at: 'invalid' }), state({ ...open, status: 'checked_out' }), state(open, { id: 'o', status: 'unknown' })]) test(`incomplete status is explicitly unknown (${JSON.stringify(purchase.cart)})`, () => {
  const copy = lib.purchasePresentation(purchase, now);
  assert.equal(copy.target, null); assert.equal(copy.action, 'Status erneut laden');
});
test('a direct-settlement win remains navigable without implying a Berkat payment', () => {
  const copy = lib.purchasePresentation({ auction: { ...auction, cart_id: null }, cart: null, order: null }, now);
  assert.equal(copy.title, 'Zuschlag bestätigt'); assert.equal(copy.target, '/messages/seller?listing=won-item');
  assert.equal(lib.purchasePresentation(null, now).target, '/purchases');
  assert.equal(lib.canPayCart(undefined, now), false);
});
function config(request, { buyer = 'buyer', id = 'won-item', enabled = true, orderDetail = false, packages = false } = {}) {
  let options; const calls = [];
  const api = { from(table) {
    const call = { table, filters: [] };
    const b = { then(ok, fail) { calls.push(call); return Promise.resolve().then(() => request(call)).then(ok, fail); } };
    for (const name of ['select', 'retry', 'abortSignal', 'limit', 'order']) b[name] = value => { call[name] = value; return b; };
    for (const name of ['eq', 'in', 'is']) b[name] = (...args) => { call.filters.push([name, ...args]); return b; };
    b.maybeSingle = () => b;
    return b;
  } };
  const hooks = load(packages ? 'lib/usePurchases.ts' : orderDetail ? 'lib/useMyOrders.ts' : 'lib/usePurchaseStatus.ts', {
    '@tanstack/react-query': { useQuery: o => { options = o; return {}; } }, './supabase': { supabase: api },
  });
  if (packages) hooks.useMyCarts(buyer, enabled); else if (orderDetail) hooks.useMyOrder(id, buyer); else hooks.usePurchaseStatus(id, buyer, enabled);
  return { options: { ...options, queryKey: plain(options.queryKey), retry: false }, calls };
}
async function observe(config, check) {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const o = new QueryObserver(c, config.options), stop = o.subscribe(() => {});
  try { await flush(); await check(o, c); } finally { stop(); c.clear(); }
}
test('exact auction/cart/order resolution scopes cache and every read to this buyer', async () => {
  const r = config(q => ({ data: q.table === 'live_auctions' ? auction : q.table === 'auction_carts' ? open : { id: 'right-order', status: 'paid' } }));
  await observe(r, async o => {
    assert.deepEqual(r.options.queryKey, ['berkat', 'purchase-status', 'buyer', 'won-item']);
    assert.equal(lib.purchasePresentation(o.getCurrentResult().data, now).target, '/order/right-order');
    assert.deepEqual(r.calls.map(q => q.filters), [
      [['eq', 'id', 'won-item'], ['eq', 'winner_id', 'buyer'], ['eq', 'status', 'sold']],
      [['eq', 'id', 'its-cart'], ['eq', 'buyer_id', 'buyer']],
      [['eq', 'cart_id', 'its-cart'], ['eq', 'buyer_id', 'buyer']],
    ]);
    assert.ok(r.calls.every(q => q.abortSignal && q.retry === false));
  });
});
for (const opts of [{ buyer: null }, { id: null }, { enabled: false }]) test(`guest/hidden/missing routes do not fetch: ${JSON.stringify(opts)}`, async () => {
  const r = config(() => { throw new Error('must not fetch'); }, opts);
  await observe(r, async () => assert.equal(r.calls.length, 0));
});
test('missing ownership ends resolution before any package query', async () => {
  const r = config(() => ({ data: null }));
  await observe(r, async o => { assert.equal(o.getCurrentResult().data, null); assert.equal(r.calls.length, 1); });
});
for (const failing of ['live_auctions', 'auction_carts', 'product_orders']) test(`read failure at ${failing} never becomes an unpaid purchase; retry recovers`, async () => {
  let fail = true;
  const r = config(q => fail && q.table === failing ? { error: { code: 'offline' } } : { data: q.table === 'live_auctions' ? auction : q.table === 'auction_carts' ? open : { id: 'o', status: 'paid' } });
  await observe(r, async o => { assert.equal(o.getCurrentResult().isError, true); assert.equal(o.getCurrentResult().data, undefined); fail = false; await o.refetch(); assert.equal(o.getCurrentResult().data.order.status, 'paid'); });
});
test('leaving a purchase view aborts the query', async () => {
  let resolve; const r = config(() => new Promise(done => { resolve = done; }));
  await observe(r, async o => { o.destroy(); assert.equal(r.calls[0].abortSignal.aborted, true); resolve({ data: null }); await flush(); });
});
test('order detail has buyer-scoped cache; failed item reads are errors rather than empty orders', async () => {
  const r = config(q => q.table === 'product_orders' ? { data: { id: 'o', cart_id: 'its-cart' } } : { error: { code: 'offline' } }, { id: 'o', orderDetail: true });
  assert.deepEqual(r.options.queryKey, ['berkat', 'my-order', 'buyer', 'o']);
  await observe(r, async o => { assert.equal(o.getCurrentResult().isError, true); assert.ok(r.calls[1].filters.some(f => f[1] === 'winner_id' && f[2] === 'buyer')); });
});
function card(query, extra = {}) {
  const pushes = []; let retries = 0, packages = 0;
  const runtime = require('react/jsx-runtime');
  const q = { isPending: false, isError: false, isFetching: false, refetch: () => { retries++; }, ...query };
  const tree = load('components/PurchaseStatusCard.tsx', {
    react: { useCallback: fn => fn }, 'react/jsx-runtime': runtime,
    'expo-router': { useFocusEffect: () => {}, useRouter: () => ({ push: target => pushes.push(target) }) },
    '@react-navigation/native': { useIsFocused: () => true },
    'react-native': { ActivityIndicator: 'Spinner', Text: 'Text', View: 'View', StyleSheet: { create: x => x }, useWindowDimensions: () => ({ fontScale: 1 }) },
    'lucide-react-native': {}, './PressFeedback': { PressFeedback: 'Button' },
    '../lib/usePurchaseStatus': { ...lib, usePurchaseStatus: () => q }, '../lib/usePurchaseClock': { usePurchaseClock: () => () => now },
    '../theme/tokens': { ui: {}, space: {}, radius: {} },
  }).PurchaseStatusCard({ auctionId: 'won-item', userId: 'buyer', onRefreshPackage: () => { packages++; }, ...extra });
  const nodes = [];
  function walk(n) { if (Array.isArray(n)) return n.forEach(walk); if (n && typeof n === 'object') { nodes.push(n); walk(n.props?.children); } }
  walk(tree);
  return { buttons: nodes.filter(n => n.type === 'Button'), pushes, counters: () => ({ retries, packages }) };
}
test('a stale paid response plus a refetch error renders retry, not navigation or payment', () => {
  const c = card({ data: state(open, { id: 'o', status: 'paid' }), isError: true });
  c.buttons[0].props.onPress(); assert.deepEqual(c.pushes, []); assert.equal(c.counters().retries, 1);
});
test('a resolved paid card opens only its order; fetching disables the action', () => {
  const c = card({ data: state(open, { id: 'o', status: 'paid' }) }); c.buttons[0].props.onPress(); assert.deepEqual(c.pushes, ['/order/o']);
  assert.equal(card({ data: state(), isFetching: true }).buttons[0].props.disabled, true);
});
test('local matching package hides the recursive navigation; missing package retries both reads', () => {
  assert.equal(card({ data: state() }, { localPackage: 'visible' }).buttons.length, 0);
  const c = card({ data: state() }, { localPackage: 'missing' }); c.buttons[0].props.onPress();
  assert.deepEqual(c.pushes, []); assert.deepEqual(c.counters(), { retries: 1, packages: 1 });
});

test('closed history is bounded separately; every open cart keeps its items and shipping tier', async () => {
  const r = config(q => {
    if (q.table === 'live_auctions') return { data: [{ id: 'won-item', cart_id: 'its-cart', title: 'Item', current_bid_cents: 1200, shipping_tier: 2 }] };
    const statuses = q.filters.find(f => f[0] === 'in' && f[1] === 'status')[2];
    return { data: statuses.includes('open') ? [{ ...open, seller_id: 'seller' }] : [] };
  }, { packages: true });
  await observe(r, async o => {
    const [active, history, items] = r.calls;
    assert.equal(active.limit, undefined); assert.equal(history.limit, 30);
    assert.deepEqual(plain(active.filters.find(f => f[0] === 'in')[2]), ['open', 'checkout_pending']);
    assert.deepEqual(plain(history.filters.find(f => f[0] === 'in')[2]), ['expired', 'cancelled']);
    assert.ok([active, history].every(q => q.filters.some(f => f[1] === 'buyer_id' && f[2] === 'buyer')));
    assert.ok(items.filters.some(f => f[1] === 'winner_id' && f[2] === 'buyer'));
    assert.ok(r.calls.every(q => q.abortSignal));
    const cart = o.getCurrentResult().data[0];
    assert.equal(cart.id, 'its-cart'); assert.equal(cart.items[0].id, 'won-item');
    assert.equal(cart.totalCents, 1200); assert.equal(cart.shippingTier, 2);
  });
});
