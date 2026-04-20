import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, Pressable, StyleSheet, Image as RNImage } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SearchX, Tag, ShoppingBag, ChevronRight } from 'lucide-react-native';
import {
  EXPLORE_FALLBACK_TAGS,
  useTrendingTags,
  useExploreGrid,
  useExploreUserSearch,
  useExplorePostSearch,
  type ExploreSortMode,
  type ExplorePostThumb,
} from '@/lib/useExplore';
import { useDiscoverPeople } from '@/lib/useDiscoverPeople';
import {
  EXPLORE_GRID_COLS,
  EXPLORE_ITEM_WIDTH,
  EXPLORE_ITEM_HEIGHT,
  ExploreGridItem,
  ExploreUserRow,
  ExploreSortModal,
  ExploreSearchBar,
  ExploreTagChips,
  getExploreStyles,
} from '@/components/explore';
import { ScrollView as RNScrollView } from 'react-native';
import { useTheme } from '@/lib/useTheme';
import { useShopProducts } from '@/lib/useShop';
import { useWomenOnly } from '@/lib/useWomenOnly';
import { LinearGradient } from 'expo-linear-gradient';

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
  const { data: topProducts = [] } = useShopProducts({ limit: 6 });
  // WOZ-Status für Banner
  const { canAccessWomenOnly } = useWomenOnly();

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
  } = useExploreGrid(
    isSearching ? null : activeTag,
    sortMode
  );
  const { data: trendingTags = EXPLORE_FALLBACK_TAGS } = useTrendingTags();
  const { data: users } = useExploreUserSearch(debouncedQuery);
  const { data: foundPosts, isLoading: searchLoading } = useExplorePostSearch(debouncedQuery);
  const { data: discoverUsers = [] } = useDiscoverPeople();

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

      {!isSearching && (
        <ExploreTagChips tags={trendingTags} activeTag={activeTag} onSelectTag={setActiveTag} />
      )}

      {/* Nutzer entdecken — nur wenn nicht gesucht wird */}
      {!isSearching && discoverUsers.length > 0 && (
        <View>
          <Text style={[styles.sectionLabel, { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 }]}>
            Nutzer entdecken
          </Text>
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
              ? ['rgba(244,63,94,0.15)', 'rgba(168,85,247,0.15)']
              : ['rgba(244,63,94,0.08)', 'rgba(168,85,247,0.08)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[wozBannerStyle.inner, { borderColor: canAccessWomenOnly ? 'rgba(244,63,94,0.35)' : colors.border.subtle }]}
          >
            <View style={wozBannerStyle.left}>
              <Text style={wozBannerStyle.emoji}>🌸</Text>
              <View>
                <Text style={[wozBannerStyle.title, { color: canAccessWomenOnly ? '#F43F5E' : colors.text.primary }]}>
                  {canAccessWomenOnly ? 'Women-Only Zone' : 'Women-Only Zone beitreten'}
                </Text>
                <Text style={[wozBannerStyle.sub, { color: colors.text.muted }]}>
                  {canAccessWomenOnly ? 'Dein geschützter Bereich ✓' : 'Exklusiv · Sicher · Nur für Frauen'}
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={canAccessWomenOnly ? '#F43F5E' : colors.text.muted} strokeWidth={2} />
          </LinearGradient>
        </Pressable>
      )}

      {!isSearching && topProducts.length > 0 && (
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <ShoppingBag size={15} color={colors.text.primary} strokeWidth={2} />
              <Text style={[styles.sectionLabel, { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }]}>Shop</Text>
            </View>
            <Pressable
              onPress={() => router.navigate('/(tabs)/shop' as any)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
              accessibilityRole="button"
              accessibilityLabel="Alle Produkte anzeigen"
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text.muted }}>Alle anzeigen</Text>
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
                {product.cover_url ? (
                  <RNImage
                    source={{ uri: product.cover_url }}
                    style={shopChipStyle.cover}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[shopChipStyle.coverPlaceholder, { backgroundColor: colors.bg.primary }]}>
                    <ShoppingBag size={16} color={colors.text.muted} strokeWidth={1.5} />
                  </View>
                )}
                <Text style={[shopChipStyle.title, { color: colors.text.primary }]} numberOfLines={1}>{product.title}</Text>
                <Text style={[shopChipStyle.price, { color: colors.accent.primary }]}>🪙 {product.price_coins}</Text>
              </Pressable>
            ))}
          </RNScrollView>
          <View style={styles.sectionDivider} />
        </View>
      )}

      {isSearching && (users?.length ?? 0) > 0 && (
        <View style={styles.usersSection}>
          <Text style={styles.sectionLabel}>Nutzer</Text>
          {users!.map((u) => (
            <ExploreUserRow key={u.id} user={u} />
          ))}
          <View style={styles.sectionDivider} />
        </View>
      )}

      {(gridLoading || searchLoading) && postsToShow.length === 0 ? (
        <View style={styles.loadingWrap}>
        <ActivityIndicator color={colors.text.primary} size="large" />
        </View>
      ) : postsToShow.length === 0 && isSearching ? (
        <View style={styles.emptyWrap}>
          <SearchX size={48} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyText}>{`Keine Posts gefunden für „${debouncedQuery}"`}</Text>
          <Pressable
            onPress={() => setQuery('')}
            style={emptyBtnStyle.btn}
            accessibilityRole="button"
            accessibilityLabel="Suche löschen"
          >
            <Text style={[emptyBtnStyle.btnText, { color: colors.text.primary }]}>Suche löschen</Text>
          </Pressable>
        </View>
      ) : postsToShow.length === 0 && activeTag ? (
        <View style={styles.emptyWrap}>
          <Tag size={48} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyText}>{`Noch keine Posts mit Tag „${activeTag}"`}</Text>
          <Pressable
            onPress={() => setActiveTag(null)}
            style={emptyBtnStyle.btn}
            accessibilityRole="button"
            accessibilityLabel="Tag-Filter entfernen"
          >
            <Text style={[emptyBtnStyle.btnText, { color: colors.text.primary }]}>Filter entfernen</Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          data={postsToShow}
          keyExtractor={(item) => item.id}
          renderItem={renderGridItem}
          numColumns={EXPLORE_GRID_COLS}
          estimatedItemSize={130}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.grid}
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
      )}
    </View>
  );
}

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
  chip: {
    width: 120, borderRadius: 14, borderWidth: 1, overflow: 'hidden',
  },
  cover: { width: 120, height: 100 },
  coverPlaceholder: { width: 120, height: 100, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingTop: 6, lineHeight: 16 },
  price: { fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingBottom: 8, paddingTop: 2 },
});

const wozBannerStyle = StyleSheet.create({
  btn: { marginHorizontal: 16, marginBottom: 10, borderRadius: 16, overflow: 'hidden' },
  inner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 16, borderWidth: 1,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  emoji: { fontSize: 26 },
  title: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  sub:   { fontSize: 12, fontWeight: '500' },
});
