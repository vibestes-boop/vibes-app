import { useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Grid2X2, Radio, Search, X } from 'lucide-react-native';
import { ListingResults } from '../components/ListingResults';
import { ListingFilterBar, useCategorySlugs, useListingFilters } from '../components/ListingFilters';
import { SellerResults, isSearchPermissionError } from '../components/SellerResults';
import { SearchResultsState } from '../components/SearchResultsState';
import { goBack } from '../lib/nav';
import { NavigationRow } from '../components/NavigationRow';
import { Avatar } from '../components/Avatar';
import { SEARCH_MIN, useSellerSearch } from '../lib/useSellerSearch';
import { useBrowseListingPages } from '../lib/useBrowseListingPages';
import { useLiveShows } from '../lib/useLiveShows';
import { useProfiles } from '../lib/useAuction';
import { useSavedIds, useToggleSaved } from '../lib/useSaved';
import { useSession } from '../lib/session';
import { radius, space, ui } from '../theme/tokens';

const TABS = [{ id: 'articles', label: 'Artikel' }, { id: 'sellers', label: 'Verkäufer' }, { id: 'live', label: 'Live' }] as const;
type SearchTab = typeof TABS[number]['id'];

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const focused = useIsFocused();
  const userId = useSession((s) => s.userId);
  const params = useLocalSearchParams<{ tab?: string }>();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<SearchTab>(() => params.tab === 'sellers' || params.tab === 'live' ? params.tab : 'articles');
  const input = useRef<TextInput>(null);
  const term = query.trim();
  const ready = term.length >= SEARCH_MIN;
  /**
   * ⚠️ DIESELBE MASCHINE WIE „ALLE ANGEBOTE" — seit 21.09.2026.
   *
   * Bis dahin hatte Berkat ZWEI Suchen: diese hier (`ilike` auf den Titel,
   * zwanzig Treffer, keine Filter, keine Sortierung, kein Nachladen) und die
   * unter „Alle Angebote", die alles davon konnte. Die schwächere hing an der
   * Lupe, also an der Stelle, die jeder zuerst antippt.
   *
   * ⚠️ `enabled` trägt hier die Mindestlänge. `useBrowseListingPages` kennt
   * kein `SEARCH_MIN` — ohne das Gatter liefe bei einem einzelnen Zeichen
   * eine Abfrage über den ganzen Bestand.
   */
  const { values: filters, patch: patchFilters, reset: resetFilters,
    activeCount: activeFilters } = useListingFilters();
  const slugs = useCategorySlugs(filters.cat);
  const articles = useBrowseListingPages({
    slugs, query,
    condition: filters.cond, color: filters.color, brand: filters.brand,
    size: filters.size, city: filters.city,
    minPrice: filters.minPrice, maxPrice: filters.maxPrice,
    onlyShow: filters.onlyShow, sort: filters.sort,
  }, focused && tab === 'articles' && ready);
  const loadMoreArticles = () => {
    if (!articles.isFetching && !articles.isDebouncing && articles.hasNextPage) {
      void articles.fetchNextPage({ cancelRefetch: false });
    }
  };
  const sellers = useSellerSearch(query, focused && tab === 'sellers' && Boolean(userId));
  const live = useLiveShows(focused && tab === 'live' && ready);
  const shows = live.data ?? [];
  const profiles = useProfiles(tab === 'live' && ready ? shows.map((show) => show.host_id) : []);
  const liveMatches = useMemo(() => shows.filter((show) => {
    const needle = term.toLocaleLowerCase('de');
    return (show.title ?? '').toLocaleLowerCase('de').includes(needle)
      || (profiles[show.host_id]?.username ?? '').toLocaleLowerCase('de').includes(needle);
  }), [shows, term, profiles]);
  const { data: savedIds } = useSavedIds(userId);
  const toggleSaved = useToggleSaved(userId);
  const open = (path: `/listing/${string}` | `/seller/${string}` | `/live/${string}`) => {
    Keyboard.dismiss();
    router.push(path);
  };
  const liveFeedback = <SearchResultsState key={fontScale} kind="Live-Shows" loading={live.isLoading || (live.isError && live.isFetching)}
    error={live.error} hasResults={liveMatches.length > 0} onRetry={() => void live.refetch()}
    emptyText="Zu diesem Begriff läuft gerade keine Show. Versuche einen anderen Titel oder Verkäufernamen – oder entdecke die Artikel." />;

  return <View style={[s.screen, { paddingTop: insets.top }]}>
    <View style={s.searchRow}>
      <Pressable onPress={() => goBack('/(tabs)/')} accessibilityRole="button" accessibilityLabel="Zurück"
        style={({ pressed }) => [s.iconButton, pressed && s.pressed]}>
        <ArrowLeft size={23} color={ui.brand} />
      </Pressable>
      <View style={s.field}>
        <Search size={18} color={ui.textMuted} />
        <TextInput ref={input} autoFocus value={query} onChangeText={setQuery}
          placeholder={tab === 'sellers' ? 'Verkäufername' : tab === 'live' ? 'Show oder Verkäufer' : 'Artikel suchen'} accessibilityLabel="Suchbegriff"
          placeholderTextColor={ui.textMuted} style={s.input} maxLength={100}
          autoCapitalize="none" autoCorrect={false} returnKeyType="search"
          onSubmitEditing={Keyboard.dismiss} />
        {query.length > 0 ? <Pressable onPress={() => { setQuery(''); input.current?.focus(); }}
          accessibilityRole="button" accessibilityLabel="Suchbegriff löschen"
          style={({ pressed }) => [s.clear, pressed && s.pressed]}>
          <X size={18} color={ui.textMuted} />
        </Pressable> : null}
      </View>
    </View>
    <View key={`tabs:${fontScale}`} style={s.tabs}>
      {TABS.map((item) => <Pressable key={item.id} onPress={() => setTab(item.id)}
        accessibilityRole="tab" accessibilityState={{ selected: item.id === tab }} accessibilityLabel={item.label}
        style={({ pressed }) => [s.tab, item.id === tab && s.tabActive, pressed && s.pressed]}>
        <Text style={[s.tabText, item.id === tab && s.tabTextActive]}>{item.label}</Text>
      </Pressable>)}
    </View>
    {!ready ? <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets
      contentContainerStyle={[s.intro, { paddingBottom: insets.bottom + space.xl }]}>
      <Text key={`title:${fontScale}`} accessibilityRole="header" style={s.introTitle}>{tab === 'sellers' ? 'Finde deinen Verkäufer' : tab === 'live' ? 'Finde eine Live-Show' : 'Finde deinen nächsten Favoriten'}</Text>
      <Text key={`hint:${fontScale}`} style={s.introBody}>{term.length === 1 ? 'Noch ein Zeichen, dann geht’s los.' : tab === 'sellers' ? 'Suche nach dem Benutzernamen eines Verkäufers. Zwei Zeichen genügen.' : 'Suche nach einem Artikel, einem Verkäufer oder einer Live-Show. Zwei Zeichen genügen.'}</Text>
      <View style={{ alignSelf: 'stretch', marginTop: space.sm }}>
        <NavigationRow title="Kategorien entdecken" detail="Alle Bereiche im Überblick" Icon={Grid2X2}
          onPress={() => { Keyboard.dismiss(); router.push('/(tabs)/categories'); }} />
      </View>
    </ScrollView> : <>
      <View key={`context:${fontScale}`} style={s.context}>
        <Text accessibilityRole="header" style={s.heading}>{tab === 'articles' ? 'Passende Artikel' : tab === 'sellers' ? 'Verkäufer entdecken' : 'Live entdecken'}</Text>
        <Text style={s.contextText}>{tab === 'articles' ? 'In Titel, Beschreibung und Merkmalen' : tab === 'sellers' ? 'Suche nach Benutzernamen' : 'Suche nach Titel und Verkäufer'}</Text>
      </View>
      {tab === 'articles' ? <>
        {/* ⚠️ `sidePadding` auf `lg`: Dieser Bildschirm rückt seine Karten
            weiter ein als der Shop. Ohne das begännen Chips und Karten an
            zwei verschiedenen Kanten. */}
        <ListingFilterBar values={filters} patch={patchFilters} reset={resetFilters}
          activeCount={activeFilters} sidePadding={space.lg} withCategory />
        {/* ⚠️ `key` am Filterschlüssel, nicht mehr am Suchwort: Auch ein
            geänderter Filter ist ein anderes Ergebnis und gehört an den
            Anfang der Liste, nicht an die Stelle, an der man gerade stand. */}
        <ListingResults key={articles.filterKey} listings={articles.data?.listings ?? []} userId={userId}
          loading={articles.isLoading} error={articles.isError ? articles.error : undefined}
          onRetry={() => void articles.refetch()} savedIds={savedIds}
          onEndReached={loadMoreArticles} hasMore={articles.hasNextPage}
          onSelect={(id) => open(`/listing/${id}`)}
          onToggleSaved={(auctionId, saved) => userId ? toggleSaved.mutate({ auctionId, saved }) : router.push('/login')} />
      </>
      : tab === 'sellers' ? <SellerResults key={term} sellers={userId ? sellers.data ?? [] : []}
        loading={sellers.isDebouncing || sellers.isFetching || sellers.isPending} error={sellers.error}
        needsLogin={!userId || isSearchPermissionError(sellers.error)} onSignIn={() => router.push('/login')}
        onRetry={() => void sellers.refetch()} onSelect={(id) => open(`/seller/${id}`)} />
      : <FlatList key={term} data={liveMatches} keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xl }}
        ListHeaderComponent={liveMatches.length ? liveFeedback : null} ListEmptyComponent={liveFeedback}
        renderItem={({ item }) => <Pressable onPress={() => open(`/live/${item.id}`)}
          accessibilityRole="button" accessibilityLabel={`${item.title ?? 'Live-Show'}, jetzt live${item.women_only ? ', Frauen-Only' : ''}`}
          style={({ pressed }) => [s.liveRow, pressed && s.pressed]}>
          {item.thumbnail_url ? <Image source={{ uri: item.thumbnail_url }} style={s.liveImage} contentFit="cover" />
            : <Avatar uri={profiles[item.host_id]?.avatarUrl} name={profiles[item.host_id]?.username} size={60} />}
          <View style={s.liveCopy}>
            <View style={s.liveLabel}><Radio size={14} color={ui.live} /><Text style={s.liveText}>Jetzt live · {item.viewer_count ?? 0}</Text></View>
            {item.women_only ? <Text style={s.womenOnly}>Frauen-Only</Text> : null}
            <Text style={s.liveTitle} numberOfLines={2}>{item.title ?? 'Live-Show'}</Text>
            <Text style={s.contextText}>{profiles[item.host_id]?.username ?? 'Verkäufer'}</Text>
          </View>
        </Pressable>} />}
    </>}
  </View>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  pressed: { opacity: 0.65 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, padding: space.md },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  field: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: ui.card, borderRadius: radius.pill, borderWidth: 1, borderColor: ui.line, paddingLeft: space.md, paddingRight: space.xs },
  input: { flex: 1, minWidth: 0, fontSize: 16, color: ui.text, paddingVertical: 12 },
  clear: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.md },
  tab: { minHeight: 44, paddingHorizontal: space.lg, paddingVertical: 10, borderRadius: radius.pill,
    backgroundColor: ui.card, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: ui.brand },
  tabText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: ui.textMuted },
  tabTextActive: { color: ui.card },
  context: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.lg, gap: space.xs },
  heading: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, color: ui.text },
  contextText: { fontSize: 13, lineHeight: 19, color: ui.textMuted },
  intro: { alignItems: 'center', paddingHorizontal: space.xl, paddingTop: space.xl, gap: space.md },
  introTitle: { fontSize: 22, lineHeight: 29, fontWeight: '700', color: ui.text, textAlign: 'center' },
  introBody: { fontSize: 15, lineHeight: 23, color: ui.textMuted, textAlign: 'center' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: ui.card, padding: space.md, borderRadius: radius.lg, marginBottom: space.sm },
  liveImage: { width: 76, height: 92, borderRadius: radius.md, backgroundColor: ui.sunken },
  liveCopy: { flex: 1, minWidth: 0, gap: space.xs },
  liveLabel: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  liveText: { fontSize: 12, fontWeight: '600', color: ui.live },
  womenOnly: { fontSize: 12, fontWeight: '600', color: ui.success },
  liveTitle: { fontSize: 16, fontWeight: '600', color: ui.text },
});
