const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
function load(file, deps = {}) {
  const context = vm.createContext({ exports: {}, Date, __DEV__: false, require(name) { assert.ok(name in deps, name); return deps[name]; } });
  vm.runInContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
  return context.exports;
}
const presentation = load('lib/notificationPresentation.ts');
const base = (extra = {}) => ({ id: 'n', type: 'auction_won', comment_text: 'Abaya · 24,00 €', product_name: 'Abaya', session_id: 'show', read: false, created_at: '2026-09-19T10:00:00.123456+00:00', sender_id: 'seller', sender_name: 'Noor', sender_avatar: null, image_url: null, subject_title: null, auction_id: null, live_status: null, ...extra });
function apiFixture(tables = {}, failures = []) {
  const calls = []; let account = 'buyer';
  const api = { auth: { getSession: async () => ({ data: { session: { user: { id: account } } } }) }, from(table) {
    const call = { table, ops: [] }; calls.push(call);
    const builder = { then(ok, fail) {
      const result = failures.includes(table) ? { data: null, error: new Error('offline') } : { data: tables[table] ?? [], error: null };
      return Promise.resolve(result).then(ok, fail);
    } };
    for (const method of ['select', 'eq', 'in', 'gte', 'order', 'limit', 'abortSignal', 'update']) builder[method] = (...args) => { call.ops.push([method, ...args]); return builder; };
    return builder;
  } };
  return { api, calls, setAccount: id => { account = id; } };
}
function hooksFixture(api) {
  let query, mutation; const changed = [], invalidated = [];
  const hooks = load('lib/useNotifications.ts', {
    './supabase': { supabase: api }, './notificationContext': { loadNotificationContext: (...args) => load('lib/notificationContext.ts', { './supabase': { supabase: api } }).loadNotificationContext(...args) },
    '@tanstack/react-query': { useQuery: options => { query = options; return {}; }, useMutation: options => { mutation = options; return {}; },
      useQueryClient: () => ({ setQueryData: (key, fn) => changed.push({ key, fn }), invalidateQueries: value => invalidated.push(value) }) },
  });
  return { hooks, query: () => query, mutation: () => mutation, changed, invalidated };
}
const win = (extra = {}) => ({ id: 'a', seller_id: 'seller', session_id: 'show', title: 'Abaya', image_url: 'https://example.invalid/abaya.png', settled_at: base().created_at, ...extra });

test('notification enrichment attaches only an exact unique transaction, never a title/time guess', async () => {
  const f = apiFixture({ profiles: [{ id: 'seller', username: 'Noor', avatar_url: 'avatar' }], live_auctions: [win(), win({ id: 'other', settled_at: '2026-09-19T10:00:00.123455+00:00' })] });
  const context = load('lib/notificationContext.ts', { './supabase': { supabase: f.api } });
  const feed = await context.loadNotificationContext([base()], 'buyer', new AbortController().signal);
  assert.equal(feed.items[0].auction_id, 'a'); assert.equal(feed.items[0].image_url, win().image_url); assert.equal(feed.items[0].sender_avatar, 'avatar');
  assert.ok(f.calls.find(c => c.table === 'live_auctions').ops.some(op => op[0] === 'eq' && op[1] === 'winner_id' && op[2] === 'buyer'));
  for (const changed of [{ title: 'Other' }, { seller_id: 'other' }, { session_id: 'other' }, { settled_at: null }]) assert.equal(context.matchingNotificationWin(base(), [win(changed)]), undefined);
  assert.equal(context.matchingNotificationWin(base(), [win(), win({ id: 'duplicate' })]), undefined);
});

test('batch media queries are scoped, optional failures preserve every notification with a retry flag', async () => {
  const f = apiFixture({ live_sessions: [{ id: 'show', title: 'Abendshow', thumbnail_url: 'cover', status: 'ended' }] }, ['profiles', 'live_auctions']);
  const context = load('lib/notificationContext.ts', { './supabase': { supabase: f.api } });
  const feed = await context.loadNotificationContext([base(), base({ id: 'live', type: 'live' })], 'buyer', new AbortController().signal);
  assert.equal(feed.items.length, 2); assert.equal(feed.partial, true);
  assert.equal(feed.items[0].image_url, null); assert.equal(feed.items[1].image_url, 'cover'); assert.equal(feed.items[1].live_status, 'ended');
  assert.equal(f.calls.length, 3);
  assert.ok(f.calls.find(c => c.table === 'live_sessions').ops.some(op => op[0] === 'eq' && op[1] === 'app' && op[2] === 'berkat'));
});

