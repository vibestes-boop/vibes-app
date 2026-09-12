const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');

function load(file, api) {
  let options;
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = vm.createContext({ exports: {}, require: name => ({
    '@tanstack/react-query': { useQuery: value => { options = value; return {}; } },
    './supabase': { supabase: api },
  })[name] ?? {} });
  vm.runInContext(code, context);
  return { hooks: context.exports, query: () => options.queryFn({ signal: new AbortController().signal }) };
}

// Follow the actual feed target into the actual detail query. No cart or order
// fixture is provided: seeing a won item must not depend on either existing.
for (const sessionId of ['ended-live', null]) {
  test(`won activity opens its exact sold item (${sessionId ? 'ended live' : 'standing offer'}) without a cart`, async () => {
    const winner = 'buyer';
    const auction = { id: 'won-auction', title: 'Gewonnener Artikel', image_url: 'https://example.invalid/item.png',
      status: 'sold', winner_id: winner, seller_id: 'seller', session_id: sessionId,
      current_bid_cents: 2400, settled_at: '2026-09-12T12:00:00Z' };
    const calls = [];
    const api = { from(table) {
      const call = { table, filters: [] }; calls.push(call);
      const builder = { then(resolve, reject) {
        const id = call.filters.find(([field]) => field === 'id')?.[1];
        const data = table !== 'live_auctions' ? [] : id ? (id === auction.id ? auction : null) : [auction];
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      } };
      for (const op of ['select', 'order', 'limit', 'is', 'in', 'gte', 'retry', 'abortSignal', 'maybeSingle']) {
        builder[op] = () => builder;
      }
      builder.eq = (...args) => { call.filters.push(args); return builder; };
      builder.or = value => { call.visibility = value; return builder; };
      return builder;
    } };
    const activity = load('lib/useActivity.ts', api);
    activity.hooks.useActivity(winner);
    const feed = await activity.query();
    const won = feed.items.find(item => item.kind === 'won');
    assert.ok(won);
    assert.equal(won.target, `/listing/${auction.id}`);
    assert.equal(won.imageUrl, auction.image_url);
    assert.match(won.body, /24,00 €/);
    assert.ok(calls[1].filters.some(([key, value]) => key === 'winner_id' && value === winner));
    const detail = load('lib/useListings.ts', api);
    detail.hooks.useListing(won.target.slice('/listing/'.length));
    const result = await detail.query();
    assert.equal(result.id, auction.id);
    assert.equal(result.winner_id, winner);
    assert.equal(result.status, 'sold');
    assert.equal(calls.at(-1).visibility, 'session_id.is.null,status.eq.sold');
    assert.ok(calls.every(call => !['auction_carts', 'market_orders'].includes(call.table)));
  });
}
