import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { View, Text, Pressable, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { PlusCircle, Sparkles, Bookmark, BarChart2, FileText, Trash2 } from 'lucide-react-native';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import { useUnreadCount } from '@/lib/useNotifications';
import { useBookmarkedPosts } from '@/lib/useBookmark';
import { useDeletePost, useTogglePinPost } from '@/lib/usePostManagement';
import { useAuthStore } from '@/lib/authStore';
import { useDrafts } from '@/lib/useDrafts';
import { useGuildStories } from '@/lib/useStories';
import { useStoryViewerStore } from '@/lib/storyViewerStore';
import { useFollowCounts } from '@/lib/useFollow';
import { useUserPosts } from '@/lib/usePosts';
import { supabase } from '@/lib/supabase';
import {
  GRID_COLUMNS,
  GRID_CELL_WIDTH,
  ProfileGridCell,
  PostManageModal,
  ProfileListHeader,
  ProfileStudioHeader,
  profileStyles as s,
  type ProfilePostGridItem,
  type ProfileTab,
} from '@/components/profile';

// Statische Zellhöhe — 4:5 Portrait-Format, berechnet einmalig aus Screen-Breite
const CELL_HEIGHT = Math.round(GRID_CELL_WIDTH * 5 / 4);


export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, signOut } = useAuthStore();

  const [activeTab, setActiveTab] = useState<ProfileTab>('vibes');
  const [managePost, setManagePost] = useState<{ id: string; media_url?: string; media_type?: string } | null>(null);
  const [repostedPosts, setRepostedPosts] = useState<ProfilePostGridItem[]>([]);
  const [repostLoading, setRepostLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: posts = [], isLoading: loadingPosts, refetch: refetchPosts } = useUserPosts(profile?.id ?? null);
  const { data: savedPosts = [], isLoading: loadingSaved } = useBookmarkedPosts();

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetchPosts();
    setIsRefreshing(false);
  }, [refetchPosts]);

  const queryClient = useQueryClient();

  // Nur invalidieren wenn Daten wirklich stale sind (respektiert staleTime)
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['user-posts', profile?.id] });
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
  const hasUnviewedStories = myStoryGroup?.hasUnviewed ?? false;

  const avgDwell = useMemo(() => {
    if (posts.length === 0) return 0;
    const sum = posts.reduce((acc, p) => acc + (p.dwell_time_score ?? 0), 0);
    return Math.round((sum / posts.length) * 100);
  }, [posts]);

  // ── loadReposts: immer frisch, zwei-Schritt-Query ───────────────────
  const loadReposts = useCallback(async () => {
    if (!profile?.id) return;
    setRepostLoading(true);
    const { data: rows, error } = await supabase
      .from('reposts')
      .select('post_id')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(60);
    if (error || !rows || rows.length === 0) {
      setRepostedPosts([]);
      setRepostLoading(false);
      return;
    }
    const postIds = rows.map((r: any) => r.post_id).filter(Boolean);
    const { data: postsData } = await supabase
      .from('posts')
      .select('id, media_url, media_type, caption, dwell_time_score')
      .in('id', postIds);
    const byId = Object.fromEntries((postsData ?? []).map((p: any) => [p.id, p]));
    const ordered = postIds.map((pid: string) => byId[pid]).filter(Boolean);
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
          if (!newPostId) return;
          const { data } = await supabase
            .from('posts')
            .select('id, media_url, media_type, caption, dwell_time_score')
            .eq('id', newPostId)
            .single();
          if (data) {
            setRepostedPosts((prev) => {
              if (prev.some((p) => p.id === (data as any).id)) return prev;
              return [data as ProfilePostGridItem, ...prev];
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
  const listData: ProfilePostGridItem[] = activeTab === 'vibes' ? (posts as ProfilePostGridItem[])
    : activeTab === 'saved' ? (savedPosts as unknown as ProfilePostGridItem[])
      : activeTab === 'reposts' ? repostedPosts
        : []; // analytics + drafts → separater Renderer

  // Gepinnter Post im eigenen Profil
  const pinnedPost = posts.find((p) => (p as any).is_pinned);
  const pinnedPostId = pinnedPost?.id ?? null;

  // Stabile renderItem-Funktion — verhindert Re-Renders aller Grid-Zellen bei State-Updates
  const pinnedPostIdRef = useRef(pinnedPostId);
  pinnedPostIdRef.current = pinnedPostId;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const renderGridItem = useCallback(({ item, index }: { item: ProfilePostGridItem; index: number }) => (
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
            router.push({
              pathname: '/post/[id]',
              params: {
                id: item.id,
                previewUrl: item.media_url ?? '',
                previewType: item.media_type ?? 'image',
                previewCaption: item.caption ?? '',
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [router, profile?.id, profile?.username, handlePostLongPress]);

  const overrideItemLayout = useCallback((layout: { size?: number }) => {
    layout.size = CELL_HEIGHT;
  }, []);


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

      <FlashList
        key={activeTab}
        data={listData}
        keyExtractor={(item) => item.id}
        numColumns={GRID_COLUMNS}
        estimatedItemSize={CELL_HEIGHT}

        overrideItemLayout={overrideItemLayout}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#22D3EE"
            colors={['#22D3EE']}
          />
        }
        ListHeaderComponent={
          <ProfileListHeader
            profile={profile}
            followCounts={followCounts}
            hasStories={hasStories}
            hasUnviewedStories={hasUnviewedStories}
            onAvatarPress={() => {
              if (!myStoryGroup || !hasStories) {
                // Keine Stories → direkt zu Story-Erstellen
                router.push('/create-story' as any);
                return;
              }
              // Stories vorhanden → Auswahl: Ansehen ODER Neue Story
              impactAsync(ImpactFeedbackStyle.Light);
              Alert.alert(
                'Deine Story',
                undefined,
                [
                  {
                    text: '▶  Story ansehen',
                    onPress: () => {
                      openStoryViewer(myStoryGroup, storyGroups);
                      router.push('/story-viewer' as any);
                    },
                  },
                  {
                    text: '＋  Neue Story erstellen',
                    onPress: () => router.push('/create-story' as any),
                  },
                  { text: 'Abbrechen', style: 'cancel' },
                ],
                { cancelable: true },
              );
            }}
            onEditProfile={() => router.push('/settings')}
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
                  <FileText size={40} color="rgba(255,255,255,0.2)" />
                  <Text style={s.emptyTitle}>Keine Entwürfe</Text>
                  <Text style={s.emptySub}>Speichere einen Post als Entwurf, um ihn später zu veröffentlichen.</Text>
                </View>
              ) : (
                drafts.map((draft) => (
                  <View key={draft.id} style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14,
                    padding: 12, marginBottom: 10, gap: 12
                  }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                        {draft.caption || 'Ohne Titel'}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>
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

            // ─ Analytics-Tab ─
          ) : activeTab === 'analytics' ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              {analyticsPosts.length === 0 ? (
                <View style={s.empty}>
                  <ActivityIndicator color="#22D3EE" />
                </View>
              ) : (
                analyticsPosts.map((item, index) => (
                  <Pressable
                    key={item.id}
                    style={s.analyticsRow}
                    onPress={() => router.push({
                      pathname: '/post/[id]', params: {
                        id: item.id,
                        previewUrl: item.media_url ?? '',
                        previewType: item.media_type ?? 'image',
                        previewCaption: item.caption ?? '',
                      }
                    })}
                    accessibilityRole="button"
                    accessibilityLabel={`Post ${index + 1}`}
                  >
                    <Text style={s.analyticsRank}>#{index + 1}</Text>
                    <View style={s.analyticsContent}>
                      <Text style={s.analyticsCaption} numberOfLines={1}>
                        {item.caption ? item.caption : (item.media_type === 'video' ? 'Video' : 'Bild')}
                      </Text>
                      <View style={s.analyticsBarTrack}>
                        <LinearGradient
                          colors={['#0891B2', '#22D3EE']}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                          style={[s.analyticsBarFill, { width: `${Math.max(4, ((item.dwell_time_score ?? 0) / Math.max(maxDwell, 0.01)) * 100)}%` }]}
                        />
                      </View>
                    </View>
                    <View style={s.analyticsScore}>
                      <Text style={s.analyticsScoreNum}>
                        {Math.round(((item.dwell_time_score ?? 0) / Math.max(maxDwell, 0.01)) * 100)}%
                      </Text>
                      <Text style={s.analyticsScoreLabel}>Score</Text>
                    </View>
                  </Pressable>
                ))
              )}
            </View>

            // ─ Vibes leer ─
          ) : activeTab === 'vibes' && loadingPosts ? (
            <View style={s.empty}>
              <ActivityIndicator color="#22D3EE" />
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
