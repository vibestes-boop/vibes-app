import { StudioBackdrop } from '@/components/ui/StudioBackdrop';
import { buildDiscoveryRows, DISCOVERY_MEDIA_GAP, DISCOVERY_MEDIA_GUTTER, MIN_POST_SEARCH_LENGTH, type DiscoveryRow } from '@/lib/exploreLayout';
import { ExploreGridItem, ExploreSearchBar, ExploreSortModal, ExploreTagChips, ExploreUserRow, getExploreStyles } from '@/components/explore';
import { SerloWordmark } from '@/components/brand/SerloWordmark';
import { DiscoveryHero } from '@/components/explore/DiscoveryHero';
import { ProductCoverImage } from '@/components/shop/ProductCoverImage';
import { ProductPriceLabel } from '@/components/shop/ProductPriceLabel';
import { useDiscoverPeople } from '@/lib/useDiscoverPeople';
import { EXPLORE_FALLBACK_TAGS, useExploreGrid, useExplorePostSearch, useExploreUserSearch, useTrendingTags, type ExplorePostThumb, type ExploreSortMode } from '@/lib/useExplore';
import { useShopProducts } from '@/lib/useShop';
import { useTheme } from '@/lib/useTheme';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
import { useI18n } from '@/lib/i18n';
import { useWomenOnly } from '@/lib/useWomenOnly';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowUpRight, ChevronRight, Flower2, Radio, SearchX, ShoppingBag, Users } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, type FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function useDebounce<T>(value: T) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setDebounced(value), 300); return () => clearTimeout(timer); }, [value]);
  return debounced;
}

