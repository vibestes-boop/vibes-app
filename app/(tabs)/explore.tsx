import {
EXPLORE_GRID_COLS,
EXPLORE_ITEM_HEIGHT,
EXPLORE_ITEM_WIDTH,
ExploreGridItem,
ExploreSearchBar,
ExploreSortModal,
ExploreTagChips,
ExploreUserRow,
getExploreStyles,
} from '@/components/explore';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { ProductCoverImage } from '@/components/shop/ProductCoverImage';
import { useDiscoverPeople } from '@/lib/useDiscoverPeople';
import {
EXPLORE_FALLBACK_TAGS,
useExploreGrid,
useExplorePostSearch,
useExploreUserSearch,
useTrendingTags,
type ExplorePostThumb,
type ExploreSortMode,
} from '@/lib/useExplore';
import { useShopProducts } from '@/lib/useShop';
import { useTheme } from '@/lib/useTheme';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
import { useI18n } from '@/lib/i18n';
import { useWomenOnly } from '@/lib/useWomenOnly';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams,useRouter } from 'expo-router';
import { ChevronRight,SearchX,ShoppingBag,Sparkles,Tag } from 'lucide-react-native';
import { useCallback,useEffect,useRef,useState } from 'react';
import { ActivityIndicator,FlatList,Pressable,RefreshControl,ScrollView as RNScrollView,StyleSheet,Text,View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Verzögert den Wert um `delay` ms — verhindert eine Query pro Tastendruck */
function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    timer.current = setTimeout(() => setDebounced(value), delay);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value, delay]);
  return debounced;
}