test('empty and cancelled enrichment never exposes late context; capped matches remain unresolved', async () => {
  const f = apiFixture({ live_auctions: Array.from({ length: 200 }, (_, i) => win({ id: String(i) })) });
  const context = load('lib/notificationContext.ts', { './supabase': { supabase: f.api } });
  const empty = await context.loadNotificationContext([], 'buyer', new AbortController().signal);
  assert.equal(empty.items.length, 0); assert.equal(f.calls.length, 0);
  const result = await context.loadNotificationContext([base()], 'buyer', new AbortController().signal);
  assert.equal(result.items[0].auction_id, null); assert.equal(result.partial, true);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(context.loadNotificationContext([base()], 'buyer', controller.signal), /cancelled/);
});

test('all event types retain meaningful copy without a stored body; saved search never becomes an item name', () => {
  for (const type of ['auction_won', 'order_payment_reminder', 'order_shipped', 'auction_up', 'order_paid', 'new_order', 'order_review', 'scheduled_live_reminder', 'live', 'saved_search_hit', 'order_dispute', 'dm', 'unknown']) {
    const info = presentation.presentNotification(base({ type, product_name: null, comment_text: '  ' }));
    assert.ok(info.title && info.body.length > 20 && info.action);
  }
  const won = presentation.presentNotification(base({ auction_id: 'a' }));
  assert.equal(won.subject, 'Abaya'); assert.equal(won.body, '24,00 €'); assert.equal(won.action, 'Artikel ansehen');
  const search = presentation.presentNotification(base({ type: 'saved_search_hit', product_name: 'Oud', comment_text: 'Flakon · passend zu „Oud“' }));
  assert.equal(search.subject, 'Suche: „Oud“'); assert.equal(search.body, 'Flakon · passend zu „Oud“');
  assert.equal(presentation.presentNotification(base({ type: 'live', live_status: 'ended' })).title, 'Show beendet');
});

test('date groups follow local calendar boundaries and never show invalid dates', () => {
  const now = new Date(2026, 8, 19, 0, 10);
  const yesterday = new Date(2026, 8, 18, 23, 50).toISOString();
  const groups = presentation.notificationSections([base({ created_at: yesterday }), base({ id: 'today', created_at: now.toISOString() }), base({ id: 'bad', created_at: 'invalid' })], now);
  assert.equal(groups.map(g => g.title).join(','), 'Heute,Gestern,Früher');
  assert.equal(presentation.notificationWhen('invalid', now), 'Datum unbekannt');
  assert.equal(presentation.notificationWhen(new Date(now.getTime() + 5000).toISOString(), now), 'Gerade eben');
});

test('notification destinations retain push behavior and open exact wins, messages and ended-show profiles', () => {
  const f = hooksFixture(apiFixture().api); const target = f.hooks.notificationTarget;
  assert.equal(target({ type: 'auction_won', auctionId: 'a' }, 'list'), '/listing/a');
  assert.equal(target({ type: 'auction_won' }, 'list'), '/purchases');
  assert.equal(target({ type: 'auction_won', auctionId: 'a' }, 'push'), '/notifications');
  assert.equal(target({ type: 'dm', senderId: 'seller' }, 'list'), '/messages/seller');
  assert.equal(target({ type: 'live', senderId: 'seller', sessionId: 's', liveStatus: 'ended' }, 'list'), '/seller/seller');
  assert.equal(target({ type: 'saved_search_hit', query: 'Oud & Duft' }, 'list'), '/shop?q=Oud%20%26%20Duft');
});

