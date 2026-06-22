import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import {
ActivityIndicator,
Dimensions,
FlatList,
PanResponder,
Platform,
Pressable,
RefreshControl,
Animated as RNAnimated,
ScrollView,
Text,
View,
type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// reanimated: CJS require() is used to avoid _interopRequireDefault crash in Hermes HBC.
import { useAnimatedStyle,useSharedValue,withTiming } from 'react-native-reanimated';

import { FEED_VIDEO_VIEWABILITY,SCREEN_HEIGHT } from '@/components/feed/feedConstants';
import { FeedItem } from '@/components/feed/FeedItem';
import { FeedSkeleton } from '@/components/feed/FeedSkeleton';
import { vibeFeedScreenStyles as styles } from '@/components/feed/feedStyles';
import { FollowingEmptyState } from '@/components/feed/FollowingEmptyState';
import type { FeedItemData } from '@/components/feed/types';
import { LiveFeedCard } from '@/components/live/LiveFeedCard';
import { UserProfileContent } from '@/components/profile/UserProfileContent';
import { CategoryFilter } from '@/components/ui/CategoryFilter';
import { SerloLoader } from '@/components/ui/SerloLoader';
import TuneMyVibeOverlay from '@/components/ui/TuneMyVibeOverlay';
import { useAuthStore } from '@/lib/authStore';
import { useTheme } from '@/lib/useTheme';
import { useFeedNavStore } from '@/lib/feedNavStore';
import { useStoryViewerStore } from '@/lib/storyViewerStore';
import { supabase } from '@/lib/supabase';
import { useDwellTracker } from '@/lib/useDwellTracker';
import { emptyFeedEngagementMaps,useFeedEngagement } from '@/lib/useFeedEngagement';
import { useFeedBunny } from '@/lib/useFeedBunny';
import type { LiveSession } from '@/lib/useLiveSession';
import { useActiveLiveSessions } from '@/lib/useLiveSession';
import { getTitleFromUrl } from '@/lib/useMusicPicker';
import { useFollowingFeed,useHasUserPosted,useTrendingFeed,useVibeFeed } from '@/lib/usePosts';
import { useGuildStories,type StoryGroup } from '@/lib/useStories';
import { useTabRefreshStore,vibesFeedActions } from '@/lib/useTabRefresh';
import { useVideoMute } from '@/lib/useVideoPreferences';
import { impactAsync,ImpactFeedbackStyle } from 'expo-haptics';
import { Image } from 'expo-image';
import { useFocusEffect,useRouter } from 'expo-router';
import { AlertTriangle,Clock,PlusCircle,Search,SearchX,TrendingUp,Zap } from 'lucide-react-native';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };

type FeedRow =
  | { __type: 'post'; id: string; data: FeedItemData }
  | { __type: 'live'; id: string; data: LiveSession };


