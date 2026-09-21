// The actual Home component is rendered with local data; no requests or writes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const jsx = (type, props, key) => ({ type, props, key });
const plain = value => JSON.parse(JSON.stringify(value));
function load(file, deps) {
  const source = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const ctx = vm.createContext({ exports: {}, require(name) { assert.ok(name in deps, `Missing dependency ${name}`); return deps[name]; } });
  vm.runInContext(source, ctx); return ctx.exports;
}
const nodes = node => !node ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node,
  ...nodes(node.props?.children), ...nodes(node.props?.ListHeaderComponent), ...nodes(node.props?.ListFooterComponent), ...nodes(node.props?.ListEmptyComponent)];
const text = node => nodes(node).filter(n => n.type === 'Text').map(n => n.props.children).flat().join(' ');
const show = (id, extra = {}) => ({ id, host_id: 'host', title: `Show ${id}`, thumbnail_url: null, viewer_count: 0, category: 'mode', women_only: false, ...extra });
const listing = (id, created_at = `2026-09-01T00:00:0${id.length % 10}.000000Z`) => ({ id, seller_id: 'seller', created_at });
function fixture() {
  let cursor = 0; const slots = [], routes = [];
  const state = { shows: [], shelf: [listing('a'), listing('b')], previews: {}, categoryError: false, shopCount: 10 };
  const react = { useEffect() {}, useMemo: fn => fn(), useCallback: fn => fn,
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
  };
  const query = data => ({ data, isSuccess: true, isLoading: false, isError: false, refetch() {} });
  class Value { interpolate() { return this; } }
  const categories = [{ slug: 'mode', name: 'Mode', children: [], listing_count: 3, live_count: 0 }];
  const deps = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', Text: 'Text', ActivityIndicator: 'Spinner', Animated: { Value, View: 'AnimatedView', FlatList: 'List', event() {} }, StyleSheet: { create: s => s }, useWindowDimensions: () => ({ width: 390, fontScale: 1 }) },
    'expo-router': { useRouter: () => ({ push: to => routes.push(to) }), useFocusEffect() {} },
    '@react-navigation/native': { useIsFocused: () => true, useScrollToTop() {} },
    '@tanstack/react-query': { useQueryClient: () => ({ invalidateQueries() {} }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
    'lucide-react-native': {}, '../../theme/tokens': { ui: {}, radius: {}, space: {} },
    '../../lib/useShowDiscovery': { useLiveDiscovery: () => ({ ...query(state.shows), reasons: {} }), useUpcomingDiscovery: () => ({ ...query([]), reasons: {} }) },
    '../../lib/showDiscovery': { showReasonText: reason => reason },
    '../../lib/useAuction': { useProfiles: () => ({ host: { username: 'Host' } }), useServerClock: () => ({ serverNow: () => 1000 }), useShowPreviews: () => state.previews },
    '../../lib/useStories': { useBerkatStories: () => query([]), useCreateStory: () => ({}) },
    '../../lib/useCategories': { useCategoryOptions: () => ({ groups: categories, isSuccess: true }), useCategories: () => ({ ...query(categories), isError: state.categoryError }) },
    '../../lib/useListings': { useCategoryListings: () => query(state.shelf), useShopCount: () => query(state.shopCount) },
    '../../lib/discovery': { DEFAULT_DISCOVERY: { categorySlugs: [], useFollowing: true }, expandInterests: () => [] },
    '../../lib/useDiscoveryPreferences': { useDiscoveryPreferences: () => ({ ...query({ categorySlugs: [], useFollowing: true }) }) },
    '../../lib/useDiscoveryListings': { useDiscoveryListings: () => ({ ...query(state.shelf), reasons: {} }) },
    '../../lib/useSaved': { useSavedCounts: () => ({}), useSavedIds: () => ({}), useToggleSaved: () => ({}) },
    '../../lib/session': { useSession: selector => selector({ userId: null, loading: false }) },
    '../../lib/useNotifications': { useUnreadCount: () => query(0) },
    '../../lib/useDirectMessages': { useUnreadMessageCount: () => query(0) },
    '../../lib/useReducedMotion': { useReducedMotion: () => true },
    '../../components/CategoryRail': { CategoryRail: 'CategoryRail', categoryRailMetrics: () => ({ tall: 92, short: 48 }) },
    // Seit dem 21.09.2026: das Blatt hinter dem Pfeil am Ende der Leiste.
    '../../components/CategorySheet': { CategorySheet: 'CategorySheet' },
    '../../components/ShelfRail': { ShelfRail: 'ShelfRail' },
    // ECHT, nicht gestellt: Die Aufteilung auf Reihe und Raster ist genau das,
    // was dieser Test prueft ("without duplication"). Ein Stub wuerde die
    // Zusicherung durch sich selbst ersetzen.
    '../../lib/shelfSplit': load('lib/shelfSplit.ts', {}),
  };
  for (const name of ['BerkatMark', 'HomeLiveCard', 'HomeAccountActions', 'HomeSkeleton', 'StoryRail', 'UpcomingStrip', 'ListingCard', 'PressFeedback']) deps[`../../components/${name}`] = { [name]: name };
  const home = load('app/(tabs)/index.tsx', deps).default;
  return { state, routes, render() { cursor = 0; return home(); }, list() { return nodes(this.render()).find(n => n.type === 'List'); } };
}

test('zero, one, many, then zero live shows preserve offers without duplication', () => {
  const f = fixture();
  for (const count of [0, 1, 3, 1, 0]) {
    f.state.shows = Array.from({ length: count }, (_, i) => show(`s${i}`));
    const list = f.list(), header = nodes(list.props.ListHeaderComponent), footer = nodes(list.props.ListFooterComponent);
    const featured = header.filter(n => n.type === 'HomeLiveCard');
    assert.equal(featured.length, count === 1 ? 1 : 0);
    if (count === 1) { assert.equal(featured[0].props.featured, true); assert.equal(featured[0].props.show.id, 's0'); }
    if (count <= 1) {
      assert.deepEqual(plain(list.props.data.map(n => n.shelf.id)), ['a', 'b']);
      assert.equal(footer.filter(n => n.type === 'ListingCard').length, 0);
    } else {
      assert.deepEqual(plain(list.props.data.filter(n => !n.spacer).map(n => n.id)), ['s0', 's1', 's2']);
      assert.equal(list.props.data.filter(n => n.spacer).length, 1);
      assert.equal(footer.filter(n => n.type === 'ListingCard').length, 2);
    }
  }
});

test('a lone live show without offers never displays a contradictory nobody-live message', () => {
  const f = fixture(); f.state.shows = [show('one')]; f.state.shelf = [];
  const list = f.list(); assert.equal(list.props.ListEmptyComponent, null);
  assert.equal(nodes(list.props.ListHeaderComponent).filter(n => n.type === 'HomeLiveCard').length, 1);
});

test('featured and grid cards open their exact show; category action remains separate', () => {
  const f = fixture(); f.state.shows = [show('one')];
  const featured = nodes(f.list().props.ListHeaderComponent).find(n => n.type === 'HomeLiveCard');
  featured.props.onOpen(); assert.deepEqual(f.routes, ['/live/one']);
  featured.props.onCategory(); assert.deepEqual(f.routes, ['/live/one']);
  f.state.shows = [show('two'), show('three')];
  const list = f.list(), card = list.props.renderItem({ item: f.state.shows[1] });
  assert.equal(card.props.featured, false); card.props.onOpen();
  assert.deepEqual(f.routes, ['/live/one', '/live/three']);
});

test('missing count does not remove the marketplace route; category failures keep retry visible', () => {
  const f = fixture(); f.state.shopCount = 0; f.state.categoryError = true;
  const list = f.list(), button = nodes(list.props.ListFooterComponent).find(n => n.props?.accessibilityLabel === 'Zum Marktplatz');
  assert.ok(button); button.props.onPress(); assert.deepEqual(f.routes, ['/shop']);
  assert.match(text(list.props.ListHeaderComponent), /konnte nicht geladen werden/);
});

function cardFixture() {
  let cursor = 0; const slots = [];
  const deps = {
    react: { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], next => { slots[i] = next; }]; } },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', Text: 'Text', StyleSheet: { create: s => s, absoluteFill: {} }, useWindowDimensions: () => ({ fontScale: 1 }) },
    'expo-image': { Image: 'Image' }, 'expo-linear-gradient': { LinearGradient: 'Gradient' }, 'lucide-react-native': {},
    '../lib/useAuction': { formatEuro: cents => `${cents / 100} €` },
    '../theme/tokens': { ui: {}, radius: {}, space: {} }, '../lib/useReducedMotion': { useReducedMotion: () => true },
  };
  for (const name of ['Avatar', 'BerkatMark', 'LivePreview', 'PressFeedback']) deps[`./${name}`] = { [name]: name };
  const card = load('components/HomeLiveCard.tsx', deps).HomeLiveCard;
  return { render: card, artwork(node) { const component = nodes(node).find(n => typeof n.type === 'function'); cursor = 0; return component.type(component.props); } };
}

