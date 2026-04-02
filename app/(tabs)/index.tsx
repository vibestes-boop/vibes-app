import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Platform,
  RefreshControl,
  FlatList,
  PanResponder,
  Dimensions,
  Animated as RNAnimated,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// reanimated: CJS require() is used to avoid _interopRequireDefault crash in Hermes HBC.
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };

import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import { Search, AlertTriangle, SearchX, TrendingUp } from 'lucide-react-native';
import TuneMyVibeOverlay from '@/components/ui/TuneMyVibeOverlay';
import { useFocusEffect, useRouter } from 'expo-router';
import { useVibeFeed, useTrendingFeed } from '@/lib/usePosts';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/authStore';
import { CategoryFilter } from '@/components/ui/CategoryFilter';
import { useDwellTracker } from '@/lib/useDwellTracker';
import { useGuildStories, type StoryGroup } from '@/lib/useStories';
import { useStoryViewerStore } from '@/lib/storyViewerStore';
import { useFeedEngagement, emptyFeedEngagementMaps } from '@/lib/useFeedEngagement';
import { useActiveLiveSessions } from '@/lib/useLiveSession';
import type { LiveSession } from '@/lib/useLiveSession';
import { useTabRefreshStore, vibesFeedActions } from '@/lib/useTabRefresh';
import { FeedItem } from '@/components/feed/FeedItem';
import { FeedSkeleton } from '@/components/feed/FeedSkeleton';
import { vibeFeedScreenStyles as styles } from '@/components/feed/feedStyles';
import { FEED_VIDEO_VIEWABILITY, SCREEN_HEIGHT } from '@/components/feed/feedConstants';
import type { FeedItemData } from '@/components/feed/types';
import { UserProfileContent } from '@/components/profile/UserProfileContent';
import { LiveFeedCard } from '@/components/live/LiveFeedCard';
import { useFeedNavStore } from '@/lib/feedNavStore';

type FeedRow =
  | { __type: 'post'; id: string; data: FeedItemData }
  | { __type: 'live'; id: string; data: LiveSession };


