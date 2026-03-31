import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
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

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, signOut } = useAuthStore();

  const [activeTab, setActiveTab] = useState<ProfileTab>('vibes');
  const [managePostId, setManagePostId] = useState<string | null>(null);

  const { data: posts = [], isLoading: loadingPosts, refetch: refetchPosts } = useUserPosts(profile?.id ?? null);
  const { data: savedPosts = [], isLoading: loadingSaved } = useBookmarkedPosts();

  // Beim Tab-Wechsel immer neu laden — verhindert Stale-Cache Probleme
  useFocusEffect(
    useCallback(() => {
      refetchPosts();
    }, [refetchPosts]),
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

  // Analytics: Posts nach dwell_time_score sortiert (absteigend)
  const analyticsPosts = useMemo(() => {
    return [...posts].sort((a, b) => (b.dwell_time_score ?? 0) - (a.dwell_time_score ?? 0));
  }, [posts]);

  const maxDwell = analyticsPosts[0]?.dwell_time_score ?? 1;

  const handlePostLongPress = (postId: string) => setManagePostId(postId);

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
    : []; // analytics + drafts → separater Renderer

  // Gepinnter Post im eigenen Profil
  const pinnedPost = posts.find((p) => (p as any).is_pinned);
  const pinnedPostId = pinnedPost?.id ?? null;

  return (
    <View style={s.root}>
      <LinearGradient
        colors={['rgba(8,145,178,0.14)', 'transparent']}
        style={[s.heroBg, { height: 200 + insets.top }]}
        pointerEvents="none"
      />

      <ProfileStudioHeader
        username={profile?.username ?? '…'}
        paddingTop={insets.top + 14}
        unreadNotifs={unreadNotifs}
        onNotifications={() => router.push('/notifications')}
        onSettings={() => router.push('/settings')}
        onSignOut={handleSignOut}
      />

      <FlashList
        data={listData}
        keyExtractor={(item) => item.id}
        numColumns={GRID_COLUMNS}
        estimatedItemSize={Math.round(GRID_CELL_WIDTH * 1.25)}
        overrideItemLayout={(layout) => {
          // FlashList braucht exakte Höhe bei numColumns, sonst alles senkrecht
          layout.size = Math.round(GRID_CELL_WIDTH * 1.25);
        }}
        extraData={activeTab}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        ListHeaderComponent={
          <ProfileListHeader
            profile={profile}
            followCounts={followCounts}
            hasStories={hasStories}
            hasUnviewedStories={hasUnviewedStories}
            onAvatarPress={() => {
              if (!myStoryGroup || !hasStories) {
                // Keine eigenen Stories → Story-Erstellen starten
                router.push('/create-story' as any);
                return;
              }
              // Stories vorhanden → Story-Viewer öffnen
              impactAsync(ImpactFeedbackStyle.Light);
              openStoryViewer(myStoryGroup, storyGroups);
              router.push('/story-viewer' as any);
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
        renderItem={({ item, index }) => (
          <View style={s.gridCell}>
            <ProfileGridCell
              post={item}
              onPress={() => {
                if (activeTab === 'vibes') {
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
                activeTab === 'vibes'
                  ? () => {
                      impactAsync(ImpactFeedbackStyle.Medium);
                      handlePostLongPress(item.id);
                    }
                  : undefined
              }
            />
            {/* 📌 Pin-Badge */}
            {activeTab === 'vibes' && item.id === pinnedPostId && (
              <View style={{ position: 'absolute', top: 6, left: 6,
                backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 8,
                paddingHorizontal: 5, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11 }}>📌</Text>
              </View>
            )}
          </View>
        )}
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
                  <View key={draft.id} style={{ flexDirection: 'row', alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14,
                    padding: 12, marginBottom: 10, gap: 12 }}>
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
                    onPress={() => router.push({ pathname: '/post/[id]', params: {
                      id: item.id,
                      previewUrl: item.media_url ?? '',
                      previewType: item.media_type ?? 'image',
                      previewCaption: item.caption ?? '',
                    }})}
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
        visible={!!managePostId}
        postId={managePostId ?? ''}
        isPinned={managePostId === pinnedPostId}
        onClose={() => setManagePostId(null)}
        onEdit={() => managePostId && handleEditPost(managePostId)}
        onDelete={() => managePostId && handleDeletePost(managePostId)}
        onTogglePin={() => managePostId && togglePin({
          postId: managePostId,
          currentlyPinned: managePostId === pinnedPostId,
        })}
      />

      {/* Drafts jetzt in ListEmptyComponent */}
    </View>
  );
}