test('missing and failed covers retain designed artwork; a changed source gets a new image instance', () => {
  const f = cardFixture(), base = { show: show('a'), secondsLeft: null, onOpen() {}, onCategory() {} };
  const noCover = f.render(base); assert.equal(nodes(f.artwork(noCover)).filter(n => n.type === 'Image').length, 0);
  assert.equal(nodes(f.artwork(noCover)).filter(n => n.type === 'Gradient').length, 1);
  const card = f.render({ ...base, show: show('a', { thumbnail_url: 'https://example.test/cover.jpg' }) });
  const art = f.artwork(card), image = nodes(art).find(n => n.type === 'Image'); assert.ok(image); image.props.onError();
  assert.equal(nodes(f.artwork(card)).filter(n => n.type === 'Image').length, 0);
  const replacement = f.render({ ...base, show: show('a', { thumbnail_url: 'https://example.test/new.jpg' }) });
  assert.notEqual(nodes(card).find(n => typeof n.type === 'function').key, nodes(replacement).find(n => typeof n.type === 'function').key);
});

test('live status preserves restrictions and actual counts without inventing an audience', () => {
  const f = cardFixture(), base = { secondsLeft: null, onOpen() {}, onCategory() {} };
  const unknown = f.render({ ...base, show: show('a') });
  assert.match(text(unknown), /Live/); assert.doesNotMatch(text(unknown), /Live · 0/);
  const restricted = f.render({ ...base, show: show('b', { women_only: true, viewer_count: 12 }) });
  const open = nodes(restricted).find(n => n.type === 'PressFeedback');
  assert.match(open.props.accessibilityLabel, /12 Zuschauer, Frauen-Only/);
  assert.match(text(restricted), /Frauen-Only/);
});