export default function ExploreScreen() {
  const { t } = useI18n();
  useThemedStatusBar('auto');
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = getExploreStyles(colors);
  const { tag: incomingTag } = useLocalSearchParams<{ tag?: string }>();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<ExploreSortMode>('forYou');
  const [filterOpen, setFilterOpen] = useState(false);

  // Top Produkte für Shop-Sektion
  const { data: topProducts = [], refetch: refetchProducts } = useShopProducts({ limit: 6 });
  // WOZ-Status für Banner
  const { canAccessWomenOnly } = useWomenOnly();
  const [refreshing, setRefreshing] = useState(false);

  // Hashtag-Deep-Link aus Feed: Tag direkt vorauswählen
  useEffect(() => {
    if (incomingTag) setActiveTag(incomingTag);
  }, [incomingTag]);

  // Suche erst nach 300ms Tipp-Pause ausführen — spart Supabase-Queries
  const debouncedQuery = useDebounce(query, 300);
  const isSearching = debouncedQuery.trim().length > 0;

  const {
    data: gridData,
    isLoading: gridLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchGrid,
  } = useExploreGrid(
    isSearching ? null : activeTag,
    sortMode
  );
  const { data: trendingTags = EXPLORE_FALLBACK_TAGS, refetch: refetchTags } = useTrendingTags();
  const { data: users } = useExploreUserSearch(debouncedQuery);
  const { data: foundPosts, isLoading: searchLoading } = useExplorePostSearch(debouncedQuery);
  const { data: discoverUsers = [], refetch: refetchDiscover } = useDiscoverPeople();

  // Pull-to-Refresh: Grid + Trends + Nutzer + Shop parallel neu laden
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchGrid(), refetchTags(), refetchDiscover(), refetchProducts()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchGrid, refetchTags, refetchDiscover, refetchProducts]);

  const renderGridItem = useCallback(({ item }: { item: ExplorePostThumb }) => {
    if ((item as any).__isPlaceholder) {
      return <View style={{ width: EXPLORE_ITEM_WIDTH, height: EXPLORE_ITEM_HEIGHT }} />;
    }
    return <ExploreGridItem item={item} />;
  }, []);

  const gridPosts = gridData?.pages.flat() ?? [];
  const rawPostsToShow: ExplorePostThumb[] = isSearching ? (foundPosts ?? []) : gridPosts;
  // Letzte Grid-Reihe mit leeren Placeholders auffüllen (verhindert Stretch)
  const remainder = rawPostsToShow.length % EXPLORE_GRID_COLS;
  const postsToShow: ExplorePostThumb[] = remainder === 0
    ? rawPostsToShow
    : [
        ...rawPostsToShow,
        ...Array.from({ length: EXPLORE_GRID_COLS - remainder }, (_, i) => ({
          id: `__placeholder_${i}`,
          __isPlaceholder: true,
        } as unknown as ExplorePostThumb)),
      ];

  // ── Alle Discovery-Sektionen als EIN scrollbarer Listenkopf (statt fixer
  //    Kopfzeile) → die ganze Entdecken-Seite scrollt als eine Fläche. ──
  const listHeader = (
    <View>
      {!isSearching && (
        <ExploreTagChips tags={trendingTags} activeTag={activeTag} onSelectTag={setActiveTag} />
      )}

      {/* Nutzer entdecken — nur wenn nicht gesucht wird */}
      {!isSearching && discoverUsers.length > 0 && (
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
            <Sparkles size={15} color={colors.text.primary} strokeWidth={2} />
            <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>{t('explore.discoverUsers')}</Text>
          </View>
          <RNScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 10, paddingBottom: 10 }}
          >
            {discoverUsers.map((u) => (
              <ExploreUserRow
                key={u.id}
                user={u}
                reasonLabel={
                  u.reason === 'guild' ? '🏛 Gleiche Guild'
                  : u.reason === 'interests' ? '🏷 Gleiche Interessen'
                  : '✨ Neu'
                }
                compact
              />
            ))}
          </RNScrollView>
          <View style={styles.sectionDivider} />
        </View>
      )}

      {/* ── Women-Only Zone Banner ── */}
      {!isSearching && (
        <Pressable
          onPress={() => router.push('/women-only' as any)}
          style={wozBannerStyle.btn}
          accessibilityRole="button"
          accessibilityLabel="Women-Only Zone öffnen"
        >
          <LinearGradient
            colors={canAccessWomenOnly
              ? [`${colors.accent.rose}26`, `${colors.accent.secondary}26`]
              : [`${colors.accent.rose}14`, `${colors.accent.secondary}14`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[wozBannerStyle.inner, { borderColor: canAccessWomenOnly ? `${colors.accent.rose}59` : colors.border.subtle }]}
          >
            <View style={wozBannerStyle.left}>
              <Text style={wozBannerStyle.emoji}>🌸</Text>
              <View>
                <Text style={[wozBannerStyle.title, { color: canAccessWomenOnly ? colors.accent.rose : colors.text.primary }]}>
                  {canAccessWomenOnly ? t('explore.wozTitle') : t('explore.wozJoin')}
                </Text>
                <Text style={[wozBannerStyle.sub, { color: colors.text.muted }]}>
                  {canAccessWomenOnly ? t('explore.wozActive') : t('explore.wozTeaser')}
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={canAccessWomenOnly ? colors.accent.rose : colors.text.muted} strokeWidth={2} />
          </LinearGradient>
        </Pressable>
      )}

      {!isSearching && topProducts.length > 0 && (
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <ShoppingBag size={15} color={colors.text.primary} strokeWidth={2} />
              <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>Shop</Text>
            </View>
            <Pressable
              onPress={() => router.navigate('/(tabs)/shop' as any)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
              accessibilityRole="button"
              accessibilityLabel={t('explore.showAllProducts')}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text.muted }}>{t('explore.showAll')}</Text>
              <ChevronRight size={13} color={colors.text.muted} strokeWidth={2} />
            </Pressable>
          </View>
          <RNScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 10, paddingBottom: 12 }}
          >
            {topProducts.slice(0, 6).map((product) => (
              <Pressable
                key={product.id}
                style={[shopChipStyle.chip, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}
                onPress={() => router.push({ pathname: '/shop/[id]', params: { id: product.id } } as any)}
                accessibilityRole="button"
                accessibilityLabel={product.title}
              >
                <ProductCoverImage uri={product.cover_url} category={product.category} style={shopChipStyle.cover} iconSize={16} />
                <Text style={[shopChipStyle.title, { color: colors.text.primary }]} numberOfLines={1}>{product.title}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <CoinIcon size={12} />
                  <Text style={[shopChipStyle.price, { color: colors.accent.primary }]}>{product.price_coins}</Text>
                </View>
              </Pressable>
            ))}
          </RNScrollView>
          <View style={styles.sectionDivider} />
        </View>
      )}

      {isSearching && (users?.length ?? 0) > 0 && (
        <View style={styles.usersSection}>
          <Text style={styles.sectionLabel}>{t('explore.users')}</Text>
          {users!.map((u) => (
            <ExploreUserRow key={u.id} user={u} />
          ))}
          <View style={styles.sectionDivider} />
        </View>
      )}
    </View>
  );

  // Leer-/Ladezustand als ListEmptyComponent — bleibt unter dem Kopf sichtbar
  const listEmpty = (gridLoading || searchLoading) ? (
    <View style={styles.loadingWrap}>
      <ActivityIndicator color={colors.text.primary} size="large" />
    </View>
  ) : isSearching ? (
    <View style={styles.emptyWrap}>
      <SearchX size={48} color="rgba(255,255,255,0.3)" />
      <Text style={styles.emptyText}>{t('explore.nothingFound', { query: debouncedQuery })}</Text>
      <Pressable
        onPress={() => setQuery('')}
        style={emptyBtnStyle.btn}
        accessibilityRole="button"
        accessibilityLabel={t('explore.clearSearch')}
      >
        <Text style={[emptyBtnStyle.btnText, { color: colors.text.primary }]}>{t('explore.clearSearch')}</Text>
      </Pressable>
    </View>
  ) : activeTag ? (
    <View style={styles.emptyWrap}>
      <Tag size={48} color="rgba(255,255,255,0.3)" />
      <Text style={styles.emptyText}>{t('explore.tagEmpty', { tag: activeTag })}</Text>
      <Pressable
        onPress={() => setActiveTag(null)}
        style={emptyBtnStyle.btn}
        accessibilityRole="button"
        accessibilityLabel="Tag-Filter entfernen"
      >
        <Text style={[emptyBtnStyle.btnText, { color: colors.text.primary }]}>{t('feed.removeFilter')}</Text>
      </Pressable>
    </View>
  ) : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg.primary }]}>
      <ExploreSearchBar
        query={query}
        onQueryChange={(t) => {
          setQuery(t);
          setActiveTag(null);
        }}
        sortMode={sortMode}
        onOpenSort={() => setFilterOpen(true)}
      />

      <ExploreSortModal
        visible={filterOpen}
        sortMode={sortMode}
        onClose={() => setFilterOpen(false)}
        onSelectSort={setSortMode}
      />

      <FlatList
        data={postsToShow}
        keyExtractor={(item) => item.id}
        renderItem={renderGridItem}
        numColumns={EXPLORE_GRID_COLS}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.grid, postsToShow.length === 0 && { flexGrow: 1 }]}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        removeClippedSubviews
        initialNumToRender={12}
        maxToRenderPerBatch={9}
        windowSize={7}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text.primary}
            colors={[colors.accent.primary]}
          />
        }
        onEndReached={() => {
          if (!isSearching && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator color={colors.text.primary} />
            </View>
          ) : null
        }
      />
    </View>
  );
}

// ─── Alle Screen-lokalen Styles in einem einzigen Block ────────────────────────
const emptyBtnStyle = StyleSheet.create({
  btn: {
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(120,120,128,0.3)',
    backgroundColor: 'rgba(120,120,128,0.1)',
  },
  btnText: { fontSize: 14, fontWeight: '600' },
});

const shopChipStyle = StyleSheet.create({
  chip:             { width: 120, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  cover:            { width: 120, height: 100 },
  coverPlaceholder: { width: 120, height: 100, alignItems: 'center', justifyContent: 'center' },
  title:            { fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingTop: 6, lineHeight: 16 },
  price:            { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingBottom: 8, paddingTop: 2 },
});

const wozBannerStyle = StyleSheet.create({
  btn:   { marginHorizontal: 16, marginBottom: 10, borderRadius: 16, overflow: 'hidden' },
  inner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 16, borderWidth: 1,
  },
  left:  { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  emoji: { fontSize: 26 },
  title: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  sub:   { fontSize: 12, fontWeight: '500' },
});