test('read updates touch only displayed IDs for the active account, with no optimistic read on failure', async () => {
  const f = apiFixture(); const h = hooksFixture(f.api); h.hooks.useMarkNotificationsRead('buyer');
  const mutation = h.mutation(); assert.equal(mutation.retry, false);
  await mutation.mutationFn(['n', 'n']);
  const ops = f.calls[0].ops;
  assert.ok(ops.some(op => op[0] === 'eq' && op[1] === 'recipient_id' && op[2] === 'buyer'));
  assert.ok(ops.some(op => op[0] === 'eq' && op[1] === 'app' && op[2] === 'berkat'));
  assert.equal(ops.find(op => op[0] === 'in')[2].join(','), 'n');
  mutation.onSuccess(undefined, ['n']);
  const cached = h.changed[0].fn({ items: [base(), base({ id: 'new' })], partial: false });
  assert.equal(cached.items[0].read, true); assert.equal(cached.items[1].read, false);
  f.setAccount('other'); await assert.rejects(mutation.mutationFn(['n']), /session_changed/);
  assert.equal(f.calls.length, 1);
  const broken = apiFixture({}, ['notifications']); const failure = hooksFixture(broken.api); failure.hooks.useMarkNotificationsRead('buyer');
  await assert.rejects(failure.mutation().mutationFn(['n']), /offline/); assert.equal(failure.changed.length, 0);
});

test('notification query never fetches for guests and protects the shared inbox app/recipient boundary', async () => {
  const f = apiFixture(); const h = hooksFixture(f.api); h.hooks.useBerkatNotifications(null);
  assert.equal(h.query().enabled, false); await h.query().queryFn({ signal: new AbortController().signal }); assert.equal(f.calls.length, 0);
  h.hooks.useBerkatNotifications('buyer'); await h.query().queryFn({ signal: new AbortController().signal });
  assert.ok(f.calls[0].ops.some(op => op[0] === 'eq' && op[1] === 'app' && op[2] === 'berkat'));
  assert.ok(f.calls[0].ops.some(op => op[0] === 'eq' && op[1] === 'recipient_id' && op[2] === 'buyer'));
});

function uiFixture() {
  let cursor = 0; const states = [];
  const jsx = (type, props, key) => typeof type === 'function' ? type(props) : { type, props, key };
  const react = { useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; } };
  const native = { View: 'View', Text: 'Text', ActivityIndicator: 'Spinner', RefreshControl: 'Refresh', SectionList: 'List',
    StyleSheet: { create: s => s, absoluteFill: {}, hairlineWidth: 1 }, useWindowDimensions: () => ({ fontScale: 1.8 }) };
  const component = load('components/NotificationInbox.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': native,
    'expo-image': { Image: 'Image' }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
    'lucide-react-native': {}, '../lib/notificationPresentation': presentation, '../lib/useReducedMotion': { useReducedMotion: () => true },
    './PressFeedback': { PressFeedback: 'Button' }, '../theme/tokens': { ui: {}, radius: {}, space: {} },
  });
  return { row: props => { cursor = 0; return component.NotificationRow(props); }, inbox: props => { cursor = 0; return component.NotificationInbox(props); } };
}
const nodes = node => !node ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children), ...nodes(node.props?.ListHeaderComponent), ...nodes(node.props?.ListEmptyComponent)];
const content = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(content).join('') : content(node?.props?.children ?? '');

test('row retains full copy and exact item action when thumbnail and avatar both fail', () => {
  const f = uiFixture(); const item = base({ image_url: 'broken-item', sender_avatar: 'broken-avatar', auction_id: 'a' }); const opened = [];
  const props = { item, onOpen: value => opened.push(value.id) };
  let tree = f.row(props), picture = nodes(tree).find(n => n.type === 'Image');
  assert.equal(picture.props.source.uri, 'broken-item'); picture.props.onError();
  tree = f.row(props); picture = nodes(tree).find(n => n.type === 'Image');
  assert.equal(picture.props.source.uri, 'broken-avatar'); picture.props.onError();
  tree = f.row(props); assert.equal(nodes(tree).filter(n => n.type === 'Image').length, 0);
  assert.match(content(tree), /NO/); assert.match(content(tree), /24,00 €/); assert.match(content(tree), /Artikel ansehen/);
  nodes(tree).find(n => n.type === 'Button').props.onPress(); assert.deepEqual(opened, ['n']);
  assert.match(tree.props.accessibilityLabel, /Ungelesen.*Abaya.*24,00 €/);
});

