import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { View, Text, Pressable, ActivityIndicator, Alert, RefreshControl, FlatList, ScrollView, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';
import {
  PlusCircle, Sparkles, Bookmark, BarChart2, FileText, Trash2,
  Eye, Heart, MessageCircle, TrendingUp, Clock, ArrowUpDown,
  CheckCircle2, Users, TrendingDown,
} from 'lucide-react-native';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import { useUnreadCount } from '@/lib/useNotifications';
import { useBookmarkedPosts } from '@/lib/useBookmark';
import { useDeletePost, useTogglePinPost } from '@/lib/usePostManagement';
import { useAuthStore } from '@/lib/authStore';
import { useDrafts } from '@/lib/useDrafts';
import { useGuildStories } from '@/lib/useStories';
import { useStoryViewerStore } from '@/lib/storyViewerStore';
import {
  useCreatorOverview,
  useCreatorTopPosts,
  useFollowerGrowth,
  fmtNum,
  formatDelta,
  type AnalyticsPeriod,
  type ContentSortBy,
} from '@/lib/useAnalytics';
import { useFollowCounts } from '@/lib/useFollow';
import { useUserPosts } from '@/lib/usePosts';
import { supabase } from '@/lib/supabase';
import {
  GRID_COLUMNS,
  GRID_CELL_WIDTH,
  GRID_GAP,
  ProfileGridCell,
  PostManageModal,
  ProfileListHeader,
  ProfileStudioHeader,
  profileStyles as s,
  AnalyticsTab,
  BattleHistoryList,
  type ProfilePostGridItem,
  type ProfileTab,
} from '@/components/profile';
import { useTheme } from '@/lib/useTheme';
import { getProfileStyles } from '@/components/profile/profileStyles';

// Statische Zellhöhe — 4:5 Portrait-Format, berechnet einmalig aus Screen-Breite
const CELL_HEIGHT = Math.round(GRID_CELL_WIDTH * 5 / 4);


export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const s = getProfileStyles(colors);
  const { profile, signOut } = useAuthStore();

  const [activeTab, setActiveTab] = useState<ProfileTab>('vibes');
  const [managePost, setManagePost] = useState<{ id: string; media_url?: string; media_type?: string } | null>(null);
  const [repostedPosts, setRepostedPosts] = useState<ProfilePostGridItem[]>([]);
  const [repostLoading, setRepostLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortKey, setSortKey] = useState<'views' | 'likes' | 'comments' | 'dwell' | 'newest' | 'oldest'>('views');
  // Analytics: Period-Picker + Content-Sort
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>(28);
  const [contentSort, setContentSort] = useState<ContentSortBy>('views');
  // Lokaler Zustand: sobald der User eigene Stories anschaut → Ring sofort grau
  const [ownStoryViewed, setOwnStoryViewed] = useState(false);

  const { data: posts = [], isLoading: loadingPosts, refetch: refetchPosts } = useUserPosts(profile?.id ?? null);
  const { data: savedPosts = [], isLoading: loadingSaved } = useBookmarkedPosts();

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetchPosts();
    setIsRefreshing(false);
  }, [refetchPosts]);

  const queryClient = useQueryClient();

  // Bei Fokus: Posts UND Guild-Stories invalidieren → Ring-Farbe aktualisiert sich nach Story-Ansehen
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['user-posts', profile?.id] });
      // guild-stories stale machen → Ring wird sofort grau wenn Stories gesehen
      queryClient.invalidateQueries({ queryKey: ['guild-stories', profile?.id] });
    }, [queryClient, profile?.id]),
  );
  const { data: unreadNotifs = 0 } = useUnreadCount();
  const { mutateAsync: deletePost } = useDeletePost();
  const { mutate: togglePin } = useTogglePinPost();
  const { drafts, deleteDraft } = useDrafts();
  const { data: storyGroups = [] } = useGuildStories();
  const openStoryViewer = useStoryViewerStore((s) => s.open);
  const { data: followCounts } = useFollowCounts(profile?.id ?? null);

  const myUserId = profile?.id;
  const myStoryGroup = storyGroups.find((g) => g.userId === myUserId);
  const hasStories = (myStoryGroup?.stories?.length ?? 0) > 0;
  // ownStoryViewed überschreibt den Cache-Wert sofort beim Ansehen
  const hasUnviewedStories = ownStoryViewed ? false : (myStoryGroup?.hasUnviewed ?? false);

  const avgDwell = useMemo(() => {
    if (posts.length === 0) return 0;
    const sum = posts.reduce((acc, p) => acc + (p.dwell_time_score ?? 0), 0);
    return Math.round((sum / posts.length) * 100);
  }, [posts]);

  const totalViews    = useMemo(() => posts.reduce((a, p) => a + (p.view_count ?? 0), 0), [posts]);
  const totalLikes    = useMemo(() => posts.reduce((a, p) => a + (p.like_count ?? 0), 0), [posts]);
  const totalComments = useMemo(() => posts.reduce((a, p) => a + (p.comment_count ?? 0), 0), [posts]);

  // ── Analytics Hooks (echte Supabase-Daten) ────────────────────────
  const { data: overview, isLoading: loadingOverview } = useCreatorOverview(
    activeTab === 'analytics' ? (profile?.id ?? null) : null,
    analyticsPeriod,
  );
  const { data: topPosts = [], isLoading: loadingTopPosts } = useCreatorTopPosts(
    activeTab === 'analytics' ? (profile?.id ?? null) : null,
    contentSort,
    5,
  );
  const { data: followerGrowth = [] } = useFollowerGrowth(
    activeTab === 'analytics' ? (profile?.id ?? null) : null,
    analyticsPeriod,
  );

  // ── loadReposts: immer frisch, zwei-Schritt-Query ───────────────────
  const loadReposts = useCallback(async () => {
    if (!profile?.id) return;
    setRepostLoading(true);
    const { data: rows, error } = await supabase
      .from('reposts')
      .select('post_id, created_at')      // created_at = Repost-Zeitstempel
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(60);
    if (error || !rows || rows.length === 0) {
      setRepostedPosts([]);
      setRepostLoading(false);
      return;
    }
    // Map: post_id → repost timestamp
    const repostTimestamps: Record<string, string> = {};
    const postIds = rows
      .map((r: any) => { if (r.post_id) repostTimestamps[r.post_id] = r.created_at; return r.post_id; })
      .filter(Boolean);
    const { data: postsData } = await supabase
      .from('posts')
      .select('id, media_url, media_type, caption, dwell_time_score, thumbnail_url, view_count')
      .in('id', postIds);
    const byId = Object.fromEntries((postsData ?? []).map((p: any) => [p.id, p]));
    const ordered = postIds
      .map((pid: string) => byId[pid] ? { ...byId[pid], reposted_at: repostTimestamps[pid] } : null)
      .filter(Boolean);
    setRepostedPosts(ordered as ProfilePostGridItem[]);
    setRepostLoading(false);
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Laden wenn Tab aktiv wird
  useEffect(() => {
    if (activeTab === 'reposts') loadReposts();
  }, [activeTab, profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Supabase Realtime: INSERT + DELETE auf reposts ─────────────────────
  // Voraussetzung: reposts_realtime.sql in Supabase ausgeführt
  useEffect(() => {
    const uid = profile?.id;
    if (!uid) return;
    const channel = supabase
      .channel(`own_reposts_live_${uid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reposts', filter: `user_id=eq.${uid}` },
        async (payload) => {
          const newPostId = (payload.new as any).post_id;
          const repostedAt = (payload.new as any).created_at;
          if (!newPostId) return;
          const { data } = await supabase
            .from('posts')
            .select('id, media_url, media_type, caption, dwell_time_score, thumbnail_url, view_count')
            .eq('id', newPostId)
            .single();
          if (data) {
            const item: ProfilePostGridItem = { ...(data as any), reposted_at: repostedAt };
            setRepostedPosts((prev) => {
              if (prev.some((p) => p.id === item.id)) return prev;
              return [item, ...prev];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'reposts', filter: `user_id=eq.${uid}` },
        (payload) => {
          const deletedPostId = (payload.old as any).post_id;
          if (deletedPostId) {
            setRepostedPosts((prev) => prev.filter((p) => p.id !== deletedPostId));
          } else {
            loadReposts(); // Fallback
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Analytics: Posts nach dwell_time_score sortiert (absteigend)
  const analyticsPosts = useMemo(() => {
    return [...posts].sort((a, b) => (b.dwell_time_score ?? 0) - (a.dwell_time_score ?? 0));
  }, [posts]);

  const maxDwell = analyticsPosts[0]?.dwell_time_score ?? 1;

  const handlePostLongPress = (item: ProfilePostGridItem) =>
    setManagePost({ id: item.id, media_url: item.media_url ?? undefined, media_type: item.media_type ?? undefined });

  const handleEditPost = (postId: string) => {
    router.push({ pathname: '/edit-post/[id]', params: { id: postId } });
  };

  const handleDeletePost = (postId: string) => {
    Alert.alert('Löschen?', 'Wirklich?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => deletePost(postId) },
    ]);
  };

  const handleSignOut = () =>
    Alert.alert('Abmelden?', undefined, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Ausloggen', style: 'destructive', onPress: signOut },
    ]);

  const avatarInitial = (profile?.username ?? '?')[0].toUpperCase();
  const postCount = posts.length;

  // Analytics und Drafts haben eigene Overlay-Renderer, nicht in der FlashList
  const rawListData: ProfilePostGridItem[] = activeTab === 'vibes' ? (posts as ProfilePostGridItem[])
    : activeTab === 'saved' ? (savedPosts as unknown as ProfilePostGridItem[])
      : activeTab === 'reposts' ? repostedPosts
        : []; // analytics + drafts → separater Renderer

  // Leere Placeholder-Items auffüllen damit die letzte Reihe immer vollständig ist.
  // Verhindert dass 2 Items die letzte Spalte aufteilen (Instagram-Verhalten).
  const remainder = rawListData.length % GRID_COLUMNS;
  const listData: ProfilePostGridItem[] = remainder === 0
    ? rawListData
    : [
      ...rawListData,
      ...Array.from({ length: GRID_COLUMNS - remainder }, (_, i) => ({
        id: `__placeholder_${i}`,
        __isPlaceholder: true,
      } as unknown as ProfilePostGridItem)),
    ];

  // Gepinnter Post im eigenen Profil
  const pinnedPost = posts.find((p) => (p as any).is_pinned);
  const pinnedPostId = pinnedPost?.id ?? null;

  // Stabile renderItem-Funktion — verhindert Re-Renders aller Grid-Zellen bei State-Updates
  const pinnedPostIdRef = useRef(pinnedPostId);
  pinnedPostIdRef.current = pinnedPostId;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const renderGridItem = useCallback(({ item, index }: { item: ProfilePostGridItem; index: number }) => {
    // Placeholder: leere transparente Zelle für unvollständige letzte Reihe
    if ((item as any).__isPlaceholder) {
      return <View style={s.gridCell} />;
    }

    return (
      <View style={s.gridCell}>
        <ProfileGridCell
          post={item}
          onPress={() => {
            if (activeTabRef.current === 'vibes') {
              router.push({
                pathname: '/user-posts',
                params: {
                  userId: profile?.id ?? '',
                  startIndex: String(index),
                  username: profile?.username ?? '',
                },
              });
            } else {
              // Saved / Reposts: gleiche TikTok-Scroll-Ansicht wie Vibes-Tab
              const currentList = activeTabRef.current === 'saved'
                ? (savedPosts as unknown as ProfilePostGridItem[])
                : repostedPosts;
              const ids = currentList.map((p) => p.id).join(',');
              router.push({
                pathname: '/user-posts',
                params: {
                  postIds: ids,
                  startIndex: String(index),
                  username: profile?.username ?? '',
                },
              });
            }
          }}
          onLongPress={
            activeTabRef.current === 'vibes'
              ? () => {
                impactAsync(ImpactFeedbackStyle.Medium);
                handlePostLongPress(item);
              }
              : undefined
          }
        />
        {/* 📌 Pin-Badge */}
        {activeTabRef.current === 'vibes' && item.id === pinnedPostIdRef.current && (
          <View style={{
            position: 'absolute', top: 6, left: 6,
            backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 8,
            paddingHorizontal: 5, paddingVertical: 2
          }}>
            <Text style={{ fontSize: 11 }}>📌</Text>
          </View>
        )}
      </View>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, profile?.id, profile?.username, handlePostLongPress]);


  return (
    <View style={s.root}>

      <ProfileStudioHeader
        username={profile?.username ?? '…'}
        paddingTop={insets.top + 14}
        unreadNotifs={unreadNotifs}
        onNotifications={() => router.push('/notifications')}
        onSettings={() => router.push('/settings')}
        onSignOut={handleSignOut}
      />

      <FlatList
        key={activeTab}
        data={listData}
        keyExtractor={(item) => item.id}
        numColumns={GRID_COLUMNS}
        columnWrapperStyle={{ gap: GRID_GAP }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#FFFFFF"
            colors={['#FFFFFF']}
          />
        }
        ListHeaderComponent={
          <ProfileListHeader
            profile={profile}
            followCounts={followCounts}
            hasStories={hasStories}
            hasUnviewedStories={hasUnviewedStories}
            onAvatarPress={() => {
              if (!myStoryGroup || !hasStories) return;
              impactAsync(ImpactFeedbackStyle.Light);
              setOwnStoryViewed(true); // Ring sofort grau — kein Cache-Warten
              openStoryViewer(myStoryGroup, [myStoryGroup]);
              router.push('/story-viewer' as any);
            }}
            onCreateStory={() => {
              impactAsync(ImpactFeedbackStyle.Medium);
              router.push('/create-story' as any);
            }}
            onEditProfile={() => router.push('/settings')}
            onBuyCoins={() => router.push('/coin-shop' as any)}
            onMyShop={() => router.push('/shop/my-shop' as any)}
            onSavedProducts={() => router.push('/shop/saved' as any)}
            onMyOrders={() => router.push('/shop/orders' as any)}
            onCreatorStudio={profile?.is_creator ? () => router.push('/creator/dashboard' as any) : undefined}
            onCreatorStats={profile?.is_creator ? () => router.push('/creator/stats' as any) : undefined}
            avatarInitial={avatarInitial}
            avgDwell={avgDwell}
            postCount={postCount}
            loadingPosts={loadingPosts}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        }
        renderItem={renderGridItem}
        ListEmptyComponent={
          // ─ Drafts-Tab ─
          activeTab === 'drafts' ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              {drafts.length === 0 ? (
                <View style={s.empty}>
                  <FileText size={40} color={colors.icon.muted} />
                  <Text style={s.emptyTitle}>Keine Entwürfe</Text>
                  <Text style={s.emptySub}>Speichere einen Post als Entwurf, um ihn später zu veröffentlichen.</Text>
                </View>
              ) : (
                drafts.map((draft) => (
                    <View style={[
                      {flexDirection: 'row', alignItems: 'center'},
                      {backgroundColor: colors.bg.secondary, borderRadius: 14, padding: 12, marginBottom: 10, gap: 12}
                    ]}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                        {draft.caption || 'Ohne Titel'}
                      </Text>
                        <Text style={{ color: colors.text.muted, fontSize: 11, marginTop: 2 }}>
                        {new Date(draft.createdAt).toLocaleDateString('de-DE')}
                        {draft.tags.length > 0 ? `  •  ${draft.tags.map((t) => `#${t}`).join(' ')}` : ''}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => Alert.alert('Entwurf löschen?', 'Dieser Entwurf wird unwiderruflich gelöscht.', [
                        { text: 'Abbrechen', style: 'cancel' },
                        { text: 'Löschen', style: 'destructive', onPress: () => deleteDraft(draft.id) },
                      ])}
                      hitSlop={8}
                    >
                      <Trash2 size={18} color="#EF4444" strokeWidth={2} />
                    </Pressable>
                  </View>
                ))
              )}
            </View>

            // ─ Analytics-Tab (UPGRADED) ─
          ) : activeTab === 'analytics' ? (
            <AnalyticsTab
              userId={profile?.id ?? null}
              period={analyticsPeriod}
              onPeriodChange={(p: AnalyticsPeriod) => { impactAsync(ImpactFeedbackStyle.Light); setAnalyticsPeriod(p); }}
              contentSort={contentSort}
              onContentSortChange={(s: ContentSortBy) => { impactAsync(ImpactFeedbackStyle.Light); setContentSort(s); }}
              onPostPress={(postId: string, mediaUrl: string | null, mediaType: string | null, caption: string | null) =>
                router.push({ pathname: '/post/[id]', params: { id: postId, previewUrl: mediaUrl ?? '', previewType: mediaType ?? 'image', previewCaption: caption ?? '' } })
              }
            />

            // ─ Battle-History-Tab (v1.17.0) ─
          ) : activeTab === 'battles' ? (
            <BattleHistoryList userId={profile?.id ?? null} />

            // ─ Vibes leer ─
          ) : activeTab === 'vibes' && loadingPosts ? (
            <View style={s.empty}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          ) : activeTab === 'saved' && loadingSaved ? (
            <View style={s.empty}>
              <ActivityIndicator color="#FBBF24" />
            </View>
          ) : activeTab === 'vibes' ? (
            <View style={s.empty}>
              <Sparkles size={40} color="rgba(255,255,255,0.25)" />
              <Text style={s.emptyTitle}>Noch keine Vibes</Text>
              <Text style={s.emptySub}>Erstelle deinen ersten Post über das + unten.</Text>
            </View>
          ) : (
            <View style={s.empty}>
              <Bookmark size={40} color="rgba(255,255,255,0.25)" />
              <Text style={s.emptyTitle}>Noch nichts gespeichert</Text>
              <Text style={s.emptySub}>Tippe auf das Lesezeichen-Symbol bei einem Post.</Text>
            </View>
          )
        }
        ListFooterComponent={
          activeTab === 'vibes' && posts.length > 0 ? (
            <Pressable
              style={s.cellAdd}
              onPress={() => router.push('/create')}
              accessibilityRole="button"
              accessibilityLabel="Neuen Post erstellen"
            >
              <PlusCircle size={24} color="rgba(255,255,255,0.1)" strokeWidth={1.2} />
            </Pressable>
          ) : null
        }
      />

      <PostManageModal
        visible={!!managePost}
        postId={managePost?.id ?? ''}
        mediaUrl={managePost?.media_url}
        mediaType={managePost?.media_type}
        isPinned={managePost?.id === pinnedPostId}
        onClose={() => setManagePost(null)}
        onEdit={() => managePost && handleEditPost(managePost.id)}
        onDelete={() => managePost && handleDeletePost(managePost.id)}
        onTogglePin={() => managePost && togglePin({
          postId: managePost.id,
          currentlyPinned: managePost.id === pinnedPostId,
        })}
      />

      {/* Drafts jetzt in ListEmptyComponent */}
    </View>
  );
}

// ─ fmtNum: re-exported from useAnalytics ─ (local duplicate removed to avoid conflict)

import { StyleSheet } from 'react-native';

const analyticsStyle = StyleSheet.create({
  // ── Summary Grid
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 28,
  },
  kpiCard: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 8,
  },
  kpiIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  kpiLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  kpiValue: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -1,
    lineHeight: 32,
  },
  // ── Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  // ── Sort Controls
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sortScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 4,
  },
  sortPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sortPillActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  sortPillText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '500',
  },
  sortPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // ── Post Rows
  postRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rank: {
    color: 'rgba(255,255,255,0.15)',
    fontSize: 11,
    fontWeight: '600',
    width: 20,
    textAlign: 'center',
  },
  thumbWrap: { position: 'relative' },
  thumb: {
    width: 48,
    height: 62,
    borderRadius: 6,
  },
  thumbFallback: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoTag: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  videoTagText: { color: 'rgba(255,255,255,0.7)', fontSize: 7, fontWeight: '700' },
  postInfo: { flex: 1, gap: 4 },
  postCaption: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  // Metric chips — all same muted color
  metricRow: { flexDirection: 'row', gap: 10, marginTop: 1 },
  metricChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metricText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '500',
  },
  // Dwell bar
  dwellTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginTop: 4,
  },
  dwellFill: { height: '100%', borderRadius: 2 },
  dwellLabel: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
