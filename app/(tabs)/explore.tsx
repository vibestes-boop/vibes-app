import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { SearchX, Tag } from 'lucide-react-native';
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
  ExploreGridItem,
  ExploreUserRow,
  ExploreSortModal,
  ExploreSearchBar,
  ExploreTagChips,
  exploreStyles as styles,
} from '@/components/explore';
import { ScrollView as RNScrollView } from 'react-native';

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
  const { tag: incomingTag } = useLocalSearchParams<{ tag?: string }>();
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<ExploreSortMode>('forYou');
  const [filterOpen, setFilterOpen] = useState(false);

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
          <SearchX size={48} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyText}>{`Keine Posts gefunden für „${debouncedQuery}"`}</Text>
          <Pressable
            onPress={() => setQuery('')}
            style={emptyBtnStyle.btn}
            accessibilityRole="button"
            accessibilityLabel="Suche löschen"
          >
            <Text style={emptyBtnStyle.btnText}>Suche löschen</Text>
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
            <Text style={emptyBtnStyle.btnText}>Filter entfernen</Text>
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
                <ActivityIndicator color="#22D3EE" />
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
    borderColor: 'rgba(34,211,238,0.4)',
    backgroundColor: 'rgba(34,211,238,0.1)',
  },
  btnText: { color: '#22D3EE', fontSize: 14, fontWeight: '600' },
});
