// Shop: serverseitige Auswahl, anschließend seitenweise Angebote.
import { useCallback, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BellPlus,
  Bookmark as BookmarkIcon,
  ChevronLeft,
  Search,
  X,
} from 'lucide-react-native';
import { useSession } from '../lib/session';
import { goBack } from '../lib/nav';
import { useProfiles } from '../lib/useAuction';
import { type Listing } from '../lib/useListings';
import { useBrowseListingPages } from '../lib/useBrowseListingPages';
import { SellerShopMore } from '../components/SellerShopMore';
import { useSavedIds, useToggleSaved, useSavedCounts } from '../lib/useSaved';
import {
  normalizeQuery,
  savedSearchError,
  useSavedSearches,
  useSavedSearchActions,
} from '../lib/useSavedSearches';
import { ListingCard } from '../components/ListingCard';
import { BerkatMark } from '../components/BerkatMark';
import { ListingFilterBar, useCategorySlugs, useListingFilters } from '../components/ListingFilters';
import { radius, space, ui } from '../theme/tokens';
const COLS = 2;
type Cell = Listing | { id: string; spacer: true };
function padToGrid(items: Listing[]): Cell[] {
  const rest = items.length % COLS;
  if (items.length === 0 || rest === 0) return items;
  return [
    ...items,
    ...Array.from({ length: COLS - rest }, (_, i) => ({
      id: `__spacer__-${i}`,
      spacer: true as const,
    })),
  ];
}
export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);
  const focused = useIsFocused();
  const { fontScale } = useWindowDimensions();
  const pullingRef = useRef(false);
  const { data: savedIds } = useSavedIds(myUserId);
  const toggleSaved = useToggleSaved(myUserId);
  const [pulling, setPulling] = useState(false);
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(typeof params.q === 'string' ? params.q.slice(0, 100) : '');
  const [searchNotice, setSearchNotice] = useState<string | null>(null);
  const [savingSearch, setSavingSearch] = useState(false);
  const {
    values: filters,
    patch: patchFilters,
    reset: resetFilters,
    activeCount: activeFilters,
    narrowed: narrowedByFilter,
  } = useListingFilters();
  const { save: saveSearchMutation, remove: removeSearchMutation } =
    useSavedSearchActions(myUserId);
  const { data: savedSearches = [] } = useSavedSearches(myUserId);
  const savedSearchRow = useMemo(() => {
    const q = normalizeQuery(query).toLowerCase();
    if (q.length < 2) return null;
    return savedSearches.find((s) => normalizeQuery(s.query).toLowerCase() === q) ?? null;
  }, [savedSearches, query]);
  const saveSearch = useCallback(() => {
    const q = normalizeQuery(query);
    if (q.length < 2 || savingSearch) return;
    setSavingSearch(true);
    setSearchNotice(null);
    saveSearchMutation
      .mutateAsync(q)
      .then(() => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {},
        );
        setSearchNotice(`Gemerkt. Wir sagen dir Bescheid, sobald „${q}" auftaucht.`);
      })
      .catch((err) => setSearchNotice(savedSearchError(err)))
      .finally(() => setSavingSearch(false));
  }, [query, savingSearch, saveSearchMutation]);
  const toggleSavedSearch = useCallback(() => {
    if (!myUserId) {
      router.push('/login');
      return;
    }
    if (!savedSearchRow) {
      saveSearch();
      return;
    }
    if (savingSearch) return;
    setSavingSearch(true);
    setSearchNotice(null);
    removeSearchMutation
      .mutateAsync(savedSearchRow.id)
      .then(() => setSearchNotice('Nicht mehr gemerkt.'))
      .catch((err) => setSearchNotice(savedSearchError(err)))
      .finally(() => setSavingSearch(false));
  }, [myUserId, savedSearchRow, savingSearch, saveSearch, removeSearchMutation]);
  const slugs = useCategorySlugs(filters.cat);
  const pages = useBrowseListingPages({
    slugs, query,
    condition: filters.cond, color: filters.color, brand: filters.brand,
    size: filters.size, city: filters.city,
    minPrice: filters.minPrice, maxPrice: filters.maxPrice,
    onlyShow: filters.onlyShow, sort: filters.sort,
  }, focused);
  const { isLoading, refetch } = pages;
  const isError = pages.isError && !pages.isFetchNextPageError;
  const listings = pages.data?.listings ?? [];
  const profiles = useProfiles(listings.map(listing => listing.seller_id));
  const narrowed = Boolean(query.trim()) || narrowedByFilter;
  const resultCount = `${listings.length}${pages.hasNextPage ? '+' : ''}`;
  const countIds = useMemo(() => listings.map((l) => l.id).sort(), [listings]);
  const { data: saveCounts } = useSavedCounts(countIds);
  const onPull = useCallback(async () => {
    if (pullingRef.current || pages.isFetching || pages.isDebouncing) return;
    pullingRef.current = true;
    setPulling(true);
    try {
      await refetch({ cancelRefetch: false });
    } finally {
      pullingRef.current = false;
      setPulling(false);
    }
  }, [refetch, pages.isFetching, pages.isDebouncing]);
  const loadMore = () => {
    if (!pages.isFetching && !pages.isDebouncing && !pullingRef.current && pages.hasNextPage) {
      void pages.fetchNextPage({ cancelRefetch: false });
    }
  };
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View key={fontScale} style={styles.header}>
        <Pressable onPress={() => goBack('/(tabs)/categories')} style={styles.back} accessibilityRole="button" accessibilityLabel="Zurück">
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Alle Angebote</Text>
          {listings.length > 0 ? (
            <Text style={styles.headerSub}>
              {`${resultCount} ${narrowed ? 'Treffer' : listings.length === 1 ? 'Angebot' : 'Angebote'}`}
            </Text>
          ) : null}
        </View>
        {normalizeQuery(query).length >= 2 ? (
          <Pressable
            hitSlop={10}
            style={styles.back}
            disabled={savingSearch}
            onPress={toggleSavedSearch}
            accessibilityRole="button"
            accessibilityState={{ selected: Boolean(savedSearchRow) }}
            accessibilityLabel={
              savedSearchRow
                ? 'Diese Suche nicht mehr merken'
                : 'Diese Suche merken und benachrichtigt werden'
            }
          >
            <BookmarkIcon
              size={22}
              color={savedSearchRow ? ui.success : ui.text}
              fill={savedSearchRow ? ui.success : 'transparent'}
            />
          </Pressable>
        ) : (
          <View style={styles.back} />
        )}
      </View>
        <View key={`tools-${fontScale}`} style={styles.tools}>
          <View style={styles.searchWrap}>
            <Search size={16} color={ui.textMuted} />
            <TextInput
              maxLength={100}
              value={query}
              onChangeText={setQuery}
              placeholder="Artikel, Marke oder Ort suchen"
              accessibilityLabel="Artikel, Marke oder Ort suchen"
              placeholderTextColor={ui.textMuted}
              style={styles.searchInput}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query ? (
              <Pressable
                hitSlop={8}
                onPress={() => setQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Suche löschen"
              >
                <X size={16} color={ui.textMuted} />
              </Pressable>
            ) : null}
          </View>
          <ListingFilterBar
            values={filters}
            patch={patchFilters}
            reset={resetFilters}
            activeCount={activeFilters}
            withCategory
          />
        </View>
      <FlatList
        key={pages.filterKey}
        data={padToGrid(listings)}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        keyExtractor={(item) => item.id}
        numColumns={COLS}
        columnWrapperStyle={styles.row}
        contentContainerStyle={{
          paddingHorizontal: space.md,
          paddingBottom: insets.bottom + space.xl,
          gap: space.lg,
        }}
        refreshControl={
          <RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={ui.textMuted} />
        }
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={isError ? (
          <View style={styles.loadNotice} accessibilityRole="alert">
            <Text style={styles.emptyBody}>{listings.length ? 'Aktualisieren hat nicht geklappt. Du siehst den zuletzt geladenen Stand.' : 'Die Angebote konnten nicht geladen werden.'}</Text>
            <Pressable onPress={onPull} disabled={pages.isFetching} style={styles.clearCta} accessibilityRole="button" accessibilityState={{ disabled: pages.isFetching, busy: pages.isFetching }}><Text style={styles.clearCtaText}>{pages.isFetching ? 'Wird geladen …' : 'Erneut versuchen'}</Text></Pressable>
          </View>
        ) : null}
        ListEmptyComponent={
          isError ? null : isLoading ? (
            <ActivityIndicator style={{ marginTop: space.xl }} color={ui.textMuted} accessibilityLabel="Angebote werden geladen" />
          ) : narrowed ? (
            <View style={styles.empty}>
              <BerkatMark size={36} color={ui.sunken} />
              <Text style={styles.emptyTitle}>
                {query.trim() ? `Nichts für „${query.trim()}"` : 'Nichts in dieser Auswahl'}
              </Text>
              <Text style={styles.emptyBody}>
                {query.trim() && narrowedByFilter
                  ? 'Es liegt an der Suche, an den Filtern — oder an beidem zusammen.'
                  : query.trim()
                    ? 'Jedes Wort muss vorkommen — in Titel, Beschreibung, Marke, Farbe, Größe oder Ort. Lass eins weg.'
                    : filters.onlyShow && activeFilters === 0
                      ? // Der eine Fall, in dem der Grund NICHT „zu eng" ist,
                        'Für kommende Sendungen ist gerade nichts vorbereitet.'
                      : 'Die Filter sind zu eng. Nimm einen davon weg.'}
              </Text>
              <Pressable
                style={({ pressed }) => [styles.clearCta, pressed && { opacity: 0.7 }]}
                onPress={() => {
                  setQuery('');
                  resetFilters();
                }}
                accessibilityRole="button"
                accessibilityLabel="Suche und Filter zurücksetzen"
              >
                <Text style={styles.clearCtaText}>
                  {query.trim() && narrowedByFilter
                    ? 'Suche und Filter zurücksetzen'
                    : query.trim()
                      ? 'Suche zurücksetzen'
                      : 'Filter zurücksetzen'}
                </Text>
              </Pressable>
              {normalizeQuery(query).length >= 2 ? (
                <Pressable
                  style={({ pressed }) => [styles.notifyCta, pressed && { opacity: 0.7 }]}
                  onPress={toggleSavedSearch}
                  disabled={savingSearch}
                  accessibilityRole="button"
                  accessibilityState={{ selected: Boolean(savedSearchRow) }}
                  accessibilityLabel={
                    savedSearchRow
                      ? `„${normalizeQuery(query)}" nicht mehr merken`
                      : `Bescheid geben, wenn „${normalizeQuery(query)}" eingestellt wird`
                  }
                >
                  <BellPlus size={16} color={savedSearchRow ? ui.success : ui.text} />
                  <Text
                    style={[styles.notifyCtaText, savedSearchRow && { color: ui.success }]}
                  >
                    {savingSearch
                      ? 'Einen Moment …'
                      : savedSearchRow
                        ? 'Wir sagen dir Bescheid — antippen zum Abbestellen'
                        : 'Sag mir Bescheid, wenn so etwas kommt'}
                  </Text>
                </Pressable>
              ) : null}
              {searchNotice ? <Text style={styles.notifyNotice}>{searchNotice}</Text> : null}
            </View>
          ) : (
            <View style={styles.empty}>
              <BerkatMark size={36} color={ui.sunken} />
              <Text style={styles.emptyTitle}>Hier kommen die Angebote zusammen</Text>
              <Text style={styles.emptyBody}>
                Entdecke Angebote aus den Shops und kommenden Shows. Sobald etwas bereitsteht, findest du es hier.
              </Text>
            </View>
          )
        }
        ListFooterComponent={<SellerShopMore hasMore={pages.hasNextPage} fetching={pages.isFetching || pulling}
          loadingMore={pages.isFetchingNextPage} failed={pages.isFetchNextPageError} onLoad={loadMore} />}
        renderItem={({ item }) => {
          if ('spacer' in item) return <View style={{ flex: 1 }} />;
          const mine = myUserId === item.seller_id;
          const saved = Boolean(savedIds?.has(item.id));
          return (
            <ListingCard
              listing={item}
              sellerName={profiles[item.seller_id]?.username}
              mine={mine}
              saved={saved}
              saveCount={saveCounts?.get(item.id)}
              onToggleSaved={
                mine
                  ? undefined
                  : () =>
                      myUserId
                        ? toggleSaved.mutate({ auctionId: item.id, saved })
                        : router.push('/login')
              }
              onPress={() => router.push(`/listing/${item.id}`)}
            />
          );
        }}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { textAlign: 'center', fontSize: 17, fontWeight: '700', color: ui.text },
  headerSub: { textAlign: 'center', fontSize: 11, color: ui.textMuted, marginTop: 1 },
  row: { gap: space.md },
  loadNotice: { padding: space.md, backgroundColor: ui.card, borderRadius: radius.lg, alignItems: 'center' },
  /* ⚠️ Kein `paddingHorizontal` mehr: Die Filterzeile darunter bringt ihres
     selbst mit, weil sie waagerecht scrollt und auf JEDER Fläche am selben
     Rand beginnen muss. Läge es hier, bekäme sie es doppelt. */
  tools: { paddingBottom: space.md, gap: space.sm },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: space.md,
    gap: space.sm,
    backgroundColor: ui.sunken,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    minHeight: 44,
    paddingVertical: space.sm,
  },
  searchInput: { flex: 1, fontSize: 15, color: ui.text, padding: 0 },
  empty: { alignItems: 'center', paddingTop: space.xl * 2, paddingHorizontal: space.lg },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: ui.text, marginTop: space.md },
  notifyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ui.line,
  },
  notifyCtaText: { fontSize: 14, fontWeight: '600', color: ui.text },
  notifyNotice: {
    fontSize: 13,
    color: ui.textMuted,
    marginTop: space.sm,
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyBody: {
    fontSize: 13,
    color: ui.textMuted,
    marginTop: space.xs,
    textAlign: 'center',
    lineHeight: 19,
  },
  clearCta: {
    marginTop: space.md,
    minHeight: 44,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
  },
  clearCtaText: { fontSize: 14, fontWeight: '700', color: ui.text },
});