// ── Die Wischreihe (Zaurs „Galerie"), seit dem 21.09.2026 ──────────────────
// Der Einwand gegen die Reihe war, sie zeige dieselben Artikel ein zweites Mal.
// Genau das prüfen diese beiden Tests — an der echten `splitShelf`, nicht an
// einem Stub.
const shelfOf = (count) => Array.from({ length: count }, (_, i) =>
  listing(`l${String(i).padStart(2, '0')}`, `2026-09-${String(i + 1).padStart(2, '0')}T10:00:00.000000Z`));

test('die Wischreihe trägt ausschließlich, was das Raster nicht trägt', () => {
  const f = fixture();
  f.state.shelf = shelfOf(16);
  const list = f.list();
  const rail = nodes(list.props.ListHeaderComponent).find(n => n.type === 'ShelfRail');
  assert.ok(rail, 'die Reihe fehlt im Kopf');
  const railIds = Array.from(plain(rail.props.items), row => row.id);
  const gridIds = Array.from(plain(list.props.data.filter(n => !n.spacer)), n => n.shelf.id);
  assert.equal(railIds.length, 8);
  assert.equal(gridIds.length, 8, 'das Raster darf durch die Reihe nichts verlieren');
  assert.equal(new Set([...railIds, ...gridIds]).size, 16, 'kein Artikel zweimal');
  assert.equal(railIds[0], 'l15', 'die Reihe beginnt beim Neuesten');

  // Läuft eine Show, steht das Regal im Fuß — und die Reihe mit ihm.
  f.state.shows = [show('s0'), show('s1')];
  const withShows = f.list();
  assert.equal(nodes(withShows.props.ListHeaderComponent).filter(n => n.type === 'ShelfRail').length, 0);
  const footRail = nodes(withShows.props.ListFooterComponent).find(n => n.type === 'ShelfRail');
  assert.ok(footRail, 'die Reihe fehlt im Fuß');
  const footIds = Array.from(plain(footRail.props.items), row => row.id);
  const footCards = nodes(withShows.props.ListFooterComponent).filter(n => n.type === 'ListingCard');
  assert.equal(footCards.length, 8);
  assert.equal(new Set([...footIds, ...Array.from(plain(footCards), c => c.props.listing.id)]).size, 16);
});

test('wenig Bestand bekommt gar keine Reihe, nicht eine leere', () => {
  const f = fixture();
  for (const count of [0, 2, 8, 11]) {
    f.state.shelf = shelfOf(count);
    const list = f.list();
    assert.equal(nodes(list.props.ListHeaderComponent).filter(n => n.type === 'ShelfRail').length, 0,
      `${count} Angebote dürfen keine Reihe ergeben`);
    assert.equal(list.props.data.filter(n => !n.spacer).length, Math.min(count, 8));
  }
});
