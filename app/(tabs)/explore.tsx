import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  EXPLORE_FALLBACK_TAGS,
  useTrendingTags,
  useExploreGrid,
  useExploreUserSearch,
  useExplorePostSearch,
  type ExploreSortMode,
  type ExplorePostThumb,
} from '@/lib/useExplore';
import {
  EXPLORE_GRID_COLS,
  ExploreGridItem,
  ExploreUserRow,
  ExploreSortModal,
  ExploreSearchBar,
  ExploreTagChips,
  exploreStyles as styles,
} from '@/components/explore';

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
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<ExploreSortMode>('forYou');
  const [filterOpen, setFilterOpen] = useState(false);

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

  const renderGridItem = useCallback(({ item }: { item: ExplorePostThumb }) => <ExploreGridItem item={item} />, []);

  const gridPosts = gridData?.pages.flat() ?? [];
  const postsToShow = isSearching ? (foundPosts ?? []) : gridPosts;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
          <ActivityIndicator color="#22D3EE" size="large" />
        </View>
      ) : postsToShow.length === 0 && isSearching ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyText}>{`Keine Posts gefunden für „${debouncedQuery}"`}</Text>
        </View>
      ) : postsToShow.length === 0 && activeTag ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>🏷️</Text>
          <Text style={styles.emptyText}>{`Noch keine Posts mit Tag „${activeTag}"`}</Text>
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
                <ActivityIndicator color="#22D3EE" />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}