export default function VibeFeedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const listRef = useRef<FlatList>(null);

  const [overlayVisible, setOverlayVisible] = useState(false);
  const [screenFocused, setScreenFocused] = useState(true);
  const [visibleItemId, setVisibleItemId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [hasNewPosts, setHasNewPosts] = useState(false);

  // ── TikTok-Style: Finger-folgendes Profil-Panel ─────────────────────
  // Refs wegen stale closure (PanResponder wird nur einmal erstellt)
  const feedDataRef = useRef<FeedItemData[]>([]);
  const visibleItemIdRef = useRef<string | null>(null);
  const SCREEN_W = Dimensions.get('window').width;
  const profileSlideX = useRef(new RNAnimated.Value(SCREEN_W)).current;
  const [profilePanel, setProfilePanel] = useState<{ authorId: string } | null>(null);
  const profilePanelRef = useRef<{ authorId: string } | null>(null);

  const snapPanelIn = () => RNAnimated.spring(profileSlideX, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
  const snapPanelOut = () => RNAnimated.spring(profileSlideX, { toValue: SCREEN_W, useNativeDriver: true, bounciness: 0, speed: 25 }).start(
    () => { setProfilePanel(null); profilePanelRef.current = null; }
  );

  const swipePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        g.dx < -18 && Math.abs(g.dx) > Math.abs(g.dy) * 2.0,

      onPanResponderGrant: () => {
        const post = feedDataRef.current.find((p) => p.id === visibleItemIdRef.current);
        if (!post?.authorId) return;
        const panel = { authorId: post.authorId };
        profilePanelRef.current = panel;
        setProfilePanel(panel);
        profileSlideX.setValue(SCREEN_W);
      },

      onPanResponderMove: (_, g) => {
        if (!profilePanelRef.current) return;
        profileSlideX.setValue(Math.max(0, SCREEN_W + g.dx));
      },

      onPanResponderRelease: (_, g) => {
        if (!profilePanelRef.current) return;
        if (g.dx < -(SCREEN_W * 0.35) || g.vx < -0.5) {
          impactAsync(ImpactFeedbackStyle.Medium);
          snapPanelIn();
        } else {
          snapPanelOut();
        }
      },

      onPanResponderTerminate: () => snapPanelOut(),
    })
  ).current;

  // ── Zurück-Swipe direkt auf dem Profil-Panel (folgt dem Finger) ───────────
  const backPan = useRef(
    PanResponder.create({
      // Nur Rechts-Gesten übernehmen (Zurück) — klar horizontal
      onMoveShouldSetPanResponder: (_, g) =>
        g.dx > 15 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8,

      onPanResponderMove: (_, g) => {
        // Panel folgt dem Finger nach rechts (aber nicht über SCREEN_W hinaus)
        profileSlideX.setValue(Math.min(SCREEN_W, Math.max(0, g.dx)));
      },

      onPanResponderRelease: (_, g) => {
        if (g.dx > SCREEN_W * 0.35 || g.vx > 0.5) {
          impactAsync(ImpactFeedbackStyle.Light);
          snapPanelOut();
        } else {
          snapPanelIn();
        }
      },

      onPanResponderTerminate: () => snapPanelIn(),
    })
  ).current;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastFetchedAt = useRef<string>(new Date().toISOString());

  // Seed-Tag: gecacht mit useMemo — Date.now()/new Date() nicht bei jedem Render
  const profile = useAuthStore((s) => s.profile);
  const seedTag = useMemo(() => {
    if (!profile?.preferred_tags?.length) return null;
    const createdAt = profile.created_at ? new Date(profile.created_at).getTime() : null;
    const accountDays = createdAt ? (Date.now() - createdAt) / 86_400_000 : 0;
    return accountDays < 7 ? (profile.preferred_tags[0] ?? null) : null;
  }, [profile?.created_at, profile?.preferred_tags]);
  const [activeTag, setActiveTag] = useState<string | null>(seedTag);

  const bannerY = useSharedValue(-60);
  const bannerOpacity = useSharedValue(0);

  const {
    data: pagedPosts,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useVibeFeed(activeTag);
  // Trending-Feed: Fallback für neue User ohne Follows / Dwell-History
  const { data: trendingPosts } = useTrendingFeed();
  const { onViewableItemsChanged: dwellOnViewable } = useDwellTracker();
  const dwellOnViewableRef = useRef(dwellOnViewable);
  const setVisibleItemIdRef = useRef(setVisibleItemId);
  dwellOnViewableRef.current = dwellOnViewable;
  setVisibleItemIdRef.current = setVisibleItemId;

  /** useRef statt useMemo: FlatList erlaubt kein Ersetzen von `viewabilityConfigCallbackPairs` –
   *  auch nicht bei React Fast Refresh. useRef bleibt über alle Re-Renders stabil. */
  const viewabilityConfigCallbackPairsRef = useRef([
    {
      viewabilityConfig: FEED_VIDEO_VIEWABILITY,
      onViewableItemsChanged: (info: { viewableItems: ViewToken[] }) => {
        const raw = info.viewableItems[0]?.item;
        const id =
          raw && typeof raw === 'object' && 'id' in raw ? String((raw as { id: string }).id) : null;
        setVisibleItemIdRef.current(id);
      },
    },
    {
      viewabilityConfig: {
        itemVisiblePercentThreshold: 80,
        minimumViewTime: 500,
      },
      onViewableItemsChanged: (info: { changed: ViewToken[] }) => {
        dwellOnViewableRef.current(info);
      },
    },
  ]);
  const viewabilityConfigCallbackPairs = viewabilityConfigCallbackPairsRef.current;
  const { data: storyGroups = [], refetch: refetchStories } = useGuildStories();
  const storyGroupMap = useMemo(() => new Map(storyGroups.map((g) => [g.userId, g])), [storyGroups]);
  const openStory = useStoryViewerStore((s) => s.open);
  const handleOpenStory = useCallback(
    (group: StoryGroup) => {
      openStory(group, storyGroups);
      router.push('/story-viewer' as any);
    },
    [openStory, storyGroups, router]
  );


  const bannerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bannerY.value }],
    opacity: bannerOpacity.value,
  }));

  const showBanner = useCallback(() => {
    bannerY.value = withTiming(0, { duration: 150 });
    bannerOpacity.value = withTiming(1, { duration: 120 });
  }, [bannerY, bannerOpacity]);

  const hideBanner = useCallback(() => {
    bannerY.value = withTiming(-60, { duration: 150 });
    bannerOpacity.value = withTiming(0, { duration: 120 });
  }, [bannerY, bannerOpacity]);

  const handleRefresh = useCallback(async () => {
    impactAsync(ImpactFeedbackStyle.Medium);
    setIsRefreshing(true);
    setHasNewPosts(false);
    hideBanner();
    lastFetchedAt.current = new Date().toISOString();
    await refetch();
    setIsRefreshing(false);
    setTimeout(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }), 50);
  }, [refetch, hideBanner]);

  // Realtime-Subscription statt Polling — 0 DB-Queries im Hintergrund
  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      refetchStories();
      lastFetchedAt.current = new Date().toISOString();

      const channel = supabase
        .channel('new-vibes-posts')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'posts', filter: 'is_guild_post=eq.false' },
          (payload) => {
            // Nur Posts die nach dem letzten Fetch erstellt wurden
            const newPostTime = (payload.new as { created_at?: string })?.created_at;
            if (newPostTime && newPostTime > lastFetchedAt.current) {
              setHasNewPosts(true);
              showBanner();
            }
          }
        )
        .subscribe();

      return () => {
        setScreenFocused(false);
        supabase.removeChannel(channel);
      };
    }, [refetchStories, showBanner])
  );

  // ── Tab-Tap Refresh: Scroll-to-top + Refetch wenn Vibes-Button gedrückt ────────
  const vibesRefreshTick = useTabRefreshStore((s) => s.vibesRefreshTick);
  const setVibesRefreshing = useTabRefreshStore((s) => s.setVibesRefreshing);

  // Globalen Ref setzen: Tab-Layout kann diesen direkt aufrufen (kein Re-Render-Delay)
  useEffect(() => {
    vibesFeedActions.refresh = () => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
      refetch().finally(() => setVibesRefreshing(false));
    };
    return () => { vibesFeedActions.refresh = null; };
    // refetch ist stabil (von React Query), nur einmal mounten
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Backup: Zustand-Signal (falls Feed gerade nicht gemountet für den Ref)
  useEffect(() => {
    if (vibesRefreshTick === 0) return;   // Erster Render: kein Refresh
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    refetch().finally(() => setVibesRefreshing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vibesRefreshTick]);

  const onMuteToggle = useCallback(() => setIsMuted((m) => !m), []);
  const onOpenTune = useCallback(() => setOverlayVisible(true), []);

  // Alle Seiten zu einer flachen Liste zusammenführen
  const allPosts = useMemo(
    () => (pagedPosts?.pages ?? []).flatMap((page) => page),
    [pagedPosts]
  );

  // Trending-Fallback: wenn personalisierter Feed leer ist und kein Tag-Filter aktiv
  const isTrending = !isLoading && !isError && allPosts.length === 0 && !activeTag && (trendingPosts?.length ?? 0) > 0;
  const activePosts = isTrending ? (trendingPosts ?? []) : allPosts;

  const feedData = useMemo<FeedItemData[]>(
    () =>
      activePosts.map((p) => ({
        id: p.id,
        author: `@${p.username ?? 'unknown'}`,
        caption: p.caption ?? '',
        tag: p.tags?.[0] ?? 'Vibe',
        tags: (p.tags ?? []).slice(0, 4),
        mediaUrl: p.media_url ?? null,
        mediaType: p.media_type ?? 'image',
        authorId: p.author_id,
        avatarUrl: p.avatar_url ?? null,
        gradient: ['#0A0A0A', '#1a0533', '#0d1f4a'],
        accentColor: '#22D3EE',
      })),
    [activePosts]
  );

  const postIds = useMemo(() => feedData.map((p) => p.id), [feedData]);
  const authorIds = useMemo(() => feedData.map((p) => p.authorId).filter((id): id is string => !!id), [feedData]);
  const { data: engagementMaps = emptyFeedEngagementMaps() } = useFeedEngagement(postIds, authorIds);

  // Feed-IDs in Store speichern — Post-Detailseite nutzt dies für Swipe-Navigation
  const setFeedNavPostIds = useFeedNavStore((s) => s.setPostIds);
  useEffect(() => {
    if (postIds.length > 0) setFeedNavPostIds(postIds, 'vibes');
  }, [postIds, setFeedNavPostIds]);

  // Refs für PanResponder aktuell halten (kein stale closure)
  feedDataRef.current = feedData;
  visibleItemIdRef.current = visibleItemId;

  // ─── Volatile Refs für renderItem ────────────────────────────────────────────
  // Diese Werte ändern sich häufig (bei jedem Scroll, Mute-Toggle, Engagement-Update)
  // Als Refs gehalten → renderItem bleibt stabil → keine unnötigen FeedItem-Re-Renders
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;
  const screenFocusedRef = useRef(screenFocused);
  screenFocusedRef.current = screenFocused;
  const storyGroupMapRef = useRef(storyGroupMap);
  storyGroupMapRef.current = storyGroupMap;
  const engagementMapsRef = useRef(engagementMaps);
  engagementMapsRef.current = engagementMaps;

  const { data: activeLives = [] } = useActiveLiveSessions();

  // 🔴 Live-Karten alle 6 Posts in den Feed einfügen
  // Je mehr Likes ein Live hat, desto früher erscheint es (Heat Score bereits von useLiveSession sortiert)
  const feedRows = useMemo<FeedRow[]>(() => {
    const rows: FeedRow[] = feedData.map((d) => ({
      __type: 'post',
      id: d.id,
      data: d,
    }));
    // Jedes aktive Live nach allen 6 Posts einfügen
    activeLives.forEach((live, i) => {
      const insertAt = Math.min((i + 1) * 6, rows.length);
      rows.splice(insertAt, 0, {
        __type: 'live',
        id: `live-${live.id}`,
        data: live,
      });
    });
    return rows;
  }, [feedData, activeLives]);


  // renderItem liest volatile Werte aus Refs — stabile Funktion, keine FlatList-Re-Renders
  const renderItem = useCallback(
    ({ item }: { item: FeedRow }) => {
      if (item.__type === 'live') {
        return <LiveFeedCard session={item.data as LiveSession} />;
      }
      const postData = item.data as FeedItemData;
      return (
        <FeedItem
          item={postData}
          shouldPlayVideo={screenFocusedRef.current && postData.id === visibleItemIdRef.current}
          isMuted={isMutedRef.current}
          onMuteToggle={onMuteToggle}
          storyGroup={postData.authorId ? storyGroupMapRef.current.get(postData.authorId) : undefined}
          onOpenStory={handleOpenStory}
          onOpenTune={onOpenTune}
          engagement={engagementMapsRef.current}
        />
      );
    },
    // Nur stabile Callbacks als Dependencies — keine volatilen Werte
    [onMuteToggle, handleOpenStory, onOpenTune]
  );

  // getItemLayout: Live-Karten bekommen korrekten Offset (nicht 0)
  const getItemLayout = useCallback(
    (_: unknown, index: number) => {
      let offset = 0;
      for (let i = 0; i < index; i++) {
        offset += feedRows[i]?.__type === 'live' ? 296 : SCREEN_HEIGHT;
      }
      const length = feedRows[index]?.__type === 'live' ? 296 : SCREEN_HEIGHT;
      return { length, offset, index };
    },
    [feedRows]
  );

  return (
    <View style={styles.container} {...swipePan.panHandlers}>
      {isLoading && <FeedSkeleton />}
      {isError && (
        <View style={styles.emptyTag}>
          <AlertTriangle size={52} color="#F59E0B" />
          <Text style={styles.emptyTagTitle}>Feed-Fehler</Text>
          <Text style={styles.emptyTagSub}>{(error as Error)?.message ?? 'Unbekannter Fehler — Pull zum Neu laden.'}</Text>
        </View>
      )}
      {!isLoading && !isError && feedData.length === 0 && activeTag && (
        <View style={styles.emptyTag}>
          <SearchX size={52} color="rgba(255,255,255,0.5)" />
          <Text style={styles.emptyTagTitle}>{`Nichts unter „${activeTag}“`}</Text>
          <Text style={styles.emptyTagSub}>Noch keine Posts mit diesem Tag — sei der Erste.</Text>
          <Pressable
            onPress={() => setActiveTag(null)}
            style={styles.emptyTagBtn}
            accessibilityRole="button"
            accessibilityLabel="Filter entfernen"
          >
            <Text style={styles.emptyTagBtnText}>Filter entfernen</Text>
          </Pressable>
        </View>
      )}
      {/* Trending-Badge: wird nur angezeigt wenn Trending-Feed aktiv ist */}
      {isTrending && (
        <View style={[styles.filterBar, { top: insets.top + 56, pointerEvents: 'none' }]}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 5,
            backgroundColor: 'rgba(239,68,68,0.85)',
            paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
            alignSelf: 'flex-start', marginLeft: 16,
          }}>
            <TrendingUp size={11} color="#fff" strokeWidth={2.5} />
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>Trending</Text>
          </View>
        </View>
      )}
      <FlatList
        ref={listRef}
        data={feedRows}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        scrollEventThrottle={16}
        removeClippedSubviews={Platform.OS === 'android'}
        style={styles.list}
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
        windowSize={3}
        maxToRenderPerBatch={2}
        initialNumToRender={2}
        updateCellsBatchingPeriod={16}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.pageLoadingFooter}>
              <ActivityIndicator color="#22D3EE" size="small" />
            </View>
          ) : null
        }
        {...(Platform.OS === 'android' ? ({ overScrollMode: 'never' } as const) : {})}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#22D3EE"
            progressViewOffset={insets.top + 100}
          />
        }
      />

      {/* Stories → jetzt in Nachrichten-Tab */}

      <Animated.View
        style={[styles.newPostsBanner, { top: insets.top + 6 }, bannerStyle]}
        pointerEvents={hasNewPosts ? 'auto' : 'none'}
      >
        <Pressable onPress={handleRefresh} style={styles.newPostsBannerInner}>
          <View style={[styles.newPostsBlur, { backgroundColor: 'rgba(10,10,20,0.92)' }]}>
            <View style={styles.newPostsDot} />
            <Text style={styles.newPostsText}>Neue Vibes verfügbar</Text>
            <Text style={styles.newPostsArrow}>↑</Text>
          </View>
        </Pressable>
      </Animated.View>

      <View style={[styles.filterBar, { top: insets.top + 10 }]} pointerEvents="box-none">
        <View style={styles.filterRow} pointerEvents="box-none">
          <View style={styles.filterScroll}>
            <CategoryFilter activeTag={activeTag} onSelect={setActiveTag} />
          </View>

          <Pressable
            onPress={() => {
              impactAsync(ImpactFeedbackStyle.Light);
              router.push('/(tabs)/explore');
            }}
            hitSlop={8}
            style={styles.filterExploreBtn}
          >
            <View style={[styles.filterExploreBtnBlur, { backgroundColor: 'rgba(10,10,20,0.75)' }]}>
              <Search size={17} stroke="rgba(255,255,255,0.8)" strokeWidth={2} />
            </View>
          </Pressable>
        </View>


      </View>

      <TuneMyVibeOverlay visible={overlayVisible} onClose={() => setOverlayVisible(false)} />

      {/* ── TikTok Swipe: Echtes Profil folgt dem Finger ── */}
      {profilePanel && (
        <RNAnimated.View
          style={{
            position: 'absolute', inset: 0, zIndex: 400,
            transform: [{ translateX: profileSlideX }],
          }}
          {...backPan.panHandlers}
        >
          {/* Schatten-Linie links (Tiefeneffekt) */}
          <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, zIndex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
          <UserProfileContent
            userId={profilePanel.authorId}
            onBack={snapPanelOut}
          />
        </RNAnimated.View>
      )}
    </View>
  );
}
