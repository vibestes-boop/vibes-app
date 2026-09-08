// Shop: serverseitige Auswahl, anschließend seitenweise Angebote.
import { useCallback, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Modal,
  RefreshControl,
  ScrollView,
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
  CalendarClock,
  ChevronLeft,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react-native';
import { useSession } from '../lib/session';
import { goBack } from '../lib/nav';
import { formatEuro, useProfiles } from '../lib/useAuction';
import { type Listing } from '../lib/useListings';
import { useBrowseListingPages, type BrowseSort } from '../lib/useBrowseListingPages';
import { SellerShopMore } from '../components/SellerShopMore';
import { useSavedIds, useToggleSaved, useSavedCounts } from '../lib/useSaved';
import {
  normalizeQuery,
  savedSearchError,
  useSavedSearches,
  useSavedSearchActions,
} from '../lib/useSavedSearches';
import { useCategoryOptions } from '../lib/useCategories';
import { CONDITIONS, conditionLabel } from '../lib/useBerkatSeller';
import { ListingCard } from '../components/ListingCard';
import { BerkatMark } from '../components/BerkatMark';
import { radius, space, ui } from '../theme/tokens';
import { useReducedMotion } from '../lib/useReducedMotion';
const COLS = 2;
const priceSteps = [2500, 5000, 10000, 25000];
const SORTS: { key: BrowseSort; label: string }[] = [
  { key: 'neu', label: 'Neueste' },
  { key: 'guenstig', label: 'Günstigste' },
  { key: 'teuer', label: 'Teuerste' },
];
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
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);
  const focused = useIsFocused();
  const { fontScale } = useWindowDimensions();
  const pullingRef = useRef(false);
  const { data: savedIds } = useSavedIds(myUserId);
  const toggleSaved = useToggleSaved(myUserId);
  const categories = useCategoryOptions();
  const categoryGroups = categories.groups;
  const categoryNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of categoryGroups) {
      m.set(p.slug, p.name);
      for (const c of p.children) m.set(c.slug, c.name);
    }
    return m;
  }, [categoryGroups]);
  const [pulling, setPulling] = useState(false);
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(typeof params.q === 'string' ? params.q.slice(0, 100) : '');
  const [searchNotice, setSearchNotice] = useState<string | null>(null);
  const [savingSearch, setSavingSearch] = useState(false);
  const [sort, setSort] = useState<BrowseSort>('neu');
  const [filterOpen, setFilterOpen] = useState(false);
  const [cat, setCat] = useState<string | null>(null);
  const [cond, setCond] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [onlyShow, setOnlyShow] = useState(false);
  const activeFilters = [cat, cond, size?.trim() || null, city?.trim() || null, maxPrice].filter((v) => v !== null).length;
  const resetFilters = useCallback(() => {
    setCat(null);
    setCond(null);
    setSize(null);
    setCity(null);
    setMaxPrice(null);
    setOnlyShow(false);
  }, []);
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
  const slugs = useMemo(() => {
    if (!cat) return undefined;
    const group = categoryGroups.find(group => group.slug === cat);
    return [cat, ...(group?.children.map(child => child.slug) ?? [])];
  }, [cat, categoryGroups]);
  const pages = useBrowseListingPages({ slugs, query, condition: cond, size, city, maxPrice, onlyShow, sort }, focused);
  const { isLoading, refetch } = pages;
  const isError = pages.isError && !pages.isFetchNextPageError;
  const listings = pages.data?.listings ?? [];
  const profiles = useProfiles(listings.map(listing => listing.seller_id));
  const narrowedByFilter = activeFilters > 0 || onlyShow;
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
              placeholder="Artikel, Größe oder Ort suchen"
              accessibilityLabel="Artikel, Größe oder Ort suchen"
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sortRow}
          >
            <Pressable
              onPress={() => setFilterOpen(true)}
              style={[styles.chip, styles.filterChip, activeFilters > 0 && styles.chipOn]}
              accessibilityRole="button"
              accessibilityLabel={
                activeFilters > 0 ? `Filter, ${activeFilters} aktiv` : 'Filter'
              }
            >
              <SlidersHorizontal
                size={14}
                color={activeFilters > 0 ? ui.bg : ui.text}
              />
              <Text style={[styles.chipText, activeFilters > 0 && styles.chipTextOn]}>
                {activeFilters > 0 ? `Filter · ${activeFilters}` : 'Filter'}
              </Text>
            </Pressable>
            {(
              <Pressable
                onPress={() => setOnlyShow((v) => !v)}
                style={[styles.chip, styles.filterChip, onlyShow && styles.chipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: onlyShow }}
                accessibilityLabel={
                  onlyShow ? 'Alle Angebote zeigen' : 'Nur Artikel aus kommenden Sendungen'
                }
              >
                <CalendarClock size={14} color={onlyShow ? ui.bg : ui.text} />
                <Text style={[styles.chipText, onlyShow && styles.chipTextOn]}>In einer Show</Text>
              </Pressable>
            )}
            {SORTS.map((option) => {
              const on = option.key === sort;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setSort(option.key)}
                  style={[styles.chip, on && styles.chipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {narrowedByFilter ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeRow}>
              {[
                cat ? { key: 'cat', label: categoryNames.get(cat) ?? cat, clear: () => setCat(null) } : null,
                size ? { key: 'size', label: `Gr. ${size}`, clear: () => setSize(null) } : null,
                cond ? { key: 'cond', label: conditionLabel(cond) ?? cond, clear: () => setCond(null) } : null,
                city ? { key: 'city', label: city, clear: () => setCity(null) } : null,
                maxPrice !== null ? { key: 'price', label: `bis ${formatEuro(maxPrice)}`, clear: () => setMaxPrice(null) } : null,
                onlyShow ? { key: 'show', label: 'In einer Show', clear: () => setOnlyShow(false) } : null,
              ].filter((filter) => filter !== null).map((filter) => (
                <Pressable key={filter.key} onPress={filter.clear} style={styles.activeChip} accessibilityRole="button" accessibilityLabel={`Filter ${filter.label} entfernen`}>
                  <Text style={styles.activeText}>{filter.label}</Text><X size={14} color={ui.brand} />
                </Pressable>
              ))}
              <Pressable onPress={resetFilters} style={styles.resetAll} accessibilityRole="button"><Text style={styles.activeText}>Alle zurücksetzen</Text></Pressable>
            </ScrollView>
          ) : null}
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
                    ? 'Gesucht wird in Titel, Größe und Ort. Versuch ein anderes Wort.'
                    : onlyShow && activeFilters === 0
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
      <Modal
        visible={filterOpen}
        animationType={reducedMotion ? 'none' : 'slide'}
        presentationStyle="pageSheet"
        onRequestClose={() => setFilterOpen(false)}
      >
        <KeyboardAvoidingView key={fontScale} style={styles.sheet} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Filter</Text>
            <Pressable
              style={styles.back}
              onPress={() => setFilterOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
            >
              <X size={22} color={ui.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
            <FilterGroup
              label="Kategorie"
              options={categoryGroups.map(group => group.slug)}
              value={cat}
              onChange={setCat}
              display={(slug) => categoryNames.get(slug) ?? slug}
            />
            {categories.isError && !categories.data ? <Pressable onPress={() => void categories.refetch({ cancelRefetch: false })} style={styles.clearCta} accessibilityRole="button"><Text style={styles.clearCtaText}>Kategorien erneut laden</Text></Pressable> : null}
            <Text style={styles.groupLabel}>Größe</Text>
            <TextInput value={size ?? ''} onChangeText={value => setSize(value || null)} maxLength={24}
              placeholder="Zum Beispiel M, 38 oder One Size" accessibilityLabel="Nach Größe filtern"
              placeholderTextColor={ui.textMuted} autoCorrect={false} style={styles.filterInput} />
            <FilterGroup label="Zustand" options={CONDITIONS.map(condition => condition.slug)}
              value={cond} onChange={setCond} display={slug => conditionLabel(slug) ?? slug} />
            <Text style={styles.groupLabel}>Ort</Text>
            <TextInput value={city ?? ''} onChangeText={value => setCity(value || null)} maxLength={80}
              placeholder="Stadt eingeben" accessibilityLabel="Nach Ort filtern"
              placeholderTextColor={ui.textMuted} autoCorrect={false} style={styles.filterInput} />
            {priceSteps.length > 0 ? (
              <>
                <Text style={styles.groupLabel}>Preis</Text>
                <View style={styles.groupRow}>
                  {priceSteps.map((cents) => {
                    const on = maxPrice === cents;
                    return (
                      <Pressable
                        key={cents}
                        onPress={() => setMaxPrice(on ? null : cents)}
                        style={[styles.opt, on && styles.optOn]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                      >
                        <Text style={[styles.optText, on && styles.optTextOn]}>
                          bis {formatEuro(cents)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
          </ScrollView>
          <View style={[styles.sheetFoot, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
            {activeFilters > 0 ? (
              <Pressable
                style={({ pressed }) => [styles.footGhost, pressed && { opacity: 0.7 }]}
                onPress={resetFilters}
                accessibilityRole="button"
              >
                <Text style={styles.footGhostText}>Zurücksetzen</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.footPrimary, pressed && { opacity: 0.85 }]}
              onPress={() => setFilterOpen(false)}
              accessibilityRole="button"
            >
              <Text style={styles.footPrimaryText}>
                Auswahl anzeigen
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
function FilterGroup({
  label,
  options,
  value,
  onChange,
  display,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (v: string | null) => void;
  display: (key: string) => string;
}) {
  if (options.length === 0) return null;
  return (
    <>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.groupRow}>
        {options.map((key) => {
          const on = value === key;
          return (
            <Pressable
              key={key}
              onPress={() => onChange(on ? null : key)}
              style={[styles.opt, on && styles.optOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={display(key)}
            >
              <Text style={[styles.optText, on && styles.optTextOn]}>
                {display(key)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
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
  activeRow: { gap: space.sm, alignItems: 'center' },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: ui.card, borderWidth: 1, borderColor: ui.line },
  activeText: { fontSize: 12, fontWeight: '600', color: ui.brand },
  resetAll: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm },
  loadNotice: { padding: space.md, backgroundColor: ui.card, borderRadius: radius.lg, alignItems: 'center' },
  tools: { paddingHorizontal: space.md, paddingBottom: space.md, gap: space.sm },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: ui.sunken,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    minHeight: 44,
    paddingVertical: space.sm,
  },
  searchInput: { flex: 1, fontSize: 15, color: ui.text, padding: 0 },
  sortRow: { gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    minHeight: 44,
    paddingVertical: space.sm,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
  },
  chipOn: { backgroundColor: ui.brand },
  chipText: { fontSize: 13, fontWeight: '600', color: ui.text },
  chipTextOn: { color: ui.bg },
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
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sheet: { flex: 1, backgroundColor: ui.bg },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: ui.text },
  sheetBody: { padding: space.lg, paddingBottom: space.xl },
  groupLabel: { fontSize: 12, color: ui.textMuted, marginTop: space.lg, marginBottom: space.sm },
  groupRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  opt: {
    paddingHorizontal: space.md,
    minHeight: 44,
    paddingVertical: space.sm,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
  },
  optOn: { backgroundColor: ui.brand },
  optText: { fontSize: 13, fontWeight: '600', color: ui.text },
  optTextOn: { color: ui.bg },
  filterInput: { minHeight: 48, borderRadius: radius.md, backgroundColor: ui.sunken, paddingHorizontal: space.md, paddingVertical: space.md, fontSize: 15, color: ui.text },
  sheetFoot: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ui.line,
  },
  footGhost: {
    minHeight: 48,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
  },
  footGhostText: { fontSize: 15, fontWeight: '700', color: ui.text },
  footPrimary: {
    flexGrow: 1,
    flexBasis: 170,
    minHeight: 48,
    paddingVertical: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
  },
  footPrimaryText: { textAlign: 'center', flexShrink: 1, fontSize: 15, fontWeight: '700', color: ui.goldInk },
});
