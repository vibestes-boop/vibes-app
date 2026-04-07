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
import { Search, AlertTriangle, SearchX, TrendingUp, Zap } from 'lucide-react-native';
import TuneMyVibeOverlay from '@/components/ui/TuneMyVibeOverlay';
import { useFocusEffect, useRouter } from 'expo-router';
import { useVibeFeed, useTrendingFeed, useFollowingFeed } from '@/lib/usePosts';
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
import { Image } from 'expo-image';
import { FeedSkeleton } from '@/components/feed/FeedSkeleton';
import { vibeFeedScreenStyles as styles } from '@/components/feed/feedStyles';
import { FEED_VIDEO_VIEWABILITY, SCREEN_HEIGHT } from '@/components/feed/feedConstants';
import type { FeedItemData } from '@/components/feed/types';
import { UserProfileContent } from '@/components/profile/UserProfileContent';
import { LiveFeedCard } from '@/components/live/LiveFeedCard';
import { useFeedNavStore } from '@/lib/feedNavStore';
import { useVideoMute } from '@/lib/useVideoPreferences';
import { getTitleFromUrl } from '@/lib/useMusicPicker';

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
  const { isMuted, toggleMute } = useVideoMute();
  const [hasNewPosts, setHasNewPosts] = useState(false);
  const [feedMode, setFeedMode] = useState<'foryou' | 'following'>('foryou');

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

  // Y-Grenze: Swipes die IM Header-Bereich beginnen (Status Bar + Toggle + Tags)
  // sollen den Profil-Swipe NICHT auslösen.
  // feedModeBar (52px) + CategoryFilter (46px) + Puffer = ~110px
  const swipeTopBoundaryRef = useRef(150);
  // Bottom-Grenze: Progress Bar + Tab-Bar Bereich ausschließen (insets.bottom + 49 + 60px Buffer)
  const swipeBottomBoundaryRef = useRef(9999);
  useEffect(() => {
    swipeTopBoundaryRef.current = insets.top + 110;
    // SCREEN_H - (insets.bottom + tab-bar 49px + hitArea 28px + 20px Puffer)
    swipeBottomBoundaryRef.current = SCREEN_HEIGHT - insets.bottom - 110;
  }, [insets.top, insets.bottom]);

  const swipePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, g) =>
        // Swipes im Header-Bereich (Tags, Toggle) NICHT abfangen
        evt.nativeEvent.pageY > swipeTopBoundaryRef.current &&
        // Swipes im Progress-Bar / Tab-Bar Bereich NICHT abfangen
        evt.nativeEvent.pageY < swipeBottomBoundaryRef.current &&
        g.dx < -18 &&
        Math.abs(g.dx) > Math.abs(g.dy) * 2.0,

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
    isLoading: foryouLoading,
    isError: foryouError,
    error: foryouErr,
    refetch: refetchForyou,
    fetchNextPage: fetchNextForyou,
    hasNextPage: hasNextForyou,
    isFetchingNextPage: fetchingNextForyou,
  } = useVibeFeed(activeTag);
  // Trending-Feed: Fallback für neue User ohne Follows / Dwell-History
  const { data: trendingPosts } = useTrendingFeed();

  // Following-Feed
  const {
    data: followingPagedPosts,
    isLoading: followingLoading,
    isError: followingError,
    error: followingErr,
    refetch: refetchFollowing,
    fetchNextPage: fetchNextFollowing,
    hasNextPage: hasNextFollowing,
    isFetchingNextPage: fetchingNextFollowing,
  } = useFollowingFeed();

  // Aktiver Feed basierend auf Modus
  const isLoading         = feedMode === 'foryou' ? foryouLoading    : followingLoading;
  const isError           = feedMode === 'foryou' ? foryouError      : followingError;
  const error             = feedMode === 'foryou' ? foryouErr        : followingErr;
  const refetch           = feedMode === 'foryou' ? refetchForyou    : refetchFollowing;
  const fetchNextPage     = feedMode === 'foryou' ? fetchNextForyou  : fetchNextFollowing;
  const hasNextPage       = feedMode === 'foryou' ? hasNextForyou    : hasNextFollowing;
  const isFetchingNextPage = feedMode === 'foryou' ? fetchingNextForyou : fetchingNextFollowing;
  const activePagedPosts  = feedMode === 'foryou' ? pagedPosts       : followingPagedPosts;
  const { onViewableItemsChanged: dwellOnViewable } = useDwellTracker();
  const dwellOnViewableRef = useRef(dwellOnViewable);
  const setVisibleItemIdRef = useRef(setVisibleItemId);
  dwellOnViewableRef.current = dwellOnViewable;
  setVisibleItemIdRef.current = setVisibleItemId;

  const viewedPostsRef = useRef<Set<string>>(new Set());

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
        // View-Count: RPC nur einmal pro Session pro Post aufrufen (fire & forget)
        if (id && !viewedPostsRef.current.has(id)) {
          viewedPostsRef.current.add(id);
          void Promise.resolve(supabase.rpc('increment_post_view', { p_post_id: id }));
        }
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
      // Feed-Avatar-Tap → nur diese User's Stories, kein Weitersprung zu anderen
      openStory(group, [group]);
      router.push('/story-viewer' as any);
    },
    [openStory, router]
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

  const onMuteToggle = useCallback(() => toggleMute(), [toggleMute]);
  const onOpenTune = useCallback(() => setOverlayVisible(true), []);

  // Alle Seiten zu einer flachen Liste zusammenführen
  const allPosts = useMemo(
    () => (activePagedPosts?.pages ?? []).flatMap((page) => page),
    [activePagedPosts]
  );

  // Trending-Fallback: wenn personalisierter Feed leer ist und kein Tag-Filter aktiv
  const isTrending = feedMode === 'foryou' && !isLoading && !isError && allPosts.length === 0 && !activeTag && (trendingPosts?.length ?? 0) > 0;
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
        thumbnailUrl: p.thumbnail_url ?? null,
        authorId: p.author_id,
        avatarUrl: p.avatar_url ?? null,
        viewCount: (p as any).view_count ?? 0,
        gradient: ['#0A0A0A', '#1a0533', '#0d1f4a'],
        accentColor: '#22D3EE',
        privacy: p.privacy ?? 'public',
        allowComments: p.allow_comments ?? true,
        allowDuet: p.allow_duet ?? true,
        // Musik-Track (TikTok-Vinyl Badge + Feed-Audio)
        audioUrl: p.audio_url ?? null,
        audioTitle: getTitleFromUrl(p.audio_url),  // URL → Titel aus der lokalen Library
        audioVolume: p.audio_volume ?? 0.8,         // Lautstärke vom Creator eingestellt
        // Verifiziertes Creator-Häkchen
        isVerified: p.is_verified ?? null,
      })),
    [activePosts]
  );

  // Fix 2: Proaktiver Prefetch — erste 5 Thumbnails + Avatar-URLs sobald Feed geladen
  // Expo-Image batcht das intern — keine Race Conditions, keine doppelten Requests
  useEffect(() => {
    if (feedData.length === 0) return;
    const urls = feedData
      .slice(0, 5)
      .flatMap((p) => [p.thumbnailUrl, p.mediaType === 'image' ? p.mediaUrl : null, p.avatarUrl])
      .filter((u): u is string => !!u);
    if (urls.length > 0) {
      Image.prefetch?.(urls).catch(() => { /* ignorieren */ });
    }
  }, [feedData]);

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
        return (
          <LiveFeedCard
            session={item.data as LiveSession}
            isActive={item.id === visibleItemIdRef.current}
          />
        );
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

  const getItemLayout = useCallback(
    (_: unknown, index: number) => {
      // Alle Items (Posts UND Lives) haben SCREEN_HEIGHT (für korrektes pagingEnabled-Snapping)
      const offset = index * SCREEN_HEIGHT;
      return { length: SCREEN_HEIGHT, offset, index };
    },
    []
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
      {/* Ganz leerer Feed — "Für dich" Mode */}
      {feedMode === 'foryou' && !isLoading && !isError && feedRows.length === 0 && !activeTag && !isTrending && (
        <View style={[styles.emptyTag, { gap: 16 }]}>
          <Zap size={56} color="#A855F7" strokeWidth={1.5} />
          <Text style={styles.emptyTagTitle}>Willkommen bei Vibes! ✨</Text>
          <Text style={styles.emptyTagSub}>
            Folge anderen oder poste deinen ersten Vibe — dein Feed füllt sich automatisch.
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/explore')}
            style={[styles.emptyTagBtn, { backgroundColor: 'rgba(168,85,247,0.2)', borderColor: 'rgba(168,85,247,0.4)', borderWidth: 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Explore öffnen"
          >
            <Text style={[styles.emptyTagBtnText, { color: '#A855F7' }]}>Explore öffnen</Text>
          </Pressable>
        </View>
      )}
      {/* Ganz leerer Feed — "Folge ich" Mode */}
      {feedMode === 'following' && !isLoading && !isError && feedRows.length === 0 && (
        <View style={[styles.emptyTag, { gap: 16 }]}>
          <Search size={56} color="#22D3EE" strokeWidth={1.5} />
          <Text style={styles.emptyTagTitle}>Noch kein Following-Feed</Text>
          <Text style={styles.emptyTagSub}>
            Folge Usern im Explore-Tab — ihre Posts erscheinen hier chronologisch.
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/explore')}
            style={[styles.emptyTagBtn, { backgroundColor: 'rgba(34,211,238,0.1)', borderColor: 'rgba(34,211,238,0.3)', borderWidth: 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Leute entdecken"
          >
            <Text style={[styles.emptyTagBtnText, { color: '#22D3EE' }]}>Leute entdecken</Text>
          </Pressable>
        </View>
      )}
      {/* Trending-Badge: wird nur angezeigt wenn Trending-Feed aktiv ist */}
      {isTrending && (
        <View style={[styles.filterBar, { top: insets.top + 92, pointerEvents: 'none' }]}>

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

      {/* ── Haupt-Header: Toggle + Suche in einer Zeile ───────────────── */}
      <View
        style={[styles.feedModeBar, { top: insets.top }]}
        pointerEvents="box-none"
      >
        {/* Links: Platzhalter für symmetrisches Zentrieren */}
        <View style={{ width: 40 }} pointerEvents="none" />

        {/* Mitte: "Für dich | Folge ich" Toggle */}
        <View style={styles.feedModeRow} pointerEvents="auto">
          <Pressable
            onPress={() => {
              impactAsync(ImpactFeedbackStyle.Light);
              setFeedMode('foryou');
              setActiveTag(null);
            }}
            style={styles.feedModeBtn}
            hitSlop={12}
          >
            <Text style={[styles.feedModeTxt, feedMode === 'foryou' && styles.feedModeTxtActive]}>
              Für dich
            </Text>
            {feedMode === 'foryou' && <View style={styles.feedModeLine} />}
          </Pressable>

          <Pressable
            onPress={() => {
              impactAsync(ImpactFeedbackStyle.Light);
              setFeedMode('following');
            }}
            style={styles.feedModeBtn}
            hitSlop={12}
          >
            <Text style={[styles.feedModeTxt, feedMode === 'following' && styles.feedModeTxtActive]}>
              Folge ich
            </Text>
            {feedMode === 'following' && <View style={styles.feedModeLine} />}
          </Pressable>
        </View>

        {/* Rechts: Suche-Button */}
        <Pressable
          onPress={() => {
            impactAsync(ImpactFeedbackStyle.Light);
            router.push('/(tabs)/explore');
          }}
          hitSlop={10}
          style={styles.feedSearchBtn}
          pointerEvents="auto"
        >
          <Search size={18} stroke="rgba(255,255,255,0.8)" strokeWidth={2} />
        </Pressable>
      </View>

      {/* ── Kategorie-Chips (nur Für-dich-Mode, ohne "For You") ─────── */}
      {feedMode === 'foryou' && (
        <View style={[styles.filterBar, { top: insets.top + 52 }]} pointerEvents="box-none">
          <View style={styles.filterScroll} pointerEvents="auto">
            <CategoryFilter activeTag={activeTag} onSelect={setActiveTag} hideForYou />
          </View>
        </View>
      )}


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