test('empty, loading, guest and failed inbox have distinct recoverable states', () => {
  const f = uiFixture(); const actions = [];
  const props = { items: [], onBack() {}, onOpen() {}, onReadAll() {}, onRefresh: () => actions.push('retry'), onLogin: () => actions.push('login'), onExplore: () => actions.push('explore') };
  for (const [state, expected, action] of [['error', 'Meldungen gerade nicht erreichbar', 'retry'], ['guest', 'Deine Meldungen an einem Ort', 'login'], ['empty', 'Du bist auf dem neuesten Stand', 'explore']]) {
    const tree = f.inbox({ ...props, [state]: true }); const list = nodes(tree).find(n => n.type === 'List');
    assert.match(content(list.props.ListEmptyComponent), new RegExp(expected));
    nodes(list.props.ListEmptyComponent).find(n => n.type === 'Button').props.onPress(); assert.equal(actions.at(-1), action);
  }
  const tree = f.inbox({ ...props, loading: true }); const empty = nodes(tree).find(n => n.type === 'List').props.ListEmptyComponent;
  assert.match(content(empty), /werden geladen/); assert.equal(nodes(empty).filter(n => n.type === 'Button').length, 0);
});

test('inbox partial error keeps rows and retry, with an explicit bounded mark-read action', () => {
  const f = uiFixture(); let read = 0, retry = 0;
  const tree = f.inbox({ items: [base(), base({ id: 'r', read: true })], partial: true,
    onReadAll: () => read++, onRefresh: () => retry++ });
  const list = nodes(tree).find(n => n.type === 'List'); assert.equal(list.props.sections.reduce((sum, section) => sum + section.data.length, 0), 2);
  const mark = nodes(tree).find(n => n.props?.accessibilityLabel === 'Angezeigte Meldung als gelesen markieren');
  mark.props.onPress(); assert.equal(read, 1);
  nodes(list.props.ListHeaderComponent).find(n => n.type === 'Button').props.onPress(); assert.equal(retry, 1);
});

test('opening the production screen does not mark messages read; row actions only mark their own ID', async () => {
  let userId = 'buyer'; const marked = [], routes = [], refetched = [];
  const f = hooksFixture(apiFixture().api);
  const items = [base({ auction_id: 'a' }), base({ id: 'read', read: true }), base({ id: 'other' })];
  const jsx = (type, props, key) => typeof type === 'function' ? type(props) : { type, props, key };
  const screen = load('app/notifications.tsx', {
    react: { useCallback: fn => fn, useRef: value => ({ current: value }), useState: value => [value, () => {}] },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'expo-router': { router: { push: route => routes.push(route) }, useFocusEffect: fn => fn() },
    '../components/NotificationInbox': { NotificationInbox: 'Inbox' }, '../lib/nav': { goBack() {} },
    '../lib/session': { useSession: selector => selector({ userId, loading: false }) },
    '../lib/useNotifications': { notificationTarget: f.hooks.notificationTarget,
      useBerkatNotifications: () => ({ data: userId ? { items, partial: false } : undefined, refetch: async () => refetched.push(userId) }),
      useMarkNotificationsRead: () => ({ mutateAsync: async ids => marked.push(Array.from(ids)) }),
    },
  }).default;
  const tree = screen(); assert.equal(marked.length, 0); assert.equal(refetched.length, 1);
  tree.props.onOpen(items[0]); await Promise.resolve(); assert.deepEqual(marked, [['n']]); assert.deepEqual(routes, ['/listing/a']);
  tree.props.onOpen(items[1]); assert.equal(marked.length, 1);
  userId = null; const guest = screen(); assert.equal(guest.props.guest, true); assert.equal(guest.props.items.length, 0); assert.equal(refetched.length, 1);
});