export default function VibeFeedScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const listRef = useRef<FlatList>(null);

  const [overlayVisible, setOverlayVisible] = useState(false);
  const [screenFocused, setScreenFocused] = useState(true);
  const [visibleItemId, setVisibleItemId] = useState<string | null>(null);
  const { isMuted, toggleMute } = useVideoMute();
  const [hasNewPosts, setHasNewPosts] = useState(false);
  const [feedMode, setFeedMode] = useState<'foryou' | 'following'>('foryou');
  const [secondaryQueriesEnabled, setSecondaryQueriesEnabled] = useState(false);

  // ── Short-Video-Style: Finger-folgendes Profil-Panel ─────────────────────
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
  const [firstPostNudgeQueryEnabled, setFirstPostNudgeQueryEnabled] = useState(false);
  useEffect(() => {
    setFirstPostNudgeQueryEnabled(false);
    if (!profile?.id || feedMode !== 'foryou') return;
    const t = setTimeout(() => setFirstPostNudgeQueryEnabled(true), 1200);
    return () => clearTimeout(t);
  }, [profile?.id, feedMode]);
  const { data: hasFirstPost = true, isLoading: loadingFirstPostState } = useHasUserPosted(
    profile?.id ?? null,
    firstPostNudgeQueryEnabled
  );
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
  const { data: trendingPosts } = useTrendingFeed({
    enabled: feedMode === 'foryou' && secondaryQueriesEnabled,
  });

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
  } = useFollowingFeed({
    enabled: feedMode === 'following',
  });

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
  const { data: storyGroups = [], refetch: refetchStories } = useGuildStories({
    enabled: secondaryQueriesEnabled,
  });
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
      if (secondaryQueriesEnabled) refetchStories();
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
    }, [refetchStories, secondaryQueriesEnabled, showBanner])
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
  const activePosts = useMemo(
    () => (isTrending ? (trendingPosts ?? []) : allPosts),
    [isTrending, trendingPosts, allPosts]
  );

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
        accentColor: '#FFFFFF',
        privacy: p.privacy ?? 'public',
        allowComments: p.allow_comments ?? true,
        allowDuet: p.allow_duet ?? true,
        // Musik-Track (Short-Video-Vinyl Badge + Feed-Audio)
        audioUrl: p.audio_url ?? null,
        audioTitle: getTitleFromUrl(p.audio_url),  // URL → Titel aus der lokalen Library
        audioVolume: p.audio_volume ?? 0.8,         // Lautstärke vom Creator eingestellt
        // Verifiziertes Creator-Häkchen
        isVerified: p.is_verified ?? null,
        // Women-Only Zone
        womenOnly: (p as any).women_only ?? false,
      })),
    [activePosts]
  );

  useEffect(() => {
    if (secondaryQueriesEnabled || feedData.length === 0) return;
    const t = setTimeout(() => setSecondaryQueriesEnabled(true), 900);
    return () => clearTimeout(t);
  }, [feedData.length, secondaryQueriesEnabled]);

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

  // Cold start: erster Feed-Post soll sofort aktiv sein, nicht erst nach FlatList-Viewability.
  useEffect(() => {
    if (!screenFocused || feedData.length === 0) return;
    setVisibleItemId((current) => {
      if (current && feedData.some((post) => post.id === current)) return current;
      return feedData[0]?.id ?? current;
    });
  }, [feedData, screenFocused]);

  const postIds = useMemo(() => feedData.map((p) => p.id), [feedData]);
  // Bunny-HLS-IDs per Post-ID anreichern (separat vom Feed-RPC).
  const bunnyByPost = useFeedBunny(postIds);
  // Signal für extraData: ändert sich 0→N, sobald die (async) Bunny-IDs ankommen.
  // Ohne dieses Signal rendern die bereits sichtbaren Top-Posts mit bunnyVideoId=null
  // (R2) und schalten — weil renderItem aus einem Ref liest — erst beim nächsten
  // Scroll auf HLS. Mit dem Signal re-rendern sie sofort beim Eintreffen der IDs.
  const bunnyReadyCount = Object.keys(bunnyByPost).length;
  const authorIds = useMemo(() => feedData.map((p) => p.authorId).filter((id): id is string => !!id), [feedData]);
  const { data: engagementMaps = emptyFeedEngagementMaps() } = useFeedEngagement(postIds, authorIds, {
    enabled: secondaryQueriesEnabled,
  });

  // Feed-IDs in Store speichern — Post-Detailseite nutzt dies für Swipe-Navigation
  const setFeedNavPostIds = useFeedNavStore((s) => s.setPostIds);
  useEffect(() => {
    if (postIds.length > 0) setFeedNavPostIds(postIds, 'vibes');
  }, [postIds, setFeedNavPostIds]);

  // Refs für PanResponder aktuell halten (kein stale closure)
  const activePlaybackItemId = visibleItemId ?? (screenFocused ? (feedData[0]?.id ?? null) : null);
  feedDataRef.current = feedData;
  visibleItemIdRef.current = activePlaybackItemId;

  // Rolling-Prefetch: die nächsten 3 Poster + Avatare AB dem aktiven Item
  // vorausladen → beim Weiterscrollen erscheint das Bild SOFORT, auch tief im
  // Feed (der einmalige First-5-Prefetch oben deckt nur den Kaltstart ab). Reine
  // expo-image-Prefetch — kein Video-Decoder, daher kein Risiko auf schwachen
  // Geräten (Decoder-Limit). Das nächste VIDEO buffert bereits über windowSize
  // vor; expo-video hat keine JS-Prefetch-API, daher hier bewusst nur Poster.
  useEffect(() => {
    if (!activePlaybackItemId || feedData.length === 0) return;
    const idx = feedData.findIndex((p) => p.id === activePlaybackItemId);
    if (idx < 0) return;
    const urls = feedData
      .slice(idx + 1, idx + 4)
      .flatMap((p) => [p.thumbnailUrl, p.mediaType === 'image' ? p.mediaUrl : null, p.avatarUrl])
      .filter((u): u is string => !!u);
    if (urls.length > 0) Image.prefetch?.(urls).catch(() => { /* ignorieren */ });
  }, [activePlaybackItemId, feedData]);

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
  const bunnyByPostRef = useRef(bunnyByPost);
  bunnyByPostRef.current = bunnyByPost;

  const { data: activeLives = [] } = useActiveLiveSessions({
    enabled: secondaryQueriesEnabled,
  });
  const showFirstPostNudge =
    !!profile &&
    feedMode === 'foryou' &&
    !loadingFirstPostState &&
    hasFirstPost === false &&
    !isError;

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
          bunnyVideoId={bunnyByPostRef.current[postData.id] ?? null}
        />
      );
    },
    // Nur stabile Callbacks als Dependencies — keine volatilen Werte
    [onMuteToggle, handleOpenStory, onOpenTune]
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
          <Zap size={56} color={colors.accent.secondary} strokeWidth={1.5} />
          <Text style={styles.emptyTagTitle}>Willkommen bei Serlo! ✨</Text>
          <Text style={styles.emptyTagSub}>
            Folge anderen oder poste deinen ersten Vibe — dein Feed füllt sich automatisch.
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/explore')}
            style={[styles.emptyTagBtn, { backgroundColor: `${colors.accent.secondary}33`, borderColor: `${colors.accent.secondary}66`, borderWidth: 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Explore öffnen"
          >
            <Text style={[styles.emptyTagBtnText, { color: colors.accent.secondary }]}>Explore öffnen</Text>
          </Pressable>
        </View>
      )}
      {/* Ganz leerer Feed — "Folge ich" Mode */}
      {feedMode === 'following' && !isLoading && !isError && feedRows.length === 0 && (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <FollowingEmptyState
            onExplore={() => router.push('/(tabs)/explore')}
          />
        </ScrollView>
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
        extraData={`${activePlaybackItemId ?? ''}:${screenFocused ? '1' : '0'}:${isMuted ? '1' : '0'}:${bunnyReadyCount}`}
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
              <ActivityIndicator color="#FFFFFF" size="small" />
            </View>
          ) : null
        }
        {...(Platform.OS === 'android' ? ({ overScrollMode: 'never' } as const) : {})}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={handleRefresh}
            tintColor="transparent"
            colors={['transparent']}
            progressViewOffset={insets.top + 100}
          />
        }
      />

      {/* Pull-to-Refresh: markeneigener Beam statt nativem Spinner (Feed ist immer schwarz) */}
      {isRefreshing && (
        <View
          style={{ position: 'absolute', left: 0, right: 0, top: insets.top + 58, alignItems: 'center', zIndex: 50 }}
          pointerEvents="none"
        >
          <SerloLoader />
        </View>
      )}

      {/* Stories → jetzt in Nachrichten-Tab */}

      <Animated.View
        style={[styles.newPostsBanner, { top: insets.top + 6 }, bannerStyle]}
        pointerEvents={hasNewPosts ? 'auto' : 'none'}
      >
        <Pressable onPress={handleRefresh} style={styles.newPostsBannerInner}>
          <View style={[styles.newPostsBlur, { backgroundColor: 'rgba(10,10,20,0.92)' }]}>
            <View style={styles.newPostsDot} />
            <Text style={styles.newPostsText}>Neue Posts verfügbar</Text>
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

        {/* Rechts: Suche + Replay Buttons */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} pointerEvents="auto">
          <Pressable
            onPress={() => {
              impactAsync(ImpactFeedbackStyle.Light);
              router.push('/live/replays' as any);
            }}
            hitSlop={10}
            style={styles.feedSearchBtn}
          >
            <Clock size={18} stroke="rgba(255,255,255,0.8)" strokeWidth={2} />
          </Pressable>
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
      </View>

      {/* ── Kategorie-Tabs (Short-Video-Stil, nur Für-dich-Mode) ─────── */}
      {feedMode === 'foryou' && (
        <View style={[styles.filterBar, { top: insets.top + 52 }]} pointerEvents="box-none">
          <CategoryFilter
            activeTag={activeTag}
            onSelect={(tag) => setActiveTag(tag === activeTag ? null : tag)}
            hideForYou
          />
        </View>
      )}

      {showFirstPostNudge && (
        <FirstPostNudge
          top={insets.top + 100}
          onCreate={() => {
            impactAsync(ImpactFeedbackStyle.Light);
            router.push({
              pathname: '/create',
              params: { caption: 'Was sagt ihr dazu?' },
            });
          }}
        />
      )}

      <TuneMyVibeOverlay visible={overlayVisible} onClose={() => setOverlayVisible(false)} />

      {/* ── Short-Video Swipe: Echtes Profil folgt dem Finger ── */}
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

function FirstPostNudge({ top, onCreate }: { top: number; onCreate: () => void }) {
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 14,
        right: 14,
        top,
        zIndex: 95,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.14)',
          backgroundColor: 'rgba(8,10,22,0.88)',
          paddingHorizontal: 14,
          paddingVertical: 12,
          shadowColor: '#000',
          shadowOpacity: 0.28,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>
            Starte deinen ersten Vibe
          </Text>
          <Text
            style={{
              color: 'rgba(255,255,255,0.62)',
              fontSize: 12,
              lineHeight: 17,
              marginTop: 2,
            }}
            numberOfLines={2}
          >
            Ein Bild oder kurzes Video mit einer Frage bekommt schneller echte Reaktionen.
          </Text>
        </View>
        <Pressable
          onPress={onCreate}
          accessibilityRole="button"
          accessibilityLabel="Ersten Post erstellen"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderRadius: 999,
            backgroundColor: '#FFFFFF',
            paddingHorizontal: 12,
            paddingVertical: 9,
          }}
        >
          <PlusCircle size={16} color="#070A16" strokeWidth={2.4} />
          <Text style={{ color: '#070A16', fontSize: 12, fontWeight: '900' }}>Posten</Text>
        </Pressable>
      </View>
    </View>
  );
}