export default function ExploreScreen() {
  useThemedStatusBar('auto');
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = getExploreStyles(colors);
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const availableWidth = width - insets.left - insets.right;
  const columns = fontScale > 1.5 ? 1 : availableWidth >= 700 ? 3 : 2;
  const cardWidth = (availableWidth - DISCOVERY_MEDIA_GUTTER * 2 - (columns - 1) * DISCOVERY_MEDIA_GAP) / columns;
  const router = useRouter();
  const scrollY = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<DiscoveryRow<ExplorePostThumb>>>(null);
  const { tag: incomingTag } = useLocalSearchParams<{ tag?: string }>();
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(incomingTag || null);
  const [sortMode, setSortMode] = useState<ExploreSortMode>('forYou');
  const [filterOpen, setFilterOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => { setActiveTag(incomingTag || null); }, [incomingTag]);
  const debouncedQuery = useDebounce(query);
  const isSearching = query.trim().length > 0;
  const waitingForSearch = query !== debouncedQuery;
  const grid = useExploreGrid(isSearching ? null : activeTag, sortMode);
  const tags = useTrendingTags();
  const users = useExploreUserSearch(debouncedQuery);
  const search = useExplorePostSearch(debouncedQuery, sortMode);
  const people = useDiscoverPeople();
  const products = useShopProducts({ limit: 6 });
  const { canAccessWomenOnly } = useWomenOnly();
  const posts = useMemo(() => isSearching ? (waitingForSearch ? [] : search.data ?? []) : grid.data?.pages.flat() ?? [], [isSearching, waitingForSearch, search.data, grid.data]);
  const loading = isSearching ? waitingForSearch || search.isLoading || users.isLoading : grid.isLoading;
  const failed = isSearching ? search.isError || users.isError : grid.isError;
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all(isSearching ? [...(debouncedQuery.trim().length >= MIN_POST_SEARCH_LENGTH ? [search.refetch()] : []), users.refetch()] : [grid.refetch(), tags.refetch(), people.refetch(), products.refetch()]);
    } finally { setRefreshing(false); }
  };
  const shortPostQuery = isSearching && debouncedQuery.trim().length < MIN_POST_SEARCH_LENGTH;
  const sectionHeading = (title: string) => <Text style={[s.sectionTitle, { color: colors.text.primary }]}>{title}</Text>;
  const renderPeople = useCallback(() => <View style={s.section}>
    <View style={{ paddingHorizontal: 20 }}><Text style={[s.sectionTitle, { color: colors.text.primary }]}>{t('nativeUi.people')}</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontal}>
      {people.data?.map(person => <ExploreUserRow key={person.id} user={person} compact reasonLabel={t(person.reason === 'guild' ? 'nativeUi.sameGroup' : person.reason === 'interests' ? 'nativeUi.sameInterests' : 'nativeUi.newHere')} />)}
    </ScrollView>
  </View>, [people.data, colors.text.primary, t]);
  const rows = useMemo(() => buildDiscoveryRows(posts, columns, !isSearching && !loading && (people.data?.length ?? 0) > 0), [posts, columns, isSearching, loading, people.data?.length]);
  const renderItem = useCallback(({ item }: { item: DiscoveryRow<ExplorePostThumb> }) => item.kind === 'people' ? renderPeople() : <View style={s.gridRow}>{item.posts.map(post => <ExploreGridItem key={post.id} item={post} width={cardWidth} />)}</View>, [cardWidth, renderPeople]);
  const emptyState = loading ? <ActivityIndicator color={colors.accent.primary} style={{ padding: 36 }} /> : <View style={s.empty}>
    <SearchX size={32} color={colors.icon.muted} />
    <Text style={[s.emptyText, { color: colors.text.secondary }]}>{failed ? t('nativeUi.loadError') : shortPostQuery ? t('ux.searchMinimum') : isSearching ? t('explore.nothingFound', { query: debouncedQuery }) : activeTag ? t('explore.tagEmpty', { tag: activeTag }) : t('nativeUi.emptyPosts')}</Text>
    {(failed || (!shortPostQuery && (isSearching || activeTag))) && <Pressable accessibilityRole="button" onPress={() => { if (failed) void onRefresh(); else { setQuery(''); setActiveTag(null); } }} style={[s.retry, { backgroundColor: colors.bg.elevated }]}><Text style={{ color: colors.accent.primary, fontWeight: '600' }}>{t(failed ? 'nativeUi.retry' : isSearching ? 'explore.clearSearch' : 'feed.removeFilter')}</Text></Pressable>}
  </View>;
  const footer = !isSearching ? <View>
    <Pressable onPress={() => router.push('/women-only')} accessibilityRole="button" style={[s.woz, { backgroundColor: colors.bg.elevated, borderColor: colors.border.default }]}>
      <View style={[s.wozIcon, { backgroundColor: `${colors.accent.rose}18` }]}><Flower2 size={23} color={colors.accent.rose} /></View>
      <View style={{ flex: 1, minWidth: 0 }}><Text style={[s.wozTitle, { color: colors.text.primary }]}>{t(canAccessWomenOnly ? 'explore.wozTitle' : 'explore.wozJoin')}</Text>
        <Text style={[s.wozBody, { color: colors.text.muted }]}>{t(canAccessWomenOnly ? 'explore.wozActive' : 'explore.wozTeaser')}</Text></View>
      <ChevronRight size={18} color={colors.icon.muted} />
    </Pressable>
    {(products.data?.length ?? 0) > 0 && <View style={s.section}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('explore.showAllProducts')} onPress={() => router.navigate('/(tabs)/shop')} style={s.sectionLink}>
        {sectionHeading(t('tabs.shop'))}<ArrowUpRight size={20} color={colors.accent.primary} />
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontal}>
        {products.data!.map(product => <Pressable key={product.id} accessibilityRole="button" accessibilityLabel={product.title}
          onPress={() => router.push({ pathname: '/shop/[id]', params: { id: product.id } })}
          style={[s.product, { backgroundColor: colors.bg.elevated, borderColor: colors.border.default }]}>
          <ProductCoverImage uri={product.cover_url} category={product.category} style={s.productImage} iconSize={20} />
          <Text numberOfLines={2} style={[s.productTitle, { color: colors.text.primary }]}>{product.title}</Text>
          <ProductPriceLabel product={product} />
        </Pressable>)}
      </ScrollView>
    </View>}
  </View> : null;

  // Refresh text measurements on Dynamic Type changes without remounting the native modal.
  return <View style={[s.screen, { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right, backgroundColor: colors.bg.primary }]}>
    <StudioBackdrop />
    <View key={`header-${fontScale}`} style={s.header}>
      <View style={s.wordmark}><SerloWordmark size={25} /></View>
      <ExploreSearchBar compact query={query} onQueryChange={value => { listRef.current?.scrollToOffset({ offset: 0, animated: false }); setQuery(value); setActiveTag(null); }} sortMode={sortMode} onOpenSort={() => setFilterOpen(true)} />
    </View>
    <ExploreSortModal visible={filterOpen} sortMode={sortMode} onClose={() => setFilterOpen(false)} onSelectSort={mode => { listRef.current?.scrollToOffset({ offset: 0, animated: false }); setSortMode(mode); }} />
    <Animated.FlatList key={`grid-${fontScale}`} ref={listRef} data={rows} keyExtractor={item => item.key} renderItem={renderItem}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })} scrollEventThrottle={16}
      contentContainerStyle={{ paddingBottom: insets.bottom + 88 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false} initialNumToRender={8} maxToRenderPerBatch={8} windowSize={7}
      ListHeaderComponent={<View>
        {!isSearching && <><DiscoveryHero scrollY={scrollY} shortcuts={[
          { id: 'guild', label: t('tabs.guild'), Icon: Users, onPress: () => router.navigate('/(tabs)/guild') },
          { id: 'shop', label: t('tabs.shop'), Icon: ShoppingBag, onPress: () => router.navigate('/(tabs)/shop') },
          { id: 'live', label: t('tabs.live'), Icon: Radio, onPress: () => router.navigate('/live') },
        ]} />
          <ExploreTagChips tags={tags.data ?? EXPLORE_FALLBACK_TAGS} activeTag={activeTag} onSelectTag={setActiveTag} />
        </>}
        {isSearching && !waitingForSearch && (users.data?.length ?? 0) > 0 && <View style={styles.usersSection}>{sectionHeading(t('explore.users'))}{users.data!.map(user => <ExploreUserRow key={user.id} user={user} />)}</View>}
        <View style={s.gridHeading}>{sectionHeading(t('nativeUi.posts'))}
          <Pressable onPress={() => setFilterOpen(true)} style={s.sortLabel} accessibilityRole="button"><Text style={{ color: colors.accent.primary, fontSize: 12, fontWeight: '600' }}>{t(sortMode === 'forYou' ? 'explore.sortForYou' : sortMode === 'trending' ? 'explore.sortTrending' : 'explore.sortNewest')}</Text><ChevronRight size={14} color={colors.accent.primary} /></Pressable>
        </View>
        {posts.length === 0 && rows.length > 0 && emptyState}
      </View>}
      ListEmptyComponent={emptyState}
      ListFooterComponent={<>{grid.isFetchingNextPage && !isSearching && <ActivityIndicator color={colors.accent.primary} style={{ padding: 20 }} />}{footer}</>}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} colors={[colors.accent.primary]} />}
      onEndReached={() => { if (!isSearching && grid.hasNextPage && !grid.isFetchingNextPage) void grid.fetchNextPage(); }} onEndReachedThreshold={0.3}
    />
  </View>;
}
const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12, gap: 10 },
  wordmark: { width: 62, flexShrink: 0 },
  gridRow: { flexDirection: 'row', paddingHorizontal: DISCOVERY_MEDIA_GUTTER, gap: DISCOVERY_MEDIA_GAP }, gridHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, gap: 12 },
  sectionTitle: { marginLeft: 0, fontSize: 18, fontWeight: '700', letterSpacing: -0.4, paddingVertical: 9, flexShrink: 1 },
  sortLabel: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 44 },
  section: { paddingTop: 12 }, sectionLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  horizontal: { gap: 12, paddingHorizontal: 16, paddingBottom: 14 },
  product: { width: 148, borderRadius: 18, borderWidth: 1, overflow: 'hidden' }, productImage: { width: 148, height: 120 },
  productTitle: { fontSize: 13, lineHeight: 18, paddingHorizontal: 10, paddingTop: 10, fontWeight: '600' },
  woz: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 16, padding: 15, gap: 12, borderRadius: 20, borderWidth: 1 },
  wozIcon: { padding: 10, borderRadius: 14 }, wozTitle: { fontSize: 14, fontWeight: '700' }, wozBody: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  empty: { alignItems: 'center', padding: 28, gap: 12 }, emptyText: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  retry: { minHeight: 44, paddingHorizontal: 20, justifyContent: 'center', borderRadius: 14 },
});
